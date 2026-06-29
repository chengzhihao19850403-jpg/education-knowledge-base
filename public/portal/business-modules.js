(function () {
  const auditKey = "jrc-business-audit-log-v1";
  const linkEventKey = "jrc-system-link-events-v1";
  const cloudStoreModules = {
    "jrc-student-service-v2": "studentService",
    "jrc-curriculum-products-v2": "curriculum",
    "jrc-hr-training-tasks-v2": "hr",
    "jrc-hr-role-directory-v1": "hr",
    "jrc-hr-summer-schedule-v1": "hr",
    "jrc-campus-operations-v2": "campus",
    "jrc-suggestion-management-v2": "suggestions"
  };
  const nowText = () => new Date().toLocaleString("zh-CN", { hour12: false });

  function $(id) {
    return document.getElementById(id);
  }

  function readStore(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function buildRowFingerprint(row) {
    if (!row || typeof row !== "object") return "";
    const fields = [
      row.student,
      row.className,
      row.teacher,
      row.type,
      row.risk,
      row.next,
      row.content,
      row.name,
      row.subject,
      row.grade,
      row.track,
      row.outlineCategory,
      row.teacherName,
      row.season,
      row.lesson,
      row.version,
      row.owner,
      row.note,
      row.formula,
      row.fileName,
      row.employee,
      row.system,
      row.status,
      row.title,
      row.date,
      row.time,
      row.role,
      row.area,
      row.location,
      row.due,
      row.createdAt
    ];
    return fields.map((value) => normalizeText(value)).filter(Boolean).join("|");
  }

  function ensureRowId(row, prefix = "row") {
    if (!row || typeof row !== "object") return row;
    const existing = String(row.rowId || row.id || "").trim();
    if (existing) return { ...row, rowId: existing };
    const seed = buildRowFingerprint(row) || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return { ...row, rowId: `${prefix}-${hash.toString(16)}` };
  }

  function mergeRowsById(rows, prefix = "row") {
    const map = new Map();
    const rowTime = (row) => {
      const value = String(row?.updatedAt || row?.createdAt || row?.at || row?.time || row?.date || "").trim();
      const parsed = Date.parse(value.replace(/\./g, "/"));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const normalized = ensureRowId(row, prefix);
      const rowId = String(normalized.rowId || "").trim();
      if (!rowId) return;
      const existing = map.get(rowId);
      if (!existing) {
        map.set(rowId, { ...normalized, rowId });
        return;
      }
      const incomingIsNewer = rowTime(normalized) >= rowTime(existing);
      map.set(rowId, incomingIsNewer
        ? { ...existing, ...normalized, rowId }
        : { ...normalized, ...existing, rowId });
    });
    return [...map.values()].sort((left, right) => {
      const rightDate = String(right.updatedAt || right.createdAt || "");
      const leftDate = String(left.updatedAt || left.createdAt || "");
      return rightDate.localeCompare(leftDate);
    });
  }

  function deletedRowsKey(key) {
    return `${key}-deleted-ids-v1`;
  }

  function readDeletedRowIds(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(deletedRowsKey(key)) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.map((value) => String(value || "").trim()).filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }

  function writeDeletedRowIds(key, ids) {
    const rows = [...ids].map((value) => String(value || "").trim()).filter(Boolean);
    localStorage.setItem(deletedRowsKey(key), JSON.stringify(rows));
    window.JRC_CLOUD?.writeModuleData?.(deletedRowsKey(key), cloudStoreModules[key] || "business", rows, { replaceMode: "replace" }).catch((error) => {
      console.warn("删除标记云端保存失败", key, error);
    });
  }

  function markRowDeleted(key, row) {
    const rowId = String(ensureRowId(row, key)?.rowId || "").trim();
    if (!rowId) return;
    const ids = readDeletedRowIds(key);
    ids.add(rowId);
    writeDeletedRowIds(key, ids);
  }

  function markRowsDeleted(key, rows) {
    const ids = readDeletedRowIds(key);
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const rowId = String(ensureRowId(row, key)?.rowId || "").trim();
      if (rowId) ids.add(rowId);
    });
    writeDeletedRowIds(key, ids);
  }

  function restoreDeletedRows(key, rows) {
    const ids = readDeletedRowIds(key);
    if (!ids.size) return;
    let changed = false;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const rowId = String(ensureRowId(row, key)?.rowId || "").trim();
      if (rowId && ids.delete(rowId)) changed = true;
    });
    if (changed) writeDeletedRowIds(key, ids);
  }

  function filterDeletedRows(key, rows) {
    const ids = readDeletedRowIds(key);
    if (!ids.size) return rows;
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const rowId = String(ensureRowId(row, key)?.rowId || "").trim();
      return !ids.has(rowId);
    });
  }

  function readLinkEvents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(linkEventKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function mergeLinkEvents(...groups) {
    const map = new Map();
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const fallbackFingerprint = [
        row.source,
        row.target,
        row.action,
        row.count,
        (Array.isArray(row.samples) ? row.samples : []).join("|")
      ].join("::");
      const fingerprint = String(row.fingerprint || fallbackFingerprint).trim();
      const id = String(row.id || fingerprint || row.at || "").trim();
      if (!id && !fingerprint) return;
      const key = fingerprint || id;
      const existing = map.get(key) || {};
      const existingTime = Date.parse(existing.at || "");
      const rowTime = Date.parse(row.at || "");
      const newer = !existing.at || (Number.isFinite(rowTime) && (!Number.isFinite(existingTime) || rowTime >= existingTime));
      map.set(key, newer ? { ...existing, ...row, id, fingerprint: key } : { ...row, ...existing, fingerprint: key });
    });
    return [...map.values()]
      .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")))
      .slice(0, 200);
  }

  function linkSample(rows, formatter = (row) => row?.student || row?.studentName || row?.title || "") {
    return (Array.isArray(rows) ? rows : [])
      .slice(0, 3)
      .map(formatter)
      .map((value) => normalizeText(value))
      .filter(Boolean);
  }

  function recordLinkEvent({ source, target, action, count = 0, samples = [], status = "已同步", note = "" }) {
    const existingRows = readLinkEvents();
    const fingerprint = [
      source,
      target,
      action,
      count,
      (Array.isArray(samples) ? samples : []).join("|")
    ].join("::");
    const duplicated = existingRows.find((row) => {
      const rowFingerprint = [
        row.source,
        row.target,
        row.action,
        row.count,
        (Array.isArray(row.samples) ? row.samples : []).join("|")
      ].join("::");
      const minutes = (Date.now() - Date.parse(row.at || "")) / 60000;
      return rowFingerprint === fingerprint && Number.isFinite(minutes) && minutes < 10;
    });
    if (duplicated) return duplicated;
    const event = {
      id: `link-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      source,
      target,
      action,
      count,
      fingerprint,
      samples,
      status,
      note,
      operatorName: currentOperator().name || "-",
      operatorUsername: currentOperator().username || "-",
      at: new Date().toISOString()
    };
    const rows = mergeLinkEvents([event], existingRows);
    localStorage.setItem(linkEventKey, JSON.stringify(rows));
    if (window.JRC_CLOUD?.writeModuleData) {
      const writeMerged = (remoteRows = []) => {
        const nextRows = mergeLinkEvents([event], existingRows, remoteRows);
        localStorage.setItem(linkEventKey, JSON.stringify(nextRows));
        return window.JRC_CLOUD.writeModuleData(linkEventKey, "systemLinks", nextRows).catch((error) => {
          console.warn("系统联动日志云端保存失败", error);
          return { ok: false, error };
        });
      };
      if (window.JRC_CLOUD.readModuleData) {
        window.JRC_CLOUD.readModuleData(linkEventKey)
          .then((result) => writeMerged(Array.isArray(result?.data?.payload) ? result.data.payload : []))
          .catch(() => writeMerged([]));
      } else {
        writeMerged([]);
      }
    }
    window.dispatchEvent(new CustomEvent("jrc-system-link-event", { detail: event }));
    return event;
  }

  function effectiveAttendancePresent(row) {
    return ["到课", "迟到"].includes(row?.status) || String(row?.exitScore ?? "").trim() !== "";
  }

  function attendanceFollowupHandled(row) {
    return row?.followupHandled === true || row?.followupStatus === "已处理";
  }

  function attendanceNeedsFollowup(row) {
    return (!effectiveAttendancePresent(row) || row?.followup === "待联系家长") && !attendanceFollowupHandled(row);
  }

  function attendanceRowToStudentService(session, row) {
    const student = normalizeName(row?.studentName || row?.student || "");
    if (!student) return null;
    const status = normalizeText(row?.status || "待核对");
    const exitScore = normalizeText(row?.exitScore || "");
    const followup = normalizeText(row?.followup || "");
    const risk = attendanceNeedsFollowup(row) ? "关注" : "正常";
    const scoreText = exitScore ? `；出门测 ${exitScore}` : "";
    const statusText = `${session.date || "-"} ${session.className || "未填课程"}：${status}${scoreText}`;
    const next = attendanceNeedsFollowup(row)
      ? (followup && followup !== "正常销课并计课时" ? followup : "确认补课/视频课/是否销课")
      : "常规课后反馈";
    return {
      rowId: `att-flow-${session.id || session.date || ""}-${student}`.replace(/\s+/g, ""),
      student,
      className: session.className || "-",
      teacher: session.teacher || row?.teacher || "-",
      type: exitScore ? "学习跟踪" : "课后反馈",
      risk,
      content: statusText,
      next,
      sourceModule: "attendance",
      sourceSessionId: session.id || "",
      sourceDate: session.date || "",
      sourceStatus: status,
      createdAt: session.createdAt || nowText(),
      updatedAt: nowText()
    };
  }

  function admissionLeadToStudentService(lead) {
    const student = normalizeName(lead?.studentName || lead?.name || "");
    if (!student) return null;
    const enrolledAmount = Number(lead?.enrolledAmount || 0);
    const status = normalizeText(lead?.status || "");
    const parentPhone = normalizePhone(lead?.parentPhone || lead?.phone || "");
    const owner = normalizeName(lead?.owner || "");
    const trialTeacher = normalizeName(lead?.trialTeacher || "");
    const className = normalizeName(lead?.grade || lead?.className || "待分班");
    const sourceId = normalizeText(lead?.leadId || lead?.id || `${student}-${parentPhone || owner}`);
    const note = [
      status ? `招生状态：${status}` : "",
      lead?.channel ? `来源：${lead.channel}` : "",
      owner ? `招生/学管：${owner}` : "",
      trialTeacher ? `试听老师：${trialTeacher}` : "",
      enrolledAmount ? `实收/报名金额：${enrolledAmount}` : "",
      parentPhone ? `家长电话：${parentPhone}` : ""
    ].filter(Boolean).join("；");
    return {
      rowId: `adm-flow-${sourceId}`.replace(/\s+/g, ""),
      student,
      className,
      teacher: trialTeacher || owner || "-",
      type: "入学交接",
      risk: "正常",
      content: note || "招生系统已报名学生自动进入学生服务候选。",
      next: "建立学生档案，安排首次家长沟通和正式排课",
      sourceModule: "admissions",
      sourceLeadId: sourceId,
      sourceStatus: status,
      parentPhone,
      channel: normalizeText(lead?.channel || ""),
      admissionsOwner: owner,
      trialTeacher,
      enrolledAmount,
      createdAt: lead?.createdAt || nowText(),
      updatedAt: nowText()
    };
  }

  function readAdmissionsState() {
    try {
      const parsed = JSON.parse(localStorage.getItem("advice-system-stage-prototype") || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function syncAdmissionsIntoStudentService(leads, options = {}) {
    const key = "jrc-student-service-v2";
    const incoming = (Array.isArray(leads) ? leads : [])
      .filter((lead) => String(lead?.status || "") === "定金 / 已报名" || Number(lead?.enrolledAmount || 0) > 0)
      .map(admissionLeadToStudentService)
      .filter(Boolean);
    if (!incoming.length) return [];
    const existing = readStore(key, []);
    const merged = mergeRowsById([...incoming, ...existing], key);
    localStorage.setItem(key, JSON.stringify(merged));
    if (window.JRC_CLOUD?.writeModuleData) {
      const writeMerged = (remoteRows = []) => {
        const nextRows = mergeRowsById([...incoming, ...remoteRows, ...existing], key);
        localStorage.setItem(key, JSON.stringify(nextRows));
        return window.JRC_CLOUD.writeModuleData(key, "studentService", nextRows).catch((error) => {
          console.warn("招生联动学生服务云端保存失败", error);
          return { ok: false, error };
        });
      };
      if (window.JRC_CLOUD.readModuleData) {
        window.JRC_CLOUD.readModuleData(key)
          .then((result) => writeMerged(Array.isArray(result?.data?.payload) ? result.data.payload : []))
          .catch(() => writeMerged([]));
      } else {
        writeMerged([]);
      }
    }
    if (options.dispatch !== false) {
      window.dispatchEvent(new CustomEvent("jrc-student-service-linked", {
        detail: { rows: incoming, source: "admissions" }
      }));
    }
    if (options.log !== false) {
      recordLinkEvent({
        source: "招生管理系统",
        target: "学生服务系统",
        action: "报名/实收学生转入学生服务",
        count: incoming.length,
        samples: linkSample(incoming, (row) => `${row.student}${row.className ? `｜${row.className}` : ""}`),
        note: "报名后自动形成入学交接候选，方便学管继续服务。"
      });
    }
    return incoming;
  }

  function syncAttendanceIntoStudentService(sessions, options = {}) {
    const key = "jrc-student-service-v2";
    const incoming = (Array.isArray(sessions) ? sessions : [])
      .flatMap((session) => (Array.isArray(session?.rows) ? session.rows : [])
        .map((row) => attendanceRowToStudentService(session, row)))
      .filter(Boolean);
    if (!incoming.length) return [];
    const existing = readStore(key, []);
    const merged = mergeRowsById([...incoming, ...existing], key);
    localStorage.setItem(key, JSON.stringify(merged));
    if (window.JRC_CLOUD?.writeModuleData) {
      const writeMerged = (remoteRows = []) => {
        const nextRows = mergeRowsById([...incoming, ...remoteRows, ...existing], key);
        localStorage.setItem(key, JSON.stringify(nextRows));
        return window.JRC_CLOUD.writeModuleData(key, "studentService", nextRows).catch((error) => {
          console.warn("点名联动学生服务云端保存失败", error);
          return { ok: false, error };
        });
      };
      if (window.JRC_CLOUD.readModuleData) {
        window.JRC_CLOUD.readModuleData(key)
          .then((result) => writeMerged(Array.isArray(result?.data?.payload) ? result.data.payload : []))
          .catch(() => writeMerged([]));
      } else {
        writeMerged([]);
      }
    }
    if (options.dispatch !== false) {
      window.dispatchEvent(new CustomEvent("jrc-student-service-linked", {
        detail: { rows: incoming, source: "attendance" }
      }));
    }
    if (options.log !== false) {
      recordLinkEvent({
        source: "点名出门测",
        target: "学生服务系统",
        action: "点名记录沉淀为学生服务",
        count: incoming.length,
        samples: linkSample(incoming, (row) => `${row.student}${row.sourceDate ? `｜${row.sourceDate}` : ""}`),
        note: "点名、出门测和缺席追踪进入学生服务，后续可用于学管沟通、课销和课时费核对。"
      });
    }
    return incoming;
  }

  function writeStore(key, rows, options = {}) {
    if (options.restoreDeleted !== false) restoreDeletedRows(key, rows);
    const mergedRows = filterDeletedRows(key, mergeRowsById(rows, key));
    localStorage.setItem(key, JSON.stringify(mergedRows));
    if (cloudStoreModules[key]) writeCloudStore(key, cloudStoreModules[key], mergedRows);
  }

  function readCloudStore(key, onRows) {
    if (!window.JRC_CLOUD?.readModuleData) return;
    const deletedTask = window.JRC_CLOUD.readModuleData(deletedRowsKey(key)).then((deletedResult) => {
      if (!deletedResult.ok || !deletedResult.data?.found || !Array.isArray(deletedResult.data.payload)) return;
      const localIds = readDeletedRowIds(key);
      deletedResult.data.payload.forEach((value) => {
        const id = String(value || "").trim();
        if (id) localIds.add(id);
      });
      localStorage.setItem(deletedRowsKey(key), JSON.stringify([...localIds]));
    }).catch((error) => {
      console.warn("删除标记云端读取失败", key, error);
    });
    window.JRC_CLOUD.readModuleData(key).then((result) => {
      if (!result.ok || !result.data?.found || !Array.isArray(result.data.payload)) return;
      deletedTask.finally(() => {
        const localRows = readStore(key, []);
        const mergedRows = filterDeletedRows(key, mergeRowsById([...(Array.isArray(localRows) ? localRows : []), ...result.data.payload], key));
        localStorage.setItem(key, JSON.stringify(mergedRows));
        if (JSON.stringify(mergedRows) !== JSON.stringify(result.data.payload) && mergedRows.length) {
          writeCloudStore(key, cloudStoreModules[key], mergedRows);
        }
        onRows(mergedRows);
      });
    }).catch((error) => {
      console.warn("云端数据读取失败", key, error);
    });
  }

  function writeCloudStore(key, moduleKey, rows) {
    if (!window.JRC_CLOUD?.writeModuleData) return;
    const context = Array.isArray(rows) && rows.length === 0 ? { replaceMode: "replace" } : {};
    window.JRC_CLOUD.writeModuleData(key, moduleKey, filterDeletedRows(key, rows), context).catch((error) => {
      console.warn("云端数据保存失败", key, error);
    });
  }

  function hasPermission(permission) {
    if (!permission) return true;
    const operator = window.JRC_CURRENT_EMPLOYEE || {};
    const username = normalizeText(operator.username).toLowerCase();
    const name = normalizeName(operator.name);
    if (["chengzhihao", "czh"].includes(username) || name === "程志豪") return true;
    if (typeof window.jrcHasPermission !== "function") return true;
    return window.jrcHasPermission(permission);
  }

  function moduleCapabilities(moduleKey) {
    const manage = hasPermission(`${moduleKey}.edit`);
    return {
      create: manage || hasPermission(`${moduleKey}.create`),
      update: manage || hasPermission(`${moduleKey}.update`),
      delete: manage || hasPermission(`${moduleKey}.delete`),
      import: manage || hasPermission(`${moduleKey}.import`),
      export: manage || hasPermission(`${moduleKey}.export`),
      reset: manage || hasPermission(`${moduleKey}.reset`)
    };
  }

  function currentOperator() {
    return window.JRC_CURRENT_EMPLOYEE || {
      name: "未登录账号",
      username: "anonymous",
      role: "未知"
    };
  }

  function readAuditLog() {
    try {
      const parsed = JSON.parse(localStorage.getItem(auditKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAuditLog(rows) {
    localStorage.setItem(auditKey, JSON.stringify(rows.slice(0, 300)));
  }

  function recordAudit(module, action, target, summary) {
    const operator = currentOperator();
    const entry = {
      module,
      action,
      target: target || "-",
      summary: summary || "-",
      operatorName: operator.name || "-",
      operatorUsername: operator.username || "-",
      operatorRole: operator.role || "-",
      at: nowText()
    };
    writeAuditLog([entry, ...readAuditLog()]);
    window.JRC_CLOUD?.writeAuditLog?.(entry);
  }

  function renderAuditLog(module, tableBodyId) {
    const body = $(tableBodyId);
    if (!body) return;
    const rows = readAuditLog().filter((entry) => entry.module === module).slice(0, 10);
    body.innerHTML = rows.length ? rows.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.at)}</td>
        <td>${escapeHtml(entry.operatorName)}<br>${escapeHtml(entry.operatorRole)}</td>
        <td>${escapeHtml(entry.action)}</td>
        <td>${escapeHtml(entry.target)}</td>
        <td>${escapeHtml(entry.summary)}</td>
      </tr>
    `).join("") : `
      <tr>
        <td colspan="5">暂无操作记录。后续新增、修改、删除、导入或清空都会记录在这里。</td>
      </tr>
    `;
  }

  function denyAction(messageId, action = "修改") {
    setText(messageId, `当前账号暂无${action}权限。请联系管理员调整岗位权限。`);
  }

  function disableControl(id, title = "当前账号暂无权限") {
    const node = $(id);
    if (!node) return;
    node.disabled = true;
    node.style.opacity = "0.55";
    node.style.cursor = "not-allowed";
    node.title = title;
  }

  function applyCapabilityGate({ canWrite, messageId, buttonRules = [], fieldIds = [] }) {
    buttonRules.forEach(([id, allowed, action]) => {
      if (!allowed) disableControl(id, `当前账号暂无${action}权限`);
    });
    if (canWrite) return;
    fieldIds.forEach((id) => disableControl(id, "当前账号暂无新增或修改权限"));
    denyAction(messageId, "新增或修改");
  }

  function normalizeText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function normalizeName(value) {
    return normalizeText(value).replace(/[，,。.;；:：]+$/g, "");
  }

  function normalizePhone(value) {
    return String(value ?? "").replace(/[^\d]/g, "");
  }

  function normalizeStatus(value, allowed, fallback) {
    const text = normalizeText(value);
    return allowed.includes(text) ? text : fallback;
  }

  function readField(row, aliases, fallback = "") {
    for (const key of aliases) {
      if (row?.[key] !== undefined && row[key] !== "") return row[key];
    }
    return fallback;
  }

  function parseCsvLine(line, delimiter) {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells.map((cell) => normalizeText(cell));
  }

  function parseTableText(text) {
    const cleanText = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!cleanText) return [];
    const lines = cleanText.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = parseCsvLine(lines[0], delimiter).map((header) => normalizeText(header));
    return lines.slice(1).map((line) => {
      const cells = parseCsvLine(line, delimiter);
      return headers.reduce((row, header, index) => {
        row[header] = cells[index] || "";
        return row;
      }, {});
    });
  }

  function parseImportedRows(text) {
    const source = String(text || "").trim();
    if (!source) return [];
    try {
      const parsed = JSON.parse(source);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall back to CSV/TSV pasted from Excel.
    }
    return parseTableText(source);
  }

  function bindTableImport({ buttonId, inputId, getRows, setRows, normalizeRow, onDone, onError, canUse = () => true, onDenied = () => {} }) {
    const button = $(buttonId);
    const input = $(inputId);
    if (!button || !input) return;

    button.addEventListener("click", () => {
      if (!canUse()) {
        onDenied();
        return;
      }
      input.click();
    });
    input.addEventListener("change", () => {
      if (!canUse()) {
        onDenied();
        input.value = "";
        return;
      }
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseImportedRows(reader.result);
          const imported = parsed.map(normalizeRow).filter(Boolean);
          if (imported.length === 0) throw new Error("No valid rows");
          setRows([...imported, ...getRows()]);
          onDone(imported.length);
        } catch {
          onError();
        } finally {
          input.value = "";
        }
      };
      reader.readAsText(file);
    });
  }

  function guardAction(allowed, messageId, action, callback) {
    if (!allowed) {
      denyAction(messageId, action);
      return;
    }
    callback();
  }

  function injectBusinessModuleStyles() {
    if (document.getElementById("jrcBusinessModuleResponsiveStyles")) return;
    const style = document.createElement("style");
    style.id = "jrcBusinessModuleResponsiveStyles";
    style.textContent = `
      .table-wrap {
        -webkit-overflow-scrolling: touch;
      }
      .table-wrap::after {
        content: "";
        display: block;
        height: 0;
      }
      @media (max-width: 720px) {
        body {
          -webkit-text-size-adjust: 100%;
        }
        .shell {
          width: min(100% - 20px, 1280px) !important;
          padding: 18px 0 34px !important;
        }
        .topbar,
        .card,
        .metric {
          border-radius: 16px !important;
        }
        .topbar,
        .card {
          padding: 16px !important;
        }
        .nav {
          width: 100%;
          flex-wrap: nowrap !important;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: thin;
        }
        .nav-link,
        .button {
          min-height: 44px !important;
          white-space: nowrap;
        }
        .actions {
          align-items: stretch !important;
        }
        .actions > input,
        .actions > select,
        .actions > button,
        .actions > a {
          width: 100% !important;
          flex: 1 1 100% !important;
        }
        .section-head {
          align-items: flex-start !important;
          flex-direction: column;
        }
        .table-wrap {
          margin-left: -4px;
          margin-right: -4px;
          border-radius: 12px !important;
          overflow-x: auto;
        }
        table {
          min-width: 720px !important;
        }
        th,
        td {
          padding: 10px !important;
          font-size: 12px !important;
        }
        .field input,
        .field select,
        .field textarea {
          min-height: 46px !important;
          font-size: 16px !important;
        }
        .metric {
          padding: 14px !important;
        }
        .metric strong {
          font-size: 24px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = String(value);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
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

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadCsv(filename, rows, columns) {
    const header = columns.map((column) => column.label);
    const body = rows.map((row) => columns.map((column) => {
      if (typeof column.value === "function") return column.value(row);
      return row[column.value] ?? "";
    }));
    const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function formatFileSize(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 * 1024) return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`;
    if (value >= 1024) return `${Math.round(value / 102.4) / 10} KB`;
    return `${value} B`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("file read failed"));
      reader.readAsDataURL(file);
    });
  }

  function downloadDataUrl(filename, dataUrl) {
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename || "课程资料";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function downloadBlob(filename, blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "课程资料";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function parseDateValue(value) {
    const time = Date.parse(String(value || "").replace(/\//g, "-"));
    return Number.isFinite(time) ? time : 0;
  }

  function formatDateOnly(value) {
    const text = normalizeText(value);
    return text ? text.slice(0, 10) : "";
  }

  function statusRank(value, priority) {
    const text = String(value || "");
    const index = priority.findIndex((item) => text.includes(item));
    return index >= 0 ? index : priority.length;
  }

  function getSortedEntries(rows, keyword, sortValue, statusSelector, priority) {
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => rowMatches(row, keyword))
      .sort((left, right) => {
        if (sortValue === "oldest") return parseDateValue(left.row.createdAt) - parseDateValue(right.row.createdAt);
        if (sortValue === "status") {
          return statusRank(statusSelector(left.row), priority) - statusRank(statusSelector(right.row), priority);
        }
        return parseDateValue(right.row.createdAt) - parseDateValue(left.row.createdAt);
      });
  }

  function tag(label, tone = "neutral") {
    const palette = {
      neutral: "background:rgba(23,33,50,0.07); color:#334155;",
      good: "background:rgba(15,118,110,0.10); color:#0f766e;",
      warn: "background:rgba(180,83,9,0.12); color:#b45309;",
      danger: "background:rgba(185,28,28,0.10); color:#b91c1c;",
      info: "background:rgba(37,99,235,0.10); color:#1d4ed8;"
    };
    return `<span style="display:inline-flex; align-items:center; min-height:24px; padding:0 9px; border-radius:999px; font-size:12px; font-weight:800; ${palette[tone] || palette.neutral}">${escapeHtml(label)}</span>`;
  }

  function riskTag(value) {
    if (value === "高风险") return tag(value, "danger");
    if (value === "关注") return tag(value, "warn");
    return tag(value || "正常", "good");
  }

  function workStatusTag(value) {
    if (value === "已完成" || value === "已录入") return tag(value, "good");
    if (value === "处理中") return tag(value, "info");
    if (value === "需复盘") return tag(value, "danger");
    return tag(value || "待处理", "warn");
  }

  function rowMatches(row, keyword) {
    if (!keyword) return true;
    return Object.entries(row).some(([key, value]) => {
      if (key === "fileDataUrl") return false;
      if (key === "fileStorageKey") return false;
      return String(value || "").toLowerCase().includes(keyword);
    });
  }

  function actionButtons(index, capabilities = {}) {
    const buttons = [];
    if (capabilities.update) {
      buttons.push(`<button type="button" data-action="edit" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(23,33,50,0.12); background:#fff; color:#172132; cursor:pointer;">编辑</button>`);
    }
    if (capabilities.delete) {
      buttons.push(`<button type="button" data-action="delete" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(185,28,28,0.18); background:rgba(185,28,28,0.08); color:#b91c1c; cursor:pointer;">删除</button>`);
    }
    if (buttons.length === 0) return tag("仅查看", "neutral");
    return `
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${buttons.join("")}
      </div>
    `;
  }

  function bindRowActions(tableBodyId, handlers, capabilities = {}, messageId = "") {
    const body = $(tableBodyId);
    if (!body) return;
    body.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const index = Number(button.getAttribute("data-index"));
      if (action === "edit") {
        guardAction(capabilities.update, messageId, "修改", () => handlers.onEdit(index));
      }
      if (action === "delete") {
        guardAction(capabilities.delete, messageId, "删除", () => handlers.onDelete(index));
      }
    });
  }

  function initStudentService() {
    if (!$("studentServiceTableBody")) return;
    const moduleKey = "studentService";
    const capabilities = moduleCapabilities(moduleKey);
    const key = "jrc-student-service-v2";
    const attendanceKey = "jrc-class-attendance-v1";
    const scienceTeachers = ["海滢滢", "姚老师", "朱永乐"];
    const defaults = {
      student: "",
      className: "",
      teacher: currentOperator().name || "",
      type: "课后反馈",
      risk: "正常",
      next: "",
      content: ""
    };
    function sanitizeRows(input) {
      return (Array.isArray(input) ? input : []).filter((row) => !["学生 A", "学生 B", "学生 C"].includes(row.student));
    }
    let rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
    let editingIndex = -1;

    function activeServiceModule() {
      const key = localStorage.getItem("jrc-student-service-active-module-v1") || "cheng";
      return ["cheng", "small", "science"].includes(key) ? key : "cheng";
    }

    function serviceModuleForRow(row = {}) {
      const explicit = String(row.serviceModule || "").trim();
      if (["cheng", "small", "science"].includes(explicit)) return explicit;
      const compact = (value) => String(value || "").replace(/\s+/g, "");
      const teacher = compact(row.teacher || row.teacherName || row.createdBy || row.operatorName || "");
      const text = compact([row.className, row.type, row.content, row.parentMessage, row.sourceText, row.student, row.studentName].filter(Boolean).join(" "));
      if (/程志豪|程老师/.test(teacher) || /程老师|程志豪/.test(text)) return "cheng";
      if (scienceTeachers.map(compact).includes(teacher) || /科学|物理|化学|实验|海滢滢|姚老师|朱永乐/.test(text)) return "science";
      return "small";
    }

    function visibleServiceRows(inputRows = rows) {
      const moduleKey = activeServiceModule();
      return (Array.isArray(inputRows) ? inputRows : []).filter((row) => serviceModuleForRow(row) === moduleKey);
    }

    function visibleServiceEntries(keyword, sortValue) {
      return rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => serviceModuleForRow(row) === activeServiceModule())
        .filter(({ row }) => rowMatches(row, keyword))
        .sort((left, right) => {
          if (sortValue === "oldest") return parseDateValue(left.row.createdAt) - parseDateValue(right.row.createdAt);
          if (sortValue === "status") return statusRank(left.row.risk, ["高风险", "关注", "正常"]) - statusRank(right.row.risk, ["高风险", "关注", "正常"]);
          return parseDateValue(right.row.createdAt) - parseDateValue(left.row.createdAt);
        });
    }

    function hydrateFromAttendance() {
      const sessions = readStore(attendanceKey, []);
      const linkedRows = syncAttendanceIntoStudentService(sessions, { dispatch: false, log: false });
      if (linkedRows.length) {
        rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      }
      return linkedRows.length;
    }

    function hydrateFromAdmissions() {
      const state = readAdmissionsState();
      const leads = Array.isArray(state.leads) ? state.leads : [];
      const linkedRows = syncAdmissionsIntoStudentService(leads, { dispatch: false, log: false });
      if (linkedRows.length) {
        rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      }
      return linkedRows.length;
    }

    function fillForm(row) {
      $("studentNameInput").value = row.student || "";
      $("studentClassInput").value = row.className || "";
      $("studentTeacherInput").value = row.teacher || "";
      $("studentServiceTypeInput").value = row.type || "学习跟踪";
      $("studentRiskInput").value = row.risk || "正常";
      $("studentNextActionInput").value = row.next || "";
      $("studentContentInput").value = row.content || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("studentSaveButton", "保存服务记录");
    }

    function previewText(value, maxLength = 88) {
      const text = normalizeText(value);
      if (text.length <= maxLength) return text;
      return `${text.slice(0, maxLength)}...`;
    }

    function studentFeedbackCell(row, index) {
      const sourceTags = [
        row.sourceModule === "attendance" ? "<br><span style=\"color:#0f766e;font-size:12px;font-weight:800;\">点名流转</span>" : "",
        row.sourceModule === "admissions" ? "<br><span style=\"color:#1d4ed8;font-size:12px;font-weight:800;\">招生转入</span>" : "",
        row.sourceModule === "aiAssistant" ? "<br><span style=\"color:#0f766e;font-size:12px;font-weight:800;\">AI 课堂反馈</span>" : ""
      ].join("");
      const parentMessage = String(row.parentMessage || "").trim();
      const content = String(row.content || "").trim();
      if (!parentMessage) return `${escapeHtml(row.type)}${sourceTags}<br>${escapeHtml(content || "-")}`;
      return `
        ${escapeHtml(row.type)}${sourceTags}
        <details class="feedback-details" style="margin-top:6px;">
          <summary>${escapeHtml(previewText(parentMessage || content, 96) || "查看家长版反馈")}</summary>
          <pre class="feedback-preview">${escapeHtml(parentMessage || content || "-")}</pre>
        </details>
        <button type="button" data-action="copy-parent-message" data-index="${index}" style="margin-top:6px; min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(13,148,136,0.28); background:rgba(13,148,136,0.08); color:#0f766e; cursor:pointer;">复制家长文案</button>
      `;
    }

    function render() {
      const keyword = $("studentFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("studentSortSelect")?.value || "newest";
      const filteredRows = visibleServiceRows();
      const entries = visibleServiceEntries(keyword, sortValue);
      $("studentServiceTableBody").innerHTML = entries.length ? entries
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.student)}</td>
            <td>${escapeHtml(row.className)}</td>
            <td>${escapeHtml(row.teacher)}</td>
            <td>${studentFeedbackCell(row, index)}</td>
            <td>${escapeHtml(row.createdAt || "-")}</td>
            <td>${riskTag(row.risk)}</td>
            <td>${escapeHtml(row.next)}</td>
            <td>${actionButtons(index, capabilities)}</td>
          </tr>
        `).join("") : `<tr><td colspan="8">暂无学生服务记录。可以先新增一条真实记录，或把 Excel 另存为 CSV 后导入。</td></tr>`;
      setText("studentMetricTotal", filteredRows.length);
      setText("studentMetricFeedback", filteredRows.filter((row) => row.type === "课后反馈").length);
      setText("studentMetricRisk", filteredRows.filter((row) => row.risk !== "正常").length);
      setText("studentMetricCommunication", filteredRows.filter((row) => row.type === "家长沟通").length);
      renderAuditLog(moduleKey, "studentAuditTableBody");
    }

    $("studentSaveButton")?.addEventListener("click", () => {
      const actionAllowed = editingIndex >= 0 ? capabilities.update : capabilities.create;
      if (!actionAllowed) {
        denyAction("studentServiceMessage", editingIndex >= 0 ? "修改" : "新增");
        return;
      }
      const student = normalizeName($("studentNameInput")?.value);
      if (!student) {
        setText("studentServiceMessage", "请先填写学生姓名。");
        return;
      }
      const payload = {
        student,
        className: normalizeName($("studentClassInput")?.value) || "-",
        teacher: normalizeName($("studentTeacherInput")?.value) || "-",
        type: $("studentServiceTypeInput")?.value || "学习跟踪",
        risk: $("studentRiskInput")?.value || "正常",
        content: normalizeText($("studentContentInput")?.value) || "-",
        next: normalizeText($("studentNextActionInput")?.value) || "-",
        serviceModule: editingIndex >= 0 ? rows[editingIndex].serviceModule || activeServiceModule() : activeServiceModule(),
        parentMessage: editingIndex >= 0 ? rows[editingIndex].parentMessage || "" : "",
        sourceModule: editingIndex >= 0 ? rows[editingIndex].sourceModule || "" : "",
        sourceText: editingIndex >= 0 ? rows[editingIndex].sourceText || "" : "",
        createdBy: editingIndex >= 0 ? rows[editingIndex].createdBy || currentOperator().name || "" : currentOperator().name || "",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText(),
        updatedAt: nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        recordAudit(moduleKey, "更新", student, `${payload.type} / ${payload.risk}`);
        setText("studentServiceMessage", `已更新 ${student} 的服务记录。`);
      } else {
        rows.unshift(payload);
        recordAudit(moduleKey, "新增", student, `${payload.type} / ${payload.risk}`);
        setText("studentServiceMessage", `已保存 ${student} 的服务记录。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("studentFilterInput")?.addEventListener("input", render);
    $("studentSortSelect")?.addEventListener("change", render);
    window.addEventListener("storage", (event) => {
      if (event.key === "jrc-student-service-active-module-v1") render();
    });
    window.addEventListener("jrc-student-service-module-changed", render);
    $("studentExportButton")?.addEventListener("click", () => guardAction(capabilities.export, "studentServiceMessage", "导出", () => downloadCsv("学生与家长服务数据.csv", visibleServiceRows(), [
      { label: "学生", value: "student" },
      { label: "班级/课程", value: "className" },
      { label: "任课老师", value: "teacher" },
      { label: "服务类型", value: "type" },
      { label: "风险等级", value: "risk" },
      { label: "记录内容", value: "content" },
      { label: "家长版反馈", value: "parentMessage" },
      { label: "下一步", value: "next" },
      { label: "创建时间", value: "createdAt" },
      { label: "更新时间", value: "updatedAt" }
    ])));
    $("studentResetButton")?.addEventListener("click", () => {
      if (!capabilities.reset) {
        denyAction("studentServiceMessage", "清空");
        return;
      }
      const deletingRows = visibleServiceRows();
      markRowsDeleted(key, deletingRows);
      rows = rows.filter((row) => serviceModuleForRow(row) !== activeServiceModule());
      writeStore(key, rows, { restoreDeleted: false });
      recordAudit(moduleKey, "清空", "学生服务台账", `${deletingRows.length} 条`);
      resetForm();
      render();
      setText("studentServiceMessage", "已清空当前服务台台账，其他服务台数据保留。");
    });
    bindRowActions("studentServiceTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("studentSaveButton", "保存修改");
        setText("studentServiceMessage", `正在编辑 ${rows[index].student}。`);
      },
      onDelete(index) {
        const removed = rows[index];
        markRowDeleted(key, removed);
        rows.splice(index, 1);
        writeStore(key, rows, { restoreDeleted: false });
        recordAudit(moduleKey, "删除", removed.student, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("studentServiceMessage", `已删除 ${removed.student} 的记录。`);
      }
    }, capabilities, "studentServiceMessage");
    $("studentServiceTableBody")?.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action='copy-parent-message']");
      if (!button) return;
      const index = Number(button.getAttribute("data-index"));
      const message = rows[index]?.parentMessage || "";
      if (!message) {
        setText("studentServiceMessage", "这条记录没有家长版文案。");
        return;
      }
      try {
        await navigator.clipboard?.writeText(message);
        setText("studentServiceMessage", `已复制 ${rows[index]?.student || "学生"} 的家长版反馈。`);
      } catch {
        setText("studentServiceMessage", "复制失败，可以手动选中文案复制。");
      }
    });
    bindTableImport({
      buttonId: "studentImportButton",
      inputId: "studentImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        rows = nextRows;
        writeStore(key, rows);
        resetForm();
        render();
      },
      normalizeRow(row) {
        const student = normalizeName(readField(row, ["student", "学生", "学生姓名", "姓名"]));
        if (!student) return null;
        return {
          student,
          className: normalizeName(readField(row, ["className", "班级", "课程", "班级 / 课程"], "-")) || "-",
          teacher: normalizeName(readField(row, ["teacher", "老师", "任课老师"], "-")) || "-",
          type: normalizeStatus(readField(row, ["type", "服务类型", "类型"], "学习跟踪"), ["课后反馈", "家长沟通", "续费风险", "学习跟踪"], "学习跟踪"),
          risk: normalizeStatus(readField(row, ["risk", "风险", "风险等级", "续费风险"], "正常"), ["正常", "关注", "高风险"], "正常"),
          content: normalizeText(readField(row, ["content", "记录内容", "最近反馈", "反馈"], "-")) || "-",
          next: normalizeText(readField(row, ["next", "下一步", "跟进事项"], "-")) || "-",
          serviceModule: activeServiceModule(),
          createdAt: String(readField(row, ["createdAt", "创建时间", "时间"], nowText())),
          updatedAt: String(readField(row, ["updatedAt", "更新时间"], nowText()))
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "学生服务台账", `${count} 条`);
        renderAuditLog(moduleKey, "studentAuditTableBody");
        setText("studentServiceMessage", `已导入 ${count} 条学生服务记录。`);
      },
      onError() {
        setText("studentServiceMessage", "导入失败。请上传 CSV/TSV/JSON；Excel 可以先另存为 CSV。");
      },
      canUse: () => capabilities.import,
      onDenied: () => denyAction("studentServiceMessage", "导入")
    });
    resetForm();
    const linkedCount = hydrateFromAttendance();
    const admissionsLinkedCount = hydrateFromAdmissions();
    render();
    if (linkedCount || admissionsLinkedCount) {
      setText("studentServiceMessage", `已自动联动：点名 ${linkedCount} 条，招生报名 ${admissionsLinkedCount} 条。`);
    }
    window.JRC_CLOUD?.readModuleData?.(attendanceKey).then((result) => {
      const remoteSessions = Array.isArray(result?.data?.payload) ? result.data.payload : [];
      const remoteLinkedCount = syncAttendanceIntoStudentService(remoteSessions, { dispatch: false, log: false }).length;
      if (!remoteLinkedCount) return;
      rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      render();
      setText("studentServiceMessage", `已从云端点名同步 ${remoteLinkedCount} 条学生服务记录。`);
    }).catch((error) => {
      console.warn("云端点名联动学生服务读取失败", error);
    });
    window.JRC_CLOUD?.readModuleData?.("advice-system-stage-prototype").then((result) => {
      const remoteLeads = Array.isArray(result?.data?.payload?.leads) ? result.data.payload.leads : [];
      const remoteLinkedCount = syncAdmissionsIntoStudentService(remoteLeads, { dispatch: false, log: false }).length;
      if (!remoteLinkedCount) return;
      rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      render();
      setText("studentServiceMessage", `已从云端招生同步 ${remoteLinkedCount} 条入学交接记录。`);
    }).catch((error) => {
      console.warn("云端招生联动学生服务读取失败", error);
    });
    readCloudStore(key, (cloudRows) => {
      rows = mergeRowsById(sanitizeRows(cloudRows), key);
      if (rows.length !== cloudRows.length) writeStore(key, rows);
      hydrateFromAttendance();
      hydrateFromAdmissions();
      rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      resetForm();
      render();
      setText("studentServiceMessage", "已同步云端学生服务台账。");
    });
    window.addEventListener("jrc-attendance-saved", (event) => {
      const count = syncAttendanceIntoStudentService([event.detail?.session].filter(Boolean), { dispatch: false, log: false }).length;
      if (!count) return;
      rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      render();
      setText("studentServiceMessage", `已从刚保存的点名同步 ${count} 条学生服务记录。`);
    });
    applyCapabilityGate({
      canWrite: capabilities.create || capabilities.update,
      messageId: "studentServiceMessage",
      buttonRules: [["studentSaveButton", capabilities.create || capabilities.update, "新增或修改"], ["studentImportButton", capabilities.import, "导入"], ["studentExportButton", capabilities.export, "导出"], ["studentResetButton", capabilities.reset, "清空"]],
      fieldIds: ["studentNameInput", "studentClassInput", "studentTeacherInput", "studentServiceTypeInput", "studentRiskInput", "studentNextActionInput", "studentContentInput"]
    });
  }

  function initCurriculumProducts() {
    if (!$("curriculumTableBody")) return;
    const moduleKey = "curriculum";
    const capabilities = moduleCapabilities(moduleKey);
    const key = "jrc-curriculum-products-v2";
    const maxLocalFileBytes = 8 * 1024 * 1024;
    const maxCloudFileBytes = 30 * 1024 * 1024;
    const currentEmployee = window.JRC_CURRENT_EMPLOYEE || {};
    const gradeExpertRules = window.JRC_CURRICULUM_GRADE_EXPERTS || {};
    const gradeExpertRule = gradeExpertRules[String(currentEmployee.username || "").toLowerCase()] || null;
    const allGradeOptions = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三"];
    const defaultOutlineCategory = "普通课程资料";
    const outlineCategoryOptions = [defaultOutlineCategory, "程老师授课大纲", "科学老师授课大纲", "小课老师授课大纲"];
    const seasonOptions = ["春季", "暑假", "秋季", "寒假", "通用"];
    const scienceOutlineTeachers = ["海滢滢", "姚老师", "朱永乐"];
    const canViewAllGrades = hasPermission("admin.access") || hasPermission("curriculum.edit") || currentEmployee.role !== "授课老师";
    const isGradeRestricted = !canViewAllGrades;
    const allowedGrades = isGradeRestricted ? (gradeExpertRule?.grades || []) : allGradeOptions;
    const allowedSubject = isGradeRestricted ? String(gradeExpertRule?.subject || "").trim() : "";
    const defaults = {
      name: "",
      subject: "",
      grade: allowedGrades[0] || "一年级",
      outlineCategory: defaultOutlineCategory,
      season: "春季",
      track: "课内体系",
      lesson: "",
      type: "课程大纲",
      classType: "暑假班",
      version: "V1.0",
      teacherName: "",
      owner: "",
      formula: "",
      note: "",
      fileName: "",
      fileType: "",
      fileSize: 0,
      fileDataUrl: "",
      fileUrl: "",
      fileStorageKey: "",
      storageKind: ""
    };

    function normalizeOutlineCategory(value, type = "") {
      const text = normalizeText(value);
      if (outlineCategoryOptions.includes(text)) return text;
      if (text.includes("程老师")) return "程老师授课大纲";
      if (text.includes("科学")) return "科学老师授课大纲";
      if (text.includes("小课")) return "小课老师授课大纲";
      if (normalizeText(type) === "课程大纲") return "小课老师授课大纲";
      return defaultOutlineCategory;
    }

    function normalizeSeason(value) {
      const text = normalizeText(value);
      if (seasonOptions.includes(text)) return text;
      if (/春/.test(text)) return "春季";
      if (/暑|夏/.test(text)) return "暑假";
      if (/秋/.test(text)) return "秋季";
      if (/寒|冬/.test(text)) return "寒假";
      return "通用";
    }

    function isTeachingOutline(row) {
      return normalizeOutlineCategory(row?.outlineCategory, row?.type) !== defaultOutlineCategory;
    }

    function teachingTeacherNames() {
      const names = new Set();
      (Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : []).forEach((employee) => {
        if (!String(employee?.role || "").includes("授课老师")) return;
        const name = normalizeName(employee.name);
        if (name) names.add(name);
      });
      rows.forEach((row) => {
        const name = normalizeName(row.teacherName || row.teacher || "");
        if (name) names.add(name);
      });
      return Array.from(names).sort((left, right) => left.localeCompare(right, "zh-CN"));
    }

    function teacherFilterNamesForActiveOutline() {
      if (activeOutlineFilter === "科学老师授课大纲") return scienceOutlineTeachers;
      if (activeOutlineFilter === "小课老师授课大纲") {
        const scienceSet = new Set(scienceOutlineTeachers);
        return teachingTeacherNames().filter((name) => !scienceSet.has(name));
      }
      return [];
    }

    function teacherInputNamesForSelectedOutline() {
      const selectedOutline = normalizeOutlineCategory($("curriculumOutlineCategoryInput")?.value || activeOutlineFilter, "课程大纲");
      if (selectedOutline === "科学老师授课大纲") return scienceOutlineTeachers;
      if (selectedOutline === "小课老师授课大纲") {
        const scienceSet = new Set(scienceOutlineTeachers);
        return teachingTeacherNames().filter((name) => !scienceSet.has(name));
      }
      return teachingTeacherNames();
    }

    function applyTeacherOptions() {
      const names = teacherInputNamesForSelectedOutline();
      const input = $("curriculumTeacherInput");
      if (input) {
        const selected = input.value || "";
        input.innerHTML = `<option value="">按负责人 / 不指定</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
        if (selected && names.includes(selected)) input.value = selected;
      }
      const filter = $("curriculumTeacherFilter");
      if (filter) {
        const selected = filter.value || "";
        const filterNames = teacherFilterNamesForActiveOutline();
        filter.innerHTML = `<option value="">全部授课老师</option>${filterNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
        if (selected && filterNames.includes(selected)) filter.value = selected;
      }
    }

    function updateCurriculumFilterControls() {
      const teacherFilter = $("curriculumTeacherFilter");
      if (!teacherFilter) return;
      const shouldShowTeacherFilter = ["小课老师授课大纲", "科学老师授课大纲"].includes(activeOutlineFilter);
      teacherFilter.hidden = !shouldShowTeacherFilter;
      if (!shouldShowTeacherFilter) teacherFilter.value = "";
      applyTeacherOptions();
    }

    function isImageFile(row = {}) {
      const fileType = String(row.fileType || "").toLowerCase();
      const fileName = String(row.fileName || "").toLowerCase();
      return fileType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(fileName);
    }

    function parseVersionValue(version) {
      const match = String(version || "").match(/(\d+(?:\.\d+)?)/);
      return match ? Number(match[1]) : 0;
    }

    function latestVersionEntries(entries) {
      const latestMap = new Map();
      entries.forEach((entry) => {
        const keyText = curriculumDuplicateKey(entry.row, entry.row.fileName);
        const existing = latestMap.get(keyText);
        if (!existing) {
          latestMap.set(keyText, entry);
          return;
        }
        const leftVersion = parseVersionValue(entry.row.version);
        const rightVersion = parseVersionValue(existing.row.version);
        const leftDate = parseDateValue(entry.row.updatedAt || entry.row.createdAt);
        const rightDate = parseDateValue(existing.row.updatedAt || existing.row.createdAt);
        if (leftVersion > rightVersion || (leftVersion === rightVersion && leftDate >= rightDate)) {
          latestMap.set(keyText, entry);
        }
      });
      return Array.from(latestMap.values());
    }

    function sanitizeRows(input) {
      const oldSeedNames = ["暑假数学提升课", "初一数学衔接课", "科学专题课"];
      return (Array.isArray(input) ? input : [])
        .filter((row) => !oldSeedNames.includes(row.name))
        .map((row) => ({
          ...row,
          outlineCategory: normalizeOutlineCategory(row.outlineCategory || row.outlineType || row.category, row.type),
          season: normalizeSeason(row.season || row.term || row.classType),
          teacherName: normalizeName(row.teacherName || row.teacher || row.instructor || ""),
          formula: normalizeText(row.formula || row.keyFormula || row.corePoints || "")
        }));
    }
    let rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
    let editingIndex = -1;
    let activeOutlineFilter = "";
    let curriculumPreviewObjectUrl = "";
    let curriculumPreviewZoom = 1;

    function gradeScopeText() {
      if (!isGradeRestricted) return "当前账号可查看全部年级课程资料。";
      if (!allowedGrades.length) return "当前账号还没有配置教研课程年级范围，请联系校区运营与人事系统管理员。";
      return `当前账号仅开放：${allowedGrades.join("、")}${allowedSubject ? `｜${allowedSubject}` : ""}。`;
    }

    function subjectMatchesScope(row) {
      if (!allowedSubject) return true;
      const subjectText = String(row.subject || "").trim();
      return Boolean(subjectText && subjectText !== "-" && subjectText.includes(allowedSubject));
    }

    function rowVisibleToCurrentUser(row) {
      if (!isGradeRestricted) return true;
      if (!allowedGrades.length) return false;
      return allowedGrades.includes(row.grade) && subjectMatchesScope(row);
    }

    function normalizeSubjectForScope(value, grade) {
      const text = normalizeText(value);
      if (!isGradeRestricted || !allowedSubject) return text || "-";
      return `${allowedSubject} / ${grade}`;
    }

    function applyGradeOptions() {
      const select = $("curriculumGradeInput");
      const options = allowedGrades.length ? allowedGrades : allGradeOptions;
      if (select) {
        select.innerHTML = options.map((grade) => `<option>${escapeHtml(grade)}</option>`).join("");
        select.disabled = isGradeRestricted && allowedGrades.length === 0;
      }
      const gradeFilter = $("curriculumGradeFilter");
      if (gradeFilter) {
        gradeFilter.innerHTML = `<option value="">全部年级</option>${options.map((grade) => `<option>${escapeHtml(grade)}</option>`).join("")}`;
      }
    }

    function visibleRows() {
      return rows.filter(rowVisibleToCurrentUser);
    }

    function fillForm(row) {
      $("curriculumNameInput").value = row.name || "";
      const grade = allowedGrades.includes(row.grade) || !isGradeRestricted ? (row.grade || allowedGrades[0] || "一年级") : (allowedGrades[0] || "一年级");
      $("curriculumSubjectInput").value = row.subject || (allowedSubject && grade ? `${allowedSubject} / ${grade}` : "");
      if ($("curriculumGradeInput")) $("curriculumGradeInput").value = grade;
      if ($("curriculumOutlineCategoryInput")) $("curriculumOutlineCategoryInput").value = normalizeOutlineCategory(row.outlineCategory, row.type);
      if ($("curriculumTeacherInput")) $("curriculumTeacherInput").value = row.teacherName || "";
      if ($("curriculumSeasonInput")) $("curriculumSeasonInput").value = normalizeSeason(row.season || row.classType);
      if ($("curriculumTrackInput")) $("curriculumTrackInput").value = row.track || "课内体系";
      $("curriculumTypeInput").value = row.type || "备课资料";
      $("curriculumClassTypeInput").value = row.classType || "";
      if ($("curriculumLessonInput")) $("curriculumLessonInput").value = row.lesson || "";
      $("curriculumVersionInput").value = row.version || "V1.0";
      $("curriculumOwnerInput").value = row.owner || currentEmployee.name || "";
      if ($("curriculumFormulaInput")) $("curriculumFormulaInput").value = row.formula || "";
      $("curriculumNoteInput").value = row.note || "";
      if ($("curriculumFileInput")) $("curriculumFileInput").value = "";
      renderFilePreview(row);
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("curriculumSaveButton", "保存课程资料");
    }

    function renderFilePreview(row = {}) {
      const preview = $("curriculumFilePreview");
      if (!preview) return;
      if (row.fileName) {
        preview.textContent = `当前文件：${row.fileName}（${formatFileSize(row.fileSize)}）。重新选择文件后会更新版本。`;
        return;
      }
      preview.textContent = "尚未选择文件。";
    }

    function closeCurriculumPreview() {
      const modal = $("curriculumPreviewModal");
      const image = $("curriculumPreviewImage");
      if (modal) modal.setAttribute("aria-hidden", "true");
      if (image) image.removeAttribute("src");
      curriculumPreviewZoom = 1;
      if (curriculumPreviewObjectUrl) {
        URL.revokeObjectURL(curriculumPreviewObjectUrl);
        curriculumPreviewObjectUrl = "";
      }
    }

    function applyCurriculumPreviewZoom() {
      const image = $("curriculumPreviewImage");
      if (!image) return;
      image.style.width = `${Math.round(curriculumPreviewZoom * 100)}%`;
      image.style.margin = "0 auto";
      image.style.display = "block";
    }

    function setCurriculumPreviewZoom(nextZoom) {
      curriculumPreviewZoom = Math.min(4, Math.max(0.5, nextZoom));
      applyCurriculumPreviewZoom();
    }

    async function previewCurriculumImage(row, button) {
      if (!row?.fileName) {
        setText("curriculumMessage", "这条资料还没有上传图片。");
        return;
      }
      if (!isImageFile(row)) {
        setText("curriculumMessage", "当前文件不是图片，建议下载后查看。");
        return;
      }
      const modal = $("curriculumPreviewModal");
      const image = $("curriculumPreviewImage");
      const title = $("curriculumPreviewTitle");
      if (!modal || !image) return;
      closeCurriculumPreview();
      if (title) title.textContent = row.fileName || "图片预览";
      setCurriculumPreviewZoom(1);
      if (row.fileDataUrl) {
        image.src = row.fileDataUrl;
        image.onload = applyCurriculumPreviewZoom;
        modal.setAttribute("aria-hidden", "false");
        setText("curriculumMessage", `正在预览 ${row.fileName}。`);
        return;
      }
      if (!window.JRC_CLOUD?.downloadCurriculumFile) {
        setText("curriculumMessage", "当前环境暂时不能预览云端图片。");
        return;
      }
      try {
        if (button) button.disabled = true;
        setText("curriculumMessage", `正在加载图片 ${row.fileName}...`);
        const result = await window.JRC_CLOUD.downloadCurriculumFile(row);
        if (!result.ok || !result.blob) {
          setText("curriculumMessage", "图片加载失败，请刷新后重试。");
          return;
        }
        curriculumPreviewObjectUrl = URL.createObjectURL(result.blob);
        image.src = curriculumPreviewObjectUrl;
        image.onload = applyCurriculumPreviewZoom;
        modal.setAttribute("aria-hidden", "false");
        setText("curriculumMessage", `正在预览 ${row.fileName}。`);
      } catch (error) {
        setText("curriculumMessage", error.message || "图片预览失败。");
      } finally {
        if (button) button.disabled = false;
      }
    }

    function fileBaseName(fileName) {
      return normalizeText(String(fileName || "").replace(/\.[^.]+$/g, "")) || "未命名资料";
    }

    function curriculumDuplicateKey(row, fileName = row?.fileName || "") {
      const logicalName = normalizeText(row?.name) || fileBaseName(fileName);
      return [
        row?.grade,
        row?.outlineCategory,
        row?.teacherName,
        row?.season,
        row?.track,
        row?.type,
        row?.lesson,
        logicalName
      ].map((value) => normalizeText(value).toLowerCase()).join("|");
    }

    function rowMatchesCurriculumFilters(row) {
      const outlineFilter = activeOutlineFilter || $("curriculumOutlineFilter")?.value || "";
      const teacherFilter = ["小课老师授课大纲", "科学老师授课大纲"].includes(activeOutlineFilter) ? ($("curriculumTeacherFilter")?.value || "") : "";
      const seasonFilter = $("curriculumSeasonFilter")?.value || "";
      const gradeFilter = $("curriculumGradeFilter")?.value || "";
      if (outlineFilter && normalizeOutlineCategory(row.outlineCategory, row.type) !== outlineFilter) return false;
      if (teacherFilter && normalizeName(row.teacherName || row.owner) !== teacherFilter) return false;
      if (seasonFilter && normalizeSeason(row.season || row.classType) !== seasonFilter) return false;
      if (gradeFilter && row.grade !== gradeFilter) return false;
      return true;
    }

    function bumpVersion(version) {
      const text = normalizeText(version) || "V1.0";
      const match = text.match(/^v?(\d+)(?:\.(\d+))?$/i);
      if (!match) return `${text}-新版`;
      const major = Number(match[1] || 1);
      const minor = Number(match[2] || 0) + 1;
      return `V${major}.${minor}`;
    }

    function findDuplicateCurriculumIndex(payload, fileName) {
      const keyText = curriculumDuplicateKey(payload, fileName);
      return rows.findIndex((row, index) => index !== editingIndex && curriculumDuplicateKey(row, row.fileName) === keyText);
    }

    async function selectedFilePayload(existing = {}, metadata = {}, fileOverride = null) {
      const file = fileOverride || $("curriculumFileInput")?.files?.[0];
      if (!file) {
        return {
          fileName: existing.fileName || "",
          fileType: existing.fileType || "",
          fileSize: existing.fileSize || 0,
          fileDataUrl: existing.fileDataUrl || "",
          fileUrl: existing.fileUrl || "",
          fileStorageKey: existing.fileStorageKey || "",
          storageKind: existing.storageKind || ""
        };
      }
      if (window.JRC_CLOUD?.isEnabled?.() && window.JRC_CLOUD?.uploadCurriculumFile) {
        if (file.size > maxCloudFileBytes) {
          throw new Error(`文件超过 ${formatFileSize(maxCloudFileBytes)}。请先压缩或拆分后上传。`);
        }
        setText("curriculumMessage", `正在上传 ${file.name}...`);
        const result = await window.JRC_CLOUD.uploadCurriculumFile(file, metadata);
        if (result.ok && result.data?.file) {
          return {
            ...result.data.file,
            fileDataUrl: ""
          };
        }
        if (file.size > maxLocalFileBytes) {
          throw new Error("云端上传失败，较大文件不能临时保存在浏览器。请稍后重试。");
        }
      }
      if (file.size > maxLocalFileBytes) {
        throw new Error(`文件超过 ${formatFileSize(maxLocalFileBytes)}。当前网络未连接云端上传，不能临时保存大文件。`);
      }
      const dataUrl = await readFileAsDataUrl(file);
      return {
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        fileDataUrl: dataUrl,
        fileUrl: "",
        fileStorageKey: "",
        storageKind: "browser-data-url"
      };
    }

    function fileCell(row, index) {
      if (!row.fileName) return `${tag("未上传", "neutral")}`;
      const canDownload = row.fileDataUrl || row.fileStorageKey || row.fileUrl;
      if (!canDownload) return `<div style="display:grid; gap:6px;">${tag("待上传", "warn")}<span>${escapeHtml(row.fileName)}</span></div>`;
      if (isImageFile(row)) {
        return `
          <div style="display:grid; gap:6px;">
            <button type="button" data-preview-curriculum="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(37,99,235,0.18); background:rgba(37,99,235,0.10); color:#1d4ed8; cursor:pointer;">打开图片</button>
            <span>${escapeHtml(row.fileName)}</span>
            <small>${formatFileSize(row.fileSize)}</small>
          </div>
        `;
      }
      return `
        <div style="display:grid; gap:6px;">
          <button type="button" data-download-curriculum="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(37,99,235,0.18); background:rgba(37,99,235,0.10); color:#1d4ed8; cursor:pointer;">下载</button>
          <span>${escapeHtml(row.fileName)}</span>
          <small>${formatFileSize(row.fileSize)}</small>
        </div>
      `;
    }

    function render() {
      const keyword = $("curriculumFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("curriculumSortSelect")?.value || "newest";
      const entries = latestVersionEntries(rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => rowVisibleToCurrentUser(row))
        .filter(({ row }) => rowMatchesCurriculumFilters(row))
        .filter(({ row }) => rowMatches(row, keyword)))
        .sort((left, right) => {
          if (sortValue === "oldest") return parseDateValue(left.row.createdAt) - parseDateValue(right.row.createdAt);
          if (sortValue === "status") {
            return statusRank(left.row.status, ["待导入", "待整理", "待上传", "已录入"]) - statusRank(right.row.status, ["待导入", "待整理", "待上传", "已录入"]);
          }
          return parseDateValue(right.row.createdAt) - parseDateValue(left.row.createdAt);
        });
      const scopedRows = latestVersionEntries(visibleRows().map((row, index) => ({ row, index }))).map(({ row }) => row);
      $("curriculumTableBody").innerHTML = entries.length ? entries
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.grade || "-")}<br>${tag(normalizeSeason(row.season || row.classType), "neutral")}<br>${tag(row.track || "未分体系", "info")}</td>
            <td>${tag(normalizeOutlineCategory(row.outlineCategory, row.type), isTeachingOutline(row) ? "good" : "neutral")}</td>
            <td><strong>${escapeHtml(row.name)}</strong><br>${escapeHtml(row.subject)}</td>
            <td>${tag(row.type, "info")}<br>${escapeHtml(row.classType)}</td>
            <td>${escapeHtml(row.lesson || "-")}<br>${escapeHtml(row.version)}</td>
            <td>${fileCell(row, index)}</td>
            <td>${escapeHtml(row.teacherName || row.owner || "-")}${row.teacherName && row.owner && row.teacherName !== row.owner ? `<br><span style="color:#94a3b8;">负责人：${escapeHtml(row.owner)}</span>` : ""}</td>
            <td>${row.formula ? `<strong>公式重点</strong><br>${escapeHtml(row.formula)}<br>` : ""}${escapeHtml(row.note)}</td>
            <td>${actionButtons(index, capabilities)}</td>
          </tr>
        `).join("") : `<tr><td colspan="9">${isGradeRestricted && !allowedGrades.length ? "当前账号还没有配置负责年级。" : "当前负责范围内暂无课程资料。"}</td></tr>`;
      setText("curriculumMetricOutline", scopedRows.filter((row) => row.type === "课程大纲" || isTeachingOutline(row)).length);
      setText("curriculumMetricMaterials", scopedRows.filter((row) => ["课件PDF", "讲义Word", "题目图片", "老师版答案", "题库"].includes(row.type)).length);
      setText("curriculumMetricProducts", new Set(scopedRows.map((row) => `${row.grade || ""}|${row.track || ""}`).filter(Boolean)).size);
      setText("curriculumMetricPreparation", scopedRows.filter((row) => row.fileName).length);
      renderAuditLog(moduleKey, "curriculumAuditTableBody");
    }

    $("curriculumFileInput")?.addEventListener("change", () => {
      const files = Array.from($("curriculumFileInput")?.files || []);
      if (!files.length) {
        renderFilePreview(editingIndex >= 0 ? rows[editingIndex] : {});
        return;
      }
      const preview = $("curriculumFilePreview");
      if (preview) {
        const totalSize = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
        preview.textContent = files.length === 1
          ? `已选择：${files[0].name}（${formatFileSize(files[0].size)}）`
          : `已选择 ${files.length} 个文件，总计 ${formatFileSize(totalSize)}。保存后逐个上传。`;
      }
    });

    $("curriculumSaveButton")?.addEventListener("click", async () => {
      const actionAllowed = editingIndex >= 0 ? capabilities.update : capabilities.create;
      if (!actionAllowed) {
        denyAction("curriculumMessage", editingIndex >= 0 ? "修改" : "新增");
        return;
      }
      const files = Array.from($("curriculumFileInput")?.files || []);
      const inputName = normalizeName($("curriculumNameInput")?.value);
      const name = inputName || (files.length ? fileBaseName(files[0].name) : "");
      if (!name) {
        setText("curriculumMessage", "请填写资料名称，或先选择要上传的文件。");
        return;
      }
      const selectedGrade = $("curriculumGradeInput")?.value || "";
      if (isGradeRestricted && (!allowedGrades.length || !allowedGrades.includes(selectedGrade))) {
        setText("curriculumMessage", "当前账号只能上传自己负责年级的课程资料。");
        return;
      }
      const selectedType = $("curriculumTypeInput")?.value || "备课资料";
      const selectedOutlineCategory = normalizeOutlineCategory($("curriculumOutlineCategoryInput")?.value, selectedType);
      const selectedTeacherName = normalizeName($("curriculumTeacherInput")?.value) || "";
      const basePayload = {
        subject: normalizeSubjectForScope($("curriculumSubjectInput")?.value, selectedGrade),
        grade: selectedGrade || "-",
        outlineCategory: selectedOutlineCategory,
        teacherName: selectedTeacherName,
        season: normalizeSeason($("curriculumSeasonInput")?.value),
        track: $("curriculumTrackInput")?.value || "-",
        type: selectedOutlineCategory === defaultOutlineCategory ? selectedType : "课程大纲",
        classType: $("curriculumClassTypeInput")?.value || "-",
        lesson: normalizeText($("curriculumLessonInput")?.value) || "-",
        status: editingIndex >= 0 ? rows[editingIndex].status : "已录入",
        version: normalizeText($("curriculumVersionInput")?.value) || "V1.0",
        owner: normalizeName($("curriculumOwnerInput")?.value) || currentEmployee.name || "-",
        formula: normalizeText($("curriculumFormulaInput")?.value) || "",
        note: normalizeText($("curriculumNoteInput")?.value) || "-",
        updatedAt: nowText()
      };
      const uploadFiles = files.length ? files : [null];
      let addedCount = 0;
      let updatedCount = 0;
      try {
        for (const file of uploadFiles) {
          const rowName = inputName || (file ? fileBaseName(file.name) : name);
          const duplicateIndex = file ? findDuplicateCurriculumIndex({ ...basePayload, name: rowName }, file.name) : -1;
          const targetIndex = editingIndex >= 0 && uploadFiles.length === 1 ? editingIndex : duplicateIndex;
          const existing = targetIndex >= 0 ? rows[targetIndex] : {};
          const nextVersion = targetIndex >= 0 ? bumpVersion(existing.version || basePayload.version) : basePayload.version;
          const rowBase = {
            ...existing,
            ...basePayload,
            name: rowName,
            version: nextVersion,
            createdAt: existing.createdAt || nowText()
          };
          const filePayload = await selectedFilePayload(existing, rowBase, file);
          const payload = {
            ...rowBase,
            ...filePayload,
            versionHistory: targetIndex >= 0
              ? [
                  ...(Array.isArray(existing.versionHistory) ? existing.versionHistory : []),
                  {
                    version: existing.version || "V1.0",
                    fileName: existing.fileName || "",
                    updatedAt: existing.updatedAt || existing.createdAt || nowText()
                  }
                ].slice(-10)
              : (Array.isArray(existing.versionHistory) ? existing.versionHistory : [])
          };
          if (targetIndex >= 0) {
            rows[targetIndex] = payload;
            updatedCount += 1;
          } else {
            rows.unshift(payload);
            addedCount += 1;
          }
        }
      } catch (error) {
        setText("curriculumMessage", error.message || "文件读取失败。");
        return;
      }
      recordAudit(moduleKey, addedCount && updatedCount ? "批量保存" : updatedCount ? "更新" : "新增", name, `新增 ${addedCount} 条 / 更新 ${updatedCount} 条`);
      setText("curriculumMessage", `已保存：新增 ${addedCount} 条，更新 ${updatedCount} 条。重复资料已自动升级版本。`);
      writeStore(key, rows);
      applyTeacherOptions();
      updateCurriculumFilterControls();
      resetForm();
      render();
    });
    $("curriculumFilterInput")?.addEventListener("input", render);
    document.querySelectorAll("[data-outline-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        const category = normalizeOutlineCategory(button.getAttribute("data-outline-filter"), "课程大纲");
        activeOutlineFilter = category;
        updateCurriculumFilterControls();
        if ($("curriculumOutlineCategoryInput")) $("curriculumOutlineCategoryInput").value = category;
        if ($("curriculumTypeInput")) $("curriculumTypeInput").value = "课程大纲";
        render();
        setText("curriculumMessage", `已切换到：${category}。可继续按季节和年级查看，或在右侧上传大纲。`);
      });
    });
    $("curriculumOutlineFilter")?.addEventListener("change", render);
    $("curriculumTeacherFilter")?.addEventListener("change", render);
    $("curriculumSeasonFilter")?.addEventListener("change", render);
    $("curriculumGradeFilter")?.addEventListener("change", render);
    $("curriculumOutlineCategoryInput")?.addEventListener("change", () => {
      if ($("curriculumOutlineCategoryInput").value !== defaultOutlineCategory && $("curriculumTypeInput")) {
        $("curriculumTypeInput").value = "课程大纲";
      }
      applyTeacherOptions();
    });
    $("curriculumSortSelect")?.addEventListener("change", render);
    $("curriculumExportButton")?.addEventListener("click", () => guardAction(capabilities.export, "curriculumMessage", "导出", () => downloadCsv("教研与课程产品数据.csv", visibleRows(), [
      { label: "资料名称", value: "name" },
      { label: "学科/年级", value: "subject" },
      { label: "年级", value: "grade" },
      { label: "大纲板块", value: "outlineCategory" },
      { label: "授课老师", value: "teacherName" },
      { label: "季节", value: "season" },
      { label: "课程体系", value: "track" },
      { label: "资料类型", value: "type" },
      { label: "适用班型", value: "classType" },
      { label: "课次/专题", value: "lesson" },
      { label: "状态", value: "status" },
      { label: "版本", value: "version" },
      { label: "负责人", value: "owner" },
      { label: "公式/定义/核心重点", value: "formula" },
      { label: "文件名", value: "fileName" },
      { label: "文件大小", value: (row) => row.fileName ? formatFileSize(row.fileSize) : "" },
      { label: "文件地址", value: "fileUrl" },
      { label: "存储方式", value: "storageKind" },
      { label: "说明", value: "note" },
      { label: "创建时间", value: "createdAt" }
    ])));
    $("curriculumResetButton")?.addEventListener("click", () => {
      if (!capabilities.reset) {
        denyAction("curriculumMessage", "清空");
        return;
      }
      markRowsDeleted(key, rows);
      rows = [];
      writeStore(key, rows, { restoreDeleted: false });
      recordAudit(moduleKey, "清空", "教研课程台账", "0 条");
      resetForm();
      render();
      setText("curriculumMessage", "已清空本页台账。后续可新增或导入真实课程资料。");
    });
    bindRowActions("curriculumTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("curriculumSaveButton", "保存修改");
        setText("curriculumMessage", `正在编辑 ${rows[index].name}。`);
      },
      onDelete(index) {
        const removed = rows[index];
        markRowDeleted(key, removed);
        rows.splice(index, 1);
        writeStore(key, rows, { restoreDeleted: false });
        recordAudit(moduleKey, "删除", removed.name, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("curriculumMessage", `已删除 ${removed.name}。`);
      }
    }, capabilities, "curriculumMessage");
    $("curriculumTableBody")?.addEventListener("click", async (event) => {
      const previewButton = event.target.closest("[data-preview-curriculum]");
      if (previewButton) {
        const index = Number(previewButton.getAttribute("data-preview-curriculum"));
        await previewCurriculumImage(rows[index], previewButton);
        return;
      }
      const button = event.target.closest("[data-download-curriculum]");
      if (!button) return;
      const index = Number(button.getAttribute("data-download-curriculum"));
      const row = rows[index];
      if (!row?.fileName) {
        setText("curriculumMessage", "这条资料还没有上传文件。");
        return;
      }
      if (row.fileDataUrl) {
        downloadDataUrl(row.fileName, row.fileDataUrl);
        setText("curriculumMessage", `正在下载 ${row.fileName}。`);
        return;
      }
      if (!row.fileStorageKey && !row.fileUrl) {
        setText("curriculumMessage", "这条资料只有文件名，还没有上传文件内容。");
        return;
      }
      if (!window.JRC_CLOUD?.downloadCurriculumFile) {
        setText("curriculumMessage", "当前环境暂时不能下载云端文件。");
        return;
      }
      try {
        button.disabled = true;
        setText("curriculumMessage", `正在下载 ${row.fileName}...`);
        const result = await window.JRC_CLOUD.downloadCurriculumFile(row);
        if (!result.ok || !result.blob) {
          setText("curriculumMessage", "下载失败，请刷新后重试。");
          return;
        }
        downloadBlob(row.fileName, result.blob);
        setText("curriculumMessage", `正在下载 ${row.fileName}。`);
      } catch (error) {
        setText("curriculumMessage", error.message || "下载失败。");
      } finally {
        button.disabled = false;
      }
    });
    $("curriculumPreviewCloseButton")?.addEventListener("click", closeCurriculumPreview);
    $("curriculumPreviewZoomOutButton")?.addEventListener("click", () => setCurriculumPreviewZoom(curriculumPreviewZoom - 0.25));
    $("curriculumPreviewZoomResetButton")?.addEventListener("click", () => setCurriculumPreviewZoom(1));
    $("curriculumPreviewZoomInButton")?.addEventListener("click", () => setCurriculumPreviewZoom(curriculumPreviewZoom + 0.25));
    $("curriculumPreviewModal")?.addEventListener("click", (event) => {
      if (event.target === $("curriculumPreviewModal")) closeCurriculumPreview();
    });
    bindTableImport({
      buttonId: "curriculumImportButton",
      inputId: "curriculumImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        rows = nextRows;
        writeStore(key, rows);
        applyTeacherOptions();
        updateCurriculumFilterControls();
        resetForm();
        render();
      },
      normalizeRow(row) {
        const name = normalizeName(readField(row, ["name", "资料名称", "课程名称", "名称"]));
        if (!name) return null;
        const grade = normalizeText(readField(row, ["grade", "年级", "适用年级"], "")) || "-";
        const subject = normalizeSubjectForScope(readField(row, ["subject", "学科", "年级", "学科 / 年级"], "-"), grade);
        const importedType = normalizeStatus(readField(row, ["type", "资料类型", "类型"], "备课资料"), ["课程大纲", "课件PDF", "讲义Word", "题目图片", "老师版答案", "板书照片", "题库", "备课资料", "其他"], "备课资料");
        const outlineCategory = normalizeOutlineCategory(readField(row, ["outlineCategory", "大纲板块", "授课大纲", "大纲分类"], ""), importedType);
        const teacherName = normalizeName(readField(row, ["teacherName", "授课老师", "老师", "任课老师", "主讲老师"], ""));
        const normalized = {
          name,
          subject,
          grade,
          outlineCategory,
          teacherName,
          season: normalizeSeason(readField(row, ["season", "季节", "学期", "课程季节"], "通用")),
          track: normalizeStatus(readField(row, ["track", "课程体系", "体系"], "课内体系"), ["课内体系", "培优体系", "奥数体系", "强基重高选拔体系"], "课内体系"),
          type: outlineCategory === defaultOutlineCategory ? importedType : "课程大纲",
          classType: normalizeText(readField(row, ["classType", "适用班型", "班型"], "-")) || "-",
          lesson: normalizeText(readField(row, ["lesson", "课次", "专题", "课次 / 专题"], "-")) || "-",
          status: normalizeStatus(readField(row, ["status", "状态"], "已录入"), ["待导入讲义", "待整理题库", "待上传资料", "已录入"], "已录入"),
          version: normalizeText(readField(row, ["version", "当前版本", "版本"], "V1.0")) || "V1.0",
          owner: normalizeName(readField(row, ["owner", "负责人"], "-")) || "-",
          formula: normalizeText(readField(row, ["formula", "公式", "公式/定义/核心重点", "核心重点"], "")),
          note: normalizeText(readField(row, ["note", "版本说明", "说明", "备注"], "-")) || "-",
          fileName: normalizeText(readField(row, ["fileName", "文件名", "附件"], "")),
          fileType: normalizeText(readField(row, ["fileType", "文件类型"], "")),
          fileSize: Number(readField(row, ["fileSize", "文件大小"], 0)) || 0,
          fileDataUrl: String(readField(row, ["fileDataUrl", "文件数据"], "")),
          fileUrl: String(readField(row, ["fileUrl", "文件地址"], "")),
          fileStorageKey: String(readField(row, ["fileStorageKey", "文件存储键"], "")),
          storageKind: String(readField(row, ["storageKind", "存储方式"], "")),
          createdAt: String(readField(row, ["createdAt", "创建时间", "时间"], nowText())),
          updatedAt: String(readField(row, ["updatedAt", "更新时间"], nowText()))
        };
        return rowVisibleToCurrentUser(normalized) ? normalized : null;
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "教研课程台账", `${count} 条`);
        renderAuditLog(moduleKey, "curriculumAuditTableBody");
        setText("curriculumMessage", `已导入 ${count} 条课程资料。`);
      },
      onError() {
        setText("curriculumMessage", "导入失败。请上传 CSV/TSV/JSON；Excel 可以先另存为 CSV。");
      },
      canUse: () => capabilities.import,
      onDenied: () => denyAction("curriculumMessage", "导入")
    });
    applyGradeOptions();
    applyTeacherOptions();
    updateCurriculumFilterControls();
    resetForm();
    render();
    setText("curriculumMessage", gradeScopeText());
    readCloudStore(key, (cloudRows) => {
      rows = mergeRowsById(sanitizeRows(cloudRows), key);
      if (rows.length !== cloudRows.length) writeStore(key, rows);
      applyTeacherOptions();
      updateCurriculumFilterControls();
      resetForm();
      render();
      setText("curriculumMessage", "已同步云端教研课程台账。");
    });
    applyCapabilityGate({
      canWrite: capabilities.create || capabilities.update,
      messageId: "curriculumMessage",
      buttonRules: [["curriculumSaveButton", capabilities.create || capabilities.update, "新增或修改"], ["curriculumImportButton", capabilities.import, "导入"], ["curriculumExportButton", capabilities.export, "导出"], ["curriculumResetButton", capabilities.reset, "清空"]],
      fieldIds: ["curriculumNameInput", "curriculumSubjectInput", "curriculumGradeInput", "curriculumOutlineCategoryInput", "curriculumTeacherInput", "curriculumSeasonInput", "curriculumTrackInput", "curriculumTypeInput", "curriculumClassTypeInput", "curriculumLessonInput", "curriculumVersionInput", "curriculumOwnerInput", "curriculumFileInput", "curriculumFormulaInput", "curriculumNoteInput"]
    });
  }

  function initHrTraining() {
    if (!$("hrTaskTableBody") && !$("hrSummerScheduleBody")) return;
    const moduleKey = "hr";
    const capabilities = moduleCapabilities(moduleKey);
    const key = "jrc-hr-training-tasks-v2";
    const roleDirectoryKey = "jrc-hr-role-directory-v1";
    const summerScheduleKey = "jrc-hr-summer-schedule-v1";
    const canViewHrPrivate = hasPermission("hr.access");
    const canEditSummerSchedule = () => {
      const operator = currentOperator();
      const name = normalizeName(operator.name);
      const username = normalizeText(operator.username).toLowerCase();
      return ["程志豪", "陈雨晴"].includes(name) || ["chengzhihao", "czh", "chenyuqing"].includes(username);
    };
    const defaults = {
      type: "入职",
      employee: "",
      system: "",
      status: "待处理",
      owner: currentOperator().name || "",
      next: "",
      note: ""
    };
    const departedEmployeePattern = /离职|停用|禁用|已离开|departed|inactive|disabled/i;
    const hrTypeGuides = {
      入职: {
        system: "统一登录、人事档案、权限、岗位排班",
        next: "补齐手机号、微信、岗位权限，确认入职日期和转正日期",
        notePlaceholder: "建议写清：入职日期、岗位、手机号/微信、初始权限、试用期安排、转正日期和培训安排。",
        hint: "<strong>入职事项怎么填：</strong>员工姓名可填写新员工；关联系统用于提醒创建登录账号、人事档案、岗位排班和基础权限；下一步写清还差哪些入职资料或权限；事项说明记录入职日期、岗位、试用期和培训安排。"
      },
      转正: {
        system: "人事档案、权限、财务",
        next: "核对入职日期和转正日期，确认薪资/提成/权限是否调整",
        notePlaceholder: "建议写清：原入职日期、转正日期、考核结论、薪资或提成是否调整、权限是否变化。",
        hint: "<strong>转正事项怎么填：</strong>员工姓名从在职名单选择；关联系统通常是人事档案、权限和财务；下一步写清是否需要调整工资、提成或权限；事项说明记录转正日期、考核结论和调整依据。"
      },
      离职: {
        system: "统一登录、权限、排课、财务、学生服务",
        next: "确认离职日期；停用账号权限；保留排课上课和本月结算记录",
        notePlaceholder: "建议写清：离职日期、最后上课/排课日期、账号权限停用、工作交接、财务结算月份和是否仍需保留历史排课/上课数据。",
        hint: "<strong>离职办理口径：</strong>员工姓名请从在职名单选择；关联系统用于提醒统一登录、权限、排课、财务、学生服务同步处理；下一步用于写清还差哪一步；事项说明记录离职日期、交接内容、账号停用和本月结算口径。"
      },
      权限调整: {
        system: "统一登录、系统权限",
        next: "确认需要开通或关闭的模块权限，并通知本人复核",
        notePlaceholder: "建议写清：调整原因、开通/关闭哪些系统、是否允许新增/编辑/导出、生效时间。",
        hint: "<strong>权限调整怎么填：</strong>员工姓名从在职名单选择；关联系统写需要变更的模块；下一步写清谁确认、何时生效；事项说明记录具体开通或关闭的权限，避免只写“调权限”。"
      },
      提成调整: {
        system: "财务、人事档案",
        next: "确认新提成口径、生效月份，并同步财务核算",
        notePlaceholder: "建议写清：调整前后提成口径、生效月份、适用课程/岗位、审批原因和财务同步方式。",
        hint: "<strong>提成调整怎么填：</strong>员工姓名从在职名单选择；关联系统重点写财务；下一步写清生效月份和谁复核；事项说明记录调整前后口径，方便月结对账。"
      },
      培训记录: {
        system: "人事培训、学管知识库",
        next: "归档培训主题、参训人、考核结果和后续补训安排",
        notePlaceholder: "建议写清：培训主题、培训时间、参训人员、考核结果、是否需要补训或复盘。",
        hint: "<strong>培训记录怎么填：</strong>员工姓名可填个人，也可以填小组；关联系统通常是人事培训和知识库；下一步写清是否还要补训、考核或复盘；事项说明记录培训主题、结果和后续要求。"
      }
    };

    function employeeStatusText(employee) {
      return normalizeText([
        employee?.status,
        employee?.employmentStatus,
        employee?.workStatus,
        employee?.employeeStatus,
        employee?.accountStatus
      ].filter(Boolean).join(" "));
    }

    function isActiveHrEmployee(employee) {
      const name = normalizeName(employee?.name);
      if (!name) return false;
      const statusText = employeeStatusText(employee);
      return !departedEmployeePattern.test(statusText);
    }

    function activeHrEmployees() {
      return (Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [])
        .filter(isActiveHrEmployee)
        .sort((left, right) => normalizeName(left.name).localeCompare(normalizeName(right.name), "zh-CN"));
    }

    function renderHrEmployeeOptions() {
      const datalist = $("hrActiveEmployeeOptions");
      if (!datalist) return;
      datalist.innerHTML = activeHrEmployees().map((employee) => {
        const name = normalizeName(employee.name);
        const meta = [employee.role, employee.subject, employee.scope].map(normalizeText).filter(Boolean).join(" / ");
        return `<option value="${escapeHtml(name)}"${meta ? ` label="${escapeHtml(meta)}"` : ""}></option>`;
      }).join("");
    }

    function matchActiveHrEmployee(name) {
      const target = normalizeName(name);
      if (!target) return null;
      return activeHrEmployees().find((employee) => normalizeName(employee.name) === target) || null;
    }

    function buildOffboardingChecklist(employee) {
      return [
        { key: "account", label: "停用账号和系统权限", done: false },
        { key: "directory", label: "确认可以从在职员工名单移出", done: false },
        { key: "schedule", label: "检查未来排课并改派/取消", done: false },
        { key: "history", label: "保留历史排课、点名、上课记录", done: true },
        { key: "finance", label: "生成本月离职结算提醒", done: false },
        { key: "handover", label: "确认学生服务、资料和未完成事项交接", done: false }
      ].map((item) => ({ ...item, employee, updatedAt: item.done ? nowText() : "" }));
    }

    function offboardingProgress(row) {
      const checklist = Array.isArray(row?.offboardingChecklist) ? row.offboardingChecklist : [];
      if (!checklist.length) return "";
      const done = checklist.filter((item) => item.done).length;
      return `离职流程 ${done}/${checklist.length}`;
    }

    function isOffboardingReady(row) {
      const checklist = Array.isArray(row?.offboardingChecklist) ? row.offboardingChecklist : [];
      return row?.type === "离职" && checklist.length > 0 && checklist.every((item) => item.done);
    }

    function renderOffboardingChecklist(row, index) {
      if (row?.type !== "离职") return "";
      const checklist = Array.isArray(row.offboardingChecklist) && row.offboardingChecklist.length
        ? row.offboardingChecklist
        : buildOffboardingChecklist(row.employee || "");
      const ready = checklist.every((item) => item.done);
      return `
        <div style="margin-top:8px; display:grid; gap:6px;">
          ${checklist.map((item, itemIndex) => `
            <label style="display:flex; gap:6px; align-items:flex-start; color:#637083;">
              <input type="checkbox" data-hr-offboard="${index}" data-offboard-item="${itemIndex}" ${item.done ? "checked" : ""}>
              <span>${escapeHtml(item.label)}${item.updatedAt ? `｜${escapeHtml(item.updatedAt)}` : ""}</span>
            </label>
          `).join("")}
          ${ready && row.status !== "已完成" ? `<button type="button" data-hr-complete-offboard="${index}" style="width:max-content; min-height:32px; padding:0 12px; border-radius:999px; border:1px solid rgba(15,118,110,0.18); background:rgba(15,118,110,0.10); color:#0f766e; cursor:pointer;">完成离职并归档</button>` : ""}
          ${row.status === "已完成" ? `<span class="tag green">离职已完成归档</span>` : ""}
        </div>
      `;
    }

    function updateHrTypeGuidance(options = {}) {
      const type = $("hrTypeInput")?.value || "入职";
      const flowHint = $("hrFlowHint");
      const systemInput = $("hrSystemInput");
      const nextInput = $("hrNextInput");
      const noteInput = $("hrNoteInput");
      const guide = hrTypeGuides[type] || hrTypeGuides.培训记录;
      if (systemInput && (!systemInput.value.trim() || options.forceDefaults)) {
        systemInput.value = guide.system;
      }
      if (nextInput && (!nextInput.value.trim() || options.forceDefaults)) {
        nextInput.value = guide.next;
      }
      if (noteInput) noteInput.placeholder = guide.notePlaceholder;
      if (flowHint) flowHint.innerHTML = guide.hint;
    }

    function applyHrVisibility() {
      document.querySelectorAll("[data-hr-private]").forEach((node) => {
        node.hidden = !canViewHrPrivate;
      });
    }

    function initSummerSchedule() {
      const body = $("hrSummerScheduleBody");
      const roleBoard = $("hrRoleBoard");
      if (!body && !roleBoard) return;
      const canEdit = canEditSummerSchedule();
      const editor = $("hrSummerEditorPanel");
      const editorToggle = $("hrSummerEditorToggle");
      const roleEditor = $("hrRoleEditorPanel");
      const roleEditorToggle = $("hrRoleEditorToggle");
      const roleAdminToolbar = $("hrRoleAdminToolbar");
      const roleTableWrap = $("hrRoleTableWrap");
      if (editor) editor.hidden = true;
      if (roleEditor) roleEditor.hidden = true;
      if (roleAdminToolbar) roleAdminToolbar.hidden = !canEdit;
      if (roleTableWrap) roleTableWrap.hidden = !canEdit;
      if (editorToggle) {
        editorToggle.hidden = !canEdit;
        editorToggle.addEventListener("click", () => {
          if (!editor) return;
          editor.hidden = !editor.hidden;
          setText("hrSummerEditorToggle", editor.hidden ? "编辑排班" : "收起编辑");
        });
      }
      if (roleEditorToggle) {
        roleEditorToggle.addEventListener("click", () => {
          if (!roleEditor) return;
          roleEditor.hidden = !roleEditor.hidden;
          setText("hrRoleEditorToggle", roleEditor.hidden ? "新增岗位" : "收起编辑");
        });
      }
      const editorMessage = canEdit
        ? "当前为展示模式；需要维护时点击“编辑排班”。"
        : "岗位排班表对全员开放查看；只有陈雨晴和程志豪可以修改。";
      setText("hrSummerMessage", editorMessage);
      setText("hrRoleMessage", canEdit
        ? "岗位设置对全员展示；你可以在这里维护岗位、人员和状态。"
        : "岗位设置对全员展示；只有陈雨晴和程志豪可以新增、修改和删除。");
      let roleRows = mergeRowsById(readStore(roleDirectoryKey, []), roleDirectoryKey);
      let summerRows = mergeRowsById(readStore(summerScheduleKey, []), summerScheduleKey);
      let editingRoleIndex = -1;
      let editingSummerIndex = -1;
      let activeSummerRole = "";
      let currentRoleMembers = [];

      function uniqueNames(values) {
        return [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeName(value)).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right, "zh-CN"));
      }

      function roleTitleOf(row) {
        return normalizeText(row?.title || row?.role);
      }

      function roleDescriptionOf(row) {
        return normalizeText(row?.description || row?.note);
      }

      function roleMemberListOf(row) {
        return uniqueNames(Array.isArray(row?.members)
          ? row.members
          : String(row?.membersText || row?.employee || "")
            .split(/[、,，/]+/));
      }

      function scheduleRoleCounts() {
        const counts = new Map();
        summerRows.forEach((row) => {
          const role = normalizeText(row?.role);
          if (!role) return;
          counts.set(role, (counts.get(role) || 0) + 1);
        });
        return counts;
      }

      function syncRoleEmployeeOptions() {
        const datalist = $("hrRoleEmployeeOptions");
        if (!datalist) return;
        datalist.innerHTML = activeHrEmployees().map((employee) => {
          const name = normalizeName(employee.name);
          const meta = [employee.role, employee.subject, employee.scope].map(normalizeText).filter(Boolean).join(" / ");
          return `<option value="${escapeHtml(name)}"${meta ? ` label="${escapeHtml(meta)}"` : ""}></option>`;
        }).join("");
      }

      function syncRoleNameOptions() {
        const datalist = $("hrRoleNameOptions");
        if (!datalist) return;
        const names = new Set();
        roleRows.forEach((row) => {
          const name = roleTitleOf(row);
          if (name) names.add(name);
        });
        summerRows.forEach((row) => {
          const name = normalizeText(row?.role);
          if (name) names.add(name);
        });
        datalist.innerHTML = [...names].sort((left, right) => left.localeCompare(right, "zh-CN"))
          .map((name) => `<option value="${escapeHtml(name)}"></option>`)
          .join("");
      }

      function findRoleRowByTitle(title) {
        const normalized = normalizeText(title);
        if (!normalized) return null;
        return roleRows.find((row) => roleTitleOf(row) === normalized) || null;
      }

      function renderSelectedRoleMembers() {
        const container = $("hrRoleSelectedMembers");
        if (!container) return;
        if (!currentRoleMembers.length) {
          container.innerHTML = `<span style="color:#637083; font-size:12px;">还没有添加人员。输入老师姓名后点击“加入人员”。</span>`;
          return;
        }
        container.innerHTML = currentRoleMembers.map((name) => `
          <span class="person-chip">
            ${escapeHtml(name)}
            <button type="button" data-role-member-remove="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}">×</button>
          </span>
        `).join("");
      }

      function resetRoleForm() {
        ["hrRoleTitleInput", "hrRoleLocationInput", "hrRoleDescriptionInput", "hrRoleMemberInput"].forEach((id) => {
          const node = $(id);
          if (node) node.value = "";
        });
        const statusInput = $("hrRoleStatusInput");
        if (statusInput) statusInput.value = "启用";
        currentRoleMembers = [];
        editingRoleIndex = -1;
        renderSelectedRoleMembers();
        setText("hrRoleSaveButton", "保存岗位设置");
      }

      function closeRoleEditor() {
        if (roleEditor) roleEditor.hidden = true;
        setText("hrRoleEditorToggle", "新增岗位");
        resetRoleForm();
      }

      function openRoleEditor(row, index) {
        if (!roleEditor) return;
        roleEditor.hidden = false;
        setText("hrRoleEditorToggle", "收起编辑");
        $("hrRoleTitleInput").value = roleTitleOf(row) || "";
        $("hrRoleLocationInput").value = normalizeText(row?.location) || "";
        $("hrRoleStatusInput").value = normalizeText(row?.status) || "启用";
        $("hrRoleDescriptionInput").value = roleDescriptionOf(row) || "";
        $("hrRoleMemberInput").value = "";
        currentRoleMembers = roleMemberListOf(row);
        editingRoleIndex = index;
        renderSelectedRoleMembers();
        setText("hrRoleSaveButton", "保存修改");
      }

      function clearSummerForm() {
        ["hrSummerDateInput", "hrSummerTimeInput", "hrSummerEmployeeInput", "hrSummerRoleInput", "hrSummerLocationInput", "hrSummerNoteInput"].forEach((id) => {
          const node = $(id);
          if (node) node.value = "";
        });
        editingSummerIndex = -1;
        setText("hrSummerSaveButton", "保存排班");
      }

      function sortedRoleEntries() {
        return roleRows
          .map((row, index) => ({ row, index }))
          .sort((left, right) => {
            const leftStatus = normalizeText(left.row?.status) === "停用" ? 1 : 0;
            const rightStatus = normalizeText(right.row?.status) === "停用" ? 1 : 0;
            return leftStatus - rightStatus || roleTitleOf(left.row).localeCompare(roleTitleOf(right.row), "zh-CN");
          });
      }

      function renderRoleBoard() {
        if (!roleBoard) return;
        const entries = sortedRoleEntries();
        const counts = scheduleRoleCounts();
        if (!entries.length) {
          const scheduleRoles = [...counts.keys()];
          roleBoard.innerHTML = `<div class="role-empty">${scheduleRoles.length
            ? `当前排班里已经出现 ${scheduleRoles.length} 个岗位名称，但还没有正式岗位设置。建议点击“新增岗位”把长期岗位和负责人补齐。`
            : "暂无岗位设置。新增后，这里会展示岗位名称、当前人员和状态。"
          }</div>`;
          return;
        }
        roleBoard.innerHTML = [
          `
            <button type="button" class="role-card ${!activeSummerRole ? "active" : ""}" data-role-filter="">
              <div class="role-card-head">
                <span class="role-card-title">全部岗位</span>
                <span class="tag green">${entries.length} 个岗位</span>
              </div>
              <p>查看全部岗位，并同时查看下面所有排班安排。</p>
            </button>
          `,
          ...entries.map(({ row }) => {
            const title = roleTitleOf(row) || "未命名岗位";
            const members = roleMemberListOf(row);
            const location = normalizeText(row?.location);
            const description = roleDescriptionOf(row);
            const status = normalizeText(row?.status) || "启用";
            const scheduleCount = counts.get(title) || 0;
            return `
              <button type="button" class="role-card ${activeSummerRole === title ? "active" : ""}" data-role-filter="${escapeHtml(title)}">
                <div class="role-card-head">
                  <span class="role-card-title">${escapeHtml(title)}</span>
                  ${status === "停用" ? `<span class="tag">停用</span>` : `<span class="tag green">${members.length || 0} 人</span>`}
                </div>
                <div class="person-row" style="margin-top:10px;">
                  ${members.length ? members.map((name) => `<span class="person-chip">${escapeHtml(name)}</span>`).join("") : `<span class="person-chip">暂未安排</span>`}
                </div>
                <p>${location ? `地点：${escapeHtml(location)}` : "地点待补充"}${scheduleCount ? `｜排班 ${scheduleCount} 条` : "｜暂无排班"}${description ? `<br>${escapeHtml(description)}` : ""}</p>
              </button>
            `;
          })
        ].join("");
      }

      function renderRoleTable() {
        const tableBody = $("hrRoleTableBody");
        if (!tableBody) return;
        const entries = sortedRoleEntries();
        tableBody.innerHTML = entries.length ? entries.map(({ row, index }) => `
          <tr>
            <td><strong>${escapeHtml(roleTitleOf(row) || "-")}</strong></td>
            <td>${roleMemberListOf(row).length ? roleMemberListOf(row).map((name) => `<span class="person-chip">${escapeHtml(name)}</span>`).join("") : "-"}</td>
            <td>${escapeHtml(normalizeText(row?.location) || "-")}</td>
            <td>${normalizeText(row?.status) === "停用" ? tag("停用", "warn") : tag("启用", "good")}</td>
            <td>${escapeHtml(roleDescriptionOf(row) || "-")}</td>
            <td>${canEdit ? actionButtons(index, { update: true, delete: true }) : tag("仅查看", "neutral")}</td>
          </tr>
        `).join("") : `<tr><td colspan="6">暂无岗位设置。新增后，这里会形成长期岗位台账。</td></tr>`;
      }

      function renderRoleViews() {
        syncRoleEmployeeOptions();
        syncRoleNameOptions();
        renderSelectedRoleMembers();
        renderRoleBoard();
        renderRoleTable();
      }

      function sortedSummerEntries() {
        const keyword = $("hrSummerFilterInput")?.value.trim().toLowerCase() || "";
        return summerRows
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => {
            const matchesKeyword = rowMatches(row, keyword);
            const matchesRole = !activeSummerRole || normalizeText(row.role) === activeSummerRole;
            return matchesKeyword && matchesRole;
          })
          .sort((left, right) => {
            const leftKey = `${left.row.date || ""} ${left.row.time || ""}`;
            const rightKey = `${right.row.date || ""} ${right.row.time || ""}`;
            return leftKey.localeCompare(rightKey, "zh-CN") || String(left.row.employee || "").localeCompare(String(right.row.employee || ""), "zh-CN");
          });
      }

      function renderSummerSchedule() {
        const entries = sortedSummerEntries();
        body.innerHTML = entries.length ? entries.map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.date || "-")}</td>
            <td>${escapeHtml(row.time || "-")}</td>
            <td><strong>${escapeHtml(row.employee || "-")}</strong></td>
            <td>${escapeHtml(row.role || "-")}</td>
            <td>${escapeHtml(row.location || "-")}</td>
            <td>${escapeHtml(row.note || "-")}</td>
            <td>${canEdit ? actionButtons(index, { update: true, delete: true }) : tag("仅查看", "neutral")}</td>
          </tr>
        `).join("") : `<tr><td colspan="7">${activeSummerRole ? `当前岗位“${escapeHtml(activeSummerRole)}”暂无符合条件的排班记录。` : "暂无岗位排班记录。陈雨晴或程志豪录入后，所有老师都可以在这里查询。"}</td></tr>`;
      }

      function applyRoleDefaultsToSchedule() {
        const roleName = normalizeText($("hrSummerRoleInput")?.value);
        const roleRow = findRoleRowByTitle(roleName);
        if (!roleRow) return;
        const locationInput = $("hrSummerLocationInput");
        if (locationInput && !normalizeText(locationInput.value)) {
          locationInput.value = normalizeText(roleRow.location) || "";
        }
      }

      $("hrRoleAddMemberButton")?.addEventListener("click", () => {
        if (!canEdit) {
          setText("hrRoleMessage", "当前账号只能查看岗位设置，不能修改。");
          return;
        }
        const input = $("hrRoleMemberInput");
        const rawName = normalizeName(input?.value);
        if (!rawName) {
          setText("hrRoleMessage", "请先输入要加入岗位的老师姓名。");
          return;
        }
        const matched = matchActiveHrEmployee(rawName);
        if (activeHrEmployees().length && !matched) {
          setText("hrRoleMessage", "请从在职员工名单里选择完整姓名后再加入。");
          return;
        }
        const employeeName = normalizeName(matched?.name || rawName);
        if (currentRoleMembers.includes(employeeName)) {
          setText("hrRoleMessage", `${employeeName} 已经在当前岗位人员里了。`);
          return;
        }
        currentRoleMembers = uniqueNames([...currentRoleMembers, employeeName]);
        if (input) input.value = "";
        renderSelectedRoleMembers();
        setText("hrRoleMessage", `已把 ${employeeName} 加入当前岗位人员。`);
      });
      $("hrRoleMemberInput")?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        $("hrRoleAddMemberButton")?.click();
      });
      $("hrRoleSelectedMembers")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-role-member-remove]");
        if (!button) return;
        const targetName = normalizeName(button.getAttribute("data-role-member-remove"));
        currentRoleMembers = currentRoleMembers.filter((name) => name !== targetName);
        renderSelectedRoleMembers();
        setText("hrRoleMessage", `已移除 ${targetName}。`);
      });
      $("hrRoleBoard")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-role-filter]");
        if (!button) return;
        activeSummerRole = normalizeText(button.getAttribute("data-role-filter"));
        renderRoleBoard();
        renderSummerSchedule();
      });
      $("hrRoleSaveButton")?.addEventListener("click", () => {
        if (!canEdit) {
          setText("hrRoleMessage", "当前账号只能查看岗位设置，不能修改。");
          return;
        }
        const title = normalizeText($("hrRoleTitleInput")?.value);
        if (!title) {
          setText("hrRoleMessage", "请先填写岗位名称。");
          return;
        }
        const payload = {
          title,
          role: title,
          location: normalizeText($("hrRoleLocationInput")?.value) || "-",
          status: normalizeText($("hrRoleStatusInput")?.value) || "启用",
          description: normalizeText($("hrRoleDescriptionInput")?.value) || "-",
          note: normalizeText($("hrRoleDescriptionInput")?.value) || "-",
          members: uniqueNames(currentRoleMembers),
          membersText: uniqueNames(currentRoleMembers).join("、"),
          employee: uniqueNames(currentRoleMembers).join("、"),
          updatedAt: nowText(),
          updatedBy: currentOperator().name || ""
        };
        const previousTitle = editingRoleIndex >= 0 ? roleTitleOf(roleRows[editingRoleIndex]) : "";
        if (editingRoleIndex >= 0) {
          roleRows[editingRoleIndex] = {
            ...roleRows[editingRoleIndex],
            ...payload,
            createdAt: roleRows[editingRoleIndex].createdAt || nowText(),
            createdBy: roleRows[editingRoleIndex].createdBy || currentOperator().name || ""
          };
          if (previousTitle && previousTitle !== payload.title) {
            const relatedSchedules = summerRows.filter((row) => normalizeText(row.role) === previousTitle);
            if (relatedSchedules.length && window.confirm(`岗位名称已从“${previousTitle}”改为“${payload.title}”。是否把现有 ${relatedSchedules.length} 条排班明细里的岗位名称一起改掉？`)) {
              summerRows = summerRows.map((row) => normalizeText(row.role) === previousTitle
                ? { ...row, role: payload.title, updatedAt: nowText(), updatedBy: currentOperator().name || "" }
                : row);
              writeStore(summerScheduleKey, summerRows);
            }
          }
          if (activeSummerRole === previousTitle && previousTitle !== payload.title) activeSummerRole = payload.title;
          recordAudit(moduleKey, "更新岗位设置", title, payload.membersText || "未安排人员");
          setText("hrRoleMessage", `已更新岗位“${title}”。`);
        } else {
          roleRows.unshift({
            ...payload,
            createdAt: nowText(),
            createdBy: currentOperator().name || ""
          });
          recordAudit(moduleKey, "新增岗位设置", title, payload.membersText || "未安排人员");
          setText("hrRoleMessage", `已新增岗位“${title}”。`);
        }
        writeStore(roleDirectoryKey, roleRows);
        renderRoleViews();
        renderSummerSchedule();
        closeRoleEditor();
      });
      $("hrRoleCancelButton")?.addEventListener("click", () => {
        closeRoleEditor();
        setText("hrRoleMessage", "已取消岗位设置编辑。");
      });
      bindRowActions("hrRoleTableBody", {
        onEdit(index) {
          if (!canEdit) return;
          openRoleEditor(roleRows[index], index);
          setText("hrRoleMessage", `正在编辑岗位“${roleTitleOf(roleRows[index]) || "未命名岗位"}”。`);
        },
        onDelete(index) {
          if (!canEdit) return;
          const row = roleRows[index];
          const title = roleTitleOf(row) || "未命名岗位";
          const relatedScheduleCount = summerRows.filter((scheduleRow) => normalizeText(scheduleRow.role) === title).length;
          if (!window.confirm(`确定删除岗位“${title}”吗？${relatedScheduleCount ? ` 当前还有 ${relatedScheduleCount} 条排班在使用这个岗位名，删除岗位设置不会删除排班明细。` : ""}`)) return;
          markRowDeleted(roleDirectoryKey, row);
          roleRows.splice(index, 1);
          writeStore(roleDirectoryKey, roleRows, { restoreDeleted: false });
          recordAudit(moduleKey, "删除岗位设置", title, relatedScheduleCount ? `保留 ${relatedScheduleCount} 条历史排班` : "无关联排班");
          if (activeSummerRole === title && !relatedScheduleCount) activeSummerRole = "";
          closeRoleEditor();
          renderRoleViews();
          renderSummerSchedule();
          setText("hrRoleMessage", `已删除岗位“${title}”。`);
        }
      }, { update: canEdit, delete: canEdit }, "hrRoleMessage");

      $("hrSummerSaveButton")?.addEventListener("click", () => {
        if (!canEdit) {
          setText("hrSummerMessage", "当前账号只能查看岗位排班，不能修改。");
          return;
        }
        const employee = normalizeName($("hrSummerEmployeeInput")?.value);
        const date = normalizeText($("hrSummerDateInput")?.value);
        const time = normalizeText($("hrSummerTimeInput")?.value);
        if (!employee || !date || !time) {
          setText("hrSummerMessage", "请至少填写日期、时间段和员工姓名。");
          return;
        }
        const payload = {
          date,
          time,
          employee,
          role: normalizeText($("hrSummerRoleInput")?.value) || "岗位排班",
          location: normalizeText($("hrSummerLocationInput")?.value) || "-",
          note: normalizeText($("hrSummerNoteInput")?.value) || "-",
          updatedAt: nowText(),
          updatedBy: currentOperator().name || ""
        };
        if (editingSummerIndex >= 0) {
          summerRows[editingSummerIndex] = {
            ...summerRows[editingSummerIndex],
            ...payload,
            createdAt: summerRows[editingSummerIndex].createdAt || nowText()
          };
          recordAudit(moduleKey, "更新岗位排班", employee, `${date} ${time}`);
          setText("hrSummerMessage", `已更新 ${employee} 的岗位排班。`);
        } else {
          summerRows.unshift({
            ...payload,
            createdAt: nowText(),
            createdBy: currentOperator().name || ""
          });
          recordAudit(moduleKey, "新增岗位排班", employee, `${date} ${time}`);
          setText("hrSummerMessage", `已新增 ${employee} 的岗位排班。`);
        }
        writeStore(summerScheduleKey, summerRows);
        clearSummerForm();
        renderRoleViews();
        renderSummerSchedule();
      });

      $("hrSummerCancelButton")?.addEventListener("click", clearSummerForm);
      $("hrSummerFilterInput")?.addEventListener("input", renderSummerSchedule);
      $("hrSummerRoleInput")?.addEventListener("change", applyRoleDefaultsToSchedule);
      $("hrSummerExportButton")?.addEventListener("click", () => downloadCsv("岗位排班表.csv", summerRows, [
        { label: "日期", value: "date" },
        { label: "时间段", value: "time" },
        { label: "员工", value: "employee" },
        { label: "岗位/任务", value: "role" },
        { label: "校区/地点", value: "location" },
        { label: "备注", value: "note" },
        { label: "更新时间", value: "updatedAt" },
        { label: "更新人", value: "updatedBy" }
      ]));
      bindRowActions("hrSummerScheduleBody", {
        onEdit(index) {
          if (!canEdit) return;
          const row = summerRows[index];
          $("hrSummerDateInput").value = row.date || "";
          $("hrSummerTimeInput").value = row.time || "";
          $("hrSummerEmployeeInput").value = row.employee || "";
          $("hrSummerRoleInput").value = row.role || "";
          $("hrSummerLocationInput").value = row.location || "";
          $("hrSummerNoteInput").value = row.note || "";
          editingSummerIndex = index;
          if (editor) editor.hidden = false;
          setText("hrSummerEditorToggle", "收起编辑");
          setText("hrSummerSaveButton", "保存修改");
          setText("hrSummerMessage", `正在编辑 ${row.employee || "员工"} 的岗位排班。`);
        },
        onDelete(index) {
          if (!canEdit) return;
          const row = summerRows[index];
          if (!window.confirm(`确定删除 ${row.employee || "该员工"} ${row.date || ""} ${row.time || ""} 的排班吗？`)) return;
          markRowDeleted(summerScheduleKey, row);
          summerRows.splice(index, 1);
          writeStore(summerScheduleKey, summerRows, { restoreDeleted: false });
          recordAudit(moduleKey, "删除岗位排班", row.employee || "-", `${row.date || ""} ${row.time || ""}`);
          clearSummerForm();
          renderRoleViews();
          renderSummerSchedule();
          setText("hrSummerMessage", "已删除该岗位排班。");
        }
      }, { update: canEdit, delete: canEdit }, "hrSummerMessage");

      renderRoleViews();
      renderSummerSchedule();
      readCloudStore(roleDirectoryKey, (cloudRows) => {
        roleRows = mergeRowsById(cloudRows, roleDirectoryKey);
        renderRoleViews();
        renderSummerSchedule();
        setText("hrRoleMessage", canEdit ? "已同步云端岗位设置，可继续维护。" : "已同步云端岗位设置。");
      });
      readCloudStore(summerScheduleKey, (cloudRows) => {
        summerRows = mergeRowsById(cloudRows, summerScheduleKey);
        renderRoleViews();
        renderSummerSchedule();
        setText("hrSummerMessage", canEdit ? "已同步云端岗位排班表；需要维护时点击“编辑排班”。" : "已同步云端岗位排班表。");
      });
    }

    applyHrVisibility();
    initSummerSchedule();
    if (!canViewHrPrivate || !$("hrTaskTableBody")) return;

    function sanitizeRows(input) {
      const oldSeedTypes = ["员工基础档案核对", "系统权限分组", "培训记录归档"];
      return (Array.isArray(input) ? input : []).filter((row) => !oldSeedTypes.includes(row.type));
    }
    let rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
    let editingIndex = -1;

    function fillForm(row) {
      $("hrTypeInput").value = row.type || "培训记录";
      $("hrEmployeeInput").value = row.employee || "";
      $("hrSystemInput").value = row.system || "";
      $("hrStatusInput").value = row.status || "待处理";
      $("hrOwnerInput").value = row.owner || "";
      $("hrNextInput").value = row.next || "";
      $("hrNoteInput").value = row.note || "";
      updateHrTypeGuidance();
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("hrSaveButton", "保存人事管理事项");
      updateHrTypeGuidance();
    }

    function buildRegularizationReminders(employees) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const remindDays = 30;
      const remindEnd = new Date(today);
      remindEnd.setDate(remindEnd.getDate() + remindDays);
      return (Array.isArray(employees) ? employees : [])
        .map((employee) => {
          const name = normalizeName(employee?.name);
          if (!name) return null;
          const hireDate = formatDateOnly(employee?.hireDate);
          const regularDate = formatDateOnly(employee?.regularDate);
          if (!hireDate || !regularDate) {
            const missing = [
              !hireDate ? "入职日期" : "",
              !regularDate ? "转正日期" : ""
            ].filter(Boolean).join("、");
            return {
              name,
              reason: `未填${missing}`,
              sortTime: 0,
              type: "missing"
            };
          }
          const regularTime = parseDateValue(regularDate);
          if (!regularTime) {
            return {
              name,
              reason: `转正日期格式需核对：${regularDate}`,
              sortTime: 0,
              type: "invalid"
            };
          }
          const regularDay = new Date(regularTime);
          regularDay.setHours(0, 0, 0, 0);
          if (regularDay.getTime() === today.getTime()) {
            return {
              name,
              reason: `今日转正：${regularDate}，请确认是否已办理`,
              sortTime: regularDay.getTime(),
              type: "today"
            };
          }
          if (regularDay < today) return null;
          if (regularDay <= remindEnd) {
            const daysLeft = Math.max(1, Math.ceil((regularDay.getTime() - today.getTime()) / 86400000));
            return {
              name,
              reason: `${regularDate} 转正，剩 ${daysLeft} 天`,
              sortTime: regularDay.getTime(),
              type: "upcoming"
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((left, right) => left.sortTime - right.sortTime || left.name.localeCompare(right.name, "zh-CN"));
    }

    function renderRegularizationMetric(employees) {
      const reminders = buildRegularizationReminders(employees);
      setText("hrMetricRegular", reminders.length);
      setText("hrMetricRegularHint", reminders.length ? "点击查看对应员工" : "未来 30 天暂无提醒");
      const detailNode = $("hrMetricRegularDetail");
      if (detailNode) {
        detailNode.textContent = reminders.length
          ? reminders.slice(0, 3).map((item) => `${item.name}：${item.reason}`).join("；")
          : "暂无待处理";
        detailNode.classList.toggle("warning", reminders.length > 0);
      }
      const card = $("hrRegularMetricCard");
      if (card) {
        card.dataset.employee = reminders[0]?.name || "";
        card.title = reminders.length
          ? `点击查看：${reminders.map((item) => item.name).join("、")}`
          : "暂无待转正提醒";
      }
    }

    function showRegularizationEmployee() {
      const card = $("hrRegularMetricCard");
      const targetName = normalizeName(card?.dataset.employee);
      const directory = document.querySelector("[data-employee-directory]");
      const toggle = document.querySelector("[data-employee-directory-toggle]");
      const search = document.querySelector("[data-employee-search]");
      if (!directory || !targetName) return;
      directory.hidden = false;
      if (toggle) {
        toggle.setAttribute("aria-expanded", "true");
        toggle.textContent = "收起名单";
      }
      if (search) {
        search.value = targetName;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      directory.querySelectorAll(".jrc-employee-card").forEach((node) => {
        node.style.outline = "";
        node.style.boxShadow = "";
      });
      const targetCard = [...directory.querySelectorAll(".jrc-employee-card")].find((node) => {
        return (node.getAttribute("data-employee-name") || "").includes(targetName.toLowerCase());
      });
      if (targetCard) {
        targetCard.hidden = false;
        targetCard.style.outline = "2px solid rgba(180, 83, 9, 0.45)";
        targetCard.style.boxShadow = "0 0 0 6px rgba(180, 83, 9, 0.10)";
        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        directory.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function render() {
      const keyword = $("hrFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("hrSortSelect")?.value || "newest";
      const entries = getSortedEntries(rows, keyword, sortValue, (row) => row.status, ["待处理", "处理中", "已完成"]);
      $("hrTaskTableBody").innerHTML = entries.length ? entries
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.employee)}</td>
            <td>${escapeHtml(row.system)}</td>
            <td>${workStatusTag(row.status)}${isOffboardingReady(row) && row.status !== "已完成" ? "<br><span class=\"tag green\">可完成</span>" : ""}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${escapeHtml(row.next)}<br>${escapeHtml(row.note)}${offboardingProgress(row) ? `<br><span class="tag green">${escapeHtml(offboardingProgress(row))}</span>` : ""}${renderOffboardingChecklist(row, index)}</td>
            <td>${actionButtons(index, capabilities)}</td>
          </tr>
        `).join("") : `<tr><td colspan="7">暂无人事事项。员工基础名单已在上方，全员名单可展开查看；新增培训、转正、权限调整后会显示在这里。</td></tr>`;
      const employees = Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [];
      renderHrEmployeeOptions();
      setText("hrMetricEmployees", employees.length || 0);
      renderRegularizationMetric(employees);
      setText("hrMetricCommission", employees.filter((employee) => employee.commissionRate).length);
      setText("hrMetricTraining", rows.filter((row) => row.type === "培训记录" || row.system.includes("知识库")).length);
      renderAuditLog(moduleKey, "hrAuditTableBody");
    }

    $("hrRegularMetricCard")?.addEventListener("click", showRegularizationEmployee);
    $("hrRegularMetricCard")?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      showRegularizationEmployee();
    });

    $("hrSaveButton")?.addEventListener("click", () => {
      const actionAllowed = editingIndex >= 0 ? capabilities.update : capabilities.create;
      if (!actionAllowed) {
        denyAction("hrMessage", editingIndex >= 0 ? "修改" : "新增");
        return;
      }
      const employee = normalizeName($("hrEmployeeInput")?.value);
      if (!employee) {
        setText("hrMessage", "请先填写员工姓名或对象。");
        return;
      }
      const type = $("hrTypeInput")?.value || "培训记录";
      const exactEmployeeRequiredTypes = ["离职", "转正", "权限调整", "提成调整"];
      if (exactEmployeeRequiredTypes.includes(type) && activeHrEmployees().length && !matchActiveHrEmployee(employee)) {
        setText("hrMessage", `${type}事项请从在职员工候选里选择完整员工姓名。可以输入姓氏或名字后，在弹出的候选里点选。`);
        return;
      }
      const payload = {
        type,
        employee,
        system: normalizeText($("hrSystemInput")?.value) || "-",
        status: $("hrStatusInput")?.value || "待处理",
        owner: normalizeName($("hrOwnerInput")?.value) || "-",
        next: normalizeText($("hrNextInput")?.value) || "-",
        note: normalizeText($("hrNoteInput")?.value) || "-",
        offboardingChecklist: type === "离职"
          ? editingIndex >= 0 && Array.isArray(rows[editingIndex].offboardingChecklist)
            ? rows[editingIndex].offboardingChecklist
            : buildOffboardingChecklist(employee)
          : undefined,
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText(),
        updatedAt: nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        recordAudit(moduleKey, "更新", employee, `${payload.type} / ${payload.status}`);
        setText("hrMessage", type === "离职" ? `已更新 ${employee} 的离职流程。清单全部确认后，请点击“完成离职并归档”结束流程。` : `已更新 ${employee} 的事项。`);
      } else {
        rows.unshift(payload);
        recordAudit(moduleKey, "新增", employee, `${payload.type} / ${payload.status}`);
        setText("hrMessage", type === "离职" ? `已创建 ${employee} 的离职流程。清单全部确认后，会出现“完成离职并归档”按钮。` : `已保存 ${employee} 的事项。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("hrTypeInput")?.addEventListener("change", () => {
      updateHrTypeGuidance({ forceDefaults: true });
    });
    $("hrEmployeeInput")?.addEventListener("change", () => {
      const type = $("hrTypeInput")?.value || "";
      const employee = normalizeName($("hrEmployeeInput")?.value);
      if (["离职", "转正", "权限调整", "提成调整"].includes(type) && employee && activeHrEmployees().length && !matchActiveHrEmployee(employee)) {
        setText("hrMessage", `${type}事项建议从候选名单选择完整姓名，避免只填姓氏或同名误选。`);
      }
    });
    $("hrFilterInput")?.addEventListener("input", render);
    $("hrSortSelect")?.addEventListener("change", render);
    $("hrTaskTableBody")?.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-hr-offboard]");
      if (!checkbox) return;
      if (!capabilities.update) {
        checkbox.checked = !checkbox.checked;
        denyAction("hrMessage", "修改");
        return;
      }
      const rowIndex = Number(checkbox.getAttribute("data-hr-offboard"));
      const itemIndex = Number(checkbox.getAttribute("data-offboard-item"));
      if (!rows[rowIndex]) return;
      const checklist = Array.isArray(rows[rowIndex].offboardingChecklist) && rows[rowIndex].offboardingChecklist.length
        ? rows[rowIndex].offboardingChecklist
        : buildOffboardingChecklist(rows[rowIndex].employee || "");
      if (!checklist[itemIndex]) return;
      checklist[itemIndex] = {
        ...checklist[itemIndex],
        done: checkbox.checked,
        updatedAt: checkbox.checked ? nowText() : ""
      };
      rows[rowIndex] = { ...rows[rowIndex], offboardingChecklist: checklist, updatedAt: nowText() };
      writeStore(key, rows);
      recordAudit(moduleKey, "离职流程", rows[rowIndex].employee, `${checklist[itemIndex].label}：${checkbox.checked ? "已完成" : "未完成"}`);
      render();
      setText("hrMessage", `已更新 ${rows[rowIndex].employee} 的离职流程。`);
    });
    $("hrTaskTableBody")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-hr-complete-offboard]");
      if (!button) return;
      if (!capabilities.update) {
        denyAction("hrMessage", "修改");
        return;
      }
      const rowIndex = Number(button.getAttribute("data-hr-complete-offboard"));
      const row = rows[rowIndex];
      if (!row || row.type !== "离职") return;
      const checklist = Array.isArray(row.offboardingChecklist) ? row.offboardingChecklist : [];
      if (!checklist.length || !checklist.every((item) => item.done)) {
        setText("hrMessage", "离职流程还没有全部勾选完成，暂不能归档。");
        return;
      }
      if (typeof window.JRC_MARK_EMPLOYEE_DEPARTED === "function") {
        const result = window.JRC_MARK_EMPLOYEE_DEPARTED(row.employee, { reason: row.note || "离职流程完成归档" });
        if (!result.ok) {
          setText("hrMessage", result.message || "离职归档失败，请确认员工是否仍在在职名单。");
          return;
        }
      }
      rows[rowIndex] = {
        ...row,
        status: "已完成",
        next: "离职流程已完成归档",
        offboardingCompletedAt: nowText(),
        updatedAt: nowText()
      };
      writeStore(key, rows);
      recordAudit(moduleKey, "完成离职", row.employee, "离职流程已完成归档");
      render();
      setText("hrMessage", `${row.employee} 的离职流程已完成归档，并已从在职员工名单移出。`);
    });
    $("hrExportButton")?.addEventListener("click", () => guardAction(capabilities.export, "hrMessage", "导出", () => downloadCsv("人事管理事项数据.csv", rows, [
      { label: "事项类型", value: "type" },
      { label: "员工/对象", value: "employee" },
      { label: "关联系统", value: "system" },
      { label: "状态", value: "status" },
      { label: "负责人", value: "owner" },
      { label: "下一步", value: "next" },
      { label: "说明", value: "note" },
      { label: "创建时间", value: "createdAt" }
    ])));
    $("hrResetButton")?.addEventListener("click", () => {
      if (!capabilities.reset) {
        denyAction("hrMessage", "清空");
        return;
      }
      markRowsDeleted(key, rows);
      rows = [];
      writeStore(key, rows, { restoreDeleted: false });
      recordAudit(moduleKey, "清空", "人事管理台账", "0 条");
      resetForm();
      render();
      setText("hrMessage", "已清空本页台账。员工账号名单不受影响。");
    });
    bindRowActions("hrTaskTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("hrSaveButton", "保存修改");
        setText("hrMessage", `正在编辑 ${rows[index].employee} 的事项。`);
      },
      onDelete(index) {
        const removed = rows[index];
        markRowDeleted(key, removed);
        rows.splice(index, 1);
        writeStore(key, rows, { restoreDeleted: false });
        recordAudit(moduleKey, "删除", removed.employee, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("hrMessage", `已删除 ${removed.employee} 的事项。`);
      }
    }, capabilities, "hrMessage");
    bindTableImport({
      buttonId: "hrImportButton",
      inputId: "hrImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        rows = nextRows;
        writeStore(key, rows);
        resetForm();
        render();
      },
      normalizeRow(row) {
        const employee = normalizeName(readField(row, ["employee", "员工姓名", "老师姓名", "对象", "姓名"]));
        if (!employee) return null;
        return {
          type: normalizeStatus(readField(row, ["type", "事项类型", "类型"], "培训记录"), ["入职", "转正", "权限调整", "提成调整", "培训记录", "员工基础档案核对", "系统权限分组"], "培训记录"),
          employee,
          system: normalizeText(readField(row, ["system", "关联系统", "系统"], "-")) || "-",
          status: normalizeStatus(readField(row, ["status", "处理状态", "状态"], "待处理"), ["待处理", "处理中", "已完成"], "待处理"),
          owner: normalizeName(readField(row, ["owner", "负责人"], "-")) || "-",
          next: normalizeText(readField(row, ["next", "下一步"], "-")) || "-",
          note: normalizeText(readField(row, ["note", "事项说明", "说明", "备注"], "-")) || "-",
          createdAt: String(readField(row, ["createdAt", "创建时间", "时间"], nowText())),
          updatedAt: String(readField(row, ["updatedAt", "更新时间"], nowText()))
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "人事管理台账", `${count} 条`);
        renderAuditLog(moduleKey, "hrAuditTableBody");
        setText("hrMessage", `已导入 ${count} 条人事事项。`);
      },
      onError() {
        setText("hrMessage", "导入失败。请上传 CSV/TSV/JSON；Excel 可以先另存为 CSV。");
      },
      canUse: () => capabilities.import,
      onDenied: () => denyAction("hrMessage", "导入")
    });
    resetForm();
    render();
    readCloudStore(key, (cloudRows) => {
      rows = mergeRowsById(sanitizeRows(cloudRows), key);
      if (rows.length !== cloudRows.length) writeStore(key, rows);
      resetForm();
      render();
      setText("hrMessage", "已同步云端人事管理台账。");
    });
    applyCapabilityGate({
      canWrite: capabilities.create || capabilities.update,
      messageId: "hrMessage",
      buttonRules: [["hrSaveButton", capabilities.create || capabilities.update, "新增或修改"], ["hrImportButton", capabilities.import, "导入"], ["hrExportButton", capabilities.export, "导出"], ["hrResetButton", capabilities.reset, "清空"]],
      fieldIds: ["hrTypeInput", "hrEmployeeInput", "hrSystemInput", "hrStatusInput", "hrOwnerInput", "hrNextInput", "hrNoteInput"]
    });
  }

  function initCampusOperations() {
    if (!$("campusTableBody")) return;
    const moduleKey = "campus";
    const capabilities = moduleCapabilities(moduleKey);
    const key = "jrc-campus-operations-v2";
    const defaults = {
      title: "",
      type: "教室",
      area: "",
      owner: currentOperator().name || "",
      status: "待处理",
      due: "",
      note: ""
    };
    function sanitizeRows(input) {
      const oldSeedTitles = ["教室可用状态核对", "暑假值班表", "门店异常记录"];
      return (Array.isArray(input) ? input : []).filter((row) => !oldSeedTitles.includes(row.title));
    }
    let rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
    let editingIndex = -1;
    const canEditCampus = capabilities.create || capabilities.update || capabilities.delete || capabilities.import || capabilities.reset;
    const campusEditor = $("campusEditorPanel");
    const campusEditorToggle = $("campusEditorToggle");
    if (campusEditor) campusEditor.hidden = true;
    if (campusEditorToggle) {
      campusEditorToggle.hidden = !canEditCampus;
      campusEditorToggle.addEventListener("click", () => {
        if (!campusEditor) return;
        campusEditor.hidden = !campusEditor.hidden;
        setText("campusEditorToggle", campusEditor.hidden ? "编辑校区运营" : "收起编辑");
      });
    }

    function fillForm(row) {
      $("campusTitleInput").value = row.title || "";
      $("campusTypeInput").value = row.type || "异常记录";
      $("campusAreaInput").value = row.area || "";
      $("campusOwnerInput").value = row.owner || "";
      $("campusStatusInput").value = row.status || "待处理";
      $("campusDueInput").value = row.due || "";
      $("campusNoteInput").value = row.note || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("campusSaveButton", "保存运营事项");
    }

    function render() {
      const keyword = $("campusFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("campusSortSelect")?.value || "newest";
      const entries = getSortedEntries(rows, keyword, sortValue, (row) => row.status, ["待处理", "处理中", "需复盘", "已完成"]);
      $("campusTableBody").innerHTML = entries.length ? entries
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.area)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${workStatusTag(row.status)}</td>
            <td>${escapeHtml(row.due)}</td>
            <td>${escapeHtml(row.note)}</td>
            <td>${canEditCampus ? actionButtons(index, capabilities) : tag("仅查看", "neutral")}</td>
          </tr>
        `).join("") : `<tr><td colspan="8">暂无校区运营事项。可以新增教室、值班、卫生、安全检查或异常记录。</td></tr>`;
      setText("campusMetricRoom", rows.filter((row) => row.type === "教室").length);
      setText("campusMetricDuty", rows.filter((row) => row.type === "值班" || row.type === "岗位排班" || row.type === "暑假排班").length);
      setText("campusMetricSafety", rows.filter((row) => row.type === "安全检查").length);
      setText("campusMetricOpen", rows.filter((row) => row.status !== "已完成").length);
      renderAuditLog(moduleKey, "campusAuditTableBody");
    }

    $("campusSaveButton")?.addEventListener("click", () => {
      const actionAllowed = editingIndex >= 0 ? capabilities.update : capabilities.create;
      if (!actionAllowed) {
        denyAction("campusMessage", editingIndex >= 0 ? "修改" : "新增");
        return;
      }
      const title = normalizeName($("campusTitleInput")?.value);
      if (!title) {
        setText("campusMessage", "请先填写事项名称。");
        return;
      }
      const payload = {
        title,
        type: $("campusTypeInput")?.value || "异常记录",
        area: normalizeText($("campusAreaInput")?.value) || "-",
        owner: normalizeName($("campusOwnerInput")?.value) || "-",
        status: $("campusStatusInput")?.value || "待处理",
        due: normalizeText($("campusDueInput")?.value) || "-",
        note: normalizeText($("campusNoteInput")?.value) || "-",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText(),
        updatedAt: nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        recordAudit(moduleKey, "更新", title, `${payload.type} / ${payload.status}`);
        setText("campusMessage", `已更新运营事项：${title}。`);
      } else {
        rows.unshift(payload);
        recordAudit(moduleKey, "新增", title, `${payload.type} / ${payload.status}`);
        setText("campusMessage", `已保存运营事项：${title}。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("campusFilterInput")?.addEventListener("input", render);
    $("campusSortSelect")?.addEventListener("change", render);
    $("campusExportButton")?.addEventListener("click", () => guardAction(capabilities.export, "campusMessage", "导出", () => downloadCsv("校区运营事项数据.csv", rows, [
      { label: "事项名称", value: "title" },
      { label: "类型", value: "type" },
      { label: "位置/范围", value: "area" },
      { label: "责任人", value: "owner" },
      { label: "状态", value: "status" },
      { label: "截止时间", value: "due" },
      { label: "说明", value: "note" },
      { label: "创建时间", value: "createdAt" }
    ])));
    $("campusResetButton")?.addEventListener("click", () => {
      if (!capabilities.reset) {
        denyAction("campusMessage", "清空");
        return;
      }
      markRowsDeleted(key, rows);
      rows = [];
      writeStore(key, rows, { restoreDeleted: false });
      recordAudit(moduleKey, "清空", "校区运营台账", "0 条");
      resetForm();
      render();
      setText("campusMessage", "已清空本页台账。后续可新增或导入真实校区事项。");
    });
    bindRowActions("campusTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        if (campusEditor) campusEditor.hidden = false;
        setText("campusEditorToggle", "收起编辑");
        setText("campusSaveButton", "保存修改");
        setText("campusMessage", `正在编辑 ${rows[index].title}。`);
      },
      onDelete(index) {
        const removed = rows[index];
        markRowDeleted(key, removed);
        rows.splice(index, 1);
        writeStore(key, rows, { restoreDeleted: false });
        recordAudit(moduleKey, "删除", removed.title, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("campusMessage", `已删除运营事项：${removed.title}。`);
      }
    }, capabilities, "campusMessage");
    bindTableImport({
      buttonId: "campusImportButton",
      inputId: "campusImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        rows = nextRows;
        writeStore(key, rows);
        resetForm();
        render();
      },
      normalizeRow(row) {
        const title = normalizeName(readField(row, ["title", "事项名称", "事项", "名称"]));
        if (!title) return null;
        return {
          title,
          type: normalizeStatus(readField(row, ["type", "事项类型", "类型"], "异常记录"), ["教室", "卫生", "安全检查", "值班", "岗位排班", "暑假排班", "异常记录"], "异常记录").replace("暑假排班", "岗位排班"),
          area: normalizeText(readField(row, ["area", "位置 / 范围", "位置", "范围"], "-")) || "-",
          owner: normalizeName(readField(row, ["owner", "责任人", "负责人"], "-")) || "-",
          status: normalizeStatus(readField(row, ["status", "处理状态", "状态"], "待处理"), ["待处理", "处理中", "已完成", "需复盘"], "待处理"),
          due: normalizeText(readField(row, ["due", "截止时间", "截止日期"], "-")) || "-",
          note: normalizeText(readField(row, ["note", "事项说明", "处理要求", "说明", "备注"], "-")) || "-",
          createdAt: String(readField(row, ["createdAt", "创建时间", "时间"], nowText())),
          updatedAt: String(readField(row, ["updatedAt", "更新时间"], nowText()))
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "校区运营台账", `${count} 条`);
        renderAuditLog(moduleKey, "campusAuditTableBody");
        setText("campusMessage", `已导入 ${count} 条校区运营事项。`);
      },
      onError() {
        setText("campusMessage", "导入失败。请上传 CSV/TSV/JSON；Excel 可以先另存为 CSV。");
      },
      canUse: () => capabilities.import,
      onDenied: () => denyAction("campusMessage", "导入")
    });
    resetForm();
    render();
    readCloudStore(key, (cloudRows) => {
      rows = mergeRowsById(sanitizeRows(cloudRows), key);
      if (rows.length !== cloudRows.length) writeStore(key, rows);
      resetForm();
      render();
      setText("campusMessage", canEditCampus ? "已同步云端校区运营台账；需要维护时点击“编辑校区运营”。" : "已同步云端校区运营台账。");
    });
    applyCapabilityGate({
      canWrite: capabilities.create || capabilities.update,
      messageId: "campusMessage",
      buttonRules: [["campusSaveButton", capabilities.create || capabilities.update, "新增或修改"], ["campusImportButton", capabilities.import, "导入"], ["campusExportButton", capabilities.export, "导出"], ["campusResetButton", capabilities.reset, "清空"]],
      fieldIds: ["campusTitleInput", "campusTypeInput", "campusAreaInput", "campusOwnerInput", "campusStatusInput", "campusDueInput", "campusNoteInput"]
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectBusinessModuleStyles();
    initStudentService();
    initCurriculumProducts();
    initHrTraining();
    initCampusOperations();
  });

  window.JRC_BUSINESS_MODULES = {
    ...(window.JRC_BUSINESS_MODULES || {}),
    recordLinkEvent,
    readLinkEvents,
    syncAttendanceIntoStudentService,
    syncAdmissionsIntoStudentService
  };
})();
