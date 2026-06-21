(function () {
  const auditKey = "jrc-business-audit-log-v1";
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

  function writeStore(key, rows) {
    localStorage.setItem(key, JSON.stringify(rows));
  }

  function hasPermission(permission) {
    if (!permission) return true;
    if (typeof window.jrcHasPermission !== "function") return true;
    return window.jrcHasPermission(permission);
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
        <td colspan="5">暂无操作记录。后续新增、修改、删除、导入或恢复样例都会记录在这里。</td>
      </tr>
    `;
  }

  function denyEdit(messageId) {
    setText(messageId, "当前账号可以查看，暂无修改权限。搜索、排序和导出仍可使用。");
  }

  function applyEditGate({ editable, messageId, buttonIds = [], fieldIds = [] }) {
    if (editable) return;
    buttonIds.forEach((id) => {
      const button = $(id);
      if (!button) return;
      button.disabled = true;
      button.style.opacity = "0.55";
      button.style.cursor = "not-allowed";
      button.title = "当前账号暂无修改权限";
    });
    fieldIds.forEach((id) => {
      const field = $(id);
      if (!field) return;
      field.disabled = true;
      field.title = "当前账号暂无修改权限";
    });
    denyEdit(messageId);
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

  function parseDateValue(value) {
    const time = Date.parse(String(value || "").replace(/\//g, "-"));
    return Number.isFinite(time) ? time : 0;
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

  function bindJsonImport({ buttonId, inputId, getRows, setRows, normalizeRow, onDone, onError, canUse = () => true, onDenied = () => {} }) {
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
          const parsed = JSON.parse(String(reader.result || "[]"));
          if (!Array.isArray(parsed)) throw new Error("JSON root is not an array");
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

  function rowMatches(row, keyword) {
    if (!keyword) return true;
    return Object.values(row).some((value) => String(value || "").toLowerCase().includes(keyword));
  }

  function actionButtons(index, editable = true) {
    if (!editable) return tag("仅查看", "neutral");
    return `
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" data-action="edit" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(23,33,50,0.12); background:#fff; color:#172132; cursor:pointer;">编辑</button>
        <button type="button" data-action="delete" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(185,28,28,0.18); background:rgba(185,28,28,0.08); color:#b91c1c; cursor:pointer;">删除</button>
      </div>
    `;
  }

  function bindRowActions(tableBodyId, handlers, editable = true, messageId = "") {
    const body = $(tableBodyId);
    if (!body) return;
    body.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      if (!editable) {
        denyEdit(messageId);
        return;
      }
      const action = button.getAttribute("data-action");
      const index = Number(button.getAttribute("data-index"));
      if (action === "edit") handlers.onEdit(index);
      if (action === "delete") handlers.onDelete(index);
    });
  }

  function initStudentService() {
    if (!$("studentServiceTableBody")) return;
    const moduleKey = "studentService";
    const editPermission = "studentService.edit";
    const editable = hasPermission(editPermission);
    const key = "jrc-student-service-v2";
    const defaults = {
      student: "学生 A",
      className: "暑假数学提升班",
      teacher: "待同步",
      type: "课后反馈",
      risk: "正常",
      next: "建立真实档案字段",
      content: "记录课堂掌握情况、作业完成情况、家长反馈和下一步跟进事项。"
    };
    const samples = [
      { student: "学生 A", className: "暑假数学提升班", teacher: "待同步", type: "课后反馈", risk: "正常", content: "待从课后反馈同步", next: "建立真实档案字段", createdAt: nowText() },
      { student: "学生 B", className: "六月份平时课", teacher: "待同步", type: "学习跟踪", risk: "关注", content: "待从排课课次同步", next: "同步剩余课时", createdAt: nowText() },
      { student: "学生 C", className: "试听转正式", teacher: "待同步", type: "家长沟通", risk: "正常", content: "待从招生试听同步", next: "生成入学交接单", createdAt: nowText() }
    ];
    let rows = readStore(key, samples);
    let editingIndex = -1;

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

    function render() {
      const keyword = $("studentFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("studentSortSelect")?.value || "newest";
      $("studentServiceTableBody").innerHTML = getSortedEntries(rows, keyword, sortValue, (row) => row.risk, ["高风险", "关注", "正常"])
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.student)}</td>
            <td>${escapeHtml(row.className)}</td>
            <td>${escapeHtml(row.teacher)}</td>
            <td>${escapeHtml(row.type)}<br>${escapeHtml(row.content)}</td>
            <td>${escapeHtml(row.createdAt || "-")}</td>
            <td>${riskTag(row.risk)}</td>
            <td>${escapeHtml(row.next)}</td>
            <td>${actionButtons(index, editable)}</td>
          </tr>
        `).join("");
      setText("studentMetricTotal", rows.length);
      setText("studentMetricFeedback", rows.filter((row) => row.type === "课后反馈").length);
      setText("studentMetricRisk", rows.filter((row) => row.risk !== "正常").length);
      setText("studentMetricCommunication", rows.filter((row) => row.type === "家长沟通").length);
      renderAuditLog(moduleKey, "studentAuditTableBody");
    }

    $("studentSaveButton")?.addEventListener("click", () => {
      if (!editable) {
        denyEdit("studentServiceMessage");
        return;
      }
      const student = $("studentNameInput")?.value.trim();
      if (!student) {
        setText("studentServiceMessage", "请先填写学生姓名。");
        return;
      }
      const payload = {
        student,
        className: $("studentClassInput")?.value.trim() || "-",
        teacher: $("studentTeacherInput")?.value.trim() || "-",
        type: $("studentServiceTypeInput")?.value || "学习跟踪",
        risk: $("studentRiskInput")?.value || "正常",
        content: $("studentContentInput")?.value.trim() || "-",
        next: $("studentNextActionInput")?.value.trim() || "-",
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
    $("studentExportButton")?.addEventListener("click", () => downloadJson("学生与家长服务数据.json", rows));
    $("studentResetButton")?.addEventListener("click", () => {
      if (!editable) {
        denyEdit("studentServiceMessage");
        return;
      }
      rows = samples.map((row) => ({ ...row }));
      writeStore(key, rows);
      recordAudit(moduleKey, "恢复样例", "学生服务台账", `${rows.length} 条`);
      resetForm();
      render();
      setText("studentServiceMessage", "已恢复样例数据。");
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
        rows.splice(index, 1);
        writeStore(key, rows);
        recordAudit(moduleKey, "删除", removed.student, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("studentServiceMessage", `已删除 ${removed.student} 的记录。`);
      }
    }, editable, "studentServiceMessage");
    bindJsonImport({
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
        if (!row?.student) return null;
        return {
          student: String(row.student),
          className: String(row.className || "-"),
          teacher: String(row.teacher || "-"),
          type: String(row.type || "学习跟踪"),
          risk: String(row.risk || "正常"),
          content: String(row.content || "-"),
          next: String(row.next || "-"),
          createdAt: String(row.createdAt || nowText()),
          updatedAt: String(row.updatedAt || nowText())
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "学生服务台账", `${count} 条`);
        renderAuditLog(moduleKey, "studentAuditTableBody");
        setText("studentServiceMessage", `已导入 ${count} 条学生服务记录。`);
      },
      onError() {
        setText("studentServiceMessage", "导入失败，请选择从本系统导出的 JSON 数组文件。");
      },
      canUse: () => editable,
      onDenied: () => denyEdit("studentServiceMessage")
    });
    resetForm();
    render();
    applyEditGate({
      editable,
      messageId: "studentServiceMessage",
      buttonIds: ["studentSaveButton", "studentImportButton", "studentResetButton"],
      fieldIds: ["studentNameInput", "studentClassInput", "studentTeacherInput", "studentServiceTypeInput", "studentRiskInput", "studentNextActionInput", "studentContentInput"]
    });
  }

  function initCurriculumProducts() {
    if (!$("curriculumTableBody")) return;
    const moduleKey = "curriculum";
    const editPermission = "curriculum.edit";
    const editable = hasPermission(editPermission);
    const key = "jrc-curriculum-products-v2";
    const defaults = {
      name: "五年级暑假第 1 讲",
      subject: "数学 / 五年级",
      type: "课程大纲",
      classType: "暑假班",
      version: "V0.1",
      owner: "待指定",
      note: "说明本次资料适用对象、重点难点和老师使用注意事项。"
    };
    const samples = [
      { name: "暑假数学提升课", subject: "数学 / 小学高段", type: "讲义", classType: "暑假班", status: "待导入讲义", version: "V0.1", owner: "待指定", note: "补课程大纲和课次安排", createdAt: nowText() },
      { name: "初一数学衔接课", subject: "数学 / 初一", type: "题库", classType: "暑假班、平时班", status: "待整理题库", version: "V0.1", owner: "待指定", note: "标注重点难点", createdAt: nowText() },
      { name: "科学专题课", subject: "科学 / 3-8 年级", type: "备课资料", classType: "平时班", status: "待上传资料", version: "V0.1", owner: "待指定", note: "建立资料目录", createdAt: nowText() }
    ];
    let rows = readStore(key, samples);
    let editingIndex = -1;

    function fillForm(row) {
      $("curriculumNameInput").value = row.name || "";
      $("curriculumSubjectInput").value = row.subject || "";
      $("curriculumTypeInput").value = row.type || "备课资料";
      $("curriculumClassTypeInput").value = row.classType || "";
      $("curriculumVersionInput").value = row.version || "V0.1";
      $("curriculumOwnerInput").value = row.owner || "";
      $("curriculumNoteInput").value = row.note || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("curriculumSaveButton", "保存资料版本");
    }

    function render() {
      const keyword = $("curriculumFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("curriculumSortSelect")?.value || "newest";
      $("curriculumTableBody").innerHTML = getSortedEntries(rows, keyword, sortValue, (row) => row.status, ["待导入", "待整理", "待上传", "已录入"])
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.subject)}</td>
            <td>${escapeHtml(row.classType)}</td>
            <td>${tag(row.type, "info")} ${workStatusTag(row.status)}</td>
            <td>${escapeHtml(row.version)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${escapeHtml(row.note)}</td>
            <td>${actionButtons(index, editable)}</td>
          </tr>
        `).join("");
      setText("curriculumMetricOutline", rows.filter((row) => row.type === "课程大纲").length);
      setText("curriculumMetricMaterials", rows.filter((row) => ["讲义", "题库"].includes(row.type)).length);
      setText("curriculumMetricProducts", new Set(rows.map((row) => row.classType)).size);
      setText("curriculumMetricPreparation", rows.filter((row) => row.type === "备课资料").length);
      renderAuditLog(moduleKey, "curriculumAuditTableBody");
    }

    $("curriculumSaveButton")?.addEventListener("click", () => {
      if (!editable) {
        denyEdit("curriculumMessage");
        return;
      }
      const name = $("curriculumNameInput")?.value.trim();
      if (!name) {
        setText("curriculumMessage", "请先填写资料名称。");
        return;
      }
      const payload = {
        name,
        subject: $("curriculumSubjectInput")?.value.trim() || "-",
        type: $("curriculumTypeInput")?.value || "备课资料",
        classType: $("curriculumClassTypeInput")?.value || "-",
        status: editingIndex >= 0 ? rows[editingIndex].status : "已录入",
        version: $("curriculumVersionInput")?.value.trim() || "V0.1",
        owner: $("curriculumOwnerInput")?.value.trim() || "-",
        note: $("curriculumNoteInput")?.value.trim() || "-",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText(),
        updatedAt: nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        recordAudit(moduleKey, "更新", name, `${payload.type} / ${payload.version}`);
        setText("curriculumMessage", `已更新 ${name}。`);
      } else {
        rows.unshift(payload);
        recordAudit(moduleKey, "新增", name, `${payload.type} / ${payload.version}`);
        setText("curriculumMessage", `已保存 ${name}。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("curriculumFilterInput")?.addEventListener("input", render);
    $("curriculumSortSelect")?.addEventListener("change", render);
    $("curriculumExportButton")?.addEventListener("click", () => downloadJson("教研与课程产品数据.json", rows));
    $("curriculumResetButton")?.addEventListener("click", () => {
      if (!editable) {
        denyEdit("curriculumMessage");
        return;
      }
      rows = samples.map((row) => ({ ...row }));
      writeStore(key, rows);
      recordAudit(moduleKey, "恢复样例", "教研课程台账", `${rows.length} 条`);
      resetForm();
      render();
      setText("curriculumMessage", "已恢复样例数据。");
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
        rows.splice(index, 1);
        writeStore(key, rows);
        recordAudit(moduleKey, "删除", removed.name, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("curriculumMessage", `已删除 ${removed.name}。`);
      }
    }, editable, "curriculumMessage");
    bindJsonImport({
      buttonId: "curriculumImportButton",
      inputId: "curriculumImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        rows = nextRows;
        writeStore(key, rows);
        resetForm();
        render();
      },
      normalizeRow(row) {
        if (!row?.name) return null;
        return {
          name: String(row.name),
          subject: String(row.subject || "-"),
          type: String(row.type || "备课资料"),
          classType: String(row.classType || "-"),
          status: String(row.status || "已录入"),
          version: String(row.version || "V0.1"),
          owner: String(row.owner || "-"),
          note: String(row.note || "-"),
          createdAt: String(row.createdAt || nowText()),
          updatedAt: String(row.updatedAt || nowText())
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "教研课程台账", `${count} 条`);
        renderAuditLog(moduleKey, "curriculumAuditTableBody");
        setText("curriculumMessage", `已导入 ${count} 条课程资料。`);
      },
      onError() {
        setText("curriculumMessage", "导入失败，请选择从本系统导出的 JSON 数组文件。");
      },
      canUse: () => editable,
      onDenied: () => denyEdit("curriculumMessage")
    });
    resetForm();
    render();
    applyEditGate({
      editable,
      messageId: "curriculumMessage",
      buttonIds: ["curriculumSaveButton", "curriculumImportButton", "curriculumResetButton"],
      fieldIds: ["curriculumNameInput", "curriculumSubjectInput", "curriculumTypeInput", "curriculumClassTypeInput", "curriculumVersionInput", "curriculumOwnerInput", "curriculumNoteInput"]
    });
  }

  function initHrTraining() {
    if (!$("hrTaskTableBody")) return;
    const moduleKey = "hr";
    const editPermission = "hr.edit";
    const editable = hasPermission(editPermission);
    const key = "jrc-hr-training-tasks-v2";
    const defaults = {
      type: "入职",
      employee: "待选择",
      system: "统一登录、财务",
      status: "待处理",
      owner: "管理员",
      next: "补齐信息并归档",
      note: "记录调整原因、对应系统、执行时间和是否需要财务同步。"
    };
    const samples = [
      { type: "员工基础档案核对", employee: "全体员工", system: "统一登录、财务", status: "处理中", owner: "管理员", next: "补齐手机号、微信、入职日期、提成比例", note: "统一整理员工档案", createdAt: nowText() },
      { type: "系统权限分组", employee: "学管、财务、授课老师", system: "所有系统", status: "处理中", owner: "管理员", next: "按真实岗位继续细分查看和修改权限", note: "权限逐步细化", createdAt: nowText() },
      { type: "培训记录归档", employee: "学管、授课老师", system: "知识库问答系统", status: "待处理", owner: "学管负责人", next: "同步学习内容和阶段测试结果", note: "后续接知识库测试", createdAt: nowText() }
    ];
    let rows = readStore(key, samples);
    let editingIndex = -1;

    function fillForm(row) {
      $("hrTypeInput").value = row.type || "培训记录";
      $("hrEmployeeInput").value = row.employee || "";
      $("hrSystemInput").value = row.system || "";
      $("hrStatusInput").value = row.status || "待处理";
      $("hrOwnerInput").value = row.owner || "";
      $("hrNextInput").value = row.next || "";
      $("hrNoteInput").value = row.note || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("hrSaveButton", "保存人事事项");
    }

    function render() {
      const keyword = $("hrFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("hrSortSelect")?.value || "newest";
      $("hrTaskTableBody").innerHTML = getSortedEntries(rows, keyword, sortValue, (row) => row.status, ["待处理", "处理中", "已完成"])
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.employee)}</td>
            <td>${escapeHtml(row.system)}</td>
            <td>${workStatusTag(row.status)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${escapeHtml(row.next)}<br>${escapeHtml(row.note)}</td>
            <td>${actionButtons(index, editable)}</td>
          </tr>
        `).join("");
      const employees = Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [];
      setText("hrMetricEmployees", employees.length || 0);
      setText("hrMetricRegular", employees.filter((employee) => !employee.regularDate).length);
      setText("hrMetricCommission", employees.filter((employee) => employee.commissionRate).length);
      setText("hrMetricTraining", rows.filter((row) => row.type === "培训记录" || row.system.includes("知识库")).length);
      renderAuditLog(moduleKey, "hrAuditTableBody");
    }

    $("hrSaveButton")?.addEventListener("click", () => {
      if (!editable) {
        denyEdit("hrMessage");
        return;
      }
      const employee = $("hrEmployeeInput")?.value.trim();
      if (!employee) {
        setText("hrMessage", "请先填写员工姓名或对象。");
        return;
      }
      const payload = {
        type: $("hrTypeInput")?.value || "培训记录",
        employee,
        system: $("hrSystemInput")?.value.trim() || "-",
        status: $("hrStatusInput")?.value || "待处理",
        owner: $("hrOwnerInput")?.value.trim() || "-",
        next: $("hrNextInput")?.value.trim() || "-",
        note: $("hrNoteInput")?.value.trim() || "-",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText(),
        updatedAt: nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        recordAudit(moduleKey, "更新", employee, `${payload.type} / ${payload.status}`);
        setText("hrMessage", `已更新 ${employee} 的事项。`);
      } else {
        rows.unshift(payload);
        recordAudit(moduleKey, "新增", employee, `${payload.type} / ${payload.status}`);
        setText("hrMessage", `已保存 ${employee} 的事项。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("hrFilterInput")?.addEventListener("input", render);
    $("hrSortSelect")?.addEventListener("change", render);
    $("hrExportButton")?.addEventListener("click", () => downloadJson("人事与培训事项数据.json", rows));
    $("hrResetButton")?.addEventListener("click", () => {
      if (!editable) {
        denyEdit("hrMessage");
        return;
      }
      rows = samples.map((row) => ({ ...row }));
      writeStore(key, rows);
      recordAudit(moduleKey, "恢复样例", "人事培训台账", `${rows.length} 条`);
      resetForm();
      render();
      setText("hrMessage", "已恢复样例数据。");
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
        rows.splice(index, 1);
        writeStore(key, rows);
        recordAudit(moduleKey, "删除", removed.employee, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("hrMessage", `已删除 ${removed.employee} 的事项。`);
      }
    }, editable, "hrMessage");
    bindJsonImport({
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
        if (!row?.employee) return null;
        return {
          type: String(row.type || "培训记录"),
          employee: String(row.employee),
          system: String(row.system || "-"),
          status: String(row.status || "待处理"),
          owner: String(row.owner || "-"),
          next: String(row.next || "-"),
          note: String(row.note || "-"),
          createdAt: String(row.createdAt || nowText()),
          updatedAt: String(row.updatedAt || nowText())
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "人事培训台账", `${count} 条`);
        renderAuditLog(moduleKey, "hrAuditTableBody");
        setText("hrMessage", `已导入 ${count} 条人事事项。`);
      },
      onError() {
        setText("hrMessage", "导入失败，请选择从本系统导出的 JSON 数组文件。");
      },
      canUse: () => editable,
      onDenied: () => denyEdit("hrMessage")
    });
    resetForm();
    render();
    applyEditGate({
      editable,
      messageId: "hrMessage",
      buttonIds: ["hrSaveButton", "hrImportButton", "hrResetButton"],
      fieldIds: ["hrTypeInput", "hrEmployeeInput", "hrSystemInput", "hrStatusInput", "hrOwnerInput", "hrNextInput", "hrNoteInput"]
    });
  }

  function initCampusOperations() {
    if (!$("campusTableBody")) return;
    const moduleKey = "campus";
    const editPermission = "campus.edit";
    const editable = hasPermission(editPermission);
    const key = "jrc-campus-operations-v2";
    const defaults = {
      title: "教室可用状态核对",
      type: "教室",
      area: "全校区",
      owner: "待指定",
      status: "待处理",
      due: "暑假班前",
      note: "记录发生时间、地点、影响范围、处理要求和是否需要通知家长或老师。"
    };
    const samples = [
      { title: "教室可用状态核对", type: "教室", area: "全校区", owner: "待指定", status: "待处理", due: "暑假班前", note: "同步到排课教室占用", createdAt: nowText() },
      { title: "暑假值班表", type: "值班", area: "前台 / 教室", owner: "待指定", status: "待处理", due: "每周更新", note: "和暑假课程高峰匹配", createdAt: nowText() },
      { title: "门店异常记录", type: "异常记录", area: "校区日常", owner: "待指定", status: "需复盘", due: "即时处理", note: "记录原因、处理人、复盘结果", createdAt: nowText() }
    ];
    let rows = readStore(key, samples);
    let editingIndex = -1;

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
      $("campusTableBody").innerHTML = getSortedEntries(rows, keyword, sortValue, (row) => row.status, ["待处理", "处理中", "需复盘", "已完成"])
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.area)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${workStatusTag(row.status)}</td>
            <td>${escapeHtml(row.due)}</td>
            <td>${escapeHtml(row.note)}</td>
            <td>${actionButtons(index, editable)}</td>
          </tr>
        `).join("");
      setText("campusMetricRoom", rows.filter((row) => row.type === "教室").length);
      setText("campusMetricDuty", rows.filter((row) => row.type === "值班" || row.type === "暑假排班").length);
      setText("campusMetricSafety", rows.filter((row) => row.type === "安全检查").length);
      setText("campusMetricOpen", rows.filter((row) => row.status !== "已完成").length);
      renderAuditLog(moduleKey, "campusAuditTableBody");
    }

    $("campusSaveButton")?.addEventListener("click", () => {
      if (!editable) {
        denyEdit("campusMessage");
        return;
      }
      const title = $("campusTitleInput")?.value.trim();
      if (!title) {
        setText("campusMessage", "请先填写事项名称。");
        return;
      }
      const payload = {
        title,
        type: $("campusTypeInput")?.value || "异常记录",
        area: $("campusAreaInput")?.value.trim() || "-",
        owner: $("campusOwnerInput")?.value.trim() || "-",
        status: $("campusStatusInput")?.value || "待处理",
        due: $("campusDueInput")?.value.trim() || "-",
        note: $("campusNoteInput")?.value.trim() || "-",
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
    $("campusExportButton")?.addEventListener("click", () => downloadJson("校区运营事项数据.json", rows));
    $("campusResetButton")?.addEventListener("click", () => {
      if (!editable) {
        denyEdit("campusMessage");
        return;
      }
      rows = samples.map((row) => ({ ...row }));
      writeStore(key, rows);
      recordAudit(moduleKey, "恢复样例", "校区运营台账", `${rows.length} 条`);
      resetForm();
      render();
      setText("campusMessage", "已恢复样例数据。");
    });
    bindRowActions("campusTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("campusSaveButton", "保存修改");
        setText("campusMessage", `正在编辑 ${rows[index].title}。`);
      },
      onDelete(index) {
        const removed = rows[index];
        rows.splice(index, 1);
        writeStore(key, rows);
        recordAudit(moduleKey, "删除", removed.title, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("campusMessage", `已删除运营事项：${removed.title}。`);
      }
    }, editable, "campusMessage");
    bindJsonImport({
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
        if (!row?.title) return null;
        return {
          title: String(row.title),
          type: String(row.type || "异常记录"),
          area: String(row.area || "-"),
          owner: String(row.owner || "-"),
          status: String(row.status || "待处理"),
          due: String(row.due || "-"),
          note: String(row.note || "-"),
          createdAt: String(row.createdAt || nowText()),
          updatedAt: String(row.updatedAt || nowText())
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "校区运营台账", `${count} 条`);
        renderAuditLog(moduleKey, "campusAuditTableBody");
        setText("campusMessage", `已导入 ${count} 条校区运营事项。`);
      },
      onError() {
        setText("campusMessage", "导入失败，请选择从本系统导出的 JSON 数组文件。");
      },
      canUse: () => editable,
      onDenied: () => denyEdit("campusMessage")
    });
    resetForm();
    render();
    applyEditGate({
      editable,
      messageId: "campusMessage",
      buttonIds: ["campusSaveButton", "campusImportButton", "campusResetButton"],
      fieldIds: ["campusTitleInput", "campusTypeInput", "campusAreaInput", "campusOwnerInput", "campusStatusInput", "campusDueInput", "campusNoteInput"]
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initStudentService();
    initCurriculumProducts();
    initHrTraining();
    initCampusOperations();
  });
})();
