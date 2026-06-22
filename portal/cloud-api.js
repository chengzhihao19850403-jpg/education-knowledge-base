(function () {
  const configKey = "jrc-cloud-api-config-v1";
  const pendingKey = "jrc-cloud-sync-pending-v1";
  const sessionKey = "jrc-portal-auth-session";

  function safeJsonParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage?.getItem(key) || null;
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage?.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function readCookie(name) {
    try {
      const prefix = `${encodeURIComponent(name)}=`;
      return document.cookie
        .split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(prefix))
        ?.slice(prefix.length) || "";
    } catch {
      return "";
    }
  }

  function writeCookie(name, value, maxAgeSeconds = 7 * 24 * 60 * 60) {
    try {
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
    } catch {
      // Cookie fallback is best-effort only.
    }
  }

  function readSession() {
    return safeJsonParse(safeStorageGet(sessionKey) || decodeURIComponent(readCookie(sessionKey) || ""), {});
  }

  function readConfig() {
    const config = safeJsonParse(safeStorageGet(configKey), {});
    const session = readSession();
    const isGithubPages = location.hostname.endsWith("github.io");
    const sameOriginApiBase = `${location.origin}/api`;
    const apiBaseUrl = String(config.apiBaseUrl || (!isGithubPages ? sameOriginApiBase : "")).replace(/\/+$/g, "");
    return {
      enabled: Boolean((config.enabled && config.apiBaseUrl) || (!isGithubPages && apiBaseUrl)),
      apiBaseUrl,
      apiToken: String(config.apiToken || session.cloudApiToken || ""),
      siteId: String(config.siteId || "jrcedu-main")
    };
  }

  function readPendingQueue() {
    const rows = safeJsonParse(safeStorageGet(pendingKey), []);
    return Array.isArray(rows) ? rows : [];
  }

  function writePendingQueue(rows) {
    safeStorageSet(pendingKey, JSON.stringify(rows.slice(-200)));
  }

  function writeSession(session) {
    const serialized = JSON.stringify(session || {});
    safeStorageSet(sessionKey, serialized);
    writeCookie(sessionKey, serialized);
  }

  async function ensureSessionToken() {
    const config = readConfig();
    if (!config.enabled || config.apiToken) return config;
    const session = readSession();
    const username = String(session.username || "").trim().toLowerCase();
    if (!username) return config;
    try {
      const response = await fetch(`${config.apiBaseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "10281028" }),
        credentials: "include"
      });
      const text = await response.text();
      const data = text ? safeJsonParse(text, null) : null;
      if (!response.ok || !data?.token) return config;
      writeSession({
        ...session,
        cloudApiToken: data.token,
        cloudTokenExpiresAt: data.expiresAt || null,
        cloudLoginAt: new Date().toISOString()
      });
      return readConfig();
    } catch {
      return config;
    }
  }

  function enqueue(kind, payload) {
    writePendingQueue([
      ...readPendingQueue(),
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        kind,
        payload,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  async function request(path, options = {}) {
    const config = await ensureSessionToken();
    if (!config.enabled) return { ok: false, skipped: true, reason: "cloud-disabled" };

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;

    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "include"
    });

    const text = await response.text();
    const data = text ? safeJsonParse(text, text) : null;
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  }

  function buildAuditPayload(entry) {
    return {
      siteId: readConfig().siteId,
      moduleKey: entry.module || entry.moduleKey || "unknown",
      actionKey: entry.action || entry.actionKey || "unknown",
      targetType: entry.targetType || null,
      targetId: entry.target || entry.targetId || null,
      summary: entry.summary || "-",
      operatorName: entry.operatorName || "-",
      operatorUsername: entry.operatorUsername || "-",
      operatorRole: entry.operatorRole || "-",
      clientCreatedAt: entry.at || new Date().toISOString(),
      userAgent: navigator.userAgent
    };
  }

  async function writeAuditLog(entry) {
    const payload = buildAuditPayload(entry);
    try {
      const result = await request("/audit-logs", {
        method: "POST",
        body: payload
      });
      if (!result.ok && !result.skipped) enqueue("audit-log", payload);
      return result;
    } catch (error) {
      enqueue("audit-log", payload);
      return { ok: false, error: String(error?.message || error) };
    }
  }

  function buildBackupExportPayload(backup, context = {}) {
    const entries = backup?.entries && typeof backup.entries === "object" ? backup.entries : {};
    return {
      siteId: readConfig().siteId,
      backupVersion: backup?.version || "unknown",
      sourceUrl: backup?.source || window.location.href,
      exportedAt: backup?.exportedAt || new Date().toISOString(),
      exportedByName: context.operator?.name || window.JRC_CURRENT_EMPLOYEE?.name || "-",
      exportedByUsername: context.operator?.username || window.JRC_CURRENT_EMPLOYEE?.username || "-",
      entryCount: Object.keys(entries).length,
      storeKeys: Object.keys(entries)
    };
  }

  async function recordBackupExport(backup, context = {}) {
    const payload = buildBackupExportPayload(backup, context);
    try {
      const result = await request("/backup-exports", {
        method: "POST",
        body: payload
      });
      if (!result.ok && !result.skipped) enqueue("backup-export", payload);
      return result;
    } catch (error) {
      enqueue("backup-export", payload);
      return { ok: false, error: String(error?.message || error) };
    }
  }

  async function listEmployees() {
    return request("/employees");
  }

  async function listPermissions() {
    return request("/permissions");
  }

  async function login(username, password) {
    const config = readConfig();
    if (!config.enabled) return { ok: false, skipped: true, reason: "cloud-disabled" };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${config.apiBaseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
        signal: controller.signal
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        data: text ? safeJsonParse(text, text) : null
      };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function readModuleData(storeKey) {
    return request(`/module-data?storeKey=${encodeURIComponent(storeKey)}`);
  }

  async function writeModuleData(storeKey, moduleKey, payload, context = {}) {
    const operator = context.operator || window.JRC_CURRENT_EMPLOYEE || {};
    return request("/module-data", {
      method: "PUT",
      body: {
        storeKey,
        moduleKey,
        payload,
        operatorName: operator.name || "-",
        operatorUsername: operator.username || "-"
      }
    });
  }

  async function flushPending() {
    const rows = readPendingQueue();
    if (!rows.length) return { ok: true, flushed: 0 };

    const remaining = [];
    let flushed = 0;
    for (const row of rows) {
      const path = row.kind === "backup-export" ? "/backup-exports" : "/audit-logs";
      try {
        const result = await request(path, { method: "POST", body: row.payload });
        if (result.ok) flushed += 1;
        else remaining.push(row);
      } catch {
        remaining.push(row);
      }
    }
    writePendingQueue(remaining);
    return { ok: remaining.length === 0, flushed, remaining: remaining.length };
  }

  window.JRC_CLOUD = {
    readConfig,
    isEnabled: () => readConfig().enabled,
    request,
    writeAuditLog,
    recordBackupExport,
    listEmployees,
    listPermissions,
    login,
    readModuleData,
    writeModuleData,
    flushPending
  };
})();
