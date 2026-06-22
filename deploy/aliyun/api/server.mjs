import http from "node:http";
import crypto from "node:crypto";
import { Pool } from "pg";

const port = Number(process.env.PORT || 3000);
const siteId = process.env.JRC_SITE_ID || "jrcedu-main";
const publicApiToken = process.env.JRC_API_TOKEN || "";
const allowedOrigins = (process.env.JRC_ALLOWED_ORIGINS || "https://jrc-edu.github.io,http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

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

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
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
  send(res, 200, {
    ok: true,
    storeKey: result.rows[0].store_key,
    moduleKey: result.rows[0].module_key,
    version: result.rows[0].version,
    updatedAt: result.rows[0].updated_at?.toISOString?.() || result.rows[0].updated_at
  }, headers);
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

async function route(req, res) {
  const headers = corsHeaders(req);
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/login") {
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
    if (req.method === "GET" && url.pathname === "/module-data") return await handleGetModuleData(url, res, headers);
    if (req.method === "PUT" && url.pathname === "/module-data") return await handlePutModuleData(req, res, headers);
    if (req.method === "POST" && url.pathname === "/audit-logs") return await handleAuditLog(req, res, headers);
    if (req.method === "POST" && url.pathname === "/backup-exports") return await handleBackupExport(req, res, headers);
    send(res, 404, { ok: false, error: "not found" }, headers);
  } catch (error) {
    console.error(error);
    send(res, 500, { ok: false, error: String(error?.message || error) }, headers);
  }
}

http.createServer(route).listen(port, () => {
  console.log(`JRC cloud API listening on ${port}`);
});
