import http from "node:http";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const port = Number(process.env.PORT || 3000);
const siteId = process.env.JRC_SITE_ID || "jrcedu-main";
const publicApiToken = process.env.JRC_API_TOKEN || "";
const uploadDir = process.env.JRC_UPLOAD_DIR || "/opt/jrcedu-uploads";
const uploadMaxBytes = Number(process.env.JRC_UPLOAD_MAX_BYTES || 30 * 1024 * 1024);
const jsonMaxBytes = Number(process.env.JRC_JSON_MAX_BYTES || 72 * 1024 * 1024);
const minimaxApiKey = process.env.JRC_MINIMAX_API_KEY || process.env.MINIMAX_API_KEY || "";
const minimaxApiUrl = process.env.JRC_MINIMAX_API_URL || "https://api.minimax.io/v1/chat/completions";
const minimaxModel = process.env.JRC_MINIMAX_MODEL || "MiniMax-M3";
const minimaxGroupId = process.env.JRC_MINIMAX_GROUP_ID || "";
const allowedOrigins = (process.env.JRC_ALLOWED_ORIGINS || "https://jrc-edu.github.io,http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCurriculumExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".heic"
]);
const contentTypeByExtension = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".heic", "image/heic"]
]);

const pool = new Pool({
  host: process.env.JRC_DB_HOST,
  port: Number(process.env.JRC_DB_PORT || 5432),
  database: process.env.JRC_DB_NAME || "jrcedu",
  user: process.env.JRC_DB_USER,
  password: process.env.JRC_DB_PASSWORD,
  ssl: process.env.JRC_DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: Number(process.env.JRC_DB_POOL_MAX || 5)
});

function send(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const allowOrigin = allowedOrigins.includes(origin) || origin.endsWith(".github.io") ? origin : allowedOrigins[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true"
  };
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signToken(payload) {
  if (!publicApiToken) return "";
  const encoded = base64UrlEncode(payload);
  const signature = crypto.createHmac("sha256", publicApiToken).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySessionToken(token) {
  if (!publicApiToken || !token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", publicApiToken).update(encoded).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = base64UrlJson(encoded);
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function getAuthorization(req) {
  if (!publicApiToken) return true;
  const header = req.headers.authorization || "";
  if (header === `Bearer ${publicApiToken}`) return { kind: "api-token" };
  if (header.startsWith("Bearer ")) {
    const payload = verifySessionToken(header.slice("Bearer ".length));
    if (payload) return { kind: "session", payload };
  }
  return null;
}

async function readJson(req, maxBytes = jsonMaxBytes) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error("request body too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

function encodeStorageKey(storageKey) {
  return String(storageKey || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function sanitizeOriginalFileName(fileName) {
  return String(fileName || "课程资料")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "课程资料";
}

function sanitizeStorageSegment(value, fallback = "未分类") {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || fallback;
}

function curriculumStorageFolder(metadata = {}) {
  const grade = sanitizeStorageSegment(metadata.grade, "未分年级");
  const track = sanitizeStorageSegment(metadata.track, "未分体系");
  const month = new Date().toISOString().slice(0, 7);
  return `curriculum/${grade}/${track}/${month}`;
}

function curriculumVersionFileName(originalFileName, extension) {
  const basename = path.basename(originalFileName, extension);
  const readableName = sanitizeStorageSegment(basename, "课程资料").slice(0, 96);
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const randomId = crypto.randomBytes(5).toString("hex");
  return `${timestamp}-${randomId}-${readableName}${extension}`;
}

function resolveUploadPath(storageKey) {
  const normalizedKey = path.posix.normalize(String(storageKey || "").replace(/^\/+/g, ""));
  if (!normalizedKey || normalizedKey.startsWith("../") || normalizedKey.includes("/../")) return null;
  if (!normalizedKey.startsWith("curriculum/")) return null;
  const absolutePath = path.resolve(uploadDir, normalizedKey);
  const rootPath = path.resolve(uploadDir);
  if (!absolutePath.startsWith(`${rootPath}${path.sep}`)) return null;
  return absolutePath;
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    const error = new Error("invalid data url");
    error.statusCode = 400;
    throw error;
  }
  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const data = match[3] || "";
  return {
    contentType,
    buffer: isBase64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8")
  };
}

function toEmployee(row, permissions = []) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    phone: row.phone || "",
    wechat: row.wechat || "",
    subject: row.subject || "",
    scope: row.scope || "",
    hireDate: row.hire_date ? row.hire_date.toISOString().slice(0, 10) : "",
    regularDate: row.regular_date ? row.regular_date.toISOString().slice(0, 10) : "",
    commissionRate: row.commission_rate === null ? "" : `${Number(row.commission_rate)}%`,
    status: row.status,
    permissions
  };
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}-${Date.now().toString(36)}`;
}

function parseCsvRecords(text) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;
  const input = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === "\"") {
      if (insideQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(values[index] || "").trim();
    });
    return record;
  });
}

function normalizeTimeText(value) {
  const normalized = String(value || "")
    .trim()
    .replaceAll("：", ":")
    .replaceAll("；", ":")
    .replaceAll(";", ":");
  const match = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return normalized;
  return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
}

function normalizeScheduleStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["adjusted", "changed", "调课"].includes(normalized)) return "adjusted";
  if (["makeup", "补课"].includes(normalized)) return "makeup";
  if (["leave", "paused", "休息", "停课"].includes(normalized)) return "leave";
  return "scheduled";
}

function normalizeConfirmationStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["confirmed", "done", "已确认"].includes(normalized) ? "confirmed" : "pending";
}

function normalizeRegularEntry(item) {
  if (!item || typeof item !== "object") return null;
  const teacherName = String(item.teacherName || item.teacher_name || "").trim();
  const className = String(item.className || item.class_name || "").trim();
  const courseDate = String(item.courseDate || item.course_date || "").trim();
  const startTime = normalizeTimeText(item.startTime || item.start_time || "");
  const endTime = normalizeTimeText(item.endTime || item.end_time || "");
  const classroomName = String(item.classroomName || item.classroom_name || "").trim();
  const notes = String(item.notes || "").trim();
  if (!(teacherName || className || courseDate || startTime || endTime || classroomName || notes)) return null;
  return {
    id: item.id || makeId("june-entry"),
    teacherName,
    className,
    courseDate,
    slotIndex: Number(item.slotIndex || item.slot_index || 0),
    startTime,
    endTime,
    classroomName,
    scheduleStatus: normalizeScheduleStatus(item.scheduleStatus || item.schedule_status || ""),
    confirmationStatus: normalizeConfirmationStatus(item.confirmationStatus || item.confirmation_status || ""),
    notes
  };
}

function compareRegularEntries(left, right) {
  return (
    String(left.courseDate || "").localeCompare(String(right.courseDate || "")) ||
    String(left.startTime || "").localeCompare(String(right.startTime || "")) ||
    Number(left.slotIndex || 0) - Number(right.slotIndex || 0) ||
    String(left.teacherName || "").localeCompare(String(right.teacherName || ""), "zh-CN") ||
    String(left.className || "").localeCompare(String(right.className || ""), "zh-CN")
  );
}

function normalizeRegularState(snapshot = {}) {
  const scheduleEntries = Array.isArray(snapshot.scheduleEntries)
    ? snapshot.scheduleEntries.map(normalizeRegularEntry).filter(Boolean)
    : Array.isArray(snapshot.schedule_entries)
      ? snapshot.schedule_entries.map(normalizeRegularEntry).filter(Boolean)
      : [];
  const teachers = new Map();
  (Array.isArray(snapshot.teachers) ? snapshot.teachers : []).forEach((teacher) => {
    const name = String(teacher?.name || teacher?.teacher_name || teacher?.teacherName || "").trim();
    if (name && !teachers.has(name)) teachers.set(name, { id: teacher.id || makeId("june-teacher"), name, subject: String(teacher.subject || "").trim() });
  });
  const rooms = new Map();
  (Array.isArray(snapshot.rooms) ? snapshot.rooms : []).forEach((room) => {
    const name = String(room?.name || room?.room_name || room?.roomName || "").trim();
    if (name && !rooms.has(name)) rooms.set(name, { id: room.id || makeId("june-room"), name, floor: String(room.floor || room.floor_name || room.floorName || "").trim() });
  });
  scheduleEntries.forEach((entry) => {
    if (entry.teacherName && !teachers.has(entry.teacherName)) {
      teachers.set(entry.teacherName, { id: makeId("june-teacher"), name: entry.teacherName, subject: "" });
    }
    if (entry.classroomName && !rooms.has(entry.classroomName)) {
      rooms.set(entry.classroomName, { id: makeId("june-room"), name: entry.classroomName, floor: "" });
    }
  });
  return {
    teachers: Array.from(teachers.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    rooms: Array.from(rooms.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    scheduleEntries: scheduleEntries.sort(compareRegularEntries)
  };
}

async function readModulePayload(storeKey) {
  const result = await pool.query("select payload from module_data_store where store_key = $1 limit 1", [storeKey]);
  return result.rows[0]?.payload || null;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function stableSerialize(value) {
  if (Array.isArray(value)) return value.map(stableSerialize);
  if (!isPlainObject(value)) return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableSerialize(value[key]);
    return result;
  }, {});
}

function buildModuleMergeId(prefix, row) {
  const explicitId = [
    row?.rowId,
    row?.id,
    row?.leadId,
    row?.followupId,
    row?.auditId,
    row?.ticketId,
    row?.sessionId,
    row?.recordId,
    row?.entryId,
    row?.versionId,
    row?.fileStorageKey
  ].map((value) => String(value || "").trim()).find(Boolean);
  if (explicitId) return explicitId;

  const stableParts = [
    row?.studentName,
    row?.parentPhone,
    row?.teacher,
    row?.teacherName,
    row?.className,
    row?.courseDate,
    row?.date,
    row?.startTime,
    row?.endTime,
    row?.time,
    row?.student,
    row?.name,
    row?.grade,
    row?.track,
    row?.lesson,
    row?.title,
    row?.fileName,
    row?.uploadedAt,
    row?.createdAt
  ].map((value) => String(value || "").trim()).filter(Boolean);

  const fallbackSeed = stableParts.length
    ? stableParts.join("|")
    : JSON.stringify(stableSerialize(Object.fromEntries(
      Object.entries(row || {}).filter(([key]) => !["updatedAt", "lastUpdatedAt", "lastViewedAt"].includes(key))
    )));
  const hash = crypto.createHash("sha1").update(fallbackSeed || `${prefix}-${Date.now()}`).digest("hex").slice(0, 16);
  return `${prefix}-${hash}`;
}

function mergeStructuredPayload(previous, incoming, path = "payload") {
  if (previous === undefined) return incoming;

  if (Array.isArray(previous) && Array.isArray(incoming)) {
    const allRows = [...previous, ...incoming];
    const objectRowsOnly = allRows.every((item) => item && typeof item === "object" && !Array.isArray(item));
    if (!objectRowsOnly) return incoming;

    const prefix = String(path.split(".").pop() || "row").replace(/[^\w-]/g, "") || "row";
    const map = new Map();

    previous.forEach((row) => {
      const rowId = buildModuleMergeId(prefix, row);
      map.set(rowId, { ...row, id: row?.id || rowId });
    });

    incoming.forEach((row) => {
      const rowId = buildModuleMergeId(prefix, row);
      const existing = map.get(rowId);
      const mergedRow = existing
        ? mergeStructuredPayload(existing, row, `${path}[]`)
        : row;
      map.set(rowId, {
        ...mergedRow,
        id: mergedRow?.id || row?.id || existing?.id || rowId
      });
    });

    return [...map.values()];
  }

  if (isPlainObject(previous) && isPlainObject(incoming)) {
    const merged = { ...previous };
    Object.entries(incoming).forEach(([key, value]) => {
      merged[key] = mergeStructuredPayload(previous[key], value, `${path}.${key}`);
    });
    return merged;
  }

  return incoming;
}

async function upsertModulePayload(storeKey, moduleKey, payload, operatorName = "-", operatorUsername = "-") {
  const result = await pool.query(`
    insert into module_data_store (
      store_key, module_key, payload, version, updated_by_name, updated_by_username, updated_at
    )
    values ($1, $2, $3::jsonb, 1, $4, $5, now())
    on conflict (store_key) do update set
      module_key = excluded.module_key,
      payload = excluded.payload,
      version = module_data_store.version + 1,
      updated_by_name = excluded.updated_by_name,
      updated_by_username = excluded.updated_by_username,
      updated_at = now()
    returning store_key, module_key, version, updated_at
  `, [storeKey, moduleKey, JSON.stringify(payload), operatorName, operatorUsername]);
  return result.rows[0];
}

async function employeeWithPermissions(username) {
  const employee = await pool.query(`
    select id, name, username, role, phone, wechat, subject, scope, hire_date, regular_date, commission_rate, status
    from employees
    where username = $1 and status = 'active'
    limit 1
  `, [username]);
  if (!employee.rows[0]) return null;
  const permissions = await pool.query(`
    select ep.permission_key
    from employee_permissions ep
    where ep.employee_id = $1
    order by ep.permission_key
  `, [employee.rows[0].id]);
  return toEmployee(employee.rows[0], permissions.rows.map((row) => row.permission_key));
}

async function handleHealth(res, headers) {
  await pool.query("select 1");
  send(res, 200, { ok: true, siteId, db: "connected" }, headers);
}

async function handleEmployees(res, headers) {
  const employees = await pool.query(`
    select id, name, username, role, phone, wechat, subject, scope, hire_date, regular_date, commission_rate, status
    from employees
    where status = 'active'
    order by role, name
  `);
  const permissions = await pool.query(`
    select e.username, ep.permission_key
    from employee_permissions ep
    join employees e on e.id = ep.employee_id
    order by e.username, ep.permission_key
  `);
  const permissionMap = permissions.rows.reduce((map, row) => {
    if (!map.has(row.username)) map.set(row.username, []);
    map.get(row.username).push(row.permission_key);
    return map;
  }, new Map());

  send(res, 200, {
    employees: employees.rows.map((row) => toEmployee(row, permissionMap.get(row.username) || []))
  }, headers);
}

async function handlePermissions(res, headers) {
  const catalog = await pool.query(`
    select permission_key, module_key, action_key, display_name, description
    from permission_catalog
    order by module_key, action_key, permission_key
  `);
  const roleDefaults = await pool.query(`
    select role, permission_key
    from role_permission_defaults
    order by role, permission_key
  `);
  send(res, 200, {
    permissions: catalog.rows.map((row) => ({
      permissionKey: row.permission_key,
      moduleKey: row.module_key,
      actionKey: row.action_key,
      displayName: row.display_name,
      description: row.description || ""
    })),
    roleDefaults: roleDefaults.rows.map((row) => ({
      role: row.role,
      permissionKey: row.permission_key
    }))
  }, headers);
}

async function handleLogin(req, res, headers) {
  const body = await readJson(req);
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || !password) {
    send(res, 400, { ok: false, error: "missing username or password" }, headers);
    return;
  }
  const result = await pool.query(`
    select username
    from employees
    where username = $1
      and status = 'active'
      and password_hash is not null
      and password_hash = crypt($2, password_hash)
    limit 1
  `, [username, password]);
  if (!result.rows[0]) {
    send(res, 401, { ok: false, error: "invalid credentials" }, headers);
    return;
  }
  const employee = await employeeWithPermissions(username);
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = signToken({
    sub: employee.username,
    name: employee.name,
    role: employee.role,
    exp: expiresAt
  });
  send(res, 200, { ok: true, siteId, employee, token, expiresAt }, headers);
}

async function handleGetModuleData(url, res, headers) {
  const storeKey = String(url.searchParams.get("storeKey") || "").trim();
  if (!storeKey) {
    send(res, 400, { ok: false, error: "missing storeKey" }, headers);
    return;
  }
  const result = await pool.query(`
    select store_key, module_key, payload, version, updated_by_name, updated_by_username, updated_at
    from module_data_store
    where store_key = $1
    limit 1
  `, [storeKey]);
  if (!result.rows[0]) {
    send(res, 200, { ok: true, found: false, storeKey, payload: null }, headers);
    return;
  }
  const row = result.rows[0];
  send(res, 200, {
    ok: true,
    found: true,
    storeKey: row.store_key,
    moduleKey: row.module_key,
    payload: row.payload,
    version: row.version,
    updatedByName: row.updated_by_name || "",
    updatedByUsername: row.updated_by_username || "",
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  }, headers);
}

async function handlePutModuleData(req, res, headers) {
  const body = await readJson(req);
  const storeKey = String(body.storeKey || "").trim();
  const moduleKey = String(body.moduleKey || "unknown").trim() || "unknown";
  if (!storeKey) {
    send(res, 400, { ok: false, error: "missing storeKey" }, headers);
    return;
  }
  const payload = body.payload === undefined ? null : body.payload;
  const operatorName = body.operatorName || body.operator?.name || "-";
  const operatorUsername = body.operatorUsername || body.operator?.username || "-";
  const replaceMode = body.replaceMode === "replace";
  const existing = await pool.query(`
    select payload, version
    from module_data_store
    where store_key = $1
    limit 1
  `, [storeKey]);
  const previousRow = existing.rows[0] || null;
  const mergedPayload = previousRow && !replaceMode
    ? mergeStructuredPayload(previousRow.payload, payload, storeKey)
    : payload;
  const result = await pool.query(`
    insert into module_data_store (
      store_key, module_key, payload, version, updated_by_name, updated_by_username, updated_at
    )
    values ($1, $2, $3::jsonb, 1, $4, $5, now())
    on conflict (store_key) do update set
      module_key = excluded.module_key,
      payload = excluded.payload,
      version = module_data_store.version + 1,
      updated_by_name = excluded.updated_by_name,
      updated_by_username = excluded.updated_by_username,
      updated_at = now()
    returning store_key, module_key, version, updated_at
  `, [storeKey, moduleKey, JSON.stringify(mergedPayload), operatorName, operatorUsername]);
  const nextVersion = result.rows[0].version;
  await pool.query(`
    insert into audit_logs (
      module_key,
      action_key,
      target_type,
      target_id,
      summary,
      before_data,
      after_data,
      operator_name,
      operator_username,
      operator_role
    )
    values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
  `, [
    moduleKey,
    previousRow ? "module-data-update" : "module-data-create",
    "module_store",
    storeKey,
    `${storeKey} 保存至 v${nextVersion}`,
    JSON.stringify(previousRow?.payload ?? null),
    JSON.stringify(mergedPayload),
    operatorName,
    operatorUsername,
    moduleKey
  ]);
  send(res, 200, {
    ok: true,
    storeKey: result.rows[0].store_key,
    moduleKey: result.rows[0].module_key,
    version: result.rows[0].version,
    merged: Boolean(previousRow) && !replaceMode && JSON.stringify(mergedPayload) !== JSON.stringify(payload),
    updatedAt: result.rows[0].updated_at?.toISOString?.() || result.rows[0].updated_at
  }, headers);
}

async function handleImportJuneRegularCsv(req, res, headers, authorization) {
  const body = await readJson(req);
  const records = parseCsvRecords(body.csv_text || "");
  const entries = records.map(normalizeRegularEntry).filter(Boolean);
  if (!entries.length) {
    send(res, 200, {
      ok: true,
      accepted_count: 0,
      question_count: 0,
      warning_count: 1,
      warnings: ["CSV 没有识别到可导入的排课行。"],
      questions: [],
      snapshot: normalizeRegularState({}),
      saved_at: new Date().toISOString(),
      summer_sync: { demand_count: 0, warning_count: 0, warnings: [], review_items: [] }
    }, headers);
    return;
  }

  const storeKey = "paike-june-system-v1";
  const metaKey = "paike-june-system-meta-v1";
  const existingPayload = await readModulePayload(storeKey);
  const existingSnapshot = existingPayload?.parsedValue || existingPayload || {};
  const snapshot = normalizeRegularState({
    ...existingSnapshot,
    scheduleEntries: entries
  });
  const savedAt = new Date().toISOString();
  const operatorName = authorization?.payload?.name || body.operatorName || "-";
  const operatorUsername = authorization?.payload?.sub || body.operatorUsername || "-";
  const summary = {
    scheduleEntries: snapshot.scheduleEntries.length,
    teachers: snapshot.teachers.length,
    rooms: snapshot.rooms.length
  };
  await upsertModulePayload(storeKey, "paike-legacy", {
    schemaVersion: "paike-legacy-cloud-store-v1",
    storeKey,
    rawValue: JSON.stringify(snapshot),
    parsedValue: snapshot,
    summary: {
      key: storeKey,
      label: "平时课数据",
      mode: "regular",
      summary
    },
    sourceUrl: body.source_url || "",
    savedAt
  }, operatorName, operatorUsername);
  await upsertModulePayload(metaKey, "paike-legacy", {
    schemaVersion: "paike-legacy-cloud-store-v1",
    storeKey: metaKey,
    rawValue: JSON.stringify({
      lastSavedAt: savedAt,
      browserSnapshotOrigin: "cloud_import",
      importLog: `已通过云端 CSV 导入 ${body.file_name || "老师排课 CSV"}，写入 ${entries.length} 行。`,
      importQuestions: []
    }),
    parsedValue: {
      lastSavedAt: savedAt,
      browserSnapshotOrigin: "cloud_import",
      importLog: `已通过云端 CSV 导入 ${body.file_name || "老师排课 CSV"}，写入 ${entries.length} 行。`,
      importQuestions: []
    },
    summary: {
      key: metaKey,
      label: "平时课状态",
      mode: "regular-meta",
      summary: { lastSavedAt: savedAt, importQuestions: 0 }
    },
    sourceUrl: body.source_url || "",
    savedAt
  }, operatorName, operatorUsername);

  send(res, 200, {
    ok: true,
    accepted_count: entries.length,
    question_count: 0,
    warning_count: 0,
    warnings: [],
    questions: [],
    snapshot,
    saved_at: savedAt,
    summer_sync: { demand_count: 0, warning_count: 0, warnings: [], review_items: [] }
  }, headers);
}

async function handleImportJuneRegularXlsx(res, headers) {
  send(res, 501, {
    ok: false,
    error: "xlsx_import_not_ready",
    message: "云端 XLSX 自动拆分解析器还在迁移中。当前请先把老师排课表另存为 CSV 后上传，或在排课明细里直接新增/修改。"
  }, headers);
}

async function handleUploadCurriculumFile(req, res, headers, authorization) {
  const bodyMaxBytes = Math.ceil(uploadMaxBytes * 1.45) + 1024 * 1024;
  const body = await readJson(req, bodyMaxBytes);
  const originalFileName = sanitizeOriginalFileName(body.fileName);
  const extension = path.extname(originalFileName).toLowerCase();
  if (!allowedCurriculumExtensions.has(extension)) {
    send(res, 400, {
      ok: false,
      error: "unsupported_file_type",
      message: "只支持 PDF、Word、PPT 和常见图片文件。"
    }, headers);
    return;
  }

  const decoded = decodeDataUrl(body.dataUrl);
  if (!decoded.buffer.length) {
    send(res, 400, { ok: false, error: "empty_file", message: "文件内容为空。" }, headers);
    return;
  }
  if (decoded.buffer.length > uploadMaxBytes) {
    send(res, 413, {
      ok: false,
      error: "file_too_large",
      message: `单个文件不能超过 ${Math.round(uploadMaxBytes / 1024 / 1024)}MB。`
    }, headers);
    return;
  }

  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const storedFileName = curriculumVersionFileName(originalFileName, extension);
  const storageKey = `${curriculumStorageFolder(metadata)}/${storedFileName}`;
  const absolutePath = resolveUploadPath(storageKey);
  if (!absolutePath) {
    send(res, 500, { ok: false, error: "invalid_storage_key" }, headers);
    return;
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, decoded.buffer, { flag: "wx" });

  const contentType = body.contentType || decoded.contentType || contentTypeByExtension.get(extension) || "application/octet-stream";
  const fileUrl = `/api/curriculum-files/${encodeStorageKey(storageKey)}`;
  const uploadedAt = new Date().toISOString();
  const uploadedByName = authorization?.payload?.name || body.operatorName || "-";
  const uploadedByUsername = authorization?.payload?.sub || body.operatorUsername || "-";
  const contentSha256 = crypto.createHash("sha256").update(decoded.buffer).digest("hex");
  const versionId = crypto.createHash("sha256").update(`${storageKey}:${contentSha256}`).digest("hex").slice(0, 16);
  await fs.writeFile(`${absolutePath}.metadata.json`, JSON.stringify({
    versionId,
    storageKey,
    originalFileName,
    fileType: contentType,
    fileSize: decoded.buffer.length,
    contentSha256,
    uploadedAt,
    uploadedByName,
    uploadedByUsername,
    metadata
  }, null, 2), { flag: "wx" });
  send(res, 200, {
    ok: true,
    file: {
      versionId,
      fileName: originalFileName,
      fileType: contentType,
      fileSize: decoded.buffer.length,
      fileUrl,
      fileStorageKey: storageKey,
      storageKind: "ecs-file",
      contentSha256,
      uploadedAt,
      uploadedByName,
      uploadedByUsername
    }
  }, headers);
}

async function handleDownloadCurriculumFile(url, res, headers) {
  const prefix = "/curriculum-files/";
  const storageKey = decodeURIComponent(url.pathname.slice(prefix.length));
  const absolutePath = resolveUploadPath(storageKey);
  if (!absolutePath) {
    send(res, 400, { ok: false, error: "invalid_storage_key" }, headers);
    return;
  }

  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      send(res, 404, { ok: false, error: "not found" }, headers);
      return;
    }
    const requestedName = sanitizeOriginalFileName(url.searchParams.get("fileName") || path.basename(absolutePath));
    const extension = path.extname(absolutePath).toLowerCase();
    const contentType = contentTypeByExtension.get(extension) || "application/octet-stream";
    res.writeHead(200, {
      ...headers,
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`
    });
    createReadStream(absolutePath).pipe(res);
  } catch (error) {
    if (error?.code === "ENOENT") {
      send(res, 404, { ok: false, error: "not found" }, headers);
      return;
    }
    throw error;
  }
}

async function handleAuditLog(req, res, headers) {
  const body = await readJson(req);
  const result = await pool.query(`
    insert into audit_logs (
      module_key, action_key, target_type, target_id, summary,
      operator_name, operator_username, operator_role, user_agent, created_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10::timestamptz, now()))
    returning id
  `, [
    body.moduleKey || "unknown",
    body.actionKey || "unknown",
    body.targetType || null,
    body.targetId || null,
    body.summary || "-",
    body.operatorName || "-",
    body.operatorUsername || "-",
    body.operatorRole || "-",
    body.userAgent || req.headers["user-agent"] || "",
    body.clientCreatedAt || null
  ]);
  send(res, 200, { ok: true, id: result.rows[0].id }, headers);
}

async function handleBackupExport(req, res, headers) {
  const body = await readJson(req);
  const result = await pool.query(`
    insert into backup_exports (
      backup_version, source_url, entry_count, exported_by_name, exported_at, note
    )
    values ($1, $2, $3, $4, coalesce($5::timestamptz, now()), $6)
    returning id
  `, [
    body.backupVersion || "unknown",
    body.sourceUrl || "",
    Number(body.entryCount || 0),
    body.exportedByName || body.exportedByUsername || "-",
    body.exportedAt || null,
    Array.isArray(body.storeKeys) ? `stores: ${body.storeKeys.join(", ")}` : ""
  ]);
  send(res, 200, { ok: true, id: result.rows[0].id }, headers);
}

function aiModeLabel(mode) {
  return {
    feedback: "课后反馈",
    classFeedback: "课堂反馈",
    todo: "待办事项",
    suggestion: "员工建议",
    task: "任务说明",
    help: "工作台使用问答",
    health: "接口检测"
  }[mode] || "AI 整理";
}

function localAiDraft(body) {
  const text = String(body.text || "").trim();
  const mode = String(body.mode || "feedback");
  const label = aiModeLabel(mode);
  const parentMessage = mode === "classFeedback"
    ? `家长您好，今天课堂反馈如下：${text}\n\n老师建议课后根据本次课堂情况完成对应练习，后续我们也会继续关注孩子的掌握情况。`
    : mode === "feedback"
      ? "建议老师确认后再发送给家长。"
      : "";
  return {
    title: body.target ? `${body.target}｜${label}` : label,
    summary: text ? `已按${label}整理为草稿。` : "AI 接口可用性检测。",
    polishedText: text,
    todoItems: mode === "todo" ? text.split(/[；;。\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 8) : [],
    parentMessage,
    internalNote: "MiniMax Key 尚未配置或接口暂不可用，本结果为本地草稿整理。",
    suggestedAction: ["feedback", "classFeedback"].includes(mode) ? "老师确认后归档学生服务，并复制发给家长。" : "",
    riskLevel: "正常",
    className: "",
    courseName: ""
  };
}

function aiSystemPrompt() {
  return [
    "你是匠人程教育工作台的内部 AI 助手。",
    "你服务中小学数学/科学教培机构员工，主要帮助整理课后反馈、待办、建议、任务说明和工作台使用问题。",
    "所有输出必须谨慎，涉及学生、家长、财务、考核的信息只能作为草稿，提醒员工人工确认。",
    "课堂反馈要面向家长，语气温和、具体、有诊断感，避免夸大承诺、避免刺激性评价。",
    "返回严格 JSON，不要 Markdown，不要解释。",
    "JSON 字段：title, summary, polishedText, todoItems, parentMessage, internalNote, suggestedAction, riskLevel, className, courseName。",
    "todoItems 必须是字符串数组。没有内容时填空字符串或空数组。"
  ].join("\n");
}

function buildAiUserPrompt(body) {
  const mode = String(body.mode || "feedback");
  return [
    `整理类型：${aiModeLabel(mode)}`,
    `关联对象：${body.target || "未填写"}`,
    `提交人：${body.operatorName || "-"}｜${body.operatorRole || "-"}`,
    "原始内容：",
    String(body.text || "").trim(),
    "",
    "整理要求：",
    mode === "feedback" ? "整理成课堂表现、学习内容、作业情况、需要家长配合、内部跟进建议。家长沟通建议要温和、具体、不过度承诺。" : "",
    mode === "classFeedback" ? "整理成统一课堂反馈模板：1 本节学习内容；2 孩子课堂表现；3 掌握情况与薄弱点；4 作业/练习建议；5 需要家长配合。parentMessage 必须是可直接微信发给家长的一段完整文字；internalNote 写给学管，包含是否需要跟进、风险等级和下一步。" : "",
    mode === "todo" ? "拆成明确待办，尽量包含负责人、截止时间线索和下一步动作。" : "",
    mode === "suggestion" ? "整理成正式管理建议，包含现象、影响、建议方案和预期收益。" : "",
    mode === "task" ? "整理成任务说明，包含目标、完成标准、子任务和验收口径。" : "",
    mode === "help" ? "用工作台现有模块回答，必要时说明进入哪个系统处理。模块包括排课、学管知识库、建议任务、财务、招生、教学质量、学生服务、教研课程、人事培训、校区运营。" : ""
  ].filter(Boolean).join("\n");
}

function parseAiJson(text, fallback) {
  const raw = String(text || "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed, todoItems: Array.isArray(parsed.todoItems) ? parsed.todoItems : fallback.todoItems };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return { ...fallback, ...parsed, todoItems: Array.isArray(parsed.todoItems) ? parsed.todoItems : fallback.todoItems };
      } catch {
        // fall through to raw text.
      }
    }
    return { ...fallback, polishedText: raw, internalNote: fallback.internalNote || "模型返回非 JSON，已作为正文保留。" };
  }
}

async function callMinimaxChat(body) {
  const requestHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${minimaxApiKey}`
  };
  if (minimaxGroupId) requestHeaders["GroupId"] = minimaxGroupId;

  const response = await fetch(minimaxApiUrl, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({
      model: minimaxModel,
      messages: [
        { role: "system", content: aiSystemPrompt() },
        { role: "user", content: buildAiUserPrompt(body) }
      ],
      temperature: 0.25
    })
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(typeof data === "string" ? data : JSON.stringify(data || {}));
    error.statusCode = response.status;
    throw error;
  }
  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.delta?.content || data?.reply || "";
  return String(content || "");
}

async function handleAiAssistant(req, res, headers, authorization) {
  const body = await readJson(req, 2 * 1024 * 1024);
  const text = String(body.text || "").trim();
  const fallback = localAiDraft(body);
  if (body.mode === "health") {
    send(res, 200, {
      ok: true,
      provider: minimaxApiKey ? "minimax" : "local",
      configured: Boolean(minimaxApiKey),
      model: minimaxApiKey ? minimaxModel : "",
      result: fallback
    }, headers);
    return;
  }
  if (!text) {
    send(res, 400, { ok: false, error: "empty_input", message: "请先输入文字或语音转文字内容。" }, headers);
    return;
  }
  if (!minimaxApiKey) {
    send(res, 200, { ok: true, provider: "local", configured: false, result: fallback }, headers);
    return;
  }
  try {
    const content = await callMinimaxChat({
      ...body,
      operatorName: authorization?.payload?.name || body.operatorName || "-",
      operatorUsername: authorization?.payload?.sub || body.operatorUsername || "-"
    });
    const result = parseAiJson(content, fallback);
    send(res, 200, { ok: true, provider: "minimax", configured: true, model: minimaxModel, result }, headers);
  } catch (error) {
    console.error("MiniMax assistant failed", error);
    send(res, 200, {
      ok: true,
      provider: "local",
      configured: true,
      warning: "minimax_failed",
      message: "MiniMax 暂时调用失败，已返回本地草稿。",
      result: fallback
    }, headers);
  }
}

async function route(req, res) {
  const headers = corsHeaders(req);
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (req.method === "POST" && (url.pathname === "/login" || url.pathname === "/api/login")) {
    try {
      return await handleLogin(req, res, headers);
    } catch (error) {
      console.error(error);
      send(res, 500, { ok: false, error: String(error?.message || error) }, headers);
      return;
    }
  }

  const authorization = getAuthorization(req);
  if (!authorization) {
    send(res, 401, { ok: false, error: "unauthorized" }, headers);
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") return await handleHealth(res, headers);
    if (req.method === "GET" && url.pathname === "/employees") return await handleEmployees(res, headers);
    if (req.method === "GET" && url.pathname === "/permissions") return await handlePermissions(res, headers);
    if (req.method === "POST" && url.pathname === "/ai-assistant") return await handleAiAssistant(req, res, headers, authorization);
    if (req.method === "GET" && url.pathname === "/module-data") return await handleGetModuleData(url, res, headers);
    if (req.method === "PUT" && url.pathname === "/module-data") return await handlePutModuleData(req, res, headers);
    if (req.method === "POST" && url.pathname === "/import/june-regular-csv") {
      return await handleImportJuneRegularCsv(req, res, headers, authorization);
    }
    if (req.method === "POST" && url.pathname === "/import/june-regular-xlsx") {
      return await handleImportJuneRegularXlsx(res, headers);
    }
    if (req.method === "POST" && url.pathname === "/curriculum-files") {
      return await handleUploadCurriculumFile(req, res, headers, authorization);
    }
    if (req.method === "GET" && url.pathname.startsWith("/curriculum-files/")) {
      return await handleDownloadCurriculumFile(url, res, headers);
    }
    if (req.method === "POST" && url.pathname === "/audit-logs") return await handleAuditLog(req, res, headers);
    if (req.method === "POST" && url.pathname === "/backup-exports") return await handleBackupExport(req, res, headers);
    send(res, 404, { ok: false, error: "not found" }, headers);
  } catch (error) {
    console.error(error);
    send(res, error?.statusCode || 500, { ok: false, error: String(error?.message || error) }, headers);
  }
}

http.createServer(route).listen(port, () => {
  console.log(`JRC cloud API listening on ${port}`);
});
