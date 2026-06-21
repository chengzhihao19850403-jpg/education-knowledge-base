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

  function countBackupStores() {
    return backupStoreKeys.filter((key) => localStorage.getItem(key) !== null).length;
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
    const employeeState = getEmployeeState();

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

    if (backupStoreCount === 0) {
      todos.push(todoItem(
        "提醒",
        "当前浏览器还没有可备份业务数据",
        "下周试用前请先录入或导入一批真实数据，再由管理员导出整站备份。",
        "#dataSyncSection",
        "看备份"
      ));
    } else {
      todos.push(todoItem(
        "提醒",
        `当前浏览器检测到 ${backupStoreCount} 类可备份数据`,
        "云数据库接入前，每天下班前建议管理员导出一次整站备份。",
        "#dataSyncSection",
        "导出备份"
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
  }

  document.addEventListener("DOMContentLoaded", renderPortalDashboard);
})();
