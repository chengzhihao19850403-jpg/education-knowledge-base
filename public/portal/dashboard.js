(function () {
  const admissionsKey = "advice-system-stage-prototype";
  const auditKey = "jrc-business-audit-log-v1";
  const backupStoreKeys = [
    "paike-june-system-v1",
    "paike-system-prototype-v1",
    "advice-system-stage-prototype",
    "jrc-suggestion-management-v2",
    "jrc-finance-ledger-v1",
    "jrc-teaching-quality-system-v2-demo",
    "jrc-student-service-v2",
    "jrc-curriculum-products-v2",
    "jrc-hr-training-tasks-v2",
    "jrc-campus-operations-v2",
    "jrc-business-audit-log-v1",
    "jrc-employee-directory-extra"
  ];
  const systemStores = [
    { key: "paike-summer-import-review-v1", label: "排课待确认", href: "./paike.html", type: "array" },
    { key: "advice-system-stage-prototype", label: "招生线索", href: "/jrcedu/advice-system/index.html", type: "admissions" },
    { key: "jrc-finance-ledger-v1", label: "财务系统", href: "./finance.html", type: "finance" },
    { key: "jrc-teaching-quality-system-v2-demo", label: "教学质量", href: "./teaching-quality.html", type: "teachingQuality" },
    { key: "jrc-student-service-v2", label: "学生服务", href: "./student-service.html", type: "array" },
    { key: "jrc-curriculum-products-v2", label: "教研课程", href: "./curriculum-products.html", type: "array" },
    { key: "jrc-hr-training-tasks-v2", label: "人事培训", href: "./hr-training.html", type: "array" },
    { key: "jrc-campus-operations-v2", label: "校区运营", href: "./campus-operations.html", type: "array" },
    { key: "jrc-suggestion-management-v2", label: "建议系统", href: "./suggestions.html", type: "array" }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function safeParse(raw, fallback) {
    try {
      return JSON.parse(raw || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readAdmissions() {
    const state = safeParse(localStorage.getItem(admissionsKey), {});
    const leads = Array.isArray(state.leads) ? state.leads : [];
    const pending = leads.filter((lead) => {
      if (!lead) return false;
      if (!lead.owner || lead.owner === "待分配") return true;
      if (!lead.channel || lead.channel === "待补来源") return true;
      if (!lead.note || lead.note === "待补首条记录") return true;
      if (lead.status === "新建未联系") return true;
      if (lead.status === "试听完成待转化") return true;
      if ((lead.intent || "").startsWith("A") && Number(lead.enrolledAmount || 0) <= 0) return true;
      return false;
    });
    return { leads, pending };
  }

  function readAuditCount() {
    const rows = safeParse(localStorage.getItem(auditKey), []);
    return Array.isArray(rows) ? rows.length : 0;
  }

  function readStore(key, fallback = null) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function countStoreRows(config) {
    const data = readStore(config.key, null);
    if (data === null) return 0;
    if (Array.isArray(data)) return data.length;
    if (config.type === "admissions") {
      return Array.isArray(data.leads) ? data.leads.length : 0;
    }
    if (config.type === "finance") {
      return Object.keys(data.periods || {}).length + (data.expenses || []).length;
    }
    if (config.type === "teachingQuality") {
      return (data.teachers || []).length + (data.tickets || []).length + (data.inspections || []).length;
    }
    if (typeof data === "object") return Object.keys(data).length;
    return 0;
  }

  function getTeachingQualityOpenTickets() {
    const data = readStore("jrc-teaching-quality-system-v2-demo", {});
    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    return tickets.filter((ticket) => !String(ticket.status || "").includes("已闭环"));
  }

  function getPaikeReviewCount() {
    const rows = readStore("paike-summer-import-review-v1", []);
    return Array.isArray(rows) ? rows.length : 0;
  }

  function getDataStatus(config) {
    const hasData = localStorage.getItem(config.key) !== null;
    const count = countStoreRows(config);
    if (!hasData) {
      return { label: "待录入", className: "status-warn", detail: "当前浏览器暂无本系统数据。" };
    }
    if (config.type === "teachingQuality") {
      return { label: "演示样例", className: "status-warn", detail: `当前 ${count} 条记录，正式启用前需换成真实数据。` };
    }
    return { label: "本机数据", className: "status-ok", detail: `当前浏览器检测到 ${count} 条/类记录。` };
  }

  function countBackupStores() {
    return backupStoreKeys.filter((key) => localStorage.getItem(key) !== null).length;
  }

  function readLastBackupState() {
    const data = readStore("jrc-last-local-backup-export", null);
    if (!data?.exportedAt) return { exportedToday: false, text: "当前浏览器还没有整站备份记录" };
    const exported = new Date(data.exportedAt);
    const now = new Date();
    const exportedToday =
      exported.getFullYear() === now.getFullYear() &&
      exported.getMonth() === now.getMonth() &&
      exported.getDate() === now.getDate();
    return {
      exportedToday,
      text: `最近备份：${exported.toLocaleString("zh-CN", { hour12: false })}`
    };
  }

  function getEmployeeState() {
    const employees = Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [];
    const custom = safeParse(localStorage.getItem("jrc-employee-directory-extra"), []);
    const all = [...employees, ...(Array.isArray(custom) ? custom : [])];
    const missing = all.filter((employee) => !employee.phone || !employee.wechat || !employee.hireDate);
    return { total: all.length, missing: missing.length };
  }

  function todoItem(level, title, detail, href, actionText) {
    const className = level === "紧急" ? "status-danger" : level === "提醒" ? "status-warn" : "status-ok";
    return `
      <div class="workbench-item">
        <span class="badge ${className}">${level}</span>
        <div>
          <strong>${title}</strong>
          <p>${detail}</p>
        </div>
        <a class="text-link" href="${href}">${actionText}</a>
      </div>
    `;
  }

  function renderPortalDashboard() {
    const { leads, pending } = readAdmissions();
    const auditCount = readAuditCount();
    const backupStoreCount = countBackupStores();
    const lastBackupState = readLastBackupState();
    const employeeState = getEmployeeState();
    const paikeReviewCount = getPaikeReviewCount();
    const qualityOpenTickets = getTeachingQualityOpenTickets();

    if ($("portalAdmissionsCount")) $("portalAdmissionsCount").textContent = String(leads.length);
    if ($("portalAdmissionsTodoCount")) $("portalAdmissionsTodoCount").textContent = String(pending.length);
    if ($("portalAuditCount")) $("portalAuditCount").textContent = String(auditCount);
    if ($("portalBackupStoreCount")) $("portalBackupStoreCount").textContent = String(backupStoreCount);

    const todos = [];
    if (pending.length > 0) {
      todos.push(todoItem(
        "紧急",
        `招生系统有 ${pending.length} 条待处理线索`,
        "包含待分配、缺字段、新建未联系、试听后待转化或 A 类高意向未报名线索。",
        "/jrcedu/advice-system/index.html",
        "处理招生"
      ));
    } else {
      todos.push(todoItem(
        "正常",
        "招生系统暂无紧急待办",
        "继续录入真实线索后，首页会自动显示需要跟进的客户。",
        "/jrcedu/advice-system/index.html",
        "进入招生"
      ));
    }

    if (paikeReviewCount > 0) {
      todos.push(todoItem(
        "紧急",
        `排课系统有 ${paikeReviewCount} 条待确认项`,
        "老师 Excel 导入后留下的疑问、缺教室、命名不一致或待排课老师拍板事项，需要优先清理。",
        "./paike.html",
        "处理排课"
      ));
    }

    if (qualityOpenTickets.length > 0) {
      todos.push(todoItem(
        "提醒",
        `教学质量有 ${qualityOpenTickets.length} 条未闭环整改`,
        "当前多为演示样例，但正式试用前要确认哪些是真实整改，哪些只是示例。",
        "./teaching-quality.html",
        "看教学质量"
      ));
    }

    if (backupStoreCount === 0) {
      todos.push(todoItem(
        "提醒",
        "当前浏览器还没有可备份业务数据",
        "下周试用前请先录入或导入一批真实数据，再由管理员导出整站备份。",
        "#dataSyncSection",
        "看备份"
      ));
    } else if (!lastBackupState.exportedToday) {
      todos.push(todoItem(
        "紧急",
        "今天还没有导出整站备份",
        `${lastBackupState.text}。云数据库接入前，建议每天下班前导出一次。`,
        "#dataSyncSection",
        "立即备份"
      ));
    } else {
      todos.push(todoItem(
        "正常",
        "今天已经导出过整站备份",
        `${lastBackupState.text}。明天接云数据库前，这个备份可以作为兜底。`,
        "#dataSyncSection",
        "查看备份"
      ));
    }

    if (employeeState.missing > 0) {
      todos.push(todoItem(
        "提醒",
        `员工资料还有 ${employeeState.missing} 人待补齐`,
        "优先补手机号、微信号、入职日期、岗位和权限，后面会影响登录、财务和人事统计。",
        "./hr-training.html",
        "人事培训"
      ));
    }

    if (auditCount === 0) {
      todos.push(todoItem(
        "提醒",
        "操作日志还没有形成记录",
        "多人试用时，请尽量通过系统新增、修改、导入，不要只在群里口头改。",
        "./suggestions.html",
        "看日志"
      ));
    }

    const holder = $("portalTodoList");
    if (holder) holder.innerHTML = todos.join("");

    renderDataStates();
  }

  function renderDataStates() {
    const holder = $("portalDataStateList");
    if (!holder) return;
    holder.innerHTML = systemStores.map((config) => {
      const status = getDataStatus(config);
      return `
        <a class="data-state-card" href="${config.href}" style="text-decoration:none;">
          <strong>${config.label}</strong>
          <span class="badge ${status.className}">${status.label}</span>
          <p>${status.detail}</p>
        </a>
      `;
    }).join("");
  }

  document.addEventListener("DOMContentLoaded", renderPortalDashboard);
})();
