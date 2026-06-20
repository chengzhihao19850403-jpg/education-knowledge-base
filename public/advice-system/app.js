const STORAGE_KEY = "advice-system-stage-prototype";

const defaultState = {
  activeLeadFilter: "all",
  selectedLeadName: "张同学",
  employees: [],
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
            <select data-owner-select="${lead.studentName}">
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
            <button class="button small" type="button" data-action="advance-status" data-student="${lead.studentName}">推进状态</button>
            <button class="button small secondary" type="button" data-action="assign-trial" data-student="${lead.studentName}">预约试听</button>
            <button class="button small secondary" type="button" data-action="complete-trial" data-student="${lead.studentName}">完成试听</button>
            <button class="button small secondary" type="button" data-action="reassign-owner" data-student="${lead.studentName}">重分配</button>
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
                  <select data-pending-owner-select="${lead.studentName}">
                    ${ownerOptions
                      .map(
                        (owner) =>
                          `<option value="${owner}" ${lead.owner === owner ? "selected" : ""}>${owner}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small" type="button" data-action="apply-pending-owner" data-student="${lead.studentName}">补负责人</button>
                </div>
                <div class="section-actions">
                  <select data-pending-channel-select="${lead.studentName}">
                    ${channelOptions
                      .map(
                        (channel) =>
                          `<option value="${channel}" ${lead.channel === channel ? "selected" : ""}>${channel}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small secondary" type="button" data-action="apply-pending-channel" data-student="${lead.studentName}">补来源</button>
                </div>
                <div class="section-actions">
                  <select data-pending-channel-owner-select="${lead.studentName}">
                    ${channelOwnerOptions
                      .map(
                        (channelOwner) =>
                          `<option value="${channelOwner}" ${deriveChannelOwner(lead) === channelOwner ? "selected" : ""}>${channelOwner}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small secondary" type="button" data-action="apply-pending-channel-owner" data-student="${lead.studentName}">补渠道归属</button>
                </div>
                <div class="section-actions">
                  <input data-pending-referrer-input="${lead.studentName}" value="${lead.referrerName || ""}">
                  <button class="button small secondary" type="button" data-action="apply-pending-referrer" data-student="${lead.studentName}">补推荐人</button>
                </div>
                <div class="section-actions">
                  <input data-pending-note-input="${lead.studentName}" value="${lead.note === "待补首条记录" ? "" : lead.note}">
                  <button class="button small secondary" type="button" data-action="apply-pending-note" data-student="${lead.studentName}">补备注</button>
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
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-channel']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
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
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-note']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
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
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-channel-owner']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
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
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-referrer']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
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
              <select data-public-owner-select="${lead.studentName}">
                ${ownerOptions
                  .map(
                    (owner) =>
                      `<option value="${owner}" ${lead.owner === owner ? "selected" : ""}>${owner}</option>`
                  )
                  .join("")}
              </select>
              <button class="button small secondary" type="button" data-action="public-reassign" data-student="${lead.studentName}">重新分配</button>
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
    renderAll();
  });
}

function bindFeedbackSave() {
  const button = byId("saveFeedbackButton");
  if (!button) return;
  button.addEventListener("click", () => {
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
    }
    renderAll();
  });
}

function bindFollowupCreate() {
  const button = byId("addFollowupButton");
  if (!button) return;
  button.addEventListener("click", () => {
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
    renderAll();
  });
}

function bindBatchImport() {
  const button = byId("importBatchButton");
  if (!button) return;
  button.addEventListener("click", () => {
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
    renderAll();
  });
}

function bindTrialCreate() {
  const button = byId("saveTrialButton");
  if (!button) return;
  button.addEventListener("click", () => {
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
    const target = getSelectedLead();
    if (!target) return;
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
      target.owner = select.value;
      target.lastFollowup = "刚刚重分配";
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='advance-status']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (target.status === "新建未联系") target.status = "已沟通待邀约";
      else if (target.status === "已沟通待邀约") target.status = "持续跟进中";
      else if (target.status === "试听完成待转化") target.status = "持续跟进中";
      target.lastFollowup = "刚刚推进";
      target.nextAction = "继续跟进并补下一步动作";
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
      target.status = "试听完成待转化";
      target.trial = "已试听";
      target.nextAction = "48 小时内给报名方案";
      target.lastFollowup = "刚刚完成试听";
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
      const ownerSelect = document.querySelector(
        `[data-public-owner-select="${studentName}"]`
      );
      target.owner = ownerSelect?.value || ownerOptions[0];
      target.nextAction = "已重新分配，尽快首联";
      target.lastFollowup = "刚刚重分配";
      syncSelectedLead(target.studentName);
      renderAll();
    };
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
}

bindLeadCreate();
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
