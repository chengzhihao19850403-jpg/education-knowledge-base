import http from "node:http";
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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true"
  };
}

function isAuthorized(req) {
  if (!publicApiToken) return true;
  const header = req.headers.authorization || "";
  return header === `Bearer ${publicApiToken}`;
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
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (!isAuthorized(req)) {
    send(res, 401, { ok: false, error: "unauthorized" }, headers);
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/health") return await handleHealth(res, headers);
    if (req.method === "GET" && url.pathname === "/employees") return await handleEmployees(res, headers);
    if (req.method === "GET" && url.pathname === "/permissions") return await handlePermissions(res, headers);
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
