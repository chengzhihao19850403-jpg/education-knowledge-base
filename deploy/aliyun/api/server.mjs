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
const minimaxApiUrl = process.env.JRC_MINIMAX_API_URL || "https://api.minimaxi.com/v1/chat/completions";
const minimaxModel = process.env.JRC_MINIMAX_MODEL || "MiniMax-M3";
const minimaxGroupId = process.env.JRC_MINIMAX_GROUP_ID || "";
const minimaxTimeoutMs = Number(process.env.JRC_MINIMAX_TIMEOUT_MS || 45000);
const minimaxMaxAttempts = Math.max(1, Number(process.env.JRC_MINIMAX_MAX_ATTEMPTS || 3));
const departedEmployeeUsernames = ["zhangyan", "hejianjun"];
const moduleOwnerPermissionRules = {
  yanyuhan: ["admissions.access", "admissions.edit", "admissions.import", "admissions.export", "admissions.finance", "studentService.access", "studentService.edit"],
  liudajun: ["finance.access", "finance.edit"],
  zhaoxuan: [
    "curriculum.access",
    "curriculum.edit",
    "curriculum.create",
    "curriculum.update",
    "curriculum.delete",
    "curriculum.import",
    "curriculum.export",
    "curriculum.reset"
  ],
  zhoushan: ["paike.access", "paike.edit", "studentService.access", "studentService.edit"],
  gaofangyan: ["studentService.access", "studentService.edit"],
  yeyuanze: ["suggestions.access", "suggestions.edit"],
  chengzhihao: ["knowledge.access", "knowledge.edit", "admin.access"],
  chenyuqing: ["hr.access", "hr.edit", "admin.access"],
  lishu: ["ai.access"],
  zhengjiayi: ["teachingQuality.access", "teachingQuality.edit"]
};
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

function ownerScopedPermissions(username, permissions = []) {
  const nextPermissions = new Set(permissions);
  (moduleOwnerPermissionRules[String(username || "").trim().toLowerCase()] || []).forEach((permission) => {
    nextPermissions.add(permission);
  });
  return Array.from(nextPermissions).sort();
}

function toEmployee(row, permissions = []) {
  const resolvedPermissions = ownerScopedPermissions(row.username, permissions);
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
    permissions: resolvedPermissions
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

async function applyDepartedEmployeeLocks() {
  if (!departedEmployeeUsernames.length) return;
  let client = null;
  try {
    client = await pool.connect();
    await client.query("begin");
    const result = await client.query(`
      update employees
      set
        status = 'departed',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'departedAt', coalesce(metadata->>'departedAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')),
          'departedReason', '账号离职停用；历史排课、上课、结算记录保留'
        ),
        updated_at = now()
      where username = any($1::text[])
        and status <> 'departed'
      returning id, username
    `, [departedEmployeeUsernames]);
    await client.query(`
      delete from employee_permissions
      where employee_id in (
        select id from employees where username = any($1::text[])
      )
    `, [departedEmployeeUsernames]);
    await client.query("commit");
    if (result.rowCount > 0) {
      console.log(`Locked departed employee accounts: ${result.rows.map((row) => row.username).join(", ")}`);
    }
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    console.error("Failed to lock departed employee accounts", error);
  } finally {
    if (client) client.release();
  }
}

async function applyModuleOwnerPermissionRules() {
  const rows = Object.entries(moduleOwnerPermissionRules).flatMap(([username, permissions]) => {
    return permissions.map((permissionKey) => [username, permissionKey]);
  });
  if (!rows.length) return;
  let client = null;
  try {
    client = await pool.connect();
    await client.query("begin");
    for (const [username, permissionKey] of rows) {
      await client.query(`
        insert into employee_permissions (employee_id, permission_key, note)
        select employees.id, $2, 'module owner permission'
        from employees
        join permission_catalog on permission_catalog.permission_key = $2
        where employees.username = $1
          and employees.status = 'active'
        on conflict (employee_id, permission_key) do nothing
      `, [username, permissionKey]);
    }
    await client.query("commit");
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    console.error("Failed to apply module owner permission rules", error);
  } finally {
    if (client) client.release();
  }
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
  send(res, 200, { ok: true, siteId, employee, token, expiresAt, mustChangePassword: password === "10281028" }, headers);
}

async function handleChangePassword(req, res, headers, authorization) {
  const username = String(authorization?.payload?.sub || "").trim().toLowerCase();
  if (!username) {
    send(res, 403, { ok: false, error: "session_required", message: "请先用员工账号登录后再修改密码。" }, headers);
    return;
  }

  const body = await readJson(req);
  const currentPassword = String(body.currentPassword || body.oldPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!currentPassword || !newPassword) {
    send(res, 400, { ok: false, error: "missing_password", message: "请填写旧密码和新密码。" }, headers);
    return;
  }
  if (newPassword.length < 8) {
    send(res, 400, { ok: false, error: "weak_password", message: "新密码至少 8 位。" }, headers);
    return;
  }
  if (newPassword === currentPassword) {
    send(res, 400, { ok: false, error: "same_password", message: "新密码不能和旧密码一样。" }, headers);
    return;
  }

  const employee = await pool.query(`
    select id, name, username, role, password_hash
    from employees
    where username = $1
      and status = 'active'
      and password_hash is not null
      and password_hash = crypt($2, password_hash)
    limit 1
  `, [username, currentPassword]);
  const row = employee.rows[0];
  if (!row) {
    send(res, 401, { ok: false, error: "invalid_current_password", message: "旧密码不正确，不能修改。" }, headers);
    return;
  }

  await pool.query(`
    update employees
    set
      password_hash = crypt($2, gen_salt('bf')),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('passwordChangedAt', now()),
      updated_at = now()
    where id = $1
  `, [row.id, newPassword]);

  await pool.query(`
    insert into audit_logs (
      module_key, action_key, target_type, target_id, summary,
      operator_id, operator_name, operator_username, operator_role, created_at
    )
    values ('portal', 'password.change', 'employee', $1, '员工修改登录密码', $2, $3, $4, $5, now())
  `, [row.username, row.id, row.name, row.username, row.role]);

  const refreshedEmployee = await employeeWithPermissions(username);
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = signToken({
    sub: refreshedEmployee.username,
    name: refreshedEmployee.name,
    role: refreshedEmployee.role,
    exp: expiresAt
  });
  send(res, 200, { ok: true, siteId, employee: refreshedEmployee, token, expiresAt }, headers);
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
    admissionsFollowup: "招生跟进",
    parentCommunication: "学管沟通",
    attendanceFollowup: "点名缺勤跟进",
    curriculumArchive: "课件资料归档",
    financeCheck: "财务核对",
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
    ? buildClassFeedbackTemplate(body.target || "家长", text, body)
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

function normalizeFeedbackRecipient(target) {
  const raw = String(target || "").trim();
  if (!raw) return "家长您好";
  const first = raw.split(/[，,、\s/｜|]+/).filter(Boolean)[0] || raw;
  if (first === "家长") return "家长您好";
  if (/家长$/.test(first)) return `${first}您好`;
  if (/(爸爸|妈妈|父亲|母亲|父母)$/.test(first)) return `${first.replace(/^(.*?)(爸爸|妈妈|父亲|母亲|父母)$/, "$1的家长")}您好`;
  return `${first}的家长您好`;
}

function cleanExtractedText(value) {
  return String(value || "")
    .replace(/^[是为：:\s]+/, "")
    .replace(/[。；;，,\s]+$/, "")
    .replace(/^把/, "")
    .replace(/^(《|「|“|")/, "")
    .replace(/(》|」|”|")$/, "")
    .trim();
}

function looksLikeJsonText(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^\{[\s\S]*\}$/.test(raw)) return true;
  return /\{[\s\S]*"(?:title|summary|polishedText|parentMessage|todoItems|structuredData)"\s*:/.test(raw)
    || /"(?:title|summary|polishedText|parentMessage|todoItems)"\s*:[\s\S]*\}/.test(raw);
}

function splitFeedbackClauses(rawText) {
  return String(rawText || "")
    .replace(/[：:]/g, "：")
    .split(/[。；;\n，,]/)
    .map((item) => cleanExtractedText(item))
    .filter((item) => item && item.length > 1);
}

function hasStateSignal(text) {
  return /(状态|表现|注意力|专注|认真|积极|互动|回答|思考|配合|纪律|讲话|说话|插话|走神|开小差|提醒|制止|坐姿|精神|态度|反应|主动|听讲|听课|小动作|情绪|自信|拖拉|粗心)/.test(String(text || ""));
}

function hasCourseTopic(text) {
  return /(有理数|正数|负数|整数|分数|小数|数轴|绝对值|相反数|平行四边形|矩形|菱形|正方形|梯形|三角形|全等|相似|勾股|圆|几何|面积|周长|体积|函数|方程|百分数|比例|应用题|行程|工程|浓度|利润|奥数|计算|科学|物理|化学|实验|力|电|光|密度|知识点|性质|判定|定义|定理|公式|题型|模型|方法|解法|解题|学了|讲了|上了|内容)/.test(String(text || ""));
}

function isHomeworkClause(text) {
  return /(作业|课后作业|家庭作业|回家作业|回去|订正|改错|做完|完成.{0,12}(题|页|讲义|练习|试卷|作业)|做.{0,12}(题|页|讲义|练习|试卷))/.test(String(text || ""));
}

function isPlanClause(text) {
  return /(下节课|下次课|后续|接下来|下一步|以后|继续|安排|计划|预习|巩固|复习|多练|练习)/.test(String(text || ""));
}

function isReviewOnlyClause(text) {
  const value = String(text || "").replace(/\s+/g, "");
  return /^(要|需要|还要|注意|记得|课后)?(复习|巩固|多练|练习|回顾)(一下|下|哦|哈|呀)?$/.test(value);
}

function polishStateText(parts) {
  if (!parts.length) return "今天孩子上课整体状态较好，能够跟随老师节奏完成课堂学习。具体课堂表现请老师根据本节实际情况再确认补充。";
  const text = parts.join("；")
    .replace(/已经被我制止/g, "老师已及时提醒并制止")
    .replace(/已经我制止/g, "老师已及时提醒并制止")
    .replace(/已经被我提醒/g, "老师已及时提醒")
    .replace(/已经我提醒/g, "老师已及时提醒")
    .replace(/被我制止/g, "老师已及时提醒并制止")
    .replace(/我制止/g, "老师已及时提醒并制止")
    .replace(/被我提醒/g, "老师已及时提醒")
    .replace(/我提醒/g, "老师已及时提醒");
  return `${text}。整体来看，孩子能够跟随课堂节奏完成学习，后续老师会继续关注课堂专注度。`;
}

function parseClassFeedbackInput(rawText) {
  const clauses = splitFeedbackClauses(rawText);
  const stateParts = [];
  const homeworkParts = [];
  const contentParts = [];
  const planParts = [];
  clauses.forEach((clause) => {
    if (isHomeworkClause(clause)) homeworkParts.push(clause);
    else if (isReviewOnlyClause(clause)) planParts.push(clause);
    else if (isPlanClause(clause) && !hasCourseTopic(clause)) planParts.push(clause);
    else if (hasStateSignal(clause) && !/(知识点|性质|判定|定义|定理|公式)/.test(clause)) stateParts.push(clause);
    else if (hasCourseTopic(clause)) contentParts.push(clause);
    else if (isPlanClause(clause)) planParts.push(clause);
  });
  const homework = extractHomeworkFromText(homeworkParts.join("；") || rawText);
  const courseContent = contentParts.length ? contentParts.join("；") : "本节课上课内容待老师补充";
  const planText = planParts.length ? planParts.join("；") : "下节课我们会继续进行相关知识点巩固，同时穿插重点内容预习和思维训练，帮助孩子把基础掌握得更扎实，学习效果更上一层楼✨";
  return {
    stateText: polishStateText(stateParts),
    homework,
    courseContent,
    planText
  };
}

function extractTemplateSection(text, label, nextLabels = []) {
  const source = String(text || "");
  const start = source.indexOf(label);
  if (start < 0) return "";
  const rest = source.slice(start + label.length);
  const nextIndexes = nextLabels
    .map((nextLabel) => rest.indexOf(nextLabel))
    .filter((index) => index >= 0);
  const end = nextIndexes.length ? Math.min(...nextIndexes) : rest.length;
  return rest.slice(0, end).trim();
}

function classFeedbackNeedsRebuild(parentMessage) {
  const text = String(parentMessage || "");
  if (looksLikeJsonText(text)) return true;
  return !text.includes("一、上课状态")
    || !text.includes("本次课上课内容")
    || !text.includes("知识点要点")
    || !text.includes("学习掌握情况")
    || !text.includes("课后作业");
}

function formatClassFeedbackText(value, target = "") {
  const greeting = normalizeFeedbackRecipient(target);
  let text = String(value || "")
    .replace(/^.{0,16}(妈妈|爸爸|父母|家长)[，,：:\s]*您好?[，,：:\s]*/, `${greeting}，`)
    .replace(/(?:^|\n)\s*(?:一、)?上课状态：/g, "\n\n一、上课状态：\n")
    .replace(/(?:^|\n)\s*(?:二、)?本次课上课内容：/g, "\n\n二、本次课上课内容：\n")
    .replace(/(?:^|\n)\s*(?:(?:二|三)、)?知识点要点：/g, "\n\n三、知识点要点：\n")
    .replace(/(?:^|\n)\s*(?:(?:三|四)、)?(?:学习掌握情况|学习情况反馈)：/g, "\n\n四、学习掌握情况：\n")
    .replace(/(?:^|\n)\s*(?:(?:四|五)、)?课后作业：/g, "\n\n五、课后作业：\n")
    .replace(/(一、上课状态：|二、本次课上课内容：|三、知识点要点：|四、学习掌握情况：|五、课后作业：)\n{2,}/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text && !text.startsWith(greeting)) text = `${greeting}，\n\n${text}`;
  return text;
}

function chineseNumberToInt(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (raw === "十") return 10;
  const tenIndex = raw.indexOf("十");
  if (tenIndex >= 0) {
    const left = raw.slice(0, tenIndex);
    const right = raw.slice(tenIndex + 1);
    return (left ? map[left] || 0 : 1) * 10 + (right ? map[right] || 0 : 0);
  }
  return map[raw] || 0;
}

function extractLessonNumberFromText(rawText) {
  const text = String(rawText || "");
  const match = text.match(/第\s*([0-9一二两三四五六七八九十]{1,4})\s*(?:次|节|讲|课)/);
  const value = chineseNumberToInt(match?.[1] || "");
  return value > 0 ? value : "";
}

function extractFeedbackSeason(rawText) {
  const text = String(rawText || "");
  if (/(暑假|暑期|夏季)/.test(text)) return "暑假";
  if (/(寒假|寒期|冬季)/.test(text)) return "寒假";
  if (/(秋季|秋期)/.test(text)) return "秋季";
  if (/(春季|春期)/.test(text)) return "春季";
  const month = new Date().getMonth() + 1;
  if (month >= 7 && month <= 8) return "暑假";
  if (month <= 2) return "寒假";
  if (month >= 9) return "秋季";
  return "春季";
}

function resolveFeedbackLessonNumber(target, rawText, meta = {}) {
  const manual = String(meta.lessonNumber || "").trim();
  const manualNumber = chineseNumberToInt(manual);
  if (manualNumber > 0) return manualNumber;
  const oralNumber = extractLessonNumberFromText(rawText);
  if (oralNumber) return oralNumber;
  const name = String(target || "").split(/[，,、\s/｜|]+/).filter(Boolean)[0] || "";
  return name ? "__" : "__";
}

function feedbackMeta(target, rawText, meta = {}) {
  return {
    lessonSeason: meta.lessonSeason || extractFeedbackSeason(rawText),
    lessonNumber: meta.lessonNumber || resolveFeedbackLessonNumber(target, rawText, meta)
  };
}

function courseContentItems(rawText) {
  const content = extractCourseContent(rawText);
  if (!content || content === "本节课上课内容待老师补充") return ["本节课上课内容待老师补充"];
  const items = content
    .split(/[；;\n]/)
    .map((item) => cleanExtractedText(item.replace(/^(今天|本节课|这节课|学习了|学了|讲了|复习了|主要讲了)/, "")))
    .filter((item) => !isReviewOnlyClause(item))
    .filter(Boolean);
  return [...new Set(items)].slice(0, 4);
}

function numberedLines(items) {
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .slice(0, 4)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

function buildKnowledgePointItems(rawText) {
  const content = extractCourseContent(rawText);
  const compact = content.replace(/\s+/g, "");
  const points = [];
  if (/有理数/.test(compact)) {
    points.push("有理数概念：整数和分数统称为有理数，正数、负数和 0 都可以放在数轴上表示。");
    points.push("有理数分类：可按正有理数、0、负有理数分类，也可按整数和分数分类；分类时要注意标准统一。");
  }
  if (/数轴/.test(compact)) points.push("数轴三要素：原点、正方向、单位长度；数轴上的点与数可以建立对应关系。");
  if (/绝对值/.test(compact)) points.push("绝对值要点：一个数的绝对值表示它到 0 的距离，所以绝对值一定大于等于 0；在数轴上体现为到原点的距离。");
  if (/相反数/.test(compact)) points.push("相反数要点：只有符号不同的两个数互为相反数，它们在数轴上位于原点两侧且到原点距离相等，和为 0。");
  if (/平行四边形/.test(compact)) {
    points.push("平行四边形定义：两组对边分别平行的四边形叫平行四边形。");
    points.push("平行四边形性质：对边平行且相等，对角相等，邻角互补，对角线互相平分。");
    points.push("平行四边形判定：两组对边分别平行、两组对边分别相等、一组对边平行且相等、两组对角分别相等、对角线互相平分，都可判定为平行四边形。");
    if (/面积|底|高/.test(compact)) points.push("平行四边形面积：S = 底 × 高，底和高必须对应。");
  }
  if (/矩形/.test(compact)) points.push("矩形要点：矩形是有一个角为直角的平行四边形，四个角都是直角，对角线相等且互相平分。");
  if (/菱形/.test(compact)) points.push("菱形要点：菱形是四条边都相等的平行四边形，对角线互相垂直平分，并分别平分一组对角。");
  if (/分数|应用题/.test(compact)) points.push("分数应用题：先找准单位“1”和对应分率，常用关系是单位量 × 对应分率 = 对应量。");
  if (/百分数|利润|折扣|浓度/.test(compact)) points.push("百分数问题：百分率 = 比较量 ÷ 标准量 × 100%，增长率、折扣、利润率都要先确定比较基准。");
  if (/比例|正比例|反比例/.test(compact)) points.push("比例关系：比例式 a:b = c:d 中内项积等于外项积；正比例关注 y/x 为定值，反比例关注 xy 为定值。");
  if (/方程|等式/.test(compact)) points.push("方程思想：用未知数表示关键信息，根据等量关系建立方程，再检验结果是否符合题意。");
  if (/圆/.test(compact)) points.push("圆的公式：周长 C = 2πr = πd，面积 S = πr²，题目中要区分半径和直径。");
  if (/三角形/.test(compact)) points.push("三角形面积：S = 底 × 高 ÷ 2，解题时重点找到对应的底和高。");
  if (/长方形|正方形|几何图形|平面几何|立体几何|面积|周长|体积/.test(compact) && !/绝对值.*几何意义|几何意义.*绝对值/.test(compact)) points.push("几何问题：先明确周长、面积或体积公式，再结合分割、补全、转化等方法解决。");
  if (/函数|一次函数|二次函数|图像/.test(compact)) points.push("函数知识：关注解析式、图像变化、交点和实际意义之间的对应关系。");
  if (/科学|物理|化学|实验|力|电|光|密度/.test(compact)) points.push("科学知识：重点理解概念定义、实验现象和结论之间的因果关系。");
  if (!points.length) points.push(content === "本节课上课内容待老师补充" ? "知识点待老师补充：请老师补充本节具体学习内容后，系统会更准确整理核心定义、公式和易错点。" : `本节核心内容：请家长让孩子复述“${content}”的核心概念、典型题型和易错点，检查是否真正理解。`);
  return points.slice(0, 4);
}

function buildKnowledgePoints(rawText) {
  return numberedLines(buildKnowledgePointItems(rawText));
}

function buildMasteryItems(rawText) {
  const courseItems = courseContentItems(rawText);
  if (courseItems[0] === "本节课上课内容待老师补充") {
    return ["本节课具体学习内容待老师补充；请老师确认后，再补充孩子对应知识点的掌握情况。"];
  }
  const state = parseClassFeedbackInput(rawText).stateText;
  return courseItems.map((item, index) => {
    const suffix = hasStateSignal(state) ? "课堂状态整体能跟上，后续继续通过课后练习巩固细节。" : "后续建议通过同类题训练巩固易错点。";
    if (/有理数/.test(item)) return `有理数部分：孩子已开始建立正数、负数、0 以及有理数分类的基本认识，后续要继续强化分类标准和符号意识。${suffix}`;
    if (/绝对值/.test(item)) return `绝对值部分：孩子对“距离”这一核心含义正在建立，需要继续结合数轴理解绝对值的几何意义，并通过题目熟悉化简和判断。${suffix}`;
    if (/相反数/.test(item)) return `相反数部分：孩子对概念有接触，但性质运用还不够熟练，建议重点练习符号变化、数轴位置和“和为 0”的判断。${suffix}`;
    const lead = ["第一项内容", "第二项内容", "第三项内容", "第四项内容"][index] || "本项内容";
    return `${lead}“${item}”：孩子能够跟随老师完成课堂梳理和练习，基础理解整体在推进中。${suffix}`;
  });
}

function buildClassFeedbackTemplate(target, rawText, meta = {}) {
  const greeting = normalizeFeedbackRecipient(target);
  const raw = String(rawText || "").trim() || "本节课课堂情况待老师补充";
  const parsed = parseClassFeedbackInput(raw);
  const homework = parsed.homework;
  const courseItems = courseContentItems(raw);
  const knowledgeItems = buildKnowledgePointItems(raw);
  const masteryItems = buildMasteryItems(raw);
  const resolvedMeta = feedbackMeta(target, raw, meta);
  return [
    `${greeting}，这是${resolvedMeta.lessonSeason || "春季"}小课第${resolvedMeta.lessonNumber || "__"}次课程反馈：`,
    "",
    "一、上课状态：",
    parsed.stateText,
    "",
    "二、本次课上课内容：",
    numberedLines(courseItems),
    "",
    "三、知识点要点：",
    numberedLines(knowledgeItems),
    "",
    "四、学习掌握情况：",
    numberedLines(masteryItems),
    "",
    "五、课后作业：",
    `《${homework}》做完`
  ].join("\n");
}

function extractHomeworkFromText(rawText) {
  const text = String(rawText || "");
  const match = text.match(/(?:作业|课后作业|回家作业|家庭作业|回去|课后)[是为：: ]*(?:完成|做完|做|写)?([^。；;\n]+)/);
  const homework = cleanExtractedText(match?.[1] || "");
  return homework.replace(/^(完成|做完|做|写)/, "").trim() || "__";
}

function extractHomework(rawText) {
  return parseClassFeedbackInput(rawText).homework;
}

function extractCourseContent(rawText) {
  return parseClassFeedbackInput(rawText).courseContent;
}

function aiSystemPrompt() {
  return [
    "你是匠人程教育工作台的内部 AI 助手。",
    "你服务中小学数学/科学教培机构员工，主要帮助整理课后反馈、招生跟进、学管沟通、点名缺勤跟进、课件资料归档、财务核对、待办、建议、任务说明和工作台使用问题。",
    "所有输出必须谨慎，涉及学生、家长、财务、考核的信息只能作为草稿，提醒员工人工确认。",
    "涉及财务、工资、课时费、分红、课销、退费、考核评级时，只能做核对清单、异常提示和下一步建议，不得替代最终结算或直接下结论。",
    "涉及招生转化时，输出要包含客户当前阶段、家长关注点、下一次跟进动作、可复制沟通话术和风险提醒，不要承诺提分结果。",
    "涉及学管沟通时，要区分“发家长的话”和“内部跟进动作”，语气要温和、具体、可执行。",
    "涉及点名缺勤时，要明确是否需要确认不销课、补课、视频课、迟到修正、出门测成绩佐证，并生成跟进待办。",
    "涉及课件资料归档时，要整理年级、体系、主题、资料类型、标签、适用场景、打印/使用建议和标准文件命名建议。",
    "课堂反馈要面向家长，语气温和、具体、有诊断感，避免夸大承诺、避免刺激性评价。",
    "课堂反馈必须优先套用校区统一模板，结合老师原始描述匹配模块填写，不能把模板字段漏掉；每个栏目之间必须空一行，方便老师复制到微信。",
    "课堂反馈的正文由你主写，系统只做格式校验；请用自然、具体、有老师口吻的表达，不要机械套句，不要每条都用同一个开头。",
    "课堂反馈每个栏目标题后面必须直接换行写正文，不要在栏目标题和正文之间再空一行。",
    "课堂反馈称呼统一用“某某的家长您好”，不要默认写妈妈或爸爸；原始描述里的作业要提取到课后作业；原始描述里的上课主要内容要提取到本次课上课内容。",
    "课堂反馈模板必须使用这套结构：标题行 + 一、上课状态 + 二、本次课上课内容 + 三、知识点要点 + 四、学习掌握情况 + 五、课后作业。",
    "标题里的季节优先使用传入的 lessonSeason，没有则从原文识别春季/秋季/暑假/寒假；标题里的第几次优先使用传入的 lessonNumber，没有则识别原文，否则保留 __。",
    "本次课上课内容必须用 1-4 条编号列出知识主题；知识点要点必须用 1-4 条编号列出核心定义、公式、定理或方法；学习掌握情况必须与前面的编号主题对应。",
    "知识点要点必须由你根据真实上课主题智能生成，不要依赖固定示例或泛化知识库；遇到任何数学/科学主题，都要写该主题对应的定义、性质、判定、公式、方法或易错点。",
    "如果无法从原始描述判断某个知识主题的核心要点，就写“__待老师补充__”，严禁随便补一个无关知识点凑数。",
    "生成课堂反馈前必须先做语义分类：孩子表现、注意力、讲话、提醒、制止、互动、状态、纪律等只属于“上课状态”；作业只属于“课后作业”；具体学习主题、章节、题型、知识点才属于“本次课上课内容”。",
    "严禁把“表现不错、偶尔讲话、已提醒/已制止、注意力、专注度”等课堂状态内容写进“本次课上课内容”或“知识点要点”。",
    "严禁把“要复习、要巩固、多练习、回去复习”等后续要求写成“本次课上课内容”；这些只能作为学习建议或老师确认项。",
    "课堂反馈必须补充“知识点要点”，把上课主要内容整理成家长可查询、可询问孩子的核心定义、公式、定理、方法或易错点；数学尽量写公式，科学尽量写概念/现象/结论。",
    "知识点要点只能依据真实上课主题生成，不能凭空补充无关主题；例如“绝对值的几何意义”属于绝对值/数轴知识，不是周长面积体积类几何公式。",
    "学习掌握情况要对应前面的知识主题写孩子掌握、薄弱点和建议，避免连续使用“围绕……”等重复句式。",
    "不确定的次数、作业名称、具体知识点可保留 __ 等待老师确认。",
    "返回严格 JSON，不要 Markdown，不要解释，不要输出 <think>、分析过程、英文 reasoning、代码块或模板外文字。",
    "JSON 字段：title, summary, polishedText, todoItems, parentMessage, internalNote, suggestedAction, riskLevel, className, courseName, quickTags, structuredData。",
    "todoItems 必须是字符串数组。没有内容时填空字符串或空数组。"
  ].join("\n");
}

function buildAiUserPrompt(body) {
  const mode = String(body.mode || "feedback");
  const batchStudents = Array.isArray(body.batchStudents)
    ? body.batchStudents.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  return [
    `整理类型：${aiModeLabel(mode)}`,
    `关联对象：${body.target || "未填写"}`,
    batchStudents.length > 1 ? `同课学生名单：${batchStudents.join("、")}` : "",
    `课程阶段：${body.lessonSeason || "未填写"}`,
    `课次：${body.lessonNumber || "未填写"}`,
    `提交人：${body.operatorName || "-"}｜${body.operatorRole || "-"}`,
    "原始内容：",
    String(body.text || "").trim(),
    "",
    "整理要求：",
    mode === "feedback" ? "整理成课堂表现、学习内容、作业情况、需要家长配合、内部跟进建议。家长沟通建议要温和、具体、不过度承诺。" : "",
    mode === "classFeedback" ? [
      "根据老师原始描述，匹配并填写以下统一课堂反馈模板；根据实际情况适当改写，不要生硬套话；parentMessage 必须是一段可直接微信发给家长的完整文字；每个栏目之间必须保留空行：",
      "格式要求：栏目标题下一行直接写正文，标题和正文之间不要空行；相邻两个大栏目之间保留一个空行。",
      "标题行中的季节优先使用课程阶段字段；第几次优先使用课次字段；如果字段为空，再从原始内容中识别，否则保留 __。",
      "填写前先把原始内容分类：",
      "A. 上课状态：孩子表现、注意力、讲话、纪律、互动、提醒、制止、状态、态度。",
      "B. 课后作业：老师提到的作业、练习、讲义、订正、完成内容。",
      "C. 本次课上课内容：真实学习主题、章节、题型、知识点，例如平行四边形、函数、方程等。",
      "D. 知识点要点：只能根据 C 生成定义、公式、性质、判定、定理、方法，不能写孩子状态。",
      "E. 复习/巩固要求：例如“要复习哦、回去多练、下次继续巩固”，不能放进本次课上课内容，只能放在掌握情况建议或待确认项。",
      "知识点要点必须由你根据 C 中真实主题自行分析生成，不要靠固定示例补内容；C 写什么主题，D 就写什么主题的核心定义、性质、判定、公式、方法或易错点。",
      "如果 C 的某一条只是语气词、复习提醒或不完整短句，不要把它当上课内容；请移到学习建议，或标为 __待老师补充__。",
      "如果作业只识别到“呢、啊、哦、要复习、巩固复习”等无效词，不要写成《呢》做完或《要巩固复习》做完；请写《__待老师补充__》做完。",
      "如果老师只说了孩子状态，没有说具体学习内容，本次课上课内容写“本节课上课内容待老师补充”，知识点要点写“知识点待老师补充”。",
      "如果 C 包含任何明确数学/科学主题，D 必须覆盖这些主题本身；不要把泛化的几何、计算、复习要求当作具体知识点。",
      "学习掌握情况要逐条对应 C，但句式要自然变化，不能每条都以同一个固定短语开头。",
      batchStudents.length > 1 ? [
        "当前是“一课多生”模式：这些学生上同一节课，必须先提取整节课公共信息，再分别整理每个学生的个人表现。",
        "公共信息必须一致：本次课上课内容、知识点要点、课后作业。",
        "个人信息必须分别写：上课状态、纪律提醒、互动表现、掌握情况、薄弱点和建议。",
        "structuredData 必须包含 sharedLesson 和 students：",
        "sharedLesson.courseContentItems 为公共上课内容数组；sharedLesson.knowledgePointItems 为公共知识点要点数组；sharedLesson.homework 为公共作业。",
        "students 为数组，每个元素包含 name, stateText, masteryItems；students 的 name 必须来自同课学生名单。",
        "sharedLesson.courseContentItems、sharedLesson.knowledgePointItems、students[].masteryItems 都必须是字符串数组，不要返回对象数组，避免页面显示 [object Object]。",
        "不要在某个学生的 stateText 或 masteryItems 里写其他学生姓名；如果原文没有某个学生的个人表现，就写该学生本节课个人表现待老师补充。"
      ].join("\n") : "",
      "某某的家长您好，这是春季小课第__次课程反馈：",
      "一、上课状态：",
      "根据老师原始描述如实整理课堂表现、专注度、互动、纪律、提醒情况。",
      "二、本次课上课内容：",
      "1. 从老师原始描述中提取主要上课内容",
      "2. 最多 4 条",
      "三、知识点要点：",
      "请根据老师提到的上课主要内容，补充家长可查询、可询问孩子的核心定义、公式、定理、解题思路或知识要点；数学要尽量写清公式/方法，科学要尽量写清概念/现象/结论。",
      "四、学习掌握情况：",
      "1. 对应上课内容第 1 条写孩子掌握情况",
      "2. 对应上课内容第 2 条写孩子掌握情况",
      "五、课后作业：",
      "《从老师原始描述中提取作业；没有则填 __》做完",
      "如果原始描述中孩子状态一般或偏弱，要温和改写对应模块，不要强行写“非常棒”；如果信息缺失，用 __ 保留待老师确认。",
      "internalNote 写给学管，包含：本次反馈依据、需要老师确认的空缺字段、是否需要后续跟进、风险等级和下一步。"
    ].join("\n") : "",
    mode === "admissionsFollowup" ? [
      "把原始招生/试听沟通记录整理成可执行跟进方案。",
      "summary 写当前线索阶段、家长主要关注点和成交风险。",
      "parentMessage 写一段可直接复制给家长的微信跟进话术，语气真诚克制，不要硬销售。",
      "todoItems 列出 3-6 个下一步动作，例如预约试听、补发资料、确认时间、二次追踪、顾问回访。",
      "internalNote 写给招生顾问，说明线索温度、异议点、建议跟进节奏。",
      "structuredData 建议包含 leadStage, parentConcerns, nextContactTime, conversionRisk, ownerAction。"
    ].join("\n") : "",
    mode === "parentCommunication" ? [
      "把学管老师或任课老师的原始描述整理成家长沟通内容。",
      "parentMessage 写可直接发给家长的微信文字；要具体到课堂表现、学习问题、建议配合，不要刺激家长。",
      "polishedText 写内部记录版，便于归档到学生服务系统。",
      "todoItems 列出学管后续跟进动作，例如提醒作业、确认补课、关注成绩变化、下次课复盘。",
      "structuredData 建议包含 studentStatus, parentConcern, serviceRisk, followupOwner, followupDate。"
    ].join("\n") : "",
    mode === "attendanceFollowup" ? [
      "把点名、迟到、缺勤、出门测成绩、补课或视频课说明整理成跟进记录。",
      "summary 写清本节课考勤状态和是否需要二次确认。",
      "polishedText 写内部考勤记录版。",
      "parentMessage 写可发给家长确认的沟通话术。",
      "todoItems 必须列出：是否销课/不销课待确认、是否安排补课或视频课、是否用出门测成绩修正到课、谁负责跟进。",
      "structuredData 建议包含 attendanceStatus, makeUpNeeded, videoLessonNeeded, scoreEvidence, billingAttention。"
    ].join("\n") : "",
    mode === "curriculumArchive" ? [
      "把老师上传或描述的课件、讲义、题库、答案、板书照片整理成标准化资料归档信息。",
      "summary 写资料适用年级、体系和主题。",
      "polishedText 写资料简介和使用建议，便于教研课程系统展示。",
      "todoItems 列出归档动作，例如确认年级、确认体系、补充答案、统一命名、上传到对应文件夹。",
      "internalNote 写教研负责人需要审核的点。",
      "structuredData 建议包含 grade, system, subject, topic, materialType, tags, fileNameSuggestion, printAdvice。"
    ].join("\n") : "",
    mode === "financeCheck" ? [
      "把课时费、课销、补课提成、工资、分红或费用说明整理成财务核对清单。",
      "必须强调这是核对草稿，最终以财务确认和原始表格为准。",
      "summary 写本次要核对的对象、期间和核心金额/课时线索。",
      "polishedText 写核对过程和异常点。",
      "todoItems 列出需要人工确认的字段、缺失凭证、跨系统对账动作。",
      "internalNote 写风险提醒，不要直接给出最终应发工资或最终分红结论。",
      "structuredData 建议包含 period, teacher, amountClues, hourClues, missingFields, riskPoints。"
    ].join("\n") : "",
    mode === "todo" ? "拆成明确待办，尽量包含负责人、截止时间线索和下一步动作。" : "",
    mode === "suggestion" ? "整理成正式管理建议，包含现象、影响、建议方案和预期收益。" : "",
    mode === "task" ? "整理成任务说明，包含目标、完成标准、子任务和验收口径。" : "",
    mode === "help" ? "用工作台现有模块回答，必要时说明进入哪个系统处理。模块包括排课、学管知识库、建议任务、财务、招生、教学质量、学生服务、教研课程、人事培训、校区运营。" : ""
  ].filter(Boolean).join("\n");
}

function stripThinkingText(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
}

function parseAiJson(text, fallback) {
  const raw = stripThinkingText(text);
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

function requireAiJson(text) {
  const raw = stripThinkingText(text);
  if (!raw) {
    const error = new Error("MiniMax 返回为空。");
    error.statusCode = 502;
    error.code = "minimax_empty_response";
    throw error;
  }
  const candidates = [raw];
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        ...parsed,
        todoItems: Array.isArray(parsed.todoItems) ? parsed.todoItems : []
      };
    } catch {
      // Try next candidate.
    }
  }
  return {
    title: "课堂反馈",
    summary: "MiniMax 已返回内容，系统已按校区统一模板补齐格式。",
    polishedText: raw,
    parentMessage: raw,
    todoItems: [],
    internalNote: `MiniMax 返回了非 JSON 内容，系统已保留模型文字并继续套用课堂反馈模板。原始片段：${raw.slice(0, 240)}`,
    _rawAiText: raw
  };
}

function ensureClassFeedbackResult(result, body) {
  if (String(body?.mode || "") !== "classFeedback") return result;
  const structuredStudents = Array.isArray(result?.structuredData?.students)
    ? result.structuredData.students
    : Array.isArray(result?.structuredData?.studentFeedbacks)
      ? result.structuredData.studentFeedbacks
      : [];
  if (Array.isArray(body?.batchStudents) && body.batchStudents.length > 1 && structuredStudents.length) {
    return {
      ...result,
      title: result?.title || `批量课堂反馈｜${body.batchStudents.length}人`,
      summary: result?.summary || "MiniMax 已按同一节课提取公共内容，并拆分每个学生个人表现。",
      parentMessage: result?.parentMessage || result?.polishedText || "同课多学生结构化课堂反馈",
      polishedText: result?.polishedText || result?.parentMessage || "同课多学生结构化课堂反馈",
      lessonSeason: result?.lessonSeason || body?.lessonSeason || extractFeedbackSeason(body?.text || ""),
      lessonNumber: result?.lessonNumber || body?.lessonNumber || resolveFeedbackLessonNumber(body?.target || "", body?.text || "", body),
      todoItems: Array.isArray(result?.todoItems) ? result.todoItems : [],
      internalNote: result?.internalNote || "MiniMax 已按一课多生模式返回结构化课堂反馈；系统会保持公共课程内容一致，并按学生拆分个人表现。"
    };
  }
  const rawAiText = String(result?._rawAiText || result?.polishedText || result?.parentMessage || "");
  const parentMessage = String(result?.parentMessage || rawAiText || "");
  const hasTemplate = parentMessage.includes("小课第") && parentMessage.includes("一、上课状态") && parentMessage.includes("本次课上课内容") && parentMessage.includes("知识点要点") && parentMessage.includes("学习掌握情况") && parentMessage.includes("课后作业");
  if (parentMessage && !looksLikeJsonText(parentMessage)) {
    const formatted = formatClassFeedbackText(parentMessage, body?.target || "");
    const noteParts = [
      result?.internalNote,
      hasTemplate
        ? "MiniMax 已主写课堂反馈，系统仅做称呼与段落格式校验。"
        : "MiniMax 已返回课堂反馈正文，但模板栏目不完整；系统保留模型原文，不再用本地模板覆盖，请老师按黄色提醒补齐后再归档。",
      rawAiText && rawAiText !== parentMessage ? "MiniMax 原始整理已保留在整理正文中。" : ""
    ].filter(Boolean);
    return {
      ...result,
      parentMessage: formatted,
      lessonSeason: result?.lessonSeason || body?.lessonSeason || extractFeedbackSeason(body?.text || ""),
      lessonNumber: result?.lessonNumber || body?.lessonNumber || resolveFeedbackLessonNumber(body?.target || "", body?.text || "", body),
      polishedText: result?.polishedText === parentMessage || !result?.polishedText ? formatted : result?.polishedText,
      internalNote: noteParts.join("\n")
    };
  }
  const error = new Error("MiniMax 没有返回可用的课堂反馈正文，本次不使用本地知识库硬凑正式反馈。");
  error.statusCode = 502;
  error.code = "minimax_incomplete_class_feedback";
  error.retryable = true;
  throw error;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringifyAiContent(content) {
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") return item;
      return item?.text || item?.content || item?.message || "";
    }).filter(Boolean).join("\n");
  }
  if (content && typeof content === "object") {
    return content.text || content.content || JSON.stringify(content);
  }
  return String(content || "");
}

function extractMinimaxContent(data) {
  const choice = data?.choices?.[0] || {};
  return stringifyAiContent(
    choice.message?.content
      || choice.delta?.content
      || data?.reply
      || data?.output_text
      || data?.output?.text
      || data?.data?.text
      || data?.data?.reply
      || ""
  ).trim();
}

function minimaxStatusMessage(data) {
  if (!data || typeof data === "string") return String(data || "");
  return data?.error?.message
    || data?.message
    || data?.base_resp?.status_msg
    || data?.base_resp?.status_code
    || data?.code
    || "";
}

function isRetryableMinimaxError(error) {
  const status = Number(error?.statusCode || 0);
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return error?.retryable
    || [408, 409, 425, 429, 500, 502, 503, 504].includes(status)
    || /(timeout|timed out|abort|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed|network)/i.test(`${code} ${message}`);
}

function minimaxFriendlyError(error) {
  const status = Number(error?.statusCode || 0);
  const message = String(error?.message || error || "").slice(0, 240);
  if (error?.code === "minimax_timeout") return `接口超时 ${Math.round(minimaxTimeoutMs / 1000)} 秒`;
  if (status === 429) return "接口限流或额度繁忙";
  if ([500, 502, 503, 504].includes(status)) return `MiniMax 服务临时异常 HTTP ${status}`;
  if (status) return `HTTP ${status}：${message}`;
  return message || "网络或接口返回异常";
}

async function callMinimaxChatOnce(body) {
  const requestHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${minimaxApiKey}`
  };
  if (minimaxGroupId) requestHeaders["GroupId"] = minimaxGroupId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), minimaxTimeoutMs);
  let response;
  try {
    response = await fetch(minimaxApiUrl, {
      method: "POST",
      headers: requestHeaders,
      signal: controller.signal,
      body: JSON.stringify({
        model: minimaxModel,
        messages: [
          { role: "system", content: aiSystemPrompt() },
          { role: "user", content: buildAiUserPrompt(body) }
        ],
        temperature: 0.25,
        max_completion_tokens: 2400,
        thinking: { type: "disabled" },
        reasoning_split: true
      })
    });
  } catch (error) {
    const wrapped = new Error(error?.name === "AbortError" ? "MiniMax 请求超时。" : String(error?.message || error));
    wrapped.statusCode = error?.name === "AbortError" ? 504 : 502;
    wrapped.code = error?.name === "AbortError" ? "minimax_timeout" : "minimax_network_error";
    wrapped.retryable = true;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(minimaxStatusMessage(data) || (typeof data === "string" ? data : JSON.stringify(data || {})));
    error.statusCode = response.status;
    error.retryable = isRetryableMinimaxError(error);
    throw error;
  }
  const baseRespCode = Number(data?.base_resp?.status_code || 0);
  if (baseRespCode) {
    const error = new Error(minimaxStatusMessage(data) || `MiniMax base_resp status ${baseRespCode}`);
    error.statusCode = baseRespCode;
    error.code = "minimax_base_resp_error";
    error.retryable = isRetryableMinimaxError(error);
    throw error;
  }
  const content = extractMinimaxContent(data);
  if (!content) {
    const error = new Error("MiniMax 返回为空。");
    error.statusCode = 502;
    error.code = "minimax_empty_response";
    error.retryable = true;
    throw error;
  }
  return content;
}

async function callMinimaxChat(body) {
  let lastError = null;
  for (let attempt = 1; attempt <= minimaxMaxAttempts; attempt += 1) {
    try {
      return await callMinimaxChatOnce(body);
    } catch (error) {
      lastError = error;
      if (!isRetryableMinimaxError(error) || attempt >= minimaxMaxAttempts) break;
      await wait(Math.min(3000, 700 * attempt));
    }
  }
  const wrapped = new Error(`${minimaxFriendlyError(lastError)}；已自动重试 ${minimaxMaxAttempts} 次。`);
  wrapped.statusCode = lastError?.statusCode || 502;
  wrapped.code = lastError?.code || "minimax_failed";
  wrapped.cause = lastError;
  wrapped.attempts = minimaxMaxAttempts;
  throw wrapped;
}

async function handleAiAssistant(req, res, headers, authorization) {
  const body = await readJson(req, 2 * 1024 * 1024);
  const text = String(body.text || "").trim();
  const fallback = localAiDraft(body);
  const isClassFeedback = String(body.mode || "") === "classFeedback";
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
    const payload = {
      ok: false,
      provider: "none",
      configured: false,
      error: "minimax_key_missing",
      message: "MiniMax Key 尚未配置，课堂反馈未生成。请先在阿里云服务环境变量中配置 JRC_MINIMAX_API_KEY。"
    };
    if (!isClassFeedback) {
      send(res, 200, { ok: true, provider: "local", configured: false, result: fallback, warning: payload.error, message: payload.message }, headers);
      return;
    }
    send(res, 503, payload, headers);
    return;
  }
  try {
    const content = await callMinimaxChat({
      ...body,
      operatorName: authorization?.payload?.name || body.operatorName || "-",
      operatorUsername: authorization?.payload?.sub || body.operatorUsername || "-"
    });
    const parsed = isClassFeedback ? requireAiJson(content) : parseAiJson(content, fallback);
    const result = ensureClassFeedbackResult(parsed, body);
    send(res, 200, { ok: true, provider: "minimax", configured: true, model: minimaxModel, result }, headers);
  } catch (error) {
    console.error("MiniMax assistant failed", error);
    const payload = {
      ok: false,
      provider: "minimax",
      configured: true,
      model: minimaxModel,
      error: error?.code || "minimax_failed",
      statusCode: error?.statusCode || 500,
      attempts: error?.attempts || minimaxMaxAttempts,
      message: `MiniMax 调用失败，课堂反馈未生成：${minimaxFriendlyError(error)}。请稍后再点一次 AI 整理；如果连续失败，请检查 API Key、额度、模型或服务器到 MiniMax 的网络。`
    };
    if (!isClassFeedback) {
      send(res, 200, { ok: true, provider: "local", configured: true, warning: payload.error, message: payload.message, result: fallback }, headers);
      return;
    }
    send(res, 502, payload, headers);
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
    if (req.method === "POST" && url.pathname === "/change-password") return await handleChangePassword(req, res, headers, authorization);
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

applyDepartedEmployeeLocks().then(applyModuleOwnerPermissionRules).finally(() => {
  http.createServer(route).listen(port, () => {
    console.log(`JRC cloud API listening on ${port}`);
  });
});
