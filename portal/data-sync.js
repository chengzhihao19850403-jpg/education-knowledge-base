(function () {
  const backupVersion = "2026-06-21-local-backup-v1";
  const managedStores = [
    { key: "jrc-cloud-paike-prototype", label: "排课系统", shape: "paike" },
    { key: "jrc-suggestion-management-v2", label: "建议系统", shape: "array" },
    { key: "jrc-finance-ledger-v1", label: "财务系统", shape: "finance" },
    { key: "jrc-teaching-quality-system-v2-demo", label: "教学质量", shape: "object" },
    { key: "jrc-student-service-v2", label: "学生服务", shape: "array" },
    { key: "jrc-curriculum-products-v2", label: "教研课程", shape: "array" },
    { key: "jrc-hr-training-tasks-v2", label: "人事培训", shape: "array" },
    { key: "jrc-campus-operations-v2", label: "校区运营", shape: "array" },
    { key: "jrc-business-audit-log-v1", label: "操作日志", shape: "array" },
    { key: "jrc-employee-directory-extra", label: "新增员工", shape: "array" }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function canManageBackup() {
    return typeof window.jrcHasPermission !== "function" || window.jrcHasPermission("admin.access");
  }

  function safeParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function readStore(key) {
    const raw = localStorage.getItem(key);
    return {
      raw,
      parsed: raw ? safeParse(raw) : null
    };
  }

  function countRows(store) {
    if (Array.isArray(store.parsed)) return store.parsed.length;
    if (!store.parsed || typeof store.parsed !== "object") return 0;
    if (store.key === "jrc-cloud-paike-prototype") {
      return [
        store.parsed.sessions?.length || 0,
        store.parsed.changeRequests?.length || 0,
        store.parsed.auditLogs?.length || 0
      ].reduce((sum, count) => sum + count, 0);
    }
    if (store.key === "jrc-finance-ledger-v1") {
      return Object.keys(store.parsed.periods || {}).length;
    }
    return Object.keys(store.parsed).length;
  }

  function renderSummary() {
    const holder = $("dataSyncSummary");
    if (!holder) return;
    holder.innerHTML = managedStores.map((item) => {
      const store = { ...item, ...readStore(item.key) };
      const count = countRows(store);
      return `
        <div class="data-sync-item">
          <span>${item.label}</span>
          <strong>${count}</strong>
        </div>
      `;
    }).join("");
  }

  function buildBackup() {
    const entries = {};
    managedStores.forEach((item) => {
      const raw = localStorage.getItem(item.key);
      if (raw !== null) entries[item.key] = raw;
    });
    return {
      version: backupVersion,
      exportedAt: new Date().toISOString(),
      source: window.location.href,
      entries
    };
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function setMessage(text) {
    const message = $("dataSyncMessage");
    if (message) message.textContent = text;
  }

  function exportBackup() {
    if (!canManageBackup()) {
      setMessage("当前账号暂无整站备份权限。");
      return;
    }
    const backup = buildBackup();
    const payload = JSON.stringify(backup, null, 2);
    const textarea = $("dataSyncPayload");
    if (textarea) textarea.value = payload;
    downloadJson(`匠人程整站本机备份-${new Date().toISOString().slice(0, 10)}.json`, backup);
    window.JRC_CLOUD?.recordBackupExport?.(backup, { operator: window.JRC_CURRENT_EMPLOYEE || null });
    setMessage(`已生成整站本机备份，共包含 ${Object.keys(backup.entries).length} 类数据。`);
  }

  function restoreBackup(rawText) {
    if (!canManageBackup()) {
      setMessage("当前账号暂无恢复整站备份权限。");
      return;
    }
    const backup = safeParse(rawText);
    if (!backup?.entries || typeof backup.entries !== "object") {
      setMessage("恢复失败：请粘贴或选择从本中心导出的备份 JSON。");
      return;
    }
    const allowedKeys = new Set(managedStores.map((item) => item.key));
    const restored = [];
    Object.entries(backup.entries).forEach(([key, raw]) => {
      if (!allowedKeys.has(key)) return;
      if (safeParse(raw, undefined) === undefined) return;
      localStorage.setItem(key, String(raw));
      restored.push(key);
    });
    renderSummary();
    setMessage(`已恢复 ${restored.length} 类本机数据。请刷新页面查看最新结果。`);
  }

  function initDataSync() {
    if (!$("dataSyncSummary")) return;
    renderSummary();
    $("dataSyncExportButton")?.addEventListener("click", exportBackup);
    $("dataSyncChooseFileButton")?.addEventListener("click", () => $("dataSyncFileInput")?.click());
    $("dataSyncFileInput")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const textarea = $("dataSyncPayload");
        if (textarea) textarea.value = String(reader.result || "");
        setMessage(`已读取备份文件：${file.name}。确认无误后点击恢复。`);
      };
      reader.readAsText(file);
      event.target.value = "";
    });
    $("dataSyncRestoreButton")?.addEventListener("click", () => restoreBackup($("dataSyncPayload")?.value || ""));
  }

  document.addEventListener("DOMContentLoaded", initDataSync);
})();
