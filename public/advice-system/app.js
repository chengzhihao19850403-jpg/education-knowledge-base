const STORAGE_KEY = "advice-system-stage-prototype";

const defaultState = {
  activeView: "dashboard",
  activeLeadFilter: "all",
  leadSearchQuery: "",
  leadOwnerFilter: "",
  leadChannelFilter: "",
  leadIntentFilter: "",
  selectedLeadName: "",
  employees: [],
  auditLogs: [],
  importSummary: {
    added: 0,
    duplicates: 0,
    missingOwner: 0,
    missingFields: 0,
    results: [],
  },
  leads: [],
  followups: [],
};

const state = loadState();
let cloudStoreReady = false;
let cloudSaveTimer = null;
let activeViewApplier = null;
let toastTimer = null;

const statusClassMap = {
  "已沟通待邀约": "amber",
  "试听完成待转化": "red",
};

const ownerOptions = ["待分配", "陈雨晴", "高芳燕", "颜雨涵", "周珊", "徐嘉丽", "张艳", "程志豪"];
const trialTeacherOptions = ["待安排", "叶源泽", "李舒", "赵萱", "朱永乐", "郑嘉艺", "潘云贵", "曹德顺", "何建军", "吴水琴", "吴建勇", "海滢滢", "程志豪"];
const channelOptions = ["待补来源", "抖音投流", "老家长转介绍", "自然到访", "官网表单"];
const channelOwnerOptions = ["待补渠道归属", "陈雨晴", "颜雨涵", "高芳燕", "周珊", "前台"];
const importTemplateFields = [
  "学生姓名",
  "年级",
  "家长姓名",
  "家长电话",
  "意向学科",
  "来源渠道",
  "推荐人",
  "当前负责人",
  "当前状态",
  "意向等级",
  "试听时间",
  "试听老师",
  "是否进群",
  "首条备注",
  "下一步动作",
].join("\t");

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setInlineMessage(id, text, type = "") {
  const node = byId(id);
  if (!node) return;
  node.textContent = text || "";
  node.classList.remove("success", "error");
  if (type) node.classList.add(type);
}

function showToast(text, type = "") {
  const node = byId("toastMessage");
  if (!node || !text) return;
  clearTimeout(toastTimer);
  node.textContent = text;
  node.classList.toggle("error", type === "error");
  node.classList.add("show");
  toastTimer = setTimeout(() => {
    node.classList.remove("show");
  }, 2200);
}

function switchAdmissionView(target, selector = "") {
  if (typeof activeViewApplier === "function") {
    activeViewApplier(target);
  } else {
    state.activeView = target;
  }
  window.setTimeout(() => {
    const targetNode = selector ? document.querySelector(selector) : null;
    if (targetNode) {
      targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, 30);
}

function defaultTrialDateTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T19:00`;
}

function parseMaybeDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value) {
  const date = parseMaybeDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeState(structuredClone(defaultState));
    const parsed = JSON.parse(raw);
    return normalizeState({
      ...structuredClone(defaultState),
      ...parsed,
    });
  } catch {
    return normalizeState(structuredClone(defaultState));
  }
}

function normalizeState(nextState) {
  nextState.leads = (nextState.leads || []).map((lead) => ({
    ...lead,
    parentNeed: lead.parentNeed || "",
    studentPainPoint: lead.studentPainPoint || "",
    objection: lead.objection || "暂无明确异议",
    nextFollowupDate: lead.nextFollowupDate || "",
    renewalRecords: Array.isArray(lead.renewalRecords) ? lead.renewalRecords : [],
  }));
  nextState.followups = Array.isArray(nextState.followups) ? nextState.followups : [];
  nextState.auditLogs = Array.isArray(nextState.auditLogs) ? nextState.auditLogs : [];
  return nextState;
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
    scheduleCloudPersist();
  } catch {}
}

function scheduleCloudPersist() {
  if (!cloudStoreReady || !window.JRC_CLOUD?.writeModuleData) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    window.JRC_CLOUD.writeModuleData(STORAGE_KEY, "admissions", state).catch((error) => {
      console.warn("招生系统云端保存失败", error);
    });
  }, 450);
}

async function hydrateCloudState() {
  if (!window.JRC_CLOUD?.readModuleData) {
    cloudStoreReady = true;
    return;
  }
  try {
    const result = await window.JRC_CLOUD.readModuleData(STORAGE_KEY);
    if (result.ok && result.data?.found && result.data.payload) {
      const nextState = normalizeState({
        ...structuredClone(defaultState),
        ...result.data.payload,
      });
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, nextState);
      cloudStoreReady = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      return;
    }
    cloudStoreReady = true;
    scheduleCloudPersist();
  } catch (error) {
    console.warn("招生系统云端读取失败，暂用本机数据", error);
    cloudStoreReady = true;
  }
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

function canExportAdmissions() {
  return hasPermission("admissions.export") || canImportAdmissions();
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

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function percent(part, total) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function createImportResult(studentName, status, detail) {
  return { studentName, status, detail };
}

function pushFollowup(studentName, text, time = "刚刚") {
  if (!Array.isArray(state.followups)) {
    state.followups = [];
  }
  state.followups.push({ studentName, time, text });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

function buildAdmissionTasks() {
  const tasks = [];
  state.leads.forEach((lead) => {
    const missing = collectMissingLeadFields(lead);
    if (missing.length) {
      tasks.push({
        priority: "high",
        label: "紧急",
        lead,
        action: `补齐字段：${missing.join("、")}`,
        target: "先补字段，否则跟进和归属链会乱。",
      });
    }
    if (lead.status === "新建未联系") {
      tasks.push({
        priority: "high",
        label: "紧急",
        lead,
        action: "尽快首联家长",
        target: "确认年级、薄弱点、可试听时间和是否愿意进群。",
      });
    }
    if (lead.status === "已沟通待邀约" || lead.status === "持续跟进中") {
      tasks.push({
        priority: lead.intent?.startsWith("A") ? "high" : "medium",
        label: lead.intent?.startsWith("A") ? "紧急" : "重要",
        lead,
        action: lead.intent?.startsWith("A") ? "推动报名或锁定试听" : "继续邀约试听",
        target: lead.nextAction || "补明确下一步动作。",
      });
    }
    if (lead.status === "已预约试听") {
      tasks.push({
        priority: "medium",
        label: "重要",
        lead,
        action: "确认试听到场并准备反馈",
        target: `${lead.trialTeacher || "待定老师"} / ${lead.trialTime ? formatTrialDisplay(lead.trialTime) : lead.trial}`,
      });
    }
    if (lead.status === "试听完成待转化") {
      tasks.push({
        priority: "high",
        label: "紧急",
        lead,
        action: "补试听反馈并追报名方案",
        target: lead.nextAction || "48 小时内给报名方案。",
      });
    }
  });
  const score = { high: 0, medium: 1, normal: 2 };
  return tasks.sort((a, b) => score[a.priority] - score[b.priority]).slice(0, 12);
}

function buildSopTasks() {
  const activeLeads = state.leads.filter(
    (lead) => lead.status === "试听完成待转化" && lead.enrolledAmount <= 0
  );
  const sopRows = [];
  activeLeads.forEach((lead) => {
    const level = lead.intent || "B 中意向";
    sopRows.push({
      node: "试听当天",
      lead,
      action: "发送学情反馈、课堂表现总结、老师建议",
      goal: "让家长记住试听价值，趁热推进报名方案。",
    });
    if (level.startsWith("A") || level.startsWith("B")) {
      sopRows.push({
        node: "第 3 天",
        lead,
        action: "发送提分案例、班型方案、价格解释",
        goal: "处理核心异议，推进定金或报名。",
      });
    }
    if (level.startsWith("B") || level.startsWith("C")) {
      sopRows.push({
        node: "第 7 天",
        lead,
        action: "邀约公开课、活动课或二次试听",
        goal: "重新拉回兴趣，不让线索自然流失。",
      });
    }
    if (level.startsWith("C") || level.startsWith("D")) {
      sopRows.push({
        node: "第 14 天",
        lead,
        action: "转入资料培育群或低频运营池",
        goal: "降低人工高频追踪成本，保留长期转化可能。",
      });
    }
  });
  return sopRows;
}

function getFilteredLeads() {
  return state.leads.filter((lead) => {
    if (state.activeLeadFilter === "new" && lead.status !== "新建未联系") return false;
    if (state.activeLeadFilter === "trial")
      if (!(lead.status === "已预约试听" || lead.status === "试听完成待转化")) return false;
    if (state.activeLeadFilter === "enrolled" && lead.status !== "定金 / 已报名") return false;
    const query = normalizeText(state.leadSearchQuery);
    if (query) {
      const haystack = normalizeText([
        lead.studentName,
        lead.parentPhone,
        lead.grade,
        lead.subject,
        lead.channel,
        lead.channelMeta,
        lead.owner,
        lead.status,
        lead.intent,
        lead.parentNeed,
        lead.studentPainPoint,
        lead.objection,
        lead.note,
        lead.nextAction,
      ].join(" "));
      if (!haystack.includes(query)) return false;
    }
    if (state.leadOwnerFilter && lead.owner !== state.leadOwnerFilter) return false;
    if (state.leadChannelFilter && lead.channel !== state.leadChannelFilter) return false;
    if (state.leadIntentFilter && lead.intent !== state.leadIntentFilter) return false;
    return true;
  });
}

function parseImportLine(line, headerMap) {
  const cols = line.split("\t").map((item) => item.trim());
  if (headerMap) {
    const at = (...names) => {
      const key = names.find((name) => headerMap.has(name));
      return key ? cols[headerMap.get(key)] || "" : "";
    };
    return {
      studentName: at("学生姓名", "student_name"),
      grade: at("年级", "当前年级", "grade"),
      parentName: at("家长姓名", "parent_name"),
      parentPhone: at("家长电话", "联系电话", "手机号", "parent_phone"),
      subject: at("意向学科", "学科", "subject") || "数学",
      channel: at("来源渠道", "渠道", "channel"),
      referrer: at("推荐人", "转介绍人", "referrer"),
      owner: at("当前负责人", "负责人", "owner"),
      status: at("当前状态", "状态", "lead_status"),
      intent: at("意向等级", "意向", "intention_level"),
      trialTime: at("试听时间", "trial_date"),
      trialTeacher: at("试听老师", "trial_teacher"),
      inGroup: at("是否进群", "is_in_parent_group"),
      note: at("首条备注", "备注", "followup_note"),
      parentNeed: at("家长核心诉求", "家长诉求", "parent_need"),
      studentPainPoint: at("学生薄弱点", "薄弱点", "student_pain_point"),
      objection: at("报名异议", "异议", "objection"),
      nextFollowupDate: at("下次跟进日期", "next_followup_date"),
      nextAction: at("下一步动作", "next_action"),
    };
  }
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
  return { studentName, grade, parentPhone, subject, channel, referrer, owner, note };
}

function maybeBuildImportHeaderMap(lines) {
  if (!lines.length) return null;
  const firstCols = lines[0].split("\t").map((item) => item.trim());
  const hasHeader = firstCols.some((item) =>
    ["学生姓名", "student_name", "家长电话", "parent_phone", "来源渠道", "channel"].includes(item)
  );
  if (!hasHeader) return null;
  return new Map(firstCols.map((item, index) => [item, index]));
}

function syncSelectedLead(leadName) {
  if (!leadName) return;
  const exists = state.leads.some((lead) => lead.studentName === leadName);
  if (!exists) return;
  state.selectedLeadName = leadName;

  const followupSelect = byId("followupLeadSelect");
  if (followupSelect) followupSelect.value = leadName;

  const quickFollowupSelect = byId("quickFollowupLeadSelect");
  if (quickFollowupSelect) quickFollowupSelect.value = leadName;

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

function saveFollowupRecord({
  leadName,
  text,
  method = "沟通",
  parentNeed = "",
  painPoint = "",
  objection = "暂无明确异议",
  nextDate = "",
}) {
  const target = state.leads.find((lead) => lead.studentName === leadName);
  const cleanText = String(text || "").trim();
  if (!target || !cleanText) return false;
  target.lastFollowup = "刚刚";
  if (parentNeed) target.parentNeed = parentNeed;
  if (painPoint) target.studentPainPoint = painPoint;
  target.objection = objection || "暂无明确异议";
  target.nextFollowupDate = nextDate || "";
  target.nextAction = nextDate ? `下次跟进：${nextDate}` : target.nextAction;
  const structuredText = [
    `${method}跟进。`,
    parentNeed ? `家长诉求：${parentNeed}。` : "",
    painPoint ? `学生薄弱点：${painPoint}。` : "",
    objection && objection !== "暂无明确异议" ? `报名异议：${objection}。` : "",
    `沟通记录：${cleanText}`,
    nextDate ? `下次跟进：${nextDate}。` : "",
  ].filter(Boolean).join("");
  target.note = structuredText;
  pushFollowup(leadName, structuredText);
  logAudit("新增跟进", target.studentName, structuredText);
  syncSelectedLead(target.studentName);
  return true;
}

function renderLeadTable() {
  const body = byId("leadTableBody");
  if (!body) return;
  const editable = canEditAdmissions();
  const filteredLeads = getFilteredLeads();
  renderLeadCards(filteredLeads, editable);
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
    .join("") || `
      <tr>
        <td colspan="10">当前筛选条件下没有线索。可以清空搜索或切换筛选条件。</td>
      </tr>
    `;
  bindLeadActions();
}

function renderLeadCards(filteredLeads, editable) {
  const box = byId("leadCardList");
  if (!box) return;
  box.innerHTML = filteredLeads.length
    ? filteredLeads
        .map(
          (lead) => `
            <article class="lead-card">
              <div class="lead-card-head">
                <div class="lead-card-title">
                  <strong>${escapeHtml(lead.studentName)}</strong>
                  <span>${escapeHtml(lead.grade)} / ${escapeHtml(lead.subject)} / ${escapeHtml(lead.parentPhone)}</span>
                </div>
                <span class="tag ${statusClassMap[lead.status] || ""}">${escapeHtml(lead.status)}</span>
              </div>
              <div class="lead-card-grid">
                <div class="lead-kv">负责人：${escapeHtml(lead.owner)}</div>
                <div class="lead-kv">意向：${escapeHtml(lead.intent)}</div>
                <div class="lead-kv">来源：${escapeHtml(lead.channel)}</div>
                <div class="lead-kv">进群：${escapeHtml(lead.inGroup)}</div>
                <div class="lead-kv">试听：${escapeHtml(lead.trialTime ? formatTrialDisplay(lead.trialTime) : lead.trial)}</div>
                <div class="lead-kv">老师：${escapeHtml(lead.trialTeacher || "待安排")}</div>
              </div>
              <div class="lead-card-note">${escapeHtml(lead.nextAction || lead.note || "待补下一步")}</div>
              <div class="lead-card-actions">
                <button class="button small secondary" type="button" data-action="view-detail" data-student="${escapeHtml(lead.studentName)}">详情</button>
                <button class="button small" type="button" data-action="advance-status" data-student="${escapeHtml(lead.studentName)}" ${editable ? "" : "disabled"}>推进</button>
                <button class="button small secondary" type="button" data-action="assign-trial" data-student="${escapeHtml(lead.studentName)}" ${editable ? "" : "disabled"}>约试听</button>
                <button class="button small secondary" type="button" data-action="complete-trial" data-student="${escapeHtml(lead.studentName)}" ${editable ? "" : "disabled"}>已试听</button>
              </div>
            </article>
          `
        )
        .join("")
    : `
      <article class="lead-card">
        <div class="lead-card-title">
          <strong>没有匹配线索</strong>
          <span>清空搜索条件，或先新增一条线索。</span>
        </div>
      </article>
    `;
}

function renderLeadFilterControls() {
  const searchInput = byId("leadSearchInput");
  if (searchInput && searchInput.value !== state.leadSearchQuery) {
    searchInput.value = state.leadSearchQuery || "";
  }

  const ownerSelect = byId("leadOwnerFilter");
  if (ownerSelect) {
    const current = ownerSelect.value || state.leadOwnerFilter || "";
    ownerSelect.innerHTML = `<option value="">全部负责人</option>${uniqueValues(state.leads.map((lead) => lead.owner))
      .map((owner) => `<option value="${owner}">${owner}</option>`)
      .join("")}`;
    ownerSelect.value = Array.from(ownerSelect.options).some((option) => option.value === current)
      ? current
      : "";
    state.leadOwnerFilter = ownerSelect.value;
  }

  const channelSelect = byId("leadChannelFilter");
  if (channelSelect) {
    const current = channelSelect.value || state.leadChannelFilter || "";
    channelSelect.innerHTML = `<option value="">全部渠道</option>${uniqueValues(state.leads.map((lead) => lead.channel))
      .map((channel) => `<option value="${channel}">${channel}</option>`)
      .join("")}`;
    channelSelect.value = Array.from(channelSelect.options).some((option) => option.value === current)
      ? current
      : "";
    state.leadChannelFilter = channelSelect.value;
  }

  const intentSelect = byId("leadIntentFilter");
  if (intentSelect) {
    const current = state.leadIntentFilter || "";
    intentSelect.value = Array.from(intentSelect.options).some((option) => option.value === current)
      ? current
      : "";
    state.leadIntentFilter = intentSelect.value;
  }
}

function renderAdmissionTasks() {
  const body = byId("admissionsTaskBody");
  if (!body) return;
  const tasks = buildAdmissionTasks();
  const urgentCount = tasks.filter((task) => task.priority === "high").length;
  const missingCount = state.leads.filter((lead) => collectMissingLeadFields(lead).length > 0).length;
  if (byId("urgentTaskChip")) byId("urgentTaskChip").textContent = `紧急 ${urgentCount}`;
  if (byId("missingFieldChip")) byId("missingFieldChip").textContent = `待补字段 ${missingCount}`;
  body.innerHTML = tasks.length
    ? tasks
        .map(
          (task) => `
            <tr>
              <td><span class="priority-dot ${task.priority}">${task.label}</span></td>
              <td>${task.lead.studentName}<br>${task.lead.grade} / ${task.lead.subject}<br>${task.lead.parentPhone}</td>
              <td>${task.action}<br><span class="hint">${task.target}</span></td>
              <td>${task.lead.owner}</td>
              <td><button class="button small secondary" type="button" data-action="view-detail" data-student="${task.lead.studentName}">查看详情</button></td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>暂无</td>
          <td>当前没有紧急招生待办</td>
          <td>可以继续录入新线索，或查看渠道看板。</td>
          <td>-</td>
          <td>-</td>
        </tr>
      `;
  bindLeadActions();
}

function renderSopTasks() {
  const body = byId("sopTaskBody");
  if (!body) return;
  const rows = buildSopTasks();
  body.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              <td>${row.node}</td>
              <td>${row.lead.studentName} / ${row.lead.intent}<br>${row.lead.owner}</td>
              <td>${row.action}</td>
              <td>${row.goal}</td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>暂无</td>
          <td>当前没有试听后待转化线索</td>
          <td>试听完成后，系统会自动把对应学生放进这里。</td>
          <td>先保证试听反馈当天回填。</td>
        </tr>
      `;
}

function exportFilteredLeads() {
  const leads = getFilteredLeads();
  const headers = [
    "学生姓名",
    "年级",
    "家长电话",
    "意向学科",
    "来源渠道",
    "渠道归属",
    "推荐人",
    "当前负责人",
    "当前状态",
    "意向等级",
    "是否进群",
    "试听时间",
    "试听老师",
    "实收金额",
    "家长核心诉求",
    "学生薄弱点",
    "报名异议",
    "下次跟进日期",
    "下一步动作",
    "最近备注",
    "归属链",
  ];
  const rows = leads.map((lead) => {
    const attribution = lead.attributionLocked && lead.attributionSnapshot
      ? lead.attributionSnapshot
      : buildAttributionSnapshot(lead);
    return [
      lead.studentName,
      lead.grade,
      lead.parentPhone,
      lead.subject,
      lead.channel,
      deriveChannelOwner(lead),
      lead.referrerName || deriveReferrerText(lead.channelMeta),
      lead.owner,
      lead.status,
      lead.intent,
      lead.inGroup,
      lead.trialTime ? formatTrialDisplay(lead.trialTime) : lead.trial,
      lead.trialTeacher,
      lead.enrolledAmount || 0,
      lead.parentNeed,
      lead.studentPainPoint,
      lead.objection,
      lead.nextFollowupDate,
      lead.nextAction,
      lead.note,
      formatAttributionSnapshot(attribution),
    ];
  });
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`招生线索导出-${date}.csv`, `\ufeff${csv}`);
  logAudit("导出招生线索", "当前筛选", `导出 ${leads.length} 条线索。`);
  persistState();
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
  const quickSelect = byId("quickFollowupLeadSelect");
  const options = state.leads
    .map((lead) => `<option value="${lead.studentName}">${lead.studentName}</option>`)
    .join("");
  [select, quickSelect].forEach((targetSelect) => {
    if (!targetSelect) return;
    const currentValue = targetSelect.value || state.selectedLeadName;
    targetSelect.innerHTML = options;
    targetSelect.value = state.leads.some((lead) => lead.studentName === currentValue)
      ? currentValue
      : state.leads[0]?.studentName || "";
  });
}

function renderQuickFollowupDefaults() {
  const lead = getSelectedLead();
  const select = byId("quickFollowupLeadSelect");
  if (select && lead) select.value = lead.studentName;
  const nextDateInput = byId("quickFollowupNextDateInput");
  if (nextDateInput && lead && !nextDateInput.value) {
    nextDateInput.value = lead.nextFollowupDate || "";
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
  if (!lead) {
    byId("detailStudentName").textContent = "暂无线索";
    byId("detailGradeSubject").textContent = "请先新增线索或批量导入";
    byId("detailOwner").textContent = "-";
    byId("detailStatus").textContent = "待录入";
    byId("detailChannel").textContent = "-";
    byId("detailChannelMeta").textContent = "-";
    byId("detailNextAction").textContent = "先从 Excel 复制线索到批量导入区，或手动新增第一条线索。";
    byId("detailFollowup").textContent = "暂无跟进记录";
    byId("detailFollowupCount").textContent = "0 条记录";
    byId("detailFollowupTimeline").innerHTML = `
      <div class="timeline-item">
        <div class="timeline-time">暂无线索</div>
        <p>新增或导入线索后，这里会显示该学生的完整跟进历史。</p>
      </div>
    `;
    return;
  }
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
  byId("detailNeedInput").value = lead.parentNeed || "";
  byId("detailPainInput").value = lead.studentPainPoint || "";
  byId("detailObjectionSelect").value = lead.objection || "暂无明确异议";
  byId("detailNextFollowupDateInput").value = lead.nextFollowupDate || "";
  byId("detailNoteInput").value = lead.note;
  renderLeadDetailFollowups(lead);
}

function renderLeadDetailFollowups(lead) {
  const timeline = byId("detailFollowupTimeline");
  if (!timeline || !lead) return;
  const items = state.followups
    .filter((item) => item.studentName === lead.studentName)
    .slice()
    .reverse();
  const countNode = byId("detailFollowupCount");
  if (countNode) countNode.textContent = `${items.length} 条记录`;
  timeline.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <div class="timeline-item">
              <div class="timeline-time">${item.time} · ${item.studentName}</div>
              <p>${item.text}</p>
            </div>
          `
        )
        .join("")
    : `
        <div class="timeline-item">
          <div class="timeline-time">暂无跟进记录</div>
          <p>新增跟进、状态推进、试听反馈、报名登记后，这里会自动留下历史。</p>
        </div>
      `;
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
      pushFollowup(target.studentName, `在待补字段处理中补齐负责人：${nextOwner}。`);
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
      pushFollowup(target.studentName, `在待补字段处理中补齐来源渠道：${nextChannel}。`);
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
      pushFollowup(target.studentName, `在待补字段处理中补齐首条备注：${nextNote}。`);
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
      pushFollowup(target.studentName, `在待补字段处理中补齐渠道归属：${nextChannelOwner}。`);
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
      pushFollowup(target.studentName, `在待补字段处理中补齐推荐人：${nextReferrer}。`);
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
  if (!activeLead) {
    input.value = "";
    byId("enrollChannel").value = "";
    byId("enrollOwner").value = "";
    byId("enrollReferrer").value = "";
    byId("enrollAttributionPreview").value = "暂无可报名线索";
    byId("enrollRemark").value = "请先新增或导入线索，再登记报名。";
    byId("renewStudentName").value = "";
    byId("renewAttributionPreview").value = "暂无可续费/扩科学生";
    return;
  }

  byId("enrollChannel").value = activeLead.channel;
  byId("enrollOwner").value = activeLead.owner;
  byId("enrollReferrer").value = activeLead.referrerName || deriveReferrerText(activeLead.channelMeta);
  byId("enrollAttributionPreview").value = formatAttributionSnapshot(buildAttributionSnapshot(activeLead));
  byId("enrollRemark").value =
    activeLead.enrolledAmount > 0
      ? `已报名，实收 ${activeLead.enrolledAmount}。续费扩科沿用当前归属链。`
      : `${activeLead.nextAction}。如果扩科或续费，需要继承当前顾问和来源归属。当前链路：${activeLead.channel} / ${deriveChannelOwner(activeLead)} / ${activeLead.owner}${(activeLead.referrerName || deriveReferrerText(activeLead.channelMeta)) !== "无" ? ` / 推荐人 ${activeLead.referrerName || deriveReferrerText(activeLead.channelMeta)}` : ""}`;

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
    byId("archiveRenewalMeta").textContent = "每次续费扩科都从这里追踪继承链";
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
    : "每次续费扩科都从这里追踪继承链";
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
    normalizeDateTimeLocal(currentLead.trialTime) || defaultTrialDateTime();
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
  const contacted = state.leads.filter((lead) => lead.status !== "新建未联系").length;
  const trialTotal = state.leads.filter((lead) =>
    lead.status === "已预约试听" ||
    lead.status === "试听完成待转化" ||
    lead.status === "定金 / 已报名"
  ).length;

  byId("todayFollowupChip").textContent = `今日待跟进 ${state.leads.filter((lead) => lead.status !== "定金 / 已报名").length}`;
  byId("todayTrialChip").textContent = `待约试听 ${scheduled}`;
  byId("todayFeedbackChip").textContent = `待反馈 ${feedbackPending}`;
  byId("weeklyLeadCount").textContent = String(total);
  byId("weeklyLeadBreakdown").textContent = `线上 ${online} / 转介绍 ${referral} / 到访 ${visit}`;
  byId("scheduledTrialCount").textContent = String(scheduled + feedbackPending);
  byId("scheduledTrialMeta").textContent = `待上课 ${scheduled} / 已试听待反馈 ${feedbackPending}`;
  byId("enrolledCount").textContent = String(enrolled);
  byId("enrolledMeta").textContent = `实收 ${enrolledAmount.toLocaleString()} / 已报名 ${enrolled}`;
  byId("highIntentCount").textContent = String(highIntent);
  if (byId("funnelTotalCount")) byId("funnelTotalCount").textContent = String(total);
  if (byId("funnelContactedCount")) byId("funnelContactedCount").textContent = String(contacted);
  if (byId("funnelContactedRate")) byId("funnelContactedRate").textContent = `接通率 ${percent(contacted, total)}`;
  if (byId("funnelTrialCount")) byId("funnelTrialCount").textContent = String(trialTotal);
  if (byId("funnelTrialRate")) byId("funnelTrialRate").textContent = `邀约率 ${percent(trialTotal, total)}`;
  if (byId("funnelEnrollCount")) byId("funnelEnrollCount").textContent = String(enrolled);
  if (byId("funnelEnrollRate")) byId("funnelEnrollRate").textContent = `成交率 ${percent(enrolled, total)}`;
}

function getDormantLeads() {
  return state.leads
    .filter((lead) => lead.status !== "定金 / 已报名" && Number(lead.enrolledAmount || 0) <= 0)
    .map((lead) => {
      const gap = daysSince(lead.nextFollowupDate || lead.createdAt || "");
      const isDormantStatus = lead.status === "无效沉睡线索";
      return {
        lead,
        days: gap === null && isDormantStatus ? 30 : gap,
        isDormant: isDormantStatus || (gap !== null && gap > 0),
      };
    })
    .filter((item) => item.isDormant);
}

function renderDormantStats() {
  const dormant = getDormantLeads();
  const countByMinDays = (minDays) => dormant.filter((item) => Number(item.days || 0) >= minDays).length;
  const highIntentDormant = dormant.filter((item) => String(item.lead.intent || "").startsWith("A")).length;
  if (byId("dormant30Count")) byId("dormant30Count").textContent = String(countByMinDays(30));
  if (byId("dormant60Count")) byId("dormant60Count").textContent = String(countByMinDays(60));
  if (byId("dormant90Count")) byId("dormant90Count").textContent = String(countByMinDays(90));
  if (byId("dormantHighIntentCount")) byId("dormantHighIntentCount").textContent = String(highIntentDormant);
  if (byId("adminDormantRiskCount")) byId("adminDormantRiskCount").textContent = String(dormant.length);
  if (byId("reminderDormantCount")) byId("reminderDormantCount").textContent = String(highIntentDormant || dormant.length);
}

function renderChannelRoi() {
  const body = byId("channelRoiBody");
  if (!body) return;
  if (!state.leads.length) {
    body.innerHTML = `<tr><td colspan="6">导入真实线索和报名金额后自动统计。</td></tr>`;
    return;
  }
  const groups = new Map();
  state.leads.forEach((lead) => {
    const key = lead.channel || "待补来源";
    if (!groups.has(key)) {
      groups.set(key, { channel: key, leads: 0, enrolled: 0, amount: 0 });
    }
    const item = groups.get(key);
    item.leads += 1;
    if (Number(lead.enrolledAmount || 0) > 0 || lead.status === "定金 / 已报名") {
      item.enrolled += 1;
      item.amount += Number(lead.enrolledAmount || 0);
    }
  });
  body.innerHTML = Array.from(groups.values())
    .sort((a, b) => b.amount - a.amount || b.leads - a.leads)
    .map((row) => {
      const conversion = percent(row.enrolled, row.leads);
      const rewardText = row.channel.includes("转介绍")
        ? "转介绍奖励待财务确认"
        : row.channel.includes("抖音") || row.channel.includes("官网")
          ? "渠道提成待财务确认"
          : "暂不计渠道提成";
      return `
        <tr>
          <td>${escapeHtml(row.channel)}</td>
          <td>${row.leads}</td>
          <td>${row.enrolled}</td>
          <td>${row.amount.toLocaleString()}</td>
          <td>${rewardText}</td>
          <td>转化率 ${conversion}</td>
        </tr>
      `;
    })
    .join("");
}

function renderConsultantStats() {
  const employee = getCurrentEmployee();
  const isManager = hasPermission("admin.access") || hasPermission("admissions.finance");
  const targetName = employee && !isManager ? employee.name : "";
  const leads = targetName ? state.leads.filter((lead) => lead.owner === targetName) : state.leads;
  const trialCount = leads.filter((lead) =>
    ["已预约试听", "试听完成待转化", "定金 / 已报名"].includes(lead.status)
  ).length;
  const enrolled = leads.filter((lead) => Number(lead.enrolledAmount || 0) > 0 || lead.status === "定金 / 已报名");
  const amount = enrolled.reduce((sum, lead) => sum + Number(lead.enrolledAmount || 0), 0);
  if (byId("consultantLeadCount")) byId("consultantLeadCount").textContent = String(leads.length);
  if (byId("consultantLeadMeta")) byId("consultantLeadMeta").textContent = targetName ? `${targetName}负责线索` : "全部招生线索";
  if (byId("consultantTrialRate")) byId("consultantTrialRate").textContent = percent(trialCount, leads.length);
  if (byId("consultantEnrollCount")) byId("consultantEnrollCount").textContent = String(enrolled.length);
  if (byId("consultantEnrollMeta")) byId("consultantEnrollMeta").textContent = `实收 ${amount.toLocaleString()}`;
  if (byId("consultantCommissionLabel")) byId("consultantCommissionLabel").textContent = amount > 0 ? "待财务复核" : "待成交";
}

function renderReminderStats() {
  const scheduled = state.leads.filter((lead) => lead.status === "已预约试听").length;
  const activityCandidates = state.leads.filter((lead) =>
    Number(lead.enrolledAmount || 0) <= 0 && ["B 中意向", "C 低意向"].includes(lead.intent)
  ).length;
  if (byId("reminderTrialCount")) byId("reminderTrialCount").textContent = String(scheduled);
  if (byId("reminderActivityCount")) byId("reminderActivityCount").textContent = String(activityCandidates);
  if (byId("reminderStrategyLabel")) byId("reminderStrategyLabel").textContent = scheduled || activityCandidates ? "人工确认" : "暂无待发";
}

function renderManagementStats() {
  const total = state.leads.length;
  const hasFollowup = state.leads.filter((lead) => lead.note && lead.note !== "待补首条记录").length;
  const enrolled = state.leads.filter((lead) => Number(lead.enrolledAmount || 0) > 0 || lead.status === "定金 / 已报名");
  const referralEnrolled = enrolled.filter((lead) => lead.channel?.includes("转介绍")).length;
  if (byId("adminTotalLeads")) byId("adminTotalLeads").textContent = String(total);
  if (byId("adminFollowupRate")) byId("adminFollowupRate").textContent = percent(hasFollowup, total);
  if (byId("adminReferralRate")) byId("adminReferralRate").textContent = percent(referralEnrolled, enrolled.length);
}

function bindLeadCreate() {
  const button = byId("createLeadButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("createLeadMessage", "当前账号没有招生录入权限。", "error");
      return;
    }
    const studentName = byId("leadStudentName").value.trim();
    const parentPhone = byId("leadPhone").value.trim();
    if (!studentName || !parentPhone) {
      setInlineMessage("createLeadMessage", "请填写学生姓名和家长电话。", "error");
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
      parentNeed: "",
      studentPainPoint: "",
      objection: "暂无明确异议",
      nextFollowupDate: "",
      trialTeacher: "",
      trialTime: "",
      enrolledAmount: 0,
      createdAt: formatNowStamp(),
    });
    byId("leadStudentName").value = "";
    byId("leadPhone").value = "";
    byId("leadReferrer").value = "";
    byId("leadNote").value = "";
    state.selectedLeadName = studentName;
    logAudit("新增线索", studentName, `来源 ${byId("leadChannel").value}，负责人 ${byId("leadOwner").value || "待分配"}。`);
    renderAll();
    setInlineMessage("createLeadMessage", `已新增线索：${studentName}`, "success");
    showToast(`已新增线索：${studentName}`);
  });
}

function bindQuickLeadCreate() {
  const button = byId("quickCreateLeadButton");
  if (!button) return;
  button.addEventListener("click", () => {
    const message = byId("quickCreateLeadMessage");
    if (!canEditAdmissions()) {
      setInlineMessage("quickCreateLeadMessage", "当前账号没有招生录入权限。", "error");
      return;
    }
    const studentName = byId("quickLeadStudentName")?.value.trim();
    const parentPhone = byId("quickLeadPhone")?.value.trim();
    if (!studentName || !parentPhone) {
      setInlineMessage("quickCreateLeadMessage", "请先填写学生姓名和家长电话。", "error");
      return;
    }
    const duplicate = state.leads.find((lead) => normalizePhone(lead.parentPhone) && normalizePhone(lead.parentPhone) === normalizePhone(parentPhone));
    if (duplicate) {
      state.selectedLeadName = duplicate.studentName;
      setInlineMessage("quickCreateLeadMessage", `手机号已存在：${duplicate.studentName}`, "error");
      showToast(`手机号已存在，已选中 ${duplicate.studentName}`, "error");
      renderAll();
      return;
    }
    const channel = byId("quickLeadChannel")?.value || "待补来源";
    const owner = byId("quickLeadOwner")?.value || "待分配";
    const note = byId("quickLeadNote")?.value.trim() || "首页快速新增，待补首联记录。";
    state.leads.unshift({
      studentName,
      parentPhone,
      grade: byId("quickLeadGrade")?.value || "待补年级",
      subject: "数学",
      channel,
      channelMeta: "首页快速新增",
      owner,
      status: "新建未联系",
      trial: "未预约",
      intent: byId("quickLeadIntent")?.value || "B 中意向",
      inGroup: "未进群",
      lastFollowup: "刚刚录入",
      note,
      nextAction: "尽快首联并确认试听时间",
      parentNeed: "",
      studentPainPoint: "",
      objection: "暂无明确异议",
      nextFollowupDate: "",
      trialTeacher: "",
      trialTime: "",
      enrolledAmount: 0,
      createdAt: formatNowStamp(),
    });
    state.selectedLeadName = studentName;
    byId("quickLeadStudentName").value = "";
    byId("quickLeadPhone").value = "";
    byId("quickLeadNote").value = "";
    logAudit("首页新增线索", studentName, `来源 ${channel}，负责人 ${owner}。`);
    if (message) message.textContent = `已保存 ${studentName}，现在可以在线索中心继续补试听和跟进。`;
    setInlineMessage("quickCreateLeadMessage", `已保存 ${studentName}`, "success");
    showToast(`已保存新线索：${studentName}`);
    renderAll();
  });
}

function bindFeedbackSave() {
  const button = byId("saveFeedbackButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("saveFeedbackMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const targetName = byId("followupLeadSelect")?.value;
    const feedbackLeadName = byId("feedbackLeadSelect")?.value || targetName;
    if (!feedbackLeadName) {
      setInlineMessage("saveFeedbackMessage", "请选择要反馈的学生。", "error");
      return;
    }
    const target = state.leads.find(
      (lead) =>
        lead.studentName === feedbackLeadName ||
        lead.studentName === targetName ||
        lead.status === "试听完成待转化"
    );
    if (!target) {
      setInlineMessage("saveFeedbackMessage", "没有找到对应线索。", "error");
      return;
    }
    target.intent = byId("feedbackIntent").value;
    target.lastFollowup = "刚刚回填";
    target.note = byId("feedbackSummary").value.trim() || target.note;
    target.nextAction = `下次跟进：${byId("feedbackNextDate").value}`;
    target.inGroup = byId("detailInGroupSelect")?.value || target.inGroup;
    target.status = "试听完成待转化";
    state.selectedLeadName = target.studentName;
    logAudit("保存试听反馈", target.studentName, `意向改为 ${target.intent}，下次跟进 ${byId("feedbackNextDate").value || "待定"}。`);
    renderAll();
    setInlineMessage("saveFeedbackMessage", `已保存 ${target.studentName} 的试听反馈`, "success");
    showToast("试听反馈已保存");
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
    if (!canEditAdmissions()) {
      setInlineMessage("createEnrollmentMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const name = byId("enrollStudentName").value.trim();
    const amount = Number(byId("enrollReceived").value || 0);
    if (!name || !amount) {
      setInlineMessage("createEnrollmentMessage", "请填写报名学生和实收金额。", "error");
      return;
    }
    const target = state.leads.find((lead) => lead.studentName === name);
    if (!target) {
      setInlineMessage("createEnrollmentMessage", "没有找到这名学生，请先在线索中心新增。", "error");
      return;
    }
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
    pushFollowup(
      target.studentName,
      `已登记报名，实收金额 ${amount}，状态更新为定金 / 已报名。归属链已锁定：${target.attributionSnapshot.channel} / ${target.attributionSnapshot.channelOwner} / ${target.attributionSnapshot.owner}${target.attributionSnapshot.referrerName ? ` / 推荐人 ${target.attributionSnapshot.referrerName}` : ""}。`
    );
    logAudit("登记报名", target.studentName, `实收 ${amount}，锁定归属链 ${formatAttributionSnapshot(target.attributionSnapshot)}。`);
    renderAll();
    setInlineMessage("createEnrollmentMessage", `已登记报名：${name} / 实收 ${amount}`, "success");
    showToast("报名登记已保存，归属链已锁定");
  });
}

function bindFollowupCreate() {
  const button = byId("addFollowupButton");
  if (button) button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("addFollowupMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const leadName = byId("followupLeadSelect").value;
    const text = byId("followupInput").value.trim();
    if (!text) {
      setInlineMessage("addFollowupMessage", "请填写本次沟通记录。", "error");
      return;
    }
    const saved = saveFollowupRecord({
      leadName,
      text,
      method: byId("followupMethodSelect")?.value || "沟通",
      parentNeed: byId("followupNeedInput")?.value.trim() || "",
      painPoint: byId("followupPainInput")?.value.trim() || "",
      objection: byId("followupObjectionSelect")?.value || "暂无明确异议",
      nextDate: byId("followupNextDateInput")?.value || "",
    });
    if (!saved) return;
    byId("followupInput").value = "";
    byId("followupNeedInput").value = "";
    byId("followupPainInput").value = "";
    byId("followupNextDateInput").value = "";
    renderAll();
    setInlineMessage("addFollowupMessage", `已保存 ${leadName} 的跟进记录`, "success");
    showToast("跟进记录已保存");
  });

  byId("followupLeadSelect")?.addEventListener("change", () => {
    syncSelectedLead(byId("followupLeadSelect").value);
    renderAll();
  });

  byId("quickFollowupLeadSelect")?.addEventListener("change", () => {
    syncSelectedLead(byId("quickFollowupLeadSelect").value);
    renderAll();
  });

  byId("quickFollowupButton")?.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("quickFollowupMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const saved = saveFollowupRecord({
      leadName: byId("quickFollowupLeadSelect")?.value,
      text: byId("quickFollowupInput")?.value || "",
      method: byId("quickFollowupMethodSelect")?.value || "沟通",
      nextDate: byId("quickFollowupNextDateInput")?.value || "",
    });
    if (!saved) {
      setInlineMessage("quickFollowupMessage", "请选择线索并填写沟通记录。", "error");
      return;
    }
    byId("quickFollowupInput").value = "";
    renderAll();
    setInlineMessage("quickFollowupMessage", "已保存快捷跟进", "success");
    showToast("快捷跟进已保存");
  });
}

function bindRenewalCreate() {
  const button = byId("createRenewalButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("createRenewalMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const studentName = byId("renewStudentName").value.trim();
    const amount = Number(byId("renewAmount").value || 0);
    if (!studentName || !amount) {
      setInlineMessage("createRenewalMessage", "请填写学员和实收金额。", "error");
      return;
    }
    const target = state.leads.find((lead) => lead.studentName === studentName);
    if (!target) {
      setInlineMessage("createRenewalMessage", "没有找到这名学员，请先完成报名登记。", "error");
      return;
    }

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

    pushFollowup(
      target.studentName,
      `已登记${renewalRecord.type}，项目：${renewalRecord.courseName}，实收 ${amount}。默认继承归属链：${formatAttributionSnapshot(inheritedSnapshot)}。`
    );
    target.lastFollowup = "刚刚登记续费/扩科";
    target.nextAction = `${renewalRecord.type}已登记，继续按既有归属链结算`;
    logAudit(`登记${renewalRecord.type}`, target.studentName, `${renewalRecord.courseName} / 实收 ${amount} / 继承 ${formatAttributionSnapshot(inheritedSnapshot)}。`);
    renderAll();
    setInlineMessage("createRenewalMessage", `已登记${renewalRecord.type}：${target.studentName}`, "success");
    showToast("续费 / 扩科已保存");
  });
}

function bindBatchImport() {
  const button = byId("importBatchButton");
  if (!button) return;
  const templateButton = byId("copyImportTemplateButton");
  if (templateButton) {
    templateButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(importTemplateFields);
        templateButton.textContent = "已复制模板字段";
        window.setTimeout(() => {
          templateButton.textContent = "复制导入模板字段";
        }, 1600);
      } catch {
        const field = byId("importTemplateField");
        if (field) {
          field.value = importTemplateFields.replace(/\t/g, " / ");
          field.select?.();
        }
      }
      });
  }
  byId("resetAdmissionsButton")?.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const confirmed = window.confirm("将重新读取云端招生数据，不删除任何云端记录。确认继续吗？");
    if (!confirmed) return;
    state.leads = [];
    state.followups = [];
    state.auditLogs = [];
    state.importSummary = {
      added: 0,
      duplicates: 0,
      missingOwner: 0,
      missingFields: 0,
      results: [],
    };
    state.selectedLeadName = "";
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
  });
  button.addEventListener("click", () => {
    if (!canImportAdmissions()) {
      setInlineMessage("importBatchMessage", "当前账号没有招生导入权限。", "error");
      return;
    }
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
      setInlineMessage("importBatchMessage", "没有可导入内容。", "error");
      return;
    }

    const leadByPhone = new Map(
      state.leads
        .filter((lead) => normalizePhone(lead.parentPhone))
        .map((lead) => [normalizePhone(lead.parentPhone), lead])
    );

    const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const headerMap = maybeBuildImportHeaderMap(lines);
    const importLines = headerMap ? lines.slice(1) : lines;

    importLines.forEach((line) => {
      const parsed = parseImportLine(line, headerMap);
      const {
        studentName = "",
        grade = "",
        parentPhone = "",
        subject = "数学",
        channel = "",
        referrer = "",
        owner = "",
        note = "",
        status = "",
        intent = "",
        trialTime = "",
        trialTeacher = "",
        inGroup = "",
        parentNeed = "",
        studentPainPoint = "",
        objection = "",
        nextFollowupDate = "",
        nextAction = "",
      } = parsed;

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
        if (status) {
          existingLead.status = status;
          mergeNotes.push(`更新状态=${status}`);
        }
        if (intent) {
          existingLead.intent = intent;
          mergeNotes.push(`更新意向=${intent}`);
        }
        if (trialTime) {
          existingLead.trialTime = normalizeDateTimeLocal(trialTime);
          existingLead.trial = formatTrialDisplay(existingLead.trialTime);
          mergeNotes.push(`补试听时间=${trialTime}`);
        }
        if (trialTeacher) {
          existingLead.trialTeacher = trialTeacher;
          mergeNotes.push(`补试听老师=${trialTeacher}`);
        }
        if (inGroup) {
          existingLead.inGroup = inGroup.includes("已") || inGroup === "是" ? "已进群" : "未进群";
          mergeNotes.push(`更新进群=${existingLead.inGroup}`);
        }
        if (nextAction) {
          existingLead.nextAction = nextAction;
          mergeNotes.push("更新下一步");
        }
        if (parentNeed) {
          existingLead.parentNeed = parentNeed;
          mergeNotes.push("补家长诉求");
        }
        if (studentPainPoint) {
          existingLead.studentPainPoint = studentPainPoint;
          mergeNotes.push("补学生薄弱点");
        }
        if (objection) {
          existingLead.objection = objection;
          mergeNotes.push(`更新异议=${objection}`);
        }
        if (nextFollowupDate) {
          existingLead.nextFollowupDate = nextFollowupDate;
          mergeNotes.push(`补下次跟进=${nextFollowupDate}`);
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
        pushFollowup(
          existingLead.studentName,
          `批量导入检测到重复手机号，已并入原线索。${mergeNotes.length ? `本次补充：${mergeNotes.join("，")}。` : "本次未新增字段，仅提醒复核。"}`
        );
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
        status: status || defaultStatus,
        trial: "未预约",
        intent: intent || "B 中意向",
        inGroup: inGroup ? (inGroup.includes("已") || inGroup === "是" ? "已进群" : "未进群") : "未进群",
        lastFollowup: "刚刚导入",
        note: note || "待补首条记录",
        nextAction: nextAction || (owner ? "导入完成，尽快首联" : "待分配负责人后首联"),
        parentNeed,
        studentPainPoint,
        objection: objection || "暂无明确异议",
        nextFollowupDate,
        trialTeacher: trialTeacher || "",
        trialTime: normalizeDateTimeLocal(trialTime),
        enrolledAmount: 0,
        createdAt: formatNowStamp(),
      };
      if (newLead.trialTime) {
        newLead.trial = formatTrialDisplay(newLead.trialTime);
      }
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
    setInlineMessage("importBatchMessage", `导入完成：新增 ${summary.added}，重复 ${summary.duplicates}，待补 ${summary.missingFields}`, summary.missingFields ? "error" : "success");
    showToast(`导入完成：新增 ${summary.added} 条`);
  });
}

function bindTrialCreate() {
  const button = byId("saveTrialButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("saveTrialMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const studentName = byId("trialLeadSelect").value;
    if (!studentName) {
      setInlineMessage("saveTrialMessage", "请选择试听学生。", "error");
      return;
    }
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
    setInlineMessage("saveTrialMessage", `已预约：${target.studentName} / ${target.trialTeacher}`, "success");
    showToast("试听预约已保存");
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
    if (!canEditAdmissions()) {
      setInlineMessage("saveDetailMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const target = getSelectedLead();
    if (!target) return;
    const beforeSnapshot = formatAttributionSnapshot(target.attributionLocked && target.attributionSnapshot ? target.attributionSnapshot : buildAttributionSnapshot(target));
    const beforeStatus = target.status;
    const beforeOwner = target.owner;
    const beforeIntent = target.intent;
    target.owner = byId("detailOwnerSelect").value;
    target.status = byId("detailStatusSelect").value;
    target.intent = byId("detailIntentSelect").value;
    target.inGroup = byId("detailInGroupSelect").value;
    target.channelOwner = byId("detailChannelOwnerSelect").value;
    target.referrerName = byId("detailReferrerInput").value.trim();
    target.channelMeta = buildChannelMeta(target.channel, target.channelOwner, target.referrerName);
    target.nextAction = byId("detailNextActionInput").value.trim() || target.nextAction;
    target.parentNeed = byId("detailNeedInput").value.trim();
    target.studentPainPoint = byId("detailPainInput").value.trim();
    target.objection = byId("detailObjectionSelect").value;
    target.nextFollowupDate = byId("detailNextFollowupDateInput").value;
    target.note = byId("detailNoteInput").value.trim() || target.note;
    target.lastFollowup = "刚刚修改";
    const changedParts = [];
    if (beforeStatus !== target.status) changedParts.push(`状态：${beforeStatus} → ${target.status}`);
    if (beforeOwner !== target.owner) changedParts.push(`负责人：${beforeOwner} → ${target.owner}`);
    if (beforeIntent !== target.intent) changedParts.push(`意向：${beforeIntent} → ${target.intent}`);
    if (changedParts.length) {
      pushFollowup(target.studentName, `线索详情已更新：${changedParts.join("；")}。下一步：${target.nextAction}`);
    }
    logAudit("修改线索详情", target.studentName, `状态 ${target.status}，负责人 ${target.owner}，当前归属链 ${beforeSnapshot}。`);
    renderAll();
    setInlineMessage("saveDetailMessage", `已保存 ${target.studentName} 的修改`, "success");
    showToast("线索详情已保存");
  });
}

function bindNavigation() {
  const navItems = Array.from(document.querySelectorAll(".nav-item[data-nav-target]"));
  const sections = Array.from(document.querySelectorAll("[data-section-group]"));

  const applyView = (target) => {
    const nextTarget = navItems.some((item) => item.getAttribute("data-nav-target") === target)
      ? target
      : "dashboard";
    state.activeView = nextTarget;
    navItems.forEach((nav) => {
      nav.classList.toggle("active", nav.getAttribute("data-nav-target") === nextTarget);
    });
    sections.forEach((section) => {
      const groups = (section.getAttribute("data-section-group") || "").split(" ");
      section.classList.toggle("hidden-section", !groups.includes(nextTarget));
    });
    persistState();
  };
  activeViewApplier = applyView;

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      applyView(item.getAttribute("data-nav-target"));
    });
  });

  document.querySelectorAll("[data-jump-view]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      applyView(node.getAttribute("data-jump-view"));
      const href = node.getAttribute("href") || "";
      const targetNode = href.startsWith("#") ? document.querySelector(href) : null;
      if (targetNode) {
        targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  applyView(state.activeView || "dashboard");
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
      const previousStatus = target.status;
      if (target.status === "新建未联系") target.status = "已沟通待邀约";
      else if (target.status === "已沟通待邀约") target.status = "持续跟进中";
      else if (target.status === "试听完成待转化") target.status = "持续跟进中";
      target.lastFollowup = "刚刚推进";
      target.nextAction = "继续跟进并补下一步动作";
      pushFollowup(
        target.studentName,
        `状态推进：${previousStatus} → ${target.status}。系统提醒：状态变化后需要补充具体沟通内容和下一步动作。`
      );
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
      switchAdmissionView("trials", "#trialLeadSelect");
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
      pushFollowup(
        target.studentName,
        "已标记试听完成，进入试听完成待转化。下一步必须补试听反馈、家长异议、意向等级和报名方案。"
      );
      logAudit("完成试听", target.studentName, "已转入试听完成待转化。");
      syncSelectedLead(target.studentName);
      renderAll();
      switchAdmissionView("trials", "#feedbackLeadSelect");
    };
  });

  document.querySelectorAll("[data-action='reassign-owner']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      syncSelectedLead(target.studentName);
      renderAll();
      switchAdmissionView("leads", "#leadDetailPanel");
    };
  });

  document.querySelectorAll("[data-action='view-detail']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      syncSelectedLead(studentName);
      renderAll();
      switchAdmissionView("leads", "#leadDetailPanel");
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
      pushFollowup(target.studentName, `公海线索已重新分配给 ${target.owner}，需要尽快首联。`);
      logAudit("公海线索重分配", target.studentName, `改为 ${target.owner}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });
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
        <p>这里记录谁修改了线索、试听、报名、续费、导入和归属链。</p>
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
    '#createLeadButton',
    '#saveFeedbackButton',
    '#createEnrollmentButton',
    '#addFollowupButton',
    '#createRenewalButton',
    '#saveTrialButton',
    '#saveDetailButton',
    '#followupMethodSelect',
    '#followupNextDateInput',
    '#followupNeedInput',
    '#followupPainInput',
    '#followupObjectionSelect',
    '#quickFollowupLeadSelect',
    '#quickFollowupMethodSelect',
    '#quickFollowupNextDateInput',
    '#quickFollowupInput',
    '#quickFollowupButton',
    '#quickLeadStudentName',
    '#quickLeadGrade',
    '#quickLeadPhone',
    '#quickLeadChannel',
    '#quickLeadOwner',
    '#quickLeadIntent',
    '#quickLeadNote',
    '#quickCreateLeadButton'
  ];
  document.querySelectorAll(editSelectors.join(",")).forEach((node) => {
    if (!["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(node.tagName)) return;
    if (["leadSearchInput", "leadOwnerFilter", "leadChannelFilter", "leadIntentFilter"].includes(node.id)) return;
    if (node.id === "detailAttributionLock" || node.id === "renewStudentName" || node.id === "renewAttributionPreview" || node.id === "enrollAttributionPreview") {
      node.disabled = true;
      return;
    }
    node.disabled = !editable;
  });

  const importNodes = document.querySelectorAll("#importBatchInput, #importDefaultStatus, #importBatchButton, #copyImportTemplateButton");
  importNodes.forEach((node) => {
    node.disabled = !importable;
  });
  const exportButton = byId("exportFilteredLeadsButton");
  if (exportButton) {
    const exportable = canExportAdmissions();
    exportButton.disabled = !exportable;
    exportButton.title = exportable ? "导出当前筛选结果" : "当前账号没有招生导出权限";
  }
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

  const filterBindings = [
    ["leadSearchInput", "leadSearchQuery"],
    ["leadOwnerFilter", "leadOwnerFilter"],
    ["leadChannelFilter", "leadChannelFilter"],
    ["leadIntentFilter", "leadIntentFilter"],
  ];
  filterBindings.forEach(([id, key]) => {
    const node = byId(id);
    if (!node) return;
    const eventName = node.tagName === "INPUT" ? "input" : "change";
    node.addEventListener(eventName, () => {
      state[key] = node.value;
      renderLeadTable();
    });
  });

  const exportButton = byId("exportFilteredLeadsButton");
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      if (!canExportAdmissions()) return;
      exportFilteredLeads();
      renderAuditLogs();
    });
  }
}

function renderAll() {
  persistState();
  renderOperatorContext();
  renderLeadFilterControls();
  renderAdmissionTasks();
  renderLeadTable();
  renderTrialTable();
  renderSopTasks();
  renderFollowups();
  renderPublicPool();
  renderFollowupLeadOptions();
  renderQuickFollowupDefaults();
  renderFeedbackLeadOptions();
  renderEnrollmentLeadOptions();
  renderTrialLeadOptions();
  renderLeadDetail();
  renderImportSummary();
  renderPendingLeadFixes();
  renderStudentArchive();
  renderMetrics();
  renderDormantStats();
  renderChannelRoi();
  renderConsultantStats();
  renderReminderStats();
  renderManagementStats();
  renderAuditLogs();
  applyPermissionState();
}

bindLeadCreate();
bindQuickLeadCreate();
bindFeedbackSave();
bindEnrollmentCreate();
bindFollowupCreate();
bindRenewalCreate();
bindBatchImport();
bindTrialCreate();
bindDetailSave();
bindNavigation();
bindLeadFilters();
renderAll();
hydrateCloudState();
