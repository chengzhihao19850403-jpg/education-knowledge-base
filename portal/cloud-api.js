(function () {
  const configKey = "jrc-cloud-api-config-v1";
  const pendingKey = "jrc-cloud-sync-pending-v1";

  function safeJsonParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function readConfig() {
    const config = safeJsonParse(localStorage.getItem(configKey), {});
    return {
      enabled: Boolean(config.enabled && config.apiBaseUrl),
      apiBaseUrl: String(config.apiBaseUrl || "").replace(/\/+$/g, ""),
      apiToken: String(config.apiToken || ""),
      siteId: String(config.siteId || "jrcedu-main")
    };
  }

  function readPendingQueue() {
    const rows = safeJsonParse(localStorage.getItem(pendingKey), []);
    return Array.isArray(rows) ? rows : [];
  }

  function writePendingQueue(rows) {
    localStorage.setItem(pendingKey, JSON.stringify(rows.slice(-200)));
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
    const config = readConfig();
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
    flushPending
  };
})();

