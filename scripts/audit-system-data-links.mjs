import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function extractPreimportBundle() {
  const source = readText("portal/preimport-data.js");
  const context = { window: {} };
  context.window.window = context.window;
  vm.runInNewContext(source, context, { filename: "portal/preimport-data.js" });
  return context.window.JRC_PREIMPORT_BUNDLE || context.window.JRC_PREIMPORT_SUMMARY || {};
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function statusLine(status, title, detail) {
  return `${status.padEnd(4)} ${title} - ${detail}`;
}

function sourceHas(file, pattern) {
  return pattern.test(readText(file));
}

const files = {
  auth: readText("portal/auth.js"),
  dashboard: readText("portal/dashboard.js"),
  business: readText("portal/business-modules.js"),
  paike: readText("portal/paike.html"),
  finance: readText("portal/finance.html"),
  student: readText("portal/student-service.html"),
  ai: readText("portal/ai-assistant.html"),
  suggestions: readText("portal/suggestions.html"),
  teachingQuality: readText("portal/teaching-quality.html"),
  admissions: readText("public/advice-system/app.js"),
  dataSync: readText("portal/data-sync.js")
};

const preimport = extractPreimportBundle();
const scheduleSessions = Array.isArray(preimport.scheduleSessions) ? preimport.scheduleSessions : [];
const salaryAttendance = Array.isArray(preimport.salaryAttendance) ? preimport.salaryAttendance : [];
const salaryRevenueAttendance = Array.isArray(preimport.salaryRevenueAttendance) ? preimport.salaryRevenueAttendance : [];
const teacherSummary = Array.isArray(preimport.teacherFinanceSummaryRows) ? preimport.teacherFinanceSummaryRows : [];
const issues = Array.isArray(preimport.reconciliationIssues) ? preimport.reconciliationIssues : [];
const periods = unique(scheduleSessions.map((row) => row.period));
const teachers = unique(scheduleSessions.map((row) => row.teacherName));

const checks = [
  {
    title: "排课预导入数据",
    pass: scheduleSessions.length > 0,
    detail: `${scheduleSessions.length} 节排课，${periods.join("、") || "无月份"}，${teachers.length} 位老师。`
  },
  {
    title: "排课系统读取正式/预导入数据",
    pass: /readCloud\(stores\.preimport/.test(files.paike) && /scheduleSessionsFromPreimport/.test(files.paike) && /paikeDataSourceGrid/.test(files.paike),
    detail: "排课页会读取预导入/正式排课 store，并显示排课、点名、招生待排课来源。"
  },
  {
    title: "学生服务读取排课并生成点名名单",
    pass: /readModuleData\(PREIMPORT_STORE_KEY\)/.test(files.student) && /renderPreimportOptions/.test(files.student),
    detail: "学生服务会按日期、老师、班级从排课源生成点名候选。"
  },
  {
    title: "点名保存后写入云端",
    pass: /writeModuleData\(STORE_KEY, "studentService", mergedRows\)/.test(files.student),
    detail: "点名出门测保存到 jrc-class-attendance-v1。"
  },
  {
    title: "点名沉淀学生服务",
    pass: /syncAttendanceIntoStudentService/.test(files.student) && /attendanceRowToStudentService/.test(files.business),
    detail: "到课、迟到、缺勤处理和出门测会沉淀到学生服务台账。"
  },
  {
    title: "财务读取点名",
    pass: /readModuleData\?\.\(ATTENDANCE_STORAGE_KEY\)/.test(files.finance) || /readModuleData\(ATTENDANCE_STORAGE_KEY\)/.test(files.finance),
    detail: "财务页会读取 jrc-class-attendance-v1，用于课时费/课销候选。"
  },
  {
    title: "点名形成财务核对入口",
    pass: /attendanceFinanceSection/.test(files.finance) && /renderAttendanceSettlementPreview/.test(files.finance) && /attendanceSettlementFinanceBody/.test(files.finance) && /attendanceDetailFinanceBody/.test(files.finance),
    detail: "财务页已按老师/月展示点名课时费、家长课销、单独结算和待追踪明细。"
  },
  {
    title: "财务读取原始工资/排课预导入",
    pass: /readModuleData\?\.\(PREIMPORT_STORE_KEY\)/.test(files.finance) || /readModuleData\(PREIMPORT_STORE_KEY\)/.test(files.finance),
    detail: `${salaryAttendance.length} 行工资课时，${salaryRevenueAttendance.length} 行收入，${teacherSummary.length} 行老师汇总，${issues.length} 条待核差异。`
  },
  {
    title: "招生报名沉淀学生服务",
    pass: /syncAdmissionsIntoStudentService/.test(files.admissions) && /admissionLeadToStudentService/.test(files.business),
    detail: "招生报名/实收后会生成学生服务入学交接候选。"
  },
  {
    title: "招生报名生成排课待办",
    pass: /flow-admissions-to-paike/.test(files.dashboard) && /admissionSchedulePanel/.test(files.paike) && /applyAdmissionScheduleAction/.test(files.paike),
    detail: "报名学生未排课时，会进入周珊首页任务，并在排课系统显示待排课名单，可直接定位课表和教室。"
  },
  {
    title: "财务主动读取招生云端数据",
    pass: /ADMISSIONS_STORE_KEY/.test(files.finance) && /hydrateFinanceLinkedStores/.test(files.finance) && /admissionsFinanceCandidateBody/.test(files.finance),
    detail: "财务页会主动补水招生 store，并显示招生实收归因候选。"
  },
  {
    title: "财务主动读取教学质量云端数据",
    pass: /TEACHING_QUALITY_STORE_KEY/.test(files.finance) && /hydrateFinanceLinkedStores/.test(files.finance) && /renderQualityFinanceCandidates/.test(files.finance) && /qualityFinanceCandidateBody/.test(files.finance),
    detail: "财务页会主动补水教学质量 store，并显示教学质量系数候选。"
  },
  {
    title: "教学质量写入云端",
    pass: /writeModuleData\(STORAGE_KEY, "teachingQuality", mergedState\)/.test(files.teachingQuality),
    detail: "巡课、问卷、整改数据保存到 jrc-teaching-quality-system-v2-demo。"
  },
  {
    title: "AI课堂反馈归档学生服务",
    pass: /writeModuleData\?\.\(STUDENT_SERVICE_KEY, "studentService", nextRows\)/.test(files.ai) && /jrc-student-service-linked/.test(files.ai),
    detail: "老师确认后归档到学生服务，而不是 AI 自动直接发给家长。"
  },
  {
    title: "全站反馈转任务",
    pass: /FEEDBACK_STORAGE_KEY/.test(files.suggestions) && /sourceFeedbackId|t-feedback-/.test(files.suggestions),
    detail: "反馈问题可转建议任务，并让提出人复核。"
  },
  {
    title: "系统流动断点进入我的任务",
    pass: /mergeSystemFlowTasks/.test(files.dashboard) && /systemFlowTaskDetailHtml/.test(files.dashboard),
    detail: "报名未排课、今日未点名、缺勤未处理会进入负责人首页任务。"
  },
  {
    title: "云端托管 store 覆盖核心模块",
    pass: [
      "jrc-paike-finance-preimport-2026-06-22",
      "jrc-class-attendance-v1",
      "advice-system-stage-prototype",
      "jrc-student-service-v2",
      "jrc-finance-ledger-v1",
      "jrc-teaching-quality-system-v2-demo",
      "jrc-suggestion-management-v2"
    ].every((key) => files.dataSync.includes(key)),
    detail: "data-sync.js 已纳入核心数据副本范围。"
  }
];

const warnings = [];
if (scheduleSessions.length && !sourceHas("portal/paike.html", /writeModuleData\(stores\.preimport/)) {
  warnings.push("排课页主要读取预导入数据，预导入写入仍主要由财务/AI/导入脚本承担；若要让排课老师直接上传 XLSX 后落云，需要继续增强。");
}
if (!/admissionSchedulePanel/.test(files.paike) || !/advice-system-stage-prototype/.test(files.paike)) {
  warnings.push("排课系统没有直接展示招生待排课名单，招生→排课只能依赖首页任务提醒。");
} else {
  warnings.push("招生→排课已在排课页显示待排课名单，并能定位课表/教室；最终仍由排课负责人确认老师、时间、教室后手动排入课表，避免自动乱塞课。");
}
if (!/writeModuleData\(FINANCE_STORAGE_KEY, "finance"/.test(files.admissions)) {
  warnings.push("招生实收没有直接写入正式财务月结，当前是财务联动候选和归因展示，最终仍需财务复核。");
}
if (countMatches(files.finance, /待对账|待核/g) > 20) {
  warnings.push("财务系统仍有大量待核/待对账口径，适合试运行对照人工表，不适合直接作为唯一结算依据。");
}

const failed = checks.filter((check) => !check.pass);
const passed = checks.length - failed.length;
const lines = [
  "匠人程工作台数据链路审计",
  `检查时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
  `结果：${passed}/${checks.length} 通过，${failed.length} 个失败，${warnings.length} 个提示。`,
  "",
  ...checks.map((check) => statusLine(check.pass ? "PASS" : "FAIL", check.title, check.detail)),
  "",
  "提示：",
  ...(warnings.length ? warnings.map((item, index) => `${index + 1}. ${item}`) : ["无"]),
  ""
];

console.log(lines.join("\n"));
process.exitCode = failed.length ? 1 : 0;
