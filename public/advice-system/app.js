const STORAGE_KEY = "advice-system-stage-prototype";

const defaultState = {
  activeLeadFilter: "all",
  selectedLeadName: "张同学",
  employees: [],
  auditLogs: [],
  importSummary: {
    added: 0,
    duplicates: 0,
    missingOwner: 0,
    missingFields: 0,
    results: [],
  },
  leads: [
    {
      studentName: "张同学",
      parentPhone: "138****2165",
      grade: "六年级",
      subject: "数学",
      channel: "抖音投流",
      channelMeta: "网销归属：叶老师",
      channelOwner: "叶老师",
      referrerName: "",
      owner: "陈老师",
      status: "已沟通待邀约",
      trial: "未预约",
      intent: "A 高意向",
      inGroup: "未进群",
      lastFollowup: "今天 10:20",
      note: "关心提分速度和老师稳定性",
      nextAction: "今晚发案例，明天定试听时间",
      trialTeacher: "",
      trialTime: "",
      enrolledAmount: 0,
      attributionLocked: false,
      attributionSnapshot: null,
      renewalRecords: [],
      financeProfile: null,
    },
    {
      studentName: "李同学",
      parentPhone: "139****8721",
      grade: "初一",
      subject: "数学",
      channel: "老家长转介绍",
      channelMeta: "推荐人：王妈妈",
      channelOwner: "",
      referrerName: "王妈妈",
      owner: "何老师",
      status: "已预约试听",
      trial: "6 月 22 日 19:00",
      intent: "B 中意向",
      inGroup: "已进群",
      lastFollowup: "今天 09:15",
      note: "已确认到场",
      nextAction: "试听后当天必须回填反馈",
      trialTeacher: "刘老师",
      trialTime: "2026-06-22T19:00",
      enrolledAmount: 0,
      attributionLocked: false,
      attributionSnapshot: null,
      renewalRecords: [],
      financeProfile: null,
    },
    {
      studentName: "周同学",
      parentPhone: "136****5549",
      grade: "五年级",
      subject: "数学",
      channel: "自然到访",
      channelMeta: "校区前台登记",
      channelOwner: "前台",
      referrerName: "",
      owner: "赵老师",
      status: "试听完成待转化",
      trial: "已试听",
      intent: "A 高意向",
      inGroup: "已进群",
      lastFollowup: "昨天 18:40",
      note: "家长认可刘老师，价格有异议",
      nextAction: "48 小时内给报名方案",
      trialTeacher: "刘老师",
      trialTime: "2026-06-19T18:00",
      enrolledAmount: 6200,
      attributionLocked: true,
      attributionSnapshot: {
        channel: "自然到访",
        channelOwner: "前台",
        owner: "赵老师",
        referrerName: "",
      },
      renewalRecords: [],
      financeProfile: {
        settledAmount: 6200,
        pendingCommission: "待结算",
        referralReward: "无",
      },
    },
  ],
  teachingQuality: {
    selectedTeacher: "刘大君",
    weights: {
      inspection: 35,
      studentSurvey: 20,
      parentSurvey: 35,
      objective: 10,
    },
    gradeRules: [
      { grade: "S", min: 90, coefficient: 1.1, label: "优秀教师" },
      { grade: "A", min: 80, coefficient: 1.0, label: "达标优质" },
      { grade: "B", min: 70, coefficient: 0.9, label: "待提升" },
      { grade: "C", min: 0, coefficient: 0.8, label: "不合格" },
    ],
    inspections: [
      {
        teacher: "刘大君",
        className: "初三数学冲刺班",
        lessonType: "在读班",
        date: "2026-06-18",
        scores: [92, 88, 90, 94, 91],
        note: "课堂节奏稳定，压轴题讲解清晰，薄弱学生答疑还可以再多留 5 分钟。",
        tags: ["分层关注"],
        attachment: "板书照片 1 张",
      },
      {
        teacher: "叶源泽",
        className: "初一数学暑假预备班",
        lessonType: "试听课",
        date: "2026-06-19",
        scores: [84, 80, 82, 86, 88],
        note: "互动不错，但例题梯度可以再清晰，试听后家长希望看到更明确的提分路径。",
        tags: ["试听转化观察"],
        attachment: "课堂记录截图",
      },
      {
        teacher: "海滢滢",
        className: "科学三升四小班",
        lessonType: "在读班",
        date: "2026-06-17",
        scores: [87, 89, 86, 90, 92],
        note: "课堂趣味性和耐心较好，家长沟通反馈要继续保持及时。",
        tags: [],
        attachment: "无",
      },
      {
        teacher: "李舒",
        className: "二年级数学提升班",
        lessonType: "在读班",
        date: "2026-06-16",
        scores: [76, 74, 72, 80, 78],
        note: "课堂秩序管理偏弱，个别学生走神较多，建议教务一周后复查。",
        tags: ["重点整改"],
        attachment: "课堂记录截图",
      },
    ],
    studentSurveys: [
      { teacher: "刘大君", className: "初三数学冲刺班", date: "2026-06-18", score: 91, suggestion: "讲题很清楚，希望多给几道类似题。" },
      { teacher: "叶源泽", className: "初一数学暑假预备班", date: "2026-06-19", score: 84, suggestion: "老师有耐心，练习时间可以多一点。" },
      { teacher: "海滢滢", className: "科学三升四小班", date: "2026-06-17", score: 90, suggestion: "实验例子有意思。" },
      { teacher: "李舒", className: "二年级数学提升班", date: "2026-06-16", score: 75, suggestion: "课堂有点吵。" },
    ],
    parentSurveys: [
      { teacher: "刘大君", className: "初三数学冲刺班", type: "在读", date: "2026-06-18", score: 88, tags: ["续课意愿高"], suggestion: "课后反馈很及时。" },
      { teacher: "叶源泽", className: "李同学试听", type: "试听", date: "2026-06-19", score: 82, tags: ["价格匹配度顾虑"], suggestion: "认可老师，但想再比较价格。" },
      { teacher: "海滢滢", className: "科学三升四小班", type: "在读", date: "2026-06-17", score: 91, tags: ["转介绍意愿高"], suggestion: "孩子回家愿意复述课堂内容。" },
      { teacher: "李舒", className: "二年级数学提升班", type: "在读", date: "2026-06-16", score: 72, tags: ["反馈不及时", "关注孩子不足"], suggestion: "希望老师多反馈孩子课堂情况。" },
    ],
    objectiveMetrics: [
      { teacher: "刘大君", renewalRate: 92, trialConversionRate: 66, referrals: 2, feedbackRecords: 18, complaints: 0, lateRecords: 0, missedHomework: 1, missedMakeup: 0 },
      { teacher: "叶源泽", renewalRate: 82, trialConversionRate: 45, referrals: 1, feedbackRecords: 11, complaints: 0, lateRecords: 1, missedHomework: 1, missedMakeup: 0 },
      { teacher: "海滢滢", renewalRate: 88, trialConversionRate: 50, referrals: 2, feedbackRecords: 14, complaints: 0, lateRecords: 0, missedHomework: 0, missedMakeup: 0 },
      { teacher: "李舒", renewalRate: 70, trialConversionRate: 36, referrals: 0, feedbackRecords: 6, complaints: 1, lateRecords: 1, missedHomework: 2, missedMakeup: 1 },
    ],
    improvementTickets: [
      {
        id: "TQ-202606-001",
        teacher: "李舒",
        source: "巡课低分 + 家长问卷低分",
        problem: "课堂秩序管理、课后反馈及时性不足",
        dueDate: "2026-06-25",
        status: "待教师提交整改",
        plan: "",
        review: "教务一周后复查同班课堂。",
      },
      {
        id: "TQ-202606-002",
        teacher: "叶源泽",
        source: "试听转化观察",
        problem: "试听课提分路径表达不够明确",
        dueDate: "2026-06-24",
        status: "整改中",
        plan: "补充试听后学情反馈模板，明确三周提升目标。",
        review: "下次试听后复盘成交反馈。",
      },
    ],
    templates: [
      { type: "学生匿名问卷", enabled: true, sendAfter: "课程结束后 30 分钟", questions: "易懂程度、趣味性、答疑耐心、作业难度、课堂收获" },
      { type: "在读家长问卷", enabled: true, sendAfter: "每月抽样推送", questions: "课堂吸收、课后反馈、回复速度、责任心、续课意愿、转介绍意愿" },
      { type: "试听家长问卷", enabled: true, sendAfter: "试听结束后 2 小时", questions: "试听满意度、未报名异议、意向等级、是否进培育群" },
    ],
  },
  followups: [
    { studentName: "张同学", time: "2026-06-20 10:20", text: "陈老师电话沟通。家长关注六升初衔接，主要担心应用题和计算能力，接受先试听再决定。" },
    { studentName: "张同学", time: "2026-06-20 10:35", text: "已发送课程案例和暑假班时间表。下一步：今晚确认试听时间，争取约到周末前。" },
    { studentName: "周同学", time: "2026-06-19 18:40", text: "试听已完成。家长认可刘老师，但对价格有比较。状态先转试听完成待转化，必须 48 小时内给报名方案。" },
  ],
};

const state = loadState();

const statusClassMap = {
  "已沟通待邀约": "amber",
  "试听完成待转化": "red",
};

const ownerOptions = ["待分配", "陈老师", "何老师", "赵老师"];
const trialTeacherOptions = ["刘老师", "叶老师", "陈老师", "何老师"];
const channelOptions = ["待补来源", "抖音投流", "老家长转介绍", "自然到访", "官网表单"];
const channelOwnerOptions = ["待补渠道归属", "叶老师", "陈老师", "何老师", "赵老师", "前台"];

function byId(id) {
  return document.getElementById(id);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function persistState() {
  try {
    if (Array.isArray(window.JRC_EMPLOYEES) && window.JRC_EMPLOYEES.length) {
      state.employees = window.JRC_EMPLOYEES.map((employee) => ({
        name: employee.name,
        username: employee.username,
        role: employee.role,
        phone: employee.phone,
        wechat: employee.wechat,
        scope: employee.scope,
        hireDate: employee.hireDate,
        regularDate: employee.regularDate || "",
        subject: employee.subject || "",
        commissionRate: employee.commissionRate || ""
      }));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function getCurrentEmployee() {
  return window.JRC_CURRENT_EMPLOYEE || null;
}

function hasPermission(permissionKey) {
  if (typeof window.jrcHasPermission === "function") {
    return window.jrcHasPermission(permissionKey, getCurrentEmployee());
  }
  return true;
}

function canEditAdmissions() {
  return hasPermission("admissions.edit");
}

function canImportAdmissions() {
  return hasPermission("admissions.import");
}

function canViewAdmissionFinance() {
  return hasPermission("admissions.finance") || hasPermission("finance.access");
}

function canManageTeachingQuality() {
  return (
    hasPermission("admin.access") ||
    hasPermission("admissions.edit") ||
    hasPermission("knowledge.edit") ||
    hasPermission("teachingQuality.edit")
  );
}

function formatNowStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getOperatorLabel() {
  const employee = getCurrentEmployee();
  if (!employee) return "系统访客";
  return `${employee.name}（${employee.role}）`;
}

function logAudit(action, studentName, detail) {
  if (!Array.isArray(state.auditLogs)) {
    state.auditLogs = [];
  }
  state.auditLogs.unshift({
    time: formatNowStamp(),
    operator: getOperatorLabel(),
    action,
    studentName: studentName || "-",
    detail
  });
  state.auditLogs = state.auditLogs.slice(0, 120);
}

function formatTrialDisplay(trialTime) {
  if (!trialTime) return "待确认时间";
  return trialTime.replace("T", " ");
}

function normalizeDateTimeLocal(value) {
  if (!value) return "";
  if (value.includes("T")) return value.slice(0, 16);
  if (value.includes(" ")) return value.replace(" ", "T").slice(0, 16);
  return value;
}

function getSelectedLead() {
  return (
    state.leads.find((item) => item.studentName === state.selectedLeadName) ||
    state.leads[0] ||
    null
  );
}

function deriveReferrerText(channelMeta) {
  if (!channelMeta) return "无";
  if (channelMeta.includes("推荐人：")) {
    return channelMeta.replace("推荐人：", "").trim() || "无";
  }
  return "无";
}

function deriveChannelOwner(lead) {
  if (lead.channelOwner) return lead.channelOwner;
  if (lead.channelMeta?.includes("网销归属：")) {
    return lead.channelMeta.replace("网销归属：", "").trim() || "待补渠道归属";
  }
  if (lead.channel === "自然到访") return "前台";
  return "待补渠道归属";
}

function buildChannelMeta(channel, channelOwner, referrerName) {
  if (channel === "老家长转介绍" && referrerName) return `推荐人：${referrerName}`;
  if ((channel === "抖音投流" || channel === "官网表单") && channelOwner && channelOwner !== "待补渠道归属") {
    return `网销归属：${channelOwner}`;
  }
  if (channel === "自然到访" && channelOwner && channelOwner !== "待补渠道归属") {
    return `${channelOwner}登记`;
  }
  if (referrerName) return `推荐人：${referrerName}`;
  return "待补推荐人";
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function createImportResult(studentName, status, detail) {
  return { studentName, status, detail };
}

function buildAttributionSnapshot(lead) {
  return {
    channel: lead.channel,
    channelOwner: deriveChannelOwner(lead),
    owner: lead.owner,
    referrerName: lead.referrerName || deriveReferrerText(lead.channelMeta) || "",
  };
}

function formatAttributionSnapshot(snapshot) {
  if (!snapshot) return "未锁定";
  return `${snapshot.channel} / ${snapshot.channelOwner} / ${snapshot.owner}${snapshot.referrerName ? ` / 推荐人 ${snapshot.referrerName}` : ""}`;
}

function buildFinanceSettlementSummary(lead) {
  const attribution = lead.attributionLocked && lead.attributionSnapshot
    ? lead.attributionSnapshot
    : buildAttributionSnapshot(lead);
  const financeProfile = lead.financeProfile || {
    settledAmount: lead.enrolledAmount || 0,
    pendingCommission: "待结算",
    referralReward: attribution.referrerName ? "待判断" : "无",
  };
  return {
    firstPaidAmount: lead.enrolledAmount || 0,
    totalPaidAmount: financeProfile.settledAmount,
    consultantOwner: attribution.owner,
    channelSettlementOwner: attribution.channelOwner,
    referralSettlementOwner: attribution.referrerName || "无",
    commissionStatus: financeProfile.pendingCommission,
    referralRewardStatus: financeProfile.referralReward,
  };
}

function collectMissingLeadFields(lead) {
  const missing = [];
  if (!lead.channel || lead.channel === "待补来源") missing.push("缺来源渠道");
  if (!lead.owner || lead.owner === "待分配") missing.push("缺负责人");
  if ((lead.channel === "抖音投流" || lead.channel === "官网表单") && (!deriveChannelOwner(lead) || deriveChannelOwner(lead) === "待补渠道归属")) {
    missing.push("缺渠道归属");
  }
  if (lead.channel === "老家长转介绍" && !lead.referrerName && deriveReferrerText(lead.channelMeta) === "无") {
    missing.push("缺推荐人");
  }
  if (!lead.note || lead.note === "待补首条记录") missing.push("缺首条备注");
  return missing;
}

function syncSelectedLead(leadName) {
  if (!leadName) return;
  const exists = state.leads.some((lead) => lead.studentName === leadName);
  if (!exists) return;
  state.selectedLeadName = leadName;

  const followupSelect = byId("followupLeadSelect");
  if (followupSelect) followupSelect.value = leadName;

  const feedbackSelect = byId("feedbackLeadSelect");
  if (feedbackSelect && Array.from(feedbackSelect.options).some((option) => option.value === leadName)) {
    feedbackSelect.value = leadName;
  }

  const trialSelect = byId("trialLeadSelect");
  if (trialSelect && Array.from(trialSelect.options).some((option) => option.value === leadName)) {
    trialSelect.value = leadName;
  }

  const enrollInput = byId("enrollStudentName");
  if (enrollInput) enrollInput.value = leadName;
}

function renderLeadTable() {
  const body = byId("leadTableBody");
  if (!body) return;
  const editable = canEditAdmissions();
  const filteredLeads = state.leads.filter((lead) => {
    if (state.activeLeadFilter === "new") return lead.status === "新建未联系";
    if (state.activeLeadFilter === "trial")
      return lead.status === "已预约试听" || lead.status === "试听完成待转化";
    if (state.activeLeadFilter === "enrolled") return lead.status === "定金 / 已报名";
    return true;
  });
  body.innerHTML = filteredLeads
    .map(
      (lead) => `
        <tr>
          <td>${lead.studentName}<br>家长：${lead.parentPhone}<br>${lead.grade} / ${lead.subject}</td>
          <td><span class="tag ${lead.channel.includes("转介绍") ? "green" : lead.channel.includes("自然") ? "red" : ""}">${lead.channel}</span><br>${lead.channelMeta}</td>
          <td>
            <div>招生顾问：${lead.owner}</div>
            <select data-owner-select="${lead.studentName}" ${editable ? "" : "disabled"}>
              ${ownerOptions
                .map(
                  (owner) =>
                    `<option value="${owner}" ${lead.owner === owner ? "selected" : ""}>${owner}</option>`
                )
                .join("")}
            </select>
          </td>
          <td><span class="tag ${statusClassMap[lead.status] || ""}">${lead.status}</span></td>
          <td>${lead.trial}${lead.trialTeacher ? `<br>试听老师：${lead.trialTeacher}` : ""}</td>
          <td>${lead.intent}</td>
          <td>${lead.inGroup}</td>
          <td>${lead.lastFollowup}<br>${lead.note}</td>
          <td>${lead.nextAction}</td>
          <td>
            <button class="button small secondary" type="button" data-action="view-detail" data-student="${lead.studentName}">查看详情</button>
            <button class="button small" type="button" data-action="advance-status" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>推进状态</button>
            <button class="button small secondary" type="button" data-action="assign-trial" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>预约试听</button>
            <button class="button small secondary" type="button" data-action="complete-trial" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>完成试听</button>
            <button class="button small secondary" type="button" data-action="reassign-owner" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>重分配</button>
          </td>
        </tr>
      `
    )
    .join("");
  bindLeadActions();
}

function renderTrialTable() {
  const body = byId("trialTableBody");
  if (!body) return;
  const trialLeads = state.leads.filter(
    (lead) =>
      lead.status === "已预约试听" || lead.status === "试听完成待转化"
  );
  body.innerHTML = trialLeads.length
    ? trialLeads
        .map(
          (lead) => `
        <tr>
          <td>${lead.studentName}</td>
          <td>${lead.trialTime ? formatTrialDisplay(lead.trialTime) : lead.trial}</td>
          <td>${lead.trialTeacher || "待安排"}</td>
          <td>${lead.owner}</td>
          <td>${lead.status === "已预约试听" ? "试听后回填反馈单，并决定是否转 A / B / C / D 意向。" : "已上课但还没定最终报价版本，需补反馈和报名推进意见。"}
          </td>
        </tr>
      `
        )
        .join("")
    : `
        <tr>
          <td colspan="5">当前没有待处理的试听记录。</td>
        </tr>
      `;
}

function renderFollowupLeadOptions() {
  const select = byId("followupLeadSelect");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = state.leads
    .map((lead) => `<option value="${lead.studentName}">${lead.studentName}</option>`)
    .join("");
  if (currentValue) {
    select.value = state.leads.some((lead) => lead.studentName === currentValue)
      ? currentValue
      : state.leads[0]?.studentName || "";
  }
}

function renderFeedbackLeadOptions() {
  const select = byId("feedbackLeadSelect");
  if (!select) return;
  const currentValue = select.value;
  const options = state.leads
    .filter(
      (lead) =>
        lead.status === "已预约试听" || lead.status === "试听完成待转化"
    )
    .map((lead) => `<option value="${lead.studentName}">${lead.studentName}</option>`)
    .join("");
  select.innerHTML = options || `<option value="">暂无待反馈学生</option>`;
  if (currentValue) {
    select.value = Array.from(select.options).some((option) => option.value === currentValue)
      ? currentValue
      : select.options[0]?.value || "";
  }
}

function renderLeadDetail() {
  const lead = getSelectedLead();
  if (!lead) return;
  byId("detailStudentName").textContent = lead.studentName;
  byId("detailGradeSubject").textContent = `${lead.grade} / ${lead.subject}`;
  byId("detailOwner").textContent = lead.owner;
  byId("detailStatus").textContent = lead.status;
  byId("detailChannel").textContent = lead.channel;
  byId("detailChannelMeta").textContent = lead.channelMeta;
  byId("detailNextAction").textContent = lead.nextAction;
  byId("detailFollowup").textContent = `${lead.lastFollowup} / ${lead.note}`;
  byId("detailOwnerSelect").value = lead.owner;
  byId("detailStatusSelect").value = lead.status;
  byId("detailIntentSelect").value = lead.intent;
  byId("detailInGroupSelect").value = lead.inGroup;
  byId("detailChannelOwnerSelect").value = deriveChannelOwner(lead);
  byId("detailReferrerInput").value = lead.referrerName || deriveReferrerText(lead.channelMeta) || "";
  byId("detailAttributionLock").value = lead.attributionLocked
    ? `已锁定：${formatAttributionSnapshot(lead.attributionSnapshot)}`
    : "未锁定";
  byId("detailNextActionInput").value = lead.nextAction;
  byId("detailNoteInput").value = lead.note;
}

function renderImportSummary() {
  const summary = state.importSummary || defaultState.importSummary;
  byId("importAddedCount").textContent = String(summary.added || 0);
  byId("importDuplicateCount").textContent = String(summary.duplicates || 0);
  byId("importMissingOwnerCount").textContent = String(summary.missingOwner || 0);
  byId("importMissingFieldCount").textContent = String(summary.missingFields || 0);

  const body = byId("importResultBody");
  if (!body) return;
  body.innerHTML = (summary.results || []).length
    ? summary.results
        .map(
          (item) => `
            <tr>
              <td>${item.studentName}</td>
              <td>${item.status}</td>
              <td>${item.detail}</td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>尚未执行导入</td>
          <td>待处理</td>
          <td>把 Excel 一批线索复制后粘贴到上面的文本框，再点导入。</td>
        </tr>
      `;
}

function renderPendingLeadFixes() {
  const body = byId("pendingLeadFixBody");
  if (!body) return;
  const editable = canEditAdmissions();
  const pendingLeads = state.leads
    .map((lead) => ({ lead, missing: collectMissingLeadFields(lead) }))
    .filter((item) => item.missing.length > 0);

  body.innerHTML = pendingLeads.length
    ? pendingLeads
        .map(
          ({ lead, missing }) => `
            <tr>
              <td>${lead.studentName}</td>
              <td>${lead.parentPhone}</td>
              <td>${missing.join("；")}</td>
              <td>
                <div class="section-actions">
                  <button class="button small secondary" type="button" data-action="focus-pending-lead" data-student="${lead.studentName}">定位线索</button>
                  <select data-pending-owner-select="${lead.studentName}" ${editable ? "" : "disabled"}>
                    ${ownerOptions
                      .map(
                        (owner) =>
                          `<option value="${owner}" ${lead.owner === owner ? "selected" : ""}>${owner}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small" type="button" data-action="apply-pending-owner" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补负责人</button>
                </div>
                <div class="section-actions">
                  <select data-pending-channel-select="${lead.studentName}" ${editable ? "" : "disabled"}>
                    ${channelOptions
                      .map(
                        (channel) =>
                          `<option value="${channel}" ${lead.channel === channel ? "selected" : ""}>${channel}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small secondary" type="button" data-action="apply-pending-channel" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补来源</button>
                </div>
                <div class="section-actions">
                  <select data-pending-channel-owner-select="${lead.studentName}" ${editable ? "" : "disabled"}>
                    ${channelOwnerOptions
                      .map(
                        (channelOwner) =>
                          `<option value="${channelOwner}" ${deriveChannelOwner(lead) === channelOwner ? "selected" : ""}>${channelOwner}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small secondary" type="button" data-action="apply-pending-channel-owner" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补渠道归属</button>
                </div>
                <div class="section-actions">
                  <input data-pending-referrer-input="${lead.studentName}" value="${lead.referrerName || ""}" ${editable ? "" : "disabled"}>
                  <button class="button small secondary" type="button" data-action="apply-pending-referrer" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补推荐人</button>
                </div>
                <div class="section-actions">
                  <input data-pending-note-input="${lead.studentName}" value="${lead.note === "待补首条记录" ? "" : lead.note}" ${editable ? "" : "disabled"}>
                  <button class="button small secondary" type="button" data-action="apply-pending-note" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补备注</button>
                </div>
              </td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>当前没有待补字段线索</td>
          <td>-</td>
          <td>-</td>
          <td>导入后如果有缺失，会在这里集中列出。</td>
        </tr>
      `;

  bindPendingLeadFixActions();
}

function bindPendingLeadFixActions() {
  document.querySelectorAll("[data-action='focus-pending-lead']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      syncSelectedLead(studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-owner']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const ownerSelect = document.querySelector(
        `[data-pending-owner-select="${studentName}"]`
      );
      const nextOwner = ownerSelect?.value || "待分配";
      target.owner = nextOwner;
      target.lastFollowup = "刚刚补负责人";
      target.nextAction =
        nextOwner === "待分配" ? "仍待分配负责人" : "负责人已补齐，尽快首联";
      state.followups.push({
        studentName: target.studentName,
        time: "刚刚",
        text: `在待补字段处理中补齐负责人：${nextOwner}。`,
      });
      logAudit("待补字段-补负责人", target.studentName, `改为 ${nextOwner}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-channel']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const channelSelect = document.querySelector(
        `[data-pending-channel-select="${studentName}"]`
      );
      const nextChannel = channelSelect?.value || "待补来源";
      target.channel = nextChannel;
      target.channelMeta = buildChannelMeta(nextChannel, target.channelOwner, target.referrerName);
      target.lastFollowup = "刚刚补来源";
      state.followups.push({
        studentName: target.studentName,
        time: "刚刚",
        text: `在待补字段处理中补齐来源渠道：${nextChannel}。`,
      });
      logAudit("待补字段-补来源", target.studentName, `改为 ${nextChannel}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-note']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const noteInput = document.querySelector(
        `[data-pending-note-input="${studentName}"]`
      );
      const nextNote = noteInput?.value.trim();
      if (!nextNote) return;
      target.note = nextNote;
      target.lastFollowup = "刚刚补备注";
      state.followups.push({
        studentName: target.studentName,
        time: "刚刚",
        text: `在待补字段处理中补齐首条备注：${nextNote}。`,
      });
      logAudit("待补字段-补备注", target.studentName, nextNote);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-channel-owner']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const input = document.querySelector(
        `[data-pending-channel-owner-select="${studentName}"]`
      );
      const nextChannelOwner = input?.value || "待补渠道归属";
      target.channelOwner = nextChannelOwner;
      target.channelMeta = buildChannelMeta(target.channel, target.channelOwner, target.referrerName);
      target.lastFollowup = "刚刚补渠道归属";
      state.followups.push({
        studentName: target.studentName,
        time: "刚刚",
        text: `在待补字段处理中补齐渠道归属：${nextChannelOwner}。`,
      });
      logAudit("待补字段-补渠道归属", target.studentName, `改为 ${nextChannelOwner}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-referrer']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const input = document.querySelector(
        `[data-pending-referrer-input="${studentName}"]`
      );
      const nextReferrer = input?.value.trim();
      if (!nextReferrer) return;
      target.referrerName = nextReferrer;
      target.channelMeta = buildChannelMeta(target.channel, target.channelOwner, target.referrerName);
      target.lastFollowup = "刚刚补推荐人";
      state.followups.push({
        studentName: target.studentName,
        time: "刚刚",
        text: `在待补字段处理中补齐推荐人：${nextReferrer}。`,
      });
      logAudit("待补字段-补推荐人", target.studentName, nextReferrer);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });
}

function renderEnrollmentLeadOptions() {
  const input = byId("enrollStudentName");
  if (!input) return;
  const lead = getSelectedLead();
  if (lead && lead.status !== "定金 / 已报名") {
    input.value = lead.studentName;
  } else if (!input.value) {
    const candidate = state.leads.find((leadItem) => leadItem.status !== "定金 / 已报名");
    if (candidate) {
      input.value = candidate.studentName;
    }
  }

  const activeLead =
    state.leads.find((leadItem) => leadItem.studentName === input.value) || lead;
  if (!activeLead) return;

  byId("enrollChannel").value = activeLead.channel;
  byId("enrollOwner").value = activeLead.owner;
  byId("enrollReferrer").value = activeLead.referrerName || deriveReferrerText(activeLead.channelMeta);
  byId("enrollAttributionPreview").value = formatAttributionSnapshot(buildAttributionSnapshot(activeLead));
  byId("enrollRemark").value =
    activeLead.enrolledAmount > 0
      ? `已报名，实收 ${activeLead.enrolledAmount}。后续如续费扩科，沿用当前归属链。`
      : `${activeLead.nextAction}。后续如果扩科或续费，需要继承当前顾问和来源归属。当前链路：${activeLead.channel} / ${deriveChannelOwner(activeLead)} / ${activeLead.owner}${(activeLead.referrerName || deriveReferrerText(activeLead.channelMeta)) !== "无" ? ` / 推荐人 ${activeLead.referrerName || deriveReferrerText(activeLead.channelMeta)}` : ""}`;

  byId("renewStudentName").value = activeLead.studentName;
  byId("renewAttributionPreview").value = formatAttributionSnapshot(
    activeLead.attributionLocked && activeLead.attributionSnapshot
      ? activeLead.attributionSnapshot
      : buildAttributionSnapshot(activeLead)
  );
}

function renderStudentArchive() {
  const archiveLead =
    state.leads.find((lead) => lead.status === "定金 / 已报名" && lead.studentName === state.selectedLeadName) ||
    state.leads.find((lead) => lead.status === "定金 / 已报名");

  if (!archiveLead) {
    byId("archiveStudentName").textContent = "待选择";
    byId("archiveStudentMeta").textContent = "报名后这里显示学员主信息";
    byId("archiveAttributionTitle").textContent = "未锁定";
    byId("archiveAttributionMeta").textContent = "报名后自动锁定来源、渠道归属、招生顾问、推荐人";
    byId("archiveRenewalTitle").textContent = "暂无记录";
    byId("archiveRenewalMeta").textContent = "后续每次续费扩科都从这里追踪继承链";
    byId("archiveFinanceTitle").textContent = "待结算";
    byId("archiveFinanceMeta").textContent = "预留给财务系统做实收、提成、转介绍奖励联动";
    byId("archiveDetailBody").innerHTML = `
      <tr>
        <td>档案状态</td>
        <td>当前还没有已报名学员可展示</td>
      </tr>
    `;
    byId("financeCandidateBody").innerHTML = `
      <tr>
        <td>暂无候选信息</td>
        <td>报名后这里自动汇总实收、顾问、渠道归属、推荐人、奖励口径。</td>
      </tr>
    `;
    return;
  }

  const lastRenewal = archiveLead.renewalRecords?.[archiveLead.renewalRecords.length - 1];
  const financeProfile = archiveLead.financeProfile || {
    settledAmount: archiveLead.enrolledAmount || 0,
    pendingCommission: "待结算",
    referralReward: archiveLead.referrerName ? "待判断" : "无",
  };
  const settlementSummary = buildFinanceSettlementSummary(archiveLead);

  byId("archiveStudentName").textContent = archiveLead.studentName;
  byId("archiveStudentMeta").textContent = `${archiveLead.grade} / ${archiveLead.subject} / 家长 ${archiveLead.parentPhone}`;
  byId("archiveAttributionTitle").textContent = archiveLead.attributionLocked ? "已锁定" : "未锁定";
  byId("archiveAttributionMeta").textContent = archiveLead.attributionLocked
    ? formatAttributionSnapshot(archiveLead.attributionSnapshot)
    : "当前还未完成首报锁定";
  byId("archiveRenewalTitle").textContent = lastRenewal
    ? `${lastRenewal.type} ${lastRenewal.amount}`
    : "暂无记录";
  byId("archiveRenewalMeta").textContent = lastRenewal
    ? `${lastRenewal.courseName} / ${formatAttributionSnapshot(lastRenewal.attributionSnapshot)}`
    : "后续每次续费扩科都从这里追踪继承链";
  byId("archiveFinanceTitle").textContent = `实收 ${financeProfile.settledAmount}`;
  byId("archiveFinanceMeta").textContent = `提成 ${financeProfile.pendingCommission} / 转介绍奖励 ${financeProfile.referralReward}`;

  byId("archiveDetailBody").innerHTML = `
    <tr>
      <td>首报归属链</td>
      <td>${archiveLead.attributionLocked ? formatAttributionSnapshot(archiveLead.attributionSnapshot) : "未锁定"}</td>
    </tr>
    <tr>
      <td>当前招生顾问</td>
      <td>${archiveLead.owner}</td>
    </tr>
    <tr>
      <td>累计实收</td>
      <td>${financeProfile.settledAmount}</td>
    </tr>
    <tr>
      <td>最近续费 / 扩科</td>
      <td>${lastRenewal ? `${lastRenewal.type} / ${lastRenewal.courseName} / ${lastRenewal.amount}` : "暂无记录"}</td>
    </tr>
    <tr>
      <td>财务预留</td>
      <td>提成：${financeProfile.pendingCommission}；转介绍奖励：${financeProfile.referralReward}</td>
    </tr>
  `;

  if (!canViewAdmissionFinance()) {
    byId("archiveFinanceTitle").textContent = "受限";
    byId("archiveFinanceMeta").textContent = "当前岗位可以看招生流程，但不能查看财务结算口径。";
    byId("financeCandidateBody").innerHTML = `
      <tr>
        <td>财务结算候选项</td>
        <td>当前登录岗位未开放查看。需要学管、财务或管理员账号。</td>
      </tr>
    `;
    return;
  }

  byId("financeCandidateBody").innerHTML = `
    <tr>
      <td>首报实收</td>
      <td>${settlementSummary.firstPaidAmount}</td>
    </tr>
    <tr>
      <td>累计实收</td>
      <td>${settlementSummary.totalPaidAmount}</td>
    </tr>
    <tr>
      <td>招生顾问结算口径</td>
      <td>${settlementSummary.consultantOwner}</td>
    </tr>
    <tr>
      <td>渠道归属结算口径</td>
      <td>${settlementSummary.channelSettlementOwner}</td>
    </tr>
    <tr>
      <td>推荐人奖励口径</td>
      <td>${settlementSummary.referralSettlementOwner}</td>
    </tr>
    <tr>
      <td>财务当前建议</td>
      <td>提成状态：${settlementSummary.commissionStatus}；转介绍奖励：${settlementSummary.referralRewardStatus}</td>
    </tr>
  `;
}

function renderTrialLeadOptions() {
  const select = byId("trialLeadSelect");
  if (!select) return;
  const currentValue = select.value;
  const candidates = state.leads.filter(
    (lead) =>
      lead.status !== "定金 / 已报名" && lead.status !== "无效沉睡线索"
  );
  select.innerHTML = candidates.length
    ? candidates
        .map((lead) => `<option value="${lead.studentName}">${lead.studentName}</option>`)
        .join("")
    : `<option value="">暂无可预约学生</option>`;
  const selectedLead = getSelectedLead();
  const preferredValue =
    candidates.some((lead) => lead.studentName === state.selectedLeadName)
      ? state.selectedLeadName
      : currentValue;
  select.value = Array.from(select.options).some((option) => option.value === preferredValue)
    ? preferredValue
    : select.options[0]?.value || "";

  const currentLead = candidates.find((lead) => lead.studentName === select.value) || selectedLead;
  if (!currentLead) return;
  byId("trialTeacherSelect").value = currentLead.trialTeacher || trialTeacherOptions[0];
  byId("trialTimeInput").value =
    normalizeDateTimeLocal(currentLead.trialTime) || "2026-06-25T19:00";
  byId("trialRemarkInput").value =
    currentLead.nextAction || "试听后当天必须回填反馈";
}

function renderFollowups() {
  const timeline = byId("followupTimeline");
  if (!timeline) return;
  const selectedLead = getSelectedLead();
  const targetFollowups = selectedLead
    ? state.followups.filter((item) => item.studentName === selectedLead.studentName)
    : state.followups;
  timeline.innerHTML = targetFollowups
    .slice()
    .reverse()
    .map(
      (item) => `
        <div class="timeline-item">
          <div class="timeline-time">${item.time} · ${item.studentName}</div>
          <p>${item.text}</p>
        </div>
      `
    )
    .join("") || "<div class=\"timeline-item\"><div class=\"timeline-time\">当前线索暂无跟进记录</div><p>先补第一条沟通记录，后面系统才能形成完整闭环。</p></div>";
}

function renderPublicPool() {
  const box = byId("publicPoolList");
  if (!box) return;
  const editable = canEditAdmissions();
  const publicPool = state.leads.filter(
    (lead) =>
      lead.status === "新建未联系" ||
      lead.nextAction.includes("尽快首联")
  );
  box.innerHTML = publicPool.length
    ? publicPool
        .map(
          (lead) => `
            <p>${lead.studentName} / ${lead.channel} / ${lead.lastFollowup} / ${lead.nextAction}</p>
            <div class="section-actions">
              <select data-public-owner-select="${lead.studentName}" ${editable ? "" : "disabled"}>
                ${ownerOptions
                  .map(
                    (owner) =>
                      `<option value="${owner}" ${lead.owner === owner ? "selected" : ""}>${owner}</option>`
                  )
                  .join("")}
              </select>
              <button class="button small secondary" type="button" data-action="public-reassign" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>重新分配</button>
            </div>
          `
        )
        .join("")
    : "<p>当前没有待回收或待重新分配的公海线索。</p>";
}

function renderMetrics() {
  const total = state.leads.length;
  const online = state.leads.filter((lead) => lead.channel.includes("抖音") || lead.channel.includes("官网")).length;
  const referral = state.leads.filter((lead) => lead.channel.includes("转介绍")).length;
  const visit = state.leads.filter((lead) => lead.channel.includes("自然")).length;
  const scheduled = state.leads.filter((lead) => lead.status === "已预约试听").length;
  const feedbackPending = state.leads.filter((lead) => lead.status === "试听完成待转化").length;
  const enrolled = state.leads.filter((lead) => lead.enrolledAmount > 0).length;
  const enrolledAmount = state.leads.reduce((sum, lead) => sum + (lead.enrolledAmount || 0), 0);
  const highIntent = state.leads.filter((lead) => lead.intent.startsWith("A") && lead.enrolledAmount <= 0).length;

  byId("todayFollowupChip").textContent = `今日待跟进 ${state.leads.filter((lead) => lead.status !== "定金 / 已报名").length}`;
  byId("todayTrialChip").textContent = `待约试听 ${scheduled}`;
  byId("todayFeedbackChip").textContent = `待反馈 ${feedbackPending}`;
  byId("weeklyLeadCount").textContent = String(total);
  byId("weeklyLeadBreakdown").textContent = `线上 ${online} / 转介绍 ${referral} / 到访 ${visit}`;
  byId("scheduledTrialCount").textContent = String(scheduled + feedbackPending);
  byId("scheduledTrialMeta").textContent = `待上课 ${scheduled} / 已试听待反馈 ${feedbackPending}`;
  byId("enrolledCount").textContent = String(enrolled);
  byId("enrolledMeta").textContent = `实收 ${enrolledAmount.toLocaleString()} / 定金 8,000`;
  byId("highIntentCount").textContent = String(highIntent);
}

function bindLeadCreate() {
  const button = byId("createLeadButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const studentName = byId("leadStudentName").value.trim();
    const parentPhone = byId("leadPhone").value.trim();
    if (!studentName || !parentPhone) {
      return;
    }
    state.leads.unshift({
      studentName,
      parentPhone,
      grade: byId("leadGrade").value,
      subject: byId("leadSubject").value,
      channel: byId("leadChannel").value,
      channelMeta: byId("leadReferrer").value.trim()
        ? `推荐人：${byId("leadReferrer").value.trim()}`
        : "待补推荐人",
      owner: byId("leadOwner").value,
      status: byId("leadStatus").value,
      trial: "未预约",
      intent: "B 中意向",
      inGroup: byId("leadInGroup").value,
      lastFollowup: "刚刚录入",
      note: byId("leadNote").value.trim() || "待补首条记录",
      nextAction: "尽快首联并补下一步动作",
      trialTeacher: "",
      trialTime: "",
      enrolledAmount: 0,
    });
    byId("leadStudentName").value = "";
    byId("leadPhone").value = "";
    byId("leadReferrer").value = "";
    byId("leadNote").value = "";
    state.selectedLeadName = studentName;
    logAudit("新增线索", studentName, `来源 ${byId("leadChannel").value}，负责人 ${byId("leadOwner").value || "待分配"}。`);
    renderAll();
  });
}

function bindFeedbackSave() {
  const button = byId("saveFeedbackButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const targetName = byId("followupLeadSelect")?.value;
    const feedbackLeadName = byId("feedbackLeadSelect")?.value || targetName;
    if (!feedbackLeadName) return;
    const target = state.leads.find(
      (lead) =>
        lead.studentName === feedbackLeadName ||
        lead.studentName === targetName ||
        lead.status === "试听完成待转化"
    );
    if (!target) return;
    target.intent = byId("feedbackIntent").value;
    target.lastFollowup = "刚刚回填";
    target.note = byId("feedbackSummary").value.trim() || target.note;
    target.nextAction = `下次跟进：${byId("feedbackNextDate").value}`;
    target.inGroup = byId("detailInGroupSelect")?.value || target.inGroup;
    target.status = "试听完成待转化";
    state.selectedLeadName = target.studentName;
    logAudit("保存试听反馈", target.studentName, `意向改为 ${target.intent}，下次跟进 ${byId("feedbackNextDate").value || "待定"}。`);
    renderAll();
  });
}

function bindEnrollmentCreate() {
  const button = byId("createEnrollmentButton");
  if (!button) return;

  byId("enrollStudentName")?.addEventListener("change", () => {
    syncSelectedLead(byId("enrollStudentName").value.trim());
    renderAll();
  });

  button.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const name = byId("enrollStudentName").value.trim();
    const amount = Number(byId("enrollReceived").value || 0);
    if (!name || !amount) {
      return;
    }
    const target = state.leads.find((lead) => lead.studentName === name);
    if (target) {
      target.status = "定金 / 已报名";
      target.enrolledAmount = amount;
      target.attributionLocked = true;
      target.attributionSnapshot = buildAttributionSnapshot(target);
      target.financeProfile = {
        settledAmount: amount,
        pendingCommission: "待结算",
        referralReward: target.referrerName ? "待判断" : "无",
      };
      target.nextAction = byId("enrollRemark").value.trim() || "已报名";
      target.lastFollowup = "刚刚报名";
      target.note = `报名登记完成 / 渠道：${byId("enrollChannel").value} / 顾问：${byId("enrollOwner").value}`;
      state.followups.push({
        studentName: target.studentName,
        time: "刚刚",
        text: `已登记报名，实收金额 ${amount}，状态更新为定金 / 已报名。归属链已锁定：${target.attributionSnapshot.channel} / ${target.attributionSnapshot.channelOwner} / ${target.attributionSnapshot.owner}${target.attributionSnapshot.referrerName ? ` / 推荐人 ${target.attributionSnapshot.referrerName}` : ""}。`,
      });
      logAudit("登记报名", target.studentName, `实收 ${amount}，锁定归属链 ${formatAttributionSnapshot(target.attributionSnapshot)}。`);
    }
    renderAll();
  });
}

function bindFollowupCreate() {
  const button = byId("addFollowupButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const leadName = byId("followupLeadSelect").value;
    const text = byId("followupInput").value.trim();
    if (!text) return;
    state.followups.push({
      studentName: leadName,
      time: "刚刚",
      text,
    });
    const target = state.leads.find((lead) => lead.studentName === leadName);
    if (target) {
      target.lastFollowup = "刚刚";
      target.note = text;
      logAudit("新增跟进", target.studentName, text);
    }
    byId("followupInput").value = "";
    renderAll();
  });

  byId("followupLeadSelect")?.addEventListener("change", () => {
    syncSelectedLead(byId("followupLeadSelect").value);
    renderAll();
  });
}

function bindRenewalCreate() {
  const button = byId("createRenewalButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const studentName = byId("renewStudentName").value.trim();
    const amount = Number(byId("renewAmount").value || 0);
    if (!studentName || !amount) return;
    const target = state.leads.find((lead) => lead.studentName === studentName);
    if (!target) return;

    const inheritedSnapshot =
      target.attributionLocked && target.attributionSnapshot
        ? target.attributionSnapshot
        : buildAttributionSnapshot(target);

    const renewalRecord = {
      type: byId("renewType").value,
      courseName: byId("renewCourseName").value,
      amount,
      attributionSnapshot: inheritedSnapshot,
      remark: byId("renewRemark").value.trim(),
    };

    if (!Array.isArray(target.renewalRecords)) {
      target.renewalRecords = [];
    }
    target.renewalRecords.push(renewalRecord);
    target.financeProfile = {
      settledAmount: Number(target.financeProfile?.settledAmount || target.enrolledAmount || 0) + amount,
      pendingCommission: "待结算",
      referralReward: target.referrerName ? "待判断" : "无",
    };

    state.followups.push({
      studentName: target.studentName,
      time: "刚刚",
      text: `已登记${renewalRecord.type}，项目：${renewalRecord.courseName}，实收 ${amount}。默认继承归属链：${formatAttributionSnapshot(inheritedSnapshot)}。`,
    });
    target.lastFollowup = "刚刚登记续费/扩科";
    target.nextAction = `${renewalRecord.type}已登记，继续按既有归属链结算`;
    logAudit(`登记${renewalRecord.type}`, target.studentName, `${renewalRecord.courseName} / 实收 ${amount} / 继承 ${formatAttributionSnapshot(inheritedSnapshot)}。`);
    renderAll();
  });
}

function bindBatchImport() {
  const button = byId("importBatchButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canImportAdmissions()) return;
    const raw = byId("importBatchInput").value.trim();
    const defaultStatus = byId("importDefaultStatus").value;
    const summary = {
      added: 0,
      duplicates: 0,
      missingOwner: 0,
      missingFields: 0,
      results: [],
    };

    if (!raw) {
      summary.results.push(
        createImportResult("空白导入", "未导入", "当前没有可解析的内容。")
      );
      state.importSummary = summary;
      renderAll();
      return;
    }

    const leadByPhone = new Map(
      state.leads
        .filter((lead) => normalizePhone(lead.parentPhone))
        .map((lead) => [normalizePhone(lead.parentPhone), lead])
    );

    raw.split(/\n+/).forEach((line) => {
      const cols = line.split("\t").map((item) => item.trim());
      const [
        studentName = "",
        grade = "",
        parentPhone = "",
        subject = "数学",
        channel = "",
        referrer = "",
        owner = "",
        note = "",
      ] = cols;

      const normalizedPhone = normalizePhone(parentPhone);
      if (!studentName || !normalizedPhone) {
        summary.missingFields += 1;
        summary.results.push(
          createImportResult(
            studentName || "未命名线索",
            "导入失败",
            "学生姓名或家长电话缺失，无法入库。"
          )
        );
        return;
      }

      if (leadByPhone.has(normalizedPhone)) {
        const existingLead = leadByPhone.get(normalizedPhone);
        const mergeNotes = [];
        if (channel && (!existingLead.channel || existingLead.channel === "待补来源")) {
          existingLead.channel = channel;
          mergeNotes.push(`补来源=${channel}`);
        }
      if (referrer && (!existingLead.channelMeta || existingLead.channelMeta === "待补推荐人")) {
          existingLead.referrerName = referrer;
          mergeNotes.push(`补推荐人=${referrer}`);
        }
        if (owner && (!existingLead.owner || existingLead.owner === "待分配")) {
          existingLead.owner = owner;
          mergeNotes.push(`补负责人=${owner}`);
        }
        if (grade && (!existingLead.grade || existingLead.grade === "待补年级")) {
          existingLead.grade = grade;
          mergeNotes.push(`补年级=${grade}`);
        }
        if (note) {
          existingLead.note = note;
          mergeNotes.push("追加首条备注");
        }
        existingLead.channelOwner = deriveChannelOwner(existingLead);
        existingLead.channelMeta = buildChannelMeta(
          existingLead.channel,
          existingLead.channelOwner,
          existingLead.referrerName
        );
        existingLead.lastFollowup = "刚刚合并导入";
        existingLead.nextAction =
          existingLead.owner && existingLead.owner !== "待分配"
            ? "已并入旧线索，继续跟进"
            : "已并入旧线索，仍待分配负责人";
        state.followups.push({
          studentName: existingLead.studentName,
          time: "刚刚",
          text: `批量导入检测到重复手机号，已并入原线索。${mergeNotes.length ? `本次补充：${mergeNotes.join("，")}。` : "本次未新增字段，仅提醒复核。"}`
        });
        summary.duplicates += 1;
        summary.results.push(
          createImportResult(
            studentName,
            "重复已并入",
            `手机号 ${parentPhone} 已存在，已并入 ${existingLead.studentName}。${mergeNotes.length ? `补充内容：${mergeNotes.join("，")}。` : "未发现可补字段。"}`
          )
        );
        state.selectedLeadName = existingLead.studentName;
        return;
      }

      const missingMessages = [];
      if (!channel) missingMessages.push("缺来源渠道");
      if (!owner) {
        missingMessages.push("缺负责人");
        summary.missingOwner += 1;
      }
      if (!note) {
        missingMessages.push("缺首条备注");
      }
      if (missingMessages.length) {
        summary.missingFields += 1;
      }

      const newLead = {
        studentName,
        parentPhone,
        grade: grade || "待补年级",
        subject: subject || "数学",
        channel: channel || "待补来源",
        channelMeta: buildChannelMeta(channel || "待补来源", "", referrer),
        channelOwner: "",
        referrerName: referrer,
        owner: owner || "待分配",
        status: defaultStatus,
        trial: "未预约",
        intent: "B 中意向",
        inGroup: "未进群",
        lastFollowup: "刚刚导入",
        note: note || "待补首条记录",
        nextAction: owner ? "导入完成，尽快首联" : "待分配负责人后首联",
        trialTeacher: "",
        trialTime: "",
        enrolledAmount: 0,
      };
      state.leads.unshift(newLead);
      leadByPhone.set(normalizedPhone, newLead);
      summary.added += 1;
      summary.results.push(
        createImportResult(
          studentName,
          missingMessages.length ? "已导入待补充" : "导入成功",
          missingMessages.length ? missingMessages.join("；") : "字段完整，已加入线索池。"
        )
      );
      state.selectedLeadName = studentName;
    });

    state.importSummary = summary;
    logAudit("批量导入线索", state.selectedLeadName || "本批线索", `新增 ${summary.added}，重复 ${summary.duplicates}，缺负责人 ${summary.missingOwner}，缺字段 ${summary.missingFields}。`);
    renderAll();
  });
}

function bindTrialCreate() {
  const button = byId("saveTrialButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const studentName = byId("trialLeadSelect").value;
    if (!studentName) return;
    const target = state.leads.find((lead) => lead.studentName === studentName);
    if (!target) return;
    target.status = "已预约试听";
    target.trialTeacher = byId("trialTeacherSelect").value;
    target.trialTime = byId("trialTimeInput").value;
    target.trial = formatTrialDisplay(target.trialTime);
    target.nextAction =
      byId("trialRemarkInput").value.trim() || "试听后当天必须回填反馈";
    target.lastFollowup = "刚刚预约试听";
    target.note = `已安排试听：${target.trialTeacher} / ${target.trial}`;
    state.selectedLeadName = target.studentName;
    logAudit("预约试听", target.studentName, `${target.trialTeacher} / ${target.trial}`);
    renderAll();
  });

  byId("trialLeadSelect")?.addEventListener("change", () => {
    const target = state.leads.find(
      (lead) => lead.studentName === byId("trialLeadSelect").value
    );
    if (!target) return;
    syncSelectedLead(target.studentName);
    renderAll();
  });
}

function bindDetailSave() {
  const button = byId("saveDetailButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const target = getSelectedLead();
    if (!target) return;
    const beforeSnapshot = formatAttributionSnapshot(target.attributionLocked && target.attributionSnapshot ? target.attributionSnapshot : buildAttributionSnapshot(target));
    target.owner = byId("detailOwnerSelect").value;
    target.status = byId("detailStatusSelect").value;
    target.intent = byId("detailIntentSelect").value;
    target.inGroup = byId("detailInGroupSelect").value;
    target.channelOwner = byId("detailChannelOwnerSelect").value;
    target.referrerName = byId("detailReferrerInput").value.trim();
    target.channelMeta = buildChannelMeta(target.channel, target.channelOwner, target.referrerName);
    target.nextAction = byId("detailNextActionInput").value.trim() || target.nextAction;
    target.note = byId("detailNoteInput").value.trim() || target.note;
    target.lastFollowup = "刚刚修改";
    logAudit("修改线索详情", target.studentName, `状态 ${target.status}，负责人 ${target.owner}，当前归属链 ${beforeSnapshot}。`);
    renderAll();
  });
}

function bindNavigation() {
  const navItems = Array.from(document.querySelectorAll(".nav-item[data-nav-target]"));
  const sections = Array.from(document.querySelectorAll("[data-section-group]"));
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
      const target = item.getAttribute("data-nav-target");
      sections.forEach((section) => {
        const groups = (section.getAttribute("data-section-group") || "").split(" ");
        section.classList.toggle("hidden-section", !groups.includes(target));
      });
    });
  });
}

function bindLeadActions() {
  document.querySelectorAll("[data-owner-select]").forEach((select) => {
    select.onchange = () => {
      const studentName = select.getAttribute("data-owner-select");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      target.owner = select.value;
      target.lastFollowup = "刚刚重分配";
      logAudit("调整负责人", target.studentName, `改为 ${select.value}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='advance-status']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      if (target.status === "新建未联系") target.status = "已沟通待邀约";
      else if (target.status === "已沟通待邀约") target.status = "持续跟进中";
      else if (target.status === "试听完成待转化") target.status = "持续跟进中";
      target.lastFollowup = "刚刚推进";
      target.nextAction = "继续跟进并补下一步动作";
      logAudit("推进线索状态", target.studentName, `推进后状态 ${target.status}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='assign-trial']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      syncSelectedLead(target.studentName);
      renderAll();
      const activeTrialLead = byId("trialLeadSelect");
      if (activeTrialLead) {
        activeTrialLead.value = target.studentName;
        activeTrialLead.dispatchEvent(new Event("change"));
      }
    };
  });

  document.querySelectorAll("[data-action='complete-trial']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      target.status = "试听完成待转化";
      target.trial = "已试听";
      target.nextAction = "48 小时内给报名方案";
      target.lastFollowup = "刚刚完成试听";
      logAudit("完成试听", target.studentName, "已转入试听完成待转化。");
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='reassign-owner']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='view-detail']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      syncSelectedLead(studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='public-reassign']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const ownerSelect = document.querySelector(
        `[data-public-owner-select="${studentName}"]`
      );
      target.owner = ownerSelect?.value || ownerOptions[0];
      target.nextAction = "已重新分配，尽快首联";
      target.lastFollowup = "刚刚重分配";
      logAudit("公海线索重分配", target.studentName, `改为 ${target.owner}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });
}

function setText(id, value) {
  const node = byId(id);
  if (node) node.textContent = value;
}

function getTeachingState() {
  if (!state.teachingQuality) {
    state.teachingQuality = structuredClone(defaultState.teachingQuality);
  }
  return state.teachingQuality;
}

function average(values) {
  const validValues = values.map(Number).filter((value) => Number.isFinite(value));
  if (!validValues.length) return 0;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function inspectionAverage(record) {
  return clampScore(average(record?.scores || []));
}

function getTeachingTeachers() {
  const quality = getTeachingState();
  const names = new Set();
  const employees = Array.isArray(window.JRC_EMPLOYEES) && window.JRC_EMPLOYEES.length
    ? window.JRC_EMPLOYEES
    : state.employees;
  (employees || [])
    .filter((employee) => employee.role === "授课老师" || employee.commissionRate || employee.subject)
    .forEach((employee) => names.add(employee.name));
  quality.inspections.forEach((record) => names.add(record.teacher));
  quality.studentSurveys.forEach((record) => names.add(record.teacher));
  quality.parentSurveys.forEach((record) => names.add(record.teacher));
  quality.objectiveMetrics.forEach((record) => names.add(record.teacher));
  return Array.from(names).filter(Boolean);
}

function normalizeTeacherName(name) {
  if (!name) return "";
  const teachers = getTeachingTeachers();
  if (teachers.includes(name)) return name;
  if (name.endsWith("老师")) {
    const surname = name.replace("老师", "").slice(0, 1);
    const matched = teachers.find((teacher) => teacher.startsWith(surname));
    return matched || name;
  }
  return name;
}

function calculateObjectiveScore(metrics = {}) {
  const base = 78;
  const renewalBonus = Math.max(0, Number(metrics.renewalRate || 0) - 70) * 0.25;
  const conversionBonus = Math.max(0, Number(metrics.trialConversionRate || 0) - 35) * 0.18;
  const referralBonus = Number(metrics.referrals || 0) * 2.5;
  const feedbackBonus = Math.min(8, Number(metrics.feedbackRecords || 0) * 0.35);
  const complaintPenalty = Number(metrics.complaints || 0) * 8;
  const latePenalty = Number(metrics.lateRecords || 0) * 4;
  const homeworkPenalty = Number(metrics.missedHomework || 0) * 3;
  const makeupPenalty = Number(metrics.missedMakeup || 0) * 4;
  return clampScore(base + renewalBonus + conversionBonus + referralBonus + feedbackBonus - complaintPenalty - latePenalty - homeworkPenalty - makeupPenalty);
}

function getTeacherQualityStats(teacher) {
  const quality = getTeachingState();
  const inspectionRecords = quality.inspections.filter((record) => record.teacher === teacher);
  const studentRecords = quality.studentSurveys.filter((record) => record.teacher === teacher);
  const parentRecords = quality.parentSurveys.filter((record) => record.teacher === teacher);
  const metrics = quality.objectiveMetrics.find((record) => record.teacher === teacher) || {};

  const inspection = inspectionRecords.length ? average(inspectionRecords.map(inspectionAverage)) : 82;
  const studentSurvey = studentRecords.length ? average(studentRecords.map((record) => record.score)) : 82;
  const parentSurvey = parentRecords.length ? average(parentRecords.map((record) => record.score)) : 82;
  const objective = calculateObjectiveScore(metrics);
  const total =
    inspection * (quality.weights.inspection / 100) +
    studentSurvey * (quality.weights.studentSurvey / 100) +
    parentSurvey * (quality.weights.parentSurvey / 100) +
    objective * (quality.weights.objective / 100);
  const roundedTotal = Math.round(total * 10) / 10;
  const gradeRule =
    quality.gradeRules.find((rule) => roundedTotal >= rule.min) ||
    quality.gradeRules[quality.gradeRules.length - 1];

  return {
    teacher,
    inspection: Math.round(inspection * 10) / 10,
    studentSurvey: Math.round(studentSurvey * 10) / 10,
    parentSurvey: Math.round(parentSurvey * 10) / 10,
    objective,
    total: roundedTotal,
    grade: gradeRule.grade,
    label: gradeRule.label,
    coefficient: gradeRule.coefficient,
    managementAdvice:
      gradeRule.grade === "S"
        ? "优先分配优质试听班，可纳入评优。"
        : gradeRule.grade === "A"
          ? "正常排课与奖励，继续保持。"
          : gradeRule.grade === "B"
            ? "增加抽样听课频次，安排教研帮扶。"
            : "强制整改，连续两月 C 级触发人事预警。",
  };
}

function getQualityRankings() {
  return getTeachingTeachers()
    .map(getTeacherQualityStats)
    .sort((a, b) => b.total - a.total);
}

function renderScoreCell(score) {
  const scoreWidth = Math.max(0, Math.min(100, Math.round(score)));
  return `
    <div class="quality-score">
      <strong>${score}</strong>
      <div class="score-bar" style="--score-width: ${scoreWidth}%"><span></span></div>
    </div>
  `;
}

function renderQualityOverview() {
  const body = byId("qualityTeacherRankingBody");
  if (!body) return;
  const rankings = getQualityRankings();
  const averageScore = rankings.length ? average(rankings.map((item) => item.total)) : 0;
  const strongCount = rankings.filter((item) => item.grade === "S" || item.grade === "A").length;
  const alertCount = rankings.filter((item) => item.grade === "B" || item.grade === "C").length;
  const openTickets = getTeachingState().improvementTickets.filter((ticket) => !ticket.status.includes("已闭环")).length;

  setText("qualityAverageScore", String(Math.round(averageScore * 10) / 10));
  setText("qualityStrongTeacherCount", String(strongCount));
  setText("qualityAlertTeacherCount", String(alertCount));
  setText("qualityOpenTicketCount", String(openTickets));

  body.innerHTML = rankings
    .map(
      (item) => `
        <tr>
          <td><button class="button small secondary" type="button" data-quality-select-teacher="${item.teacher}">${item.teacher}</button></td>
          <td>${renderScoreCell(item.total)}</td>
          <td><span class="quality-grade grade-${item.grade.toLowerCase()}">${item.grade}</span><br>${item.label}</td>
          <td>${item.coefficient}</td>
          <td>${item.inspection}</td>
          <td>${item.studentSurvey}</td>
          <td>${item.parentSurvey}</td>
          <td>${item.objective}</td>
          <td>${item.managementAdvice}</td>
        </tr>
      `
    )
    .join("");
}

function renderQualityInspectionForm() {
  const teacherSelect = byId("qualityInspectionTeacher");
  if (!teacherSelect) return;
  const currentValue = teacherSelect.value;
  const teachers = getTeachingTeachers();
  teacherSelect.innerHTML = teachers
    .map((teacher) => `<option value="${teacher}">${teacher}</option>`)
    .join("");
  teacherSelect.value = teachers.includes(currentValue)
    ? currentValue
    : getTeachingState().selectedTeacher || teachers[0] || "";
}

function renderQualityInspections() {
  const body = byId("qualityInspectionBody");
  if (!body) return;
  body.innerHTML = getTeachingState().inspections
    .slice(0, 12)
    .map(
      (record) => `
        <tr>
          <td>${record.date}</td>
          <td>${record.teacher}</td>
          <td>${record.className}<br>${record.lessonType}</td>
          <td>${renderScoreCell(inspectionAverage(record))}</td>
          <td>${(record.tags || []).map((tag) => `<span class="tag ${tag === "重点整改" ? "red" : "amber"}">${tag}</span>`).join(" ") || "常规抽样"}</td>
          <td>${record.note}<br>附件：${record.attachment || "无"}</td>
        </tr>
      `
    )
    .join("");
}

function renderQualityTemplatesAndTickets() {
  const quality = getTeachingState();
  const templateGrid = byId("qualityTemplateGrid");
  if (templateGrid) {
    templateGrid.innerHTML = quality.templates
      .map(
        (template) => `
          <article class="template-card">
            <strong>${template.type}</strong>
            <p>状态：${template.enabled ? "自动推送已开" : "已关闭"}</p>
            <p>推送时间：${template.sendAfter}</p>
            <p>题目：${template.questions}</p>
          </article>
        `
      )
      .join("");
  }

  const tagCounts = new Map();
  quality.parentSurveys.forEach((survey) => {
    (survey.tags || []).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const tagBody = byId("qualityTagFrequencyBody");
  if (tagBody) {
    tagBody.innerHTML = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(
        ([tag, count]) => `
          <tr>
            <td>${tag}</td>
            <td>${count}</td>
            <td>${tag.includes("反馈") ? "要求课后学情反馈限时提交。" : tag.includes("价格") ? "招生顾问补充价值说明和报名方案。" : "教务跟进具体班级改进。"}</td>
          </tr>
        `
      )
      .join("") || `
        <tr>
          <td>暂无高频异议</td>
          <td>0</td>
          <td>继续保持问卷采集。</td>
        </tr>
      `;
  }

  const ticketBody = byId("qualityTicketBody");
  if (ticketBody) {
    ticketBody.innerHTML = quality.improvementTickets
      .map(
        (ticket) => `
          <tr>
            <td>${ticket.id}<br>${ticket.problem}</td>
            <td>${ticket.teacher}</td>
            <td><span class="tag ${ticket.status.includes("已闭环") ? "green" : ticket.status.includes("打回") ? "red" : "amber"}">${ticket.status}</span></td>
            <td>${ticket.dueDate}</td>
            <td>
              <button class="button small secondary" type="button" data-quality-ticket-action="plan" data-ticket-id="${ticket.id}" ${canManageTeachingQuality() ? "" : "disabled"}>补整改</button>
              <button class="button small" type="button" data-quality-ticket-action="close" data-ticket-id="${ticket.id}" ${canManageTeachingQuality() ? "" : "disabled"}>复查通过</button>
            </td>
          </tr>
        `
      )
      .join("");
  }
}

function getWeakParentTag(teacher) {
  const tagCounts = new Map();
  getTeachingState().parentSurveys
    .filter((survey) => survey.teacher === teacher)
    .forEach((survey) => {
      (survey.tags || []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
    });
  return Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "暂无";
}

function renderQualityProfile() {
  const quality = getTeachingState();
  const select = byId("qualityTeacherProfileSelect");
  if (!select) return;
  const teachers = getTeachingTeachers();
  const currentValue = select.value || quality.selectedTeacher;
  select.innerHTML = teachers.map((teacher) => `<option value="${teacher}">${teacher}</option>`).join("");
  quality.selectedTeacher = teachers.includes(currentValue) ? currentValue : teachers[0] || "";
  select.value = quality.selectedTeacher;

  const stats = getTeacherQualityStats(quality.selectedTeacher);
  const openTickets = quality.improvementTickets.filter(
    (ticket) => ticket.teacher === quality.selectedTeacher && !ticket.status.includes("已闭环")
  );
  setText("qualityProfileScore", String(stats.total));
  setText("qualityProfileGrade", `${stats.grade} 级｜绩效系数 ${stats.coefficient}`);
  setText("qualityProfileInspection", String(stats.inspection));
  setText("qualityProfileWeakTag", getWeakParentTag(quality.selectedTeacher));
  setText("qualityProfileTicket", String(openTickets.length));

  const dimensions = [
    ["教务巡课", stats.inspection],
    ["学生问卷", stats.studentSurvey],
    ["家长问卷", stats.parentSurvey],
    ["客观数据", stats.objective],
  ];
  const dimensionList = byId("qualityDimensionList");
  if (dimensionList) {
    dimensionList.innerHTML = dimensions
      .map(
        ([label, score]) => `
          <div class="dimension-row">
            <span>${label}</span>
            <div class="score-bar" style="--score-width: ${Math.round(score)}%"><span></span></div>
            <strong>${score}</strong>
          </div>
        `
      )
      .join("");
  }

  const archiveBody = byId("qualityProfileArchiveBody");
  if (archiveBody) {
    const teacherInspections = quality.inspections.filter((record) => record.teacher === quality.selectedTeacher);
    const teacherParentSurveys = quality.parentSurveys.filter((record) => record.teacher === quality.selectedTeacher);
    archiveBody.innerHTML = `
      <tr>
        <td>历史巡课记录</td>
        <td>${teacherInspections.length} 条，本月均分 ${stats.inspection}</td>
        <td>用于教务抽样、复查和年度教学档案。</td>
      </tr>
      <tr>
        <td>匿名问卷评价</td>
        <td>家长 ${teacherParentSurveys.length} 条，学生 ${quality.studentSurveys.filter((record) => record.teacher === quality.selectedTeacher).length} 条。</td>
        <td>只汇总分数和脱敏建议，不显示学生身份。</td>
      </tr>
      <tr>
        <td>整改工单</td>
        <td>${openTickets.length ? openTickets.map((ticket) => `${ticket.id}：${ticket.status}`).join("；") : "当前没有未闭环整改。"}</td>
        <td>连续低分、投诉或复查不通过会进入季度考核。</td>
      </tr>
      <tr>
        <td>财务联动</td>
        <td>${stats.grade} 级，对应绩效系数 ${stats.coefficient}。</td>
        <td>后续进入课时奖金和教学质量奖励预核算。</td>
      </tr>
    `;
  }
}

function renderQualityLinkage() {
  const trialBody = byId("qualityTrialLinkBody");
  const financeBody = byId("qualityFinanceBody");
  const rankings = getQualityRankings();

  if (trialBody) {
    const teacherMap = new Map();
    state.leads
      .filter((lead) => lead.trialTeacher)
      .forEach((lead) => {
        const teacher = normalizeTeacherName(lead.trialTeacher);
        if (!teacherMap.has(teacher)) teacherMap.set(teacher, { trials: 0, enrolled: 0 });
        const item = teacherMap.get(teacher);
        item.trials += 1;
        if ((lead.enrolledAmount || 0) > 0 || lead.status === "定金 / 已报名") item.enrolled += 1;
      });
    trialBody.innerHTML = Array.from(teacherMap.entries())
      .map(([teacher, item]) => {
        const stats = getTeacherQualityStats(teacher);
        const rate = item.trials ? Math.round((item.enrolled / item.trials) * 100) : 0;
        return `
          <tr>
            <td>${teacher}</td>
            <td>${item.trials}</td>
            <td>${item.enrolled}</td>
            <td>${rate}%</td>
            <td>${stats.total} / ${stats.grade} 级</td>
          </tr>
        `;
      })
      .join("") || `
        <tr>
          <td>暂无试听教师数据</td>
          <td>0</td>
          <td>0</td>
          <td>0%</td>
          <td>后续预约试听后自动汇总。</td>
        </tr>
      `;
  }

  if (financeBody) {
    financeBody.innerHTML = rankings
      .map((item) => {
        const suggestion =
          item.grade === "S"
            ? "教学质量奖励按 1.1 预核算，可优先评优。"
            : item.grade === "A"
              ? "按 1.0 正常核算。"
              : item.grade === "B"
                ? "按 0.9 预警核算，需教研帮扶。"
                : "按 0.8 预警核算，并触发整改/人事关注。";
        return `
          <tr>
            <td>${item.teacher}</td>
            <td><span class="quality-grade grade-${item.grade.toLowerCase()}">${item.grade}</span></td>
            <td>${item.coefficient}</td>
            <td>${suggestion}</td>
          </tr>
        `;
      })
      .join("");
  }
}

function bindQualityActions() {
  document.querySelectorAll("[data-quality-select-teacher]").forEach((button) => {
    button.onclick = () => {
      getTeachingState().selectedTeacher = button.getAttribute("data-quality-select-teacher");
      renderAll();
    };
  });

  document.querySelectorAll("[data-quality-ticket-action]").forEach((button) => {
    button.onclick = () => {
      if (!canManageTeachingQuality()) return;
      const ticket = getTeachingState().improvementTickets.find(
        (item) => item.id === button.getAttribute("data-ticket-id")
      );
      if (!ticket) return;
      const action = button.getAttribute("data-quality-ticket-action");
      if (action === "close") {
        ticket.status = "已闭环";
        ticket.review = `${formatNowStamp()} 复查通过，工单闭环。`;
        logAudit("教学质量整改复查", ticket.teacher, `${ticket.id} 已闭环。`);
      } else {
        ticket.status = "整改中";
        ticket.plan = ticket.plan || "教师已提交初步整改措施，等待教务复查。";
        logAudit("教学质量整改补充", ticket.teacher, `${ticket.id} 已补整改说明。`);
      }
      renderAll();
    };
  });
}

function bindQualityInspectionCreate() {
  const button = byId("qualitySaveInspectionButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canManageTeachingQuality()) return;
    const teacher = byId("qualityInspectionTeacher")?.value;
    if (!teacher) return;
    const scores = [
      byId("qualityScoreLogic")?.value,
      byId("qualityScoreInteraction")?.value,
      byId("qualityScoreOrder")?.value,
      byId("qualityScoreTime")?.value,
      byId("qualityScoreService")?.value,
    ].map(clampScore);
    const record = {
      teacher,
      className: byId("qualityInspectionClass")?.value.trim() || "未命名课程",
      lessonType: byId("qualityInspectionType")?.value || "在读班",
      date: byId("qualityInspectionDate")?.value || formatNowStamp().slice(0, 10),
      scores,
      note: byId("qualityInspectionNote")?.value.trim() || "常规抽样巡课。",
      tags: byId("qualityInspectionFocus")?.value === "是" || average(scores) < 75 ? ["重点整改"] : [],
      attachment: byId("qualityInspectionAttachment")?.value.trim() || "无",
    };
    const quality = getTeachingState();
    quality.inspections.unshift(record);
    quality.selectedTeacher = teacher;

    if (inspectionAverage(record) < 75 || record.tags.includes("重点整改")) {
      const ticketId = `TQ-${Date.now().toString().slice(-8)}`;
      quality.improvementTickets.unshift({
        id: ticketId,
        teacher,
        source: "抽样巡课低分",
        problem: record.note,
        dueDate: record.date,
        status: "待教师提交整改",
        plan: "",
        review: "教务需在下次抽样巡课后复查。",
      });
      logAudit("教学质量巡课预警", teacher, `${ticketId} 已自动生成整改工单。`);
    } else {
      logAudit("新增巡课记录", teacher, `${record.className} / 均分 ${inspectionAverage(record)}。`);
    }
    renderAll();
  });
}

function bindQualityProfileSelect() {
  const select = byId("qualityTeacherProfileSelect");
  if (!select) return;
  select.addEventListener("change", () => {
    getTeachingState().selectedTeacher = select.value;
    renderAll();
  });
}

function renderTeachingQuality() {
  renderQualityInspectionForm();
  renderQualityOverview();
  renderQualityInspections();
  renderQualityTemplatesAndTickets();
  renderQualityProfile();
  renderQualityLinkage();
  bindQualityActions();
}

function renderOperatorContext() {
  const employee = getCurrentEmployee();
  const operatorHint = byId("operatorHint");
  const permissionNotice = byId("permissionNotice");
  const operatorName = byId("operatorName");
  const operatorMeta = byId("operatorMeta");
  const operatorPermissionSummary = byId("operatorPermissionSummary");

  if (employee) {
    const financeSummary = canViewAdmissionFinance() ? "可查看财务口径" : "不可查看财务口径";
    const editSummary = canEditAdmissions() ? "当前账号可录入和修改招生数据。" : "当前账号为只读，只能查看，不能修改招生数据。";
    if (operatorHint) {
      operatorHint.textContent = `${employee.name}｜${employee.role}｜${editSummary}`;
    }
    if (operatorName) operatorName.textContent = employee.name;
    if (operatorMeta) operatorMeta.textContent = `${employee.role}｜用户名 ${employee.username}`;
    if (operatorPermissionSummary) {
      operatorPermissionSummary.textContent = `招生编辑：${canEditAdmissions() ? "已开放" : "未开放"}｜导入：${canImportAdmissions() ? "已开放" : "未开放"}｜${financeSummary}`;
    }
    if (permissionNotice) {
      permissionNotice.hidden = canEditAdmissions();
      permissionNotice.textContent = "当前登录账号没有招生编辑权限。你现在可以查看流程和数据，但不会允许录入、导入、重分配或修改。";
    }
    return;
  }

  if (operatorHint) operatorHint.textContent = "当前没有识别到登录员工信息。";
  if (operatorName) operatorName.textContent = "未识别";
  if (operatorMeta) operatorMeta.textContent = "请先从统一工作台登录";
  if (operatorPermissionSummary) operatorPermissionSummary.textContent = "暂未加载权限";
  if (permissionNotice) {
    permissionNotice.hidden = false;
    permissionNotice.textContent = "当前页面未识别登录信息，默认按只读处理。";
  }
}

function renderAuditLogs() {
  const box = byId("auditLogList");
  if (!box) return;
  const logs = Array.isArray(state.auditLogs) ? state.auditLogs.slice(0, 8) : [];
  box.innerHTML = logs.length
    ? logs
        .map(
          (item) => `
            <div class="audit-item">
              <strong>${item.action}｜${item.studentName}</strong>
              <p>${item.time}｜${item.operator}<br>${item.detail}</p>
            </div>
          `
        )
        .join("")
    : `
      <div class="audit-item">
        <strong>暂无操作记录</strong>
        <p>后续这里会显示谁修改了线索、试听、报名、续费、导入和归属链。</p>
      </div>
    `;
}

function applyPermissionState() {
  const editable = canEditAdmissions();
  const importable = canImportAdmissions();
  const editSelectors = [
    '[id^="lead"]',
    '[id^="detail"]',
    '[id^="trial"]',
    '[id^="feedback"]',
    '[id^="enroll"]',
    '[id^="renew"]',
    '[id^="followup"]',
    '[id^="quality"]',
    '#createLeadButton',
    '#saveFeedbackButton',
    '#createEnrollmentButton',
    '#addFollowupButton',
    '#createRenewalButton',
    '#saveTrialButton',
    '#saveDetailButton',
    '#qualitySaveInspectionButton'
  ];
  document.querySelectorAll(editSelectors.join(",")).forEach((node) => {
    if (!["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(node.tagName)) return;
    if (node.id === "detailAttributionLock" || node.id === "renewStudentName" || node.id === "renewAttributionPreview" || node.id === "enrollAttributionPreview") {
      node.disabled = true;
      return;
    }
    if (node.id?.startsWith("quality")) {
      node.disabled = !canManageTeachingQuality();
      return;
    }
    node.disabled = !editable;
  });

  const importNodes = document.querySelectorAll("#importBatchInput, #importDefaultStatus, #importBatchButton");
  importNodes.forEach((node) => {
    node.disabled = !importable;
  });
}

function bindLeadFilters() {
  const mappings = [
    ["filterAllButton", "all"],
    ["filterNewButton", "new"],
    ["filterTrialButton", "trial"],
    ["filterEnrolledButton", "enrolled"],
  ];
  mappings.forEach(([id, value]) => {
    const button = byId(id);
    if (!button) return;
    button.addEventListener("click", () => {
      state.activeLeadFilter = value;
      renderLeadTable();
    });
  });
}

function renderAll() {
  persistState();
  renderOperatorContext();
  renderLeadTable();
  renderTrialTable();
  renderFollowups();
  renderPublicPool();
  renderFollowupLeadOptions();
  renderFeedbackLeadOptions();
  renderEnrollmentLeadOptions();
  renderTrialLeadOptions();
  renderLeadDetail();
  renderImportSummary();
  renderPendingLeadFixes();
  renderStudentArchive();
  renderMetrics();
  renderAuditLogs();
  renderTeachingQuality();
  applyPermissionState();
}

bindLeadCreate();
bindFeedbackSave();
bindEnrollmentCreate();
bindFollowupCreate();
bindRenewalCreate();
bindBatchImport();
bindTrialCreate();
bindDetailSave();
bindQualityInspectionCreate();
bindQualityProfileSelect();
bindNavigation();
bindLeadFilters();
renderAll();
