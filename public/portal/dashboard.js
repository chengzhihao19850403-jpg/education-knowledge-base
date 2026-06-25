(function () {
  const admissionsKey = "advice-system-stage-prototype";
  const auditKey = "jrc-business-audit-log-v1";
  const suggestionsKey = "jrc-suggestion-management-v2";
  const moduleOwnerTasks = [
    {
      key: "admissions",
      system: "招生管理系统",
      owner: "颜雨涵",
      ownerUsername: "yanyuhan",
      href: "/jrcedu/advice-system/index.html",
      guide: "使用逻辑：新线索录入 → 跟进记录 → 预约试听 → 试听反馈 → 报名建档 → 归属链锁定 → 导出和看板统计。\n试用重点：检查新增、搜索、筛选、导出 Excel、试听反馈、报名归属解锁、转介绍排序、顾问日周月年统计是否顺手。\n联动重点：报名数据要能进入学生服务和财务候选，试听课要能进入教学质量和家长反馈采集。"
    },
    {
      key: "finance",
      system: "财务系统",
      owner: "刘大君",
      ownerUsername: "liudajun",
      href: "./finance.html",
      guide: "使用逻辑：选择月份 → 查看老师结算入口 → 导入/核对工资与课时原表 → 查看差异 → 点名结算联动 → 导出月度汇总。\n试用重点：核对五月、六月数据是否能按老师、月份、排课行、工资行看清楚；老师结算结果和核对结果入口是否明显。\n联动重点：排课、点名、出门测、教学质量评级和招生实收只做候选草算，最终发薪仍由财务复核。"
    },
    {
      key: "curriculum",
      system: "教研与课程产品系统",
      owner: "赵萱",
      ownerUsername: "zhaoxuan",
      href: "./curriculum-products.html",
      guide: "使用逻辑：按年级权限进入 → 选择年级/体系/课次/资料类型 → 批量上传课件、PDF、Word、图片 → 搜索下载 → 重复资料自动更新版本。\n试用重点：检查一到六年级资料权限、批量上传、去重、版本更新、下载和手机/iPad 操作是否顺手。\n联动重点：资料要逐步沉淀成标准课件库，方便老师备课、打印、复用和新老师培训。"
    },
    {
      key: "paike",
      system: "排课系统",
      owner: "周珊",
      ownerUsername: "zhoushan",
      href: "./paike.html",
      guide: "使用逻辑：导入/查看课表 → 核对老师、学生、教室、时间 → 处理冲突和缺教室 → 调课/停课/补课留痕 → 同步点名和财务候选。\n试用重点：按原 Excel 排课习惯核对六月课表，检查手机和平板查看课表、筛选老师、提交调课是否清楚。\n联动重点：排课是财务课时、学生点名、课销、教学质量问卷的基础数据源。"
    },
    {
      key: "student-service",
      system: "学生与家长服务系统",
      owner: "高芳燕",
      ownerUsername: "gaofangyan",
      href: "./student-service.html",
      guide: "使用逻辑：学生档案 → 点名签到 → 出门测成绩 → 缺席追踪 → 课后反馈 → 家长沟通 → 续费风险。\n试用重点：检查 iPad 点名勾选、缺席处理、出门测录分、AI 课堂反馈归档、已归档反馈查看是否顺手。\n联动重点：点名影响老师课时费和家长课销；出门测和课堂反馈要进入学管沟通依据。"
    },
    {
      key: "suggestions",
      system: "建议与任务协同系统",
      owner: "叶源泽",
      ownerUsername: "yeyuanze",
      href: "./suggestions.html",
      guide: "使用逻辑：员工提交问题/建议 → 大家支持点赞 → 管理员派任务 → 负责人提交完成反馈 → 提出人复核是否解决。\n试用重点：检查建议列表是否清楚、派任务负责人下拉是否好用、完成反馈是否能闭环、提出人是否能看到整改状态。\n联动重点：这里是全站优化入口，所有模块问题都应该能沉淀、分派、完成、复核。"
    },
    {
      key: "knowledge",
      system: "学管知识库系统",
      owner: "程志豪",
      ownerUsername: "chengzhihao",
      href: "./knowledge.html",
      guide: "使用逻辑：输入关键词 → 查询标准答案/制度/话术 → 查看来源 → 用于学管培训和家长沟通。\n试用重点：检查搜索结果是否能回答学管常见问题，知识点是否准确，入口名称是否不会让授课老师误解。\n联动重点：后续可承接学管培训、标准话术、制度答疑和新人考试。"
    },
    {
      key: "hr",
      system: "人事与培训系统",
      owner: "陈雨晴",
      ownerUsername: "chenyuqing",
      href: "./hr-training.html",
      guide: "使用逻辑：员工档案 → 岗位权限 → 入职转正 → 培训记录 → 考核结果 → 提成档位。\n试用重点：检查员工名单、岗位、权限、负责年级、培训记录是否清楚；新增员工流程是否能看懂。\n联动重点：人事权限会影响每个人能看到哪些系统、能新增/编辑/导出哪些数据。"
    },
    {
      key: "ai",
      system: "AI 助手",
      owner: "李舒",
      ownerUsername: "lishu",
      href: "./ai-assistant.html",
      guide: "使用逻辑：文字/语音输入 → 选择课堂反馈、招生跟进、任务说明等模式 → AI 整理 → 老师确认 → 归档学生服务或转成任务。\n试用重点：重点试课堂反馈模板、草稿库 50 条、已归档反馈查看、复制家长文案、失败提示是否清楚。\n联动重点：AI 不是直接替老师发消息，而是把老师口述整理成可编辑草稿，再归档到学生服务。"
    },
    {
      key: "teaching-quality",
      system: "教学质量系统",
      owner: "郑嘉艺",
      ownerUsername: "zhengjiayi",
      href: "./teaching-quality.html",
      guide: "使用逻辑：抽样巡课 → 学生/家长问卷 → 老师个人趋势 → 整改工单 → 复查闭环。\n试用重点：检查老师端是否只看本人趋势和建议，不公开排名；管理端是否能看整改、问卷和质控数据。\n联动重点：教学质量结果用于帮助改进和绩效候选，不适合公开排名刺激老师。"
    }
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
  const cloudBusinessStores = [
    { key: "advice-system-stage-prototype", label: "招生管理", risk: "可录入跟进" },
    { key: "jrc-finance-ledger-v1", label: "财务系统", risk: "需财务复核" },
    { key: "jrc-student-service-v2", label: "学生服务", risk: "需和点名核对" },
    { key: "jrc-teaching-quality-system-v2-demo", label: "教学质量", risk: "按真实采集记录统计" },
    { key: "jrc-suggestion-management-v2", label: "建议系统", risk: "持续收集" },
    { key: "jrc-hr-training-tasks-v2", label: "人事培训", risk: "账号权限已接入" },
    { key: "jrc-campus-operations-v2", label: "校区运营", risk: "可先查看" },
    { key: "jrc-curriculum-products-v2", label: "教研课程", risk: "资料待补" }
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
        intro: "这里放全校区今天最该先看的事项：数据状态、待办和核对重点。",
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
      return ["ai", "paike", "admissions", "finance", "teachingQuality", "studentService", "hr", "suggestions", "knowledge", "curriculum", "campus"];
    }
    if (role === "学管") {
      return ["ai", "admissions", "studentService", "teachingQuality", "paike", "knowledge", "campus", "suggestions", "curriculum", "finance", "hr"];
    }
    if (role === "财务") {
      return ["ai", "finance", "paike", "suggestions", "admissions", "teachingQuality", "studentService", "hr", "knowledge", "curriculum", "campus"];
    }
    if (role === "授课老师") {
      return ["ai", "paike", "campus", "teachingQuality", "studentService", "curriculum", "suggestions", "knowledge", "admissions", "finance", "hr"];
    }
    return ["ai", "paike", "knowledge", "suggestions", "finance", "admissions", "teachingQuality", "studentService", "curriculum", "hr", "campus"];
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
      return { label: "待录入", className: "status-warn", detail: "当前账号还没有读取到本系统业务数据。" };
    }
    if (config.type === "teachingQuality") {
      return { label: "采集中", className: "status-warn", detail: `当前 ${count} 条记录，按真实巡课、问卷和整改数据统计。` };
    }
    return { label: "已读取", className: "status-ok", detail: `当前账号读取到 ${count} 条/类记录，云端状态见下方落地状态。` };
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
        <span class="badge ${className}">${escapeHtml(level)}</span>
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(detail)}</p>
        </div>
        <a class="text-link" href="${escapeHtml(href)}">${escapeHtml(actionText)}</a>
      </div>
    `;
  }

  function isOpenTask(item) {
    return ["assigned", "doing"].includes(item?.status);
  }

  function taskDueLevel(item) {
    if (!item?.dueDate || ["launched", "review", "paused"].includes(item.status)) return "正常";
    const due = new Date(`${item.dueDate}T00:00:00`);
    const now = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
    const diffDays = Math.ceil((due - now) / 86400000);
    if (diffDays < 0) return "紧急";
    if (diffDays <= 1) return "提醒";
    return "正常";
  }

  function taskStatusText(status) {
    return {
      assigned: "已转任务",
      doing: "执行中",
      review: "已完成",
      launched: "已完成",
      paused: "暂缓"
    }[status] || "待处理";
  }

  function buildModuleOwnerTask(task) {
    const date = "2026-06-26";
    return {
      id: `module-owner-${task.key}`,
      entryType: "task",
      title: `【模块负责人】${task.system}试用监管`,
      category: "技术工具",
      impact: "high",
      content: `责任人：${task.owner}\n负责模块：${task.system}\n\n${task.guide}\n\n试用闭环：发现问题请直接点右下角“反馈问题”；管理员处理后，要在“我的反馈问题”里复核，已解决就确认，没解决就继续补充反馈。`,
      author: "系统分派",
      authorUsername: "",
      anonymous: false,
      createdAt: date,
      status: "assigned",
      owner: task.owner,
      ownerUsername: task.ownerUsername,
      dueDate: "",
      verifier: "程志豪",
      taskId: `task-module-owner-${task.key}`,
      taskStandard: `把${task.system}试到“老师能理解、能操作、能发现问题、能闭环整改”的程度。`,
      subtasks: [
        `1. 先按使用逻辑完整走一遍${task.system}。`,
        "2. 记录看不懂、不顺手、数据不对、手机/iPad不好点的地方。",
        "3. 把问题通过右下角“反馈问题”提交，不要只在群里口头说。",
        "4. 管理员处理后，在“我的反馈问题”里复核是否真的解决。",
        "5. 仍有问题就继续反馈，直到模块能稳定落地。"
      ].join("\n"),
      completionReport: "",
      rewardLevel: "none",
      rewardAmount: "",
      rewardReason: "",
      rewardStatus: "none",
      votes: 0,
      votedBy: [],
      liked: false,
      decision: `${task.owner}负责${task.system}试用监管、问题整理和整改复核。`,
      comments: [{ author: "系统", text: "模块负责人任务已自动分派。", time: date }],
      moduleOwnerTask: true,
      moduleKey: task.key,
      moduleHref: task.href
    };
  }

  function mergeModuleOwnerTasks(rows) {
    const list = Array.isArray(rows) ? [...rows] : [];
    let changed = false;
    const byId = new Map(list.map((item) => [String(item?.id || ""), item]));
    moduleOwnerTasks.forEach((task) => {
      const seed = buildModuleOwnerTask(task);
      const current = byId.get(seed.id);
      if (!current) {
        list.unshift(seed);
        changed = true;
        return;
      }
      const updated = {
        ...current,
        title: seed.title,
        category: seed.category,
        impact: seed.impact,
        content: seed.content,
        owner: seed.owner,
        ownerUsername: seed.ownerUsername,
        verifier: seed.verifier,
        taskId: current.taskId || seed.taskId,
        taskStandard: seed.taskStandard,
        subtasks: seed.subtasks,
        decision: seed.decision,
        moduleOwnerTask: true,
        moduleKey: seed.moduleKey,
        moduleHref: seed.moduleHref,
        entryType: "task",
        status: ["review", "launched", "paused"].includes(current.status) ? current.status : (current.status || seed.status)
      };
      if (JSON.stringify(updated) !== JSON.stringify(current)) {
        Object.assign(current, updated);
        changed = true;
      }
    });
    return { rows: list, changed };
  }

  function taskRelatedToCurrentUser(item) {
    const employee = currentEmployee();
    const name = employee?.name || "";
    const username = String(employee?.username || "").trim().toLowerCase();
    if (!name && !username) return false;
    return String(item.owner || "") === name || String(item.ownerUsername || "").trim().toLowerCase() === username;
  }

  async function readSuggestionTasks() {
    let rows = readStore(suggestionsKey, []);
    let cloudHydrated = false;
    if (window.JRC_CLOUD?.readModuleData) {
      try {
        const result = await window.JRC_CLOUD.readModuleData(suggestionsKey);
        if (result?.ok && result.data?.found && Array.isArray(result.data.payload)) {
          rows = result.data.payload;
          cloudHydrated = true;
          localStorage.setItem(suggestionsKey, JSON.stringify(rows));
        }
      } catch (error) {
        console.warn("Failed to read cloud suggestion tasks", error);
      }
    }
    const merged = mergeModuleOwnerTasks(rows);
    if (merged.changed) {
      rows = merged.rows;
      localStorage.setItem(suggestionsKey, JSON.stringify(rows));
      if (window.JRC_CLOUD?.writeModuleData && (!window.JRC_CLOUD?.readModuleData || cloudHydrated)) {
        window.JRC_CLOUD.writeModuleData(suggestionsKey, "suggestions", rows, { replaceMode: "replace" }).catch((error) => {
          console.warn("Failed to sync module owner tasks", error);
        });
      }
    }
    return Array.isArray(rows) ? rows : [];
  }

  async function renderMyTasks() {
    const holder = $("portalMyTaskList");
    if (!holder) return;
    if (!hasPermission("suggestions.access")) {
      holder.innerHTML = todoItem("正常", "当前账号未开通任务入口", "需要使用任务协同时，由管理员在人事培训系统里开通建议任务权限。", "./index.html", "返回工作台");
      return;
    }
    const rows = await readSuggestionTasks();
    const tasks = rows
      .filter((item) => isOpenTask(item) && taskRelatedToCurrentUser(item))
      .sort((left, right) => {
        const levelRank = { "紧急": 0, "提醒": 1, "正常": 2 };
        const levelDiff = levelRank[taskDueLevel(left)] - levelRank[taskDueLevel(right)];
        if (levelDiff !== 0) return levelDiff;
        return String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31"));
      });
    if ($("portalMyTaskBadge")) $("portalMyTaskBadge").textContent = String(tasks.length);
    holder.innerHTML = tasks.length ? tasks.slice(0, 6).map((task) => {
      const level = taskDueLevel(task);
      const dueText = task.dueDate ? `截止 ${task.dueDate}` : "未设截止时间";
      const title = `${level === "紧急" ? "逾期：" : ""}${task.title || "未命名任务"}`;
      const detail = `${taskStatusText(task.status)}｜负责人 ${task.owner || "未分配"}｜${dueText}`;
      return todoItem(level, title, detail, "./suggestions.html", "处理任务");
    }).join("") : todoItem(
      "正常",
      "暂无待办任务",
      "有新任务时会显示在这里。",
      "./suggestions.html",
      "进入建议任务"
    );
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
    const cloudReadinessSection = $("portalCloudReadinessSection");
    const dataContractSection = $("portalDataContractSection");
    if (localDataCard) localDataCard.hidden = !visible;
    if (dataStateSection) dataStateSection.hidden = !visible;
    if (cloudReadinessSection) cloudReadinessSection.hidden = !visible;
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
        "请按真实巡课、问卷和教务复查结果处理整改闭环。",
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
        "多人使用时，请尽量通过系统新增、修改、导入，不要只在群里口头改。",
        "./suggestions.html",
        "看日志"
      ));
    }

    if (hasPermission("finance.access")) {
      todos.push(todoItem(
        "提醒",
        "财务系统可继续补录收入、支出和结算数据",
        "今天如果有课时费、报销、成本或分红口径调整，建议先录进财务系统，接云库时更容易迁移。",
        "./finance.html",
        "进入财务"
      ));
    }

    if (hasPermission("suggestions.access")) {
      todos.push(todoItem(
        "正常",
        "有想法可以随时丢进建议系统",
        "哪里不好用、哪里看不懂、哪里和老师习惯不一致，都可以先记下来。",
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
    renderMyTasks();

    renderDataStates();
    renderCloudReadiness();
    renderDataFlows();
    renderLinkHealth();
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

  function readinessCard(title, label, className, detail) {
    return `
      <div class="cloud-readiness-card">
        <strong>${escapeHtml(title)}</strong>
        <span class="badge ${className}">${escapeHtml(label)}</span>
        <p>${escapeHtml(detail)}</p>
      </div>
    `;
  }

  function countCloudPayload(payload) {
    if (Array.isArray(payload)) return payload.length;
    if (!payload || typeof payload !== "object") return 0;
    if (Array.isArray(payload.leads)) return payload.leads.length;
    if (payload.periods || payload.expenses) return Object.keys(payload.periods || {}).length + (payload.expenses || []).length;
    if (Array.isArray(payload.tickets) || Array.isArray(payload.inspections)) return (payload.tickets || []).length + (payload.inspections || []).length;
    return Object.keys(payload).length;
  }

  function normalizeCloudStorePayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (payload.parsedValue && typeof payload.parsedValue === "object") return payload.parsedValue;
    if (typeof payload.rawValue === "string") {
      try {
        return JSON.parse(payload.rawValue);
      } catch {
        return payload;
      }
    }
    return payload;
  }

  async function readLinkedStore(key, fallback) {
    let value = readStore(key, fallback);
    if (window.JRC_CLOUD?.readModuleData) {
      try {
        const result = await window.JRC_CLOUD.readModuleData(key);
        if (result?.ok && result.data?.found) {
          value = normalizeCloudStorePayload(result.data.payload);
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch (error) {
        console.warn("Failed to read linked store", key, error);
      }
    }
    return value ?? fallback;
  }

  function attendanceSessionKey(session) {
    return [
      session?.date,
      session?.teacher,
      session?.className
    ].map((value) => String(value || "").trim()).join("|");
  }

  function attendanceStudentKey(session, row) {
    return [
      session?.date,
      session?.teacher,
      session?.className,
      row?.studentName || row?.student
    ].map((value) => String(value || "").trim()).join("|");
  }

  function scheduleStudentKey(row) {
    return [
      row?.date || row?.courseDate,
      row?.teacherName || row?.teacher,
      row?.className,
      row?.studentName || row?.student
    ].map((value) => String(value || "").trim()).join("|");
  }

  function isEffectiveAttendance(row) {
    return ["到课", "迟到"].includes(row?.status) || String(row?.exitScore ?? "").trim() !== "";
  }

  function linkHealthCard(title, label, className, detail, href, actionText = "查看") {
    return `
      <a class="data-state-card" href="${escapeHtml(href || "./index.html")}" style="text-decoration:none;">
        <strong>${escapeHtml(title)}</strong>
        <span class="badge ${className}">${escapeHtml(label)}</span>
        <p>${escapeHtml(detail)}</p>
        <p style="color:#bc582e;font-weight:800;">${escapeHtml(actionText)}</p>
      </a>
    `;
  }

  async function renderCloudReadiness() {
    const holder = $("portalCloudReadinessList");
    if (!holder) return;
    const cloudEnabled = Boolean(window.JRC_CLOUD?.isEnabled?.());
    holder.innerHTML = [
      readinessCard("网站前端", "已上云", "status-ok", "正式网址运行在阿里云香港服务器，通过 www.jrcwork.cn 访问。"),
      readinessCard("后端 API", cloudEnabled ? "已接入" : "待登录", cloudEnabled ? "登录、权限、模块数据接口已接入 /api。" : "当前页面还没有检测到云接口登录状态，请重新登录后查看。"),
      readinessCard("员工账号权限", "已接入", "status-ok", "员工登录、岗位权限和总管理员入口已经走统一体系。"),
      readinessCard("业务模块数据", "检测中", "status-warn", "正在读取招生、财务、学生服务、教学质量等模块云端记录。"),
      readinessCard("历史 Excel 原表", "待导入核对", "status-warn", "排课、课时费、财务和分红原表需要逐批导入并与人工表核对。")
    ].join("");
    if (!cloudEnabled || !window.JRC_CLOUD?.readModuleData) return;

    const results = await Promise.all(cloudBusinessStores.map(async (store) => {
      try {
        const result = await window.JRC_CLOUD.readModuleData(store.key);
        const found = Boolean(result.ok && result.data?.found);
        const count = found ? countCloudPayload(result.data.payload) : 0;
        return { ...store, found, count };
      } catch {
        return { ...store, found: false, count: 0, failed: true };
      }
    }));
    const foundCount = results.filter((item) => item.found).length;
    const totalCount = results.reduce((sum, item) => sum + item.count, 0);
    const moduleSummary = foundCount
      ? `已检测到 ${foundCount}/${results.length} 个模块有云端记录，共 ${totalCount} 条/类数据。`
      : "当前还没有检测到业务模块云端记录，老师录入后会逐步出现。";
    const moduleClass = foundCount ? "status-ok" : "status-warn";
    const moduleLabel = foundCount ? "部分已入云" : "待录入";
    const moduleDetails = results
      .map((item) => `${item.label}${item.found ? ` ${item.count}` : " 0"}`)
      .join("；");

    holder.innerHTML = [
      readinessCard("网站前端", "已上云", "status-ok", "正式网址运行在阿里云香港服务器，通过 www.jrcwork.cn 访问。"),
      readinessCard("后端 API", "已接入", "status-ok", "登录、权限、模块数据接口已接入 /api，并由云端鉴权保护。"),
      readinessCard("员工账号权限", "已接入", "status-ok", "员工登录、岗位权限和总管理员入口已经走统一体系。"),
      readinessCard("业务模块数据", moduleLabel, moduleClass, `${moduleSummary} ${moduleDetails}`),
      readinessCard("历史 Excel 原表", "待导入核对", "status-warn", "排课、课时费、财务和分红原表需要逐批导入；涉及钱和课销的数据不直接自动认定为正式结果。")
    ].join("");
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
        <span class="badge status-ok">财务结算草表</span>
        <p>${escapeHtml(row.financeBasis)}${row.commissionRate ? `；提成 ${escapeHtml(row.commissionRate)}` : ""}</p>
      </div>
    `).join("");
    holder.innerHTML = countCards + flowCards + (financePreview || `
      <div class="data-state-card">
        <strong>财务结算草表</strong>
        <span class="badge status-warn">待导入</span>
        <p>重新导入真实排课、教学质量和招生数据后，这里会按老师和月份形成课时、教学系数、招生实收的联动草表。</p>
      </div>
    `);
  }

  async function renderLinkHealth() {
    const holder = $("portalLinkHealthList");
    if (!holder) return;
    holder.innerHTML = `
      <div class="data-state-card">
        <strong>正在自检</strong>
        <span class="badge status-warn">读取中</span>
        <p>正在检查排课、点名、学生服务和财务之间的数据流转。</p>
      </div>
    `;
    const foundation = window.JRC_DATA_FOUNDATION;
    const derived = foundation?.deriveSystemLinks?.() || { scheduleRows: [], counts: {} };
    const [paikeRegular, attendanceSessions, studentRows, financeState] = await Promise.all([
      readLinkedStore("paike-june-system-v1", {}),
      readLinkedStore("jrc-class-attendance-v1", []),
      readLinkedStore("jrc-student-service-v2", []),
      readLinkedStore("jrc-finance-ledger-v1", {})
    ]);
    const regularEntries = Array.isArray(paikeRegular?.scheduleEntries) ? paikeRegular.scheduleEntries : [];
    const scheduleRows = Array.isArray(derived.scheduleRows) && derived.scheduleRows.length
      ? derived.scheduleRows
      : regularEntries.map((entry) => ({
          date: entry.courseDate || entry.date || "",
          teacherName: entry.teacherName || entry.teacher || "",
          className: entry.className || "",
          studentName: entry.studentName || entry.className || ""
        }));
    const sessions = Array.isArray(attendanceSessions) ? attendanceSessions : [];
    const studentServiceRows = Array.isArray(studentRows) ? studentRows : [];
    const attendanceStudentKeys = new Set(
      sessions.flatMap((session) => (Array.isArray(session.rows) ? session.rows : [])
        .map((row) => attendanceStudentKey(session, row)))
        .filter(Boolean)
    );
    const scheduleStudentKeys = new Set(scheduleRows.map(scheduleStudentKey).filter(Boolean));
    const serviceLinkedKeys = new Set(
      studentServiceRows
        .filter((row) => row.sourceModule === "attendance" || row.sourceSessionId)
        .map((row) => [
          row.sourceDate,
          row.teacher,
          row.className,
          row.student
        ].map((value) => String(value || "").trim()).join("|"))
        .filter(Boolean)
    );
    const attendanceSessionKeys = new Set(sessions.map(attendanceSessionKey).filter(Boolean));
    const unresolvedCount = sessions.reduce((sum, session) => sum + (Array.isArray(session.rows) ? session.rows : [])
      .filter((row) => !isEffectiveAttendance(row) || row.followup === "待联系家长").length, 0);
    const effectiveCount = sessions.reduce((sum, session) => sum + (Array.isArray(session.rows) ? session.rows : [])
      .filter(isEffectiveAttendance).length, 0);
    const scheduleWithoutAttendance = [...scheduleStudentKeys].filter((key) => key && !attendanceStudentKeys.has(key)).length;
    const attendanceWithoutService = [...attendanceStudentKeys].filter((key) => key && !serviceLinkedKeys.has(key)).length;
    const financePeriods = financeState?.periods && typeof financeState.periods === "object" ? Object.keys(financeState.periods).length : 0;
    const hasFinanceAttendance = sessions.length > 0;

    const cards = [
      linkHealthCard(
        "排课 → 点名",
        scheduleRows.length ? (scheduleWithoutAttendance ? "有待点名" : "已覆盖") : "待导入",
        scheduleRows.length && !scheduleWithoutAttendance ? "status-ok" : "status-warn",
        scheduleRows.length
          ? `排课明细 ${scheduleRows.length} 人次；仍有约 ${scheduleWithoutAttendance} 人次未形成点名记录。`
          : "还没有读取到排课明细，需先导入或维护排课。",
        "./paike.html",
        "看排课"
      ),
      linkHealthCard(
        "点名 → 学生服务",
        sessions.length ? (attendanceWithoutService ? "待沉淀" : "已沉淀") : "待点名",
        sessions.length && !attendanceWithoutService ? "status-ok" : "status-warn",
        sessions.length
          ? `已保存点名 ${sessions.length} 节 / ${attendanceStudentKeys.size} 人次；约 ${attendanceWithoutService} 人次未进入学生服务台账。`
          : "还没有点名记录。老师保存点名后会自动流入学生服务。",
        "./student-service.html",
        "看学生服务"
      ),
      linkHealthCard(
        "点名 → 财务",
        hasFinanceAttendance ? "已接入" : "待点名",
        hasFinanceAttendance ? "status-ok" : "status-warn",
        hasFinanceAttendance
          ? `财务可读取 ${sessions.length} 节点名，当前有效到课 ${effectiveCount} 人次，待追踪 ${unresolvedCount} 人次。`
          : "财务等待学生服务系统保存点名后生成结算草表。",
        "./finance.html#attendanceFinanceSection",
        "看财务"
      ),
      linkHealthCard(
        "财务月结",
        financePeriods ? "已有草表" : "待录入",
        financePeriods ? "status-ok" : "status-warn",
        financePeriods
          ? `财务系统已有 ${financePeriods} 个月份草表；点名结算仍需财务复核后确认。`
          : "还没有月结草表，先用点名和原 Excel 对照，确认后再补月结数据。",
        "./finance.html",
        "看月结"
      )
    ];
    holder.innerHTML = cards.join("");
  }

  document.addEventListener("DOMContentLoaded", renderPortalDashboard);
})();
