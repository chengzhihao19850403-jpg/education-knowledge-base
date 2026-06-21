(function () {
  const admissionsKey = "advice-system-stage-prototype";
  const auditKey = "jrc-business-audit-log-v1";
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

  function currentEmployee() {
    return window.JRC_CURRENT_EMPLOYEE || null;
  }

  function hasPermission(permission) {
    if (typeof window.jrcHasPermission !== "function") return true;
    return window.jrcHasPermission(permission, currentEmployee());
  }

  function isAdminLike() {
    return hasPermission("admin.access");
  }

  function roleTone() {
    const employee = currentEmployee();
    const role = employee?.role || "员工";
    if (isAdminLike()) {
      return {
        title: "总览工作台",
        badge: "全局管理",
        intro: "这里放全校区今天最该先看的事项：数据状态、待办和试用风险。",
        welcome: `${employee?.name || "管理员"}，今天先看全局有没有漏项；老师们具体工作不需要都看这些管理数据。`
      };
    }
    if (role === "学管") {
      return {
        title: "学管工作台",
        badge: "学生与家长",
        intro: "这里优先放招生跟进、学生服务、教学质量和家长沟通相关事项。",
        welcome: `${employee?.name || "学管老师"}，今天重点看家长有没有要跟、学生服务有没有要补、试听反馈有没有漏。`
      };
    }
    if (role === "财务") {
      return {
        title: "财务工作台",
        badge: "结算核对",
        intro: "这里优先放财务数据和需要结算核对的事项。",
        welcome: `${employee?.name || "财务老师"}，今天先看财务系统里的收入、支出和结算口径是否需要补录。`
      };
    }
    if (role === "授课老师") {
      return {
        title: "老师工作台",
        badge: "上课与反馈",
        intro: "这里会尽量只放和上课、课表、建议反馈有关的事项。",
        welcome: `${employee?.name || "老师"}，这里不放复杂管理报表；主要看课表入口、教学质量反馈和建议系统。`
      };
    }
    return {
      title: "今日工作台",
      badge: "我的事项",
      intro: "这里会根据岗位显示今天和你有关的提醒。",
      welcome: `${employee?.name || "你好"}，先看这里，再进入对应系统处理。`
    };
  }

  function getSystemOrder() {
    const employee = currentEmployee();
    const role = employee?.role || "";
    if (isAdminLike()) {
      return ["paike", "admissions", "finance", "teachingQuality", "studentService", "hr", "suggestions", "knowledge", "curriculum", "campus"];
    }
    if (role === "学管") {
      return ["admissions", "studentService", "teachingQuality", "paike", "knowledge", "campus", "suggestions", "curriculum", "finance", "hr"];
    }
    if (role === "财务") {
      return ["finance", "paike", "suggestions", "admissions", "teachingQuality", "studentService", "hr", "knowledge", "curriculum", "campus"];
    }
    if (role === "授课老师") {
      return ["paike", "campus", "teachingQuality", "studentService", "curriculum", "suggestions", "knowledge", "admissions", "finance", "hr"];
    }
    return ["paike", "knowledge", "suggestions", "finance", "admissions", "teachingQuality", "studentService", "curriculum", "hr", "campus"];
  }

  function reorderSystemCards() {
    const cards = Array.from(document.querySelectorAll("[data-system-card]"));
    if (cards.length === 0) return;
    const holder = cards[0].parentElement;
    const order = getSystemOrder();
    cards
      .sort((a, b) => {
        const aKey = a.getAttribute("data-system-card") || "";
        const bKey = b.getAttribute("data-system-card") || "";
        const aAllowed = hasPermission(a.getAttribute("data-requires-permission-card") || "");
        const bAllowed = hasPermission(b.getAttribute("data-requires-permission-card") || "");
        if (aAllowed !== bAllowed) return aAllowed ? -1 : 1;
        const aIndex = order.includes(aKey) ? order.indexOf(aKey) : 999;
        const bIndex = order.includes(bKey) ? order.indexOf(bKey) : 999;
        return aIndex - bIndex;
      })
      .forEach((card) => holder.appendChild(card));
  }

  function readAuditCount() {
    const rows = safeParse(localStorage.getItem(auditKey), []);
    return Array.isArray(rows) ? rows.length : 0;
  }

  function readStore(key, fallback = null) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function setRoleCopy() {
    const tone = roleTone();
    if ($("portalTodayTitle")) $("portalTodayTitle").textContent = tone.title;
    if ($("portalRoleBadge")) $("portalRoleBadge").textContent = tone.badge;
    if ($("portalTodayIntro")) $("portalTodayIntro").textContent = tone.intro;
    if ($("portalRoleWelcome")) $("portalRoleWelcome").textContent = tone.welcome;
  }

  function setManagementVisibility() {
    const visible = isAdminLike();
    const localDataCard = $("portalLocalDataCard");
    const dataStateSection = $("portalDataStateSection");
    const dataContractSection = $("portalDataContractSection");
    if (localDataCard) localDataCard.hidden = !visible;
    if (dataStateSection) dataStateSection.hidden = !visible;
    if (dataContractSection) dataContractSection.hidden = !visible;
  }

  function renderPortalDashboard() {
    setRoleCopy();
    setManagementVisibility();
    reorderSystemCards();
    const { leads, pending } = readAdmissions();
    const auditCount = readAuditCount();
    const employeeState = getEmployeeState();
    const paikeReviewCount = getPaikeReviewCount();
    const qualityOpenTickets = getTeachingQualityOpenTickets();

    if ($("portalAdmissionsCount")) $("portalAdmissionsCount").textContent = String(leads.length);
    if ($("portalAdmissionsTodoCount")) $("portalAdmissionsTodoCount").textContent = String(pending.length);
    if ($("portalAuditCount")) $("portalAuditCount").textContent = String(auditCount);

    const todos = [];
    if (hasPermission("admissions.access") && pending.length > 0) {
      todos.push(todoItem(
        "紧急",
        `招生系统有 ${pending.length} 条待处理线索`,
        "包含待分配、缺字段、新建未联系、试听后待转化或 A 类高意向未报名线索。",
        "/jrcedu/advice-system/index.html",
        "处理招生"
      ));
    } else if (hasPermission("admissions.access")) {
      todos.push(todoItem(
        "正常",
        "招生系统暂无紧急待办",
        "继续录入真实线索后，首页会自动显示需要跟进的客户。",
        "/jrcedu/advice-system/index.html",
        "进入招生"
      ));
    }

    if (hasPermission("paike.access") && paikeReviewCount > 0) {
      todos.push(todoItem(
        "紧急",
        `排课系统有 ${paikeReviewCount} 条待确认项`,
        "老师 Excel 导入后留下的疑问、缺教室、命名不一致或待排课老师拍板事项，需要优先清理。",
        "./paike.html",
        "处理排课"
      ));
    }

    if (hasPermission("teachingQuality.access") && qualityOpenTickets.length > 0) {
      todos.push(todoItem(
        "提醒",
        `教学质量有 ${qualityOpenTickets.length} 条未闭环整改`,
        "当前多为演示样例，但正式试用前要确认哪些是真实整改，哪些只是示例。",
        "./teaching-quality.html",
        "看教学质量"
      ));
    }

    if (hasPermission("hr.access") && employeeState.missing > 0) {
      todos.push(todoItem(
        "提醒",
        `员工资料还有 ${employeeState.missing} 人待补齐`,
        "优先补手机号、微信号、入职日期、岗位和权限，后面会影响登录、财务和人事统计。",
        "./hr-training.html",
        "人事培训"
      ));
    }

    if (isAdminLike() && auditCount === 0) {
      todos.push(todoItem(
        "提醒",
        "操作日志还没有形成记录",
        "多人试用时，请尽量通过系统新增、修改、导入，不要只在群里口头改。",
        "./suggestions.html",
        "看日志"
      ));
    }

    if (hasPermission("finance.access")) {
      todos.push(todoItem(
        "提醒",
        "财务系统可继续补录收入、支出和结算数据",
        "今天如果有课时费、报销、成本或分红口径调整，建议先录进财务系统，后面接云库时更容易迁移。",
        "./finance.html",
        "进入财务"
      ));
    }

    if (hasPermission("suggestions.access")) {
      todos.push(todoItem(
        "正常",
        "有想法可以随时丢进建议系统",
        "试用期里，哪里不好用、哪里看不懂、哪里和老师习惯不一致，都可以先记下来。",
        "./suggestions.html",
        "提交建议"
      ));
    }

    if (todos.length === 0) {
      todos.push(todoItem(
        "正常",
        "今天没有必须处理的系统提醒",
        "可以从下面的系统入口进入自己的工作模块；如果发现不好用，先到建议系统留一条。",
        "./suggestions.html",
        "写建议"
      ));
    }

    const holder = $("portalTodoList");
    if (holder) holder.innerHTML = todos.join("");

    renderDataStates();
    renderDataFlows();
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

  function renderDataFlows() {
    const holder = $("portalDataFlowList");
    if (!holder) return;
    const foundation = window.JRC_DATA_FOUNDATION;
    if (!foundation?.deriveSystemLinks) {
      holder.innerHTML = `<div class="data-state-card"><strong>联动层未加载</strong><span class="badge status-warn">待检查</span><p>请刷新页面，或检查统一登录脚本是否加载成功。</p></div>`;
      return;
    }
    const derived = foundation.deriveSystemLinks();
    const countCards = [
      ["排课课次", derived.counts.scheduleRows],
      ["招生线索", derived.counts.admissionsRows],
      ["质量档案", derived.counts.teachingQualityTeachers],
      ["员工主数据", derived.counts.employees]
    ].map(([label, count]) => `
      <div class="data-state-card">
        <strong>${escapeHtml(label)}</strong>
        <span class="badge ${count > 0 ? "status-ok" : "status-warn"}">${escapeHtml(count)}</span>
        <p>${count > 0 ? "已进入底层联动统计。" : "等待重新导入真实数据后参与联动。"}</p>
      </div>
    `).join("");
    const flowCards = (derived.rules || []).map((rule) => `
      <div class="data-state-card">
        <strong>${escapeHtml(rule.from)} → ${escapeHtml(rule.to)}</strong>
        <span class="badge status-ok">规则已建</span>
        <p>${escapeHtml(rule.rule)}</p>
      </div>
    `).join("");
    const financePreview = (derived.teacherMonthRows || []).slice(0, 4).map((row) => `
      <div class="data-state-card">
        <strong>${escapeHtml(row.teacherName)}｜${escapeHtml(row.period)}</strong>
        <span class="badge status-ok">财务预核算</span>
        <p>${escapeHtml(row.financeBasis)}${row.commissionRate ? `；提成 ${escapeHtml(row.commissionRate)}` : ""}</p>
      </div>
    `).join("");
    holder.innerHTML = countCards + flowCards + (financePreview || `
      <div class="data-state-card">
        <strong>财务预核算草表</strong>
        <span class="badge status-warn">待导入</span>
        <p>重新导入真实排课、教学质量和招生数据后，这里会按老师和月份形成课时、评级系数、招生实收的联动草表。</p>
      </div>
    `);
  }

  document.addEventListener("DOMContentLoaded", renderPortalDashboard);
})();
