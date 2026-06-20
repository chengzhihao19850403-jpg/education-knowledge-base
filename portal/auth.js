const JRC_AUTH_STORAGE_KEY = "jrc-portal-auth-session";
const JRC_ROLE_PERMISSIONS = {
  管理员: [
    "portal.access",
    "paike.access",
    "suggestions.access",
    "admin.access"
  ],
  学管: [
    "portal.access",
    "paike.access",
    "knowledge.access",
    "suggestions.access"
  ],
  财务: [
    "portal.access",
    "suggestions.access",
    "finance.access",
    "finance.edit"
  ],
  授课老师: [
    "portal.access",
    "paike.access",
    "suggestions.access"
  ]
};

const JRC_EMPLOYEES = [
  {
    name: "周珊",
    username: "zhoushan",
    password: "10281028",
    role: "学管",
    phone: "15212968215",
    wechat: "Azs-20210113",
    scope: "1-9",
    hireDate: "2025-09-01",
    regularDate: "2025-10-01",
    subject: ""
  },
  {
    name: "高芳燕",
    username: "gaofangyan",
    password: "10281028",
    role: "学管",
    phone: "17879352353",
    wechat: "jiujiujiujiumii",
    scope: "小课1-9",
    hireDate: "2025-09-11",
    regularDate: "2025-10-11",
    subject: ""
  },
  {
    name: "颜雨涵",
    username: "yanyuhan",
    password: "10281028",
    role: "学管",
    phone: "18892619946",
    wechat: "18892619946",
    scope: "1-4年级",
    hireDate: "2023-07-14",
    regularDate: "2023-07-14",
    subject: ""
  },
  {
    name: "徐嘉丽",
    username: "xujiali",
    password: "10281028",
    role: "学管",
    phone: "18379947202",
    wechat: "Pluto--Sco-20L",
    scope: "5-6年级",
    hireDate: "2026-03-16",
    regularDate: "2026-04-16",
    subject: ""
  },
  {
    name: "张艳",
    username: "zhangyan",
    password: "10281028",
    role: "学管",
    phone: "18257757570",
    wechat: "wxid_23k2fz90s2m522",
    scope: "科学",
    hireDate: "2026-05-23",
    regularDate: "",
    subject: "科学"
  },
  {
    name: "程志豪",
    username: "chengzhihao",
    password: "10281028",
    role: "管理员",
    phone: "15888003051",
    wechat: "jrc-math",
    scope: "1-9年级",
    hireDate: "2016-06-20",
    regularDate: "2016-07-20",
    subject: "数学",
    commissionRate: "100%"
  },
  {
    name: "陈雨晴",
    username: "chenyuqing",
    password: "10281028",
    role: "财务",
    phone: "15259085997",
    wechat: "YQZH5208598",
    scope: "1-9",
    hireDate: "2020-10-02",
    regularDate: "2020-11-02",
    subject: ""
  },
  {
    name: "海滢滢",
    username: "haiyingying",
    password: "10281028",
    role: "授课老师",
    phone: "18758400721",
    wechat: "cathy125805",
    scope: "3-8年级",
    hireDate: "2021-03-20",
    regularDate: "2021-04-20",
    subject: "科学",
    commissionRate: "50%"
  },
  {
    name: "叶源泽",
    username: "yeyuanze",
    password: "10281028",
    role: "授课老师",
    phone: "",
    wechat: "",
    scope: "",
    hireDate: "",
    regularDate: "",
    subject: "",
    commissionRate: ""
  },
  {
    name: "李舒",
    username: "lishu",
    password: "10281028",
    role: "授课老师",
    phone: "19155389323",
    wechat: "19155389323",
    scope: "1-3",
    hireDate: "2025-07-05",
    regularDate: "2025-08-05",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "刘大君",
    username: "liudajun",
    password: "10281028",
    role: "授课老师",
    phone: "15639466839",
    wechat: "15639466839",
    scope: "初三",
    hireDate: "2024-01-20",
    regularDate: "2024-01-20",
    subject: "数学",
    commissionRate: "33.33%"
  },
  {
    name: "吴水琴",
    username: "wushuiqin",
    password: "10281028",
    role: "授课老师",
    phone: "18056627068",
    wechat: "fmkkii555",
    scope: "1-6年级",
    hireDate: "2026-05-16",
    regularDate: "2026-06-16",
    subject: "小学数学",
    commissionRate: "20%"
  },
  {
    name: "朱永乐",
    username: "zhuyongle",
    password: "10281028",
    role: "授课老师",
    phone: "15205843546",
    wechat: "L2577593964",
    scope: "初一",
    hireDate: "2025-12-12",
    regularDate: "2026-06-12",
    subject: "科学",
    commissionRate: "20%"
  },
  {
    name: "郑嘉艺",
    username: "zhengjiayi",
    password: "10281028",
    role: "授课老师",
    phone: "15968088762",
    wechat: "Joyee-yiyi",
    scope: "1-9",
    hireDate: "2025-12-22",
    regularDate: "2026-01-22",
    subject: "初二",
    commissionRate: "20%"
  },
  {
    name: "赵萱",
    username: "zhaoxuan",
    password: "10281028",
    role: "授课老师",
    phone: "15938462313",
    wechat: "zx15938462313",
    scope: "六年级",
    hireDate: "2025-09-08",
    regularDate: "2025-10-08",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "曹德顺",
    username: "caodeshun",
    password: "10281028",
    role: "授课老师",
    phone: "18003276656",
    wechat: "cds030418",
    scope: "初二",
    hireDate: "2026-04-23",
    regularDate: "2026-05-23",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "潘云贵",
    username: "panyungui",
    password: "10281028",
    role: "授课老师",
    phone: "13114114478",
    wechat: "UNomnipotentyouth",
    scope: "五年级",
    hireDate: "2026-04-22",
    regularDate: "2026-05-22",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "何建军",
    username: "hejianjun",
    password: "10281028",
    role: "授课老师",
    phone: "13065696203",
    wechat: "lypwas2127793792",
    scope: "五年级",
    hireDate: "2026-04-10",
    regularDate: "2026-05-10",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "吴建勇",
    username: "wujianyong",
    password: "10281028",
    role: "授课老师",
    phone: "17816636255",
    wechat: "-Woey1228",
    scope: "五年级",
    hireDate: "2026-05-20",
    regularDate: "2026-06-20",
    subject: "数学",
    commissionRate: "20%"
  }
];

const JRC_SUPER_ADMIN_USERNAMES = ["chengzhihao", "chenyuqing", "haiyingying"];
const JRC_FINANCE_ADMIN_USERNAMES = ["chenyuqing", "liudajun", "chengzhihao"];
const JRC_PAIKE_ADMIN_USERNAMES = ["zhoushan", "chenyuqing", "chengzhihao"];
const JRC_KNOWLEDGE_ADMIN_USERNAMES = ["yanyuhan", "gaofangyan", "chengzhihao"];
const JRC_SUGGESTION_ADMIN_USERNAMES = ["zhaoxuan", "chengzhihao"];
const JRC_ADMISSIONS_ADMIN_USERNAMES = ["chenyuqing", "chengzhihao", "yanyuhan", "gaofangyan"];

function jrcReadSession() {
  try {
    return JSON.parse(localStorage.getItem(JRC_AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function jrcWriteSession(employee) {
  const session = {
    username: employee.username,
    name: employee.name,
    role: employee.role,
    loginAt: new Date().toISOString()
  };
  localStorage.setItem(JRC_AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

function jrcClearSession() {
  localStorage.removeItem(JRC_AUTH_STORAGE_KEY);
}

function jrcFindEmployeeByUsername(username) {
  return JRC_EMPLOYEES.find((employee) => employee.username === username);
}

function jrcResolveCurrentEmployee() {
  const session = jrcReadSession();
  if (!session?.username) return null;
  return jrcFindEmployeeByUsername(session.username) || null;
}

function jrcGetPermissions(subject) {
  if (!subject) return [];
  if (typeof subject === "string") {
    return JRC_ROLE_PERMISSIONS[subject] || [];
  }

  const permissions = new Set(JRC_ROLE_PERMISSIONS[subject.role] || []);
  const username = subject.username;

  if (!username) return Array.from(permissions);

  permissions.add("portal.access");
  permissions.add("paike.access");
  permissions.add("suggestions.access");

  if (subject.role !== "授课老师") {
    permissions.add("knowledge.access");
  }

  if (JRC_SUPER_ADMIN_USERNAMES.includes(username)) {
    [
      "portal.access",
      "paike.access",
      "paike.edit",
      "knowledge.access",
      "knowledge.edit",
      "suggestions.access",
      "suggestions.edit",
      "admissions.access",
      "admissions.edit",
      "admissions.import",
      "admissions.finance",
      "finance.access",
      "finance.edit",
      "admin.access"
    ].forEach((permission) => permissions.add(permission));
  }

  if (JRC_PAIKE_ADMIN_USERNAMES.includes(username)) {
    permissions.add("paike.edit");
  }
  if (JRC_KNOWLEDGE_ADMIN_USERNAMES.includes(username)) {
    permissions.add("knowledge.access");
    permissions.add("knowledge.edit");
  }
  if (JRC_SUGGESTION_ADMIN_USERNAMES.includes(username)) {
    permissions.add("suggestions.edit");
  }
  if (JRC_ADMISSIONS_ADMIN_USERNAMES.includes(username)) {
    permissions.add("admissions.access");
    permissions.add("admissions.edit");
    permissions.add("admissions.import");
    permissions.add("admissions.finance");
  }
  if (JRC_FINANCE_ADMIN_USERNAMES.includes(username)) {
    permissions.add("finance.access");
    permissions.add("finance.edit");
  }

  return Array.from(permissions);
}

function jrcHasPermission(permissionKey, employee = jrcResolveCurrentEmployee()) {
  if (!employee) return false;
  return jrcGetPermissions(employee).includes(permissionKey);
}

function jrcGetRoleSummary(employee = jrcResolveCurrentEmployee()) {
  if (!employee) return "";
  const permissions = jrcGetPermissions(employee);
  const summaries = [];
  if (permissions.includes("paike.access")) summaries.push("排课");
  if (permissions.includes("admissions.access")) summaries.push("招生");
  if (permissions.includes("finance.access")) summaries.push("财务");
  if (permissions.includes("knowledge.access")) summaries.push("知识库");
  if (permissions.includes("suggestions.access")) summaries.push("建议");
  return summaries.join(" / ") || "仅登录访问";
}

function jrcEnsureTopbar(currentEmployee) {
  const topbar = document.createElement("div");
  topbar.className = "jrc-auth-bar";
  topbar.innerHTML = `
    <div class="jrc-auth-bar__inner">
      <div>
        <strong>${currentEmployee.name}</strong>
        <span>${currentEmployee.role} · 用户名 ${currentEmployee.username} · 当前开放：${jrcGetRoleSummary(currentEmployee)}</span>
      </div>
      <div class="jrc-auth-bar__actions">
        <span>统一初始密码：10281028</span>
        <button type="button" id="jrcLogoutButton">退出登录</button>
      </div>
    </div>
  `;
  document.body.prepend(topbar);
  document.getElementById("jrcLogoutButton")?.addEventListener("click", () => {
    jrcClearSession();
    window.location.reload();
  });
}

function jrcEnsureEmployeeSummary() {
  const holder = document.querySelector("[data-employee-summary]");
  if (!holder) return;
  holder.innerHTML = `
    <strong>当前已录入 ${JRC_EMPLOYEES.length} 名员工账号</strong>
    <span>用户名统一用姓名拼音；初始密码统一为 10281028。当前已经接入基础岗位权限，不同岗位看到的系统入口会开始区分。</span>
  `;
}

function jrcApplyPermissionDecorations(currentEmployee) {
  document.querySelectorAll("[data-requires-permission]").forEach((node) => {
    const permission = node.getAttribute("data-requires-permission");
    if (!permission) return;
    const allowed = jrcHasPermission(permission, currentEmployee);
    if (allowed) return;

    const isLink = node.tagName === "A";
    node.classList.add("jrc-locked");
    node.setAttribute("aria-disabled", "true");
    node.setAttribute("title", "当前岗位暂未开放");
    if (isLink) {
      node.setAttribute("data-jrc-href", node.getAttribute("href") || "");
      node.setAttribute("href", "javascript:void(0)");
    } else if ("disabled" in node) {
      node.disabled = true;
    }
  });

  document.querySelectorAll("[data-requires-permission-card]").forEach((node) => {
    const permission = node.getAttribute("data-requires-permission-card");
    if (!permission) return;
    const allowed = jrcHasPermission(permission, currentEmployee);
    if (allowed) return;
    node.classList.add("jrc-card-locked");
    const note = document.createElement("div");
    note.className = "jrc-card-lock-note";
    note.textContent = "当前岗位暂未开放";
    node.appendChild(note);
  });

  document.querySelectorAll("[data-role-greeting]").forEach((node) => {
    node.textContent = `${currentEmployee.name}｜${currentEmployee.role}｜当前开放：${jrcGetRoleSummary(currentEmployee)}`;
  });
}

function jrcEnforcePagePermission(currentEmployee) {
  const requiredPermission =
    document.body?.getAttribute("data-page-permission") ||
    document.documentElement?.getAttribute("data-page-permission");
  if (!requiredPermission) return true;
  if (jrcHasPermission(requiredPermission, currentEmployee)) return true;

  const main = document.querySelector("main");
  if (main) {
    main.style.display = "none";
  }

  const blocker = document.createElement("div");
  blocker.className = "jrc-page-block";
  blocker.innerHTML = `
    <div class="jrc-page-block__card">
      <p class="jrc-page-block__eyebrow">Access Restricted</p>
      <h2>当前岗位暂未开放这个系统</h2>
      <p>你已经成功登录，但当前账号没有进入这个页面的权限。请返回工作台，使用已开放的系统入口，或者后续再由管理员调整岗位权限。</p>
      <div class="jrc-page-block__actions">
        <a href="/jrcedu/portal/index.html">返回统一工作台</a>
      </div>
    </div>
  `;
  document.body.appendChild(blocker);
  return false;
}

function jrcInjectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .jrc-auth-bar {
      position: sticky;
      top: 0;
      z-index: 40;
      backdrop-filter: blur(10px);
      background: rgba(15, 23, 42, 0.86);
      color: #fff;
      border-bottom: 1px solid rgba(255,255,255,0.12);
    }
    .jrc-auth-bar__inner {
      width: min(1380px, calc(100vw - 28px));
      margin: 0 auto;
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 4px;
      font-size: 13px;
    }
    .jrc-auth-bar__inner strong {
      display: block;
      font-size: 14px;
    }
    .jrc-auth-bar__inner span {
      color: rgba(255,255,255,0.76);
    }
    .jrc-auth-bar__actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .jrc-auth-bar button {
      min-height: 34px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.1);
      color: #fff;
      cursor: pointer;
      font: inherit;
    }
    .jrc-login-overlay {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.58);
      backdrop-filter: blur(8px);
    }
    .jrc-login-card {
      width: min(520px, 100%);
      background: rgba(255,255,255,0.98);
      color: #172132;
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      padding: 28px;
    }
    .jrc-login-card h2,
    .jrc-login-card p {
      margin: 0;
    }
    .jrc-login-card p {
      color: #5b6778;
      line-height: 1.7;
    }
    .jrc-login-fields {
      display: grid;
      gap: 14px;
      margin-top: 18px;
    }
    .jrc-login-fields label {
      display: grid;
      gap: 6px;
      font-size: 14px;
      color: #172132;
    }
    .jrc-login-fields input {
      width: 100%;
      min-height: 44px;
      border-radius: 14px;
      border: 1px solid rgba(23, 33, 50, 0.14);
      padding: 0 14px;
      font: inherit;
    }
    .jrc-login-submit {
      margin-top: 18px;
      width: 100%;
      min-height: 46px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: #fff;
      font: inherit;
      cursor: pointer;
    }
    .jrc-login-error {
      min-height: 20px;
      margin-top: 10px;
      color: #b91c1c;
      font-size: 13px;
    }
    [data-employee-summary] {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .jrc-locked {
      opacity: 0.55;
      cursor: not-allowed !important;
      pointer-events: none;
    }
    .jrc-card-locked {
      position: relative;
    }
    .jrc-card-lock-note {
      margin-top: 14px;
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 12px;
      border-radius: 999px;
      font-size: 12px;
      background: rgba(15, 23, 42, 0.08);
      color: #475569;
    }
    .jrc-page-block {
      min-height: calc(100vh - 52px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
    }
    .jrc-page-block__card {
      width: min(560px, 100%);
      background: rgba(255,255,255,0.98);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
      padding: 28px;
      color: #172132;
    }
    .jrc-page-block__eyebrow {
      margin: 0 0 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0d9488;
      font-weight: 700;
    }
    .jrc-page-block__card h2,
    .jrc-page-block__card p {
      margin: 0;
    }
    .jrc-page-block__card p {
      margin-top: 12px;
      color: #5b6778;
      line-height: 1.7;
    }
    .jrc-page-block__actions {
      margin-top: 18px;
    }
    .jrc-page-block__actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: #fff;
      text-decoration: none;
    }
  `;
  document.head.appendChild(style);
}

function jrcShowLoginOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "jrc-login-overlay";
  overlay.innerHTML = `
    <div class="jrc-login-card">
      <p style="font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#0d9488; font-weight:700;">JRC Employee Login</p>
      <h2 style="margin-top:8px;">先登录，再进入系统</h2>
      <p style="margin-top:12px;">现在网站已经接入员工登录。只有已录入的公司员工账号可以进入和使用各个系统。用户名统一用姓名拼音，初始密码统一为 10281028。</p>
      <form id="jrcLoginForm" class="jrc-login-fields">
        <label>
          用户名
          <input id="jrcUsernameInput" autocomplete="username" placeholder="例如：zhoushan">
        </label>
        <label>
          密码
          <input id="jrcPasswordInput" type="password" autocomplete="current-password" placeholder="统一初始密码">
        </label>
        <button class="jrc-login-submit" type="submit">登录进入工作台</button>
      </form>
      <div id="jrcLoginError" class="jrc-login-error"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("jrcLoginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = document.getElementById("jrcUsernameInput")?.value.trim().toLowerCase();
    const password = document.getElementById("jrcPasswordInput")?.value.trim();
    const employee = jrcFindEmployeeByUsername(username);
    const errorBox = document.getElementById("jrcLoginError");

    if (!employee || employee.password !== password) {
      if (errorBox) errorBox.textContent = "用户名或密码不正确，请用员工姓名拼音登录。";
      return;
    }

    jrcWriteSession(employee);
    window.location.reload();
  });
}

function jrcBootstrapAuth() {
  jrcInjectStyles();
  jrcEnsureEmployeeSummary();
  window.JRC_EMPLOYEES = JRC_EMPLOYEES;
  window.JRC_ROLE_PERMISSIONS = JRC_ROLE_PERMISSIONS;
  window.jrcHasPermission = jrcHasPermission;
  const currentEmployee = jrcResolveCurrentEmployee();
  if (!currentEmployee) {
    jrcShowLoginOverlay();
    return;
  }
  jrcEnsureTopbar(currentEmployee);
  window.JRC_CURRENT_EMPLOYEE = currentEmployee;
  jrcApplyPermissionDecorations(currentEmployee);
  jrcEnforcePagePermission(currentEmployee);
}

jrcBootstrapAuth();
