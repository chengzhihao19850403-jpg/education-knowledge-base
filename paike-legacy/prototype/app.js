const STORAGE_KEY = "paike-system-prototype-v1";
const STORAGE_META_KEY = "paike-system-prototype-meta-v1";
const BUNDLED_SNAPSHOT_PATH = "./default-snapshot.json";
const LOCAL_DB_HEALTH_PATH = "/api/health";
const LOCAL_DB_STATE_PATH = "/api/state";
const LOCAL_DB_HISTORY_PATH = "/api/history";
const LOCAL_DB_RESTORE_PATH = "/api/restore";
const LOCAL_DB_AUTOSAVE_DELAY_MS = 800;
const LOCAL_DB_WEB_PROTOCOLS = new Set(["http:", "https:"]);
const SUMMER_IMPORT_REVIEW_STORAGE_KEY = "paike-summer-import-review-v1";
const LOCAL_DB_NON_PROMOTABLE_BROWSER_SNAPSHOT_ORIGINS = new Set([
  "bundled_snapshot",
  "backend_database",
]);

const SLOT_TEMPLATES = [
  { index: 1, label: "第1节", time: "08:30-10:00" },
  { index: 2, label: "第2节", time: "10:10-11:40" },
  { index: 3, label: "第3节", time: "13:00-14:30" },
  { index: 4, label: "第4节", time: "14:40-16:10" },
  { index: 5, label: "第5节", time: "16:20-17:50" },
  { index: 6, label: "第6节", time: "18:30-20:00" },
];

const DAY_TEMPLATES = [
  { key: "mon", label: "周一", kind: "weekday" },
  { key: "tue", label: "周二", kind: "weekday" },
  { key: "wed", label: "周三", kind: "weekday" },
  { key: "thu", label: "周四", kind: "weekday" },
  { key: "fri", label: "周五", kind: "weekday" },
  { key: "sat", label: "周六", kind: "weekend" },
  { key: "sun", label: "周日", kind: "weekend" },
];

function isSimpleMode() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("simple-mode");
}

const SUMMER_PHASE_COUNT = 3;
const SUMMER_LESSONS_PER_PHASE = 15;
const HOLIDAY_PRIMARY_PROJECTION_PERIOD = "2026-07";
const HOLIDAY_SECONDARY_PROJECTION_PERIOD = "2026-08";
const SUMMER_MANUAL_TERMINAL_STATUSES = new Set(["resolved", "confirmed", "applied"]);
const DAY_KEY_ALIASES = new Map([
  ["mon", "mon"],
  ["monday", "mon"],
  ["1", "mon"],
  ["一", "mon"],
  ["周一", "mon"],
  ["星期一", "mon"],
  ["礼拜一", "mon"],
  ["tue", "tue"],
  ["tues", "tue"],
  ["tuesday", "tue"],
  ["2", "tue"],
  ["二", "tue"],
  ["周二", "tue"],
  ["星期二", "tue"],
  ["礼拜二", "tue"],
  ["wed", "wed"],
  ["wednesday", "wed"],
  ["3", "wed"],
  ["三", "wed"],
  ["周三", "wed"],
  ["星期三", "wed"],
  ["礼拜三", "wed"],
  ["thu", "thu"],
  ["thur", "thu"],
  ["thurs", "thu"],
  ["thursday", "thu"],
  ["4", "thu"],
  ["四", "thu"],
  ["周四", "thu"],
  ["星期四", "thu"],
  ["礼拜四", "thu"],
  ["fri", "fri"],
  ["friday", "fri"],
  ["5", "fri"],
  ["五", "fri"],
  ["周五", "fri"],
  ["星期五", "fri"],
  ["礼拜五", "fri"],
  ["sat", "sat"],
  ["saturday", "sat"],
  ["6", "sat"],
  ["六", "sat"],
  ["周六", "sat"],
  ["星期六", "sat"],
  ["礼拜六", "sat"],
  ["sun", "sun"],
  ["sunday", "sun"],
  ["7", "sun"],
  ["日", "sun"],
  ["天", "sun"],
  ["周日", "sun"],
  ["周天", "sun"],
  ["星期日", "sun"],
  ["星期天", "sun"],
  ["礼拜日", "sun"],
  ["礼拜天", "sun"],
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeDayKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return DAY_KEY_ALIASES.get(normalized) || "";
}

function dayKeyToLabel(dayKey) {
  return DAY_TEMPLATES.find((day) => day.key === dayKey)?.label || dayKey || "";
}

function parseTeacherRestDayKeys(teacher) {
  const rawValue = String(teacher?.weeklyRestDay || "").trim();
  if (!rawValue || rawValue === "动态安排") {
    return [];
  }
  return [...new Set(
    rawValue
      .split(/[、，,\/|；;\s]+/)
      .map((item) => normalizeDayKey(item))
      .filter(Boolean)
  )];
}

function getTeacherAssignedDayKeys(teacherName, teacherDayCount) {
  const keys = new Set();
  const prefix = `${teacherName}-`;
  teacherDayCount.forEach((count, key) => {
    if (count > 0 && key.startsWith(prefix)) {
      keys.add(key.slice(prefix.length));
    }
  });
  return keys;
}

function getTeacherLongestTeachingStreak(dayKeys) {
  const flags = DAY_TEMPLATES.map((day) => dayKeys.has(day.key));
  if (!flags.some(Boolean)) {
    return 0;
  }
  if (flags.every(Boolean)) {
    return flags.length;
  }
  let longest = 0;
  let current = 0;
  for (let index = 0; index < flags.length * 2; index += 1) {
    if (flags[index % flags.length]) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return Math.min(longest, flags.length);
}

function formatTeacherRestDaySummary(teacher) {
  const restDayKeys = parseTeacherRestDayKeys(teacher);
  if (!restDayKeys.length) {
    return "动态安排";
  }
  return restDayKeys.map((dayKey) => dayKeyToLabel(dayKey)).join(" / ");
}

function getTeacherMaxTeachingStreak(teacher) {
  return teacher?.schedulePattern === "3_on_1_off" ? 3 : 6;
}

const FIELD_CONFIG = {
  teacher: [
    { field: "name", type: "text" },
    { field: "subject", type: "select", options: ["math", "science"] },
    { field: "gradeFrom", type: "number", min: 1, max: 9 },
    { field: "gradeTo", type: "number", min: 1, max: 9 },
    { field: "isCore", type: "boolean" },
    { field: "isKey", type: "boolean" },
    { field: "isOwner", type: "boolean" },
    { field: "maxPerDay", type: "number", min: 1, max: 6 },
    { field: "maxPerWeek", type: "number", min: 1, max: 36 },
    { field: "weeklyRestDay", type: "text", placeholder: "动态安排" },
    { field: "schedulePattern", type: "select", options: ["6_on_1_off", "3_on_1_off"] },
    { field: "fixedRoom", type: "text", placeholder: "留空表示不固定" },
    { field: "noEvening", type: "boolean" },
  ],
  room: [
    { field: "name", type: "text" },
    { field: "floor", type: "text" },
    { field: "maxCapacity", type: "number", min: 1, max: 80 },
    { field: "roomType", type: "select", options: ["small_class", "medium_class", "large_class", "one_to_one"] },
    { field: "isFixed", type: "boolean" },
    { field: "summerPriority", type: "number", min: 0, max: 100 },
    { field: "notes", type: "text", placeholder: "备注" },
  ],
  demand: [
    { field: "name", type: "text" },
    { field: "subject", type: "select", options: ["math", "science"] },
    { field: "grade", type: "number", min: 1, max: 9 },
    { field: "size", type: "number", min: 1, max: 80 },
    { field: "courseType", type: "select", options: ["small_class", "medium_class", "large_class", "one_to_one"] },
    { field: "weeklySessions", type: "number", min: 1, max: 6 },
    { field: "estimatedRevenuePerSession", type: "number", min: 0 },
    { field: "preferredTime", type: "select", options: ["evening", "weekend", "flexible"] },
    { field: "fixedTeacher", type: "text", placeholder: "可留空" },
    { field: "fixedRoom", type: "text", placeholder: "可留空" },
    { field: "status", type: "select", options: ["recruiting", "planned", "confirmed"] },
  ],
  financialPeriod: [
    { field: "periodName", type: "text" },
    { field: "grossProfit", type: "number", min: 0 },
    { field: "totalExpense", type: "number", min: 0 },
    { field: "teachingBusinessExpense", type: "number", min: 0 },
    { field: "netProfit", type: "number" },
  ],
  summerClassRevenue: [
    { field: "estimatedSessionRevenue", type: "text" },
    { field: "resolutionStatus", type: "text" },
    { field: "notes", type: "text" },
  ],
};

const CSV_SCHEMAS = {
  teacher: {
    filename: "teachers-export.csv",
    headers: [
      "teacher_name",
      "subject",
      "is_core_teacher",
      "is_key_teacher",
      "is_owner",
      "grade_from",
      "grade_to",
      "max_lessons_per_day",
      "max_lessons_per_week",
      "weekly_rest_day",
      "schedule_pattern",
      "fixed_classroom_name",
      "no_evening_classes",
      "status",
    ],
    toRow(item) {
      return {
        teacher_name: item.name,
        subject: item.subject,
        is_core_teacher: toBinary(item.isCore),
        is_key_teacher: toBinary(item.isKey),
        is_owner: toBinary(item.isOwner),
        grade_from: item.gradeFrom,
        grade_to: item.gradeTo,
        max_lessons_per_day: item.maxPerDay,
        max_lessons_per_week: item.maxPerWeek,
        weekly_rest_day: item.weeklyRestDay,
        schedule_pattern: item.schedulePattern,
        fixed_classroom_name: item.fixedRoom,
        no_evening_classes: toBinary(item.noEvening),
        status: item.status,
      };
    },
    fromRow(row) {
      return normalizeTeacher({
        name: row.teacher_name || row.name || "",
        subject: row.subject || "math",
        gradeFrom: row.grade_from,
        gradeTo: row.grade_to,
        isCore: parseBooleanLoose(row.is_core_teacher),
        isKey: parseBooleanLoose(row.is_key_teacher),
        isOwner: parseBooleanLoose(row.is_owner),
        maxPerDay: row.max_lessons_per_day,
        maxPerWeek: row.max_lessons_per_week,
        weeklyRestDay: row.weekly_rest_day || "",
        schedulePattern: row.schedule_pattern || "6_on_1_off",
        fixedRoom: row.fixed_classroom_name || "",
        noEvening: parseBooleanLoose(row.no_evening_classes),
        status: row.status || "active",
      });
    },
  },
  room: {
    filename: "rooms-export.csv",
    headers: [
      "classroom_name",
      "floor_label",
      "max_capacity",
      "room_type",
      "is_fixed",
      "summer_priority",
      "equipment_notes",
      "is_active",
    ],
    toRow(item) {
      return {
        classroom_name: item.name,
        floor_label: item.floor,
        max_capacity: item.maxCapacity,
        room_type: item.roomType,
        is_fixed: toBinary(item.isFixed),
        summer_priority: item.summerPriority,
        equipment_notes: item.notes,
        is_active: toBinary(item.isActive),
      };
    },
    fromRow(row) {
      return normalizeRoom({
        name: row.classroom_name || row.name || "",
        floor: row.floor_label || "1F",
        maxCapacity: row.max_capacity,
        roomType: row.room_type || "small_class",
        isFixed: parseBooleanLoose(row.is_fixed),
        summerPriority: row.summer_priority,
        notes: row.equipment_notes || "",
        isActive: parseBooleanLoose(row.is_active, true),
      });
    },
  },
  demand: {
    filename: "demands-export.csv",
    headers: [
      "demand_name",
      "subject",
      "grade",
      "expected_size",
      "course_type",
      "weekly_sessions",
      "estimated_session_revenue",
      "preferred_time_type",
      "fixed_teacher_name",
      "fixed_classroom_name",
      "status",
    ],
    toRow(item) {
      return {
        demand_name: item.name,
        subject: item.subject,
        grade: item.grade,
        expected_size: item.size,
        course_type: item.courseType,
        weekly_sessions: item.weeklySessions,
        estimated_session_revenue: item.estimatedRevenuePerSession,
        preferred_time_type: item.preferredTime,
        fixed_teacher_name: item.fixedTeacher,
        fixed_classroom_name: item.fixedRoom,
        status: item.status,
      };
    },
    fromRow(row) {
      return normalizeDemand({
        name: row.demand_name || row.class_name || row.name || "",
        subject: row.subject || "math",
        grade: row.grade,
        size: row.expected_size || row.current_size || row.planned_size,
        courseType: row.course_type || "small_class",
        weeklySessions: row.weekly_sessions || 1,
        estimatedRevenuePerSession:
          row.estimated_session_revenue || row.estimated_revenue_per_session || 0,
        preferredTime: row.preferred_time_type || row.preferred_time || "flexible",
        fixedTeacher: row.fixed_teacher_name || "",
        fixedRoom: row.fixed_classroom_name || "",
        status: normalizeDemandStatus(row.status),
      });
    },
  },
  financialPeriod: {
    filename: "financial-periods-export.csv",
    headers: [
      "period_name",
      "gross_profit_amount",
      "total_expense_amount",
      "teaching_business_expense_amount",
      "net_profit_amount",
    ],
    toRow(item) {
      return {
        period_name: item.periodName,
        gross_profit_amount: item.grossProfit,
        total_expense_amount: item.totalExpense,
        teaching_business_expense_amount: item.teachingBusinessExpense,
        net_profit_amount: item.netProfit,
      };
    },
    fromRow(row) {
      return normalizeFinancialPeriod({
        periodName: row.period_name || row.period || "",
        grossProfit: row.gross_profit_amount || row.gross_profit_amount_raw || 0,
        totalExpense: row.total_expense_amount || row.total_expense_amount_raw || 0,
        teachingBusinessExpense:
          row.teaching_business_expense_amount || row.teaching_business_expense_amount_raw || 0,
        netProfit: row.net_profit_amount || row.net_profit_amount_raw || 0,
      });
    },
  },
  summerClassRevenueRow: {
    filename: "summer-class-revenue-template.csv",
    headers: [
      "class_name",
      "subject",
      "grade",
      "course_type",
      "planned_size",
      "current_size",
      "teacher_names",
      "teaching_session_count",
      "target_teaching_session_count",
      "estimated_session_revenue",
      "estimated_revenue_source",
      "suggested_unit_fee",
      "suggested_session_revenue",
      "suggested_revenue_source",
      "suggestion_sample_count",
      "resolution_status",
      "notes",
    ],
    toRow(item) {
      return {
        class_name: item.className,
        subject: item.subject,
        grade: item.grade,
        course_type: item.courseType,
        planned_size: item.plannedSize,
        current_size: item.currentSize,
        teacher_names: item.teacherNamesText,
        teaching_session_count: item.teachingSessionCount,
        target_teaching_session_count: item.targetTeachingSessionCount,
        estimated_session_revenue: item.estimatedSessionRevenue,
        estimated_revenue_source: item.estimatedRevenueSource,
        suggested_unit_fee: item.suggestedUnitFee,
        suggested_session_revenue: item.suggestedSessionRevenue,
        suggested_revenue_source: item.suggestedRevenueSource,
        suggestion_sample_count: item.suggestionSampleCount,
        resolution_status: item.resolutionStatus,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeSummerClassRevenueRow({
        className: row.class_name || row.className || "",
        subject: row.subject || "",
        grade: row.grade || "",
        courseType: row.course_type || row.courseType || "",
        plannedSize: row.planned_size || row.plannedSize || "",
        currentSize: row.current_size || row.currentSize || "",
        teacherNamesText: row.teacher_names || row.teacherNames || "",
        teachingSessionCount:
          row.teaching_session_count || row.teachingSessionCount || "",
        targetTeachingSessionCount:
          row.target_teaching_session_count ||
          row.targetTeachingSessionCount ||
          "",
        estimatedSessionRevenue:
          row.estimated_session_revenue || row.estimatedSessionRevenue || "",
        estimatedRevenueSource:
          row.estimated_revenue_source || row.estimatedRevenueSource || "",
        suggestedUnitFee: row.suggested_unit_fee || row.suggestedUnitFee || "",
        suggestedSessionRevenue:
          row.suggested_session_revenue || row.suggestedSessionRevenue || "",
        suggestedRevenueSource:
          row.suggested_revenue_source || row.suggestedRevenueSource || "",
        suggestionSampleCount:
          row.suggestion_sample_count || row.suggestionSampleCount || "",
        resolutionStatus:
          row.resolution_status || row.resolutionStatus || "",
        notes: row.notes || "",
      });
    },
  },
  dividendPolicy: {
    filename: "dividend-policy-export.csv",
    headers: [
      "effective_start_period",
      "base_dividend_rate_percent",
      "monthly_increment_percent",
      "cap_dividend_rate_percent",
      "notes",
    ],
    toRow(item) {
      return {
        effective_start_period: item.effectiveStartPeriod,
        base_dividend_rate_percent: item.baseDividendRatePercent,
        monthly_increment_percent: item.monthlyIncrementPercent,
        cap_dividend_rate_percent: item.capDividendRatePercent,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeDividendPolicy({
        effectiveStartPeriod: row.effective_start_period || row.effectiveStartPeriod || "",
        baseDividendRatePercent:
          row.base_dividend_rate_percent || row.baseDividendRatePercent || 0,
        monthlyIncrementPercent:
          row.monthly_increment_percent || row.monthlyIncrementPercent || 0,
        capDividendRatePercent:
          row.cap_dividend_rate_percent || row.capDividendRatePercent || 0,
        notes: row.notes || "",
      });
    },
  },
  profitExpenseLine: {
    filename: "profit-expense-lines-export.csv",
    headers: [
      "period_name",
      "expense_scope",
      "category_name",
      "amount_raw",
      "notes",
    ],
    toRow(item) {
      return {
        period_name: item.periodName,
        expense_scope: item.expenseScope,
        category_name: item.categoryName,
        amount_raw: item.amountRaw,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeProfitExpenseLine({
        periodName: row.period_name || "",
        expenseScope: row.expense_scope || "",
        categoryName: row.category_name || "",
        amountRaw: row.amount_raw || "",
        notes: row.notes || "",
      });
    },
  },
  settlementStatement: {
    filename: "settlement-statements-export.csv",
    headers: [
      "period_name",
      "period_start",
      "period_end",
      "teacher_name",
      "revenue_total_raw",
      "base_salary_amount",
      "social_insurance_amount",
      "housing_fund_amount",
      "teaching_commission_amount",
      "makeup_commission_amount",
      "qa_commission_amount",
      "subsidy_amount",
      "balance_amount_raw",
      "gross_amount",
      "adjustment_amount",
      "final_amount",
      "status",
      "notes",
    ],
    toRow(item) {
      return {
        period_name: item.periodName,
        period_start: item.periodStart,
        period_end: item.periodEnd,
        teacher_name: item.teacherName,
        revenue_total_raw: item.revenueTotalRaw,
        base_salary_amount: item.baseSalaryAmount,
        social_insurance_amount: item.socialInsuranceAmount,
        housing_fund_amount: item.housingFundAmount,
        teaching_commission_amount: item.teachingCommissionAmount,
        makeup_commission_amount: item.makeupCommissionAmount,
        qa_commission_amount: item.qaCommissionAmount,
        subsidy_amount: item.subsidyAmount,
        balance_amount_raw: item.balanceAmountRaw,
        gross_amount: item.grossAmount,
        adjustment_amount: item.adjustmentAmount,
        final_amount: item.finalAmount,
        status: item.status,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeSettlementStatement({
        periodName: row.period_name || "",
        periodStart: row.period_start || "",
        periodEnd: row.period_end || "",
        teacherName: row.teacher_name || "",
        revenueTotalRaw: row.revenue_total_raw || "",
        baseSalaryAmount: row.base_salary_amount || "",
        socialInsuranceAmount: row.social_insurance_amount || "",
        housingFundAmount: row.housing_fund_amount || "",
        teachingCommissionAmount: row.teaching_commission_amount || "",
        makeupCommissionAmount: row.makeup_commission_amount || "",
        qaCommissionAmount: row.qa_commission_amount || "",
        subsidyAmount: row.subsidy_amount || "",
        balanceAmountRaw: row.balance_amount_raw || "",
        grossAmount: row.gross_amount || "",
        adjustmentAmount: row.adjustment_amount || "",
        finalAmount: row.final_amount || "",
        status: row.status || "",
        notes: row.notes || "",
      });
    },
  },
  settlementLine: {
    filename: "settlement-lines-export.csv",
    headers: [
      "period_name",
      "teacher_name",
      "student_name",
      "fee_amount_raw",
      "commission_amount_raw",
      "lesson_occurrences_raw",
      "lesson_count",
      "commission_total_amount",
      "calc_mode",
      "student_count",
      "session_count",
      "settlement_hours",
      "base_amount",
      "adjustment_amount",
      "final_amount",
      "notes",
    ],
    toRow(item) {
      return {
        period_name: item.periodName,
        teacher_name: item.teacherName,
        student_name: item.studentName,
        fee_amount_raw: item.feeAmountRaw,
        commission_amount_raw: item.commissionAmountRaw,
        lesson_occurrences_raw: item.lessonOccurrencesRaw,
        lesson_count: item.lessonCount,
        commission_total_amount: item.commissionTotalAmount,
        calc_mode: item.calcMode,
        student_count: item.studentCount,
        session_count: item.sessionCount,
        settlement_hours: item.settlementHours,
        base_amount: item.baseAmount,
        adjustment_amount: item.adjustmentAmount,
        final_amount: item.finalAmount,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeSettlementLine({
        periodName: row.period_name || "",
        teacherName: row.teacher_name || "",
        studentName: row.student_name || "",
        feeAmountRaw: row.fee_amount_raw || "",
        commissionAmountRaw: row.commission_amount_raw || "",
        lessonOccurrencesRaw: row.lesson_occurrences_raw || "",
        lessonCount: row.lesson_count || "",
        commissionTotalAmount: row.commission_total_amount || "",
        calcMode: row.calc_mode || "",
        studentCount: row.student_count || "",
        sessionCount: row.session_count || "",
        settlementHours: row.settlement_hours || "",
        baseAmount: row.base_amount || "",
        adjustmentAmount: row.adjustment_amount || "",
        finalAmount: row.final_amount || "",
        notes: row.notes || "",
      });
    },
  },
  compensationRule: {
    filename: "teacher-compensation-rules-export.csv",
    headers: [
      "teacher_name",
      "effective_start_date",
      "effective_end_date",
      "settlement_cycle",
      "calc_mode",
      "base_amount",
      "hourly_amount",
      "per_student_amount",
      "revenue_share_ratio",
      "notes",
    ],
    toRow(item) {
      return {
        teacher_name: item.teacherName,
        effective_start_date: item.effectiveStartDate,
        effective_end_date: item.effectiveEndDate,
        settlement_cycle: item.settlementCycle,
        calc_mode: item.calcMode,
        base_amount: item.baseAmount,
        hourly_amount: item.hourlyAmount,
        per_student_amount: item.perStudentAmount,
        revenue_share_ratio: item.revenueShareRatio,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeCompensationRule({
        teacherName: row.teacher_name || "",
        effectiveStartDate: row.effective_start_date || "",
        effectiveEndDate: row.effective_end_date || "",
        settlementCycle: row.settlement_cycle || "",
        calcMode: row.calc_mode || "",
        baseAmount: row.base_amount || "",
        hourlyAmount: row.hourly_amount || "",
        perStudentAmount: row.per_student_amount || "",
        revenueShareRatio: row.revenue_share_ratio || "",
        notes: row.notes || "",
      });
    },
  },
  compensationRuleItem: {
    filename: "teacher-compensation-rule-items-export.csv",
    headers: [
      "teacher_name",
      "effective_start_date",
      "course_type",
      "session_tag",
      "grade_from",
      "grade_to",
      "calc_mode_override",
      "unit_amount",
      "ratio_override",
      "priority",
      "notes",
    ],
    toRow(item) {
      return {
        teacher_name: item.teacherName,
        effective_start_date: item.effectiveStartDate,
        course_type: item.courseType,
        session_tag: item.sessionTag,
        grade_from: item.gradeFrom,
        grade_to: item.gradeTo,
        calc_mode_override: item.calcModeOverride,
        unit_amount: item.unitAmount,
        ratio_override: item.ratioOverride,
        priority: item.priority,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeCompensationRuleItem({
        teacherName: row.teacher_name || "",
        effectiveStartDate: row.effective_start_date || "",
        courseType: row.course_type || "",
        sessionTag: row.session_tag || "",
        gradeFrom: row.grade_from || "",
        gradeTo: row.grade_to || "",
        calcModeOverride: row.calc_mode_override || "",
        unitAmount: row.unit_amount || "",
        ratioOverride: row.ratio_override || "",
        priority: row.priority || "",
        notes: row.notes || "",
      });
    },
  },
  nonBillableSlot: {
    filename: "non-billable-slots-export.csv",
    headers: [
      "period_name",
      "teacher_name",
      "slot_date",
      "slot_time_text",
      "reason_type",
      "notes",
    ],
    toRow(item) {
      return {
        period_name: item.periodName,
        teacher_name: item.teacherName,
        slot_date: item.slotDate,
        slot_time_text: item.slotTimeText,
        reason_type: item.reasonType,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeNonBillableSlot({
        periodName: row.period_name || "",
        teacherName: row.teacher_name || "",
        slotDate: row.slot_date || "",
        slotTimeText: row.slot_time_text || "",
        reasonType: row.reason_type || "",
        notes: row.notes || "",
      });
    },
  },
  compensationSlotSummary: {
    filename: "compensation-slot-summaries-export.csv",
    headers: [
      "period_name",
      "owner_teacher_name",
      "related_teacher_name",
      "metric_type",
      "row_label",
      "row_kind",
      "quantity_raw",
      "quantity_value",
      "notes",
    ],
    toRow(item) {
      return {
        period_name: item.periodName,
        owner_teacher_name: item.ownerTeacherName,
        related_teacher_name: item.relatedTeacherName,
        metric_type: item.metricType,
        row_label: item.rowLabel,
        row_kind: item.rowKind,
        quantity_raw: item.quantityRaw,
        quantity_value: item.quantityValue,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeCompensationSlotSummary({
        periodName: row.period_name || "",
        ownerTeacherName: row.owner_teacher_name || "",
        relatedTeacherName: row.related_teacher_name || "",
        metricType: row.metric_type || "",
        rowLabel: row.row_label || "",
        rowKind: row.row_kind || "",
        quantityRaw: row.quantity_raw || "",
        quantityValue: row.quantity_value || "",
        notes: row.notes || "",
      });
    },
  },
  settlementReviewResolution: {
    filename: "settlement-review-resolutions-export.csv",
    headers: [
      "period_name",
      "teacher_name",
      "review_scope",
      "priority",
      "bridge_review_flags",
      "bridge_info_flags",
      "reconciliation_review_flags",
      "recommended_action",
      "resolution_status",
      "resolution_type",
      "owner_name",
      "decision_summary",
      "follow_up_action",
      "resolved_by_name",
      "resolved_at",
      "notes",
    ],
    toRow(item) {
      return {
        period_name: item.periodName,
        teacher_name: item.teacherName,
        review_scope: item.reviewScope,
        priority: item.priority,
        bridge_review_flags: item.bridgeReviewFlags,
        bridge_info_flags: item.bridgeInfoFlags,
        reconciliation_review_flags: item.reconciliationReviewFlags,
        recommended_action: item.recommendedAction,
        resolution_status: item.resolutionStatus,
        resolution_type: item.resolutionType,
        owner_name: item.ownerName,
        decision_summary: item.decisionSummary,
        follow_up_action: item.followUpAction,
        resolved_by_name: item.resolvedByName,
        resolved_at: item.resolvedAt,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeSettlementReviewResolution({
        periodName: row.period_name || "",
        teacherName: row.teacher_name || "",
        reviewScope: row.review_scope || "",
        priority: row.priority || "",
        bridgeReviewFlags: row.bridge_review_flags || "",
        bridgeInfoFlags: row.bridge_info_flags || "",
        reconciliationReviewFlags: row.reconciliation_review_flags || "",
        recommendedAction: row.recommended_action || "",
        resolutionStatus: row.resolution_status || "",
        resolutionType: row.resolution_type || "",
        ownerName: row.owner_name || "",
        decisionSummary: row.decision_summary || "",
        followUpAction: row.follow_up_action || "",
        resolvedByName: row.resolved_by_name || "",
        resolvedAt: row.resolved_at || "",
        notes: row.notes || "",
      });
    },
  },
  teacherRuleBackfillRow: {
    filename: "teacher-rule-backfill-template-export.csv",
    headers: [
      "target_period_name",
      "teacher_name",
      "confirm_status",
      "suggestion_confidence",
      "source_period_name",
      "source_rule_display",
      "source_effective_start_date",
      "source_effective_end_date",
      "effective_start_date",
      "effective_end_date",
      "settlement_cycle",
      "calc_mode",
      "base_amount",
      "hourly_amount",
      "per_student_amount",
      "revenue_share_ratio",
      "source_rule_notes",
      "suggestion_note",
      "recommended_action",
      "notes",
    ],
    toRow(item) {
      return {
        target_period_name: item.target_period_name,
        teacher_name: item.teacher_name,
        confirm_status: item.confirm_status,
        suggestion_confidence: item.suggestion_confidence,
        source_period_name: item.source_period_name,
        source_rule_display: item.source_rule_display,
        source_effective_start_date: item.source_effective_start_date,
        source_effective_end_date: item.source_effective_end_date,
        effective_start_date: item.effective_start_date,
        effective_end_date: item.effective_end_date,
        settlement_cycle: item.settlement_cycle,
        calc_mode: item.calc_mode,
        base_amount: item.base_amount,
        hourly_amount: item.hourly_amount,
        per_student_amount: item.per_student_amount,
        revenue_share_ratio: item.revenue_share_ratio,
        source_rule_notes: item.source_rule_notes,
        suggestion_note: item.suggestion_note,
        recommended_action: item.recommended_action,
        notes: item.notes,
      };
    },
    fromRow(row) {
      return normalizeTeacherRuleBackfillRow(row);
    },
  },
};

const IMPORT_READY_FILE_MAP = {
  "teachers-template.csv": "teacher",
  "demands-template.csv": "demand",
  "summer-class-revenue-template.csv": "summerClassRevenueRow",
  "profit-statements-template.csv": "financialPeriod",
  "dividend-policy-template.csv": "dividendPolicy",
  "profit-expense-lines-template.csv": "profitExpenseLine",
  "settlement-statements-template.csv": "settlementStatement",
  "settlement-lines-template.csv": "settlementLine",
  "teacher-compensation-rules-template.csv": "compensationRule",
  "teacher-compensation-rule-items-template.csv": "compensationRuleItem",
  "non-billable-slots-template.csv": "nonBillableSlot",
  "compensation-slot-summaries-template.csv": "compensationSlotSummary",
  "settlement-review-resolutions-template.csv": "settlementReviewResolution",
  "teacher-rule-backfill-template.csv": "teacherRuleBackfillRow",
};

function createEmptyBridgeReport() {
  return {
    status: "",
    preview_dir: "",
    input_dir: "",
    period_reports: [],
  };
}

function createEmptyReconciliationReport() {
  return {
    status: "",
    profit_reconciliation: {
      status: "",
      periods: [],
    },
    settlement_reconciliation: {
      status: "",
      period_summaries: [],
      statement_reports: [],
      mismatches: [],
      summary_only_slot_boards: [],
    },
  };
}

function createEmptyReviewQueueReport() {
  return {
    status: "",
    period_summaries: [],
    review_queue: [],
  };
}

function createEmptySettlementReviewFollowupReport() {
  return {
    status: "",
    summary: {
      pending_item_count: 0,
      detail_row_count: 0,
      followup_type_counts: [],
    },
    followups: [],
    detail_rows: [],
  };
}

function createEmptyCompensationImportReadinessReport() {
  return {
    status: "",
    summary: {
      source_workbook_count: 0,
      compensation_workbook_count: 0,
      compensation_period_count: 0,
      compensation_period_names: [],
      teacher_period_count: 0,
      missing_statement_teacher_period_count: 0,
      summary_only_teacher_period_count: 0,
      needs_rule_inference_teacher_period_count: 0,
      schedule_blocked_teacher_period_count: 0,
      ready_for_rule_migration_teacher_period_count: 0,
      high_priority_teacher_period_count: 0,
    },
    source_inventory: {
      source_dir: "",
      workbooks: [],
      category_counts: {},
      compensation_periods: [],
      expected_core_files: [],
    },
    period_rows: [],
    teacher_period_rows: [],
    focus_items: [],
  };
}

function createEmptySettlementImportExecutionReport() {
  return {
    status: "",
    summary: {
      period_count: 0,
      teacher_period_count: 0,
      executable_candidate_teacher_period_count: 0,
      ready_now_teacher_period_count: 0,
      ready_after_bulk_teacher_period_count: 0,
      ready_after_manual_batches_teacher_period_count: 0,
      manual_review_after_bulk_teacher_period_count: 0,
      row_by_row_teacher_period_count: 0,
      blocked_missing_statement_teacher_period_count: 0,
      blocked_rule_backfill_teacher_period_count: 0,
      hold_summary_board_teacher_period_count: 0,
      hold_archive_teacher_period_count: 0,
      blocked_other_teacher_period_count: 0,
      total_schedule_unresolved_row_count: 0,
      total_batch_gain_row_count: 0,
      total_manual_batch_gain_row_count: 0,
      profit_period_count: 0,
      profit_ready_current_safe_period_count: 0,
      profit_ready_after_bulk_period_count: 0,
      profit_ready_after_manual_batches_period_count: 0,
      profit_blocked_period_count: 0,
    },
    period_rows: [],
    teacher_wave_rows: [],
    focus_rows: [],
    notes: [],
  };
}

function createEmptySettlementImportWavePackageReport() {
  return {
    status: "",
    summary: {
      package_count: 0,
      current_safe_teacher_period_count: 0,
      after_bulk_teacher_period_count: 0,
      after_manual_batches_teacher_period_count: 0,
      max_profit_ready_period_count: 0,
      profit_period_count: 0,
      profit_ready_current_safe_period_count: 0,
      profit_ready_after_bulk_period_count: 0,
      profit_ready_after_manual_batches_period_count: 0,
      profit_blocked_period_count: 0,
      deferred_teacher_period_count: 0,
      deferred_execution_wave_counts: {},
      source_teacher_period_count: 0,
    },
    packages: [],
    profit_period_rows: [],
    deferred_rows: [],
    notes: [],
  };
}

function createEmptySettlementImportDeferredActionReport() {
  return {
    status: "",
    summary: {
      package_count: 0,
      execution_wave_counts: {},
      validation_status_counts: {},
      validation_issue_teacher_period_count: 0,
      total_bulk_candidate_row_count: 0,
      total_manual_classname_batch_group_count: 0,
      total_manual_classname_batch_row_count: 0,
      total_manual_classroom_batch_group_count: 0,
      total_manual_classroom_batch_row_count: 0,
      total_manual_combined_batch_group_count: 0,
      total_manual_combined_batch_row_count: 0,
      total_residual_row_count: 0,
    },
    packages: [],
  };
}

function createEmptySettlementOpsActionReport() {
  return {
    status: "",
    summary: {
      period_count: 0,
      teacher_period_count: 0,
      actionable_teacher_period_count: 0,
      ready_now_teacher_period_count: 0,
      ready_after_bulk_teacher_period_count: 0,
      missing_statement_teacher_period_count: 0,
      summary_board_teacher_period_count: 0,
      historical_archive_teacher_period_count: 0,
      schedule_bulk_first_teacher_period_count: 0,
      schedule_manual_batch_teacher_period_count: 0,
      schedule_row_by_row_teacher_period_count: 0,
      total_schedule_unresolved_row_count: 0,
      total_batch_gain_row_count: 0,
      profit_period_count: 0,
      profit_ready_current_safe_period_count: 0,
      profit_ready_after_bulk_period_count: 0,
      profit_ready_after_manual_batches_period_count: 0,
      profit_blocked_period_count: 0,
    },
    period_rows: [],
    teacher_action_rows: [],
    focus_rows: [],
    notes: [],
  };
}

function createEmptyTeacherSettlementProfileReport() {
  return {
    status: "",
    period_summaries: [],
    teacher_profiles: [],
  };
}

function createEmptyTeacherCompensationPolicyReport() {
  return {
    status: "",
    summary: {
      status: "",
      reference_period: "",
      horizon_months: 0,
      teacher_count: 0,
      active_teacher_count: 0,
      inactive_teacher_count: 0,
      period_row_count: 0,
      current_rule_covered_active_teacher_count: 0,
      current_rule_missing_active_teacher_count: 0,
      future_default_pending_teacher_count: 0,
      future_default_pending_teacher_names: [],
      future_confirmed_teacher_count: 0,
      future_confirmed_teacher_names: [],
      overlap_issue_teacher_count: 0,
      overlap_issue_teacher_names: [],
      future_gap_teacher_count: 0,
      future_gap_teacher_names: [],
      duplicate_override_scope_teacher_count: 0,
      duplicate_override_scope_teacher_names: [],
      duplicate_override_scope_group_count: 0,
      rule_item_override_teacher_count: 0,
    },
    teacher_rows: [],
    period_rows: [],
    duplicate_override_scope_rows: [],
    overlap_issue_rows: [],
  };
}

function createEmptyTeacherRuleItemResolutionTemplate() {
  return {
    status: "",
    summary: {
      row_count: 0,
      confirm_status_counts: {},
    },
    rows: [],
  };
}

function createEmptyTeacherRuleBackfillTemplate() {
  return {
    status: "",
    summary: {
      row_count: 0,
      period_counts: {},
      confidence_counts: {},
    },
    rows: [],
  };
}

function createEmptyScheduleInputProfileReport() {
  return {
    status: "",
    summary: {
      course_enrollment_count: 0,
      schedule_request_count: 0,
      student_transfer_count: 0,
      calendar_cell_count: 0,
      teaching_plan_row_count: 0,
      summer_group_row_count: 0,
      calendar_teacher_count: 0,
      calendar_distinct_course_date_count: 0,
      calendar_date_range_start: "",
      calendar_date_range_end: "",
    },
    request_summary: {
      request_type_counts: [],
      preferred_time_present_count: 0,
      target_teacher_present_count: 0,
      distinct_student_count: 0,
      top_target_teachers: [],
      top_subject_scopes: [],
    },
    calendar_summary: {
      teacher_count: 0,
      distinct_course_date_count: 0,
      date_range_start: "",
      date_range_end: "",
      distinct_student_name_candidate_count: 0,
      course_mode_counts: [],
      session_tag_counts: [],
      room_hint_counts: [],
      time_range_counts: [],
      weekday_counts: [],
      month_sheet_counts: [],
    },
    enrollment_summary: {
      teacher_counts: [],
      subject_counts: [],
      grade_counts: [],
      status_counts: [],
      distinct_student_count: 0,
      group_peer_name_count: 0,
    },
    transfer_summary: {
      subject_counts: [],
      status_counts: [],
      target_class_group_counts: [],
      top_reasons: [],
    },
    teaching_plan_summary: {
      teacher_counts: [],
      sheet_counts: [],
      top_titles: [],
    },
    summer_group_summary: {
      sheet_counts: [],
      distinct_student_count: 0,
      row_size_counts: [],
    },
    teacher_profiles: [],
  };
}

function createEmptyScheduleDraftImportReport() {
  return {
    status: "",
    summary: {
      student_row_count: 0,
      class_group_row_count: 0,
      demand_row_count: 0,
      teacher_schedule_row_count: 0,
      regular_class_group_count: 0,
      summer_class_group_count: 0,
      legacy_class_group_count: 0,
      request_demand_count: 0,
      calendar_schedule_row_count: 0,
      summer_schedule_row_count: 0,
      synthetic_schedule_class_name_count: 0,
      schedule_missing_classroom_count: 0,
      multi_class_student_count: 0,
      unresolved_teacher_alias_count: 0,
      inactive_teacher_reference_count: 0,
      demand_estimated_revenue_filled_count: 0,
      demand_estimated_revenue_blank_count: 0,
    },
    unresolved_teacher_aliases: [],
    outputs: {},
  };
}

function createEmptyScheduleDraftReviewReport() {
  return {
    status: "",
    summary: {
      row_count: 0,
      unresolved_row_count: 0,
      draft_class_name_count: 0,
      missing_classroom_count: 0,
      both_issue_count: 0,
      suggested_class_name_count: 0,
      suggested_classroom_count: 0,
      teacher_counts: [],
      issue_type_counts: [],
    },
    review_rows: [],
  };
}

function createEmptyScheduleDraftReviewBulkCandidatesReport() {
  return {
    status: "",
    summary: {
      row_count: 0,
      action_counts: [],
      teacher_counts: [],
      confirm_status_counts: [],
    },
    candidate_rows: [],
  };
}

function createEmptyScheduleDraftReviewBulkApplyReport() {
  return {
    status: "",
    summary: {
      candidate_row_count: 0,
      existing_resolution_row_count: 0,
      applied_count: 0,
      skipped_count: 0,
      ignored_count: 0,
      merged_resolution_row_count: 0,
      confirmed_statuses: [],
    },
    applied_rows: [],
    skipped_rows: [],
    ignored_rows: [],
  };
}

function createEmptyScheduleDraftManualReviewReport() {
  return {
    status: "",
    summary: {
      total_rows: 0,
      teacher_period_count: 0,
      teacher_count: 0,
      period_count: 0,
      draft_class_name_count: 0,
      missing_classroom_count: 0,
      both_issue_count: 0,
      with_suggested_class_name_count: 0,
      with_suggested_classroom_count: 0,
      excluded_bulk_candidate_count: 0,
      scope: "",
    },
    period_summaries: [],
    teacher_period_rows: [],
    manual_review_rows: [],
  };
}

function createEmptyScheduleDraftManualClassnameBatchCandidatesReport() {
  return {
    status: "",
    summary: {
      group_count: 0,
      covered_row_count: 0,
      teacher_period_count: 0,
      teacher_count: 0,
      period_count: 0,
      min_group_size: 0,
      confirmed_group_count: 0,
      exact_evidence_group_count: 0,
      exact_evidence_row_count: 0,
      related_sample_group_count: 0,
      related_sample_row_count: 0,
      alias_rule_only_group_count: 0,
      alias_rule_only_row_count: 0,
      low_confidence_group_count: 0,
      low_confidence_row_count: 0,
      confidence_counts: [],
      recommendation_basis_counts: [],
    },
    batch_rows: [],
  };
}

function createEmptyScheduleDraftManualClassnameBatchApplyReport() {
  return {
    status: "",
    summary: {
      applied_batch_count: 0,
      applied_row_count: 0,
      skipped_batch_count: 0,
      skipped_row_count: 0,
      ignored_batch_count: 0,
      confirmed_statuses: [],
    },
    applied_batches: [],
    applied_rows: [],
    skipped_batches: [],
    skipped_rows: [],
    ignored_batches: [],
  };
}

function createEmptyScheduleDraftManualClassroomBatchCandidatesReport() {
  return {
    status: "",
    summary: {
      group_count: 0,
      covered_row_count: 0,
      teacher_period_count: 0,
      teacher_count: 0,
      period_count: 0,
      min_group_size: 0,
      confirmed_group_count: 0,
    },
    batch_rows: [],
  };
}

function createEmptyScheduleDraftManualClassroomBatchApplyReport() {
  return {
    status: "",
    summary: {
      applied_batch_count: 0,
      applied_row_count: 0,
      skipped_batch_count: 0,
      skipped_row_count: 0,
      ignored_batch_count: 0,
      confirmed_statuses: [],
    },
    applied_batches: [],
    applied_rows: [],
    skipped_batches: [],
    skipped_rows: [],
    ignored_batches: [],
  };
}

function createEmptyScheduleDraftManualCombinedBatchCandidatesReport() {
  return {
    status: "",
    summary: {
      group_count: 0,
      covered_row_count: 0,
      teacher_period_count: 0,
      teacher_count: 0,
      period_count: 0,
      confirmed_group_count: 0,
      singleton_group_count: 0,
    },
    batch_rows: [],
  };
}

function createEmptyScheduleDraftManualCombinedBatchApplyReport() {
  return {
    status: "",
    summary: {
      applied_batch_count: 0,
      applied_row_count: 0,
      skipped_batch_count: 0,
      skipped_row_count: 0,
      ignored_batch_count: 0,
      confirmed_statuses: [],
    },
    applied_batches: [],
    applied_rows: [],
    skipped_batches: [],
    skipped_rows: [],
    ignored_batches: [],
  };
}

function createEmptyScheduleDraftManualResidualReport() {
  return {
    status: "",
    summary: {
      row_count: 0,
      teacher_period_count: 0,
      issue_counts: [],
      category_counts: [],
    },
    teacher_period_rows: [],
    residual_rows: [],
  };
}

function createEmptyOpsOpenItemsReport() {
  return {
    status: "",
    summary: {
      attention_item_count: 0,
      summer_pending_group_count: 0,
      schedule_residual_row_count: 0,
      schedule_residual_teacher_period_count: 0,
      missing_statement_teacher_period_count: 0,
      summary_only_teacher_period_count: 0,
      future_policy_pending_teacher_count: 0,
      policy_blocking_teacher_count: 0,
    },
    category_rows: [],
    summer_pending_rows: [],
    schedule_residual_teacher_period_rows: [],
    schedule_residual_rows: [],
    compensation_missing_statement_rows: [],
    compensation_summary_only_rows: [],
    future_policy_pending_rows: [],
    policy_blocking_rows: [],
    notes: [],
  };
}

function createEmptyOpsChatAnswerSheet() {
  return {
    status: "",
    summary: {
      total_question_count: 0,
      summer_pending_group_count: 0,
      spring_class_question_count: 0,
      spring_room_question_count: 0,
    },
    notes: [],
    reply_template_text: "",
    summer_rows: [],
    spring_class_rows: [],
    spring_room_rows: [],
  };
}

function createEmptyOpsChatAnswerApplyReport() {
  return {
    status: "",
    summary: {
      answers_file_exists: 0,
      parsed_entry_count: 0,
      applied_count: 0,
      unknown_key_count: 0,
      skipped_count: 0,
    },
    notes: [],
    parse_report: {
      parsed_entry_count: 0,
      duplicate_entries: [],
      ignored_lines: [],
    },
    sections: {
      summer: {},
      spring_class: {},
      spring_room: {},
    },
  };
}

function createEmptyProfitSettlementDividendReport() {
  return {
    status: "",
    summary: {
      period_count: 0,
      latest_period: "",
      teacher_row_count: 0,
      periods_with_profit_statement_count: 0,
      total_teacher_revenue_amount: "",
      total_settlement_component_amount: "",
      total_net_profit_amount: "",
      total_dividend_pool_amount: "",
      total_retained_profit_amount: "",
    },
    period_rows: [],
    teacher_rows: [],
    latest_period_top_teachers: [],
    notes: [],
  };
}

function createEmptySummerBigClassRoomOccupancyReport() {
  return {
    status: "",
    summary: {
      session_count: 0,
      occupancy_row_count: 0,
      resolved_row_count: 0,
      unresolved_row_count: 0,
      manual_resolution_group_count: 0,
      manual_resolution_confirmed_group_count: 0,
      manual_resolution_pending_group_count: 0,
      date_correction_applied_count: 0,
      room_counts: [],
    },
    occupancy_rows: [],
    unresolved_rows: [],
    manual_resolution_rows: [],
  };
}

function createEmptySummerScheduleSettlementReport() {
  return {
    status: "",
    summary: {
      teacher_count: 0,
      class_count: 0,
      teacher_schedule_row_count: 0,
      class_session_count: 0,
      excluded_teacher_count: 0,
      excluded_class_count: 0,
      excluded_session_count: 0,
      missing_rule_teacher_count: 0,
      missing_revenue_class_count: 0,
      teachers_over_daily_cap_count: 0,
      teachers_under_daily_target_count: 0,
      teacher_missing_to_target_slot_total: 0,
      teachers_with_evening_violation_count: 0,
      classes_below_target_count: 0,
      filled_revenue_class_count: 0,
      projected_amount_total: "",
      estimated_revenue_total: "",
      suggested_projected_amount_total: "",
      suggested_estimated_revenue_total: "",
      mixed_projected_amount_total: "",
      class_estimated_revenue_total: "",
      class_suggested_estimated_revenue_total: "",
      class_mixed_estimated_revenue_total: "",
      class_gross_margin_total: "",
      class_mixed_gross_margin_total: "",
      actual_projection_supported_class_count: 0,
      mixed_projection_supported_class_count: 0,
      suggested_revenue_coverage_class_count: 0,
      revenue_template_row_count: 0,
    },
    teacher_rows: [],
    class_rows: [],
    notes: [],
  };
}

function createSummerClassRevenueRowsFromReport(report) {
  const rows = Array.isArray(report?.class_rows) ? report.class_rows : [];
  return rows.map((row) =>
    normalizeSummerClassRevenueRow({
      className: row.class_name || row.className || "",
      subject: row.subject || "",
      grade: row.grade || "",
      courseType: row.course_type || row.courseType || "",
      plannedSize: row.planned_size || row.plannedSize || "",
      currentSize: row.current_size || row.currentSize || "",
      teacherNamesText: row.teacher_names_text || row.teacherNamesText || "",
      teachingSessionCount:
        row.teaching_session_count || row.teachingSessionCount || "",
      targetTeachingSessionCount:
        row.target_teaching_session_count || row.targetTeachingSessionCount || "",
      estimatedSessionRevenue:
        row.estimated_session_revenue || row.estimatedSessionRevenue || "",
      estimatedRevenueSource:
        row.estimated_revenue_source || row.estimatedRevenueSource || "",
      suggestedUnitFee: row.suggested_unit_fee || row.suggestedUnitFee || "",
      suggestedSessionRevenue:
        row.suggested_session_revenue || row.suggestedSessionRevenue || "",
      suggestedRevenueSource:
        row.suggested_revenue_source || row.suggestedRevenueSource || "",
      suggestionSampleCount:
        row.suggestion_sample_count || row.suggestionSampleCount || "",
      resolutionStatus: row.resolution_status || row.resolutionStatus || "",
      notes: Array.isArray(row.notes) ? row.notes.join(" / ") : row.notes || "",
    })
  );
}

const DEFAULT_STATE = {
  teachers: [
    createTeacher("李舒老师", "math", 1, 3, false, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("潘老师", "math", 4, 4, false, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("吴老师", "math", 4, 4, false, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("何老师", "math", 5, 5, false, false, false, 6, 36, "", "6_on_1_off", "", true),
    createTeacher("赵老师", "math", 6, 6, true, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("叶老师", "math", 7, 7, true, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("吴建勇老师", "math", 7, 7, false, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("郑老师", "math", 8, 8, true, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("曹老师", "math", 8, 8, false, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("刘老师", "math", 9, 9, true, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("朱老师", "science", 1, 9, false, false, false, 6, 36, "", "6_on_1_off", "", false),
    createTeacher("程老师", "math", 1, 9, false, true, true, 6, 36, "", "3_on_1_off", "三楼5号教室", true),
  ],
  rooms: [
    createRoom("一楼1号教室", "1F", 5, "small_class", true, 45, "固定班偏好教室"),
    createRoom("一楼2号教室", "1F", 12, "medium_class", false, 55, ""),
    createRoom("一楼3号教室", "1F", 9, "small_class", true, 50, "固定班偏好教室"),
    createRoom("二楼1号教室", "2F", 1, "one_to_one", false, 30, "一对一教室"),
    createRoom("二楼2号教室", "2F", 1, "one_to_one", false, 30, "一对一教室"),
    createRoom("二楼3号教室", "2F", 1, "one_to_one", false, 30, "一对一教室"),
    createRoom("二楼4号教室", "2F", 1, "one_to_one", false, 30, "一对一教室"),
    createRoom("三楼1(A)号教室", "3F", 20, "medium_class", false, 65, ""),
    createRoom("三楼1(B)号教室", "3F", 20, "medium_class", false, 65, ""),
    createRoom("三楼2号教室", "3F", 20, "medium_class", false, 65, ""),
    createRoom("三楼3号教室", "3F", 20, "medium_class", false, 65, ""),
    createRoom("三楼4号教室", "3F", 40, "large_class", false, 90, "暑假高峰优先大教室；少量科学大班课"),
    createRoom("三楼5号教室", "3F", 60, "large_class", true, 100, "程老师固定教室；空闲时允许共享排课"),
    createRoom("三楼6号教室", "3F", 35, "large_class", false, 85, "暑假高峰优先大教室；少量科学大班课"),
  ],
  demands: [
    createDemand("六年级数学暑假班A", "math", 6, 12, "medium_class", 2, 1800, "evening", "", "", "planned"),
    createDemand("初二数学暑假班A", "math", 8, 18, "medium_class", 2, 2700, "evening", "", "", "recruiting"),
    createDemand("四年级数学暑假班A", "math", 4, 8, "small_class", 2, 1200, "evening", "", "", "planned"),
    createDemand("初一数学暑假班A", "math", 7, 16, "medium_class", 2, 2400, "weekend", "", "", "recruiting"),
    createDemand("科学实验暑假班A", "science", 6, 26, "large_class", 1, 3900, "flexible", "朱老师", "", "recruiting"),
  ],
  financialPeriods: [
    createFinancialPeriod("2026-04", 74616.15, 18435.55, 14936.531, 59679.619),
    createFinancialPeriod("2026-05", 93651.04, 62884.11, 23917.108, 69733.932),
  ],
  dividendPolicies: [
    normalizeDividendPolicy({
      effectiveStartPeriod: "2026-05",
      baseDividendRatePercent: 15.5,
      monthlyIncrementPercent: 0.5,
      capDividendRatePercent: 30,
      notes: "Current monthly dividend rule",
    }),
  ],
  profitExpenseLines: [],
  settlementStatements: [],
  settlementLines: [],
  compensationRules: [],
  compensationRuleItems: [],
  nonBillableSlots: [],
  compensationSlotSummaries: [],
  settlementReviewResolutions: [],
  scheduleSettlementBridge: createEmptyBridgeReport(),
  importReconciliation: createEmptyReconciliationReport(),
  settlementReviewQueue: createEmptyReviewQueueReport(),
  settlementReviewFollowupReport: createEmptySettlementReviewFollowupReport(),
  compensationImportReadinessReport: createEmptyCompensationImportReadinessReport(),
  settlementImportWavePackageReport: createEmptySettlementImportWavePackageReport(),
  settlementImportDeferredActionReport:
    createEmptySettlementImportDeferredActionReport(),
  settlementImportExecutionReport: createEmptySettlementImportExecutionReport(),
  settlementOpsActionReport: createEmptySettlementOpsActionReport(),
  profitSettlementDividendReport: createEmptyProfitSettlementDividendReport(),
  summerBigClassRoomOccupancyReport: createEmptySummerBigClassRoomOccupancyReport(),
  summerScheduleSettlementReport: createEmptySummerScheduleSettlementReport(),
  summerClassRevenueRows: [],
  scheduleInputProfileReport: createEmptyScheduleInputProfileReport(),
  scheduleDraftImportReport: createEmptyScheduleDraftImportReport(),
  scheduleDraftReviewReport: createEmptyScheduleDraftReviewReport(),
  scheduleDraftReviewBulkCandidatesReport:
    createEmptyScheduleDraftReviewBulkCandidatesReport(),
  scheduleDraftReviewBulkApplyReport: createEmptyScheduleDraftReviewBulkApplyReport(),
  scheduleDraftManualReviewReport: createEmptyScheduleDraftManualReviewReport(),
  scheduleDraftManualClassnameBatchCandidatesReport:
    createEmptyScheduleDraftManualClassnameBatchCandidatesReport(),
  scheduleDraftManualClassnameBatchApplyReport:
    createEmptyScheduleDraftManualClassnameBatchApplyReport(),
  scheduleDraftManualClassroomBatchCandidatesReport:
    createEmptyScheduleDraftManualClassroomBatchCandidatesReport(),
  scheduleDraftManualClassroomBatchApplyReport:
    createEmptyScheduleDraftManualClassroomBatchApplyReport(),
  scheduleDraftManualCombinedBatchCandidatesReport:
    createEmptyScheduleDraftManualCombinedBatchCandidatesReport(),
  scheduleDraftManualCombinedBatchApplyReport:
    createEmptyScheduleDraftManualCombinedBatchApplyReport(),
  scheduleDraftManualResidualReport: createEmptyScheduleDraftManualResidualReport(),
  opsOpenItemsReport: createEmptyOpsOpenItemsReport(),
  opsChatAnswerSheet: createEmptyOpsChatAnswerSheet(),
  opsChatAnswerApplyReport: createEmptyOpsChatAnswerApplyReport(),
  teacherSettlementProfileReport: createEmptyTeacherSettlementProfileReport(),
  teacherCompensationPolicyReport: createEmptyTeacherCompensationPolicyReport(),
  teacherRuleItemResolutionTemplate: createEmptyTeacherRuleItemResolutionTemplate(),
  teacherRuleBackfillTemplate: createEmptyTeacherRuleBackfillTemplate(),
};

const HISTORICAL_SETTLEMENT_STATEMENTS = [
  { periodName: "2026-04", teacherName: "刘老师", revenueTotalRaw: "22290", baseSalaryAmount: "4000", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "7328", makeupCommissionAmount: "", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "10962", mainRatio: "0.3180", freeSlotCount: 12 },
  { periodName: "2026-04", teacherName: "叶老师", revenueTotalRaw: "28370", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "", teachingCommissionAmount: "5674", makeupCommissionAmount: "", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "17330.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-04", teacherName: "赵老师", revenueTotalRaw: "26780", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "", teachingCommissionAmount: "5460", makeupCommissionAmount: "", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "15954.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-04", teacherName: "万老师", revenueTotalRaw: "21150", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "", teachingCommissionAmount: "4230", makeupCommissionAmount: "40", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "11514.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-04", teacherName: "朱老师", revenueTotalRaw: "17930", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "", teachingCommissionAmount: "3570", makeupCommissionAmount: "300", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "8694.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-04", teacherName: "郑老师", revenueTotalRaw: "21720", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "", teachingCommissionAmount: "4464", makeupCommissionAmount: "220", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "11670.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-04", teacherName: "李舒老师", revenueTotalRaw: "7980", baseSalaryAmount: "", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "1596", makeupCommissionAmount: "", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "6384", mainRatio: "0.2000", freeSlotCount: 36 },
  { periodName: "2026-04", teacherName: "何老师", revenueTotalRaw: "4480", baseSalaryAmount: "2100", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "896", makeupCommissionAmount: "480", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "1004", mainRatio: "0.2000", freeSlotCount: 36 },
  { periodName: "2026-04", teacherName: "曹老师", revenueTotalRaw: "", baseSalaryAmount: "800", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "", makeupCommissionAmount: "180", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "-980", mainRatio: "", freeSlotCount: 0 },
  { periodName: "2026-04", teacherName: "潘老师", revenueTotalRaw: "", baseSalaryAmount: "900", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "", makeupCommissionAmount: "200", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "-1100", mainRatio: "", freeSlotCount: 0 },
  { periodName: "2026-04", teacherName: "周老师", revenueTotalRaw: "", baseSalaryAmount: "5000", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "1820", makeupCommissionAmount: "", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "-6820", mainRatio: "", freeSlotCount: 7 },
  { periodName: "2026-05", teacherName: "刘老师", revenueTotalRaw: "24720", baseSalaryAmount: "4000", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "8107", makeupCommissionAmount: "675", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "11938", mainRatio: "0.3180", freeSlotCount: 12 },
  { periodName: "2026-05", teacherName: "叶老师", revenueTotalRaw: "30580", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "133", teachingCommissionAmount: "6845.6", makeupCommissionAmount: "600", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "17636.23", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-05", teacherName: "赵老师", revenueTotalRaw: "24300", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "133", teachingCommissionAmount: "4860", makeupCommissionAmount: "240", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "13701.83", mainRatio: "0.2000", freeSlotCount: 9 },
  { periodName: "2026-05", teacherName: "万老师", revenueTotalRaw: "5360", baseSalaryAmount: "665", socialInsuranceAmount: "1365.17", housingFundAmount: "", teachingCommissionAmount: "1072", makeupCommissionAmount: "660", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "1597.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-05", teacherName: "朱老师", revenueTotalRaw: "20750", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "133", teachingCommissionAmount: "4150", makeupCommissionAmount: "660", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "10441.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-05", teacherName: "郑老师", revenueTotalRaw: "26660", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "133", teachingCommissionAmount: "5452", makeupCommissionAmount: "240", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "15469.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-05", teacherName: "李舒老师", revenueTotalRaw: "15720", baseSalaryAmount: "4000", socialInsuranceAmount: "1365.17", housingFundAmount: "133", teachingCommissionAmount: "3144", makeupCommissionAmount: "80", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "6997.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-05", teacherName: "何老师", revenueTotalRaw: "15500", baseSalaryAmount: "3693", socialInsuranceAmount: "1365.17", housingFundAmount: "", teachingCommissionAmount: "3100", makeupCommissionAmount: "440", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "6901.83", mainRatio: "0.2000", freeSlotCount: 12 },
  { periodName: "2026-05", teacherName: "曹老师", revenueTotalRaw: "10080", baseSalaryAmount: "3264", socialInsuranceAmount: "1365.17", housingFundAmount: "", teachingCommissionAmount: "2016", makeupCommissionAmount: "1370", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "2064.83", mainRatio: "0.2000", freeSlotCount: 11 },
  { periodName: "2026-05", teacherName: "潘老师", revenueTotalRaw: "16200", baseSalaryAmount: "3297", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "3240", makeupCommissionAmount: "480", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "9183", mainRatio: "0.2000", freeSlotCount: 4 },
  { periodName: "2026-05", teacherName: "吴老师", revenueTotalRaw: "4980", baseSalaryAmount: "1600", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "996", makeupCommissionAmount: "300", qaCommissionAmount: "", subsidyAmount: "104", balanceAmountRaw: "1980", mainRatio: "", freeSlotCount: 0 },
  { periodName: "2026-05", teacherName: "吴建勇老师", revenueTotalRaw: "5880", baseSalaryAmount: "1200", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "1176", makeupCommissionAmount: "400", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "3104", mainRatio: "0.2000", freeSlotCount: 0 },
  { periodName: "2026-05", teacherName: "周老师", revenueTotalRaw: "", baseSalaryAmount: "5000", socialInsuranceAmount: "", housingFundAmount: "", teachingCommissionAmount: "2366", makeupCommissionAmount: "", qaCommissionAmount: "", subsidyAmount: "", balanceAmountRaw: "-7366", mainRatio: "", freeSlotCount: 7 },
];

const HISTORICAL_SETTLEMENT_OVERRIDES = {
  "2026-04": [
    { teacherName: "刘老师", ratioOverride: "0.3270", notes: "Inferred override from 8 historical rows at 32.7%." },
    { teacherName: "刘老师", ratioOverride: "0.3310", notes: "Inferred override from 7 historical rows at 33.1%." },
    { teacherName: "刘老师", ratioOverride: "0.3320", notes: "Inferred override from 7 historical rows at 33.2%." },
    { teacherName: "刘老师", ratioOverride: "0.3330", notes: "Inferred override from 8 historical rows at 33.3%." },
    { teacherName: "朱老师", ratioOverride: "0.1820", notes: "Inferred override from 1 historical rows at 18.2%." },
    { teacherName: "郑老师", ratioOverride: "0.5000", notes: "Inferred override from 1 historical rows at 50.0%." },
  ],
  "2026-05": [
    { teacherName: "刘老师", ratioOverride: "0.3270", notes: "Inferred override from 10 historical rows at 32.7%." },
    { teacherName: "刘老师", ratioOverride: "0.3310", notes: "Inferred override from 8 historical rows at 33.1%." },
    { teacherName: "刘老师", ratioOverride: "0.3320", notes: "Inferred override from 9 historical rows at 33.2%." },
    { teacherName: "刘老师", ratioOverride: "0.3330", notes: "Inferred override from 10 historical rows at 33.3%." },
    { teacherName: "叶老师", ratioOverride: "0.2300", notes: "Inferred override from 33 historical rows at 23.0%." },
    { teacherName: "郑老师", ratioOverride: "0.5000", notes: "Inferred override from 1 historical rows at 50.0%." },
  ],
};

let state = loadState();
let scheduleCache = null;
let uiState = loadUiState();
let localDbStatus = createEmptyLocalDbStatus();
let localDbHistoryEntries = [];
let localDbAutosaveTimer = null;
let localDbAutosaveNote = "";
let summerImportReviewItems = loadSummerImportReviewItems();

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await initializePersistence();
  regenerateSchedule();
});

function bindEvents() {
  const backendBaseUrlInput = document.getElementById("backendBaseUrlInput");
  if (backendBaseUrlInput) {
    backendBaseUrlInput.value = uiState.backendBaseUrl || "";
    backendBaseUrlInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        connectConfiguredBackend();
      }
    });
  }
  const connectBackendButton = document.getElementById("connectBackendButton");
  if (connectBackendButton) {
    connectBackendButton.addEventListener("click", connectConfiguredBackend);
  }
  const clearBackendButton = document.getElementById("clearBackendButton");
  if (clearBackendButton) {
    clearBackendButton.addEventListener("click", clearConfiguredBackend);
  }
  const refreshHistoryButton = document.getElementById("refreshDbHistoryButton");
  if (refreshHistoryButton) {
    refreshHistoryButton.addEventListener("click", () => {
      refreshLocalDatabaseHistory();
    });
  }
  const restoreHistoryButton = document.getElementById("restoreDbHistoryButton");
  if (restoreHistoryButton) {
    restoreHistoryButton.addEventListener("click", restoreSelectedHistoryVersion);
  }
  const historySelect = document.getElementById("dbHistorySelect");
  if (historySelect) {
    historySelect.addEventListener("change", (event) => {
      uiState.selectedDbHistoryId = event.target.value || "";
      persistUiState();
    });
  }
  document.getElementById("generateButton").addEventListener("click", regenerateSchedule);
  document.getElementById("resetButton").addEventListener("click", () => {
    state = clone(DEFAULT_STATE);
    persistState("已恢复寒暑假样例数据。");
    regenerateSchedule();
  });
  document.getElementById("saveButton").addEventListener("click", async () => {
    if (localDbStatus.available) {
      const result = await saveStateToLocalDatabase({
        note: "manual_save",
        source: "browser_manual",
      });
      if (!result) {
        uiState.importLog = `保存到寒暑假后台失败：${localDbStatus.lastError || "未知错误"}`;
        persistUiState();
        renderSaveStatus();
        return;
      }
      await refreshLocalDatabaseHistory({ silent: true });
      persistState("已手动保存到寒暑假后台。", { syncLocalDb: false });
      renderSaveStatus();
      return;
    }

    persistState("已手动保存当前模式。", { syncLocalDb: false });
    renderSaveStatus();
  });
  const loadDbButton = document.getElementById("loadDbButton");
  if (loadDbButton) {
    loadDbButton.addEventListener("click", loadStateFromLocalDatabase);
  }
  document.getElementById("exportSnapshotButton").addEventListener("click", exportSnapshot);
  document.getElementById("downloadTemplateButton").addEventListener("click", downloadEntityTemplate);
  document.getElementById("importCsvButton").addEventListener("click", importCsvFile);
  document.getElementById("batchImportButton").addEventListener("click", importBatchCsvFiles);
  document.getElementById("importSnapshotButton").addEventListener("click", importSnapshotFile);
  document.getElementById("importDiagnosticJsonButton").addEventListener("click", importDiagnosticJsonFiles);
  document.getElementById("exportCsvButton").addEventListener("click", exportSelectedCsv);
  document.getElementById("summerImportReviewList")?.addEventListener("change", handleSummerImportReviewChange);
  document.getElementById("summerImportReviewList")?.addEventListener("click", handleSummerImportReviewClick);
  document.getElementById("boardViewButton").addEventListener("click", () => {
    uiState.scheduleView = "board";
    persistUiState();
    renderSchedule();
  });
  document.getElementById("roomViewButton").addEventListener("click", () => {
    uiState.scheduleView = "room";
    persistUiState();
    renderSchedule();
  });
  document.getElementById("roomViewDaySelect").addEventListener("change", (event) => {
    uiState.roomViewDay = event.target.value;
    persistUiState();
    renderRoomScheduleView();
  });
  document.getElementById("financialPeriodViewSelect").addEventListener("change", (event) => {
    uiState.financialPeriodView = event.target.value;
    persistUiState();
    renderFinancialPeriods();
  });
  document.getElementById("scheduleProjectionPeriodSelect").addEventListener("change", (event) => {
    uiState.scheduleProjectionPeriod = event.target.value;
    persistUiState();
    renderMetrics();
    renderSchedule();
  });
  document
    .getElementById("scheduleReviewDeskPeriodSelect")
    .addEventListener("change", (event) => {
      uiState.scheduleReviewDeskPeriod = event.target.value;
      persistUiState();
      renderScheduleReviewDesk();
    });
  document.getElementById("settlementPeriodSelect").addEventListener("change", (event) => {
    uiState.settlementPeriod = event.target.value;
    persistUiState();
    renderSettlementCenter();
  });
  document.getElementById("settlementTeacherSelect").addEventListener("change", (event) => {
    uiState.settlementTeacher = event.target.value;
    persistUiState();
    renderSettlementCenter();
  });

  document.addEventListener("click", (event) => {
    const addEntity = event.target.getAttribute("data-add");
    if (addEntity) {
      addRow(addEntity);
      return;
    }

    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
      removeRow(removeButton.getAttribute("data-remove"), Number(removeButton.getAttribute("data-index")));
    }
  });

  document.addEventListener("input", handleFieldChange);
  document.addEventListener("change", handleFieldChange);
}

function handleFieldChange(event) {
  const entity = event.target.getAttribute("data-entity");
  if (!entity) {
    return;
  }

  const index = Number(event.target.getAttribute("data-index"));
  const field = event.target.getAttribute("data-field");
  const config = FIELD_CONFIG[entity].find((item) => item.field === field);
  if (!config) {
    return;
  }

  const collection = getCollection(entity);
  if (!collection[index]) {
    return;
  }

  collection[index][field] = parseValue(event.target.value, config.type);
  persistState();
  renderMetrics();
  if (entity === "financialPeriod") {
    renderFinancialPeriods();
    renderSettlementCenter();
  }
  if (entity === "summerClassRevenue") {
    renderSummerScheduleSettlementPrep();
  }
  renderSaveStatus();
}

function regenerateSchedule() {
  scheduleCache = generateSchedule(state);
  renderAll();
}

function renderAll() {
  renderMetrics();
  renderSaveStatus();
  renderSummerImportReviewPanel();
  renderTeachers();
  renderRooms();
  renderDemands();
  renderSchedule();
  renderScheduleReviewDesk();
  renderOpsOpenItemsPanel();
  renderSummerScheduleSettlementPrep();
  renderFinancialPeriods();
  renderSettlementCenter();
}

function renderMetrics() {
  const scheduled = scheduleCache ? scheduleCache.entries.length : 0;
  const unscheduled = scheduleCache ? scheduleCache.unscheduled.length : 0;
  const coreOneToOneFallbackCount = scheduleCache
    ? scheduleCache.coreOneToOneFallbacks.length
    : 0;
  const demandSessions = state.demands.reduce((sum, item) => sum + Number(item.weeklySessions || 0), 0);
  const lateRestricted = state.teachers.filter((teacher) => teacher.noEvening).length;
  const latestFinancial = getLatestFinancialSummary();
  const scheduleProjection = buildScheduleSettlementProjection();

  const cards = [
    ["老师人数", state.teachers.length, "暑假可排老师资源"],
    ["教室数量", state.rooms.length, "老江东校区"],
    ["待开班", state.demands.length, "7/8 月招生班可继续增删"],
    ["待排总节数", demandSessions, "按每周节数累加"],
    ["已建议节数", scheduled, "当前规则下成功排入"],
    ["未排成功", unscheduled, "继续招生后可重排"],
    [
      "核心一对一兜底",
      coreOneToOneFallbackCount,
      coreOneToOneFallbackCount
        ? "这些一对一当前找不到可承接的非核心老师"
        : "当前一对一都优先压给了非核心老师",
    ],
    ["禁排第6节老师", lateRestricted, "何老师、程老师等"],
    [
      "最近净利润",
      latestFinancial ? formatCompactCurrency(latestFinancial.netProfit) : "待录入",
      latestFinancial ? `${latestFinancial.periodName} 月口径` : "录入月份后自动生成",
    ],
    [
      "最近分红池",
      latestFinancial ? formatCompactCurrency(latestFinancial.dividendPool) : "待录入",
      latestFinancial
        ? `${latestFinancial.periodName} · ${formatPercent(latestFinancial.dividendRate)}`
        : "2026-05 起按规则递增",
    ],
  ];
  cards.push([
    "计划月份",
    scheduleProjection.summary.projectionPeriodName || "当前月",
    "默认按 2026-07 暑假第一期口径推演，可切到 2026-08",
  ]);
  cards.push([
    "结算已接规则",
    scheduleProjection.summary.teacherCount
      ? `${scheduleProjection.summary.coveredTeacherCount}/${scheduleProjection.summary.teacherCount}`
      : "待排课",
    scheduleProjection.summary.teacherCount
      ? `${scheduleProjection.summary.projectionPeriodName} 口径 · ${scheduleProjection.summary.projectableTeacherCount} 人可直接投影`
      : "生成排课建议后显示",
  ]);
  cards.push([
    "预计周结算",
    scheduleProjection.summary.projectedAmountTotal
      ? formatCompactCurrency(scheduleProjection.summary.projectedAmountTotal)
      : "待补收入口径",
    scheduleProjection.summary.teacherCount
      ? `${scheduleProjection.summary.projectableSessionCount}/${scheduleProjection.summary.sessionCount} 节已可估算 · 分红率 ${formatPercent(scheduleProjection.summary.dividendRate)}`
      : "生成排课建议后显示",
  ]);
  cards.push([
    "预计周收入",
    scheduleProjection.summary.estimatedRevenueTotal
      ? formatCompactCurrency(scheduleProjection.summary.estimatedRevenueTotal)
      : "待补收入口径",
    scheduleProjection.summary.teacherCount
      ? `教师课时毛结余 ${formatCompactCurrency(scheduleProjection.summary.teachingMarginAmount)}`
      : "生成排课建议后显示",
  ]);
  const summerLockSummary = scheduleCache
    ? scheduleCache.summerLockReport.summary
    : buildSummerBigClassRoomLockReport(state.summerBigClassRoomOccupancyReport).summary;
  cards.push([
    "暑期锁房",
    hasImportedSummerBigClassRoomOccupancyReport()
      ? `${summerLockSummary.lockSlotCount} 档`
      : "未导入",
    hasImportedSummerBigClassRoomOccupancyReport()
      ? `已解析 ${summerLockSummary.resolvedSourceCount} 行，周视图按星期+节次锁房`
      : "导入暑期大课占用后显示",
  ]);
  cards.push([
    "待补大课标注",
    hasImportedSummerBigClassRoomOccupancyReport()
      ? `${summerLockSummary.needsTeacherHintSourceCount} 行`
      : "未导入",
    hasImportedSummerBigClassRoomOccupancyReport()
      ? `缺海/姚标注的科学课先保守锁定三楼4/6；分组待确认 ${summerLockSummary.manualResolutionPendingGroupCount || 0} 组`
      : "导入暑期大课占用后显示",
  ]);

  document.getElementById("metrics").innerHTML = cards
    .map(
      ([label, value, note]) => `
        <article class="metric-card">
          <div class="metric-label">${label}</div>
          <div class="metric-value">${value}</div>
          <div class="metric-note">${note}</div>
        </article>
      `
    )
    .join("");
}

function renderSummerImportReviewPanel() {
  const panel = document.getElementById("summerImportReviewPanel");
  const listNode = document.getElementById("summerImportReviewList");
  if (!panel || !listNode) {
    return;
  }
  if (!Array.isArray(summerImportReviewItems) || !summerImportReviewItems.length) {
    panel.hidden = true;
    listNode.innerHTML = "";
    return;
  }
  panel.hidden = false;
  listNode.innerHTML = summerImportReviewItems
    .map((item, index) => {
      const focusFields = Array.isArray(item.focus_fields) ? new Set(item.focus_fields) : new Set();
      return `
        <article class="review-item-card">
          <div class="review-item-header">
            <div class="review-item-title">
              <strong>${escapeHtml(item.name || "未命名班级")}</strong>
              <div class="review-item-meta">${escapeHtml(item.message || "待确认")} · ${escapeHtml(item.fixedTeacher || "未填老师")}</div>
            </div>
          </div>
          <div class="review-item-grid">
            <label class="review-item-field">
              <span class="field-label">班名</span>
              <input class="cell-input" data-summer-review-index="${index}" data-summer-review-field="name" value="${escapeHtml(item.name || "")}">
            </label>
            <label class="review-item-field">
              <span class="field-label">老师</span>
              <input class="cell-input" data-summer-review-index="${index}" data-summer-review-field="fixedTeacher" value="${escapeHtml(item.fixedTeacher || "")}">
            </label>
            <label class="review-item-field${focusFields.has("fixedRoom") ? " is-focus" : ""}">
              <span class="field-label">教室</span>
              <input class="cell-input" data-summer-review-index="${index}" data-summer-review-field="fixedRoom" value="${escapeHtml(item.fixedRoom || "")}">
            </label>
            <label class="review-item-field${focusFields.has("grade") ? " is-focus" : ""}">
              <span class="field-label">年级</span>
              <input class="cell-input" type="number" min="1" max="9" data-summer-review-index="${index}" data-summer-review-field="grade" value="${escapeHtml(String(item.grade || 1))}">
            </label>
            <label class="review-item-field">
              <span class="field-label">类型</span>
              <select class="cell-select" data-summer-review-index="${index}" data-summer-review-field="courseType">
                ${["small_class", "medium_class", "large_class", "one_to_one"]
                  .map((value) => `<option value="${value}" ${item.courseType === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="review-item-field${focusFields.has("preferredTime") ? " is-focus" : ""}">
              <span class="field-label">时间偏好</span>
              <select class="cell-select" data-summer-review-index="${index}" data-summer-review-field="preferredTime">
                ${["evening", "weekend", "flexible"]
                  .map((value) => `<option value="${value}" ${item.preferredTime === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="review-item-field">
              <span class="field-label">每周节数</span>
              <input class="cell-input" type="number" min="1" max="6" data-summer-review-index="${index}" data-summer-review-field="weeklySessions" value="${escapeHtml(String(item.weeklySessions || 1))}">
            </label>
          </div>
          <div class="review-item-actions">
            <button class="button button-secondary" data-summer-review-apply-index="${index}">写回待开班</button>
            <button class="button button-ghost" data-summer-review-dismiss-index="${index}">先移出待确认</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function upsertSummerReviewDemand(reviewItem) {
  const name = String(reviewItem?.name || "").trim();
  const fixedTeacher = String(reviewItem?.fixedTeacher || "").trim();
  if (!name) {
    return false;
  }
  const existingIndex = state.demands.findIndex(
    (item) => item.name === name && String(item.fixedTeacher || "") === fixedTeacher
  );
  const nextDemand = normalizeDemand({
    ...(existingIndex >= 0 ? state.demands[existingIndex] : {}),
    name,
    subject: reviewItem.subject || "math",
    grade: Number(reviewItem.grade || 1),
    courseType: reviewItem.courseType || "small_class",
    weeklySessions: Number(reviewItem.weeklySessions || 1),
    preferredTime: reviewItem.preferredTime || "flexible",
    fixedTeacher,
    fixedRoom: reviewItem.fixedRoom || "",
    status: reviewItem.status || "planned",
  });
  if (existingIndex >= 0) {
    state.demands[existingIndex] = nextDemand;
  } else {
    state.demands.push(nextDemand);
  }
  return true;
}

function handleSummerImportReviewChange(event) {
  const index = Number(event.target.getAttribute("data-summer-review-index"));
  const field = event.target.getAttribute("data-summer-review-field");
  if (!field || Number.isNaN(index) || !summerImportReviewItems[index]) {
    return;
  }
  summerImportReviewItems = summerImportReviewItems.map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          [field]: event.target.value,
        }
      : item
  );
  persistSummerImportReviewItems(summerImportReviewItems);
}

function handleSummerImportReviewClick(event) {
  const applyIndex = event.target.getAttribute("data-summer-review-apply-index");
  if (applyIndex !== null) {
    const index = Number(applyIndex);
    const reviewItem = summerImportReviewItems[index];
    if (!Number.isNaN(index) && reviewItem && upsertSummerReviewDemand(reviewItem)) {
      summerImportReviewItems = summerImportReviewItems.filter((_, itemIndex) => itemIndex !== index);
      persistSummerImportReviewItems(summerImportReviewItems);
      persistState("已把暑假待确认项写回待开班。", {
        browserSnapshotOrigin: "backend_database",
      });
      renderAll();
    }
    return;
  }
  const dismissIndex = event.target.getAttribute("data-summer-review-dismiss-index");
  if (dismissIndex !== null) {
    const index = Number(dismissIndex);
    if (!Number.isNaN(index) && summerImportReviewItems[index]) {
      summerImportReviewItems = summerImportReviewItems.filter((_, itemIndex) => itemIndex !== index);
      persistSummerImportReviewItems(summerImportReviewItems);
      uiState.importLog = "已先移出 1 条暑假待确认项。";
      persistUiState();
      renderAll();
    }
  }
}

function renderTeachers() {
  const body = document.getElementById("teacherTableBody");
  body.innerHTML = state.teachers
    .map((teacher, index) => {
      const fields = FIELD_CONFIG.teacher.map((field) => renderCell("teacher", teacher, index, field)).join("");
      return `<tr>${fields}<td><button class="icon-button" data-remove="teacher" data-index="${index}">×</button></td></tr>`;
    })
    .join("");
}

function renderRooms() {
  const body = document.getElementById("roomTableBody");
  body.innerHTML = state.rooms
    .map((room, index) => {
      const fields = FIELD_CONFIG.room.map((field) => renderCell("room", room, index, field)).join("");
      return `<tr>${fields}<td><button class="icon-button" data-remove="room" data-index="${index}">×</button></td></tr>`;
    })
    .join("");
}

function renderDemands() {
  const body = document.getElementById("demandTableBody");
  body.innerHTML = state.demands
    .map((demand, index) => {
      const fields = FIELD_CONFIG.demand.map((field) => renderCell("demand", demand, index, field)).join("");
      return `<tr>${fields}<td><button class="icon-button" data-remove="demand" data-index="${index}">×</button></td></tr>`;
    })
    .join("");

  const simpleNode = document.getElementById("simpleDemandList");
  if (!simpleNode) {
    return;
  }
  if (!state.demands.length) {
    simpleNode.innerHTML = `<div class="empty-state">当前还没有待开班，点“新增待开班”后直接在卡片里填写，再点“生成临时排课建议”。</div>`;
    return;
  }
  simpleNode.innerHTML = state.demands
    .map((demand, index) => {
      const metaParts = [
        formatOption(demand.subject || "") || "未设学科",
        demand.grade ? `${demand.grade} 年级` : "未设年级",
        formatOption(demand.courseType || "") || "未设类型",
        demand.weeklySessions ? `每周 ${demand.weeklySessions} 节` : "未设节数",
      ];
      const fields = FIELD_CONFIG.demand
        .map((field) => renderSimpleFieldControl("demand", demand, index, field))
        .join("");
      return `
        <article class="simple-edit-card">
          <div class="simple-card-header">
            <div class="simple-card-title">
              <strong>${escapeHtml(demand.name || "未命名待开班")}</strong>
              <div class="simple-card-meta">${escapeHtml(metaParts.join(" · "))}</div>
            </div>
            <button class="simple-remove-button" data-remove="demand" data-index="${index}">删除</button>
          </div>
          <div class="simple-card-grid">${fields}</div>
        </article>
      `;
    })
    .join("");
}

function renderSchedule() {
  if (isSimpleMode() && (uiState.scheduleView !== "board" || uiState.roomViewDay !== "all")) {
    uiState.scheduleView = "board";
    uiState.roomViewDay = "all";
    persistUiState();
  }
  const board = document.getElementById("scheduleBoard");
  const unscheduled = document.getElementById("unscheduledList");
  const roomHeatList = document.getElementById("roomHeatList");
  const teacherLoadList = document.getElementById("teacherLoadList");
  const coreTeacherOneToOneFallbackList = document.getElementById(
    "coreTeacherOneToOneFallbackList"
  );
  const summerBigClassOccupancyList = document.getElementById("summerBigClassOccupancyList");
  const scheduleInputProfileList = document.getElementById("scheduleInputProfileList");
  const scheduleDraftImportList = document.getElementById("scheduleDraftImportList");
  const summerPhaseProjectionList = document.getElementById("summerPhaseProjectionList");
  const settlementCoverageList = document.getElementById("scheduleSettlementCoverageList");
  const boardView = document.getElementById("boardView");
  const roomView = document.getElementById("roomView");
  const boardButton = document.getElementById("boardViewButton");
  const roomButton = document.getElementById("roomViewButton");
  const projectionPeriodSelect = document.getElementById("scheduleProjectionPeriodSelect");

  boardView.classList.toggle("hidden", uiState.scheduleView !== "board");
  roomView.classList.toggle("hidden", uiState.scheduleView !== "room");
  boardButton.classList.toggle("is-active", uiState.scheduleView === "board");
  roomButton.classList.toggle("is-active", uiState.scheduleView === "room");
  document.getElementById("roomViewDaySelect").value = uiState.roomViewDay;
  const projectionPeriods = getScheduleProjectionPeriods();
  const selectedProjectionPeriod = resolveScheduleProjectionPeriod(projectionPeriods);
  if (projectionPeriodSelect) {
    projectionPeriodSelect.innerHTML = projectionPeriods
      .map(
        (periodName) =>
          `<option value="${periodName}" ${periodName === selectedProjectionPeriod ? "selected" : ""}>${periodName}</option>`
      )
      .join("");
    projectionPeriodSelect.value = selectedProjectionPeriod;
  }

  const entries = scheduleCache ? scheduleCache.entries : [];
  const summerLockReport = scheduleCache
    ? scheduleCache.summerLockReport
    : buildSummerBigClassRoomLockReport(state.summerBigClassRoomOccupancyReport);
  const roomBoardMap = buildBoardRoomCellMap(entries, summerLockReport.roomLocks);
  const boardRooms = getBoardRooms(entries, summerLockReport.roomLocks);

  if (!boardRooms.length) {
    board.innerHTML = `<div class="empty-state">请先录入教室，再生成临时排课建议。</div>`;
  } else {
    board.innerHTML = `
      <table class="schedule-matrix">
        <thead>
          <tr>
            <th class="schedule-matrix-head schedule-matrix-head-slot">节次</th>
            <th class="schedule-matrix-head schedule-matrix-head-room">教室名称</th>
            ${DAY_TEMPLATES.map((day) => `<th class="schedule-matrix-head">${day.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${SLOT_TEMPLATES.map((slot) =>
            boardRooms
              .map((room, roomIndex) => {
                const slotHeader =
                  roomIndex === 0
                    ? `
                      <th class="schedule-slot-group" rowspan="${boardRooms.length}">
                        <strong>${slot.label}</strong>
                        <span class="slot-caption">${slot.time}</span>
                      </th>
                    `
                    : "";
                const dayCells = DAY_TEMPLATES.map((day) => {
                  const key = `${day.key}-${slot.index}-${room.name}`;
                  const cellItems = roomBoardMap.get(key) || [];
                  const cards = cellItems
                    .map((item) => renderBoardRoomCellItem(item))
                    .join("");
                  return `
                    <td class="schedule-matrix-cell ${cellItems.length ? "" : "is-empty"}">
                      ${cards || `<div class="schedule-cell-empty"></div>`}
                    </td>
                  `;
                }).join("");
                return `
                  <tr>
                    ${slotHeader}
                    <th class="schedule-room-name">${escapeHtml(room.name)}</th>
                    ${dayCells}
                  </tr>
                `;
              })
              .join("")
          ).join("")}
        </tbody>
      </table>
    `;
  }

  if (!scheduleCache || !scheduleCache.unscheduled.length) {
    unscheduled.innerHTML = `<div class="empty-state">当前样例数据都已排入，可以继续追加招生中的待开班。</div>`;
  } else {
    unscheduled.innerHTML = scheduleCache.unscheduled
      .map(
        (item) => `
          <div class="list-card">
            <div class="list-title">${item.name} · 第${item.sessionNumber}节需求</div>
            <div class="list-meta">${item.reason}</div>
          </div>
        `
      )
      .join("");
  }

  roomHeatList.innerHTML = scheduleCache.roomHeat
    .map(
      (room) => `
        <div class="list-card">
          <div class="list-title">${room.name}</div>
          <div class="list-meta">暑期锁定 ${room.importedLockCount} 档 · 小班建议 ${room.scheduledCount} 节 · 最大容量 ${room.maxCapacity}</div>
        </div>
      `
    )
    .join("");

  teacherLoadList.innerHTML = scheduleCache.teacherLoad
    .map(
      (teacher) => `
        <div class="list-card">
          <div class="list-title">${teacher.name}</div>
          <div class="list-meta">建议排入 ${teacher.count} 节 · ${
            teacher.isCore ? "核心老师" : "非核心老师"
          } · 日上限 ${teacher.dayCapacity} 节 · 周上限 ${teacher.weeklyCapacity} 节 · ${
            teacher.noEvening ? "禁排第6节" : "晚课可排"
          }</div>
          <div class="list-meta">休息日 ${teacher.weeklyRestDaySummary} · 模式 ${formatOption(teacher.schedulePattern)} · 已占上课日 ${teacher.assignedDayCount} 天 · 连续 ${teacher.longestTeachingStreak} 天</div>
          <div class="list-meta">一对一 ${teacher.oneToOneCount} 节${
            teacher.coreOneToOneFallbackCount
              ? ` · 其中核心兜底 ${teacher.coreOneToOneFallbackCount} 节`
              : ""
          }</div>
        </div>
      `
    )
    .join("");

  if (coreTeacherOneToOneFallbackList) {
    coreTeacherOneToOneFallbackList.innerHTML =
      scheduleCache && scheduleCache.coreOneToOneFallbacks.length
        ? scheduleCache.coreOneToOneFallbacks
            .map(
              (entry) => `
                <div class="list-card">
                  <div class="list-title">${entry.name} · ${entry.teacherName}</div>
                  <div class="list-meta">${entry.dayLabel} ${entry.slotLabel} ${entry.slotTime} · ${entry.roomName}</div>
                  <div class="list-meta">${
                    entry.assignmentNote || "当前没有可承接的一对一非核心老师，系统已启用核心老师兜底。"
                  }</div>
                </div>
              `
            )
            .join("")
        : `<div class="empty-state">当前一对一需求都没有落到核心老师身上。</div>`;
  }

  if (summerBigClassOccupancyList) {
    summerBigClassOccupancyList.innerHTML = buildSummerBigClassOccupancyHtml(
      scheduleCache ? scheduleCache.summerLockReport : null
    );
  }
  if (scheduleInputProfileList) {
    scheduleInputProfileList.innerHTML = buildScheduleInputProfileHtml();
  }
  if (scheduleDraftImportList) {
    scheduleDraftImportList.innerHTML = buildScheduleDraftImportHtml();
  }

  const scheduleProjection = buildScheduleSettlementProjection();
  const summerPhaseProjection = buildSummerPhaseProjection(
    scheduleProjection.summary.projectionPeriodName
  );
  settlementCoverageList.innerHTML = buildScheduleSettlementCoverageHtml(scheduleProjection);
  if (summerPhaseProjectionList) {
    summerPhaseProjectionList.innerHTML = buildSummerPhaseProjectionHtml(
      summerPhaseProjection
    );
  }

  renderRoomScheduleView();
}

function renderBoardRoomCellItem(item) {
  if (item.itemType === "lock") {
    return `
      <article class="schedule-card schedule-card-lock">
        <h4>${escapeHtml(item.classTitle)}</h4>
        <div class="schedule-meta">
          <span class="chip">${escapeHtml(item.teacherText)}</span>
          <span class="chip chip-muted">${escapeHtml(item.statusText)}</span>
        </div>
        <div class="schedule-note">${escapeHtml(item.noteText)}</div>
      </article>
    `;
  }

  return `
    <article class="schedule-card schedule-card-compact">
      <h4>${escapeHtml(item.name)}</h4>
      <div class="schedule-meta">
        <span class="chip">${escapeHtml(item.teacherName)}</span>
        <span class="chip">${escapeHtml(String(item.size))}人</span>
        ${item.coreOneToOneFallback ? `<span class="chip chip-danger">核心一对一兜底</span>` : ""}
      </div>
    </article>
  `;
}

function buildBoardRoomCellMap(entries, roomLocks) {
  const roomBoardMap = new Map();
  entries.forEach((entry) => {
    const key = `${entry.dayKey}-${entry.slotIndex}-${entry.roomName}`;
    if (!roomBoardMap.has(key)) {
      roomBoardMap.set(key, []);
    }
    roomBoardMap.get(key).push({
      itemType: "schedule",
      ...entry,
    });
  });

  roomLocks.forEach((lock) => {
    const key = `${lock.dayKey}-${lock.slotIndex}-${lock.roomName}`;
    if (!roomBoardMap.has(key)) {
      roomBoardMap.set(key, []);
    }
    roomBoardMap.get(key).push({
      itemType: "lock",
      classTitle: lock.classGroupSummaryText || "暑期大课占用",
      teacherText: lock.teacherSummaryText || "教室保留",
      statusText: lock.lockLevel === "needs_teacher_hint" ? "待补标注" : "大课锁定",
      noteText: lock.noteText || "暑期大课教室占用",
    });
  });

  roomBoardMap.forEach((items) => {
    items.sort((left, right) => {
      if (left.itemType === right.itemType) {
        if (left.itemType === "schedule") {
          return Number(right.size || 0) - Number(left.size || 0);
        }
        return String(left.classTitle || "").localeCompare(String(right.classTitle || ""), "zh-CN");
      }
      return left.itemType === "lock" ? -1 : 1;
    });
  });

  return roomBoardMap;
}

function getBoardRooms(entries, roomLocks) {
  const roomMap = new Map();
  state.rooms.forEach((room) => {
    if (room?.name) {
      roomMap.set(room.name, room);
    }
  });

  entries.forEach((entry) => {
    if (entry.roomName && !roomMap.has(entry.roomName)) {
      roomMap.set(entry.roomName, {
        name: entry.roomName,
        floor: inferFloorLabel(entry.roomName),
      });
    }
  });

  roomLocks.forEach((lock) => {
    if (lock.roomName && !roomMap.has(lock.roomName)) {
      roomMap.set(lock.roomName, {
        name: lock.roomName,
        floor: inferFloorLabel(lock.roomName),
      });
    }
  });

  return [...roomMap.values()].sort(compareRoomsForBoard);
}

function compareRoomsForBoard(left, right) {
  const floorDiff = getRoomFloorSortRank(left) - getRoomFloorSortRank(right);
  if (floorDiff) {
    return floorDiff;
  }
  const nameDiff = String(left.name || "").localeCompare(String(right.name || ""), "zh-CN");
  if (nameDiff) {
    return nameDiff;
  }
  return Number(right.summerPriority || 0) - Number(left.summerPriority || 0);
}

function getRoomFloorSortRank(room) {
  const raw = `${room?.floor || ""} ${room?.name || ""}`;
  const normalized = raw.replaceAll(" ", "").toUpperCase();
  if (/1F|一楼|一层/.test(normalized)) {
    return 1;
  }
  if (/2F|二楼|二层/.test(normalized)) {
    return 2;
  }
  if (/3F|三楼|三层/.test(normalized)) {
    return 3;
  }
  const digitMatch = normalized.match(/([1-9])/);
  if (digitMatch) {
    return Number(digitMatch[1]);
  }
  return 99;
}

function inferFloorLabel(roomName) {
  const normalized = String(roomName || "").trim();
  if (normalized.includes("一楼") || normalized.includes("1")) {
    return "1F";
  }
  if (normalized.includes("二楼") || normalized.includes("2")) {
    return "2F";
  }
  if (normalized.includes("三楼") || normalized.includes("3")) {
    return "3F";
  }
  return "";
}

function renderScheduleReviewDesk() {
  const periodSelect = document.getElementById("scheduleReviewDeskPeriodSelect");
  const summaryNode = document.getElementById("scheduleReviewDeskSummaryCards");
  const teacherPriorityList = document.getElementById("scheduleReviewDeskTeacherPriorityList");
  const manualList = document.getElementById("scheduleReviewDeskManualList");
  const residualList = document.getElementById("scheduleReviewDeskResidualList");
  const bulkList = document.getElementById("scheduleReviewDeskBulkList");
  const batchList = document.getElementById("scheduleReviewDeskBatchList");
  const progressList = document.getElementById("scheduleReviewDeskProgressList");
  if (
    !periodSelect ||
    !summaryNode ||
    !teacherPriorityList ||
    !manualList ||
    !residualList ||
    !bulkList ||
    !batchList ||
    !progressList
  ) {
    return;
  }

  const periods = getScheduleReviewDeskPeriods();
  if (!periods.length) {
    const emptyHtml =
      '<div class="empty-state">导入排课草稿复核、高置信候选、残余人工队列或老师结算画像后，这里会直接按月份拆出“先批量、后人工”的排课复核动作。</div>';
    periodSelect.innerHTML = "";
    summaryNode.innerHTML = emptyHtml;
    teacherPriorityList.innerHTML = emptyHtml;
    manualList.innerHTML = emptyHtml;
    residualList.innerHTML = emptyHtml;
    bulkList.innerHTML = emptyHtml;
    batchList.innerHTML = emptyHtml;
    progressList.innerHTML = emptyHtml;
    return;
  }

  const selectedPeriod = resolveScheduleReviewDeskPeriod(periods);
  periodSelect.innerHTML = periods
    .map(
      (periodName) =>
        `<option value="${periodName}" ${periodName === selectedPeriod ? "selected" : ""}>${periodName}</option>`
    )
    .join("");
  periodSelect.value = selectedPeriod;

  const periodSummary = getTeacherSettlementProfilePeriodSummary(selectedPeriod);
  const teacherProfiles = getScheduleReviewTeacherProfilesForPeriod(selectedPeriod);
  const manualPeriodSummary = getScheduleDraftManualReviewPeriodSummary(selectedPeriod);
  const manualTeacherPeriods = getScheduleDraftManualReviewTeacherPeriods(selectedPeriod);
  const classnameBatchRows = getScheduleDraftManualClassnameBatchRows(selectedPeriod);
  const combinedBatchRows = getScheduleDraftManualCombinedBatchRows(selectedPeriod);
  const batchRows = getScheduleDraftManualClassroomBatchRows(selectedPeriod);
  const residualPeriodSummary = getScheduleDraftManualResidualPeriodSummary(selectedPeriod);
  const residualTeacherPeriods = getScheduleDraftManualResidualTeacherPeriods(selectedPeriod);
  const residualRows = getScheduleDraftManualResidualRows(selectedPeriod);
  const bulkSummary = state.scheduleDraftReviewBulkCandidatesReport?.summary || {};
  const bulkApplySummary = state.scheduleDraftReviewBulkApplyReport?.summary || {};
  const manualSummary = state.scheduleDraftManualReviewReport?.summary || {};
  const classnameBatchSummary =
    state.scheduleDraftManualClassnameBatchCandidatesReport?.summary || {};
  const classnameBatchApplySummary =
    state.scheduleDraftManualClassnameBatchApplyReport?.summary || {};
  const combinedBatchSummary =
    state.scheduleDraftManualCombinedBatchCandidatesReport?.summary || {};
  const combinedBatchApplySummary =
    state.scheduleDraftManualCombinedBatchApplyReport?.summary || {};
  const batchSummary =
    state.scheduleDraftManualClassroomBatchCandidatesReport?.summary || {};
  const batchApplySummary =
    state.scheduleDraftManualClassroomBatchApplyReport?.summary || {};

  const unresolvedCount = teacherProfiles.reduce(
    (sum, item) => sum + Number(item.schedule_review_unresolved_row_count || 0),
    0
  );
  const bulkCandidateCount = teacherProfiles.reduce(
    (sum, item) => sum + Number(item.schedule_review_auto_candidate_count || 0),
    0
  );
  const classnameBatchCandidateCount = teacherProfiles.reduce(
    (sum, item) =>
      sum + Number(item.schedule_review_manual_classname_batch_row_count || 0),
    0
  );
  const combinedBatchCandidateCount =
    teacherProfiles.reduce(
      (sum, item) =>
        sum + Number(item.schedule_review_manual_combined_batch_row_count || 0),
      0
    ) ||
    combinedBatchRows.reduce((sum, item) => sum + Number(item.row_count || 0), 0);
  const batchCandidateCount = teacherProfiles.reduce(
    (sum, item) =>
      sum + Number(item.schedule_review_manual_classroom_batch_row_count || 0),
    0
  );
  const rowByRowCount =
    teacherProfiles.reduce(
      (sum, item) => sum + Number(item.schedule_review_manual_row_by_row_count || 0),
      0
    ) || Number(residualPeriodSummary?.row_count || 0);
  const readyAfterBulkCount = teacherProfiles.filter(
    (item) =>
      item.projected_readiness_status_after_bulk === "ready_for_rule_migration" ||
      item.schedule_review_projected_clear_possible
  ).length;

  const summaryCards = [
    [
      "复核月份",
      selectedPeriod,
      periodSummary
        ? `老师月份 ${periodSummary.teacher_count} · 排课复核 ${periodSummary.needs_schedule_review_count}`
        : "按导入的排课复核和结算画像自动切换",
    ],
    [
      "未关课次",
      unresolvedCount || 0,
      periodSummary
        ? `高置信后仍卡 ${periodSummary.projected_needs_schedule_review_count} 个老师月份`
        : "先看高置信候选和残余人工队列",
    ],
    [
      "高置信候选",
      bulkCandidateCount || 0,
      periodSummary
        ? `可一键清零 ${periodSummary.schedule_review_bulk_clearable_count} 个老师月份`
        : "优先批量确认草稿班名/教室建议",
    ],
    [
      "班名批量",
      classnameBatchCandidateCount || 0,
      periodSummary
        ? `${periodSummary.manual_classname_batch_teacher_period_count || 0} 个老师月份可先统一班名`
        : "同老师同月同别名的草稿班可一组确认",
    ],
    [
      "联合批量",
      combinedBatchCandidateCount || 0,
      periodSummary
        ? `${periodSummary.manual_combined_batch_teacher_period_count || 0} 个老师月份可一起确认班名和教室`
        : "同时缺班名和教室、但两边都有建议的课次可一起处理",
    ],
    [
      "教室批量",
      batchCandidateCount || 0,
      periodSummary
        ? `${periodSummary.manual_classroom_batch_teacher_period_count} 个老师月份可再批量吃掉`
        : "同老师同月同建议教室的课次可一组确认",
    ],
    [
      "逐条人工",
      rowByRowCount || 0,
      periodSummary
        ? `${periodSummary.teacher_period_row_by_row_after_manual_batch_count || periodSummary.teacher_period_row_by_row_after_classroom_batch_count || 0} 个老师月份仍需逐条看`
        : "这是高置信和班名/教室批量之外的真残余项",
    ],
    [
      "高置信后可直达",
      readyAfterBulkCount || 0,
      periodSummary
        ? `${periodSummary.projected_ready_for_rule_migration_count} 个老师月份可直达自动结算底稿`
        : "先吃完高置信候选再看",
    ],
  ];
  summaryNode.innerHTML = summaryCards
    .map(
      ([label, value, note]) => `
        <article class="metric-card">
          <div class="metric-label">${label}</div>
          <div class="metric-value metric-value-sm">${value}</div>
          <div class="metric-note">${note}</div>
        </article>
      `
    )
    .join("");

  teacherPriorityList.innerHTML = teacherProfiles.length
    ? teacherProfiles
        .slice(0, 8)
        .map(
          (item) => `
            <div class="list-card">
              <div class="list-title">${item.teacher_name} · ${formatProfileReadinessStatus(item.readiness_status)}</div>
              <div class="list-meta">未关 ${item.schedule_review_unresolved_row_count || 0} 条 · 高置信 ${item.schedule_review_auto_candidate_count || 0} · 班名批量 ${item.schedule_review_manual_classname_batch_row_count || 0} · 联合 ${item.schedule_review_manual_combined_batch_row_count || 0} · 教室批量 ${item.schedule_review_manual_classroom_batch_row_count || 0} · 逐条 ${item.schedule_review_manual_row_by_row_count || 0}</div>
              ${item.recommended_next_step ? `<div class="list-meta">当前：${item.recommended_next_step}</div>` : ""}
              ${item.projected_next_step_after_bulk ? `<div class="list-meta">高置信后：${item.projected_next_step_after_bulk}</div>` : ""}
            </div>
          `
        )
        .join("")
    : '<div class="empty-state">这个月份当前没有老师画像里的排课复核项。</div>';

  const residualTeacherPeriodMap = new Map(
    residualTeacherPeriods.map((item) => [`${item.period_name}||${item.teacher_name}`, item])
  );
  manualList.innerHTML = manualTeacherPeriods.length
    ? manualTeacherPeriods
        .slice(0, 8)
        .map((item) => {
          const residualItem = residualTeacherPeriodMap.get(
            `${item.period_name}||${item.teacher_name}`
          );
          return `
            <div class="list-card">
              <div class="list-title">${item.teacher_name} · ${item.primary_focus || "人工复核"}</div>
              <div class="list-meta">逐条 ${item.manual_row_count || 0} 条 · 草稿班名 ${item.draft_class_name_count || 0} · 缺教室 ${item.missing_classroom_count || 0}${residualItem ? ` · 最终尾项 ${residualItem.row_count || 0}` : ""}</div>
              ${item.recommended_action ? `<div class="list-meta">建议：${item.recommended_action}</div>` : ""}
              ${residualItem && residualItem.sample_rows ? `<div class="list-meta">尾项：${residualItem.sample_rows}</div>` : ""}
              ${item.sample_class_names ? `<div class="list-meta">样本：${item.sample_class_names}</div>` : ""}
            </div>
          `;
        })
        .join("")
    : '<div class="empty-state">这个月份当前没有残余逐条人工队列。</div>';

  residualList.innerHTML = residualRows.length
    ? [
        `
          <div class="list-card">
            <div class="list-title">最终逐条尾项总览</div>
            <div class="list-meta">当前月 ${residualPeriodSummary?.row_count || residualRows.length} 条 · 老师月份 ${residualPeriodSummary?.teacher_period_count || residualTeacherPeriods.length}</div>
            <div class="list-meta">这部分已经排除高置信、班名批量、联合批量和教室批量，只剩必须人工拍板的尾项。</div>
          </div>
        `,
        ...residualRows.slice(0, 8).map(
          (row) => `
            <div class="list-card">
              <div class="list-title">${row.teacher_name} · ${row.course_date || "日期待确认"} ${row.start_time || ""}</div>
              <div class="list-meta">问题 ${row.issue_flags || "未识别"} · 当前班名 ${row.current_class_name || "—"} · 当前教室 ${row.current_classroom_name || "未填"}</div>
              ${row.recommended_manual_action ? `<div class="list-meta">建议：${row.recommended_manual_action}</div>` : ""}
              ${row.source_notes ? `<div class="list-meta">原备注：${row.source_notes}</div>` : ""}
            </div>
          `
        ),
      ].join("")
    : '<div class="empty-state">这个月份当前没有最终逐条尾项。</div>';

  const topBulkTeachers = teacherProfiles
    .filter((item) => Number(item.schedule_review_auto_candidate_count || 0) > 0)
    .sort(
      (left, right) =>
        Number(right.schedule_review_auto_candidate_count || 0) -
          Number(left.schedule_review_auto_candidate_count || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
  const bulkActionSummary = Array.isArray(bulkSummary.action_counts)
    ? bulkSummary.action_counts
        .map((item) => `${formatBulkRecommendationAction(item.recommendation_action)} ${item.count}`)
        .join(" / ")
    : "";
  const bulkConfirmPending = Array.isArray(bulkSummary.confirm_status_counts)
    ? bulkSummary.confirm_status_counts
        .map((item) => `${formatRuleBackfillConfirmStatus(item.confirm_status || "pending")} ${item.count}`)
        .join(" / ")
    : "";
  bulkList.innerHTML = [
    `
      <div class="list-card">
        <div class="list-title">高置信候选总池</div>
        <div class="list-meta">总条数 ${bulkSummary.row_count || 0} · 已回写 ${bulkApplySummary.applied_count || 0} · 未确认 ${bulkApplySummary.ignored_count || 0}</div>
        ${bulkActionSummary ? `<div class="list-meta">${bulkActionSummary}</div>` : ""}
        ${bulkConfirmPending ? `<div class="list-meta">${bulkConfirmPending}</div>` : ""}
      </div>
    `,
    ...topBulkTeachers.slice(0, 6).map(
      (item) => `
        <div class="list-card">
          <div class="list-title">${item.teacher_name}</div>
          <div class="list-meta">当前月高置信 ${item.schedule_review_auto_candidate_count || 0} 条 · 未关 ${item.schedule_review_unresolved_row_count || 0} 条</div>
          <div class="list-meta">${item.projected_readiness_status_after_bulk === "ready_for_rule_migration" ? "高置信确认后可直达自动结算底稿。" : item.projected_next_step_after_bulk || "高置信确认后继续处理剩余人工项。"}</div>
        </div>
      `
    ),
  ].join("");

  batchList.innerHTML = classnameBatchRows.length || combinedBatchRows.length || batchRows.length
    ? [
        `
          <div class="list-card">
            <div class="list-title">批量候选总池</div>
            <div class="list-meta">班名 ${classnameBatchSummary.group_count || 0} 组/${classnameBatchSummary.covered_row_count || 0} 条 · 联合 ${combinedBatchSummary.group_count || 0} 组/${combinedBatchSummary.covered_row_count || 0} 条 · 教室 ${batchSummary.group_count || 0} 组/${batchSummary.covered_row_count || 0} 条</div>
            <div class="list-meta">已回写：班名 ${classnameBatchApplySummary.applied_batch_count || 0} 组/${classnameBatchApplySummary.applied_row_count || 0} 条 · 联合 ${combinedBatchApplySummary.applied_batch_count || 0} 组/${combinedBatchApplySummary.applied_row_count || 0} 条 · 教室 ${batchApplySummary.applied_batch_count || 0} 组/${batchApplySummary.applied_row_count || 0} 条</div>
            <div class="list-meta">班名候选里低置信 ${classnameBatchSummary.low_confidence_group_count || 0} 组/${classnameBatchSummary.low_confidence_row_count || 0} 条 · 有历史样本 ${classnameBatchSummary.related_sample_group_count || 0} 组/${classnameBatchSummary.related_sample_row_count || 0} 条</div>
          </div>
        `,
        ...classnameBatchRows.slice(0, 4).map(
          (item) => `
            <div class="list-card">
              <div class="list-title">${item.teacher_name} · 班名别名 ${item.source_note_key || "待确认别名"}</div>
              <div class="list-meta">${item.row_count || 0} 条 · ${item.course_date_range || "日期待确认"} · 建议 ${item.recommended_resolved_class_name || "待确认正式班名"}</div>
              <div class="list-meta">置信度 ${formatClassnameBatchConfidence(item.recommendation_confidence)} · ${formatClassnameBatchRecommendationBasis(item.recommendation_basis)} · 精确命中 课表 ${item.exact_schedule_match_count || 0} / 班级 ${item.exact_class_group_match_count || 0}</div>
              <div class="list-meta">相关样本 课表 ${item.related_schedule_match_count || 0} / 班级 ${item.related_class_group_match_count || 0}</div>
              ${item.recommendation_note ? `<div class="list-meta">${item.recommendation_note}</div>` : ""}
              ${item.matching_schedule_name_samples ? `<div class="list-meta">历史课表：${item.matching_schedule_name_samples}</div>` : ""}
              ${item.matching_class_group_samples ? `<div class="list-meta">班级主表：${item.matching_class_group_samples}</div>` : ""}
              ${!item.matching_schedule_name_samples && !item.matching_class_group_samples ? `<div class="list-meta">当前没有历史样本，这组只适合人工辅助判断，不建议直接当自动规则。</div>` : ""}
              ${item.class_name_samples ? `<div class="list-meta">样本：${item.class_name_samples}</div>` : ""}
            </div>
          `
        ),
        ...combinedBatchRows.slice(0, 4).map(
          (item) => `
            <div class="list-card">
              <div class="list-title">${item.teacher_name} · 联合批量</div>
              <div class="list-meta">${item.row_count || 0} 条 · ${item.course_date_range || "日期待确认"} · 建议班名 ${item.recommended_resolved_class_name || "待确认"} · 建议教室 ${item.recommended_resolved_classroom_name || "待确认"}</div>
              <div class="list-meta">置信度 ${formatClassnameBatchConfidence(item.recommendation_confidence)} · ${item.suggestion_basis_samples || "建议来源未识别"}</div>
              ${item.recommendation_note ? `<div class="list-meta">${item.recommendation_note}</div>` : ""}
              ${item.source_note_samples ? `<div class="list-meta">原备注：${item.source_note_samples}</div>` : ""}
            </div>
          `
        ),
        ...batchRows.slice(0, 6).map(
          (item) => `
            <div class="list-card">
              <div class="list-title">${item.teacher_name} · 教室 ${item.suggested_classroom_name || item.recommended_resolved_classroom_name || "待确认教室"}</div>
              <div class="list-meta">${item.row_count || 0} 条 · ${item.course_date_range || "日期待确认"} · ${item.suggestion_basis || "建议来源未识别"}</div>
              ${item.recommendation_note ? `<div class="list-meta">${item.recommendation_note}</div>` : ""}
              ${item.class_name_samples ? `<div class="list-meta">样本：${item.class_name_samples}</div>` : ""}
            </div>
          `
        ),
      ].join("")
    : '<div class="empty-state">这个月份当前没有班名或教室批量候选组。</div>';

  const progressCards = [];
  if (manualPeriodSummary) {
    progressCards.push(`
      <div class="list-card">
        <div class="list-title">${selectedPeriod} 残余人工概览</div>
        <div class="list-meta">残余 ${manualPeriodSummary.manual_row_count || 0} 条 · 草稿班名 ${manualPeriodSummary.draft_class_name_count || 0} · 缺教室 ${manualPeriodSummary.missing_classroom_count || 0}</div>
        <div class="list-meta">高置信已被提前排除 ${manualSummary.excluded_bulk_candidate_count || 0} 条，当前队列只保留真残余。</div>
      </div>
    `);
  }
  if (residualPeriodSummary) {
    const issueSummary = Array.isArray(residualPeriodSummary.issue_counts)
      ? residualPeriodSummary.issue_counts
          .map((item) => `${item.issue_flags || item.issueFlags || "未识别"} ${item.count || 0}`)
          .join(" / ")
      : "";
    const categorySummary = Array.isArray(residualPeriodSummary.category_counts)
      ? residualPeriodSummary.category_counts
          .map(
            (item) =>
              `${item.residual_category || item.residualCategory || "未识别"} ${item.count || 0}`
          )
          .join(" / ")
      : "";
    progressCards.push(`
      <div class="list-card">
        <div class="list-title">${selectedPeriod} 最终逐条尾项</div>
        <div class="list-meta">尾项 ${residualPeriodSummary.row_count || 0} 条 · 老师月份 ${residualPeriodSummary.teacher_period_count || 0}</div>
        ${issueSummary ? `<div class="list-meta">${issueSummary}</div>` : ""}
        ${categorySummary ? `<div class="list-meta">${categorySummary}</div>` : ""}
      </div>
    `);
  }
  if (periodSummary) {
    progressCards.push(`
      <div class="list-card">
        <div class="list-title">${selectedPeriod} 迁移投影</div>
        <div class="list-meta">高置信后仍需排课复核 ${periodSummary.projected_needs_schedule_review_count || 0} 个老师月份 · 可清零 ${periodSummary.schedule_review_bulk_clearable_count || 0}</div>
        <div class="list-meta">再处理班名/教室批量后，逐条人工剩余 ${periodSummary.row_by_row_after_manual_batch_count || periodSummary.row_by_row_after_classroom_batch_count || 0} 条。</div>
      </div>
    `);
  }
  const directReadyProfiles = teacherProfiles.filter(
    (item) => item.projected_readiness_status_after_bulk === "ready_for_rule_migration"
  );
  if (directReadyProfiles.length) {
    progressCards.push(`
      <div class="list-card">
        <div class="list-title">高置信后可直达自动结算底稿</div>
        <div class="list-meta">${directReadyProfiles
          .slice(0, 5)
          .map((item) => item.teacher_name)
          .join(" / ")}</div>
      </div>
    `);
  }
  progressList.innerHTML =
    progressCards.join("") ||
    '<div class="empty-state">当前月份还没有可展示的处理进度。</div>';
}

function renderOpsOpenItemsPanel() {
  const summaryNode = document.getElementById("opsOpenItemsSummaryCards");
  const actionList = document.getElementById("opsOpenItemsActionList");
  const summerList = document.getElementById("opsOpenItemsSummerList");
  const residualList = document.getElementById("opsOpenItemsResidualList");
  const settlementList = document.getElementById("opsOpenItemsSettlementList");
  const policyList = document.getElementById("opsOpenItemsPolicyList");
  const chatSheetList = document.getElementById("opsChatAnswerSheetList");
  const chatApplyList = document.getElementById("opsChatAnswerApplyList");
  if (
    !summaryNode ||
    !actionList ||
    !summerList ||
    !residualList ||
    !settlementList ||
    !policyList ||
    !chatSheetList ||
    !chatApplyList
  ) {
    return;
  }

  if (!hasImportedOpsOpenItemsPanelData()) {
    const emptyHtml =
      '<div class="empty-state">导入 prototype-import-snapshot.json、ops-open-items-report.json 或 ops-chat-answer-sheet.json 后，这里会把暑期标注、春季尾项、课时费缺口、未来提成待补和聊天回复模板统一收口展示。</div>';
    summaryNode.innerHTML = emptyHtml;
    actionList.innerHTML = emptyHtml;
    summerList.innerHTML = emptyHtml;
    residualList.innerHTML = emptyHtml;
    settlementList.innerHTML = emptyHtml;
    policyList.innerHTML = emptyHtml;
    chatSheetList.innerHTML = emptyHtml;
    chatApplyList.innerHTML = emptyHtml;
    return;
  }

  const report = state.opsOpenItemsReport;
  const summary = report.summary || {};
  const chatSheet = state.opsChatAnswerSheet || createEmptyOpsChatAnswerSheet();
  const chatApply = state.opsChatAnswerApplyReport || createEmptyOpsChatAnswerApplyReport();
  const summaryCards = [
    [
      "收口待办",
      summary.attention_item_count || 0,
      "跨排课、课时费和提成规则的剩余人工项",
    ],
    [
      "暑期大班标注",
      summary.summer_pending_group_count || 0,
      "海 / 姚 / 海加姚 未确认前，锁房仍保守占位",
    ],
    [
      "春季最终尾项",
      summary.schedule_residual_row_count || 0,
      "这批课次已经排除高置信、批量和联合候选",
    ],
    [
      "缺结算汇总",
      summary.missing_statement_teacher_period_count || 0,
      "优先补工资表汇总页，或明确转归档口径",
    ],
    [
      "未来提成待补",
      summary.future_policy_pending_teacher_count || 0,
      "当前默认按 20%，后续补满一年涨幅",
    ],
    [
      "聊天答题项",
      chatSheet.summary?.total_question_count || 0,
      "可直接复制模板回复，不必逐张改 CSV",
    ],
  ];
  summaryNode.innerHTML = summaryCards
    .map(
      ([label, value, note]) => `
        <article class="metric-card">
          <div class="metric-label">${label}</div>
          <div class="metric-value metric-value-sm">${value}</div>
          <div class="metric-note">${note}</div>
        </article>
      `
    )
    .join("");

  const categoryRows = Array.isArray(report.category_rows) ? report.category_rows : [];
  actionList.innerHTML = categoryRows.length
    ? categoryRows
        .filter((item) => Number(item.item_count || 0) > 0)
        .map(
          (item) => `
            <div class="list-card">
              <div class="list-title">${item.label}</div>
              <div class="list-meta">待处理 ${item.item_count || 0} 项</div>
              ${item.action_hint ? `<div class="list-meta">${item.action_hint}</div>` : ""}
            </div>
          `
        )
        .join("")
    : '<div class="empty-state">当前没有待处理的统一收口项。</div>';

  const summerRows = Array.isArray(report.summer_pending_rows)
    ? report.summer_pending_rows
    : [];
  summerList.innerHTML = summerRows.length
    ? summerRows
        .slice(0, 6)
        .map(
          (row) => `
            <div class="list-card">
              <div class="list-title">${row.class_group_name} · ${row.subject_name}</div>
              <div class="list-meta">${row.time_range_text || "时段待确认"} · 待补 ${row.unresolved_row_count || 0} 行</div>
              ${row.course_date_samples_text ? `<div class="list-meta">日期：${row.course_date_samples_text}</div>` : ""}
              <div class="list-meta">${row.candidate_labels_text || row.recommended_resolution || row.resolution_requirement_summary || "待确认海 / 姚 / 海加姚"}</div>
            </div>
          `
        )
        .join("")
    : '<div class="empty-state">当前没有待确认的暑期大班老师标注。</div>';

  const residualRows = Array.isArray(report.schedule_residual_rows)
    ? report.schedule_residual_rows
    : [];
  residualList.innerHTML = residualRows.length
    ? residualRows
        .slice(0, 8)
        .map(
          (row) => `
            <div class="list-card">
              <div class="list-title">${row.period_name} · ${row.teacher_name}</div>
              <div class="list-meta">${row.course_date || "日期待确认"} ${row.start_time || ""} · ${row.issue_flags || "未识别问题"}</div>
              <div class="list-meta">班名 ${row.current_class_name || "未识别"} · 教室 ${row.current_classroom_name || "未填"}</div>
              ${row.recommended_manual_action ? `<div class="list-meta">建议：${row.recommended_manual_action}</div>` : ""}
            </div>
          `
        )
        .join("")
    : '<div class="empty-state">当前没有最终逐条尾项。</div>';

  const missingStatementRows = Array.isArray(report.compensation_missing_statement_rows)
    ? report.compensation_missing_statement_rows
    : [];
  const summaryOnlyRows = Array.isArray(report.compensation_summary_only_rows)
    ? report.compensation_summary_only_rows
    : [];
  settlementList.innerHTML = [
    missingStatementRows.length
      ? `
        <div class="list-card">
          <div class="list-title">缺结算汇总页</div>
          <div class="list-meta">当前 ${missingStatementRows.length} 个老师月份</div>
        </div>
      `
      : "",
    ...missingStatementRows.slice(0, 4).map(
      (row) => `
        <div class="list-card">
          <div class="list-title">${row.period_name} · ${row.teacher_name}</div>
          <div class="list-meta">来源 ${row.source_workbook_names || "未识别"} · 未关 ${row.schedule_review_unresolved_row_count || 0} 条</div>
          ${row.recommended_next_step ? `<div class="list-meta">${row.recommended_next_step}</div>` : ""}
        </div>
      `
    ),
    summaryOnlyRows.length
      ? `
        <div class="list-card">
          <div class="list-title">汇总型时间档板保留</div>
          <div class="list-meta">当前 ${summaryOnlyRows.length} 个老师月份</div>
        </div>
      `
      : "",
    ...summaryOnlyRows.slice(0, 4).map(
      (row) => `
        <div class="list-card">
          <div class="list-title">${row.period_name} · ${row.teacher_name}</div>
          <div class="list-meta">${row.sheet_kinds || "summary_only_slot_board"}</div>
          ${row.recommended_next_step ? `<div class="list-meta">${row.recommended_next_step}</div>` : ""}
        </div>
      `
    ),
  ].join("") || '<div class="empty-state">当前没有课时费结算缺口或汇总板保留项。</div>';

  const futurePolicyRows = Array.isArray(report.future_policy_pending_rows)
    ? report.future_policy_pending_rows
    : [];
  const blockingPolicyRows = Array.isArray(report.policy_blocking_rows)
    ? report.policy_blocking_rows
    : [];
  policyList.innerHTML = [
    futurePolicyRows.length
      ? `
        <div class="list-card">
          <div class="list-title">未来提成年度涨幅待补</div>
          <div class="list-meta">当前 ${futurePolicyRows.length} 位老师</div>
        </div>
      `
      : "",
    ...futurePolicyRows.slice(0, 6).map(
      (row) => `
        <div class="list-card">
          <div class="list-title">${row.teacher_name}</div>
          <div class="list-meta">${row.current_rule_display || "未识别规则"} · ${row.current_rule_source_label || "规则来源未识别"}</div>
          ${row.default_policy_periods_text ? `<div class="list-meta">默认覆盖：${row.default_policy_periods_text}</div>` : ""}
          ${row.recommended_next_step ? `<div class="list-meta">${row.recommended_next_step}</div>` : ""}
        </div>
      `
    ),
    blockingPolicyRows.length
      ? `
        <div class="list-card">
          <div class="list-title">提成规则硬阻塞</div>
          <div class="list-meta">当前 ${blockingPolicyRows.length} 位老师</div>
        </div>
      `
      : "",
    ...blockingPolicyRows.slice(0, 4).map(
      (row) => `
        <div class="list-card">
          <div class="list-title">${row.teacher_name}</div>
          <div class="list-meta">未来断档 ${row.missing_horizon_period_count || 0} 月 · 主规则重叠 ${row.overlap_rule_pair_count || 0} 组 · 重复覆盖 ${row.duplicate_override_scope_group_count || 0} 组</div>
          ${row.recommended_next_step ? `<div class="list-meta">${row.recommended_next_step}</div>` : ""}
        </div>
      `
    ),
  ].join("") || '<div class="empty-state">当前没有未来提成待补或规则硬阻塞项。</div>';

  const replyTemplateText = chatSheet.reply_template_text || "";
  const chatSheetNotes = Array.isArray(chatSheet.notes) ? chatSheet.notes : [];
  chatSheetList.innerHTML = [
    `
      <div class="list-card">
        <div class="list-title">当前待回答 ${chatSheet.summary?.total_question_count || 0} 项</div>
        <div class="list-meta">暑期 ${chatSheet.summary?.summer_pending_group_count || 0} / 春季班名 ${chatSheet.summary?.spring_class_question_count || 0} / 春季教室 ${chatSheet.summary?.spring_room_question_count || 0}</div>
      </div>
    `,
    ...chatSheetNotes.slice(0, 2).map(
      (note) => `
        <div class="list-card">
          <div class="list-meta">${note}</div>
        </div>
      `
    ),
    replyTemplateText
      ? `
        <div class="list-card">
          <div class="list-title">直接回复模板</div>
          <div class="list-meta preserve-lines"><code>${escapeHtml(replyTemplateText)}</code></div>
        </div>
      `
      : "",
  ].join("") || '<div class="empty-state">当前没有可展示的聊天答题卡。</div>';

  const applySummary = chatApply.summary || {};
  const appliedSummerRows = Array.isArray(chatApply.sections?.summer?.applied_rows)
    ? chatApply.sections.summer.applied_rows
    : [];
  const appliedClassRows = Array.isArray(chatApply.sections?.spring_class?.applied_rows)
    ? chatApply.sections.spring_class.applied_rows
    : [];
  const appliedRoomRows = Array.isArray(chatApply.sections?.spring_room?.applied_rows)
    ? chatApply.sections.spring_room.applied_rows
    : [];
  const applyNotes = Array.isArray(chatApply.notes) ? chatApply.notes : [];
  chatApplyList.innerHTML = [
    `
      <div class="list-card">
        <div class="list-title">${chatApply.status || "未运行"}</div>
        <div class="list-meta">回复文件 ${applySummary.answers_file_exists || 0} · 解析 ${applySummary.parsed_entry_count || 0} · 已回填 ${applySummary.applied_count || 0}</div>
        <div class="list-meta">未识别 key ${applySummary.unknown_key_count || 0} · 无效 ${applySummary.skipped_count || 0}</div>
      </div>
    `,
    ...applyNotes.slice(0, 2).map(
      (note) => `
        <div class="list-card">
          <div class="list-meta">${note}</div>
        </div>
      `
    ),
    ...appliedSummerRows.slice(0, 2).map(
      (row) => `
        <div class="list-card">
          <div class="list-title">暑期已回填</div>
          <div class="list-meta">${row.reply_key || "未识别 key"}</div>
        </div>
      `
    ),
    ...appliedClassRows.slice(0, 2).map(
      (row) => `
        <div class="list-card">
          <div class="list-title">春季班名已回填</div>
          <div class="list-meta">${row.reply_key || "未识别 key"} -> ${row.resolved_class_name || "未填"}</div>
        </div>
      `
    ),
    ...appliedRoomRows.slice(0, 2).map(
      (row) => `
        <div class="list-card">
          <div class="list-title">春季教室已回填</div>
          <div class="list-meta">${row.reply_key || "未识别 key"} -> ${row.resolved_classroom_name || "未填"}</div>
        </div>
      `
    ),
  ].join("") || '<div class="empty-state">当前没有自动回填记录。</div>';
}

function renderSummerScheduleSettlementPrep() {
  const summaryNode = document.getElementById("summerSettlementSummaryCards");
  const teacherList = document.getElementById("summerSettlementTeacherList");
  const classList = document.getElementById("summerSettlementClassList");
  const actionList = document.getElementById("summerSettlementActionList");
  const revenueTableBody = document.getElementById("summerRevenueTableBody");
  if (!summaryNode || !teacherList || !classList || !actionList || !revenueTableBody) {
    return;
  }

  const revenueRows = getSummerClassRevenueRows();
  const hasSummerPrepData =
    hasImportedSummerScheduleSettlementReport() || revenueRows.length > 0;
  if (!hasSummerPrepData) {
    const emptyHtml =
      '<div class="empty-state">导入 prototype-import-snapshot.json 或 summer-schedule-settlement-report.json 后，这里会直接显示真实暑期班的结算准备状态。</div>';
    const emptyTableHtml = `
      <tr>
        <td colspan="7">
          <div class="empty-state">导入暑期诊断快照后，这里会直接出现真实班级的单节收入模板，可边看边填。</div>
        </td>
      </tr>
    `;
    summaryNode.innerHTML = emptyHtml;
    teacherList.innerHTML = emptyHtml;
    classList.innerHTML = emptyHtml;
    actionList.innerHTML = emptyHtml;
    revenueTableBody.innerHTML = emptyTableHtml;
    return;
  }

  const report = state.summerScheduleSettlementReport;
  const reportSummary = report.summary || {};
  const excludedTeacherCount = Number(reportSummary.excluded_teacher_count || 0);
  const excludedClassCount = Number(reportSummary.excluded_class_count || 0);
  const excludedSessionCount = Number(reportSummary.excluded_session_count || 0);
  const reportNotes = Array.isArray(report.notes) ? report.notes : [];
  const hasExcludedOnlySummerScope =
    excludedTeacherCount > 0 &&
    !(Array.isArray(report.teacher_rows) && report.teacher_rows.length) &&
    !(Array.isArray(report.class_rows) && report.class_rows.length) &&
    revenueRows.length === 0;
  if (hasExcludedOnlySummerScope) {
    const summaryCards = [
      ["暑期结算老师", 0, "当前没有纳入结算链路的暑期老师"],
      ["暑期结算班级", 0, "当前没有纳入经营/结算链路的暑期班级"],
      ["已排除老师", excludedTeacherCount, "按暑期策略整体排除"],
      ["已排除班级", excludedClassCount, "不生成收入、结算和经营口径"],
      ["已排除课次", excludedSessionCount, "仅保留教室占用/锁房事实"],
    ];
    const excludedNote =
      reportNotes[0] ||
      `已按策略排除 ${excludedTeacherCount} 位老师、${excludedClassCount} 个班、${excludedSessionCount} 个课次。`;
    summaryNode.innerHTML = summaryCards
      .map(
        ([label, value, note]) => `
          <article class="metric-card">
            <div class="metric-label">${label}</div>
            <div class="metric-value metric-value-sm">${value}</div>
            <div class="metric-note">${note}</div>
          </article>
        `
      )
      .join("");
    teacherList.innerHTML = `<div class="empty-state">${excludedNote}</div>`;
    classList.innerHTML = `<div class="empty-state">${excludedNote}</div>`;
    actionList.innerHTML = `
      <div class="list-card">
        <div class="list-title">当前暑期大班不进系统业务链路</div>
        <div class="list-meta">${excludedNote}</div>
      </div>
      <div class="list-card">
        <div class="list-title">仍保留教室占用事实</div>
        <div class="list-meta">这些暑期大班仍会出现在暑期大班锁房/教室占用报告里，但不会进入学生录入、班级收入、老师结算或经营毛利链路。</div>
      </div>
    `;
    revenueTableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">当前暑期班已按策略整体排除，不生成 <code>summer-class-revenue-template.csv</code> 收入模板。</div>
        </td>
      </tr>
    `;
    return;
  }
  const revenueRowMap = buildSummerClassRevenueRowMap();
  const teacherProjectionScenario = buildSummerTeacherProjectionScenario(
    report,
    revenueRows
  );
  const classProjectionMap = buildSummerClassProjectionMap(
    report,
    revenueRows,
    teacherProjectionScenario
  );
  const filledRevenueRows = revenueRows.filter(
    (row) => String(row.estimatedSessionRevenue || "").trim() !== ""
  );
  const filledRevenueRowCount = filledRevenueRows.length;
  const blankRevenueRowCount = Math.max(revenueRows.length - filledRevenueRowCount, 0);
  const resolvedRevenueRowCount = revenueRows.filter(
    (row) => String(row.resolutionStatus || "").trim() !== ""
  ).length;
  const enteredRevenueTotal = roundAmount(
    filledRevenueRows.reduce(
      (sum, row) =>
        sum +
        toNumber(row.estimatedSessionRevenue) * Number(row.teachingSessionCount || 0),
      0
    )
  );
  const suggestedRevenueTotal = roundAmount(
    revenueRows.reduce(
      (sum, row) =>
        sum +
        toNumber(row.suggestedSessionRevenue) * Number(row.teachingSessionCount || 0),
      0
    )
  );
  const mixedRevenueTotal = roundAmount(
    revenueRows.reduce((sum, row) => {
      const sessionRevenue =
        String(row.estimatedSessionRevenue || "").trim() !== ""
          ? toNumber(row.estimatedSessionRevenue)
          : toNumber(row.suggestedSessionRevenue);
      return sum + sessionRevenue * Number(row.teachingSessionCount || 0);
    }, 0)
  );
  const mixedProjectedAmountTotal =
    teacherProjectionScenario.summary.mixedProjectedAmountTotal;
  const actualProjectedAmountTotal =
    teacherProjectionScenario.summary.actualProjectedAmountTotal;
  const mixedGrossMarginTotal = roundAmount(
    mixedRevenueTotal - mixedProjectedAmountTotal
  );
  const actualGrossMarginTotal = roundAmount(
    enteredRevenueTotal - actualProjectedAmountTotal
  );
  const teacherCount =
    Number(reportSummary.teacher_count || 0) ||
    new Set(
      revenueRows.flatMap((row) => parseLooseStringArray(row.teacherNamesText))
    ).size;
  const classCount =
    revenueRows.length ||
    Number(reportSummary.class_count || 0) ||
    (Array.isArray(report.class_rows) ? report.class_rows.length : 0);
  const classesBelowTargetCount =
    Number(reportSummary.classes_below_target_count || 0) ||
    revenueRows.filter(
      (row) =>
        Number(row.targetTeachingSessionCount || 0) >
        Number(row.teachingSessionCount || 0)
    ).length;
  const teacherRows = Array.isArray(report.teacher_rows)
    ? [...report.teacher_rows].sort((left, right) => {
        const statusDiff =
          summerScheduleStatusWeight(left.status) -
          summerScheduleStatusWeight(right.status);
        if (statusDiff) {
          return statusDiff;
        }
        const missingRevenueDiff =
          Number(right.revenue_input_required_row_count || 0) -
          Number(left.revenue_input_required_row_count || 0);
        if (missingRevenueDiff) {
          return missingRevenueDiff;
        }
        return (
          Number(right.suggested_projected_amount_total || 0) -
            Number(left.suggested_projected_amount_total || 0) ||
          String(left.teacher_name || "").localeCompare(
            String(right.teacher_name || ""),
            "zh-CN"
          )
        );
      })
    : [];
  const classRowsSource = Array.isArray(report.class_rows) ? report.class_rows : [];
  const classRows = (classRowsSource.length
    ? classRowsSource
    : revenueRows.map((row) => ({
        class_name: row.className,
        teacher_names_text: row.teacherNamesText,
        teaching_session_count: row.teachingSessionCount,
        target_teaching_session_count: row.targetTeachingSessionCount,
        missing_to_target_session_count: Math.max(
          Number(row.targetTeachingSessionCount || 0) -
            Number(row.teachingSessionCount || 0),
          0
        ),
        suggested_session_revenue: row.suggestedSessionRevenue,
        estimated_session_revenue: row.estimatedSessionRevenue,
        course_type: row.courseType,
        current_size: row.currentSize,
        planned_size: row.plannedSize,
        coverage_status: row.estimatedSessionRevenue
          ? "projectable"
          : "revenue_input_required",
        notes: row.notes ? [row.notes] : [],
      })))
    .slice()
    .sort((left, right) => {
        const statusDiff =
          summerScheduleStatusWeight(left.coverage_status) -
          summerScheduleStatusWeight(right.coverage_status);
        if (statusDiff) {
          return statusDiff;
        }
        const targetGapDiff =
          Number(right.missing_to_target_session_count || 0) -
          Number(left.missing_to_target_session_count || 0);
        if (targetGapDiff) {
          return targetGapDiff;
        }
        return (
          Number(right.suggested_session_revenue || 0) -
            Number(left.suggested_session_revenue || 0) ||
          String(left.class_name || "").localeCompare(String(right.class_name || ""), "zh-CN")
        );
      });

  const summaryCards = [
    ["暑期老师", teacherCount, "真实暑期排课已识别的授课老师"],
    ["暑期班级", classCount, "已进入暑期排课-结算准备链路"],
    [
      "模板填写进度",
      `${filledRevenueRowCount}/${revenueRows.length || classCount || 0}`,
      `空白 ${blankRevenueRowCount} 行 · 已标状态 ${resolvedRevenueRowCount} 行`,
    ],
    [
      "按模板填写收入",
      formatCompactCurrency(enteredRevenueTotal),
      `已填班级老师结算 ${formatCompactCurrency(actualProjectedAmountTotal)} · 毛结余 ${formatCompactCurrency(actualGrossMarginTotal)}`,
    ],
    [
      "混合口径收入",
      formatCompactCurrency(mixedRevenueTotal),
      "已填班级按真实值，未填班级沿用建议值",
    ],
    [
      "混合口径老师结算",
      formatCompactCurrency(mixedProjectedAmountTotal),
      `可投影老师 ${teacherProjectionScenario.summary.teacherWithRatioCount}/${teacherProjectionScenario.summary.teacherCount} 人`,
    ],
    [
      "混合口径毛结余",
      formatCompactCurrency(mixedGrossMarginTotal),
      "班级收入减老师结算预估，可先做暑期经营口径",
    ],
    [
      "导入建议基线",
      formatCompactCurrency(reportSummary.suggested_projected_amount_total || 0),
      `建议收入 ${formatCompactCurrency(
        suggestedRevenueTotal || Number(reportSummary.suggested_estimated_revenue_total || 0)
      )}`,
    ],
    [
      "未达日目标",
      reportSummary.teachers_under_daily_target_count || 0,
      `累计差 ${reportSummary.teacher_missing_to_target_slot_total || 0} 节 · 超日上限 ${reportSummary.teachers_over_daily_cap_count || 0}`,
    ],
    [
      "未满 15 次",
      classesBelowTargetCount,
      `晚课违规 ${reportSummary.teachers_with_evening_violation_count || 0} · 缺收入 ${reportSummary.missing_revenue_class_count || 0}`,
    ],
  ];
  summaryNode.innerHTML = summaryCards
    .map(
      ([label, value, note]) => `
        <article class="metric-card">
          <div class="metric-label">${label}</div>
          <div class="metric-value metric-value-sm">${value}</div>
          <div class="metric-note">${note}</div>
        </article>
      `
    )
    .join("");

  teacherList.innerHTML = teacherRows.length
    ? teacherRows
        .slice(0, 8)
        .map(
          (row) => {
            const projection = teacherProjectionScenario.rows.find(
              (item) => item.teacherName === row.teacher_name
            );
            const projectionMeta = projection?.hasProjectionRatio
              ? `本地混合测算 ${formatAmountText(
                  projection.mixedProjectedAmountTotal
                )} · 差额 ${formatSignedAmountText(
                  projection.mixedProjectedAmountDelta
                )}`
              : "当前无法从导入基线反推本地老师结算比例";
            const actualProjectionMeta =
              projection?.hasProjectionRatio && projection.filledClassCount
                ? `已填班级结算 ${formatAmountText(
                    projection.actualProjectedAmountTotal
                  )} · 已填 ${projection.filledClassCount}/${projection.totalClassCount} 个班`
                : `已填 ${projection?.filledClassCount || 0}/${projection?.totalClassCount || row.class_count || 0} 个班`;
            const ratioMeta =
              projection?.projectionRatio !== null
                ? `有效分成 ${formatRatioPercent(
                    projection.projectionRatio
                  )} · ${projection.projectionStatus}`
                : projection?.projectionStatus || "待补规则";
            return `
              <div class="list-card">
                <div class="list-title">${row.teacher_name} · ${formatScheduleSettlementStatus(row.status)}</div>
                <div class="list-meta">班级 ${row.class_count || 0} · 老师课次 ${row.schedule_row_count || 0} · 上课日 ${row.teaching_date_count || 0} · 单日峰值 ${row.max_daily_slot_count || 0}/${row.target_lessons_per_day || row.max_lessons_per_day || 0} · 未达目标日 ${row.under_target_teaching_date_count || 0} · 日缺口 ${row.missing_to_target_slot_count || 0}</div>
                <div class="list-meta">导入建议结算 ${formatAmountText(row.suggested_projected_amount_total)} · ${projectionMeta}</div>
                <div class="list-meta">${actualProjectionMeta} · ${ratioMeta}</div>
                ${Array.isArray(row.notes) && row.notes.length ? `<div class="list-meta">${row.notes.slice(0, 2).join("；")}</div>` : ""}
              </div>
            `;
          }
        )
        .join("")
    : '<div class="empty-state">当前没有暑期老师结算准备数据。</div>';

  classList.innerHTML = classRows.length
    ? classRows
        .slice(0, 10)
        .map((row) => {
          const revenueRow = revenueRowMap.get(row.class_name || "");
          const classProjection = classProjectionMap.get(row.class_name || "");
          const localRevenue =
            revenueRow?.estimatedSessionRevenue || row.estimated_session_revenue || "";
          const revenueText = localRevenue
            ? `已填 ${formatAmountText(localRevenue)}`
            : `待填写（建议 ${formatAmountText(row.suggested_session_revenue)}）`;
          const templateHint = revenueRow?.estimatedSessionRevenue
            ? " · 模板已填"
            : "";
          const projectionText = classProjection?.projectionSupported
            ? `混合结算 ${formatAmountText(
                classProjection.mixedProjectedAmountTotal
              )} · 毛结余 ${formatAmountText(classProjection.mixedGrossMargin)}${
                classProjection.hasActualRevenue ? "" : " · 未填班级沿用建议"
              }`
            : "当前无法完整估算该班老师结算 / 毛结余";
          return `
            <div class="list-card">
              <div class="list-title">${row.class_name} · ${formatScheduleSettlementStatus(row.coverage_status)}${templateHint}</div>
              <div class="list-meta">老师 ${row.teacher_names_text || "未识别"} · 实际 ${row.teaching_session_count || 0}/${row.target_teaching_session_count || 0} 次 · 差 ${row.missing_to_target_session_count || 0} 次</div>
              <div class="list-meta">单节收入 ${revenueText} · 班型 ${row.course_type || "未识别"} · 当前人数 ${row.current_size || row.planned_size || "—"}</div>
              <div class="list-meta">${projectionText}</div>
              ${Array.isArray(row.notes) && row.notes.length ? `<div class="list-meta">${row.notes.slice(0, 2).join("；")}</div>` : ""}
            </div>
          `;
        })
        .join("")
    : '<div class="empty-state">当前没有暑期班级结算准备数据。</div>';

  const actionCards = [
    `
      <div class="list-card">
        <div class="list-title">先补单节收入模板</div>
        <div class="list-meta">当前还有 ${blankRevenueRowCount} 个班缺单节收入。先填完 <code>summer-class-revenue-template.csv</code>，暑期老师结算才能从“规则覆盖”进入“真实测算”。</div>
      </div>
    `,
    `
      <div class="list-card">
        <div class="list-title">建议值可先做经营预估</div>
        <div class="list-meta">即使还没填真实单节收入，系统也已经给出建议预估收入 ${formatAmountText(suggestedRevenueTotal)}、建议预估老师结算 ${formatAmountText(reportSummary.suggested_projected_amount_total)}。</div>
      </div>
    `,
    `
      <div class="list-card">
        <div class="list-title">本地模板会同步推演老师结算</div>
        <div class="list-meta">这张表里新填的单节收入，会立刻更新已填班级收入、老师结算预估和教学毛结余；正式产物仍以重新跑 <code>build_summer_schedule_settlement_report.py</code> 为准。</div>
      </div>
    `,
  ];
  if (filledRevenueRowCount > 0) {
    actionCards.push(`
      <div class="list-card">
        <div class="list-title">已填模板收入合计</div>
        <div class="list-meta">当前已录入 ${filledRevenueRowCount} 个班，按已导入课次汇总班级收入 ${formatAmountText(enteredRevenueTotal)}、老师结算 ${formatAmountText(actualProjectedAmountTotal)}、教学毛结余 ${formatAmountText(actualGrossMarginTotal)}。</div>
      </div>
    `);
  }
  if (teacherProjectionScenario.summary.teacherWithRatioCount > 0) {
    actionCards.push(`
      <div class="list-card">
        <div class="list-title">混合口径老师结算已可先看</div>
        <div class="list-meta">当前 ${teacherProjectionScenario.summary.teacherWithRatioCount} 位老师可按导入暑期规则反推有效比例，本地混合测算老师结算 ${formatAmountText(mixedProjectedAmountTotal)}、教学毛结余 ${formatAmountText(mixedGrossMarginTotal)}。</div>
      </div>
    `);
  }
  if (classesBelowTargetCount > 0) {
    actionCards.push(`
      <div class="list-card">
        <div class="list-title">补满 15 次模板</div>
        <div class="list-meta">当前还有 ${classesBelowTargetCount} 个班没满 15 次课，建议先确认是确实短课，还是还没把剩余课次补进真实排课源。</div>
      </div>
    `);
  }
  if (
    Number(reportSummary.teachers_over_daily_cap_count || 0) === 0 &&
    Number(reportSummary.teachers_with_evening_violation_count || 0) === 0
  ) {
    actionCards.push(`
      <div class="list-card">
        <div class="list-title">当前无硬规则冲突</div>
        <div class="list-meta">这批真实暑期排课目前没有超日上限，也没有晚课限制违规，可以优先把收入口径和班级节次补齐。</div>
      </div>
    `);
  }
  actionList.innerHTML = actionCards.join("");

  revenueTableBody.innerHTML = revenueRows.length
    ? revenueRows
        .map((row) => {
          const subjectMeta = formatOption(row.subject || "") || row.subject || "";
          const gradeMeta = row.grade ? `${row.grade}年级` : "";
          const typeMeta = formatOption(row.courseType || "") || row.courseType || "";
          const metaParts = [subjectMeta, gradeMeta, typeMeta].filter(Boolean).join(" · ");
          const sizeText = row.currentSize || row.plannedSize || "—";
          const statusPlaceholder = row.estimatedSessionRevenue
            ? "已填写"
            : "待确认 / 沿用建议";
          return `
            <tr>
              <td>
                <div class="list-title">${row.className || "未命名班级"}</div>
                <div class="list-meta">${metaParts || "未识别科目/年级/班型"}</div>
                <div class="list-meta">当前人数 ${sizeText}</div>
              </td>
              <td>
                <div class="list-title">${row.teacherNamesText || "未识别"}</div>
                <div class="list-meta">建议来源 ${row.suggestedRevenueSource || "—"}</div>
              </td>
              <td>
                <div class="list-title">${row.teachingSessionCount || 0}/${row.targetTeachingSessionCount || 0}</div>
                <div class="list-meta">当前已导入/目标课次</div>
              </td>
              <td>
                <input
                  class="cell-input"
                  type="text"
                  inputmode="decimal"
                  value="${escapeAttribute(row.estimatedSessionRevenue || "")}"
                  placeholder="${escapeAttribute(String(row.suggestedSessionRevenue || ""))}"
                  data-entity="summerClassRevenue"
                  data-index="${row._stateIndex ?? 0}"
                  data-field="estimatedSessionRevenue"
                >
                <div class="list-meta">已填后按当前课次汇总经营收入</div>
              </td>
              <td>
                <div class="list-title">${formatAmountText(row.suggestedSessionRevenue)}</div>
                <div class="list-meta">单价 ${formatAmountText(row.suggestedUnitFee)} · 样本 ${row.suggestionSampleCount || 0}</div>
              </td>
              <td>
                <input
                  class="cell-input"
                  type="text"
                  value="${escapeAttribute(row.resolutionStatus || "")}"
                  placeholder="${statusPlaceholder}"
                  data-entity="summerClassRevenue"
                  data-index="${row._stateIndex ?? 0}"
                  data-field="resolutionStatus"
                >
              </td>
              <td>
                <input
                  class="cell-input"
                  type="text"
                  value="${escapeAttribute(row.notes || "")}"
                  placeholder="备注"
                  data-entity="summerClassRevenue"
                  data-index="${row._stateIndex ?? 0}"
                  data-field="notes"
                >
              </td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="7">
          <div class="empty-state">当前还没有可填写的暑期单节收入模板。</div>
        </td>
      </tr>
    `;
}

function renderFinancialPeriods() {
  const body = document.getElementById("financialPeriodTableBody");
  const summary = document.getElementById("profitSummaryCards");
  const ruleList = document.getElementById("dividendRuleList");
  const periodSelect = document.getElementById("financialPeriodViewSelect");
  const expenseList = document.getElementById("profitExpenseList");
  const profitSettlementDividendList = document.getElementById("profitSettlementDividendList");
  if (!body || !summary || !ruleList || !periodSelect || !expenseList) {
    return;
  }

  const periods = state.financialPeriods
    .map((period, index) => ({ period, index }))
    .sort((left, right) => left.period.periodName.localeCompare(right.period.periodName, "zh-CN"));
  body.innerHTML = periods
    .map(({ period, index }) => {
      const fields = FIELD_CONFIG.financialPeriod
        .map((field) => renderCell("financialPeriod", period, index, field))
        .join("");
      const financial = calculateFinancialSummary(period);
      return `
        <tr>
          ${fields}
          <td>${financial.dividendRate > 0 ? formatPercent(financial.dividendRate) : "未生效"}</td>
          <td>${formatCurrency(financial.dividendPool)}</td>
          <td>${formatCurrency(financial.retainedProfit)}</td>
          <td><button class="icon-button" data-remove="financialPeriod" data-index="${index}">×</button></td>
        </tr>
      `;
    })
    .join("");

  const selectedPeriodName = resolveFinancialPeriodView(periods.map((item) => item.period.periodName));
  periodSelect.innerHTML = periods.length
    ? periods
        .map(
          ({ period }) =>
            `<option value="${period.periodName}" ${period.periodName === selectedPeriodName ? "selected" : ""}>${period.periodName}</option>`
        )
        .join("")
    : "";
  periodSelect.value = selectedPeriodName;

  const selectedPeriod = periods.find((item) => item.period.periodName === selectedPeriodName)?.period || null;
  const selectedFinancial = selectedPeriod ? calculateFinancialSummary(selectedPeriod) : null;
  const cards = selectedFinancial
    ? [
        ["当前月份", selectedFinancial.periodName, "按录入月份自动识别分红比例"],
        ["净利润", formatCurrency(selectedFinancial.netProfit), "扣除费用后的月度净利润"],
        ["本月分红池", formatCurrency(selectedFinancial.dividendPool), `${formatPercent(selectedFinancial.dividendRate)} 自动计算`],
        ["留存利润", formatCurrency(selectedFinancial.retainedProfit), "净利润减去当月分红池"],
      ]
    : [
        ["当前月份", "待录入", "先录月度利润数据"],
        ["净利润", "0", "录入后自动汇总"],
        ["本月分红池", "0", "2026-05 起按规则计算"],
        ["留存利润", "0", "分红后自动结转"],
      ];

  summary.innerHTML = cards
    .map(
      ([label, value, note]) => `
        <article class="metric-card">
          <div class="metric-label">${label}</div>
          <div class="metric-value metric-value-sm">${value}</div>
          <div class="metric-note">${note}</div>
        </article>
      `
    )
    .join("");

  const expenseRows = getProfitExpenseRowsForPeriod(selectedPeriodName);
  expenseList.innerHTML = expenseRows.length
    ? expenseRows
        .map(
          (row) => `
            <div class="list-card">
              <div class="list-title">${row.categoryName}</div>
              <div class="list-meta">${formatAmountText(row.amountRaw)} · ${formatExpenseScope(row.expenseScope)}</div>
              ${row.notes ? `<div class="list-meta">${row.notes}</div>` : ""}
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">${selectedPeriodName ? `${selectedPeriodName} 还没有导入费用明细。` : "先录入利润月份和费用明细。"}</div>`;

  ruleList.innerHTML = buildDividendRulePreview(periods.map((item) => item.period))
    .map(
      (item) => `
        <div class="list-card">
          <div class="list-title">${item.periodName}</div>
          <div class="list-meta">${formatPercent(item.rate)} · ${item.note}</div>
        </div>
      `
    )
    .join("");

  if (profitSettlementDividendList) {
    profitSettlementDividendList.innerHTML = buildProfitSettlementDividendHtml(selectedPeriodName);
  }
}

function renderSettlementCenter() {
  const periodSelect = document.getElementById("settlementPeriodSelect");
  const teacherSelect = document.getElementById("settlementTeacherSelect");
  const body = document.getElementById("settlementTableBody");
  const summary = document.getElementById("settlementSummaryCards");
  const lineSummaryList = document.getElementById("settlementLineSummaryList");
  const lineList = document.getElementById("settlementLineList");
  const overrideList = document.getElementById("settlementOverrideList");
  const profitLink = document.getElementById("settlementProfitLink");
  const reviewSummaryList = document.getElementById("settlementReviewSummaryList");
  const compensationReadinessList = document.getElementById(
    "settlementCompensationReadinessList"
  );
  const settlementImportWavePackageList = document.getElementById(
    "settlementImportWavePackageList"
  );
  const settlementImportDeferredActionList = document.getElementById(
    "settlementImportDeferredActionList"
  );
  const settlementImportExecutionList = document.getElementById(
    "settlementImportExecutionList"
  );
  const settlementOpsActionList = document.getElementById("settlementOpsActionList");
  const profileList = document.getElementById("settlementProfileList");
  const teacherCompensationPolicyList = document.getElementById(
    "settlementTeacherCompensationPolicyList"
  );
  const teacherRuleItemResolutionList = document.getElementById(
    "settlementTeacherRuleItemResolutionList"
  );
  const ruleBackfillList = document.getElementById("settlementRuleBackfillList");
  const teacherReviewList = document.getElementById("settlementTeacherReviewList");
  const slotSummaryList = document.getElementById("settlementSlotSummaryList");
  if (
    !periodSelect ||
    !teacherSelect ||
    !body ||
    !summary ||
    !lineSummaryList ||
    !lineList ||
    !overrideList ||
    !profitLink ||
    !reviewSummaryList ||
    !compensationReadinessList ||
    !settlementImportWavePackageList ||
    !settlementImportDeferredActionList ||
    !settlementImportExecutionList ||
    !settlementOpsActionList ||
    !profileList ||
    !teacherCompensationPolicyList ||
    !teacherRuleItemResolutionList ||
    !ruleBackfillList ||
    !teacherReviewList ||
    !slotSummaryList
  ) {
    return;
  }

  const periods = getSettlementPeriods();
  if (!periods.length) {
    periodSelect.innerHTML = "";
    body.innerHTML = `<tr><td colspan="10" class="empty-state">还没有老师月结算数据。</td></tr>`;
    summary.innerHTML = "";
    teacherSelect.innerHTML = "";
    lineSummaryList.innerHTML = `<div class="empty-state">先选择有结算数据的月份。</div>`;
    lineList.innerHTML = `<div class="empty-state">导入真实结算明细后，这里会显示学生级明细。</div>`;
    overrideList.innerHTML = `<div class="empty-state">先导入老师月结算相关 CSV。</div>`;
    profitLink.innerHTML = `<div class="empty-state">录入利润月份后，这里会联动显示净利润和分红池。</div>`;
    reviewSummaryList.innerHTML = `<div class="empty-state">导入桥接或对账 JSON 后，这里会显示每月复核摘要。</div>`;
    compensationReadinessList.innerHTML = `<div class="empty-state">导入课时费导入就绪报告后，这里会显示工资表按月接入状态。</div>`;
    settlementImportWavePackageList.innerHTML = `<div class="empty-state">导入结算导入分波包后，这里会显示当前老师月份已经落入哪一个 SQL 包。</div>`;
    settlementImportDeferredActionList.innerHTML = `<div class="empty-state">导入结算延期清零包后，这里会显示当前老师月份应该先处理哪些批量/逐条清零动作。</div>`;
    settlementImportExecutionList.innerHTML = `<div class="empty-state">导入结算导入执行波次后，这里会显示当前月份应先迁移哪一批老师。</div>`;
    settlementOpsActionList.innerHTML = `<div class="empty-state">导入排课-结算动作总表后，这里会显示当前月份应该先处理哪位老师、先开哪个文件。</div>`;
    profileList.innerHTML = `<div class="empty-state">导入老师结算画像报告后，这里会显示迁移就绪情况。</div>`;
    teacherCompensationPolicyList.innerHTML = `<div class="empty-state">导入老师提成政策覆盖报告后，这里会显示当前老师的历史规则、未来默认 20% 规则和重复覆盖项风险。</div>`;
    teacherRuleItemResolutionList.innerHTML = `<div class="empty-state">导入老师覆盖项冲突清理模板后，这里会显示当前老师同范围重复覆盖项应保留哪个比例。</div>`;
    ruleBackfillList.innerHTML = `<div class="empty-state">导入主规则回填建议后，这里会显示当前月份可直接补录的规则建议。</div>`;
    teacherReviewList.innerHTML = `<div class="empty-state">导入诊断后，这里会显示当前老师的课表-结算异常说明。</div>`;
    slotSummaryList.innerHTML = `<div class="empty-state">当前没有汇总型时间档板数据。</div>`;
    return;
  }

  const selectedPeriod = resolveSettlementPeriod(periods);
  periodSelect.innerHTML = periods
    .map((period) => `<option value="${period}" ${period === selectedPeriod ? "selected" : ""}>${period}</option>`)
    .join("");
  periodSelect.value = selectedPeriod;

  const rows = getSettlementRowsForPeriod(selectedPeriod);
  const slotSummaryBoards = getCompensationSlotSummaryBoards(selectedPeriod);
  const teacherNames = [
    ...new Set(
      [
        ...rows.map((row) => row.teacherName),
        ...slotSummaryBoards.map((item) => item.ownerTeacherName),
        ...getSettlementReviewFollowupRowsForPeriod(selectedPeriod).map(
          (item) => item.teacher_name
        ),
        ...(state.settlementReviewQueue?.review_queue || [])
          .filter((item) => item.period_name === selectedPeriod)
          .map((item) => item.teacher_name),
        ...(state.teacherSettlementProfileReport?.teacher_profiles || [])
          .filter((item) => item.period_name === selectedPeriod)
          .map((item) => item.teacher_name),
        ...getCompensationImportReadinessTeacherRowsForPeriod(selectedPeriod).map(
          (item) => item.teacher_name
        ),
        ...getSettlementImportWaveTeacherNamesForPeriod(selectedPeriod),
        ...getSettlementImportDeferredActionTeacherNamesForPeriod(selectedPeriod),
        ...getSettlementImportExecutionRowsForPeriod(selectedPeriod).map(
          (item) => item.teacher_name
        ),
        ...getSettlementOpsActionRowsForPeriod(selectedPeriod).map(
          (item) => item.teacher_name
        ),
        ...(state.teacherCompensationPolicyReport?.period_rows || [])
          .filter((item) => item.period_name === selectedPeriod)
          .map((item) => item.teacher_name),
        ...(state.teacherCompensationPolicyReport?.teacher_rows || []).map(
          (item) => item.teacher_name
        ),
        ...(state.teacherRuleItemResolutionTemplate?.rows || [])
          .filter(
            (item) => String(item.effective_start_date || "").slice(0, 7) === selectedPeriod
          )
          .map((item) => item.teacher_name),
        ...(state.teacherRuleBackfillTemplate?.rows || [])
          .filter((item) => item.target_period_name === selectedPeriod)
          .map((item) => item.teacher_name),
      ].filter(Boolean)
    ),
  ].sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
  const selectedTeacher = resolveSettlementTeacher(teacherNames);
  const selectedStatement = rows.find((row) => row.teacherName === selectedTeacher) || null;
  const detailRows = getSettlementLineRowsForTeacher(selectedPeriod, selectedTeacher);
  const selectedSlotSummaryBoard =
    slotSummaryBoards.find((item) => item.ownerTeacherName === selectedTeacher) || null;
  const sourceLabel = shouldUseHistoricalSettlementSamples()
    ? "历史结算样例"
    : hasImportedSettlementData()
      ? "标准 CSV 导入数据"
      : "导入诊断上下文";
  const selectedBridgePeriodReport = getBridgePeriodReport(selectedPeriod);
  const selectedBridgeTeacherReport = getBridgeTeacherReport(selectedPeriod, selectedTeacher);
  const selectedReconciliationPeriodSummary = getSettlementReconciliationPeriodSummary(selectedPeriod);
  const selectedReconciliationTeacherReport = getSettlementReconciliationTeacherReport(
    selectedPeriod,
    selectedTeacher
  );
  const selectedProfitReconciliationPeriod = getProfitReconciliationPeriod(selectedPeriod);
  const periodMismatchCount = getSettlementReconciliationMismatchCount(selectedPeriod);
  const selectedReviewQueuePeriodSummary = getSettlementReviewQueuePeriodSummary(selectedPeriod);
  const selectedReviewQueueRow = getSettlementReviewQueueRow(selectedPeriod, selectedTeacher);
  const selectedReviewFollowupRows = getSettlementReviewFollowupRowsForPeriod(selectedPeriod);
  const selectedReviewFollowupRow = getSettlementReviewFollowupRow(
    selectedPeriod,
    selectedTeacher
  );
  const reviewResolutionRows = getSettlementReviewResolutionRowsForPeriod(selectedPeriod);
  const selectedReviewResolutionRow = getSettlementReviewResolutionRow(
    selectedPeriod,
    selectedTeacher
  );
  const selectedProfilePeriodSummary = getTeacherSettlementProfilePeriodSummary(selectedPeriod);
  const selectedTeacherProfile = getTeacherSettlementProfile(selectedPeriod, selectedTeacher);
  const selectedCompensationReadinessPeriodRow =
    getCompensationImportReadinessPeriodRow(selectedPeriod);
  const selectedCompensationReadinessTeacherRow =
    getCompensationImportReadinessTeacherRow(selectedPeriod, selectedTeacher);
  const selectedSettlementImportWavePackages =
    getSettlementImportWavePackagesForTeacherPeriod(selectedPeriod, selectedTeacher);
  const selectedSettlementImportWaveProfitPeriodRow =
    getSettlementImportWaveProfitPeriodRow(selectedPeriod);
  const selectedSettlementImportWaveDeferredRow =
    getSettlementImportWaveDeferredRow(selectedPeriod, selectedTeacher);
  const selectedSettlementImportDeferredActionPackage =
    getSettlementImportDeferredActionPackage(selectedPeriod, selectedTeacher);
  const selectedSettlementImportExecutionPeriodRow =
    getSettlementImportExecutionPeriodRow(selectedPeriod);
  const selectedSettlementImportExecutionTeacherRow =
    getSettlementImportExecutionTeacherRow(selectedPeriod, selectedTeacher);
  const selectedSettlementOpsActionPeriodRow =
    getSettlementOpsActionPeriodRow(selectedPeriod);
  const selectedSettlementOpsActionTeacherRow =
    getSettlementOpsActionTeacherRow(selectedPeriod, selectedTeacher);
  const selectedRuleBackfillRows = getTeacherRuleBackfillRowsForPeriod(selectedPeriod);
  const selectedRuleBackfillRow = getTeacherRuleBackfillRow(selectedPeriod, selectedTeacher);
  const teacherCompensationPolicySummary = getTeacherCompensationPolicySummary();
  const selectedTeacherCompensationPolicyRow =
    getTeacherCompensationPolicyTeacherRow(selectedTeacher);
  const selectedTeacherCompensationPolicyPeriodRow =
    getTeacherCompensationPolicyPeriodRow(selectedPeriod, selectedTeacher);
  const teacherRuleItemResolutionSummary = getTeacherRuleItemResolutionSummary();
  const selectedTeacherRuleItemResolutionRows =
    getTeacherRuleItemResolutionRowsForTeacherPeriod(selectedPeriod, selectedTeacher);
  const selectedTeacherRuleItemResolutionRowsAll =
    getTeacherRuleItemResolutionRowsForTeacher(selectedTeacher);

  teacherSelect.innerHTML = teacherNames
    .map(
      (teacherName) =>
        `<option value="${teacherName}" ${teacherName === selectedTeacher ? "selected" : ""}>${teacherName}</option>`
    )
    .join("");
  teacherSelect.value = selectedTeacher;

  body.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              <td>${row.teacherName}</td>
              <td>${row.revenueTotalRaw || "—"}</td>
              <td>${row.mainRatio ? formatRatioPercent(row.mainRatio) : "未识别"}</td>
              <td>${formatCurrencyOrDash(row.baseSalaryAmount)}</td>
              <td>${formatCurrencyOrDash(row.teachingCommissionAmount)}</td>
              <td>${formatCurrencyOrDash(row.makeupCommissionAmount)}</td>
              <td>${formatCurrencyOrDash(row.socialInsuranceAmount)}</td>
              <td>${formatCurrencyOrDash(row.housingFundAmount)}</td>
              <td>${row.freeSlotCount}</td>
              <td>${row.balanceAmountRaw || "—"}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="10" class="empty-state">这个月份还没有导入老师结算汇总，但右侧仍可先查看课时费接入状态和复核诊断。</td></tr>`;

  const summaryCards = [
    ["老师结算人数", rows.length, `${selectedPeriod} ${sourceLabel}`],
    ["课时总收入", formatCompactCurrency(sumBy(rows, "revenueTotalRaw")), "按工资表汇总页口径合并"],
    ["课时提成", formatCompactCurrency(sumBy(rows, "teachingCommissionAmount")), "老师月度教学提成合计"],
    ["补课提成", formatCompactCurrency(sumBy(rows, "makeupCommissionAmount")), "单独保留补课提成项"],
    ["免费时间档", `${sumBy(rows, "freeSlotCount")} 条`, "保留不计费但占时段的记录"],
    ["汇总型时间档板", `${slotSummaryBoards.length} 人`, "保留没有学生级明细的特殊历史老师页"],
    [
      "桥接待复核",
      selectedBridgePeriodReport ? `${selectedBridgePeriodReport.summary.teachers_needing_review} 人` : "未导入",
      selectedBridgePeriodReport ? "课表、名册、结算三方核对" : "导入桥接报告后显示",
    ],
    [
      "结算差额待复核",
      hasImportedReconciliationReport() ? `${periodMismatchCount} 人` : "未导入",
      hasImportedReconciliationReport() ? "按老师月结算汇总与明细对账" : "导入对账报告后显示",
    ],
    [
      "复核已关闭",
      reviewResolutionRows.length
        ? `${countResolutionStatus(reviewResolutionRows, "resolved")}/${reviewResolutionRows.length}`
        : "未导入",
      reviewResolutionRows.length ? "当前月份已写回的复核结果" : "导入结算复核结果后显示",
    ],
    [
      "自动迁移就绪",
      selectedProfilePeriodSummary
        ? `${selectedProfilePeriodSummary.ready_for_rule_migration_count}/${selectedProfilePeriodSummary.teacher_count}`
        : "未导入",
      selectedProfilePeriodSummary ? "老师-月份画像评估结果" : "导入画像报告后显示",
    ],
    [
      "未来规则待确认",
      hasImportedTeacherCompensationPolicyReport()
        ? `${teacherCompensationPolicySummary?.future_default_pending_teacher_count || 0} 人`
        : "未导入",
      hasImportedTeacherCompensationPolicyReport()
        ? "这些老师先按默认 20%，后续再补满一年涨幅"
        : "导入提成政策覆盖报告后显示",
    ],
    [
      "政策硬阻塞",
      hasImportedTeacherCompensationPolicyReport()
        ? `${
            Number(
              teacherCompensationPolicySummary?.duplicate_override_scope_teacher_count || 0
            ) +
            Number(teacherCompensationPolicySummary?.overlap_issue_teacher_count || 0) +
            Number(teacherCompensationPolicySummary?.future_gap_teacher_count || 0) +
            Number(
              teacherCompensationPolicySummary?.current_rule_missing_active_teacher_count ||
                0
            )
          } 人`
        : "未导入",
      hasImportedTeacherCompensationPolicyReport()
        ? "重复覆盖、规则重叠、未来断档或当前缺规则"
        : "导入提成政策覆盖报告后显示",
    ],
    [
      "覆盖项冲突待清理",
      hasImportedTeacherRuleItemResolutionTemplate()
        ? `${teacherRuleItemResolutionSummary?.row_count || 0} 组`
        : "未导入",
      hasImportedTeacherRuleItemResolutionTemplate()
        ? "确认后可自动折叠重复提成覆盖项"
        : "导入覆盖项冲突清理模板后显示",
    ],
    [
      "课时费接入阻塞",
      selectedCompensationReadinessPeriodRow
        ? `${Number(selectedCompensationReadinessPeriodRow.missing_statement_teacher_count || 0) + Number(selectedCompensationReadinessPeriodRow.needs_rule_inference_teacher_count || 0) + Number(selectedCompensationReadinessPeriodRow.needs_schedule_review_teacher_count || 0) + Number(selectedCompensationReadinessPeriodRow.needs_manual_review_teacher_count || 0)} 人`
        : "未导入",
      selectedCompensationReadinessPeriodRow
        ? "缺结算、缺规则或排课未闭环的老师月份"
        : "导入课时费导入就绪报告后显示",
    ],
    [
      "主规则待回填",
      hasImportedTeacherRuleBackfillTemplate()
        ? `${selectedRuleBackfillRows.length} 人`
        : "未导入",
      hasImportedTeacherRuleBackfillTemplate()
        ? "当前月份可直接确认的规则补录建议"
        : "导入回填建议后显示",
    ],
  ];

  summary.innerHTML = summaryCards
    .map(
      ([label, value, note]) => `
        <article class="metric-card">
          <div class="metric-label">${label}</div>
          <div class="metric-value metric-value-sm">${value}</div>
          <div class="metric-note">${note}</div>
        </article>
      `
    )
    .join("");

  const overrides = getSettlementOverridesForPeriod(selectedPeriod);
  overrideList.innerHTML = overrides.length
    ? overrides
        .map(
          (item) => `
            <div class="list-card">
              <div class="list-title">${item.teacherName} · ${formatRatioPercent(item.ratioOverride)}</div>
              <div class="list-meta">${item.notes}</div>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">这个月份没有识别到特殊提成覆盖项。</div>`;

  lineSummaryList.innerHTML = buildSettlementLineSummaryCards(
    selectedPeriod,
    selectedTeacher,
    selectedStatement,
    detailRows,
    selectedSlotSummaryBoard
  )
    .map(
      (item) => `
        <div class="list-card">
          <div class="list-title">${item.title}</div>
          <div class="list-meta">${item.meta}</div>
        </div>
      `
    )
    .join("");

  lineList.innerHTML = buildSettlementLineListHtml(detailRows, selectedSlotSummaryBoard);

  slotSummaryList.innerHTML = slotSummaryBoards.length
    ? slotSummaryBoards
        .map(
          (item) => `
            <div class="list-card">
              <div class="list-title">${item.ownerTeacherName}</div>
              <div class="list-meta">一对一 ${item.metricTotals.one_to_one_slot_count} · 补课 ${item.metricTotals.makeup_slot_count} · 免费 ${item.metricTotals.free_slot_count}</div>
              <div class="list-meta">关联老师：${item.relatedTeacherSummaryText || "无"}</div>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">这个月份没有汇总型时间档板。</div>`;

  const matchedFinancial = state.financialPeriods.find((item) => item.periodName === selectedPeriod);
  profitLink.innerHTML = buildSettlementProfitLinkHtml(
    selectedPeriod,
    selectedTeacher,
    matchedFinancial
  );

  reviewSummaryList.innerHTML = buildSettlementDiagnosticSummaryHtml(
    selectedPeriod,
    selectedBridgePeriodReport,
    selectedReconciliationPeriodSummary,
    selectedProfitReconciliationPeriod,
    periodMismatchCount,
    selectedReviewQueuePeriodSummary,
    selectedReviewFollowupRows,
    reviewResolutionRows
  );
  compensationReadinessList.innerHTML = buildCompensationImportReadinessHtml(
    selectedPeriod,
    selectedCompensationReadinessPeriodRow,
    selectedCompensationReadinessTeacherRow
  );
  settlementImportWavePackageList.innerHTML = buildSettlementImportWavePackageHtml(
    selectedPeriod,
    selectedTeacher,
    selectedSettlementImportWavePackages,
    selectedSettlementImportWaveProfitPeriodRow,
    selectedSettlementImportWaveDeferredRow
  );
  settlementImportDeferredActionList.innerHTML =
    buildSettlementImportDeferredActionHtml(
      selectedPeriod,
      selectedTeacher,
      selectedSettlementImportDeferredActionPackage
    );
  settlementImportExecutionList.innerHTML = buildSettlementImportExecutionHtml(
    selectedPeriod,
    selectedSettlementImportExecutionPeriodRow,
    selectedSettlementImportExecutionTeacherRow
  );
  settlementOpsActionList.innerHTML = buildSettlementOpsActionHtml(
    selectedPeriod,
    selectedSettlementOpsActionPeriodRow,
    selectedSettlementOpsActionTeacherRow
  );
  profileList.innerHTML = buildTeacherSettlementProfileHtml(
    selectedProfilePeriodSummary,
    selectedTeacherProfile
  );
  teacherCompensationPolicyList.innerHTML = buildTeacherCompensationPolicyHtml(
    selectedPeriod,
    teacherCompensationPolicySummary,
    selectedTeacherCompensationPolicyRow,
    selectedTeacherCompensationPolicyPeriodRow
  );
  teacherRuleItemResolutionList.innerHTML = buildTeacherRuleItemResolutionHtml(
    selectedPeriod,
    selectedTeacher,
    teacherRuleItemResolutionSummary,
    selectedTeacherRuleItemResolutionRows,
    selectedTeacherRuleItemResolutionRowsAll
  );
  ruleBackfillList.innerHTML = buildTeacherRuleBackfillHtml(
    selectedPeriod,
    selectedRuleBackfillRows,
    selectedRuleBackfillRow
  );
  teacherReviewList.innerHTML = buildSettlementTeacherDiagnosticHtml(
    selectedPeriod,
    selectedTeacher,
    selectedBridgeTeacherReport,
    selectedReconciliationTeacherReport,
    selectedReviewQueueRow,
    selectedReviewFollowupRow,
    selectedReviewResolutionRow
  );
}

function buildProfitSettlementDividendHtml(periodName) {
  if (!hasImportedProfitSettlementDividendReport()) {
    return `<div class="empty-state">导入 profit-settlement-dividend-report.json 后，这里会把利润、老师结算构成和分红口径放在同一张月报里看。</div>`;
  }

  const periodRow = getProfitSettlementDividendPeriodRow(periodName);
  if (!periodRow) {
    return `<div class="empty-state">${periodName || "当前月份"} 还没有利润-结算-分红联动月报。</div>`;
  }

  const topTeachers = getProfitSettlementDividendTeacherRowsForPeriod(periodName).slice(0, 4);
  const cards = [
    `
      <div class="list-card">
        <div class="list-title">${periodName} 联动口径</div>
        <div class="list-meta">老师收入 ${formatCurrencyOrDash(periodRow.teacher_revenue_total_amount)} · 老师结算构成 ${formatCurrencyOrDash(periodRow.settlement_component_total_amount)} · 构成/收入 ${formatPercentText(periodRow.component_to_revenue_ratio_percent)}</div>
        <div class="list-meta">课时剩余汇总 ${formatCurrencyOrDash(periodRow.statement_balance_total_amount)} · 利润表课时剩余 ${formatCurrencyOrDash(periodRow.profit_teacher_balance_total_amount)} · 差额 ${formatCurrencyOrDash(periodRow.teacher_balance_gap_amount)}</div>
        <div class="list-meta">小课支出 ${formatCurrencyOrDash(periodRow.teaching_business_expense_amount)} · 小课支出减结算构成 ${formatCurrencyOrDash(periodRow.teaching_business_minus_component_amount)}</div>
      </div>
    `,
  ];

  if (periodRow.top_expense_categories) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">主要费用分类</div>
        <div class="list-meta">${periodRow.top_expense_categories}</div>
      </div>
    `);
  }

  if (topTeachers.length) {
    topTeachers.forEach((teacherRow) => {
      cards.push(`
        <div class="list-card">
          <div class="list-title">${teacherRow.teacher_name}</div>
          <div class="list-meta">${teacherRow.rule_display || "未匹配主规则"} · 收入 ${formatCurrencyOrDash(teacherRow.revenue_total_amount)} · 构成 ${formatCurrencyOrDash(teacherRow.component_total_amount)}</div>
          <div class="list-meta">课时提成占收入 ${formatPercentText(teacherRow.teaching_commission_ratio_percent)} · 构成/收入 ${formatPercentText(teacherRow.component_to_revenue_ratio_percent)}</div>
        </div>
      `);
    });
  }

  return cards.join("");
}

function buildSettlementProfitLinkHtml(periodName, teacherName, matchedFinancial) {
  const cards = [];
  if (!matchedFinancial) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">利润联动未录入</div>
        <div class="list-meta">当前没有 ${periodName} 的利润月份数据，录入后这里会显示净利润、分红池和留存利润。</div>
      </div>
    `);
  } else {
    const financial = calculateFinancialSummary(matchedFinancial);
    cards.push(`
      <div class="list-card">
        <div class="list-title">${periodName} 利润联动</div>
        <div class="list-meta">净利润 ${formatCurrency(financial.netProfit)} · 分红比例 ${formatPercent(financial.dividendRate)} · 分红池 ${formatCurrency(financial.dividendPool)}</div>
      </div>
    `);
    cards.push(`
      <div class="list-card">
        <div class="list-title">留存利润</div>
        <div class="list-meta">${formatCurrency(financial.retainedProfit)}，可继续滚到下月经营与分红测算。</div>
      </div>
    `);
  }

  if (!hasImportedProfitSettlementDividendReport()) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">统一月报未导入</div>
        <div class="list-meta">导入 profit-settlement-dividend-report.json 后，这里会显示老师结算构成、小课支出和当前老师主规则联动。</div>
      </div>
    `);
    return cards.join("");
  }

  const periodRow = getProfitSettlementDividendPeriodRow(periodName);
  if (periodRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${periodName} 老师结算构成</div>
        <div class="list-meta">构成合计 ${formatCurrencyOrDash(periodRow.settlement_component_total_amount)} · 老师收入 ${formatCurrencyOrDash(periodRow.teacher_revenue_total_amount)} · 构成/收入 ${formatPercentText(periodRow.component_to_revenue_ratio_percent)}</div>
        <div class="list-meta">课时剩余差额 ${formatCurrencyOrDash(periodRow.teacher_balance_gap_amount)} · 小课支出 ${formatCurrencyOrDash(periodRow.teaching_business_expense_amount)}</div>
      </div>
    `);
  }

  const teacherRow = getProfitSettlementDividendTeacherRow(periodName, teacherName);
  if (teacherRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${teacherName} 当月联动</div>
        <div class="list-meta">${teacherRow.rule_display || "未匹配主规则"}${teacherRow.rule_effective_start_date ? ` · 生效 ${teacherRow.rule_effective_start_date}` : ""}</div>
        <div class="list-meta">收入 ${formatCurrencyOrDash(teacherRow.revenue_total_amount)} · 结算构成 ${formatCurrencyOrDash(teacherRow.component_total_amount)} · 课时剩余原值 ${teacherRow.balance_amount_raw || "—"}</div>
        <div class="list-meta">课时提成占收入 ${formatPercentText(teacherRow.teaching_commission_ratio_percent)} · 构成/收入 ${formatPercentText(teacherRow.component_to_revenue_ratio_percent)}</div>
      </div>
    `);
  }

  return cards.join("");
}

function hasImportedSettlementData() {
  return state.settlementStatements.length > 0;
}

function shouldUseHistoricalSettlementSamples() {
  return (
    !hasImportedSettlementData() &&
    !hasImportedBridgeReport() &&
    !hasImportedReconciliationReport() &&
    !hasImportedReviewQueue() &&
    !hasImportedSettlementReviewFollowupReport() &&
    !hasImportedTeacherSettlementProfileReport() &&
    !hasImportedTeacherRuleBackfillTemplate() &&
    !hasImportedCompensationImportReadinessReport() &&
    !hasImportedSettlementImportWavePackageReport() &&
    !hasImportedSettlementImportDeferredActionReport() &&
    !hasImportedSettlementImportExecutionReport() &&
    !hasImportedSettlementOpsActionReport()
  );
}

function getSettlementPeriods() {
  const periods = new Set();
  const addPeriod = (value) => {
    const clean = String(value || "").trim();
    if (/^\d{4}-\d{2}$/.test(clean)) {
      periods.add(clean);
    }
  };

  if (shouldUseHistoricalSettlementSamples()) {
    HISTORICAL_SETTLEMENT_STATEMENTS.forEach((item) => addPeriod(item.periodName));
  }

  state.settlementStatements.forEach((item) => addPeriod(item.periodName));
  state.compensationSlotSummaries.forEach((item) => addPeriod(item.periodName));
  (state.settlementReviewQueue?.period_summaries || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.settlementReviewFollowupReport?.followups || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.teacherSettlementProfileReport?.period_summaries || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.compensationImportReadinessReport?.period_rows || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.settlementImportWavePackageReport?.packages || []).forEach((item) =>
    (item.included_period_names || []).forEach(addPeriod)
  );
  (state.settlementImportWavePackageReport?.deferred_rows || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.settlementImportDeferredActionReport?.packages || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.settlementImportExecutionReport?.period_rows || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.settlementOpsActionReport?.period_rows || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.teacherCompensationPolicyReport?.period_rows || []).forEach((item) =>
    addPeriod(item.period_name)
  );
  (state.teacherRuleItemResolutionTemplate?.rows || []).forEach((item) =>
    addPeriod(String(item.effective_start_date || "").slice(0, 7))
  );
  (state.teacherRuleBackfillTemplate?.rows || []).forEach((item) =>
    addPeriod(item.target_period_name)
  );

  return [...periods].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function getSettlementRowsForPeriod(periodName) {
  if (shouldUseHistoricalSettlementSamples()) {
    return HISTORICAL_SETTLEMENT_STATEMENTS
      .filter((row) => row.periodName === periodName)
      .sort(
        (left, right) =>
          toNumber(right.teachingCommissionAmount) - toNumber(left.teachingCommissionAmount) ||
          toNumber(right.revenueTotalRaw) - toNumber(left.revenueTotalRaw)
      );
  }

  const freeSlotCounts = buildFreeSlotCountMap(periodName);
  return state.settlementStatements
    .filter((row) => row.periodName === periodName)
    .map((row) => ({
      ...row,
      mainRatio: resolveRevenueShareRatio(row.teacherName, periodName),
      freeSlotCount: freeSlotCounts.get(row.teacherName) || 0,
    }))
    .sort(
      (left, right) =>
        toNumber(right.teachingCommissionAmount) - toNumber(left.teachingCommissionAmount) ||
        toNumber(right.revenueTotalRaw) - toNumber(left.revenueTotalRaw)
    );
}

function getSettlementLineRowsForTeacher(periodName, teacherName) {
  if (!state.settlementLines.length || !periodName || !teacherName) {
    return [];
  }

  return state.settlementLines
    .filter((row) => row.periodName === periodName && row.teacherName === teacherName)
    .sort(
      (left, right) =>
        getSettlementLineAmount(right) - getSettlementLineAmount(left) ||
        toNumber(right.sessionCount || right.lessonCount) - toNumber(left.sessionCount || left.lessonCount) ||
        left.studentName.localeCompare(right.studentName, "zh-CN")
    );
}

function getSettlementOverridesForPeriod(periodName) {
  if (shouldUseHistoricalSettlementSamples()) {
    return HISTORICAL_SETTLEMENT_OVERRIDES[periodName] || [];
  }
  if (!state.compensationRuleItems.length) {
    return [];
  }

  return state.compensationRuleItems
    .filter((item) => item.ratioOverride && String(item.effectiveStartDate || "").slice(0, 7) === periodName)
    .sort(
      (left, right) =>
        left.teacherName.localeCompare(right.teacherName, "zh-CN") ||
        toNumber(right.ratioOverride) - toNumber(left.ratioOverride)
    )
    .map((item) => ({
      teacherName: item.teacherName,
      ratioOverride: item.ratioOverride,
      notes: item.notes || "导入的提成覆盖规则",
    }));
}

function buildFreeSlotCountMap(periodName) {
  const counts = new Map();
  state.nonBillableSlots
    .filter((item) => item.periodName === periodName)
    .forEach((item) => {
      counts.set(item.teacherName, (counts.get(item.teacherName) || 0) + 1);
    });
  return counts;
}

function getSettlementLineAmount(row) {
  if (row.finalAmount !== undefined && row.finalAmount !== null && row.finalAmount !== "") {
    return toNumber(row.finalAmount);
  }
  if (row.commissionTotalAmount !== undefined && row.commissionTotalAmount !== null && row.commissionTotalAmount !== "") {
    return toNumber(row.commissionTotalAmount);
  }
  return toNumber(row.baseAmount);
}

function buildSettlementLineSummaryCards(periodName, teacherName, statementRow, detailRows, slotSummaryBoard) {
  const detailAmountTotal = roundAmount(
    detailRows.reduce((sum, row) => sum + getSettlementLineAmount(row), 0)
  );
  const sessionTotal = roundAmount(
    detailRows.reduce((sum, row) => sum + toNumber(row.sessionCount || row.lessonCount), 0)
  );
  const statementTeachingTotal = statementRow
    ? roundAmount(toNumber(statementRow.teachingCommissionAmount) + toNumber(statementRow.makeupCommissionAmount))
    : 0;
  const amountDifference = statementRow ? roundAmount(detailAmountTotal - statementTeachingTotal) : 0;
  const cards = [
    {
      title: teacherName || `${periodName} 未选老师`,
      meta: teacherName ? `${periodName} 的结算明细核对` : "当前月份没有可选老师",
    },
  ];

  if (!teacherName) {
    return cards;
  }

  cards.push({
    title: `学生明细 ${detailRows.length} 行`,
    meta: `课次数 ${formatCompactSlotValue(sessionTotal)} · 明细金额合计 ${formatCurrency(detailAmountTotal)}`,
  });

  if (statementRow) {
    cards.push({
      title: "和汇总单对照",
      meta: `汇总课时+补课提成 ${formatCurrency(statementTeachingTotal)} · 差额 ${formatCurrency(amountDifference)}`,
    });
  }

  if (slotSummaryBoard) {
    cards.push({
      title: "汇总型时间档板",
      meta: `一对一 ${slotSummaryBoard.metricTotals.one_to_one_slot_count} · 补课 ${slotSummaryBoard.metricTotals.makeup_slot_count} · 免费 ${slotSummaryBoard.metricTotals.free_slot_count}`,
    });
  }

  return cards;
}

function buildSettlementLineListHtml(detailRows, slotSummaryBoard) {
  if (!detailRows.length && slotSummaryBoard) {
    return `
      <div class="list-card">
        <div class="list-title">当前没有学生级结算明细</div>
        <div class="list-meta">这位老师本月是汇总型时间档板，系统保留了时间档数量，但原工资表没有学生级明细行。</div>
        <div class="list-meta">关联老师：${slotSummaryBoard.relatedTeacherSummaryText || "无"}</div>
      </div>
    `;
  }

  if (!detailRows.length) {
    return `<div class="empty-state">当前老师还没有导入结算明细。</div>`;
  }

  return detailRows
    .map(
      (row) => `
        <div class="list-card">
          <div class="list-title">${row.studentName || "未命名学生"} · ${formatCurrency(getSettlementLineAmount(row))}</div>
          <div class="list-meta">课次数 ${formatCompactSlotValue(row.sessionCount || row.lessonCount)} · 课时费 ${formatAmountText(row.feeAmountRaw)} · 提成比例/单价 ${row.commissionAmountRaw || "—"}</div>
          <div class="list-meta">${row.lessonOccurrencesRaw || "没有课次原文"}</div>
          ${row.notes ? `<div class="list-meta">${row.notes}</div>` : ""}
        </div>
      `
    )
    .join("");
}

function getCompensationSlotSummaryBoards(periodName) {
  const boardMap = new Map();
  state.compensationSlotSummaries
    .filter((item) => item.periodName === periodName && item.ownerTeacherName && item.relatedTeacherName && item.metricType)
    .forEach((item) => {
      const ownerKey = item.ownerTeacherName;
      const metricName = item.metricType;
      if (!boardMap.has(ownerKey)) {
        boardMap.set(ownerKey, {
          ownerTeacherName: item.ownerTeacherName,
          relatedMetricTotals: new Map(),
        });
      }

      const board = boardMap.get(ownerKey);
      const relatedKey = item.relatedTeacherName;
      if (!board.relatedMetricTotals.has(relatedKey)) {
        board.relatedMetricTotals.set(relatedKey, {
          metricTotals: {
            one_to_one_slot_count: 0,
            makeup_slot_count: 0,
            free_slot_count: 0,
          },
          sourceKinds: {},
        });
      }

      const relatedEntry = board.relatedMetricTotals.get(relatedKey);
      const quantity = toNumber(item.quantityValue || item.quantityRaw);
      const existingSourceKind = relatedEntry.sourceKinds[metricName] || "";

      if (item.rowKind === "metric_total") {
        relatedEntry.metricTotals[metricName] = quantity;
        relatedEntry.sourceKinds[metricName] = "metric_total";
        return;
      }
      if (existingSourceKind === "metric_total") {
        return;
      }

      relatedEntry.metricTotals[metricName] += quantity;
      relatedEntry.sourceKinds[metricName] = item.rowKind || "week_row";
    });

  return [...boardMap.values()]
    .map((board) => {
      const metricTotals = {
        one_to_one_slot_count: 0,
        makeup_slot_count: 0,
        free_slot_count: 0,
      };
      const relatedSummaries = [...board.relatedMetricTotals.entries()]
        .map(([teacherName, entry]) => {
          metricTotals.one_to_one_slot_count += toNumber(entry.metricTotals.one_to_one_slot_count);
          metricTotals.makeup_slot_count += toNumber(entry.metricTotals.makeup_slot_count);
          metricTotals.free_slot_count += toNumber(entry.metricTotals.free_slot_count);
          return {
            teacherName,
            metricTotals: entry.metricTotals,
            total:
              toNumber(entry.metricTotals.one_to_one_slot_count) +
              toNumber(entry.metricTotals.makeup_slot_count) +
              toNumber(entry.metricTotals.free_slot_count),
          };
        })
        .sort(
          (left, right) =>
            right.total - left.total || left.teacherName.localeCompare(right.teacherName, "zh-CN")
        );

      return {
        ownerTeacherName: board.ownerTeacherName,
        metricTotals: {
          one_to_one_slot_count: formatCompactSlotValue(metricTotals.one_to_one_slot_count),
          makeup_slot_count: formatCompactSlotValue(metricTotals.makeup_slot_count),
          free_slot_count: formatCompactSlotValue(metricTotals.free_slot_count),
        },
        relatedTeacherSummaryText: relatedSummaries
          .map(
            (entry) =>
              `${entry.teacherName}(一对一 ${formatCompactSlotValue(entry.metricTotals.one_to_one_slot_count)} / 补课 ${formatCompactSlotValue(entry.metricTotals.makeup_slot_count)} / 免费 ${formatCompactSlotValue(entry.metricTotals.free_slot_count)})`
          )
          .join("；"),
      };
    })
    .sort((left, right) => left.ownerTeacherName.localeCompare(right.ownerTeacherName, "zh-CN"));
}

function hasImportedBridgeReport() {
  return Array.isArray(state.scheduleSettlementBridge?.period_reports) && state.scheduleSettlementBridge.period_reports.length > 0;
}

function hasImportedReconciliationReport() {
  return (
    Array.isArray(state.importReconciliation?.profit_reconciliation?.periods) &&
    state.importReconciliation.profit_reconciliation.periods.length > 0
  ) || (
    Array.isArray(state.importReconciliation?.settlement_reconciliation?.statement_reports) &&
    state.importReconciliation.settlement_reconciliation.statement_reports.length > 0
  );
}

function getBridgePeriodReport(periodName) {
  if (!hasImportedBridgeReport()) {
    return null;
  }
  return (
    state.scheduleSettlementBridge.period_reports.find((item) => item.period_name === periodName) || null
  );
}

function getBridgeTeacherReport(periodName, teacherName) {
  const periodReport = getBridgePeriodReport(periodName);
  if (!periodReport || !Array.isArray(periodReport.teacher_reports)) {
    return null;
  }
  return periodReport.teacher_reports.find((item) => item.teacher_name === teacherName) || null;
}

function getSettlementReconciliationPeriodSummary(periodName) {
  const rows = state.importReconciliation?.settlement_reconciliation?.period_summaries;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getSettlementReconciliationTeacherReport(periodName, teacherName) {
  const rows = state.importReconciliation?.settlement_reconciliation?.statement_reports;
  if (!Array.isArray(rows)) {
    return null;
  }
  return (
    rows.find((item) => item.period_name === periodName && item.teacher_name === teacherName) || null
  );
}

function getSettlementReconciliationMismatchCount(periodName) {
  const rows = state.importReconciliation?.settlement_reconciliation?.mismatches;
  if (!Array.isArray(rows)) {
    return 0;
  }
  return rows.filter((item) => item.period_name === periodName).length;
}

function getProfitReconciliationPeriod(periodName) {
  const rows = state.importReconciliation?.profit_reconciliation?.periods;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function hasImportedReviewQueue() {
  return Array.isArray(state.settlementReviewQueue?.review_queue) && state.settlementReviewQueue.review_queue.length > 0;
}

function hasImportedSettlementReviewFollowupReport() {
  return (
    Array.isArray(state.settlementReviewFollowupReport?.followups) &&
    state.settlementReviewFollowupReport.followups.length > 0
  );
}

function hasImportedProfitSettlementDividendReport() {
  return (
    Array.isArray(state.profitSettlementDividendReport?.period_rows) &&
    state.profitSettlementDividendReport.period_rows.length > 0
  );
}

function hasImportedSummerBigClassRoomOccupancyReport() {
  return (
    Array.isArray(state.summerBigClassRoomOccupancyReport?.occupancy_rows) &&
    state.summerBigClassRoomOccupancyReport.occupancy_rows.length > 0
  );
}

function hasImportedSummerScheduleSettlementReport() {
  return (
    Array.isArray(state.summerScheduleSettlementReport?.teacher_rows) &&
    state.summerScheduleSettlementReport.teacher_rows.length > 0
  ) || (
    Array.isArray(state.summerScheduleSettlementReport?.class_rows) &&
    state.summerScheduleSettlementReport.class_rows.length > 0
  ) || Number(state.summerScheduleSettlementReport?.summary?.excluded_teacher_count || 0) > 0
    || (
      Array.isArray(state.summerScheduleSettlementReport?.notes) &&
      state.summerScheduleSettlementReport.notes.length > 0
    );
}

function getSummerClassRevenueRows() {
  const rows =
    Array.isArray(state.summerClassRevenueRows) && state.summerClassRevenueRows.length
      ? state.summerClassRevenueRows
      : createSummerClassRevenueRowsFromReport(state.summerScheduleSettlementReport);
  return rows
    .map((row, index) => ({ ...row, _stateIndex: index }))
    .sort((left, right) =>
      String(left.className || "").localeCompare(String(right.className || ""), "zh-CN")
    );
}

function buildSummerClassRevenueRowMap() {
  const rowMap = new Map();
  getSummerClassRevenueRows().forEach((row) => {
    if (row.className) {
      rowMap.set(row.className, row);
    }
  });
  return rowMap;
}

function deriveSummerProjectionStatus({
  totalClassCount,
  filledClassCount,
  hasProjectionSupport,
}) {
  if (!totalClassCount) {
    return "无班级";
  }
  if (!hasProjectionSupport) {
    return "缺投影支持";
  }
  if (!filledClassCount) {
    return "待填收入";
  }
  if (filledClassCount < totalClassCount) {
    return "部分重算";
  }
  return "已重算";
}

function buildSummerTeacherProjectionScenario(report, revenueRows) {
  const teacherRows = Array.isArray(report?.teacher_rows) ? report.teacher_rows : [];
  const classRows = Array.isArray(report?.class_rows) ? report.class_rows : [];
  const teacherBaselineMap = new Map(
    teacherRows.map((row) => [String(row.teacher_name || ""), row])
  );
  const classBaselineMap = new Map(
    classRows.map((row) => [String(row.class_name || ""), row])
  );
  const scenarioMap = new Map();

  const ensureTeacher = (teacherName) => {
    const name = String(teacherName || "").trim();
    if (!name) {
      return null;
    }
    if (scenarioMap.has(name)) {
      return scenarioMap.get(name);
    }
    const baselineRow = teacherBaselineMap.get(name) || {};
    const baselineSuggestedRevenueTotal = toNumber(
      baselineRow.suggested_estimated_revenue_total
    );
    const baselineSuggestedProjectedAmountTotal = toNumber(
      baselineRow.suggested_projected_amount_total
    );
    const baselineMixedEstimatedRevenueTotal = toNumber(
      baselineRow.mixed_estimated_revenue_total ||
        baselineRow.suggested_estimated_revenue_total
    );
    const baselineMixedProjectedAmountTotal = toNumber(
      baselineRow.mixed_projected_amount_total ||
        baselineRow.suggested_projected_amount_total
    );
    const baselineEstimatedRevenueTotal = toNumber(baselineRow.estimated_revenue_total);
    const baselineProjectedAmountTotal = toNumber(baselineRow.projected_amount_total);
    let projectionRatio = String(baselineRow.projection_ratio || "").trim()
      ? toNumber(baselineRow.projection_ratio)
      : null;
    let projectionRatioSource = baselineRow.projection_ratio_source || "";

    if (projectionRatio === null && baselineSuggestedRevenueTotal > 0) {
      projectionRatio =
        baselineSuggestedProjectedAmountTotal / baselineSuggestedRevenueTotal;
      projectionRatioSource = projectionRatioSource || "suggested";
    } else if (projectionRatio === null && baselineEstimatedRevenueTotal > 0) {
      projectionRatio = baselineProjectedAmountTotal / baselineEstimatedRevenueTotal;
      projectionRatioSource = projectionRatioSource || "actual";
    }

    const scenario = {
      teacherName: name,
      subject: baselineRow.subject || "",
      scheduleRowCount: Number(baselineRow.schedule_row_count || 0),
      status: baselineRow.status || "",
      baselineSuggestedRevenueTotal,
      baselineSuggestedProjectedAmountTotal,
      baselineMixedEstimatedRevenueTotal,
      baselineMixedProjectedAmountTotal,
      baselineEstimatedRevenueTotal,
      baselineProjectedAmountTotal,
      projectionRatio,
      projectionRatioSource,
      classNames: new Set(),
      filledClassNames: new Set(),
      actualEstimatedRevenueTotal: baselineEstimatedRevenueTotal,
      actualProjectedAmountTotal: baselineProjectedAmountTotal,
      mixedEstimatedRevenueTotal: baselineMixedEstimatedRevenueTotal,
      mixedProjectedAmountTotal: baselineMixedProjectedAmountTotal,
    };
    scenarioMap.set(name, scenario);
    return scenario;
  };

  teacherRows.forEach((row) => {
    ensureTeacher(row.teacher_name);
  });

  revenueRows.forEach((row) => {
    const teacherNames = parseLooseStringArray(row.teacherNamesText);
    const hasActualRevenue = String(row.estimatedSessionRevenue || "").trim() !== "";
    const actualSessionRevenue = toNumber(row.estimatedSessionRevenue);
    const suggestedSessionRevenue = toNumber(row.suggestedSessionRevenue);
    const mixedSessionRevenue = hasActualRevenue
      ? actualSessionRevenue
      : suggestedSessionRevenue;
    const sessionCount = Number(row.teachingSessionCount || 0);
    const actualRevenueTotal = actualSessionRevenue * sessionCount;
    const mixedRevenueTotal = mixedSessionRevenue * sessionCount;
    const baselineClassRow = classBaselineMap.get(row.className || "") || {};
    const baselineActualRevenueTotal = toNumber(
      baselineClassRow.actual_class_estimated_revenue_total
    );
    const baselineMixedRevenueTotal = toNumber(
      baselineClassRow.mixed_class_estimated_revenue_total ||
        baselineClassRow.suggested_class_estimated_revenue_total ||
        baselineClassRow.actual_class_estimated_revenue_total
    );
    const actualRevenueDelta = actualRevenueTotal - baselineActualRevenueTotal;
    const mixedRevenueDelta = mixedRevenueTotal - baselineMixedRevenueTotal;

    teacherNames.forEach((teacherName) => {
      const scenario = ensureTeacher(teacherName);
      if (!scenario) {
        return;
      }
      if (row.className) {
        scenario.classNames.add(row.className);
        if (hasActualRevenue) {
          scenario.filledClassNames.add(row.className);
        }
      }
      if (scenario.projectionRatio !== null) {
        scenario.actualEstimatedRevenueTotal += actualRevenueDelta;
        scenario.mixedEstimatedRevenueTotal += mixedRevenueDelta;
        scenario.actualProjectedAmountTotal +=
          actualRevenueDelta * scenario.projectionRatio;
        scenario.mixedProjectedAmountTotal +=
          mixedRevenueDelta * scenario.projectionRatio;
      }
    });
  });

  const rows = [...scenarioMap.values()]
    .map((scenario) => {
      const totalClassCount = scenario.classNames.size;
      const filledClassCount = scenario.filledClassNames.size;
      const hasProjectionSupport =
        scenario.projectionRatio !== null ||
        scenario.baselineMixedProjectedAmountTotal > 0 ||
        scenario.baselineProjectedAmountTotal > 0;
      const mixedProjectedAmountTotal = hasProjectionSupport
        ? roundAmount(scenario.mixedProjectedAmountTotal)
        : null;
      const actualProjectedAmountTotal = hasProjectionSupport
        ? roundAmount(scenario.actualProjectedAmountTotal)
        : null;
      return {
        teacherName: scenario.teacherName,
        subject: scenario.subject,
        status: scenario.status,
        scheduleRowCount: scenario.scheduleRowCount,
        totalClassCount,
        filledClassCount,
        baselineSuggestedRevenueTotal: roundAmount(
          scenario.baselineSuggestedRevenueTotal
        ),
        baselineSuggestedProjectedAmountTotal: roundAmount(
          scenario.baselineSuggestedProjectedAmountTotal
        ),
        baselineMixedEstimatedRevenueTotal: roundAmount(
          scenario.baselineMixedEstimatedRevenueTotal
        ),
        baselineMixedProjectedAmountTotal: roundAmount(
          scenario.baselineMixedProjectedAmountTotal
        ),
        baselineEstimatedRevenueTotal: roundAmount(
          scenario.baselineEstimatedRevenueTotal
        ),
        baselineProjectedAmountTotal: roundAmount(
          scenario.baselineProjectedAmountTotal
        ),
        actualEstimatedRevenueTotal: roundAmount(scenario.actualEstimatedRevenueTotal),
        actualProjectedAmountTotal,
        mixedEstimatedRevenueTotal: roundAmount(scenario.mixedEstimatedRevenueTotal),
        mixedProjectedAmountTotal,
        mixedProjectedAmountDelta:
          mixedProjectedAmountTotal === null
            ? null
            : roundAmount(
                mixedProjectedAmountTotal -
                  roundAmount(scenario.baselineMixedProjectedAmountTotal)
              ),
        projectionRatio:
          scenario.projectionRatio !== null
            ? roundAmount(scenario.projectionRatio)
            : null,
        projectionRatioSource: scenario.projectionRatioSource,
        hasProjectionRatio: scenario.projectionRatio !== null,
        hasProjectionSupport,
        projectionStatus: deriveSummerProjectionStatus({
          totalClassCount,
          filledClassCount,
          hasProjectionSupport,
        }),
      };
    })
    .sort((left, right) => {
      const leftGap = left.totalClassCount - left.filledClassCount;
      const rightGap = right.totalClassCount - right.filledClassCount;
      return (
        rightGap - leftGap ||
        Number(right.scheduleRowCount || 0) - Number(left.scheduleRowCount || 0) ||
        String(left.teacherName || "").localeCompare(
          String(right.teacherName || ""),
          "zh-CN"
        )
      );
    });

  return {
    rows,
    ratioMap: new Map(
      rows
        .filter((row) => row.hasProjectionRatio)
        .map((row) => [row.teacherName, row.projectionRatio])
    ),
    summary: {
      teacherCount: rows.length,
      teacherWithRatioCount: rows.filter((row) => row.hasProjectionRatio).length,
      fullyProjectedTeacherCount: rows.filter(
        (row) =>
          row.hasProjectionSupport &&
          row.totalClassCount > 0 &&
          row.filledClassCount === row.totalClassCount
      ).length,
      mixedProjectedAmountTotal: roundAmount(
        rows.reduce(
          (sum, row) => sum + toNumber(row.mixedProjectedAmountTotal),
          0
        )
      ),
      actualProjectedAmountTotal: roundAmount(
        rows.reduce(
          (sum, row) => sum + toNumber(row.actualProjectedAmountTotal),
          0
        )
      ),
    },
  };
}

function buildSummerClassProjectionMap(report, revenueRows, teacherProjectionScenario) {
  const classProjectionMap = new Map();
  const classRows = Array.isArray(report?.class_rows) ? report.class_rows : [];
  const classBaselineMap = new Map(
    classRows.map((row) => [String(row.class_name || ""), row])
  );
  const ratioMap = teacherProjectionScenario.ratioMap || new Map();

  revenueRows.forEach((row) => {
    const teacherNames = parseLooseStringArray(row.teacherNamesText);
    const baselineClassRow = classBaselineMap.get(row.className || "") || {};
    const teacherCount = Number(
      baselineClassRow.teacher_count || teacherNames.length || 0
    );
    const hasActualRevenue = String(row.estimatedSessionRevenue || "").trim() !== "";
    const actualSessionRevenue = toNumber(row.estimatedSessionRevenue);
    const suggestedSessionRevenue = toNumber(row.suggestedSessionRevenue);
    const mixedSessionRevenue = hasActualRevenue
      ? actualSessionRevenue
      : suggestedSessionRevenue;
    const sessionCount = Number(row.teachingSessionCount || 0);
    const actualRevenueTotal = actualSessionRevenue * sessionCount;
    const mixedRevenueTotal = mixedSessionRevenue * sessionCount;
    const baselineActualRevenueTotal = toNumber(
      baselineClassRow.actual_class_estimated_revenue_total
    );
    const baselineMixedRevenueTotal = toNumber(
      baselineClassRow.mixed_class_estimated_revenue_total ||
        baselineClassRow.suggested_class_estimated_revenue_total ||
        baselineClassRow.actual_class_estimated_revenue_total
    );
    const baselineActualProjectedAmountTotal = toNumber(
      baselineClassRow.actual_projected_amount_total
    );
    const baselineMixedProjectedAmountTotal = toNumber(
      baselineClassRow.mixed_projected_amount_total
    );
    const actualRevenueDelta = actualRevenueTotal - baselineActualRevenueTotal;
    const mixedRevenueDelta = mixedRevenueTotal - baselineMixedRevenueTotal;
    const missingRatioTeachers = teacherNames.filter((name) => !ratioMap.has(name));
    const totalTeacherRatio = teacherNames.reduce(
      (sum, name) => sum + toNumber(ratioMap.get(name)),
      0
    );
    const actualProjectionSupportedTeacherCount = Number(
      baselineClassRow.actual_projection_supported_teacher_count ||
        baselineClassRow.actualProjectionSupportedTeacherCount ||
        (teacherCount > 0 && missingRatioTeachers.length === 0 && hasActualRevenue
          ? teacherCount
          : 0)
    );
    const mixedProjectionSupportedTeacherCount = Number(
      baselineClassRow.mixed_projection_supported_teacher_count ||
        baselineClassRow.mixedProjectionSupportedTeacherCount ||
        (teacherCount > 0 && missingRatioTeachers.length === 0 ? teacherCount : 0)
    );
    const actualProjectionSupported =
      teacherCount > 0 &&
      actualProjectionSupportedTeacherCount === teacherCount;
    const mixedProjectionSupported =
      teacherCount > 0 &&
      mixedProjectionSupportedTeacherCount === teacherCount;
    const actualProjectedAmountTotal = actualProjectionSupported
      ? roundAmount(
          baselineActualProjectedAmountTotal + actualRevenueDelta * totalTeacherRatio
        )
      : null;
    const mixedProjectedAmountTotal = mixedProjectionSupported
      ? roundAmount(
          baselineMixedProjectedAmountTotal + mixedRevenueDelta * totalTeacherRatio
        )
      : null;

    classProjectionMap.set(row.className, {
      className: row.className,
      hasActualRevenue,
      projectionSupported: mixedProjectionSupported,
      missingRatioTeachers,
      totalTeacherRatio:
        teacherNames.length && totalTeacherRatio > 0
          ? roundAmount(totalTeacherRatio)
          : null,
      actualRevenueTotal: hasActualRevenue ? roundAmount(actualRevenueTotal) : null,
      mixedRevenueTotal: roundAmount(mixedRevenueTotal),
      actualProjectedAmountTotal,
      mixedProjectedAmountTotal,
      actualGrossMargin:
        actualProjectedAmountTotal === null || !hasActualRevenue
          ? null
          : roundAmount(actualRevenueTotal - actualProjectedAmountTotal),
      mixedGrossMargin:
        mixedProjectedAmountTotal === null
          ? null
          : roundAmount(mixedRevenueTotal - mixedProjectedAmountTotal),
    });
  });

  return classProjectionMap;
}

function hasImportedScheduleInputProfileReport() {
  return (
    Number(state.scheduleInputProfileReport?.summary?.schedule_request_count || 0) > 0 ||
    Number(state.scheduleInputProfileReport?.summary?.calendar_cell_count || 0) > 0
  );
}

function hasImportedScheduleDraftImportReport() {
  return (
    Number(state.scheduleDraftImportReport?.summary?.teacher_schedule_row_count || 0) > 0 ||
    Number(state.scheduleDraftImportReport?.summary?.demand_row_count || 0) > 0
  );
}

function hasImportedScheduleDraftReviewBulkCandidatesReport() {
  return (
    Array.isArray(state.scheduleDraftReviewBulkCandidatesReport?.candidate_rows) &&
    state.scheduleDraftReviewBulkCandidatesReport.candidate_rows.length > 0
  );
}

function hasImportedScheduleDraftManualReviewReport() {
  return (
    Array.isArray(state.scheduleDraftManualReviewReport?.teacher_period_rows) &&
    state.scheduleDraftManualReviewReport.teacher_period_rows.length > 0
  );
}

function hasImportedScheduleDraftManualClassnameBatchCandidatesReport() {
  return (
    Array.isArray(state.scheduleDraftManualClassnameBatchCandidatesReport?.batch_rows) &&
    state.scheduleDraftManualClassnameBatchCandidatesReport.batch_rows.length > 0
  );
}

function hasImportedScheduleDraftManualClassroomBatchCandidatesReport() {
  return (
    Array.isArray(state.scheduleDraftManualClassroomBatchCandidatesReport?.batch_rows) &&
    state.scheduleDraftManualClassroomBatchCandidatesReport.batch_rows.length > 0
  );
}

function hasImportedOpsOpenItemsReport() {
  return (
    Array.isArray(state.opsOpenItemsReport?.category_rows) &&
    state.opsOpenItemsReport.category_rows.length > 0
  ) || Number(state.opsOpenItemsReport?.summary?.attention_item_count || 0) > 0;
}

function hasImportedOpsChatAnswerArtifacts() {
  return (
    Number(state.opsChatAnswerSheet?.summary?.total_question_count || 0) > 0 ||
    Boolean(state.opsChatAnswerSheet?.reply_template_text) ||
    Boolean(state.opsChatAnswerSheet?.status) ||
    Boolean(state.opsChatAnswerApplyReport?.status) ||
    Number(state.opsChatAnswerApplyReport?.summary?.parsed_entry_count || 0) > 0
  );
}

function hasImportedOpsOpenItemsPanelData() {
  return hasImportedOpsOpenItemsReport() || hasImportedOpsChatAnswerArtifacts();
}

function hasImportedTeacherSettlementProfileReport() {
  return (
    Array.isArray(state.teacherSettlementProfileReport?.teacher_profiles) &&
    state.teacherSettlementProfileReport.teacher_profiles.length > 0
  );
}

function hasImportedTeacherCompensationPolicyReport() {
  return (
    Array.isArray(state.teacherCompensationPolicyReport?.teacher_rows) &&
    state.teacherCompensationPolicyReport.teacher_rows.length > 0
  ) || (
    Array.isArray(state.teacherCompensationPolicyReport?.period_rows) &&
    state.teacherCompensationPolicyReport.period_rows.length > 0
  );
}

function hasImportedTeacherRuleItemResolutionTemplate() {
  return (
    Array.isArray(state.teacherRuleItemResolutionTemplate?.rows) &&
    state.teacherRuleItemResolutionTemplate.rows.length > 0
  );
}

function hasImportedTeacherRuleBackfillTemplate() {
  return (
    Array.isArray(state.teacherRuleBackfillTemplate?.rows) &&
    state.teacherRuleBackfillTemplate.rows.length > 0
  );
}

function hasImportedCompensationImportReadinessReport() {
  return (
    Array.isArray(state.compensationImportReadinessReport?.period_rows) &&
    state.compensationImportReadinessReport.period_rows.length > 0
  ) || (
    Array.isArray(state.compensationImportReadinessReport?.teacher_period_rows) &&
    state.compensationImportReadinessReport.teacher_period_rows.length > 0
  );
}

function hasImportedSettlementImportWavePackageReport() {
  return (
    Array.isArray(state.settlementImportWavePackageReport?.packages) &&
    state.settlementImportWavePackageReport.packages.length > 0
  ) || (
    Array.isArray(state.settlementImportWavePackageReport?.deferred_rows) &&
    state.settlementImportWavePackageReport.deferred_rows.length > 0
  );
}

function hasImportedSettlementImportDeferredActionReport() {
  return (
    Array.isArray(state.settlementImportDeferredActionReport?.packages) &&
    state.settlementImportDeferredActionReport.packages.length > 0
  );
}

function hasImportedSettlementImportExecutionReport() {
  return (
    Array.isArray(state.settlementImportExecutionReport?.period_rows) &&
    state.settlementImportExecutionReport.period_rows.length > 0
  ) || (
    Array.isArray(state.settlementImportExecutionReport?.teacher_wave_rows) &&
    state.settlementImportExecutionReport.teacher_wave_rows.length > 0
  );
}

function hasImportedSettlementOpsActionReport() {
  return (
    Array.isArray(state.settlementOpsActionReport?.period_rows) &&
    state.settlementOpsActionReport.period_rows.length > 0
  ) || (
    Array.isArray(state.settlementOpsActionReport?.teacher_action_rows) &&
    state.settlementOpsActionReport.teacher_action_rows.length > 0
  );
}

function getCompensationImportReadinessPeriodRow(periodName) {
  const rows = state.compensationImportReadinessReport?.period_rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getCompensationImportReadinessTeacherRowsForPeriod(periodName) {
  const rows = state.compensationImportReadinessReport?.teacher_period_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        reviewPriorityWeight(left.review_priority) -
          reviewPriorityWeight(right.review_priority) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
}

function getCompensationImportReadinessTeacherRow(periodName, teacherName) {
  return (
    getCompensationImportReadinessTeacherRowsForPeriod(periodName).find(
      (item) => item.teacher_name === teacherName
    ) || null
  );
}

function getSettlementImportWaveTeacherNamesForPeriod(periodName) {
  const teacherNames = new Set();
  const packages = state.settlementImportWavePackageReport?.packages;
  if (Array.isArray(packages)) {
    packages.forEach((item) => {
      const rows = Array.isArray(item.included_teacher_periods)
        ? item.included_teacher_periods
        : [];
      rows.forEach((row) => {
        if (row.period_name === periodName && row.teacher_name) {
          teacherNames.add(row.teacher_name);
        }
      });
    });
  }
  const deferredRows = state.settlementImportWavePackageReport?.deferred_rows;
  if (Array.isArray(deferredRows)) {
    deferredRows.forEach((row) => {
      if (row.period_name === periodName && row.teacher_name) {
        teacherNames.add(row.teacher_name);
      }
    });
  }
  return [...teacherNames].sort((left, right) =>
    String(left || "").localeCompare(String(right || ""), "zh-CN")
  );
}

function getSettlementImportWavePackagesForTeacherPeriod(periodName, teacherName) {
  const packages = state.settlementImportWavePackageReport?.packages;
  if (!Array.isArray(packages)) {
    return [];
  }
  return packages.filter((item) =>
    Array.isArray(item.included_teacher_periods) &&
    item.included_teacher_periods.some(
      (row) => row.period_name === periodName && row.teacher_name === teacherName
    )
  );
}

function getSettlementImportWaveProfitPeriodRow(periodName) {
  const rows = state.settlementImportWavePackageReport?.profit_period_rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getSettlementImportWaveDeferredRow(periodName, teacherName) {
  const rows = state.settlementImportWavePackageReport?.deferred_rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return (
    rows.find((item) => item.period_name === periodName && item.teacher_name === teacherName) ||
    null
  );
}

function getSettlementImportDeferredActionPackagesForPeriod(periodName) {
  const rows = state.settlementImportDeferredActionReport?.packages;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        reviewPriorityWeight(left.review_priority) -
          reviewPriorityWeight(right.review_priority) ||
        Number(right.validation_issue_count || 0) -
          Number(left.validation_issue_count || 0) ||
        Number(right.counts?.residual_row_count || 0) -
          Number(left.counts?.residual_row_count || 0) ||
        Number(right.counts?.manual_batch_row_count || 0) -
          Number(left.counts?.manual_batch_row_count || 0) ||
        Number(right.counts?.bulk_candidate_row_count || 0) -
          Number(left.counts?.bulk_candidate_row_count || 0) ||
        String(left.teacher_name || "").localeCompare(
          String(right.teacher_name || ""),
          "zh-CN"
        )
    );
}

function getSettlementImportDeferredActionTeacherNamesForPeriod(periodName) {
  return getSettlementImportDeferredActionPackagesForPeriod(periodName).map(
    (item) => item.teacher_name
  );
}

function getSettlementImportDeferredActionPackage(periodName, teacherName) {
  return (
    getSettlementImportDeferredActionPackagesForPeriod(periodName).find(
      (item) => item.teacher_name === teacherName
    ) || null
  );
}

function getSettlementImportExecutionPeriodRow(periodName) {
  const rows = state.settlementImportExecutionReport?.period_rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getSettlementImportExecutionRowsForPeriod(periodName) {
  const rows = state.settlementImportExecutionReport?.teacher_wave_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        Number(left.execution_wave_order || 0) -
          Number(right.execution_wave_order || 0) ||
        Number(right.action_priority_score || 0) -
          Number(left.action_priority_score || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
}

function getSettlementImportExecutionTeacherRow(periodName, teacherName) {
  return (
    getSettlementImportExecutionRowsForPeriod(periodName).find(
      (item) => item.teacher_name === teacherName
    ) || null
  );
}

function getSettlementOpsActionPeriodRow(periodName) {
  const rows = state.settlementOpsActionReport?.period_rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getSettlementOpsActionRowsForPeriod(periodName) {
  const rows = state.settlementOpsActionReport?.teacher_action_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        Number(right.action_priority_score || 0) -
          Number(left.action_priority_score || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
}

function getSettlementOpsActionTeacherRow(periodName, teacherName) {
  return (
    getSettlementOpsActionRowsForPeriod(periodName).find(
      (item) => item.teacher_name === teacherName
    ) || null
  );
}

function getSettlementReviewQueuePeriodSummary(periodName) {
  const rows = state.settlementReviewQueue?.period_summaries;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getSettlementReviewQueueRow(periodName, teacherName) {
  const rows = state.settlementReviewQueue?.review_queue;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName && item.teacher_name === teacherName) || null;
}

function getSettlementReviewFollowupRowsForPeriod(periodName) {
  const rows = state.settlementReviewFollowupReport?.followups;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        reviewPriorityWeight(left.priority) - reviewPriorityWeight(right.priority) ||
        left.teacher_name.localeCompare(right.teacher_name, "zh-CN")
    );
}

function getSettlementReviewFollowupRow(periodName, teacherName) {
  return (
    getSettlementReviewFollowupRowsForPeriod(periodName).find(
      (item) => item.teacher_name === teacherName
    ) || null
  );
}

function getScheduleReviewDeskPeriods() {
  const periods = new Set();
  const addPeriod = (value) => {
    const clean = String(value || "").trim();
    if (/^\d{4}-\d{2}$/.test(clean)) {
      periods.add(clean);
    }
  };

  const profileSummaries = state.teacherSettlementProfileReport?.period_summaries;
  if (Array.isArray(profileSummaries)) {
    profileSummaries.forEach((item) => addPeriod(item.period_name));
  }

  const manualPeriodSummaries = state.scheduleDraftManualReviewReport?.period_summaries;
  if (Array.isArray(manualPeriodSummaries)) {
    manualPeriodSummaries.forEach((item) => addPeriod(item.period_name));
  }

  const teacherPeriodRows = state.scheduleDraftManualReviewReport?.teacher_period_rows;
  if (Array.isArray(teacherPeriodRows)) {
    teacherPeriodRows.forEach((item) => addPeriod(item.period_name));
  }

  const classBatchRows = state.scheduleDraftManualClassnameBatchCandidatesReport?.batch_rows;
  if (Array.isArray(classBatchRows)) {
    classBatchRows.forEach((item) => addPeriod(item.period_name));
  }

  const combinedBatchRows =
    state.scheduleDraftManualCombinedBatchCandidatesReport?.batch_rows;
  if (Array.isArray(combinedBatchRows)) {
    combinedBatchRows.forEach((item) => addPeriod(item.period_name));
  }

  const batchRows = state.scheduleDraftManualClassroomBatchCandidatesReport?.batch_rows;
  if (Array.isArray(batchRows)) {
    batchRows.forEach((item) => addPeriod(item.period_name));
  }

  const residualTeacherPeriodRows = state.scheduleDraftManualResidualReport?.teacher_period_rows;
  if (Array.isArray(residualTeacherPeriodRows)) {
    residualTeacherPeriodRows.forEach((item) => addPeriod(item.period_name));
  }

  const residualRows = state.scheduleDraftManualResidualReport?.residual_rows;
  if (Array.isArray(residualRows)) {
    residualRows.forEach((item) => addPeriod(item.period_name));
  }

  const reviewRows = state.scheduleDraftReviewReport?.review_rows;
  if (Array.isArray(reviewRows)) {
    reviewRows.forEach((item) => addPeriod(periodKeyFromDateText(item.course_date)));
  }

  return [...periods].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function resolveScheduleReviewDeskPeriod(periods) {
  if (!periods.length) {
    return "";
  }
  if (uiState.scheduleReviewDeskPeriod && periods.includes(uiState.scheduleReviewDeskPeriod)) {
    return uiState.scheduleReviewDeskPeriod;
  }
  if (uiState.settlementPeriod && periods.includes(uiState.settlementPeriod)) {
    return uiState.settlementPeriod;
  }
  return periods[periods.length - 1];
}

function periodKeyFromDateText(rawValue) {
  const clean = String(rawValue || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean.slice(0, 7) : "";
}

function getScheduleReviewTeacherProfilesForPeriod(periodName) {
  const rows = state.teacherSettlementProfileReport?.teacher_profiles;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter(
      (item) =>
        item.period_name === periodName &&
        Number(item.schedule_review_unresolved_row_count || 0) > 0
    )
    .sort((left, right) => {
      const rowByRowDiff =
        Number(right.schedule_review_manual_row_by_row_count || 0) -
        Number(left.schedule_review_manual_row_by_row_count || 0);
      if (rowByRowDiff) {
        return rowByRowDiff;
      }
      const batchDiff =
        Number(right.schedule_review_manual_classname_batch_row_count || 0) -
          Number(left.schedule_review_manual_classname_batch_row_count || 0) ||
        Number(right.schedule_review_manual_classroom_batch_row_count || 0) -
        Number(left.schedule_review_manual_classroom_batch_row_count || 0);
      if (batchDiff) {
        return batchDiff;
      }
      const autoDiff =
        Number(right.schedule_review_auto_candidate_count || 0) -
        Number(left.schedule_review_auto_candidate_count || 0);
      if (autoDiff) {
        return autoDiff;
      }
      return (
        Number(right.schedule_review_unresolved_row_count || 0) -
          Number(left.schedule_review_unresolved_row_count || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
      );
    });
}

function getScheduleDraftManualReviewPeriodSummary(periodName) {
  const rows = state.scheduleDraftManualReviewReport?.period_summaries;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getScheduleDraftManualReviewTeacherPeriods(periodName) {
  const rows = state.scheduleDraftManualReviewReport?.teacher_period_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        Number(right.manual_row_count || 0) - Number(left.manual_row_count || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
}

function getScheduleDraftManualClassroomBatchRows(periodName) {
  const rows = state.scheduleDraftManualClassroomBatchCandidatesReport?.batch_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        Number(right.row_count || 0) - Number(left.row_count || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
}

function getScheduleDraftManualClassnameBatchRows(periodName) {
  const rows = state.scheduleDraftManualClassnameBatchCandidatesReport?.batch_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        ({ low: 0, medium: 1, high: 2, none: 3 }[
          String(left.recommendation_confidence || "").trim()
        ] || 9) -
          ({ low: 0, medium: 1, high: 2, none: 3 }[
            String(right.recommendation_confidence || "").trim()
          ] || 9) ||
        Number(right.row_count || 0) - Number(left.row_count || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
}

function getScheduleDraftManualCombinedBatchRows(periodName) {
  const rows = state.scheduleDraftManualCombinedBatchCandidatesReport?.batch_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        ({ high: 0, medium: 1, low: 2, none: 3 }[
          String(left.recommendation_confidence || "").trim()
        ] || 9) -
          ({ high: 0, medium: 1, low: 2, none: 3 }[
            String(right.recommendation_confidence || "").trim()
          ] || 9) ||
        Number(right.row_count || 0) - Number(left.row_count || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
}

function getScheduleDraftManualResidualPeriodSummary(periodName) {
  const summary = state.scheduleDraftManualResidualReport?.summary;
  if (!summary || typeof summary !== "object") {
    return null;
  }
  const rows = state.scheduleDraftManualResidualReport?.residual_rows;
  const teacherPeriodRows = state.scheduleDraftManualResidualReport?.teacher_period_rows;
  if (!Array.isArray(rows) || !Array.isArray(teacherPeriodRows)) {
    return null;
  }
  const periodRows = rows.filter((item) => item.period_name === periodName);
  if (!periodRows.length) {
    return null;
  }
  const issueCountMap = new Map();
  const categoryCountMap = new Map();
  periodRows.forEach((item) => {
    const issueKey = String(item.issue_flags || "").trim();
    const categoryKey = String(item.residual_category || "").trim();
    if (issueKey) {
      issueCountMap.set(issueKey, (issueCountMap.get(issueKey) || 0) + 1);
    }
    if (categoryKey) {
      categoryCountMap.set(categoryKey, (categoryCountMap.get(categoryKey) || 0) + 1);
    }
  });
  return {
    row_count: periodRows.length,
    teacher_period_count: teacherPeriodRows.filter((item) => item.period_name === periodName)
      .length,
    issue_counts: [...issueCountMap.entries()].map(([issue_flags, count]) => ({
      issue_flags,
      count,
    })),
    category_counts: [...categoryCountMap.entries()].map(([residual_category, count]) => ({
      residual_category,
      count,
    })),
  };
}

function getScheduleDraftManualResidualTeacherPeriods(periodName) {
  const rows = state.scheduleDraftManualResidualReport?.teacher_period_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        Number(right.row_count || 0) - Number(left.row_count || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
    );
}

function getScheduleDraftManualResidualRows(periodName) {
  const rows = state.scheduleDraftManualResidualReport?.residual_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        Number(right.teacher_period_manual_row_count || 0) -
          Number(left.teacher_period_manual_row_count || 0) ||
        String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN") ||
        String(left.course_date || "").localeCompare(String(right.course_date || ""), "zh-CN") ||
        String(left.start_time || "").localeCompare(String(right.start_time || ""), "zh-CN")
    );
}

function getProfitSettlementDividendPeriodRow(periodName) {
  const rows = state.profitSettlementDividendReport?.period_rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getProfitSettlementDividendTeacherRowsForPeriod(periodName) {
  const rows = state.profitSettlementDividendReport?.teacher_rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.period_name === periodName)
    .sort(
      (left, right) =>
        toNumber(right.component_total_amount) - toNumber(left.component_total_amount) ||
        toNumber(right.revenue_total_amount) - toNumber(left.revenue_total_amount) ||
        left.teacher_name.localeCompare(right.teacher_name, "zh-CN")
    );
}

function getProfitSettlementDividendTeacherRow(periodName, teacherName) {
  return (
    getProfitSettlementDividendTeacherRowsForPeriod(periodName).find(
      (item) => item.teacher_name === teacherName
    ) || null
  );
}

function getTeacherSettlementProfilePeriodSummary(periodName) {
  const rows = state.teacherSettlementProfileReport?.period_summaries;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.period_name === periodName) || null;
}

function getTeacherSettlementProfile(periodName, teacherName) {
  const rows = state.teacherSettlementProfileReport?.teacher_profiles;
  if (!Array.isArray(rows)) {
    return null;
  }
  return (
    rows.find((item) => item.period_name === periodName && item.teacher_name === teacherName) ||
    null
  );
}

function getTeacherCompensationPolicySummary() {
  const summary = state.teacherCompensationPolicyReport?.summary;
  return summary && typeof summary === "object" ? summary : null;
}

function getTeacherCompensationPolicyTeacherRow(teacherName) {
  const rows = state.teacherCompensationPolicyReport?.teacher_rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.find((item) => item.teacher_name === teacherName) || null;
}

function getTeacherCompensationPolicyPeriodRow(periodName, teacherName) {
  const rows = state.teacherCompensationPolicyReport?.period_rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  return (
    rows.find(
      (item) => item.period_name === periodName && item.teacher_name === teacherName
    ) || null
  );
}

function getTeacherRuleItemResolutionSummary() {
  const summary = state.teacherRuleItemResolutionTemplate?.summary;
  return summary && typeof summary === "object" ? summary : null;
}

function getTeacherRuleItemResolutionRowsForTeacher(teacherName) {
  const rows = state.teacherRuleItemResolutionTemplate?.rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.teacher_name === teacherName)
    .sort(
      (left, right) =>
        String(left.effective_start_date || "").localeCompare(
          String(right.effective_start_date || ""),
          "zh-CN"
        ) ||
        String(left.scope_label || "").localeCompare(String(right.scope_label || ""), "zh-CN")
    );
}

function getTeacherRuleItemResolutionRowsForTeacherPeriod(periodName, teacherName) {
  return getTeacherRuleItemResolutionRowsForTeacher(teacherName).filter(
    (item) => String(item.effective_start_date || "").slice(0, 7) === periodName
  );
}

function getTeacherRuleBackfillRowsForPeriod(periodName) {
  const rows = state.teacherRuleBackfillTemplate?.rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((item) => item.target_period_name === periodName)
    .sort(
      (left, right) =>
        backfillConfirmStatusWeight(left.confirm_status) -
          backfillConfirmStatusWeight(right.confirm_status) ||
        left.teacher_name.localeCompare(right.teacher_name, "zh-CN")
    );
}

function getTeacherRuleBackfillRow(periodName, teacherName) {
  return (
    getTeacherRuleBackfillRowsForPeriod(periodName).find(
      (item) => item.teacher_name === teacherName
    ) || null
  );
}

function getSettlementReviewResolutionRowsForPeriod(periodName) {
  return state.settlementReviewResolutions
    .filter((item) => item.periodName === periodName)
    .sort(
      (left, right) =>
        reviewPriorityWeight(left.priority) - reviewPriorityWeight(right.priority) ||
        left.teacherName.localeCompare(right.teacherName, "zh-CN")
    );
}

function getSettlementReviewResolutionRow(periodName, teacherName) {
  return (
    state.settlementReviewResolutions.find(
      (item) => item.periodName === periodName && item.teacherName === teacherName
    ) || null
  );
}

function countResolutionStatus(rows, status) {
  return rows.filter((row) => row.resolutionStatus === status).length;
}

function reviewPriorityWeight(priority) {
  return { high: 0, medium: 1, low: 2 }[String(priority || "").trim()] ?? 9;
}

function buildSettlementDiagnosticSummaryHtml(
  periodName,
  bridgePeriodReport,
  reconciliationPeriodSummary,
  profitReconciliationPeriod,
  periodMismatchCount,
  reviewQueuePeriodSummary,
  followupRows,
  reviewResolutionRows
) {
  const safeFollowupRows = Array.isArray(followupRows) ? followupRows : [];
  const safeReviewResolutionRows = Array.isArray(reviewResolutionRows)
    ? reviewResolutionRows
    : [];
  if (
    !hasImportedBridgeReport() &&
    !hasImportedReconciliationReport() &&
    !hasImportedReviewQueue() &&
    !hasImportedSettlementReviewFollowupReport()
  ) {
    return `<div class="empty-state">还没有导入桥接/对账/复核 JSON。建议把 <code>schedule-settlement-bridge-report.json</code>、<code>import-reconciliation-report.json</code>、<code>settlement-review-queue.json</code>、<code>settlement-review-followup-report.json</code> 补导进来。</div>`;
  }

  const cards = [];

  if (reviewQueuePeriodSummary) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">人工复核清单 · ${periodName}</div>
        <div class="list-meta">待办 ${reviewQueuePeriodSummary.review_count} 条 · 高优先级 ${reviewQueuePeriodSummary.high_priority_count} 条 · 中优先级 ${reviewQueuePeriodSummary.medium_priority_count} 条</div>
        <div class="list-meta">把桥接异常和结算对账异常收敛成一张处理单。</div>
      </div>
    `);
  }

  if (safeReviewResolutionRows.length) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">复核处理进度 · ${periodName}</div>
        <div class="list-meta">待处理 ${countResolutionStatus(safeReviewResolutionRows, "pending")} 条 · 处理中 ${countResolutionStatus(safeReviewResolutionRows, "in_progress")} 条 · 已关闭 ${countResolutionStatus(safeReviewResolutionRows, "resolved")} 条 · 仅记录 ${countResolutionStatus(safeReviewResolutionRows, "wont_fix")} 条</div>
        <div class="list-meta">复核结果可以作为后续补源文件、补结算单或确认历史差异的落地记录。</div>
      </div>
    `);
  }

  if (safeFollowupRows.length) {
    const typeCounts = safeFollowupRows.reduce((accumulator, row) => {
      const key = row.followup_type || "manual_review";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
    const typeSummary = Object.entries(typeCounts)
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]), "zh-CN"))
      .map(([type, count]) => `${formatFollowupType(type)} ${count} 条`)
      .join(" / ");
    cards.push(`
      <div class="list-card">
        <div class="list-title">复核跟进包 · ${periodName}</div>
        <div class="list-meta">当前月待办 ${safeFollowupRows.length} 条${typeSummary ? ` · ${typeSummary}` : ""}</div>
        <div class="list-meta">已经把待办细化成“缺结算单 / 汇总板 / 持续缺失学生”这类可执行动作。</div>
      </div>
    `);
  }

  if (bridgePeriodReport) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">课表-结算桥接 · ${periodName}</div>
        <div class="list-meta">状态 ${formatDiagnosticStatus(bridgePeriodReport.status)} · 待复核老师 ${bridgePeriodReport.summary.teachers_needing_review} 人</div>
        <div class="list-meta">课表可计费单元格 ${bridgePeriodReport.summary.total_calendar_billable_cell_count} · 结算明细课次数 ${bridgePeriodReport.summary.total_settlement_session_count}</div>
      </div>
    `);
  }

  if (reconciliationPeriodSummary) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">老师结算对账 · ${periodName}</div>
        <div class="list-meta">待复核老师 ${periodMismatchCount} 人 · 汇总课时提成差额 ${formatAmountText(reconciliationPeriodSummary.difference_vs_reported_teaching_commission)}</div>
        <div class="list-meta">明细提成 ${formatAmountText(reconciliationPeriodSummary.detail_commission_total)} · 汇总课时提成 ${formatAmountText(reconciliationPeriodSummary.reported_teaching_commission_total)}</div>
      </div>
    `);
  }

  if (profitReconciliationPeriod) {
    const totalExpense = profitReconciliationPeriod.expense_scopes?.total_expense || null;
    const teachingExpense = profitReconciliationPeriod.expense_scopes?.teaching_business_expense || null;
    cards.push(`
      <div class="list-card">
        <div class="list-title">利润对账 · ${periodName}</div>
        <div class="list-meta">老师课时剩余差额 ${formatAmountText(profitReconciliationPeriod.teacher_balance_difference)} · 毛利润减教学支出差额 ${formatAmountText(profitReconciliationPeriod.gross_minus_teaching_business_difference)}</div>
        <div class="list-meta">总支出差额 ${formatAmountText(totalExpense?.difference || "")}${totalExpense?.difference_fully_explained_by_expression_rows ? " · 已被表达式原值解释" : ""}</div>
        <div class="list-meta">教学支出差额 ${formatAmountText(teachingExpense?.difference || "")}</div>
      </div>
    `);
  }

  return cards.join("") || `<div class="empty-state">${periodName} 还没有可用的导入诊断数据。</div>`;
}

function buildCompensationImportReadinessHtml(periodName, periodRow, teacherRow) {
  if (!hasImportedCompensationImportReadinessReport()) {
    return `<div class="empty-state">导入 compensation-import-readiness-report.json 后，这里会显示课时费表按月份和按老师的接入就绪状态。</div>`;
  }

  const cards = [];
  if (periodRow) {
    const scheduleBlockedCount =
      Number(periodRow.needs_schedule_review_teacher_count || 0) +
      Number(periodRow.needs_manual_review_teacher_count || 0);
    cards.push(`
      <div class="list-card">
        <div class="list-title">月份接入概览 · ${periodName}</div>
        <div class="list-meta">源表：${periodRow.source_workbook_names || "—"}</div>
        <div class="list-meta">明细老师 ${periodRow.student_detail_teacher_count || 0} · 汇总板 ${periodRow.summary_only_teacher_count || 0} · 结算汇总 ${periodRow.settlement_statement_teacher_count || 0}</div>
        <div class="list-meta">缺结算 ${periodRow.missing_statement_teacher_count || 0} · 缺规则 ${periodRow.needs_rule_inference_teacher_count || 0} · 排课阻塞 ${scheduleBlockedCount} · 可迁移 ${periodRow.ready_for_rule_migration_teacher_count || 0}</div>
        <div class="list-meta">净利润 ${periodRow.net_profit_amount_raw || "—"} · 分红比例 ${periodRow.dividend_rate_percent ? `${periodRow.dividend_rate_percent}%` : "—"}</div>
      </div>
    `);

    const issueNotes = [];
    if (periodRow.missing_statement_teacher_names) {
      issueNotes.push(`缺结算：${periodRow.missing_statement_teacher_names}`);
    }
    if (periodRow.summary_only_manual_board_teacher_names) {
      issueNotes.push(`汇总板：${periodRow.summary_only_manual_board_teacher_names}`);
    }
    if (periodRow.needs_rule_inference_teacher_names) {
      issueNotes.push(`缺规则：${periodRow.needs_rule_inference_teacher_names}`);
    }
    if (issueNotes.length) {
      cards.push(`
        <div class="list-card">
          <div class="list-title">当前月重点阻塞</div>
          ${issueNotes.map((note) => `<div class="list-meta">${note}</div>`).join("")}
        </div>
      `);
    }
  }

  if (teacherRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师接入状态 · ${teacherRow.teacher_name}</div>
        <div class="list-meta">状态 ${formatProfileReadinessStatus(teacherRow.readiness_status)} · ${teacherRow.review_priority ? formatReviewPriority(teacherRow.review_priority) : "无优先级标注"}</div>
        <div class="list-meta">源表 ${teacherRow.source_workbook_names || "—"} / 源页 ${teacherRow.sheet_kinds || "—"}</div>
        <div class="list-meta">结算汇总 ${Number(teacherRow.has_settlement_statement || 0) ? "已识别" : "缺失"} · 明细 ${teacherRow.detail_row_count || 0} 行 · 免费档 ${teacherRow.free_slot_count || 0} 条</div>
        ${
          teacherRow.current_rule_display || teacherRow.future_rule_display || teacherRow.suggested_rule_display
            ? `<div class="list-meta">规则：当前 ${teacherRow.current_rule_display || "—"} / 未来 ${teacherRow.future_rule_display || "—"} / 建议 ${teacherRow.suggested_rule_display || "—"}</div>`
            : ""
        }
        ${
          teacherRow.current_rule_source_label || teacherRow.future_rule_source_label
            ? `<div class="list-meta">规则来源：当前 ${teacherRow.current_rule_source_label || "—"} / 未来 ${teacherRow.future_rule_source_label || "—"}</div>`
            : ""
        }
        <div class="list-meta">排课未关 ${teacherRow.schedule_review_unresolved_row_count || 0} 条 · 批量后预计剩余 ${teacherRow.schedule_review_projected_unresolved_row_count || 0} 条</div>
        ${teacherRow.followup_type ? `<div class="list-meta">跟进类型：${formatFollowupType(teacherRow.followup_type)}</div>` : ""}
        ${teacherRow.projected_readiness_status_after_bulk ? `<div class="list-meta">批量后状态：${formatProfileReadinessStatus(teacherRow.projected_readiness_status_after_bulk)}</div>` : ""}
        ${teacherRow.recommended_next_step ? `<div class="list-meta">下一步：${teacherRow.recommended_next_step}</div>` : ""}
      </div>
    `);
  }

  return cards.join("") || `<div class="empty-state">${periodName || "当前月份"} 还没有课时费导入就绪数据。</div>`;
}

function buildSettlementImportExecutionHtml(periodName, periodRow, teacherRow) {
  if (!hasImportedSettlementImportExecutionReport()) {
    return `<div class="empty-state">导入 settlement-import-execution-report.json 后，这里会显示当前月份的结算迁移波次。</div>`;
  }

  const report =
    state.settlementImportExecutionReport ||
    createEmptySettlementImportExecutionReport();
  const summary = report.summary || {};
  const cards = [];
  cards.push(`
    <div class="list-card">
      <div class="list-title">执行波次总览</div>
      <div class="list-meta">利润月份 ${summary.profit_period_count || 0} 个 · 当前安全 ${summary.profit_ready_current_safe_period_count || 0} 个 · 高置信后 ${summary.profit_ready_after_bulk_period_count || 0} 个 · 批量后 ${summary.profit_ready_after_manual_batches_period_count || 0} 个 · 仍阻塞 ${summary.profit_blocked_period_count || 0} 个</div>
      <div class="list-meta">迁移候选 ${summary.executable_candidate_teacher_period_count || 0} 人月 · 第0波 ${summary.ready_now_teacher_period_count || 0} 人月 · 第1波 ${summary.ready_after_bulk_teacher_period_count || 0} 人月 · 第2波 ${summary.ready_after_manual_batches_teacher_period_count || 0} 人月</div>
    </div>
  `);
  if (periodRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">月份迁移波次 · ${periodName}</div>
        <div class="list-meta">迁移候选 ${periodRow.executable_candidate_teacher_count || 0} 人 · 第0波 ${periodRow.ready_now_teacher_count || 0} 人 · 第1波 ${periodRow.ready_after_bulk_teacher_count || 0} 人 · 第2波 ${periodRow.ready_after_manual_batches_teacher_count || 0} 人</div>
        <div class="list-meta">第2.5波 ${periodRow.manual_review_after_bulk_teacher_count || 0} 人 · 第3波 ${periodRow.row_by_row_teacher_count || 0} 人 · 缺结算 ${periodRow.blocked_missing_statement_teacher_count || 0} 人</div>
        <div class="list-meta">排课未关 ${periodRow.total_schedule_unresolved_row_count || 0} 条 · 高置信可压 ${periodRow.total_batch_gain_row_count || 0} 条 · 批量可压 ${periodRow.total_manual_batch_gain_row_count || 0} 条</div>
        <div class="list-meta">净利润 ${periodRow.net_profit_amount_raw || "—"} · 分红比例 ${periodRow.dividend_rate_percent ? `${periodRow.dividend_rate_percent}%` : "—"}</div>
        ${
          periodRow.profit_readiness_status_label
            ? `<div class="list-meta">利润收口 ${periodRow.profit_readiness_status_label} · 当前安全 ${periodRow.profit_ready_current_safe_teacher_count || 0}/${periodRow.teacher_period_count || 0} · 高置信后 ${periodRow.profit_ready_after_bulk_teacher_count || 0}/${periodRow.teacher_period_count || 0} · 批量后 ${periodRow.profit_ready_after_manual_batches_teacher_count || 0}/${periodRow.teacher_period_count || 0}</div>`
            : ""
        }
        ${
          periodRow.profit_blocking_wave_counts_text
            ? `<div class="list-meta">利润阻塞：${periodRow.profit_blocking_wave_counts_text}</div>`
            : ""
        }
        ${
          periodRow.profit_blocking_teacher_names_text
            ? `<div class="list-meta">利润阻塞老师：${periodRow.profit_blocking_teacher_names_text}</div>`
            : ""
        }
        ${periodRow.wave_counts_text ? `<div class="list-meta">${periodRow.wave_counts_text}</div>` : ""}
      </div>
    `);
    if (periodRow.next_execution_teacher_names) {
      cards.push(`
        <div class="list-card">
          <div class="list-title">当前迁移队列</div>
          <div class="list-meta">${periodRow.next_execution_teacher_names}</div>
        </div>
      `);
    }
  }

  if (teacherRow) {
    const suggestedFiles = Array.isArray(teacherRow.suggested_input_files)
      ? teacherRow.suggested_input_files
      : [];
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师波次 · ${teacherRow.teacher_name}</div>
        <div class="list-meta">${teacherRow.execution_wave_label || "未分类"} · ${teacherRow.review_priority ? formatReviewPriority(teacherRow.review_priority) : "无优先级标注"}</div>
        <div class="list-meta">未关 ${teacherRow.schedule_review_unresolved_row_count || 0} 条 · 高置信可压 ${teacherRow.schedule_batch_gain_row_count || 0} 条 · 批量可压 ${teacherRow.schedule_manual_batch_gain_row_count || 0} 条 · 逐条尾项 ${teacherRow.schedule_review_projected_row_by_row_count_after_manual_batches || 0} 条</div>
        ${teacherRow.profit_unlock_stage_label ? `<div class="list-meta">利润影响：${teacherRow.profit_unlock_stage_label}</div>` : ""}
        ${teacherRow.execution_gate_reason ? `<div class="list-meta">${teacherRow.execution_gate_reason}</div>` : ""}
        ${teacherRow.execution_path_summary ? `<div class="list-meta">路径：${teacherRow.execution_path_summary}</div>` : ""}
        ${suggestedFiles.length ? `<div class="list-meta">建议先开：${suggestedFiles.join(" / ")}</div>` : ""}
        ${teacherRow.recommended_next_step ? `<div class="list-meta">下一步：${teacherRow.recommended_next_step}</div>` : ""}
      </div>
    `);
  }

  const focusRows = getSettlementImportExecutionRowsForPeriod(periodName)
    .filter((item) => !Number(item.is_hold || 0))
    .slice(0, 3);
  focusRows.forEach((row) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${row.teacher_name} · ${row.execution_wave_label || "未分类"}</div>
        <div class="list-meta">未关 ${row.schedule_review_unresolved_row_count || 0} 条 · 高置信可压 ${row.schedule_batch_gain_row_count || 0} 条 · 批量可压 ${row.schedule_manual_batch_gain_row_count || 0} 条</div>
        ${row.profit_unlock_stage_label ? `<div class="list-meta">利润影响：${row.profit_unlock_stage_label}</div>` : ""}
        <div class="list-meta">${row.execution_gate_reason || row.execution_path_summary || "继续推进当前迁移波次。"}</div>
      </div>
    `);
  });

  return cards.join("") || `<div class="empty-state">${periodName || "当前月份"} 还没有结算迁移波次数据。</div>`;
}

function buildSettlementImportWavePackageHtml(
  periodName,
  teacherName,
  selectedPackages,
  profitPeriodRow,
  deferredRow
) {
  if (!hasImportedSettlementImportWavePackageReport()) {
    return `<div class="empty-state">导入 settlement-import-wave-package-report.json 后，这里会显示当前月份已经可执行的 SQL 包。</div>`;
  }

  const report = state.settlementImportWavePackageReport || createEmptySettlementImportWavePackageReport();
  const summary = report.summary || {};
  const packages = Array.isArray(report.packages) ? report.packages : [];
  const periodPackageCount = packages.filter((item) =>
    Array.isArray(item.included_period_names) && item.included_period_names.includes(periodName)
  ).length;
  const periodDeferredCount = (Array.isArray(report.deferred_rows) ? report.deferred_rows : []).filter(
    (item) => item.period_name === periodName
  ).length;
  const cards = [
    `
      <div class="list-card">
        <div class="list-title">分波包总览</div>
        <div class="list-meta">共 ${summary.package_count || 0} 包 · 当前安全 ${summary.current_safe_teacher_period_count || 0} 人月 · 高置信后 ${summary.after_bulk_teacher_period_count || 0} 人月 · 批量确认后 ${summary.after_manual_batches_teacher_period_count || 0} 人月</div>
        <div class="list-meta">延期 ${summary.deferred_teacher_period_count || 0} 人月 · 可连带利润月份 ${summary.max_profit_ready_period_count || 0} 个 · 利润月份 ${summary.profit_period_count || 0} 个 · 仍阻塞 ${summary.profit_blocked_period_count || 0} 个 · 源老师月份 ${summary.source_teacher_period_count || 0} 个</div>
      </div>
    `,
  ];

  if (periodName) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">本月包覆盖 · ${periodName}</div>
        <div class="list-meta">覆盖分波包 ${periodPackageCount} 个 · 仍延期 ${periodDeferredCount} 人月</div>
        <div class="list-meta">利润只有在整月老师月份全部进入已纳入波次后才会一起放进包里。</div>
      </div>
    `);
  }

  if (profitPeriodRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">本月利润联动 · ${periodName}</div>
        <div class="list-meta">${profitPeriodRow.profit_readiness_status_label || profitPeriodRow.profit_readiness_status || "未标注"} · 当前安全 ${profitPeriodRow.current_safe_teacher_period_count || 0}/${profitPeriodRow.teacher_period_count || 0} · 高置信后 ${profitPeriodRow.after_bulk_teacher_period_count || 0}/${profitPeriodRow.teacher_period_count || 0} · 批量后 ${profitPeriodRow.after_manual_batches_teacher_period_count || 0}/${profitPeriodRow.teacher_period_count || 0}</div>
        <div class="list-meta">净利润 ${profitPeriodRow.net_profit_amount_raw || "—"} · 分红比例 ${profitPeriodRow.dividend_rate_percent ? `${profitPeriodRow.dividend_rate_percent}%` : "—"}</div>
        ${
          profitPeriodRow.profit_ready_package_label
            ? `<div class="list-meta">该月份利润与费用可随「${profitPeriodRow.profit_ready_package_label}」一起导入。</div>`
            : `<div class="list-meta">仍阻塞 ${profitPeriodRow.blocking_teacher_period_count || 0} 个老师月份 · ${profitPeriodRow.blocking_execution_wave_counts_text || "未分类"}</div>`
        }
        ${
          !profitPeriodRow.profit_ready_package_label && profitPeriodRow.blocking_teacher_names_text
            ? `<div class="list-meta">阻塞老师：${profitPeriodRow.blocking_teacher_names_text}</div>`
            : ""
        }
        ${
          !profitPeriodRow.profit_ready_package_label && profitPeriodRow.next_recommended_step
            ? `<div class="list-meta">下一步：${profitPeriodRow.next_recommended_step}</div>`
            : ""
        }
      </div>
    `);
  }

  if (teacherName && selectedPackages.length) {
    const packageSummary = selectedPackages
      .map((item) => {
        const includedRow = (item.included_teacher_periods || []).find(
          (row) => row.period_name === periodName && row.teacher_name === teacherName
        );
        return `${item.label}${includedRow?.execution_wave_label ? `（${includedRow.execution_wave_label}）` : ""}`;
      })
      .join(" / ");
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师已入包 · ${teacherName}</div>
        <div class="list-meta">${packageSummary}</div>
        <div class="list-meta">这说明该老师月份已经进入对应阶段的可执行 SQL 迁移包。</div>
      </div>
    `);
  } else if (teacherName && deferredRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师暂未入包 · ${teacherName}</div>
        <div class="list-meta">${deferredRow.execution_wave_label || "未分类"} · ${deferredRow.review_priority ? formatReviewPriority(deferredRow.review_priority) : "无优先级标注"}</div>
        ${deferredRow.execution_gate_reason ? `<div class="list-meta">${deferredRow.execution_gate_reason}</div>` : ""}
        ${deferredRow.projected_readiness_status_after_bulk ? `<div class="list-meta">批量后状态：${formatProfileReadinessStatus(deferredRow.projected_readiness_status_after_bulk)}</div>` : ""}
        ${deferredRow.recommended_next_step ? `<div class="list-meta">下一步：${deferredRow.recommended_next_step}</div>` : ""}
      </div>
    `);
  }

  packages.forEach((item) => {
    const includesSelectedTeacher = selectedPackages.some(
      (selectedItem) => selectedItem.package_id === item.package_id
    );
    const packageLabel = includesSelectedTeacher
      ? `${item.label} · 已覆盖当前老师`
      : item.label;
    cards.push(`
      <div class="list-card">
        <div class="list-title">${packageLabel}</div>
        <div class="list-meta">老师月份 ${item.included_teacher_period_count || 0} 个 · 利润月份 ${(item.included_profit_period_names || []).length} 个 · 预检 ${item.preflight_status || "unknown"}</div>
        <div class="list-meta">波次 ${(item.included_execution_waves || []).join(" / ") || "—"} · CSV ${(item.exported_csv_files || []).length} 个 · 剩余 ${item.remaining_teacher_period_count || 0} 人月</div>
        ${item.notes ? `<div class="list-meta">${item.notes}</div>` : ""}
      </div>
    `);
  });

  return cards.join("") || `<div class="empty-state">${periodName || "当前月份"} 还没有分波包数据。</div>`;
}

function formatSettlementExecutionWaveKey(wave) {
  return {
    current_safe: "当前安全",
    ready_now: "第0波",
    ready_after_bulk: "第1波",
    ready_after_manual_batches: "第2波",
    manual_review_after_bulk: "第2.5波",
    row_by_row_final: "第3波",
    blocked_missing_statement: "缺结算",
    blocked_rule_backfill: "缺规则",
  }[String(wave || "").trim()] || (wave || "未分类");
}

function formatDeferredActionValidationStatus(status) {
  return {
    ok: "校验通过",
    warning: "校验有提醒",
    error: "校验失败",
  }[String(status || "").trim()] || (status || "未校验");
}

function formatDeferredActionCountsSummary(counts) {
  if (!counts || typeof counts !== "object") {
    return "还没有动作分解。";
  }

  return [
    `高置信 ${Number(counts.bulk_candidate_row_count || 0)} 条`,
    `班名批量 ${Number(counts.manual_classname_batch_group_count || 0)} 组/${Number(counts.manual_classname_batch_row_count || 0)} 条`,
    `教室批量 ${Number(counts.manual_classroom_batch_group_count || 0)} 组/${Number(counts.manual_classroom_batch_row_count || 0)} 条`,
    `组合批量 ${Number(counts.manual_combined_batch_group_count || 0)} 组/${Number(counts.manual_combined_batch_row_count || 0)} 条`,
    `尾项 ${Number(counts.residual_row_count || 0)} 条`,
  ].join(" · ");
}

function buildSettlementImportDeferredActionHtml(
  periodName,
  teacherName,
  packageEntry
) {
  if (!hasImportedSettlementImportDeferredActionReport()) {
    return `<div class="empty-state">导入 settlement-import-deferred-action-report.json 后，这里会显示当前月份的延期清零动作包。</div>`;
  }

  const report =
    state.settlementImportDeferredActionReport ||
    createEmptySettlementImportDeferredActionReport();
  const summary = report.summary || {};
  const allPackages = Array.isArray(report.packages) ? report.packages : [];
  const periodPackages = periodName
    ? getSettlementImportDeferredActionPackagesForPeriod(periodName)
    : allPackages;
  const periodSummary = periodPackages.reduce(
    (accumulator, item) => {
      accumulator.bulk_candidate_row_count += Number(
        item.counts?.bulk_candidate_row_count || 0
      );
      accumulator.manual_classname_batch_group_count += Number(
        item.counts?.manual_classname_batch_group_count || 0
      );
      accumulator.manual_classname_batch_row_count += Number(
        item.counts?.manual_classname_batch_row_count || 0
      );
      accumulator.manual_classroom_batch_group_count += Number(
        item.counts?.manual_classroom_batch_group_count || 0
      );
      accumulator.manual_classroom_batch_row_count += Number(
        item.counts?.manual_classroom_batch_row_count || 0
      );
      accumulator.manual_combined_batch_group_count += Number(
        item.counts?.manual_combined_batch_group_count || 0
      );
      accumulator.manual_combined_batch_row_count += Number(
        item.counts?.manual_combined_batch_row_count || 0
      );
      accumulator.manual_batch_row_count += Number(
        item.counts?.manual_batch_row_count || 0
      );
      accumulator.residual_row_count += Number(item.counts?.residual_row_count || 0);
      accumulator.validation_issue_teacher_period_count += Number(
        item.validation_issue_count ? 1 : 0
      );
      const waveKey = String(item.execution_wave || "").trim();
      if (waveKey) {
        accumulator.execution_wave_counts[waveKey] =
          Number(accumulator.execution_wave_counts[waveKey] || 0) + 1;
      }
      const validationKey = String(item.validation_status || "").trim() || "unknown";
      accumulator.validation_status_counts[validationKey] =
        Number(accumulator.validation_status_counts[validationKey] || 0) + 1;
      return accumulator;
    },
    {
      bulk_candidate_row_count: 0,
      manual_classname_batch_group_count: 0,
      manual_classname_batch_row_count: 0,
      manual_classroom_batch_group_count: 0,
      manual_classroom_batch_row_count: 0,
      manual_combined_batch_group_count: 0,
      manual_combined_batch_row_count: 0,
      manual_batch_row_count: 0,
      residual_row_count: 0,
      validation_issue_teacher_period_count: 0,
      execution_wave_counts: {},
      validation_status_counts: {},
    }
  );
  const cards = [
    `
      <div class="list-card">
        <div class="list-title">延期清零总览</div>
        <div class="list-meta">共 ${summary.package_count || 0} 包 · 高置信 ${summary.total_bulk_candidate_row_count || 0} 条 · 班名批量 ${summary.total_manual_classname_batch_group_count || 0} 组/${summary.total_manual_classname_batch_row_count || 0} 条 · 教室批量 ${summary.total_manual_classroom_batch_group_count || 0} 组/${summary.total_manual_classroom_batch_row_count || 0} 条</div>
        <div class="list-meta">组合批量 ${summary.total_manual_combined_batch_group_count || 0} 组/${summary.total_manual_combined_batch_row_count || 0} 条 · 尾项 ${summary.total_residual_row_count || 0} 条 · 校验提醒 ${summary.validation_issue_teacher_period_count || 0} 人月</div>
      </div>
    `,
  ];

  if (periodName) {
    const waveText = Object.entries(periodSummary.execution_wave_counts)
      .map(([key, count]) => `${formatSettlementExecutionWaveKey(key)} ${count} 人`)
      .join(" · ");
    const validationText = Object.entries(periodSummary.validation_status_counts)
      .map(
        ([key, count]) =>
          `${formatDeferredActionValidationStatus(key)} ${count} 人`
      )
      .join(" · ");
    cards.push(`
      <div class="list-card">
        <div class="list-title">本月延期包 · ${periodName}</div>
        <div class="list-meta">老师月份 ${periodPackages.length} 个 · ${formatDeferredActionCountsSummary(periodSummary)}</div>
        ${waveText ? `<div class="list-meta">${waveText}</div>` : ""}
        ${validationText ? `<div class="list-meta">${validationText}</div>` : ""}
      </div>
    `);
  }

  if (teacherName && packageEntry) {
    const stageSummary = Array.isArray(packageEntry.stage_rows)
      ? packageEntry.stage_rows
          .map((item) => {
            const groupText = Number(item.group_count || 0)
              ? `${Number(item.group_count || 0)} 组 / `
              : "";
            return `${item.label || item.stage_key || "未命名阶段"} ${groupText}${Number(item.row_count || 0)} 条`;
          })
          .join(" · ")
      : "";
    const workbookNames = Array.isArray(packageEntry.source_workbook_names)
      ? packageEntry.source_workbook_names.join(" / ")
      : "";
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师延期包 · ${teacherName}</div>
        <div class="list-meta">${packageEntry.execution_wave_label || "未分类"} · ${packageEntry.review_priority ? formatReviewPriority(packageEntry.review_priority) : "无优先级标注"} · ${formatDeferredActionValidationStatus(packageEntry.validation_status)}</div>
        <div class="list-meta">状态 ${packageEntry.readiness_status ? formatProfileReadinessStatus(packageEntry.readiness_status) : "未标注"}${packageEntry.projected_readiness_status_after_bulk ? ` · 批量后 ${formatProfileReadinessStatus(packageEntry.projected_readiness_status_after_bulk)}` : ""}</div>
        <div class="list-meta">${formatDeferredActionCountsSummary(packageEntry.counts)}</div>
        ${packageEntry.execution_path_summary ? `<div class="list-meta">路径：${packageEntry.execution_path_summary}</div>` : ""}
        ${stageSummary ? `<div class="list-meta">动作：${stageSummary}</div>` : ""}
        ${packageEntry.execution_gate_reason ? `<div class="list-meta">${packageEntry.execution_gate_reason}</div>` : ""}
        ${packageEntry.recommended_next_step ? `<div class="list-meta">下一步：${packageEntry.recommended_next_step}</div>` : ""}
        ${packageEntry.suggested_completion_signal ? `<div class="list-meta">完成信号：${packageEntry.suggested_completion_signal}</div>` : ""}
        ${workbookNames ? `<div class="list-meta">源工资表：${workbookNames}</div>` : ""}
        ${packageEntry.paths?.action_checklist_markdown ? `<div class="list-meta">清单：${packageEntry.paths.action_checklist_markdown}</div>` : ""}
      </div>
    `);
  } else if (teacherName && periodName) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师不在延期包 · ${teacherName}</div>
        <div class="list-meta">这通常表示该老师本月不在延期清零队列，或者已进入分波包/执行波次的其他阶段。</div>
      </div>
    `);
  }

  periodPackages.slice(0, 3).forEach((item) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${item.teacher_name} · ${item.execution_wave_label || "未分类"}</div>
        <div class="list-meta">${item.review_priority ? formatReviewPriority(item.review_priority) : "无优先级"} · ${formatDeferredActionValidationStatus(item.validation_status)} · ${item.readiness_status ? formatProfileReadinessStatus(item.readiness_status) : "未标注"}</div>
        <div class="list-meta">${formatDeferredActionCountsSummary(item.counts)}</div>
        <div class="list-meta">${item.recommended_next_step || item.execution_gate_reason || "继续按清零包推进。"}</div>
      </div>
    `);
  });

  return cards.join("") || `<div class="empty-state">${periodName || "当前月份"} 还没有延期清零包数据。</div>`;
}

function buildSettlementOpsActionHtml(periodName, periodRow, teacherRow) {
  if (!hasImportedSettlementOpsActionReport()) {
    return `<div class="empty-state">导入 settlement-ops-action-report.json 后，这里会显示当前月份的统一动作顺序。</div>`;
  }

  const report = state.settlementOpsActionReport || createEmptySettlementOpsActionReport();
  const summary = report.summary || {};
  const cards = [];
  cards.push(`
    <div class="list-card">
      <div class="list-title">动作总表总览</div>
      <div class="list-meta">利润月份 ${summary.profit_period_count || 0} 个 · 当前安全 ${summary.profit_ready_current_safe_period_count || 0} 个 · 高置信后 ${summary.profit_ready_after_bulk_period_count || 0} 个 · 批量后 ${summary.profit_ready_after_manual_batches_period_count || 0} 个 · 仍阻塞 ${summary.profit_blocked_period_count || 0} 个</div>
      <div class="list-meta">待动作 ${summary.actionable_teacher_period_count || 0} 人月 · 已就绪 ${summary.ready_now_teacher_period_count || 0} 人月 · 高置信后可就绪 ${summary.ready_after_bulk_teacher_period_count || 0} 人月</div>
    </div>
  `);

  if (periodRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">月份动作概览 · ${periodName}</div>
        <div class="list-meta">当前待动作 ${periodRow.actionable_teacher_period_count || 0} 人 · 已就绪 ${periodRow.ready_now_teacher_count || 0} 人 · 高置信后可就绪 ${periodRow.ready_after_bulk_teacher_count || 0} 人</div>
        <div class="list-meta">排课未关 ${periodRow.total_schedule_unresolved_row_count || 0} 条 · 高置信理论可压 ${periodRow.total_batch_gain_row_count || 0} 条 · 净利润 ${periodRow.net_profit_amount_raw || "—"} · 分红比例 ${periodRow.dividend_rate_percent ? `${periodRow.dividend_rate_percent}%` : "—"}</div>
        ${
          periodRow.profit_readiness_status_label
            ? `<div class="list-meta">利润收口 ${periodRow.profit_readiness_status_label} · 当前安全 ${periodRow.profit_ready_current_safe_teacher_count || 0}/${periodRow.teacher_period_count || 0} · 高置信后 ${periodRow.profit_ready_after_bulk_teacher_count || 0}/${periodRow.teacher_period_count || 0} · 批量后 ${periodRow.profit_ready_after_manual_batches_teacher_count || 0}/${periodRow.teacher_period_count || 0}</div>`
            : ""
        }
        ${
          periodRow.profit_blocking_stage_counts_text
            ? `<div class="list-meta">利润阻塞：${periodRow.profit_blocking_stage_counts_text}</div>`
            : ""
        }
        ${
          periodRow.profit_blocking_teacher_names_text
            ? `<div class="list-meta">利润阻塞老师：${periodRow.profit_blocking_teacher_names_text}</div>`
            : ""
        }
        ${periodRow.action_stage_counts_text ? `<div class="list-meta">${periodRow.action_stage_counts_text}</div>` : ""}
      </div>
    `);
    if (periodRow.top_action_teacher_names) {
      cards.push(`
        <div class="list-card">
          <div class="list-title">本月优先老师</div>
          <div class="list-meta">${periodRow.top_action_teacher_names}</div>
        </div>
      `);
    }
  }

  if (teacherRow) {
    const suggestedFiles = Array.isArray(teacherRow.suggested_input_files)
      ? teacherRow.suggested_input_files
      : [];
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师动作 · ${teacherRow.teacher_name}</div>
        <div class="list-meta">阶段 ${teacherRow.action_stage_label || "继续复核"} · 阻塞 ${teacherRow.blocking_family_label || "其他"} · 优先级 ${teacherRow.review_priority ? formatReviewPriority(teacherRow.review_priority) : "无标注"}</div>
        <div class="list-meta">未关 ${teacherRow.schedule_review_unresolved_row_count || 0} 条 · 高置信可压 ${teacherRow.schedule_batch_gain_row_count || 0} 条 · 批量后逐条 ${teacherRow.schedule_review_projected_row_by_row_count_after_manual_batches || 0} 条</div>
        ${teacherRow.profit_unlock_stage_label ? `<div class="list-meta">利润影响：${teacherRow.profit_unlock_stage_label}</div>` : ""}
        ${teacherRow.focus_reason ? `<div class="list-meta">${teacherRow.focus_reason}</div>` : ""}
        ${teacherRow.operator_hint ? `<div class="list-meta">操作提示：${teacherRow.operator_hint}</div>` : ""}
        ${suggestedFiles.length ? `<div class="list-meta">建议先开：${suggestedFiles.join(" / ")}</div>` : ""}
        ${teacherRow.recommended_next_step ? `<div class="list-meta">下一步：${teacherRow.recommended_next_step}</div>` : ""}
        ${teacherRow.suggested_completion_signal ? `<div class="list-meta">完成标志：${teacherRow.suggested_completion_signal}</div>` : ""}
      </div>
    `);
  }

  const focusRows = getSettlementOpsActionRowsForPeriod(periodName)
    .filter((item) => Number(item.is_actionable || 0))
    .slice(0, 3);
  focusRows.forEach((row) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${row.teacher_name} · ${row.action_stage_label || "继续复核"}</div>
        <div class="list-meta">${row.blocking_family_label || "其他"} · 未关 ${row.schedule_review_unresolved_row_count || 0} 条 · 高置信可压 ${row.schedule_batch_gain_row_count || 0} 条</div>
        <div class="list-meta">${row.focus_reason || row.operator_hint || "继续收敛当前老师月份阻塞。"}</div>
      </div>
    `);
  });

  return cards.join("") || `<div class="empty-state">${periodName || "当前月份"} 还没有统一动作数据。</div>`;
}

function buildTeacherSettlementProfileHtml(periodSummary, teacherProfile) {
  if (!hasImportedTeacherSettlementProfileReport()) {
    return `<div class="empty-state">导入老师结算画像报告后，这里会显示当前月份和当前老师的迁移就绪情况。</div>`;
  }

  const cards = [];
  if (periodSummary) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">月份画像概览 · ${periodSummary.period_name}</div>
        <div class="list-meta">就绪 ${periodSummary.ready_for_rule_migration_count}/${periodSummary.teacher_count} · 历史归档 ${periodSummary.historical_archive_confirmed_count || 0} · 补源 ${periodSummary.needs_source_backfill_count} · 汇总板 ${periodSummary.summary_only_manual_board_count}</div>
        <div class="list-meta">排课复核 ${periodSummary.needs_schedule_review_count || 0} · 人工复核 ${periodSummary.needs_manual_review_count} · 待关闭 ${periodSummary.pending_resolution_count} · 已关闭 ${periodSummary.resolved_resolution_count}</div>
      </div>
    `);
  }

  if (teacherProfile) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师画像 · ${teacherProfile.teacher_name}</div>
        <div class="list-meta">状态 ${formatProfileReadinessStatus(teacherProfile.readiness_status)} · 主规则 ${teacherProfile.rule_revenue_share_ratio ? formatRatioPercent(teacherProfile.rule_revenue_share_ratio) : (teacherProfile.rule_calc_mode || "未识别")}</div>
        ${teacherProfile.rule_source_label ? `<div class="list-meta">主规则来源：${teacherProfile.rule_source_label}</div>` : ""}
        <div class="list-meta">明细 ${teacherProfile.detail_row_count} 行 · 免费档 ${teacherProfile.free_slot_count} 条 · 覆盖项 ${teacherProfile.rule_override_item_count} 条</div>
        ${teacherProfile.future_rule_display && teacherProfile.future_rule_effective_start_date ? `<div class="list-meta">已确认未来规则：${teacherProfile.future_rule_effective_start_date} 起 · ${teacherProfile.future_rule_display}${teacherProfile.future_rule_effective_end_date ? ` · 截止 ${teacherProfile.future_rule_effective_end_date}` : ""}</div>` : ""}
        ${teacherProfile.future_rule_source_label ? `<div class="list-meta">未来规则来源：${teacherProfile.future_rule_source_label}</div>` : ""}
        ${teacherProfile.future_rule_note ? `<div class="list-meta">未来规则说明：${teacherProfile.future_rule_note}</div>` : ""}
        <div class="list-meta">排课复核未关 ${teacherProfile.schedule_review_unresolved_row_count || 0} 条 · 草稿班名 ${teacherProfile.schedule_review_draft_class_name_count || 0} 条 · 缺教室 ${teacherProfile.schedule_review_missing_classroom_count || 0} 条</div>
        ${
          Number(teacherProfile.schedule_review_auto_candidate_count || 0) ||
          Number(teacherProfile.schedule_review_manual_classname_batch_row_count || 0) ||
          Number(teacherProfile.schedule_review_manual_classroom_batch_row_count || 0) ||
          Number(teacherProfile.schedule_review_manual_row_by_row_count || 0)
            ? `<div class="list-meta">候选拆分：高置信 ${teacherProfile.schedule_review_auto_candidate_count || 0} · 班名批量 ${teacherProfile.schedule_review_manual_classname_batch_row_count || 0} · 教室批量 ${teacherProfile.schedule_review_manual_classroom_batch_row_count || 0} · 逐条人工 ${teacherProfile.schedule_review_manual_row_by_row_count || 0}</div>`
            : ""
        }
        ${teacherProfile.readiness_reasons ? `<div class="list-meta">原因：${teacherProfile.readiness_reasons}</div>` : ""}
        ${teacherProfile.suggested_rule_display ? `<div class="list-meta">建议规则：${teacherProfile.suggested_rule_source_period} · ${teacherProfile.suggested_rule_display}${teacherProfile.suggested_rule_confidence ? ` · 置信度 ${formatProfileSuggestionConfidence(teacherProfile.suggested_rule_confidence)}` : ""}</div>` : ""}
        ${teacherProfile.recommended_next_step ? `<div class="list-meta">下一步：${teacherProfile.recommended_next_step}</div>` : ""}
        ${teacherProfile.projected_next_step_after_bulk ? `<div class="list-meta">高置信确认后：${teacherProfile.projected_next_step_after_bulk}</div>` : ""}
      </div>
    `);

    if (teacherProfile.unresolved_free_slot_count) {
      cards.push(`
        <div class="list-card">
          <div class="list-title">免费时间档待清洗</div>
          <div class="list-meta">异常 ${teacherProfile.unresolved_free_slot_count} 条</div>
          ${teacherProfile.unresolved_free_slot_samples ? `<div class="list-meta">${teacherProfile.unresolved_free_slot_samples}</div>` : ""}
        </div>
      `);
    }

    if (teacherProfile.slot_summary_row_count) {
      cards.push(`
        <div class="list-card">
          <div class="list-title">汇总型时间档板画像</div>
          <div class="list-meta">行数 ${teacherProfile.slot_summary_row_count} · 指标 ${teacherProfile.slot_summary_metric_types || "未识别"}</div>
          ${teacherProfile.slot_summary_related_teacher_names ? `<div class="list-meta">关联老师：${teacherProfile.slot_summary_related_teacher_names}</div>` : ""}
        </div>
      `);
    }

    if (teacherProfile.schedule_review_class_name_samples) {
      cards.push(`
        <div class="list-card">
          <div class="list-title">排课复核样本</div>
          <div class="list-meta">${teacherProfile.schedule_review_class_name_samples}</div>
        </div>
      `);
    }
  }

  return cards.join("") || `<div class="empty-state">当前月份还没有老师结算画像。</div>`;
}

function buildTeacherCompensationPolicyHtml(
  periodName,
  policySummary,
  teacherRow,
  periodRow
) {
  if (!hasImportedTeacherCompensationPolicyReport()) {
    return `<div class="empty-state">导入老师提成政策覆盖报告后，这里会显示当前老师的历史规则、未来默认 20% 规则、已确认特殊规则，以及像郑老师 50% 这类异常复核项。</div>`;
  }

  const summary = policySummary || createEmptyTeacherCompensationPolicyReport().summary;
  const cards = [];
  cards.push(`
    <div class="list-card">
      <div class="list-title">政策覆盖概览 · ${summary.reference_period || "当前窗口"}</div>
      <div class="list-meta">在职已覆盖 ${summary.current_rule_covered_active_teacher_count || 0}/${summary.active_teacher_count || 0} · 默认未来规则 ${summary.future_default_pending_teacher_count || 0} · 已确认未来规则 ${summary.future_confirmed_teacher_count || 0}</div>
      <div class="list-meta">重复覆盖项 ${summary.duplicate_override_scope_teacher_count || 0} 人 · 规则重叠 ${summary.overlap_issue_teacher_count || 0} 人 · 未来断档 ${summary.future_gap_teacher_count || 0} 人</div>
      ${
        Array.isArray(summary.future_default_pending_teacher_names) &&
        summary.future_default_pending_teacher_names.length
          ? `<div class="list-meta">默认 20% 待补涨幅：${summary.future_default_pending_teacher_names.join(" / ")}</div>`
          : ""
      }
      ${
        Array.isArray(summary.future_confirmed_teacher_names) &&
        summary.future_confirmed_teacher_names.length
          ? `<div class="list-meta">已确认未来比例：${summary.future_confirmed_teacher_names.join(" / ")}</div>`
          : ""
      }
      <div class="list-meta">当前业务口径：刘老师三分之一；叶老师从 2026-06 起 23%；其余老师默认 20%，再按年限调档。</div>
    </div>
  `);

  if (teacherRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师政策 · ${teacherRow.teacher_name}</div>
        <div class="list-meta">状态 ${formatTeacherCompensationPolicyStatus(teacherRow.coverage_status)} · 当前规则 ${teacherRow.current_rule_display || "未识别"} · 来源 ${teacherRow.current_rule_source_label || "未识别"}</div>
        ${
          teacherRow.current_rule_effective_start_date || teacherRow.current_rule_effective_end_date
            ? `<div class="list-meta">生效期 ${teacherRow.current_rule_effective_start_date || "—"}${teacherRow.current_rule_effective_end_date ? ` ~ ${teacherRow.current_rule_effective_end_date}` : " 起"}</div>`
            : ""
        }
        ${
          teacherRow.imported_period_names_text
            ? `<div class="list-meta">已导入历史月份：${teacherRow.imported_period_names_text}</div>`
            : ""
        }
        <div class="list-meta">默认未来月份 ${teacherRow.default_policy_period_count || 0} · 已确认未来月份 ${teacherRow.confirmed_policy_period_count || 0} · 覆盖项 ${teacherRow.rule_item_row_count || 0} 条</div>
        ${
          Number(teacherRow.distinct_ratio_override_count || 0) > 0
            ? `<div class="list-meta">覆盖比例样本：${teacherRow.ratio_override_values_text || "未识别"}</div>`
            : ""
        }
        ${
          Number(teacherRow.duplicate_override_scope_group_count || 0) > 0
            ? `<div class="list-meta">重复覆盖示例：${teacherRow.duplicate_override_scope_examples_text || "同范围命中多条覆盖项"}</div>`
            : ""
        }
        ${
          teacherRow.recommended_next_step
            ? `<div class="list-meta">下一步：${teacherRow.recommended_next_step}</div>`
            : ""
        }
        ${
          teacherRow.teacher_name === "郑老师"
            ? `<div class="list-meta">异常提醒：历史上出现过 50% 样本，业务已判定不能直接采用，导入时需再次复核来源。</div>`
            : ""
        }
        ${
          teacherRow.teacher_name === "叶老师"
            ? `<div class="list-meta">口径提醒：正式 23% 按最新确认从 2026-06 开始，2026-05 的 23% 只保留作历史复核样本。</div>`
            : ""
        }
        ${
          teacherRow.teacher_name !== "刘老师" && teacherRow.teacher_name !== "叶老师"
            ? `<div class="list-meta">默认口径：当前先按 20%，后续结合入职日期和调档记录再自动提示涨幅。</div>`
            : ""
        }
      </div>
    `);
  }

  if (periodRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前月份规则 · ${periodName}</div>
        <div class="list-meta">${periodRow.teacher_name} · ${formatTeacherCompensationPolicyStatus(periodRow.period_status)} · ${periodRow.rule_display || "未识别"}</div>
        <div class="list-meta">来源 ${periodRow.rule_source_label || "未识别"}${periodRow.effective_start_date ? ` · 生效 ${periodRow.effective_start_date}` : ""}${periodRow.effective_end_date ? ` ~ ${periodRow.effective_end_date}` : ""}</div>
        <div class="list-meta">覆盖项 ${periodRow.rule_item_row_count || 0} 条 · 重复覆盖组 ${periodRow.duplicate_override_scope_group_count || 0} 个</div>
        ${
          periodRow.ratio_override_values_text
            ? `<div class="list-meta">命中比例：${periodRow.ratio_override_values_text}</div>`
            : ""
        }
        ${
          periodRow.duplicate_override_scope_examples_text
            ? `<div class="list-meta">${periodRow.duplicate_override_scope_examples_text}</div>`
            : ""
        }
        ${
          periodRow.recommended_next_step
            ? `<div class="list-meta">月份动作：${periodRow.recommended_next_step}</div>`
            : ""
        }
        ${
          periodRow.teacher_name === "郑老师"
            ? `<div class="list-meta">本月复核提醒：如果再次出现 50% 或其他异常比例，先停在复核，不自动入正式规则。</div>`
            : ""
        }
      </div>
    `);
  }

  return cards.join("");
}

function buildTeacherRuleItemResolutionHtml(
  periodName,
  teacherName,
  summary,
  teacherPeriodRows,
  teacherAllRows
) {
  if (!hasImportedTeacherRuleItemResolutionTemplate()) {
    return `<div class="empty-state">导入老师覆盖项冲突清理模板后，这里会显示当前老师同范围重复覆盖项应保留哪个比例。</div>`;
  }

  const normalizedSummary =
    summary || createEmptyTeacherRuleItemResolutionTemplate().summary;
  const cards = [];
  cards.push(`
    <div class="list-card">
      <div class="list-title">冲突清理概览</div>
      <div class="list-meta">待清理 ${normalizedSummary.row_count || 0} 组 · 待确认 ${normalizedSummary.confirm_status_counts?.pending || 0} 组 · 已确认 ${normalizedSummary.confirm_status_counts?.confirmed || 0} 组</div>
      <div class="list-meta">把 confirm_status 改成 confirmed / approved / apply 后，流水线会自动折叠重复覆盖项。</div>
    </div>
  `);

  if (teacherPeriodRows.length) {
    teacherPeriodRows.forEach((row) => {
      cards.push(`
        <div class="list-card">
          <div class="list-title">${row.teacher_name} · ${row.effective_start_date}</div>
          <div class="list-meta">${row.scope_label || "同范围覆盖项"} · 重复 ${row.duplicate_row_count || 0} 条 · ${formatRuleBackfillConfirmStatus(row.confirm_status)}</div>
          ${row.candidate_ratio_options_text ? `<div class="list-meta">候选比例：${row.candidate_ratio_options_text}</div>` : ""}
          ${row.candidate_unit_amount_options_text ? `<div class="list-meta">候选单价：${row.candidate_unit_amount_options_text}</div>` : ""}
          ${row.candidate_option_summaries_text ? `<div class="list-meta">${row.candidate_option_summaries_text}</div>` : ""}
          ${row.selected_ratio_override || row.selected_unit_amount ? `<div class="list-meta">当前选择：${row.selected_ratio_override || "—"}${row.selected_unit_amount ? ` / ${row.selected_unit_amount}` : ""}</div>` : ""}
          ${row.recommended_resolution ? `<div class="list-meta">建议：${row.recommended_resolution}</div>` : ""}
        </div>
      `);
    });
  } else if (teacherAllRows.length) {
    const otherPeriods = [
      ...new Set(
        teacherAllRows.map((item) => String(item.effective_start_date || "").slice(0, 7))
      ),
    ]
      .filter(Boolean)
      .join(" / ");
    cards.push(`
      <div class="list-card">
        <div class="list-title">${teacherName} 当前月份没有冲突组</div>
        <div class="list-meta">该老师仍有 ${teacherAllRows.length} 组覆盖项冲突，但发生在其他月份：${otherPeriods || "未识别"}。</div>
      </div>
    `);
  } else {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${teacherName} 当前没有覆盖项冲突</div>
        <div class="list-meta">${periodName} 这个老师没有待清理的重复提成覆盖项。</div>
      </div>
    `);
  }

  return cards.join("");
}

function buildTeacherRuleBackfillHtml(periodName, periodRows, teacherRow) {
  if (!hasImportedTeacherRuleBackfillTemplate()) {
    return `<div class="empty-state">导入主规则回填建议后，这里会显示当前月份缺规则老师的补录建议。</div>`;
  }

  const cards = [];
  if (periodRows.length) {
    const highCount = periodRows.filter((item) => item.suggestion_confidence === "high").length;
    const pendingCount = periodRows.filter((item) => item.confirm_status === "pending").length;
    cards.push(`
      <div class="list-card">
        <div class="list-title">月份回填概览 · ${periodName}</div>
        <div class="list-meta">待回填 ${periodRows.length} 人 · 高置信度 ${highCount} 人 · 待确认 ${pendingCount} 人</div>
      </div>
    `);
  }

  if (teacherRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师建议 · ${teacherRow.teacher_name}</div>
        <div class="list-meta">来源 ${teacherRow.source_period_name || "未识别"} · ${teacherRow.source_rule_display || "未识别"} · ${formatRuleBackfillConfirmStatus(teacherRow.confirm_status)}</div>
        <div class="list-meta">回填有效期 ${teacherRow.effective_start_date || "—"} ~ ${teacherRow.effective_end_date || "—"}</div>
        ${teacherRow.suggestion_note ? `<div class="list-meta">说明：${teacherRow.suggestion_note}</div>` : ""}
        ${teacherRow.recommended_action ? `<div class="list-meta">建议动作：${teacherRow.recommended_action}</div>` : ""}
      </div>
    `);
  } else if (periodRows.length) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">当前老师没有回填建议</div>
        <div class="list-meta">这个月份还有 ${periodRows.length} 位老师待补主规则，可切换老师查看。</div>
      </div>
    `);
  }

  return cards.join("") || `<div class="empty-state">${periodName} 当前没有主规则回填建议。</div>`;
}

function buildSettlementTeacherDiagnosticHtml(
  periodName,
  teacherName,
  bridgeTeacherReport,
  reconciliationTeacherReport,
  reviewQueueRow,
  followupRow,
  reviewResolutionRow
) {
  if (!teacherName) {
    return `<div class="empty-state">先选择一个老师。</div>`;
  }

  if (!bridgeTeacherReport && !reconciliationTeacherReport) {
    if (!reviewQueueRow && !followupRow) {
      return `<div class="empty-state">当前老师还没有导入诊断数据。</div>`;
    }
  }

  const cards = [];

  if (reviewQueueRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">人工复核待办 · ${teacherName}</div>
        <div class="list-meta">优先级 ${formatReviewPriority(reviewQueueRow.priority)} · 处理建议：${reviewQueueRow.recommended_action || "—"}</div>
        ${reviewQueueRow.bridge_source_missing_samples ? `<div class="list-meta">排课源缺失样本：${reviewQueueRow.bridge_source_missing_samples}</div>` : ""}
      </div>
    `);
  }

  if (followupRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">复核跟进动作 · ${teacherName}</div>
        <div class="list-meta">类型 ${formatFollowupType(followupRow.followup_type)} · 优先级 ${formatReviewPriority(followupRow.priority)} · 迁移状态 ${formatProfileReadinessStatus(followupRow.readiness_status)}</div>
        <div class="list-meta">建议动作：${followupRow.recommended_action || "—"}</div>
        <div class="list-meta">关注点：${followupRow.next_check_focus || "—"}</div>
        ${Array.isArray(followupRow.evidence_lines) && followupRow.evidence_lines.length ? `<div class="list-meta">证据：${followupRow.evidence_lines.join("；")}</div>` : ""}
        ${Array.isArray(followupRow.detail_lines) && followupRow.detail_lines.length ? `<div class="list-meta">细节：${followupRow.detail_lines.join("；")}</div>` : ""}
      </div>
    `);
  }

  if (reviewResolutionRow) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">复核处理结果 · ${teacherName}</div>
        <div class="list-meta">状态 ${formatResolutionStatus(reviewResolutionRow.resolutionStatus)} · 类型 ${formatResolutionType(reviewResolutionRow.resolutionType)}</div>
        ${reviewResolutionRow.ownerName ? `<div class="list-meta">责任人：${reviewResolutionRow.ownerName}</div>` : ""}
        ${reviewResolutionRow.decisionSummary ? `<div class="list-meta">结论：${reviewResolutionRow.decisionSummary}</div>` : ""}
        ${reviewResolutionRow.followUpAction ? `<div class="list-meta">后续动作：${reviewResolutionRow.followUpAction}</div>` : ""}
        ${reviewResolutionRow.resolvedByName || reviewResolutionRow.resolvedAt ? `<div class="list-meta">处理人：${reviewResolutionRow.resolvedByName || "—"} · 时间：${reviewResolutionRow.resolvedAt || "—"}</div>` : ""}
      </div>
    `);
  }

  if (bridgeTeacherReport) {
    const bridgeFlags = [
      ...(bridgeTeacherReport.review_flags || []),
      ...((bridgeTeacherReport.info_flags || []).filter((flag) => flag !== "summary_only_slot_board")),
    ];
    cards.push(`
      <div class="list-card">
        <div class="list-title">桥接核对 · ${teacherName}</div>
        <div class="list-meta">状态 ${formatDiagnosticStatus(bridgeTeacherReport.status)} · 学生重叠 ${bridgeTeacherReport.matched_student_name_count} · 名册辅助重叠 ${bridgeTeacherReport.roster_assisted_matched_student_name_count}</div>
        <div class="list-meta">结算匹配率 ${formatPercentText(bridgeTeacherReport.settlement_student_match_rate)} · 名册辅助后 ${formatPercentText(bridgeTeacherReport.roster_assisted_settlement_student_match_rate)}</div>
        ${bridgeFlags.length ? `<div class="list-meta">标记：${bridgeFlags.map(formatDiagnosticFlag).join(" / ")}</div>` : `<div class="list-meta">当前老师在桥接报告里没有异常标记。</div>`}
      </div>
    `);

    if (bridgeTeacherReport.settlement_only_enrollment_supported_name_samples?.length) {
      cards.push(`
        <div class="list-card">
          <div class="list-title">只在结算出现，但名册可解释</div>
          <div class="list-meta">${bridgeTeacherReport.settlement_only_enrollment_supported_name_samples.join(" / ")}</div>
        </div>
      `);
    }

    if (bridgeTeacherReport.settlement_only_missing_from_schedule_source_name_samples?.length) {
      cards.push(`
        <div class="list-card">
          <div class="list-title">只在结算出现，且排课源也缺失</div>
          <div class="list-meta">${bridgeTeacherReport.settlement_only_missing_from_schedule_source_name_samples.join(" / ")}</div>
        </div>
      `);
    }
  }

  if (reconciliationTeacherReport) {
    const reviewFlags = reconciliationTeacherReport.review_flags || [];
    cards.push(`
      <div class="list-card">
        <div class="list-title">结算对账 · ${teacherName}</div>
        <div class="list-meta">汇总课时+补课提成 ${formatAmountText(reconciliationTeacherReport.reported_teaching_plus_makeup_amount)} · 明细合计 ${formatAmountText(reconciliationTeacherReport.detail_commission_total_amount)}</div>
        <div class="list-meta">差额 ${formatAmountText(reconciliationTeacherReport.difference_vs_reported_teaching_plus_makeup)} · 明细行 ${reconciliationTeacherReport.detail_row_count} 行</div>
        ${reviewFlags.length ? `<div class="list-meta">标记：${reviewFlags.map(formatDiagnosticFlag).join(" / ")}</div>` : `<div class="list-meta">当前老师在结算对账里没有异常标记。</div>`}
      </div>
    `);
  }

  return cards.join("") || `<div class="empty-state">${periodName} 的 ${teacherName} 还没有可展示的诊断信息。</div>`;
}

function resolveRevenueShareRatio(teacherName, periodName) {
  const candidates = state.compensationRules
    .filter((item) => item.teacherName === teacherName && isRuleEffectiveForPeriod(item, periodName))
    .sort((left, right) => left.effectiveStartDate.localeCompare(right.effectiveStartDate, "zh-CN"));
  const matched = candidates[candidates.length - 1];
  return matched ? matched.revenueShareRatio : "";
}

function isRuleEffectiveForPeriod(rule, periodName) {
  const startPeriod = String(rule.effectiveStartDate || "").slice(0, 7);
  const endPeriod = String(rule.effectiveEndDate || "").slice(0, 7);
  if (!startPeriod) {
    return false;
  }
  return startPeriod <= periodName && (!endPeriod || endPeriod >= periodName);
}

function getProjectionPeriodName() {
  const periods = getScheduleProjectionPeriods();
  return resolveScheduleProjectionPeriod(periods);
}

function getCurrentPeriodName() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parsePeriodName(periodName) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(periodName || "").trim());
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

function shiftPeriodName(periodName, monthDelta) {
  const parsed = parsePeriodName(periodName);
  if (!parsed) {
    return "";
  }
  let year = parsed.year;
  let month = parsed.month + monthDelta;
  while (month > 12) {
    year += 1;
    month -= 12;
  }
  while (month < 1) {
    year -= 1;
    month += 12;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getScheduleProjectionPeriods() {
  const periods = new Set();
  const currentPeriod = getCurrentPeriodName();
  for (let offset = -1; offset <= 11; offset += 1) {
    periods.add(shiftPeriodName(currentPeriod, offset));
  }
  state.financialPeriods.forEach((period) => {
    if (period.periodName) {
      periods.add(period.periodName);
    }
  });
  state.compensationRules.forEach((rule) => {
    const startPeriod = String(rule.effectiveStartDate || "").slice(0, 7);
    const endPeriod = String(rule.effectiveEndDate || "").slice(0, 7);
    if (startPeriod) {
      periods.add(startPeriod);
    }
    if (endPeriod) {
      periods.add(endPeriod);
    }
  });
  state.dividendPolicies.forEach((policy) => {
    if (policy.effectiveStartPeriod) {
      periods.add(policy.effectiveStartPeriod);
    }
  });
  return [...periods].filter(Boolean).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function resolveScheduleProjectionPeriod(periods) {
  if (uiState.scheduleProjectionPeriod && periods.includes(uiState.scheduleProjectionPeriod)) {
    return uiState.scheduleProjectionPeriod;
  }
  if (periods.includes(HOLIDAY_PRIMARY_PROJECTION_PERIOD)) {
    return HOLIDAY_PRIMARY_PROJECTION_PERIOD;
  }
  if (periods.includes(HOLIDAY_SECONDARY_PROJECTION_PERIOD)) {
    return HOLIDAY_SECONDARY_PROJECTION_PERIOD;
  }
  const currentPeriod = getCurrentPeriodName();
  if (periods.includes(currentPeriod)) {
    return currentPeriod;
  }
  return periods[periods.length - 1] || currentPeriod;
}

function getEffectiveCompensationRuleForProjection(teacherName, projectionPeriodName) {
  const importedCandidates = state.compensationRules
    .filter(
      (item) =>
        item.teacherName === teacherName &&
        isRuleEffectiveForPeriod(item, projectionPeriodName)
    )
    .sort((left, right) => left.effectiveStartDate.localeCompare(right.effectiveStartDate, "zh-CN"));
  if (importedCandidates.length) {
    return importedCandidates[importedCandidates.length - 1];
  }
  if (state.compensationRules.some((item) => item.teacherName === teacherName)) {
    return null;
  }

  const historicalCandidates = HISTORICAL_SETTLEMENT_STATEMENTS
    .filter((item) => item.teacherName === teacherName && item.mainRatio)
    .sort((left, right) => left.periodName.localeCompare(right.periodName, "zh-CN"));
  const matched = historicalCandidates[historicalCandidates.length - 1];
  if (!matched) {
    return null;
  }

  return {
    teacherName,
    effectiveStartDate: `${matched.periodName}-01`,
    effectiveEndDate: "",
    settlementCycle: "monthly",
    calcMode: "revenue_share",
    baseAmount: "",
    hourlyAmount: "",
    perStudentAmount: "",
    revenueShareRatio: matched.mainRatio,
    notes: "Fallback from historical sample settlement.",
  };
}

function getProjectionRuleItems(rule) {
  if (!rule) {
    return [];
  }
  return state.compensationRuleItems
    .filter(
      (item) =>
        item.teacherName === rule.teacherName &&
        item.effectiveStartDate === rule.effectiveStartDate
    )
    .sort((left, right) => right.priority - left.priority);
}

function deriveScheduleSettlementTag(entry) {
  if (entry.dayKind === "weekend") {
    return "weekend";
  }
  if (entry.slotIndex >= 5) {
    return "weekday_evening";
  }
  return "weekday_day";
}

function projectionRuleItemMatchesEntry(item, entry) {
  if (item.courseType && item.courseType !== entry.courseType) {
    return false;
  }
  if (item.sessionTag && item.sessionTag !== deriveScheduleSettlementTag(entry)) {
    return false;
  }
  if (item.gradeFrom && Number(item.gradeFrom) > Number(entry.grade)) {
    return false;
  }
  if (item.gradeTo && Number(item.gradeTo) < Number(entry.grade)) {
    return false;
  }
  return true;
}

function evaluateScheduleSettlementEntry(entry, projectionPeriodName) {
  const rule = getEffectiveCompensationRuleForProjection(
    entry.teacherName,
    projectionPeriodName
  );
  if (!rule) {
    return {
      status: "missing_rule",
      projectedAmount: 0,
      rule,
      ruleItem: null,
      note: "当前老师还没有可用的结算主规则。",
    };
  }

  const matchedRuleItem = getProjectionRuleItems(rule).find((item) =>
    projectionRuleItemMatchesEntry(item, entry)
  );
  const calcMode = matchedRuleItem?.calcModeOverride || rule.calcMode || "";
  const sessionHours = 1.5;

  if (calcMode === "per_hour") {
    const unitAmount = toNumber(matchedRuleItem?.unitAmount || rule.hourlyAmount);
    if (!unitAmount) {
      return {
        status: "incomplete_rule_config",
        projectedAmount: 0,
        rule,
        ruleItem: matchedRuleItem || null,
        note: "规则写成按课时，但还没有小时单价。",
      };
    }
    return {
      status: "projectable",
      projectedAmount: roundAmount(sessionHours * unitAmount),
      rule,
      ruleItem: matchedRuleItem || null,
      note: `按课时规则可直接估算，单节按 ${sessionHours} 小时。`,
    };
  }

  if (calcMode === "per_student") {
    const unitAmount = toNumber(matchedRuleItem?.unitAmount || rule.perStudentAmount);
    if (!unitAmount) {
      return {
        status: "incomplete_rule_config",
        projectedAmount: 0,
        rule,
        ruleItem: matchedRuleItem || null,
        note: "规则写成按人数，但还没有每人单价。",
      };
    }
    return {
      status: "projectable",
      projectedAmount: roundAmount(Number(entry.size || 0) * unitAmount),
      rule,
      ruleItem: matchedRuleItem || null,
      note: "按预计班级人数和当前规则可直接估算。",
    };
  }

  if (calcMode === "revenue_share") {
    const ratio = matchedRuleItem?.ratioOverride || rule.revenueShareRatio;
    if (!ratio) {
      return {
        status: "incomplete_rule_config",
        projectedAmount: 0,
        rule,
        ruleItem: matchedRuleItem || null,
        note: "规则写成收入分成，但还没有分成比例。",
      };
    }
    const estimatedRevenue = toNumber(entry.estimatedRevenuePerSession);
    if (!estimatedRevenue) {
      return {
        status: "revenue_input_required",
        projectedAmount: 0,
        rule,
        ruleItem: matchedRuleItem || null,
        note: `已识别 ${formatRatioPercent(ratio)} 分成，但待开班还没填预计单节收入。`,
      };
    }
    return {
      status: "projectable",
      projectedAmount: roundAmount(estimatedRevenue * Number(ratio || 0)),
      rule,
      ruleItem: matchedRuleItem || null,
      note: `按预计单节收入 ${formatCurrency(estimatedRevenue)} 和 ${formatRatioPercent(ratio)} 分成估算。`,
    };
  }

  return {
    status: "incomplete_rule_config",
    projectedAmount: 0,
    rule,
    ruleItem: matchedRuleItem || null,
    note: calcMode
      ? `当前规则类型 ${calcMode} 还需要补更多计价字段。`
      : "当前老师已有规则，但排课端还缺足够的计价字段。",
  };
}

function buildScheduleSettlementProjection() {
  const projectionPeriodName = getProjectionPeriodName();
  if (!scheduleCache || !Array.isArray(scheduleCache.entries) || !scheduleCache.entries.length) {
    return {
      summary: {
        projectionPeriodName,
        dividendRate: calculateDividendRate(projectionPeriodName),
        teacherCount: 0,
        coveredTeacherCount: 0,
        projectableTeacherCount: 0,
        sessionCount: 0,
        projectableSessionCount: 0,
        projectedAmountTotal: 0,
        estimatedRevenueTotal: 0,
        estimatedRevenueSessionCount: 0,
        teachingMarginAmount: 0,
        revenueInputRequiredTeacherCount: 0,
        missingRuleTeacherCount: 0,
        incompleteConfigTeacherCount: 0,
      },
      teacherRows: [],
    };
  }

  const teacherMap = new Map();
  let estimatedRevenueTotal = 0;
  let estimatedRevenueSessionCount = 0;
  for (const entry of scheduleCache.entries) {
    const evaluation = evaluateScheduleSettlementEntry(entry, projectionPeriodName);
    if (!teacherMap.has(entry.teacherName)) {
      teacherMap.set(entry.teacherName, {
        teacherName: entry.teacherName,
        sessionCount: 0,
        projectedHours: 0,
        studentSeatCount: 0,
        projectedAmount: 0,
        estimatedRevenueAmount: 0,
        estimatedRevenueSessionCount: 0,
        projectableSessionCount: 0,
        revenueInputRequiredSessionCount: 0,
        missingRuleSessionCount: 0,
        incompleteConfigSessionCount: 0,
        ruleModes: new Set(),
        notes: [],
        rule: evaluation.rule,
        ruleItemCount: getProjectionRuleItems(evaluation.rule).length,
      });
    }

    const teacher = teacherMap.get(entry.teacherName);
    teacher.sessionCount += 1;
    teacher.projectedHours = roundAmount(teacher.projectedHours + 1.5);
    teacher.studentSeatCount += Number(entry.size || 0);
    teacher.projectedAmount = roundAmount(teacher.projectedAmount + evaluation.projectedAmount);
    if (toNumber(entry.estimatedRevenuePerSession) > 0) {
      teacher.estimatedRevenueAmount = roundAmount(
        teacher.estimatedRevenueAmount + toNumber(entry.estimatedRevenuePerSession)
      );
      teacher.estimatedRevenueSessionCount += 1;
      estimatedRevenueTotal = roundAmount(
        estimatedRevenueTotal + toNumber(entry.estimatedRevenuePerSession)
      );
      estimatedRevenueSessionCount += 1;
    }
    if (evaluation.rule?.calcMode) {
      teacher.ruleModes.add(evaluation.rule.calcMode);
    }
    if (evaluation.note && !teacher.notes.includes(evaluation.note)) {
      teacher.notes.push(evaluation.note);
    }

    if (evaluation.status === "projectable") {
      teacher.projectableSessionCount += 1;
    } else if (evaluation.status === "revenue_input_required") {
      teacher.revenueInputRequiredSessionCount += 1;
    } else if (evaluation.status === "missing_rule") {
      teacher.missingRuleSessionCount += 1;
    } else {
      teacher.incompleteConfigSessionCount += 1;
    }
  }

  const teacherRows = [...teacherMap.values()]
    .map((teacher) => {
      let status = "partial_rule_support";
      if (teacher.missingRuleSessionCount === teacher.sessionCount) {
        status = "missing_rule";
      } else if (teacher.incompleteConfigSessionCount === teacher.sessionCount) {
        status = "incomplete_rule_config";
      } else if (teacher.projectableSessionCount === teacher.sessionCount) {
        status = "projectable";
      } else if (teacher.revenueInputRequiredSessionCount === teacher.sessionCount) {
        status = "revenue_input_required";
      } else if (teacher.projectableSessionCount + teacher.revenueInputRequiredSessionCount === teacher.sessionCount) {
        status = "partial_rule_support";
      }

      return {
        ...teacher,
        status,
        ruleModeText: [...teacher.ruleModes].join(", "),
        teachingMarginAmount: roundAmount(
          teacher.estimatedRevenueAmount - teacher.projectedAmount
        ),
      };
    })
    .sort(
      (left, right) =>
        scheduleSettlementStatusWeight(left.status) - scheduleSettlementStatusWeight(right.status) ||
        right.sessionCount - left.sessionCount ||
        left.teacherName.localeCompare(right.teacherName, "zh-CN")
    );

  return {
    summary: {
      projectionPeriodName,
      dividendRate: calculateDividendRate(projectionPeriodName),
      teacherCount: teacherRows.length,
      coveredTeacherCount: teacherRows.filter((item) => item.status !== "missing_rule").length,
      projectableTeacherCount: teacherRows.filter((item) => item.status === "projectable").length,
      sessionCount: teacherRows.reduce((sum, item) => sum + item.sessionCount, 0),
      projectableSessionCount: teacherRows.reduce(
        (sum, item) => sum + item.projectableSessionCount,
        0
      ),
      projectedAmountTotal: roundAmount(
        teacherRows.reduce((sum, item) => sum + item.projectedAmount, 0)
      ),
      estimatedRevenueTotal,
      estimatedRevenueSessionCount,
      teachingMarginAmount: roundAmount(
        estimatedRevenueTotal -
          teacherRows.reduce((sum, item) => sum + item.projectedAmount, 0)
      ),
      revenueInputRequiredTeacherCount: teacherRows.filter(
        (item) => item.status === "revenue_input_required"
      ).length,
      missingRuleTeacherCount: teacherRows.filter((item) => item.status === "missing_rule").length,
      incompleteConfigTeacherCount: teacherRows.filter(
        (item) => item.status === "incomplete_rule_config"
      ).length,
    },
    teacherRows,
  };
}

function scheduleSettlementStatusWeight(status) {
  return {
    missing_rule: 0,
    incomplete_rule_config: 1,
    revenue_input_required: 2,
    partial_rule_support: 3,
    projectable: 4,
  }[String(status || "").trim()] ?? 9;
}

function buildScheduleSettlementCoverageHtml(projection) {
  if (!projection.summary.teacherCount) {
    return `<div class="empty-state">生成排课建议后，这里会显示老师结算规则覆盖情况。</div>`;
  }

  const cards = [
    `
      <div class="list-card">
        <div class="list-title">排课-结算覆盖概览</div>
        <div class="list-meta">计划月份 ${projection.summary.projectionPeriodName} · 分红率 ${formatPercent(projection.summary.dividendRate)} · 已排老师 ${projection.summary.teacherCount} 人</div>
        <div class="list-meta">已接规则 ${projection.summary.coveredTeacherCount} 人 · 可直接投影 ${projection.summary.projectableTeacherCount} 人 · 缺收入口径 ${projection.summary.revenueInputRequiredTeacherCount} 人 · 缺规则 ${projection.summary.missingRuleTeacherCount} 人</div>
        <div class="list-meta">当前周预计收入 ${projection.summary.estimatedRevenueTotal ? formatCurrency(projection.summary.estimatedRevenueTotal) : "待补收入口径"} · 教师结算 ${projection.summary.projectedAmountTotal ? formatCurrency(projection.summary.projectedAmountTotal) : "待补收入口径"} · 教学毛结余 ${formatCurrency(projection.summary.teachingMarginAmount)}</div>
      </div>
    `,
  ];

  projection.teacherRows.slice(0, 8).forEach((teacher) => {
    const ruleLabel = teacher.rule
      ? teacher.rule.calcMode === "revenue_share" && teacher.rule.revenueShareRatio
        ? `${formatScheduleSettlementStatus(teacher.status)} · ${formatRatioPercent(teacher.rule.revenueShareRatio)}`
        : `${formatScheduleSettlementStatus(teacher.status)} · ${teacher.rule.calcMode || "规则已导入"}`
      : formatScheduleSettlementStatus(teacher.status);
    cards.push(`
      <div class="list-card">
        <div class="list-title">${teacher.teacherName}</div>
        <div class="list-meta">${ruleLabel}${teacher.rule?.effectiveStartDate ? ` · 生效 ${teacher.rule.effectiveStartDate}` : ""}</div>
        <div class="list-meta">建议排入 ${teacher.sessionCount} 节 · 约 ${formatCompactSlotValue(teacher.projectedHours)} 小时 · 预计服务 ${teacher.studentSeatCount} 人次</div>
        ${
          teacher.projectedAmount > 0
            ? `<div class="list-meta">可直接投影金额 ${formatCurrency(teacher.projectedAmount)}</div>`
            : ""
        }
        ${
          teacher.estimatedRevenueAmount > 0
            ? `<div class="list-meta">预计收入 ${formatCurrency(teacher.estimatedRevenueAmount)} · 教学毛结余 ${formatCurrency(teacher.teachingMarginAmount)}</div>`
            : ""
        }
        <div class="list-meta">${teacher.notes[0] || "当前规则已能覆盖这位老师的排课建议。"}</div>
      </div>
    `);
  });

  return cards.join("");
}

function buildSummerPhaseProjection(projectionPeriodName = getProjectionPeriodName()) {
  if (!scheduleCache || !Array.isArray(scheduleCache.entries) || !scheduleCache.entries.length) {
    return {
      summary: {
        projectionPeriodName,
        phaseCount: SUMMER_PHASE_COUNT,
        lessonsPerPhase: SUMMER_LESSONS_PER_PHASE,
        totalLessonsPerDemand: SUMMER_PHASE_COUNT * SUMMER_LESSONS_PER_PHASE,
        demandCount: state.demands.length,
        fullyScheduledDemandCount: 0,
        partiallyScheduledDemandCount: 0,
        unscheduledDemandCount: state.demands.length,
        recurringSlotCount: 0,
        unscheduledRecurringSlotCount: scheduleCache?.unscheduled?.length || 0,
        phaseEquivalentSessionCount: 0,
        summerEquivalentSessionCount: 0,
        projectedAmountPerPhase: 0,
        projectedAmountSummer: 0,
        estimatedRevenuePerPhase: 0,
        estimatedRevenueSummer: 0,
        teachingMarginPerPhase: 0,
        teachingMarginSummer: 0,
      },
      teacherRows: [],
    };
  }

  const demandMap = new Map(state.demands.map((demand) => [demand.id, demand]));
  const demandEntryCount = new Map();
  scheduleCache.entries.forEach((entry) => {
    if (entry.demandId) {
      demandEntryCount.set(entry.demandId, (demandEntryCount.get(entry.demandId) || 0) + 1);
    }
  });

  let fullyScheduledDemandCount = 0;
  let partiallyScheduledDemandCount = 0;
  let unscheduledDemandCount = 0;
  state.demands.forEach((demand) => {
    const scheduledSlotCount = demandEntryCount.get(demand.id) || 0;
    const targetSlotCount = Number(demand.weeklySessions || 0);
    if (scheduledSlotCount >= targetSlotCount && targetSlotCount > 0) {
      fullyScheduledDemandCount += 1;
    } else if (scheduledSlotCount > 0) {
      partiallyScheduledDemandCount += 1;
    } else {
      unscheduledDemandCount += 1;
    }
  });

  const teacherMap = new Map();
  let phaseEquivalentSessionCount = 0;
  let summerEquivalentSessionCount = 0;
  let projectedAmountPerPhase = 0;
  let projectedAmountSummer = 0;
  let estimatedRevenuePerPhase = 0;
  let estimatedRevenueSummer = 0;

  for (const entry of scheduleCache.entries) {
    const recurringSlotCount = Number(entry.weeklySessions || 0);
    if (!recurringSlotCount) {
      continue;
    }
    const phaseMultiplier = SUMMER_LESSONS_PER_PHASE / recurringSlotCount;
    const summerMultiplier = phaseMultiplier * SUMMER_PHASE_COUNT;
    const evaluation = evaluateScheduleSettlementEntry(entry, projectionPeriodName);
    const estimatedRevenuePerSession = toNumber(entry.estimatedRevenuePerSession);

    phaseEquivalentSessionCount = roundAmount(phaseEquivalentSessionCount + phaseMultiplier);
    summerEquivalentSessionCount = roundAmount(summerEquivalentSessionCount + summerMultiplier);
    projectedAmountPerPhase = roundAmount(
      projectedAmountPerPhase + evaluation.projectedAmount * phaseMultiplier
    );
    projectedAmountSummer = roundAmount(
      projectedAmountSummer + evaluation.projectedAmount * summerMultiplier
    );
    estimatedRevenuePerPhase = roundAmount(
      estimatedRevenuePerPhase + estimatedRevenuePerSession * phaseMultiplier
    );
    estimatedRevenueSummer = roundAmount(
      estimatedRevenueSummer + estimatedRevenuePerSession * summerMultiplier
    );

    if (!teacherMap.has(entry.teacherName)) {
      teacherMap.set(entry.teacherName, {
        teacherName: entry.teacherName,
        recurringSlotCount: 0,
        phaseEquivalentSessionCount: 0,
        summerEquivalentSessionCount: 0,
        projectedAmountPerPhase: 0,
        projectedAmountSummer: 0,
        estimatedRevenuePerPhase: 0,
        estimatedRevenueSummer: 0,
        projectableRecurringSlotCount: 0,
        revenueInputRequiredRecurringSlotCount: 0,
        missingRuleRecurringSlotCount: 0,
        incompleteConfigRecurringSlotCount: 0,
        notes: [],
      });
    }

    const teacher = teacherMap.get(entry.teacherName);
    teacher.recurringSlotCount += 1;
    teacher.phaseEquivalentSessionCount = roundAmount(
      teacher.phaseEquivalentSessionCount + phaseMultiplier
    );
    teacher.summerEquivalentSessionCount = roundAmount(
      teacher.summerEquivalentSessionCount + summerMultiplier
    );
    teacher.projectedAmountPerPhase = roundAmount(
      teacher.projectedAmountPerPhase + evaluation.projectedAmount * phaseMultiplier
    );
    teacher.projectedAmountSummer = roundAmount(
      teacher.projectedAmountSummer + evaluation.projectedAmount * summerMultiplier
    );
    teacher.estimatedRevenuePerPhase = roundAmount(
      teacher.estimatedRevenuePerPhase + estimatedRevenuePerSession * phaseMultiplier
    );
    teacher.estimatedRevenueSummer = roundAmount(
      teacher.estimatedRevenueSummer + estimatedRevenuePerSession * summerMultiplier
    );
    if (evaluation.note && !teacher.notes.includes(evaluation.note)) {
      teacher.notes.push(evaluation.note);
    }

    if (evaluation.status === "projectable") {
      teacher.projectableRecurringSlotCount += 1;
    } else if (evaluation.status === "revenue_input_required") {
      teacher.revenueInputRequiredRecurringSlotCount += 1;
    } else if (evaluation.status === "missing_rule") {
      teacher.missingRuleRecurringSlotCount += 1;
    } else {
      teacher.incompleteConfigRecurringSlotCount += 1;
    }
  }

  const teacherRows = [...teacherMap.values()]
    .map((teacher) => {
      let status = "partial_rule_support";
      if (teacher.missingRuleRecurringSlotCount === teacher.recurringSlotCount) {
        status = "missing_rule";
      } else if (teacher.incompleteConfigRecurringSlotCount === teacher.recurringSlotCount) {
        status = "incomplete_rule_config";
      } else if (teacher.projectableRecurringSlotCount === teacher.recurringSlotCount) {
        status = "projectable";
      } else if (
        teacher.revenueInputRequiredRecurringSlotCount === teacher.recurringSlotCount
      ) {
        status = "revenue_input_required";
      }
      return {
        ...teacher,
        status,
        teachingMarginPerPhase: roundAmount(
          teacher.estimatedRevenuePerPhase - teacher.projectedAmountPerPhase
        ),
        teachingMarginSummer: roundAmount(
          teacher.estimatedRevenueSummer - teacher.projectedAmountSummer
        ),
      };
    })
    .sort(
      (left, right) =>
        right.projectedAmountSummer - left.projectedAmountSummer ||
        right.summerEquivalentSessionCount - left.summerEquivalentSessionCount ||
        left.teacherName.localeCompare(right.teacherName, "zh-CN")
    );

  return {
    summary: {
      projectionPeriodName,
      phaseCount: SUMMER_PHASE_COUNT,
      lessonsPerPhase: SUMMER_LESSONS_PER_PHASE,
      totalLessonsPerDemand: SUMMER_PHASE_COUNT * SUMMER_LESSONS_PER_PHASE,
      demandCount: state.demands.length,
      fullyScheduledDemandCount,
      partiallyScheduledDemandCount,
      unscheduledDemandCount,
      recurringSlotCount: scheduleCache.entries.length,
      unscheduledRecurringSlotCount: scheduleCache.unscheduled.length,
      phaseEquivalentSessionCount,
      summerEquivalentSessionCount,
      projectedAmountPerPhase,
      projectedAmountSummer,
      estimatedRevenuePerPhase,
      estimatedRevenueSummer,
      teachingMarginPerPhase: roundAmount(
        estimatedRevenuePerPhase - projectedAmountPerPhase
      ),
      teachingMarginSummer: roundAmount(
        estimatedRevenueSummer - projectedAmountSummer
      ),
    },
    teacherRows,
  };
}

function buildSummerPhaseProjectionHtml(projection) {
  if (!projection.summary.recurringSlotCount) {
    return `<div class="empty-state">生成排课建议后，这里会按“三期 × 每期 15 次”折算暑假总量。</div>`;
  }

  const coverageRate =
    projection.summary.demandCount > 0
      ? Math.round(
          (projection.summary.fullyScheduledDemandCount / projection.summary.demandCount) * 100
        )
      : 0;
  const cards = [
    `
      <div class="list-card">
        <div class="list-title">暑假三期总量测算</div>
        <div class="list-meta">计划月份 ${projection.summary.projectionPeriodName} · ${projection.summary.phaseCount} 期 × 每期 ${projection.summary.lessonsPerPhase} 次 · 每班合计 ${projection.summary.totalLessonsPerDemand} 次</div>
        <div class="list-meta">完整排入 ${projection.summary.fullyScheduledDemandCount}/${projection.summary.demandCount} 个班 · 覆盖率 ${coverageRate}% · 未排槽位 ${projection.summary.unscheduledRecurringSlotCount}</div>
        <div class="list-meta">单期约结算 ${formatCurrency(projection.summary.projectedAmountPerPhase)} · 整个暑假约结算 ${formatCurrency(projection.summary.projectedAmountSummer)}</div>
        <div class="list-meta">单期约收入 ${formatCurrency(projection.summary.estimatedRevenuePerPhase)} · 暑假教学毛结余 ${formatCurrency(projection.summary.teachingMarginSummer)}</div>
      </div>
    `,
    `
      <div class="list-card">
        <div class="list-title">测算口径说明</div>
        <div class="list-meta">当前原型先按“同一班每期 15 次”均分到本周已排的 recurring slots；如果某班每周排 2 节，则每个 slot 折算为每期 7.5 次。</div>
      </div>
    `,
  ];

  projection.teacherRows.slice(0, 5).forEach((teacher) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${teacher.teacherName}</div>
        <div class="list-meta">${formatScheduleSettlementStatus(teacher.status)} · 本周槽位 ${teacher.recurringSlotCount} 个 · 暑假约 ${formatCompactSlotValue(teacher.summerEquivalentSessionCount)} 次</div>
        <div class="list-meta">单期约结算 ${formatCurrency(teacher.projectedAmountPerPhase)} · 暑假约结算 ${formatCurrency(teacher.projectedAmountSummer)}</div>
        ${
          teacher.estimatedRevenueSummer > 0
            ? `<div class="list-meta">单期约收入 ${formatCurrency(teacher.estimatedRevenuePerPhase)} · 暑假毛结余 ${formatCurrency(teacher.teachingMarginSummer)}</div>`
            : ""
        }
        <div class="list-meta">${teacher.notes[0] || "当前规则已能支撑暑假三期测算。"}</div>
      </div>
    `);
  });

  return cards.join("");
}

function buildScheduleInputProfileHtml() {
  if (!hasImportedScheduleInputProfileReport()) {
    return `<div class="empty-state">导入 schedule-input-profile-report.json 后，这里会显示真实排课源的名册、意向、月历、课程大纲和暑期分组画像。</div>`;
  }

  const summary = state.scheduleInputProfileReport.summary || {};
  const requestSummary = state.scheduleInputProfileReport.request_summary || {};
  const calendarSummary = state.scheduleInputProfileReport.calendar_summary || {};
  const teachingPlanSummary = state.scheduleInputProfileReport.teaching_plan_summary || {};
  const summerGroupSummary = state.scheduleInputProfileReport.summer_group_summary || {};
  const teacherProfiles = Array.isArray(state.scheduleInputProfileReport.teacher_profiles)
    ? [...state.scheduleInputProfileReport.teacher_profiles].sort(
        (left, right) =>
          Number(right.calendar_billable_cell_count || 0) -
            Number(left.calendar_billable_cell_count || 0) ||
          String(left.teacher_name || "").localeCompare(String(right.teacher_name || ""), "zh-CN")
      )
    : [];
  const topTeachers = Array.isArray(requestSummary.top_target_teachers)
    ? requestSummary.top_target_teachers.slice(0, 4)
    : [];
  const topRooms = Array.isArray(calendarSummary.room_hint_counts)
    ? calendarSummary.room_hint_counts.slice(0, 4)
    : [];
  const topTeachingPlanTeachers = Array.isArray(teachingPlanSummary.teacher_counts)
    ? teachingPlanSummary.teacher_counts.slice(0, 4)
    : [];
  const topTeachingPlanSheets = Array.isArray(teachingPlanSummary.sheet_counts)
    ? teachingPlanSummary.sheet_counts.slice(0, 4)
    : [];
  const topTeachingPlanTitles = Array.isArray(teachingPlanSummary.top_titles)
    ? teachingPlanSummary.top_titles.slice(0, 4)
    : [];
  const topSummerGroupSheets = Array.isArray(summerGroupSummary.sheet_counts)
    ? summerGroupSummary.sheet_counts.slice(0, 4)
    : [];
  const topSummerGroupSizes = Array.isArray(summerGroupSummary.row_size_counts)
    ? summerGroupSummary.row_size_counts.slice(0, 4)
    : [];

  const cards = [
    `
      <div class="list-card">
        <div class="list-title">真实排课输入总览</div>
        <div class="list-meta">报名 ${summary.course_enrollment_count || 0} · 意向 ${summary.schedule_request_count || 0} · 调班 ${summary.student_transfer_count || 0} · 月历 ${summary.calendar_cell_count || 0}</div>
        <div class="list-meta">课程大纲 ${summary.teaching_plan_row_count || 0} 行 · 暑期分组 ${summary.summer_group_row_count || 0} 行</div>
        <div class="list-meta">老师 ${summary.calendar_teacher_count || 0} 人 · 日期 ${summary.calendar_date_range_start || "—"} ~ ${summary.calendar_date_range_end || "—"}</div>
      </div>
    `,
    `
      <div class="list-card">
        <div class="list-title">意向与历史课次</div>
        <div class="list-meta">有时间偏好 ${requestSummary.preferred_time_present_count || 0} · 指向老师 ${requestSummary.target_teacher_present_count || 0} · 意向学生 ${requestSummary.distinct_student_count || 0}</div>
        <div class="list-meta">月历候选学生 ${calendarSummary.distinct_student_name_candidate_count || 0} · 课程日期 ${calendarSummary.distinct_course_date_count || 0}</div>
      </div>
    `,
  ];

  cards.push(`
    <div class="list-card">
      <div class="list-title">课程大纲画像</div>
      <div class="list-meta">大纲行 ${summary.teaching_plan_row_count || 0} · 来源页 ${topTeachingPlanSheets.length || 0} 组</div>
      ${
        topTeachingPlanSheets.length
          ? `<div class="list-meta preserve-lines">${topTeachingPlanSheets
              .map(
                (item) =>
                  `${escapeHtml(item.sheet_name || "未命名工作表")} ${item.count || 0} 行`
              )
              .join("\n")}</div>`
          : `<div class="list-meta">当前没有课程大纲来源页摘要。</div>`
      }
      ${
        topTeachingPlanTitles.length
          ? `<div class="list-meta preserve-lines">${topTeachingPlanTitles
              .map((item) => `${escapeHtml(item.title || "未命名标题")} × ${item.count || 0}`)
              .join("\n")}</div>`
          : ""
      }
    </div>
  `);

  cards.push(`
    <div class="list-card">
      <div class="list-title">暑期分组画像</div>
      <div class="list-meta">分组行 ${summary.summer_group_row_count || 0} · 覆盖学生 ${summerGroupSummary.distinct_student_count || 0} 人</div>
      ${
        topSummerGroupSheets.length
          ? `<div class="list-meta preserve-lines">${topSummerGroupSheets
              .map(
                (item) =>
                  `${escapeHtml(item.sheet_name || "未命名分组页")} ${item.count || 0} 行`
              )
              .join("\n")}</div>`
          : `<div class="list-meta">当前没有暑期分组来源页摘要。</div>`
      }
      ${
        topSummerGroupSizes.length
          ? `<div class="list-meta preserve-lines">${topSummerGroupSizes
              .map(
                (item) =>
                  `${escapeHtml(String(item.group_size || item.row_size || "0"))} 人组 × ${item.count || 0}`
              )
              .join("\n")}</div>`
          : ""
      }
    </div>
  `);

  topTeachers.forEach((item) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${item.teacher_name || "未识别老师"}</div>
        <div class="list-meta">意向指向 ${item.count || 0} 条</div>
      </div>
    `);
  });

  topRooms.forEach((item) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${item.room_hint || "未标教室"}</div>
        <div class="list-meta">月历教室提示 ${item.count || 0} 格</div>
      </div>
    `);
  });

  teacherProfiles.slice(0, 3).forEach((item) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${item.teacher_name || "未命名老师"}</div>
        <div class="list-meta">可计费 ${item.calendar_billable_cell_count || 0} 格 · 非计费 ${item.calendar_non_billable_cell_count || 0} 格</div>
        <div class="list-meta">名册 ${item.enrollment_row_count || 0} 人 · 目标请求 ${item.request_targeted_count || 0} 条 · 大纲 ${item.teaching_plan_row_count || 0} 行</div>
      </div>
    `);
  });

  topTeachingPlanTeachers.forEach((item) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${item.teacher_name || "未命名老师"}</div>
        <div class="list-meta">课程大纲 ${item.count || 0} 行</div>
      </div>
    `);
  });

  return cards.join("");
}

function buildScheduleDraftImportHtml() {
  if (!hasImportedScheduleDraftImportReport()) {
    return `<div class="empty-state">导入 schedule-draft-import-report.json 后，这里会显示真实名册转草稿时还需要人工复核的点。</div>`;
  }

  const summary = state.scheduleDraftImportReport.summary || {};
  const reviewSummary = state.scheduleDraftReviewReport.summary || {};
  const bulkCandidateSummary =
    state.scheduleDraftReviewBulkCandidatesReport.summary || {};
  const manualReviewSummary = state.scheduleDraftManualReviewReport.summary || {};
  const manualClassnameBatchSummary =
    state.scheduleDraftManualClassnameBatchCandidatesReport.summary || {};
  const manualBatchSummary =
    state.scheduleDraftManualClassroomBatchCandidatesReport.summary || {};
  const reviewRows = Array.isArray(state.scheduleDraftReviewReport.review_rows)
    ? state.scheduleDraftReviewReport.review_rows
    : [];
  const unresolvedTeacherAliases = Array.isArray(
    state.scheduleDraftImportReport.unresolved_teacher_aliases
  )
    ? state.scheduleDraftImportReport.unresolved_teacher_aliases
    : [];
  const cards = [
    `
      <div class="list-card">
        <div class="list-title">草稿导入总览</div>
        <div class="list-meta">学生 ${summary.student_row_count || 0} · 班级 ${summary.class_group_row_count || 0} · 需求 ${summary.demand_row_count || 0} · 历史课次 ${summary.teacher_schedule_row_count || 0}</div>
        <div class="list-meta">常规在读组 ${summary.regular_class_group_count || 0} · 暑期大班 ${summary.summer_class_group_count || 0} · 历史回填 ${summary.legacy_class_group_count || 0} · 意向聚合 ${summary.request_demand_count || 0}</div>
      </div>
    `,
    `
      <div class="list-card">
        <div class="list-title">当前待复核重点</div>
        <div class="list-meta">合成班名 ${summary.synthetic_schedule_class_name_count || 0} 行 · 缺教室 ${summary.schedule_missing_classroom_count || 0} 行</div>
        <div class="list-meta">多班级学生 ${summary.multi_class_student_count || 0} 人 · 离职老师引用 ${summary.inactive_teacher_reference_count || 0} 条</div>
      </div>
    `,
    `
      <div class="list-card">
        <div class="list-title">排课复核模板</div>
        <div class="list-meta">待处理 ${reviewSummary.unresolved_row_count || 0} 条 · 草稿班名 ${reviewSummary.draft_class_name_count || 0} 条 · 缺教室 ${reviewSummary.missing_classroom_count || 0} 条</div>
        <div class="list-meta">建议已给出：班名 ${reviewSummary.suggested_class_name_count || 0} 条 · 教室 ${reviewSummary.suggested_classroom_count || 0} 条</div>
      </div>
    `,
    `
      <div class="list-card">
        <div class="list-title">复核拆分进度</div>
        <div class="list-meta">高置信候选 ${bulkCandidateSummary.row_count || 0} 条 · 残余人工 ${manualReviewSummary.total_rows || 0} 条 · 班名批量 ${manualClassnameBatchSummary.covered_row_count || 0} 条 · 教室批量 ${manualBatchSummary.covered_row_count || 0} 条</div>
        <div class="list-meta">现在不需要再只盯总表，系统已经把“先批量、后逐条”的顺序拆出来了。</div>
      </div>
    `,
    `
      <div class="list-card">
        <div class="list-title">结算投影就绪度</div>
        <div class="list-meta">需求收入估算已填 ${summary.demand_estimated_revenue_filled_count || 0}/${summary.demand_row_count || 0}</div>
        <div class="list-meta">这批真实需求导入后，原型可以直接拿来做 revenue-share 周结算和暑假三期测算。</div>
      </div>
    `,
  ];

  if (unresolvedTeacherAliases.length) {
    unresolvedTeacherAliases.slice(0, 4).forEach((item) => {
      cards.push(`
        <div class="list-card">
          <div class="list-title">${item.raw_teacher_name || "未识别简称"}</div>
          <div class="list-meta">简称未落主数据 ${item.count || 0} 条</div>
        </div>
      `);
    });
  } else {
    cards.push(`
      <div class="list-card">
        <div class="list-title">老师简称</div>
        <div class="list-meta">当前这批真实表里，导入脚本已没有遗留未识别老师简称。</div>
      </div>
    `);
  }

  cards.push(`
    <div class="list-card">
      <div class="list-title">使用建议</div>
      <div class="list-meta">先批量处理高置信候选，再处理班名批量候选和教室批量候选，最后只看残余逐条人工队列；这样排课复核和老师结算迁移会更快收口。</div>
    </div>
  `);

  if (reviewRows.length) {
    reviewRows.slice(0, 3).forEach((row) => {
      cards.push(`
        <div class="list-card">
          <div class="list-title">${row.teacher_name || "未命名老师"} · ${row.course_date || "未识别日期"} ${row.start_time || ""}</div>
          <div class="list-meta">问题 ${row.issue_flags || "未识别"} · 当前班名 ${row.current_class_name || "—"} · 当前教室 ${row.current_classroom_name || "未填"}</div>
          <div class="list-meta">建议班名 ${row.suggested_class_name || "—"} · 建议教室 ${row.suggested_classroom_name || "—"}</div>
        </div>
      `);
    });
  }

  return cards.join("");
}

function renderRoomScheduleView() {
  const container = document.getElementById("roomScheduleView");
  if (!container) {
    return;
  }

  const selectedDay = uiState.roomViewDay || "all";
  const entries = scheduleCache ? scheduleCache.entries : [];
  const summerLockReport = scheduleCache
    ? scheduleCache.summerLockReport
    : buildSummerBigClassRoomLockReport(state.summerBigClassRoomOccupancyReport);
  const roomLocks = summerLockReport.roomLocks;
  const rooms = [...state.rooms].sort((left, right) => right.summerPriority - left.summerPriority || left.name.localeCompare(right.name, "zh-CN"));

  container.innerHTML = rooms
    .map((room) => {
      const roomLockEntries = roomLocks
        .filter((lock) => lock.roomName === room.name && (selectedDay === "all" || lock.dayKey === selectedDay))
        .map((lock) => ({
          itemType: "lock",
          sortDay: getDaySortIndex(lock.dayKey),
          sortSlot: lock.slotIndex,
          html: `
            <div class="room-slot-item">
              <strong>${lock.dayLabel} · ${lock.slotLabel}</strong>
              <div class="list-meta">${lock.classGroupSummaryText || "暑期大课占用"} · ${lock.subjectSummaryText || "大课"}</div>
              <div class="schedule-meta">
                <span class="chip">${lock.lockLevel === "needs_teacher_hint" ? "待补标注" : "大课锁定"}</span>
                <span class="chip chip-muted">${lock.teacherSummaryText || "教室保留"}</span>
              </div>
              <div class="list-meta">${lock.noteText}</div>
            </div>
          `,
        }));
      const roomEntries = entries
        .filter((entry) => entry.roomName === room.name && (selectedDay === "all" || entry.dayKey === selectedDay))
        .map((entry) => ({
          itemType: "schedule",
          sortDay: getDaySortIndex(entry.dayKey),
          sortSlot: entry.slotIndex,
          html: `
            <div class="room-slot-item">
              <strong>${entry.dayLabel} · ${entry.slotLabel}</strong>
              <div class="list-meta">${entry.name}</div>
              <div class="schedule-meta">
                <span class="chip">${entry.teacherName}</span>
                <span class="chip chip-muted">临时建议</span>
                <span class="chip">${entry.size}人</span>
              </div>
            </div>
          `,
        }));
      const roomEvents = [...roomLockEntries, ...roomEntries].sort(
        (left, right) =>
          left.sortDay - right.sortDay ||
          left.sortSlot - right.sortSlot ||
          (left.itemType === right.itemType ? 0 : left.itemType === "lock" ? -1 : 1)
      );

      const slotHtml = roomEvents.length
        ? roomEvents
            .map((item) => item.html)
            .join("")
        : `<div class="room-slot-item room-slot-empty">当前筛选条件下暂无建议课次。</div>`;
      const roomLockCount = roomLocks.filter((lock) => lock.roomName === room.name).length;

      return `
        <article class="room-card">
          <div class="room-card-head">
            <div>
              <h4>${room.name}</h4>
              <div class="room-card-meta">${room.floor} · 最大 ${room.maxCapacity} 人 · ${formatOption(room.roomType)}</div>
            </div>
            <div class="schedule-meta">
              ${roomLockCount ? `<span class="chip">锁定 ${roomLockCount} 档</span>` : ""}
              <span class="chip chip-muted">优先级 ${room.summerPriority}</span>
            </div>
          </div>
          <div class="room-slot-list">${slotHtml}</div>
        </article>
      `;
    })
    .join("");
}

function buildSummerBigClassOccupancyHtml(lockReport) {
  if (!hasImportedSummerBigClassRoomOccupancyReport()) {
    return `<div class="empty-state">导入暑期大课占用 JSON 后，这里会显示锁房摘要和待补标注班级。</div>`;
  }

  const summary = lockReport?.summary || buildSummerBigClassRoomLockReport(state.summerBigClassRoomOccupancyReport).summary;
  const roomSummaries = lockReport?.roomSummaries || [];
  const unresolvedSummaries = lockReport?.unresolvedSummaries || [];
  const manualResolutionSummaries = lockReport?.manualResolutionSummaries || [];
  const pendingManualResolutionSummaries = manualResolutionSummaries.filter(
    (row) => !row.isTerminal
  );
  const pendingManualResolutionKeys = new Set(
    pendingManualResolutionSummaries.map(
      (row) => `${row.classGroupName}||${row.subjectName}`
    )
  );
  const cards = [
    `
      <div class="list-card">
        <div class="list-title">周视图锁房摘要</div>
        <div class="list-meta">锁定 ${summary.lockSlotCount} 档 · 已解析 ${summary.resolvedSourceCount} 行 · 待补标注 ${summary.needsTeacherHintSourceCount} 行</div>
        <div class="list-meta">缺海/姚标注时，教室周视图会先保守占住三楼4号和三楼6号；源报告仍保持待确认。</div>
      </div>
    `,
  ];

  if (summary.manualResolutionGroupCount) {
    cards.push(`
      <div class="list-card">
        <div class="list-title">分组回填进度</div>
        <div class="list-meta">共 ${summary.manualResolutionGroupCount} 组 · 待确认 ${summary.manualResolutionPendingGroupCount} 组 · 已确认 ${summary.manualResolutionConfirmedGroupCount} 组</div>
        <div class="list-meta">填完 <code>summer-big-class-hint-resolutions-template.csv</code> 后重跑流水线，这里会同步刷新。</div>
      </div>
    `);
  }

  roomSummaries.slice(0, 4).forEach((room) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${room.roomName}</div>
        <div class="list-meta">周视图锁定 ${room.lockSlotCount} 档 · 来源 ${room.sourceCount} 行</div>
      </div>
    `);
  });

  pendingManualResolutionSummaries.slice(0, 5).forEach((row) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${row.classGroupName} · ${row.subjectName}</div>
        <div class="list-meta">待补 ${row.unresolvedRowCount} 行 · ${row.sampleDateText || "日期待确认"} · ${row.timeRangeText || "时段待确认"}</div>
        <div class="list-meta">${row.resolutionSummaryText}</div>
      </div>
    `);
  });

  unresolvedSummaries
    .filter((row) => !pendingManualResolutionKeys.has(`${row.classGroupName}||${row.subjectName}`))
    .slice(0, 5)
    .forEach((row) => {
    cards.push(`
      <div class="list-card">
        <div class="list-title">${row.classGroupName} · ${row.subjectName}</div>
        <div class="list-meta">待补 ${row.count} 行 · ${row.daySummaryText || "日期待确认"} · ${row.timeRangeSummaryText || "时段待确认"}</div>
        <div class="list-meta">${row.noteText}</div>
      </div>
    `);
    });

  return cards.join("");
}

function formatSummerManualResolutionPayload(payload, { stripLabel = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  const printable = stripLabel
    ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "label"))
    : payload;
  if (!Object.keys(printable).length) {
    return "";
  }
  return JSON.stringify(printable);
}

function formatSummerManualResolutionPayloadOptions(payloads) {
  if (!Array.isArray(payloads)) {
    return "";
  }
  return payloads
    .map((payload) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return "";
      }
      const label = String(payload.label || "").trim();
      const payloadText = formatSummerManualResolutionPayload(payload, {
        stripLabel: true,
      });
      if (!payloadText) {
        return "";
      }
      return label ? `${label}=${payloadText}` : payloadText;
    })
    .filter(Boolean)
    .join(" / ");
}

function buildSummerBigClassRoomLockReport(report) {
  const normalizedReport = normalizeSummerBigClassRoomOccupancyReport(report);
  const roomLockMap = new Map();
  const roomSummaryMap = new Map();
  const unresolvedMap = new Map();
  const manualResolutionRows = Array.isArray(normalizedReport.manual_resolution_rows)
    ? normalizedReport.manual_resolution_rows
    : [];
  let resolvedSourceCount = 0;
  let needsTeacherHintSourceCount = 0;

  normalizedReport.occupancy_rows.forEach((row) => {
    if (row.resolution_status === "resolved") {
      resolvedSourceCount += 1;
    }
    if (row.resolution_status === "needs_teacher_hint") {
      needsTeacherHintSourceCount += 1;
    }

    const roomNames = getSummerOccupancyCandidateRooms(row);
    const dayKey = getDayKeyFromDate(row.course_date);
    const slotIndexes = getOverlappingSlotIndexes(row.time_range_text);
    if (!roomNames.length || !dayKey || !slotIndexes.length) {
      return;
    }

    roomNames.forEach((roomName) => {
      if (!roomSummaryMap.has(roomName)) {
        roomSummaryMap.set(roomName, {
          roomName,
          lockSlotCount: 0,
          sourceCount: 0,
        });
      }
      const roomSummary = roomSummaryMap.get(roomName);
      roomSummary.sourceCount += 1;

      slotIndexes.forEach((slotIndex) => {
        const key = `${roomName}-${dayKey}-${slotIndex}`;
        if (!roomLockMap.has(key)) {
          roomLockMap.set(key, {
            key,
            roomName,
            dayKey,
            dayLabel: getDayLabel(dayKey),
            slotIndex,
            slotLabel: getSlotLabel(slotIndex),
            sourceCount: 0,
            resolvedCount: 0,
            needsTeacherHintCount: 0,
            classGroups: [],
            subjects: [],
            teacherNames: [],
            notes: [],
            lockLevel: "imported",
          });
          roomSummary.lockSlotCount += 1;
        }

        const lock = roomLockMap.get(key);
        lock.sourceCount += 1;
        if (row.resolution_status === "resolved") {
          lock.resolvedCount += 1;
        }
        if (row.resolution_status === "needs_teacher_hint") {
          lock.needsTeacherHintCount += 1;
        }
        lock.lockLevel = lock.resolvedCount > 0
          ? "resolved"
          : lock.needsTeacherHintCount > 0
            ? "needs_teacher_hint"
            : row.resolution_status || "imported";

        addUniqueString(lock.classGroups, row.class_group_name);
        addUniqueString(lock.subjects, row.subject_name);
        row.teacher_names.forEach((teacherName) => addUniqueString(lock.teacherNames, teacherName));
        addUniqueString(lock.notes, buildSummerLockNote(row, roomName));
      });
    });
  });

  normalizedReport.unresolved_rows.forEach((row) => {
    const key = `${row.class_group_name}||${row.subject_name}`;
    if (!unresolvedMap.has(key)) {
      unresolvedMap.set(key, {
        classGroupName: row.class_group_name,
        subjectName: row.subject_name,
        count: 0,
        dayLabels: [],
        timeRanges: [],
        notes: [],
      });
    }
    const summary = unresolvedMap.get(key);
    summary.count += 1;
    addUniqueString(summary.dayLabels, getDayLabel(getDayKeyFromDate(row.course_date)));
    addUniqueString(summary.timeRanges, row.time_range_text);
    addUniqueString(summary.notes, row.notes);
  });

  const roomLocks = [...roomLockMap.values()]
    .map((lock) => ({
      ...lock,
      teacherSummaryText: lock.teacherNames.join(" / "),
      classGroupSummaryText: lock.classGroups.join(" / "),
      subjectSummaryText: lock.subjects.join(" / "),
      noteText: lock.notes[0] || "暑期大课教室占用",
    }))
    .sort(
      (left, right) =>
        getDaySortIndex(left.dayKey) - getDaySortIndex(right.dayKey) ||
        left.slotIndex - right.slotIndex ||
        left.roomName.localeCompare(right.roomName, "zh-CN")
    );
  const roomSummaries = [...roomSummaryMap.values()].sort(
    (left, right) =>
      right.lockSlotCount - left.lockSlotCount ||
      left.roomName.localeCompare(right.roomName, "zh-CN")
  );
  const unresolvedSummaries = [...unresolvedMap.values()]
    .map((item) => ({
      ...item,
      daySummaryText: item.dayLabels.join(" / "),
      timeRangeSummaryText: item.timeRanges.join(" / "),
      noteText: item.notes[0] || "仍需补老师标注。",
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.classGroupName.localeCompare(right.classGroupName, "zh-CN")
    );
  const manualResolutionSummaries = manualResolutionRows
    .map((row) => {
      const resolvedSubjectName = String(row.resolved_subject_name || "").trim();
      const resolvedTeacherNames = Array.isArray(row.resolved_teacher_names)
        ? row.resolved_teacher_names
        : [];
      const recommendedResolution = String(row.recommended_resolution || "").trim();
      const resolutionRequirementSummary = String(
        row.resolution_requirement_summary || ""
      ).trim();
      const resolutionStatus = String(row.resolution_status || "").trim();
      const isTerminal = isSummerManualResolutionTerminal(resolutionStatus);
      const resolvedParts = [];
      if (resolvedSubjectName) {
        resolvedParts.push(`科目改为 ${resolvedSubjectName}`);
      }
      if (resolvedTeacherNames.length) {
        resolvedParts.push(`老师 ${resolvedTeacherNames.join(" / ")}`);
      }
      const notes = String(row.notes || "").trim();
      const suggestedResolutionPayloadText = formatSummerManualResolutionPayload(
        row.suggested_resolution_payload
      );
      const candidateResolutionPayloadText =
        formatSummerManualResolutionPayloadOptions(
          row.candidate_resolution_payloads
        );
      return {
        classGroupName: row.class_group_name,
        subjectName: row.subject_name,
        timeRangeText: row.time_range_text,
        unresolvedRowCount: Number(row.unresolved_row_count || 0),
        sampleDateText: Array.isArray(row.course_date_samples)
          ? row.course_date_samples.slice(0, 3).join(" / ")
          : "",
        status: resolutionStatus || "pending",
        statusLabel: isTerminal ? "已确认" : "待确认",
        isTerminal,
        resolutionSummaryText: isTerminal
          ? [resolvedParts.join(" · "), notes].filter(Boolean).join("；") || "已确认，等待回放到锁房结果。"
          : [
              resolutionRequirementSummary || recommendedResolution || "待人工判断。",
              notes,
              suggestedResolutionPayloadText
                ? `直接回填 ${suggestedResolutionPayloadText}`
                : "",
              candidateResolutionPayloadText
                ? `可选 ${candidateResolutionPayloadText}`
                : "",
            ]
              .filter(Boolean)
              .join("；"),
      };
    })
    .sort(
      (left, right) =>
        Number(left.isTerminal) - Number(right.isTerminal) ||
        right.unresolvedRowCount - left.unresolvedRowCount ||
        left.classGroupName.localeCompare(right.classGroupName, "zh-CN")
    );
  const manualResolutionConfirmedGroupCount = manualResolutionSummaries.filter(
    (row) => row.isTerminal
  ).length;
  const manualResolutionGroupCount = manualResolutionSummaries.length;
  const manualResolutionPendingGroupCount = Math.max(
    manualResolutionGroupCount - manualResolutionConfirmedGroupCount,
    0
  );

  return {
    roomLockMap,
    roomLocks,
    roomSummaries,
    unresolvedSummaries,
    manualResolutionSummaries,
    summary: {
      sessionCount: normalizedReport.summary.session_count,
      occupancyRowCount: normalizedReport.summary.occupancy_row_count,
      unresolvedRowCount: normalizedReport.summary.unresolved_row_count,
      resolvedSourceCount,
      needsTeacherHintSourceCount,
      lockSlotCount: roomLocks.length,
      manualResolutionGroupCount:
        manualResolutionGroupCount ||
        Number(normalizedReport.summary.manual_resolution_group_count || 0),
      manualResolutionConfirmedGroupCount:
        manualResolutionConfirmedGroupCount ||
        Number(normalizedReport.summary.manual_resolution_confirmed_group_count || 0),
      manualResolutionPendingGroupCount:
        manualResolutionPendingGroupCount ||
        Number(normalizedReport.summary.manual_resolution_pending_group_count || 0),
    },
  };
}

function getSummerRoomLock(lockReport, roomName, dayKey, slotIndex) {
  if (!lockReport?.roomLockMap) {
    return null;
  }
  return lockReport.roomLockMap.get(`${roomName}-${dayKey}-${slotIndex}`) || null;
}

function getSummerOccupancyCandidateRooms(row) {
  if (row.classroom_name) {
    return [row.classroom_name];
  }
  if (row.resolution_status === "needs_teacher_hint" && row.subject_name === "科学") {
    return ["三楼4号教室", "三楼6号教室"];
  }
  return [];
}

function buildSummerLockNote(row, roomName) {
  if (row.resolution_status === "needs_teacher_hint" && !row.classroom_name) {
    return `科学课缺海/姚标注，教室周视图先保守锁定 ${roomName}。`;
  }
  return row.notes || "暑期大课教室占用。";
}

function getDayKeyFromDate(dateText) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText || "").trim());
  if (!match) {
    return "";
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
  }[date.getDay()] || "";
}

function getDaySortIndex(dayKey) {
  const index = DAY_TEMPLATES.findIndex((day) => day.key === dayKey);
  return index === -1 ? 99 : index;
}

function getDayLabel(dayKey) {
  return DAY_TEMPLATES.find((day) => day.key === dayKey)?.label || dayKey || "未知星期";
}

function getSlotLabel(slotIndex) {
  return SLOT_TEMPLATES.find((slot) => slot.index === slotIndex)?.label || `第${slotIndex}节`;
}

function getOverlappingSlotIndexes(timeRangeText) {
  const timeRange = parseTimeRangeToMinutes(timeRangeText);
  if (!timeRange) {
    return [];
  }
  return SLOT_TEMPLATES.filter((slot) => {
    const slotTimeRange = parseTimeRangeToMinutes(slot.time);
    if (!slotTimeRange) {
      return false;
    }
    return timeRangesOverlap(
      timeRange.startMinutes,
      timeRange.endMinutes,
      slotTimeRange.startMinutes,
      slotTimeRange.endMinutes
    );
  }).map((slot) => slot.index);
}

function parseTimeRangeToMinutes(timeRangeText) {
  const parts = String(timeRangeText || "").trim().split("-");
  if (parts.length !== 2) {
    return null;
  }
  const startMinutes = parseClockTextToMinutes(parts[0]);
  const endMinutes = parseClockTextToMinutes(parts[1]);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }
  return { startMinutes, endMinutes };
}

function parseClockTextToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeRangesOverlap(startA, endA, startB, endB) {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

function addUniqueString(target, value) {
  const normalized = String(value || "").trim();
  if (!normalized || target.includes(normalized)) {
    return;
  }
  target.push(normalized);
}

function generateSchedule(sourceState) {
  const teachers = sourceState.teachers.filter((teacher) => teacher.status !== "inactive");
  const rooms = sourceState.rooms.filter((room) => room.isActive !== false);
  const demands = sourceState.demands.filter((demand) => demand.status !== "cancelled");
  const summerLockReport = buildSummerBigClassRoomLockReport(
    sourceState.summerBigClassRoomOccupancyReport
  );

  const demandSessions = expandDemandSessions(demands).sort(compareDemandSessions);
  const entries = [];
  const unscheduled = [];

  const teacherSlotMap = new Map();
  const roomSlotMap = new Map();
  const teacherWeekCount = new Map();
  const teacherDayCount = new Map();

  for (const demand of demandSessions) {
    const slotCandidates = buildSlotCandidates(demand, entries);
    const bestChoice = findBestScheduleChoice({
      demand,
      slotCandidates,
      teachers,
      rooms,
      teacherSlotMap,
      teacherWeekCount,
      teacherDayCount,
      roomSlotMap,
      entries,
      summerLockReport,
    });

    if (!bestChoice) {
      unscheduled.push({
        name: demand.name,
        sessionNumber: demand.sessionNumber,
        reason:
          demand.courseType === "one_to_one"
            ? "当前一对一没有找到可用的老师、教室和时段组合；系统会先尝试非核心老师，必要时才放开核心老师兜底。"
            : "当前老师、教室或时段组合不满足规则，建议继续招生或手工调整。",
      });
      continue;
    }

    const entry = {
      id: `${demand.id}-${demand.sessionNumber}`,
      demandId: demand.id,
      name: demand.name,
      subject: demand.subject,
      grade: demand.grade,
      size: demand.size,
      courseType: demand.courseType,
      weeklySessions: Number(demand.weeklySessions || 0),
      estimatedRevenuePerSession: Number(demand.estimatedRevenuePerSession || 0),
      preferredTime: demand.preferredTime,
      dayKey: bestChoice.slotCandidate.day.key,
      dayKind: bestChoice.slotCandidate.day.kind,
      dayLabel: bestChoice.slotCandidate.day.label,
      slotIndex: bestChoice.slotCandidate.slot.index,
      slotLabel: bestChoice.slotCandidate.slot.label,
      slotTime: bestChoice.slotCandidate.slot.time,
      teacherName: bestChoice.teacher.name,
      teacherIsCore: Boolean(bestChoice.teacher.isCore),
      roomName: bestChoice.room.name,
      assignmentPolicy: bestChoice.assignmentPolicy || "default",
      coreOneToOneFallback:
        demand.courseType === "one_to_one" &&
        bestChoice.teacher.isCore &&
        bestChoice.assignmentPolicy === "core_fallback_for_one_to_one",
      assignmentNote:
        demand.courseType === "one_to_one" && bestChoice.teacher.isCore
          ? bestChoice.assignmentPolicy === "grade_nine_core_one_to_one"
            ? "初三一对一按年级规则优先由核心老师承接。"
            : bestChoice.assignmentPolicy === "core_fallback_for_one_to_one"
              ? "当前没有可承接的一对一非核心老师，系统已启用核心老师兜底。"
              : ""
          : "",
    };

    entries.push(entry);
    teacherSlotMap.set(`${bestChoice.teacher.name}-${entry.dayKey}-${entry.slotIndex}`, entry.id);
    roomSlotMap.set(`${bestChoice.room.name}-${entry.dayKey}-${entry.slotIndex}`, entry.id);
    teacherWeekCount.set(bestChoice.teacher.name, (teacherWeekCount.get(bestChoice.teacher.name) || 0) + 1);

    const teacherDayKey = `${bestChoice.teacher.name}-${entry.dayKey}`;
    teacherDayCount.set(teacherDayKey, (teacherDayCount.get(teacherDayKey) || 0) + 1);
  }

  const roomHeat = sourceState.rooms
    .map((room) => ({
      name: room.name,
      maxCapacity: room.maxCapacity,
      scheduledCount: entries.filter((entry) => entry.roomName === room.name).length,
      importedLockCount: summerLockReport.roomLocks.filter((entry) => entry.roomName === room.name).length,
    }))
    .sort(
      (left, right) =>
        right.importedLockCount + right.scheduledCount - (left.importedLockCount + left.scheduledCount) ||
        right.maxCapacity - left.maxCapacity
    )
    .slice(0, 8);

  const teacherLoad = teachers
    .map((teacher) => {
      const assignedDayKeys = getTeacherAssignedDayKeys(teacher.name, teacherDayCount);
      return {
        name: teacher.name,
        noEvening: teacher.noEvening,
        isCore: teacher.isCore,
        dayCapacity: getTeacherDailyCapacity(teacher),
        weeklyCapacity: getTeacherWeeklyCapacity(teacher),
        weeklyRestDaySummary: formatTeacherRestDaySummary(teacher),
        schedulePattern: teacher.schedulePattern || "6_on_1_off",
        assignedDayCount: assignedDayKeys.size,
        longestTeachingStreak: getTeacherLongestTeachingStreak(assignedDayKeys),
        count: entries.filter((entry) => entry.teacherName === teacher.name).length,
        oneToOneCount: entries.filter(
          (entry) => entry.teacherName === teacher.name && entry.courseType === "one_to_one"
        ).length,
        coreOneToOneFallbackCount: entries.filter(
          (entry) => entry.teacherName === teacher.name && entry.coreOneToOneFallback
        ).length,
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const coreOneToOneFallbacks = entries
    .filter((entry) => entry.coreOneToOneFallback)
    .sort(
      (left, right) =>
        left.teacherName.localeCompare(right.teacherName, "zh-CN") ||
        left.dayKey.localeCompare(right.dayKey, "zh-CN") ||
        left.slotIndex - right.slotIndex
    );

  return {
    entries,
    unscheduled,
    roomHeat,
    teacherLoad,
    coreOneToOneFallbacks,
    summerLockReport,
  };
}

function findBestScheduleChoice({
  demand,
  slotCandidates,
  teachers,
  rooms,
  teacherSlotMap,
  teacherWeekCount,
  teacherDayCount,
  roomSlotMap,
  entries,
  summerLockReport,
}) {
  const teacherPools = buildTeacherPoolsForDemand(demand, teachers);

  for (const teacherPool of teacherPools) {
    const bestChoice = findBestScheduleChoiceForTeacherPool({
      demand,
      slotCandidates,
      teachers: teacherPool.teachers,
      rooms,
      teacherSlotMap,
      teacherWeekCount,
      teacherDayCount,
      roomSlotMap,
      entries,
      summerLockReport,
    });
    if (bestChoice) {
      return { ...bestChoice, assignmentPolicy: teacherPool.assignmentPolicy };
    }
  }

  return null;
}

function buildTeacherPoolsForDemand(demand, teachers) {
  if (demand.courseType !== "one_to_one") {
    return [{ assignmentPolicy: "default", teachers }];
  }

  const gradeValue = Number(demand.grade || 0);
  if (gradeValue === 9) {
    const gradeSpecificCoreTeachers = teachers.filter(
      (teacher) =>
        teacher.isCore &&
        teacher.subject === demand.subject &&
        gradeValue >= Number(teacher.gradeFrom || 0) &&
        gradeValue <= Number(teacher.gradeTo || 0)
    );
    return [
      {
        assignmentPolicy: "grade_nine_core_one_to_one",
        teachers: gradeSpecificCoreTeachers,
      },
      {
        assignmentPolicy: "prefer_non_core_for_one_to_one",
        teachers: teachers.filter((teacher) => !teacher.isCore),
      },
      {
        assignmentPolicy: "core_fallback_for_one_to_one",
        teachers,
      },
    ];
  }

  return [
    {
      assignmentPolicy: "prefer_non_core_for_one_to_one",
      teachers: teachers.filter((teacher) => !teacher.isCore),
    },
    {
      assignmentPolicy: "core_fallback_for_one_to_one",
      teachers,
    },
  ];
}

function findBestScheduleChoiceForTeacherPool({
  demand,
  slotCandidates,
  teachers,
  rooms,
  teacherSlotMap,
  teacherWeekCount,
  teacherDayCount,
  roomSlotMap,
  entries,
  summerLockReport,
}) {
  if (!teachers.length) {
    return null;
  }

  let bestChoice = null;

  for (const slotCandidate of slotCandidates) {
    const teacherCandidates = teachers
      .map((teacher) => ({
        teacher,
        score: scoreTeacher(
          teacher,
          demand,
          slotCandidate,
          teacherSlotMap,
          teacherWeekCount,
          teacherDayCount
        ),
      }))
      .filter((item) => item.score > Number.NEGATIVE_INFINITY)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    for (const teacherCandidate of teacherCandidates) {
      const roomCandidates = rooms
        .map((room) => ({
          room,
          score: scoreRoom(
            room,
            demand,
            slotCandidate,
            teacherCandidate.teacher,
            roomSlotMap,
            entries,
            summerLockReport
          ),
        }))
        .filter((item) => item.score > Number.NEGATIVE_INFINITY)
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);

      for (const roomCandidate of roomCandidates) {
        const totalScore = slotCandidate.score + teacherCandidate.score + roomCandidate.score;
        if (!bestChoice || totalScore > bestChoice.totalScore) {
          bestChoice = {
            totalScore,
            slotCandidate,
            teacher: teacherCandidate.teacher,
            room: roomCandidate.room,
          };
        }
      }
    }
  }

  return bestChoice;
}

function scoreTeacher(teacher, demand, slotCandidate, teacherSlotMap, teacherWeekCount, teacherDayCount) {
  if (teacher.subject !== demand.subject) {
    return Number.NEGATIVE_INFINITY;
  }
  if (demand.grade < teacher.gradeFrom || demand.grade > teacher.gradeTo) {
    return Number.NEGATIVE_INFINITY;
  }
  if (demand.fixedTeacher && demand.fixedTeacher !== teacher.name) {
    return Number.NEGATIVE_INFINITY;
  }
  if (teacher.noEvening && slotCandidate.slot.index === 6) {
    return Number.NEGATIVE_INFINITY;
  }
  const restDayKeys = parseTeacherRestDayKeys(teacher);
  if (restDayKeys.includes(slotCandidate.day.key)) {
    return Number.NEGATIVE_INFINITY;
  }

  const slotKey = `${teacher.name}-${slotCandidate.day.key}-${slotCandidate.slot.index}`;
  if (teacherSlotMap.has(slotKey)) {
    return Number.NEGATIVE_INFINITY;
  }

  const weekCount = teacherWeekCount.get(teacher.name) || 0;
  const dayCount = teacherDayCount.get(`${teacher.name}-${slotCandidate.day.key}`) || 0;
  const dailyCapacity = getTeacherDailyCapacity(teacher);
  const weeklyCapacity = getTeacherWeeklyCapacity(teacher);
  if (weekCount >= weeklyCapacity || dayCount >= dailyCapacity) {
    return Number.NEGATIVE_INFINITY;
  }
  const assignedDayKeys = getTeacherAssignedDayKeys(teacher.name, teacherDayCount);
  assignedDayKeys.add(slotCandidate.day.key);
  const longestTeachingStreak = getTeacherLongestTeachingStreak(assignedDayKeys);
  const maxTeachingStreak = getTeacherMaxTeachingStreak(teacher);
  if (longestTeachingStreak > maxTeachingStreak) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  if (teacher.isCore && teacher.gradeFrom === demand.grade && teacher.gradeTo === demand.grade) {
    score += 180;
  } else if (teacher.gradeFrom === demand.grade && teacher.gradeTo === demand.grade) {
    score += 90;
  } else {
    score += teacher.isCore ? 72 : 55;
  }
  if (teacher.isCore && demand.courseType !== "one_to_one") {
    score += 110;
  }
  if (demand.courseType === "one_to_one") {
    score += teacher.isCore ? -420 : 90;
  }

  if (teacher.isKey) {
    score += 18;
  }
  if (teacher.isOwner && demand.fixedTeacher === teacher.name) {
    score += 50;
  }
  if (demand.fixedTeacher === teacher.name) {
    score += 480;
  }

  score += Math.max(0, weeklyCapacity - weekCount) * 1.2;
  score += Math.max(0, dailyCapacity - dayCount) * 8;
  if (!restDayKeys.length) {
    score += 8;
  }
  score += Math.max(0, maxTeachingStreak - longestTeachingStreak) * 10;
  if (teacher.schedulePattern === "3_on_1_off") {
    score += 18;
  }
  return score;
}

function scoreRoom(room, demand, slotCandidate, teacher, roomSlotMap, entries, summerLockReport) {
  if (room.maxCapacity < demand.size) {
    return Number.NEGATIVE_INFINITY;
  }
  if (demand.fixedRoom && demand.fixedRoom !== room.name) {
    return Number.NEGATIVE_INFINITY;
  }
  if (teacher.fixedRoom && teacher.fixedRoom !== room.name) {
    return Number.NEGATIVE_INFINITY;
  }
  if (demand.courseType === "one_to_one" && room.roomType !== "one_to_one") {
    return Number.NEGATIVE_INFINITY;
  }
  if (demand.courseType !== "one_to_one" && room.roomType === "one_to_one") {
    return Number.NEGATIVE_INFINITY;
  }

  const slotKey = `${room.name}-${slotCandidate.day.key}-${slotCandidate.slot.index}`;
  if (roomSlotMap.has(slotKey)) {
    return Number.NEGATIVE_INFINITY;
  }
  const importedLock = getSummerRoomLock(
    summerLockReport,
    room.name,
    slotCandidate.day.key,
    slotCandidate.slot.index
  );
  if (importedLock && (importedLock.lockLevel === "resolved" || importedLock.lockLevel === "needs_teacher_hint")) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 150 - Math.abs(room.maxCapacity - demand.size) * 3;
  score += room.summerPriority;

  if (demand.fixedRoom === room.name) {
    score += 450;
  }
  if (teacher.fixedRoom && teacher.fixedRoom === room.name) {
    score += 60;
  }
  if (teacher.name !== "程老师" && room.name === "三楼5号教室" && demand.fixedRoom !== "三楼5号教室") {
    score -= 35;
  }
  if (demand.subject === "science" && demand.size >= 20 && (room.name === "三楼4号教室" || room.name === "三楼6号教室")) {
    score += 28;
  }
  if (demand.courseType === "one_to_one") {
    score += teacher.isCore ? -260 : 40;
  }

  const adjacency = countRoomAdjacency(entries, room.name, slotCandidate.day.key, slotCandidate.slot.index);
  score += adjacency * 18;
  return score;
}

function getTeacherDailyCapacity(teacher) {
  const baseline = teacher.isCore ? 6 : 5;
  const configured = Number(teacher.maxPerDay || 0);
  if (!configured) {
    return baseline;
  }
  return Math.max(1, Math.min(configured, baseline));
}

function getTeacherWeeklyCapacity(teacher) {
  const baseline = getTeacherDailyCapacity(teacher) * 6;
  const configured = Number(teacher.maxPerWeek || 0);
  if (!configured) {
    return baseline;
  }
  return Math.max(getTeacherDailyCapacity(teacher), Math.min(configured, baseline));
}

function countRoomAdjacency(entries, roomName, dayKey, slotIndex) {
  return entries.filter(
    (entry) =>
      entry.roomName === roomName &&
      entry.dayKey === dayKey &&
      Math.abs(entry.slotIndex - slotIndex) === 1
  ).length;
}

function buildSlotCandidates(demand, entries) {
  const all = [];
  for (const day of DAY_TEMPLATES) {
    for (const slot of SLOT_TEMPLATES) {
      let score = 20;
      const isWeekend = day.kind === "weekend";
      const isEveningBand = slot.index >= 5;

      if (demand.preferredTime === "evening") {
        if (!isWeekend && isEveningBand) {
          score += 85;
        } else if (!isWeekend && slot.index === 4) {
          score += 40;
        } else if (isWeekend && isEveningBand) {
          score += 28;
        }
      } else if (demand.preferredTime === "weekend") {
        score += isWeekend ? 80 : 12;
      } else {
        score += isWeekend ? 18 : 22;
      }

      const slotHeat = entries.filter((entry) => entry.dayKey === day.key && entry.slotIndex === slot.index).length;
      score += slotHeat * 2;
      all.push({ day, slot, score });
    }
  }
  return all.sort((left, right) => right.score - left.score);
}

function expandDemandSessions(demands) {
  return demands.flatMap((demand) => {
    const weeklySessions = Number(demand.weeklySessions) || 0;
    return Array.from({ length: weeklySessions }, (_, index) => ({
      ...demand,
      sessionNumber: index + 1,
    }));
  });
}

function compareDemandSessions(left, right) {
  const statusScore = { confirmed: 3, planned: 2, recruiting: 1 };
  const courseTypeScore = { large_class: 4, medium_class: 3, small_class: 2, one_to_one: 1 };
  const fixedScoreLeft = (left.fixedTeacher ? 2 : 0) + (left.fixedRoom ? 1 : 0);
  const fixedScoreRight = (right.fixedTeacher ? 2 : 0) + (right.fixedRoom ? 1 : 0);
  return (
    statusScore[right.status] - statusScore[left.status] ||
    fixedScoreRight - fixedScoreLeft ||
    (courseTypeScore[right.courseType] || 0) - (courseTypeScore[left.courseType] || 0) ||
    right.size - left.size ||
    right.weeklySessions - left.weeklySessions
  );
}

function getSortedFinancialPeriods() {
  return [...state.financialPeriods].sort((left, right) => left.periodName.localeCompare(right.periodName, "zh-CN"));
}

function getLatestFinancialSummary() {
  const periods = getSortedFinancialPeriods();
  if (!periods.length) {
    return null;
  }
  return calculateFinancialSummary(periods[periods.length - 1]);
}

function resolveFinancialPeriodView(periodNames) {
  if (uiState.financialPeriodView && periodNames.includes(uiState.financialPeriodView)) {
    return uiState.financialPeriodView;
  }
  return periodNames[periodNames.length - 1] || "";
}

function getProfitExpenseRowsForPeriod(periodName) {
  return state.profitExpenseLines
    .filter((item) => item.periodName === periodName)
    .sort(
      (left, right) =>
        toNumber(right.amountRaw) - toNumber(left.amountRaw) ||
        left.categoryName.localeCompare(right.categoryName, "zh-CN")
    );
}

function chooseDividendPolicy(periodName) {
  const target = parsePeriodName(periodName);
  if (!target) {
    return null;
  }

  const candidates = state.dividendPolicies
    .filter((item) => {
      const start = parsePeriodName(item.effectiveStartPeriod);
      return start && (start.year < target.year || (start.year === target.year && start.month <= target.month));
    })
    .sort((left, right) =>
      String(left.effectiveStartPeriod || "").localeCompare(
        String(right.effectiveStartPeriod || ""),
        "zh-CN"
      )
    );
  return candidates[candidates.length - 1] || null;
}

function calculateDividendRate(periodName) {
  const policy = chooseDividendPolicy(periodName);
  if (!policy) {
    return 0;
  }
  const current = parsePeriodName(periodName);
  const start = parsePeriodName(policy.effectiveStartPeriod);
  if (!current || !start) {
    return 0;
  }
  const offset = (current.year - start.year) * 12 + (current.month - start.month);
  if (offset < 0) {
    return 0;
  }
  const baseRate = toNumber(policy.baseDividendRatePercent);
  const monthlyIncrement = toNumber(policy.monthlyIncrementPercent);
  const capRate = toNumber(policy.capDividendRatePercent);
  return Math.min(capRate, baseRate + monthlyIncrement * offset);
}

function calculateFinancialSummary(period) {
  const grossProfit = Number(period.grossProfit || 0);
  const totalExpense = Number(period.totalExpense || 0);
  const teachingBusinessExpense = Number(period.teachingBusinessExpense || 0);
  const netProfit = Number(period.netProfit || 0);
  const dividendRate = calculateDividendRate(period.periodName);
  const dividendPool = roundAmount(netProfit * dividendRate / 100);
  const retainedProfit = roundAmount(netProfit - dividendPool);
  return {
    periodName: period.periodName,
    grossProfit,
    totalExpense,
    teachingBusinessExpense,
    netProfit,
    dividendRate,
    dividendPool,
    retainedProfit,
  };
}

function buildDividendRulePreview(periods) {
  const existingNames = new Set(periods.map((item) => item.periodName));
  const preview = [];
  const firstPolicy = [...state.dividendPolicies].sort((left, right) =>
    String(left.effectiveStartPeriod || "").localeCompare(
      String(right.effectiveStartPeriod || ""),
      "zh-CN"
    )
  )[0];
  let periodName = firstPolicy?.effectiveStartPeriod || getCurrentPeriodName();
  while (preview.length < 8 && periodName) {
    const policy = chooseDividendPolicy(periodName);
    preview.push({
      periodName,
      rate: calculateDividendRate(periodName),
      note: policy
        ? `${policy.effectiveStartPeriod} 起 ${formatPercent(policy.baseDividendRatePercent)}，之后每月 +${formatPercent(policy.monthlyIncrementPercent)}，${formatPercent(policy.capDividendRatePercent)} 封顶${existingNames.has(periodName) ? "；该月已录入利润，可直接核对。" : "；该月未录利润时先按规则预估。"}`
        : "当前没有可用分红政策。",
    });
    periodName = shiftPeriodName(periodName, 1);
  }
  return preview;
}

function resolveSettlementPeriod(periods) {
  if (uiState.settlementPeriod && periods.includes(uiState.settlementPeriod)) {
    return uiState.settlementPeriod;
  }
  return periods[periods.length - 1] || "";
}

function resolveSettlementTeacher(teachers) {
  if (uiState.settlementTeacher && teachers.includes(uiState.settlementTeacher)) {
    return uiState.settlementTeacher;
  }
  return teachers[0] || "";
}

function sumBy(rows, field) {
  return roundAmount(rows.reduce((sum, row) => sum + toNumber(row[field]), 0));
}

function renderCell(entity, item, index, config) {
  if (config.type === "select") {
    return `
      <td>
        <select class="cell-select" data-entity="${entity}" data-index="${index}" data-field="${config.field}">
          ${config.options
            .map((option) => `<option value="${option}" ${String(item[config.field]) === option ? "selected" : ""}>${formatOption(option)}</option>`)
            .join("")}
        </select>
      </td>
    `;
  }

  if (config.type === "boolean") {
    return `
      <td>
        <select class="cell-select" data-entity="${entity}" data-index="${index}" data-field="${config.field}">
          <option value="false" ${item[config.field] ? "" : "selected"}>否</option>
          <option value="true" ${item[config.field] ? "selected" : ""}>是</option>
        </select>
      </td>
    `;
  }

  return `
    <td>
      <input
        class="cell-input"
        type="${config.type === "number" ? "number" : "text"}"
        min="${config.min ?? ""}"
        max="${config.max ?? ""}"
        value="${escapeAttribute(item[config.field] ?? "")}"
        placeholder="${config.placeholder ?? ""}"
        data-entity="${entity}"
        data-index="${index}"
        data-field="${config.field}"
      >
    </td>
  `;
}

const SIMPLE_FIELD_LABELS = {
  demand: {
    name: "班名",
    subject: "学科",
    grade: "年级",
    size: "人数",
    courseType: "类型",
    weeklySessions: "每周节数",
    estimatedRevenuePerSession: "预计单节收入",
    preferredTime: "时间偏好",
    fixedTeacher: "指定老师",
    fixedRoom: "指定教室",
    status: "状态",
  },
};

function getSimpleFieldLabel(entity, field) {
  return SIMPLE_FIELD_LABELS[entity]?.[field] || field;
}

function renderSimpleFieldControl(entity, item, index, config) {
  const fieldLabel = getSimpleFieldLabel(entity, config.field);
  const wideClass = config.field === "name" ? " is-wide" : "";
  if (config.type === "select") {
    return `
      <label class="simple-card-field${wideClass}">
        <span class="field-label">${fieldLabel}</span>
        <select class="cell-select" data-entity="${entity}" data-index="${index}" data-field="${config.field}">
          ${config.options
            .map((option) => `<option value="${option}" ${String(item[config.field]) === option ? "selected" : ""}>${formatOption(option)}</option>`)
            .join("")}
        </select>
      </label>
    `;
  }

  if (config.type === "boolean") {
    return `
      <label class="simple-card-field${wideClass}">
        <span class="field-label">${fieldLabel}</span>
        <select class="cell-select" data-entity="${entity}" data-index="${index}" data-field="${config.field}">
          <option value="false" ${item[config.field] ? "" : "selected"}>否</option>
          <option value="true" ${item[config.field] ? "selected" : ""}>是</option>
        </select>
      </label>
    `;
  }

  return `
    <label class="simple-card-field${wideClass}">
      <span class="field-label">${fieldLabel}</span>
      <input
        class="cell-input"
        type="${config.type === "number" ? "number" : "text"}"
        min="${config.min ?? ""}"
        max="${config.max ?? ""}"
        value="${escapeAttribute(item[config.field] ?? "")}"
        placeholder="${config.placeholder ?? ""}"
        data-entity="${entity}"
        data-index="${index}"
        data-field="${config.field}"
      >
    </label>
  `;
}

function addRow(entity) {
  const collection = getCollection(entity);
  if (entity === "teacher") {
    collection.push(createTeacher("", "math", 1, 1, false, false, false, 5, 30, "", "6_on_1_off", "", false));
  } else if (entity === "room") {
    collection.push(createRoom("", "1F", 1, "small_class", false, 30, ""));
  } else if (entity === "financialPeriod") {
    collection.push(createFinancialPeriod("", 0, 0, 0, 0));
  } else {
    collection.push(createDemand("", "math", 1, 1, "small_class", 1, 0, "flexible", "", "", "recruiting"));
  }
  persistState();
  regenerateSchedule();
}

function removeRow(entity, index) {
  const collection = getCollection(entity);
  collection.splice(index, 1);
  persistState();
  regenerateSchedule();
}

function getCollection(entity) {
  if (entity === "teacher") {
    return state.teachers;
  }
  if (entity === "room") {
    return state.rooms;
  }
  if (entity === "summerClassRevenue") {
    return state.summerClassRevenueRows;
  }
  if (entity === "financialPeriod") {
    return state.financialPeriods;
  }
  if (entity === "dividendPolicy") {
    return state.dividendPolicies;
  }
  if (entity === "profitExpenseLine") {
    return state.profitExpenseLines;
  }
  if (entity === "settlementStatement") {
    return state.settlementStatements;
  }
  if (entity === "settlementLine") {
    return state.settlementLines;
  }
  if (entity === "compensationRule") {
    return state.compensationRules;
  }
  if (entity === "compensationRuleItem") {
    return state.compensationRuleItems;
  }
  if (entity === "nonBillableSlot") {
    return state.nonBillableSlots;
  }
  if (entity === "compensationSlotSummary") {
    return state.compensationSlotSummaries;
  }
  if (entity === "settlementReviewResolution") {
    return state.settlementReviewResolutions;
  }
  return state.demands;
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return clone(DEFAULT_STATE);
    }
    const parsed = JSON.parse(raw);
    return {
      teachers: (parsed.teachers || []).map(normalizeTeacher),
      rooms: (parsed.rooms || []).map(normalizeRoom),
      demands: (parsed.demands || []).map(normalizeDemand),
      financialPeriods: (parsed.financialPeriods || DEFAULT_STATE.financialPeriods).map(normalizeFinancialPeriod),
      summerClassRevenueRows: (
        parsed.summerClassRevenueRows ||
        createSummerClassRevenueRowsFromReport(parsed.summerScheduleSettlementReport)
      ).map(normalizeSummerClassRevenueRow),
      dividendPolicies: (parsed.dividendPolicies || DEFAULT_STATE.dividendPolicies).map(
        normalizeDividendPolicy
      ),
      profitExpenseLines: (parsed.profitExpenseLines || []).map(normalizeProfitExpenseLine),
      settlementStatements: (parsed.settlementStatements || []).map(normalizeSettlementStatement),
      settlementLines: (parsed.settlementLines || []).map(normalizeSettlementLine),
      compensationRules: (parsed.compensationRules || []).map(normalizeCompensationRule),
      compensationRuleItems: (parsed.compensationRuleItems || []).map(normalizeCompensationRuleItem),
      nonBillableSlots: (parsed.nonBillableSlots || []).map(normalizeNonBillableSlot),
      compensationSlotSummaries: (parsed.compensationSlotSummaries || []).map(normalizeCompensationSlotSummary),
      settlementReviewResolutions: (parsed.settlementReviewResolutions || []).map(
        normalizeSettlementReviewResolution
      ),
      scheduleSettlementBridge: normalizeBridgeReport(parsed.scheduleSettlementBridge),
      importReconciliation: normalizeReconciliationReport(parsed.importReconciliation),
      settlementReviewQueue: normalizeReviewQueueReport(parsed.settlementReviewQueue),
      settlementReviewFollowupReport: normalizeSettlementReviewFollowupReport(
        parsed.settlementReviewFollowupReport
      ),
      compensationImportReadinessReport:
        normalizeCompensationImportReadinessReport(
          parsed.compensationImportReadinessReport
        ),
      settlementImportWavePackageReport:
        normalizeSettlementImportWavePackageReport(
          parsed.settlementImportWavePackageReport
        ),
      settlementImportDeferredActionReport:
        normalizeSettlementImportDeferredActionReport(
          parsed.settlementImportDeferredActionReport
        ),
      settlementImportExecutionReport: normalizeSettlementImportExecutionReport(
        parsed.settlementImportExecutionReport
      ),
      settlementOpsActionReport: normalizeSettlementOpsActionReport(
        parsed.settlementOpsActionReport
      ),
      profitSettlementDividendReport: normalizeProfitSettlementDividendReport(
        parsed.profitSettlementDividendReport
      ),
      summerBigClassRoomOccupancyReport: normalizeSummerBigClassRoomOccupancyReport(
        parsed.summerBigClassRoomOccupancyReport
      ),
      summerScheduleSettlementReport: normalizeSummerScheduleSettlementReport(
        parsed.summerScheduleSettlementReport
      ),
      scheduleInputProfileReport: normalizeScheduleInputProfileReport(
        parsed.scheduleInputProfileReport
      ),
      scheduleDraftImportReport: normalizeScheduleDraftImportReport(
        parsed.scheduleDraftImportReport
      ),
      scheduleDraftReviewReport: normalizeScheduleDraftReviewReport(
        parsed.scheduleDraftReviewReport
      ),
      scheduleDraftReviewBulkCandidatesReport:
        normalizeScheduleDraftReviewBulkCandidatesReport(
          parsed.scheduleDraftReviewBulkCandidatesReport
        ),
      scheduleDraftReviewBulkApplyReport: normalizeScheduleDraftReviewBulkApplyReport(
        parsed.scheduleDraftReviewBulkApplyReport
      ),
      scheduleDraftManualReviewReport: normalizeScheduleDraftManualReviewReport(
        parsed.scheduleDraftManualReviewReport
      ),
      scheduleDraftManualClassnameBatchCandidatesReport:
        normalizeScheduleDraftManualClassnameBatchCandidatesReport(
          parsed.scheduleDraftManualClassnameBatchCandidatesReport
        ),
      scheduleDraftManualClassnameBatchApplyReport:
        normalizeScheduleDraftManualClassnameBatchApplyReport(
          parsed.scheduleDraftManualClassnameBatchApplyReport
        ),
      scheduleDraftManualClassroomBatchCandidatesReport:
        normalizeScheduleDraftManualClassroomBatchCandidatesReport(
          parsed.scheduleDraftManualClassroomBatchCandidatesReport
        ),
      scheduleDraftManualClassroomBatchApplyReport:
        normalizeScheduleDraftManualClassroomBatchApplyReport(
          parsed.scheduleDraftManualClassroomBatchApplyReport
        ),
      scheduleDraftManualCombinedBatchCandidatesReport:
        normalizeScheduleDraftManualCombinedBatchCandidatesReport(
          parsed.scheduleDraftManualCombinedBatchCandidatesReport
        ),
      scheduleDraftManualCombinedBatchApplyReport:
        normalizeScheduleDraftManualCombinedBatchApplyReport(
          parsed.scheduleDraftManualCombinedBatchApplyReport
        ),
      scheduleDraftManualResidualReport: normalizeScheduleDraftManualResidualReport(
        parsed.scheduleDraftManualResidualReport
      ),
      opsOpenItemsReport: normalizeOpsOpenItemsReport(parsed.opsOpenItemsReport),
      opsChatAnswerSheet: normalizeOpsChatAnswerSheet(parsed.opsChatAnswerSheet),
      opsChatAnswerApplyReport: normalizeOpsChatAnswerApplyReport(
        parsed.opsChatAnswerApplyReport
      ),
      teacherSettlementProfileReport: normalizeTeacherSettlementProfileReport(
        parsed.teacherSettlementProfileReport
      ),
      teacherCompensationPolicyReport: normalizeTeacherCompensationPolicyReport(
        parsed.teacherCompensationPolicyReport
      ),
      teacherRuleItemResolutionTemplate:
        normalizeTeacherRuleItemResolutionTemplate(
          parsed.teacherRuleItemResolutionTemplate
        ),
      teacherRuleBackfillTemplate: normalizeTeacherRuleBackfillTemplate(
        parsed.teacherRuleBackfillTemplate
      ),
    };
  } catch (error) {
    return clone(DEFAULT_STATE);
  }
}

function createEmptyLocalDbStatus(overrides = {}) {
  return {
    available: false,
    lastSavedAt: "",
    dbPath: "",
    backupDir: "",
    releaseDir: "",
    lastError: "",
    baseUrl: "",
    configuredBaseUrl: "",
    connectionMode: "browser",
    healthUrl: "",
    stateUrl: "",
    historyUrl: "",
    restoreUrl: "",
    ...overrides,
  };
}

function isLocalDbWebProtocol() {
  return LOCAL_DB_WEB_PROTOCOLS.has(window.location.protocol);
}

function getSameOriginLocalDbBaseUrl() {
  return isLocalDbWebProtocol() ? window.location.origin : "";
}

function normalizeBackendBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  let candidate = trimmed;
  if (candidate.startsWith("//")) {
    candidate = `${isLocalDbWebProtocol() ? window.location.protocol : "http:"}${candidate}`;
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `http://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    let pathname = parsed.pathname || "";
    pathname = pathname.replace(/\/(?:api(?:\/(?:health|state))?|prototype(?:\/index\.html)?|index\.html)\/?$/i, "");
    pathname = pathname.replace(/\/+$/, "");
    return pathname ? `${parsed.origin}${pathname}` : parsed.origin;
  } catch (error) {
    return "";
  }
}

function getConfiguredBackendBaseUrl() {
  return normalizeBackendBaseUrl(uiState.backendBaseUrl || "");
}

function buildLocalDbApiUrl(baseUrl, path) {
  return `${baseUrl || ""}${path}`;
}

function buildStateScopedLocalDbUrl(baseUrl, path, stateKey = "") {
  const base = baseUrl || "";
  if (!base) {
    return "";
  }
  const url = new URL(`${base}${path}`);
  if (stateKey) {
    url.searchParams.set("state_key", stateKey);
  }
  return url.toString();
}

function formatLocalDbTarget(status = localDbStatus) {
  const baseUrl = status.baseUrl || status.configuredBaseUrl || getConfiguredBackendBaseUrl();
  return baseUrl || "";
}

function parseDateTimeSafe(value) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatHistoryEntryLabel(entry) {
  if (!entry) {
    return "";
  }
  const savedAt = entry.saved_at || entry.savedAt || "";
  const source = String(entry.source || "").trim() || "unknown";
  const note = String(entry.note || "").trim();
  const sha256 = String(entry.sha256 || "").trim();
  const timeLabel = savedAt ? formatDateTime(savedAt) : "未知时间";
  const digestLabel = sha256 ? ` · ${sha256.slice(0, 8)}` : "";
  const noteLabel = note ? ` · ${note}` : "";
  return `#${entry.id} · ${timeLabel} · ${source}${noteLabel}${digestLabel}`;
}

async function fetchLocalDatabaseHistory(options = {}) {
  if (!localDbStatus.available || !localDbStatus.historyUrl) {
    return [];
  }

  try {
    const response = await fetch(localDbStatus.historyUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    localDbStatus.lastError = "";
    return Array.isArray(payload.entries) ? payload.entries : [];
  } catch (error) {
    localDbStatus.lastError = error.message;
    if (!options.silent) {
      uiState.importLog = `读取寒暑假后台历史失败：${error.message}`;
      persistUiState();
      renderSaveStatus();
    }
    return [];
  }
}

async function refreshLocalDatabaseHistory(options = {}) {
  if (!localDbStatus.available) {
    localDbHistoryEntries = [];
    if (!options.silent) {
      renderSaveStatus();
    }
    return [];
  }
  const entries = await fetchLocalDatabaseHistory(options);
  localDbHistoryEntries = entries;
  const preferredHistoryId = String(options.preferredHistoryId || uiState.selectedDbHistoryId || "");
  if (entries.length) {
    const matched = entries.find((entry) => String(entry.id) === preferredHistoryId);
    uiState.selectedDbHistoryId = matched ? String(matched.id) : String(entries[0].id);
  } else {
    uiState.selectedDbHistoryId = "";
  }
  persistUiState();
  if (!options.silent) {
    renderSaveStatus();
  }
  return entries;
}

async function restoreSelectedHistoryVersion() {
  if (!localDbStatus.available || !localDbStatus.restoreUrl) {
    uiState.importLog = "当前没有连接到寒暑假后台，暂时不能恢复历史版本。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  const historyId = Number(uiState.selectedDbHistoryId || 0);
  if (!historyId) {
    uiState.importLog = "请先在寒暑假后台历史里选一个可恢复的版本。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  const selectedEntry = localDbHistoryEntries.find((entry) => Number(entry.id) === historyId);
  const confirmLabel = formatHistoryEntryLabel(selectedEntry) || `#${historyId}`;
  if (!window.confirm(`确定恢复这个寒暑假后台版本吗？\n${confirmLabel}\n\n恢复后，后台当前版本会被替换，但也会再记一条新的恢复记录。`)) {
    return;
  }
  try {
    const response = await fetch(localDbStatus.restoreUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ history_id: historyId }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    localDbStatus.lastSavedAt = payload.saved_at || "";
    localDbStatus.lastError = "";
    applyLocalSnapshot(payload.snapshot || {}, "已从寒暑假后台恢复选中版本。", {
      syncLocalDb: false,
      browserSnapshotOrigin: "backend_database",
    });
    uiState.importLog = `已恢复寒暑假后台版本：${confirmLabel}`;
    persistUiState();
    await refreshLocalDatabaseHistory({ silent: true });
    renderSaveStatus();
  } catch (error) {
    localDbStatus.lastError = error.message;
    uiState.importLog = `恢复寒暑假后台历史失败：${error.message}`;
    persistUiState();
    renderSaveStatus();
  }
}

function parseSnapshotSafe(raw) {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function loadSummerImportReviewItems() {
  try {
    const raw = window.localStorage.getItem(SUMMER_IMPORT_REVIEW_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function persistSummerImportReviewItems(items) {
  window.localStorage.setItem(
    SUMMER_IMPORT_REVIEW_STORAGE_KEY,
    JSON.stringify(Array.isArray(items) ? items : [])
  );
}

async function detectLocalDatabase(options = {}) {
  const configuredBaseUrl = normalizeBackendBaseUrl(options.baseUrl ?? getConfiguredBackendBaseUrl());
  const sameOriginBaseUrl = getSameOriginLocalDbBaseUrl();
  const candidates = [];
  if (configuredBaseUrl) {
    candidates.push({ baseUrl: configuredBaseUrl, connectionMode: "configured" });
  }
  if (!options.configuredOnly && sameOriginBaseUrl && sameOriginBaseUrl !== configuredBaseUrl) {
    candidates.push({ baseUrl: sameOriginBaseUrl, connectionMode: "same_origin" });
  }

  let lastError = "";
  for (const candidate of candidates) {
    try {
      const response = await fetch(buildLocalDbApiUrl(candidate.baseUrl, LOCAL_DB_HEALTH_PATH), {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const stateUrl = buildLocalDbApiUrl(candidate.baseUrl, LOCAL_DB_STATE_PATH);
      const stateResponse = await fetch(stateUrl, { cache: "no-store" });
      if (!stateResponse.ok) {
        throw new Error(`后台状态不可读 HTTP ${stateResponse.status}`);
      }
      const statePayload = await stateResponse.json();
      if (!statePayload || typeof statePayload !== "object") {
        throw new Error("后台状态接口返回异常");
      }
      return createEmptyLocalDbStatus({
        available: true,
        dbPath: payload.db_path || "",
        backupDir: payload.backup_dir || "",
        releaseDir: payload.release_dir || "",
        baseUrl: candidate.baseUrl,
        configuredBaseUrl,
        connectionMode: candidate.connectionMode,
        healthUrl: buildLocalDbApiUrl(candidate.baseUrl, LOCAL_DB_HEALTH_PATH),
        stateUrl,
        historyUrl: buildStateScopedLocalDbUrl(candidate.baseUrl, LOCAL_DB_HISTORY_PATH),
        restoreUrl: buildStateScopedLocalDbUrl(candidate.baseUrl, LOCAL_DB_RESTORE_PATH),
      });
    } catch (error) {
      lastError = error?.message || String(error);
    }
  }

  return createEmptyLocalDbStatus({
    baseUrl: configuredBaseUrl,
    configuredBaseUrl,
    connectionMode: configuredBaseUrl ? "configured" : "browser",
    lastError: configuredBaseUrl ? lastError : "",
  });
}

async function syncLocalDatabaseSnapshot() {
  const forceFresh = shouldForceBundledSnapshot();
  const browserRawState = window.localStorage.getItem(STORAGE_KEY);
  const browserSnapshot = parseSnapshotSafe(browserRawState);
  const browserSavedAt = uiState.lastSavedAt || "";
  const browserSnapshotOrigin = uiState.browserSnapshotOrigin || "";

  if (forceFresh) {
    await loadBundledSnapshotIfNeeded();
    await saveStateToLocalDatabase({
      note: "fresh_query_reload",
      source: "browser_fresh_reload",
      silent: true,
    });
    updatePersistenceControls();
    renderSaveStatus();
    return;
  }

  const databaseState = await fetchLocalDatabaseState({ silent: true });
  const databaseSavedAt = databaseState?.savedAt || "";
  const shouldPromoteBrowserState =
    browserSnapshot &&
    (!databaseState?.snapshot ||
      (!LOCAL_DB_NON_PROMOTABLE_BROWSER_SNAPSHOT_ORIGINS.has(browserSnapshotOrigin) &&
        (!browserSavedAt || parseDateTimeSafe(browserSavedAt) >= parseDateTimeSafe(databaseSavedAt))));

  if (shouldPromoteBrowserState) {
    const migrated = await saveSnapshotToLocalDatabase(browserSnapshot, {
      note: databaseState?.snapshot ? "browser_state_newer_than_db" : "browser_state_initial_migration",
      source: databaseState?.snapshot ? "browser_migration_newer" : "browser_migration_initial",
      silent: true,
    });
    if (migrated) {
      uiState.importLog = databaseState?.snapshot
        ? "已把当前浏览器里较新的寒暑假数据同步到后台数据库。"
        : "已把当前浏览器里的寒暑假数据迁入后台数据库。";
      persistUiState();
    }
    renderSaveStatus();
    return;
  }

  if (databaseState?.snapshot) {
    applyLocalSnapshot(databaseState.snapshot, "已从寒暑假后台载入数据。", {
      syncLocalDb: false,
      skipRegenerate: true,
      browserSnapshotOrigin: "backend_database",
    });
    renderSaveStatus();
    return;
  }

  await loadBundledSnapshotIfNeeded();
  await saveStateToLocalDatabase({
    note: "seed_from_bundled_snapshot",
    source: "browser_seed_snapshot",
    silent: true,
  });
  renderSaveStatus();
}

async function initializePersistence() {
  localDbStatus = await detectLocalDatabase();
  updatePersistenceControls();

  if (!localDbStatus.available) {
    localDbHistoryEntries = [];
    uiState.importLog =
      "当前没有连通寒暑假后台。只有连接到主控电脑后台后，才允许查看和编辑正式排课内容。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  await syncLocalDatabaseSnapshot();
  await refreshLocalDatabaseHistory({ silent: true });
}

function setBackendBaseUrlInputValue(value) {
  const input = document.getElementById("backendBaseUrlInput");
  if (input) {
    input.value = value || "";
  }
}

async function connectConfiguredBackend() {
  const input = document.getElementById("backendBaseUrlInput");
  const normalizedBaseUrl = normalizeBackendBaseUrl(input?.value || "");
  if (!normalizedBaseUrl) {
    uiState.importLog = "请输入可用的寒暑假后台地址，例如 http://192.168.1.20:8000。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  uiState.backendBaseUrl = normalizedBaseUrl;
  persistUiState();
  setBackendBaseUrlInputValue(normalizedBaseUrl);

  localDbStatus = await detectLocalDatabase({
    baseUrl: normalizedBaseUrl,
    configuredOnly: true,
  });
  updatePersistenceControls();
  if (!localDbStatus.available) {
    uiState.importLog = `连接寒暑假后台失败：${normalizedBaseUrl}；${localDbStatus.lastError || "未能连通"}`;
    persistUiState();
    renderSaveStatus();
    return;
  }

  await syncLocalDatabaseSnapshot();
  await refreshLocalDatabaseHistory({ silent: true });
  regenerateSchedule();
}

async function clearConfiguredBackend() {
  uiState.backendBaseUrl = "";
  persistUiState();
  setBackendBaseUrlInputValue("");
  await initializePersistence();
  regenerateSchedule();
}

function shouldForceBundledSnapshot() {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("fresh");
    return value !== null && value !== "0" && value !== "false";
  } catch (error) {
    return false;
  }
}

async function loadBundledSnapshotIfNeeded() {
  const forceFresh = shouldForceBundledSnapshot();
  const hasSavedState = Boolean(window.localStorage.getItem(STORAGE_KEY));
  if (hasSavedState && !forceFresh) {
    return;
  }

  try {
    const snapshotPath = forceFresh
      ? `${BUNDLED_SNAPSHOT_PATH}?v=${Date.now()}`
      : BUNDLED_SNAPSHOT_PATH;
    const response = await fetch(snapshotPath, { cache: forceFresh ? "no-store" : "default" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const parsed = await response.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("快照格式不是对象");
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    state = loadState();
    persistState(forceFresh ? "已重新载入发布版内置数据。" : "已自动载入发布版内置数据。", {
      browserSnapshotOrigin: "bundled_snapshot",
    });
  } catch (error) {
    if (!hasSavedState) {
      uiState.importLog = `发布版内置数据载入失败：${error.message}`;
      persistUiState();
    }
  }
}

function updatePersistenceControls() {
  const saveButton = document.getElementById("saveButton");
  const loadDbButton = document.getElementById("loadDbButton");
  const historySelect = document.getElementById("dbHistorySelect");
  const refreshHistoryButton = document.getElementById("refreshDbHistoryButton");
  const restoreHistoryButton = document.getElementById("restoreDbHistoryButton");
  if (saveButton) {
    saveButton.textContent = "保存到寒暑假后台";
  }
  if (loadDbButton) {
    loadDbButton.textContent = "从寒暑假后台读取";
    loadDbButton.hidden = !localDbStatus.available;
    loadDbButton.disabled = !localDbStatus.available;
  }
  if (historySelect) {
    historySelect.disabled = !localDbStatus.available;
  }
  if (refreshHistoryButton) {
    refreshHistoryButton.disabled = !localDbStatus.available;
  }
  if (restoreHistoryButton) {
    restoreHistoryButton.disabled = !localDbStatus.available;
  }
}

async function fetchLocalDatabaseState(options = {}) {
  if (!localDbStatus.available) {
    return null;
  }

  try {
    const response = await fetch(localDbStatus.stateUrl || buildLocalDbApiUrl(localDbStatus.baseUrl, LOCAL_DB_STATE_PATH), {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    localDbStatus.lastSavedAt = payload.saved_at || "";
    localDbStatus.lastError = "";
    return {
      snapshot: payload.snapshot || null,
      savedAt: payload.saved_at || "",
      source: payload.source || "",
      note: payload.note || "",
      sha256: payload.sha256 || "",
    };
  } catch (error) {
    localDbStatus.lastError = error.message;
    if (!options.silent) {
      uiState.importLog = `读取寒暑假后台失败：${error.message}`;
      persistUiState();
      renderSaveStatus();
    }
    return null;
  }
}

async function saveSnapshotToLocalDatabase(snapshot, options = {}) {
  if (!localDbStatus.available) {
    return null;
  }

  try {
    const response = await fetch(localDbStatus.stateUrl || buildLocalDbApiUrl(localDbStatus.baseUrl, LOCAL_DB_STATE_PATH), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snapshot,
        note: options.note || "",
        source: options.source || "browser_manual",
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    localDbStatus.lastSavedAt = payload.saved_at || "";
    localDbStatus.lastError = "";
    if (!options.silent) {
      await refreshLocalDatabaseHistory({ silent: true });
      renderSaveStatus();
    }
    return payload;
  } catch (error) {
    localDbStatus.lastError = error.message;
    localDbStatus.available = false;
    if (!options.silent) {
      uiState.importLog = `保存到寒暑假后台失败：${error.message}`;
      persistUiState();
      renderSaveStatus();
      renderAccessGate();
    }
    return null;
  }
}

async function saveStateToLocalDatabase(options = {}) {
  return saveSnapshotToLocalDatabase(clone(state), options);
}

function scheduleLocalDatabaseSave(note = "") {
  if (!localDbStatus.available) {
    return;
  }
  localDbAutosaveNote = note || localDbAutosaveNote || "autosave";
  if (localDbAutosaveTimer) {
    window.clearTimeout(localDbAutosaveTimer);
  }
  localDbAutosaveTimer = window.setTimeout(async () => {
    const queuedNote = localDbAutosaveNote || "autosave";
    localDbAutosaveTimer = null;
    localDbAutosaveNote = "";
    await saveStateToLocalDatabase({
      note: queuedNote,
      source: "browser_autosave",
      silent: true,
    });
    renderSaveStatus();
  }, LOCAL_DB_AUTOSAVE_DELAY_MS);
}

function applyLocalSnapshot(snapshot, message, options = {}) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  state = loadState();
  persistState(message, {
    ...options,
    browserSnapshotOrigin: options.browserSnapshotOrigin || "backend_database",
  });
  if (!options.skipRegenerate) {
    regenerateSchedule();
  }
}

async function loadStateFromLocalDatabase() {
  if (!localDbStatus.available) {
    uiState.importLog = "当前没有连接到寒暑假后台。请先填写后台地址，或直接打开局域网寒暑假系统页面。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  const payload = await fetchLocalDatabaseState();
  if (!payload || !payload.snapshot) {
    uiState.importLog = "寒暑假后台里还没有可读取的数据。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  applyLocalSnapshot(payload.snapshot, "已从寒暑假后台读取当前数据。", {
    syncLocalDb: false,
  });
  renderSaveStatus();
}

function persistState(message, options = {}) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  uiState.lastSavedAt = new Date().toISOString();
  uiState.browserSnapshotOrigin = options.browserSnapshotOrigin || "browser";
  if (message) {
    uiState.importLog = message;
  }
  persistUiState();
  if (options.syncLocalDb !== false) {
    scheduleLocalDatabaseSave(options.localDbNote || message || "autosave");
  }
}

function loadUiState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_META_KEY);
    if (!raw) {
      const defaults = {
        lastSavedAt: null,
        browserSnapshotOrigin: "",
        backendBaseUrl: "",
        importLog: "还没有导入记录。",
        selectedDbHistoryId: "",
        scheduleView: "board",
        roomViewDay: "all",
        scheduleProjectionPeriod: "",
        scheduleReviewDeskPeriod: "",
        financialPeriodView: "",
        settlementPeriod: "",
        settlementTeacher: "",
      };
      if (isSimpleMode()) {
        defaults.scheduleView = "board";
        defaults.roomViewDay = "all";
      }
      return defaults;
    }
    const parsed = JSON.parse(raw);
    const nextState = {
      lastSavedAt: parsed.lastSavedAt || null,
      browserSnapshotOrigin: parsed.browserSnapshotOrigin || "",
      backendBaseUrl: parsed.backendBaseUrl || "",
      importLog: parsed.importLog || "还没有导入记录。",
      selectedDbHistoryId: parsed.selectedDbHistoryId || "",
      scheduleView: parsed.scheduleView || "board",
      roomViewDay: parsed.roomViewDay || "all",
      scheduleProjectionPeriod: parsed.scheduleProjectionPeriod || "",
      scheduleReviewDeskPeriod: parsed.scheduleReviewDeskPeriod || "",
      financialPeriodView: parsed.financialPeriodView || "",
      settlementPeriod: parsed.settlementPeriod || "",
      settlementTeacher: parsed.settlementTeacher || "",
    };
    if (isSimpleMode()) {
      nextState.scheduleView = "board";
      nextState.roomViewDay = "all";
    }
    return nextState;
  } catch (error) {
    const fallbackState = {
      lastSavedAt: null,
      browserSnapshotOrigin: "",
      backendBaseUrl: "",
      importLog: "还没有导入记录。",
      selectedDbHistoryId: "",
      scheduleView: "board",
      roomViewDay: "all",
      scheduleProjectionPeriod: "",
      scheduleReviewDeskPeriod: "",
      financialPeriodView: "",
      settlementPeriod: "",
      settlementTeacher: "",
    };
    if (isSimpleMode()) {
      fallbackState.scheduleView = "board";
      fallbackState.roomViewDay = "all";
    }
    return fallbackState;
  }
}

function persistUiState() {
  window.localStorage.setItem(STORAGE_META_KEY, JSON.stringify(uiState));
}

function getBackendConnectionText() {
  const configuredBaseUrl = getConfiguredBackendBaseUrl();
  if (localDbStatus.available) {
    return localDbStatus.connectionMode === "same_origin"
      ? `已连接系统后台（暑假模式）：${formatLocalDbTarget()}`
      : `已连接寒暑假后台：${formatLocalDbTarget()}`;
  }
  if (isCloudTransitionMode()) {
    return "云端过渡模式：当前先使用老师熟悉的暑假排课界面，数据保存在当前浏览器；正式多人同步会逐步接入云数据库。";
  }
  if (configuredBaseUrl) {
    return `已配置系统后台（暑假模式）：${configuredBaseUrl}。当前未连通，请确认后台服务已启动，且两台电脑在同一网络。`;
  }
  return "当前未连接系统后台（暑假模式）。老师在自己电脑打开页面时，可在这里填写后台地址，例如 http://192.168.1.20:8000。";
}

function isCloudTransitionMode() {
  return window.location.hostname.endsWith("github.io") || window.location.pathname.includes("/paike-legacy/");
}

function renderAccessGate() {
  const gateNode = document.getElementById("accessGate");
  const shellNode = document.querySelector(".page-shell");
  if (!gateNode || !shellNode) {
    return;
  }
  document.documentElement.classList.remove("access-check-pending");
  const blocked = !localDbStatus.available && !isCloudTransitionMode();
  gateNode.hidden = !blocked;
  shellNode.hidden = blocked;
  if (!blocked) {
    gateNode.innerHTML = "";
    return;
  }
  const details = [];
  if (getConfiguredBackendBaseUrl()) {
    details.push(`已配置后台地址：${getConfiguredBackendBaseUrl()}`);
  } else if (isLocalDbWebProtocol()) {
    details.push(`当前打开地址：${window.location.origin}`);
  } else {
    details.push("当前不是通过局域网页面打开。");
  }
  if (localDbStatus.lastError) {
    details.push(`连接失败：${localDbStatus.lastError}`);
  }
  gateNode.innerHTML = `
    <div class="access-gate-card">
      <p class="eyebrow">Backend Required</p>
      <h1 class="access-gate-title">当前无法使用寒暑假排课系统</h1>
      <p class="access-gate-text">
        这台电脑现在不在同一局域网，或无法正常读写寒暑假后台数据，所以已禁止录入。
      </p>
      <ol class="access-gate-list">
        <li>请确认这台电脑和主控电脑在同一个局域网。</li>
        <li>请使用主控电脑发出的局域网链接打开，不要使用本地拷贝页面。</li>
        <li>请确认主控电脑上的排课服务窗口仍在运行。</li>
      </ol>
      <div class="access-gate-detail">${escapeHtml(details.join("\n") || "未检测到可用的寒暑假后台连接。")}</div>
    </div>
  `;
}

function renderHistoryControls() {
  const historySelect = document.getElementById("dbHistorySelect");
  const refreshHistoryButton = document.getElementById("refreshDbHistoryButton");
  const restoreHistoryButton = document.getElementById("restoreDbHistoryButton");
  const historyHint = document.getElementById("dbHistoryHint");
  if (!historySelect || !refreshHistoryButton || !restoreHistoryButton || !historyHint) {
    return;
  }

  if (!localDbStatus.available) {
    historySelect.innerHTML = '<option value="">当前未连接寒暑假后台</option>';
    historySelect.disabled = true;
    refreshHistoryButton.disabled = true;
    restoreHistoryButton.disabled = true;
    historyHint.textContent = "连接寒暑假后台后，这里会显示最近保存记录；恢复后也会再记一条恢复记录。";
    return;
  }

  if (!localDbHistoryEntries.length) {
    historySelect.innerHTML = '<option value="">寒暑假后台里还没有历史记录</option>';
    historySelect.disabled = true;
    refreshHistoryButton.disabled = false;
    restoreHistoryButton.disabled = true;
    historyHint.textContent = localDbStatus.backupDir
      ? `后台磁盘备份目录：${localDbStatus.backupDir}`
      : "寒暑假后台里还没有历史记录。";
    return;
  }

  historySelect.innerHTML = localDbHistoryEntries
    .map(
      (entry) =>
        `<option value="${escapeHtml(String(entry.id))}">${escapeHtml(formatHistoryEntryLabel(entry))}</option>`
    )
    .join("");
  historySelect.disabled = false;
  refreshHistoryButton.disabled = false;
  restoreHistoryButton.disabled = false;
  historySelect.value = uiState.selectedDbHistoryId || String(localDbHistoryEntries[0].id);
  historyHint.textContent = localDbStatus.backupDir
    ? `最近同步历史 ${localDbHistoryEntries.length} 条；后台磁盘备份目录：${localDbStatus.backupDir}`
    : `最近同步历史 ${localDbHistoryEntries.length} 条；恢复后也会再记一条新的恢复记录。`;
}

function renderSaveStatus() {
  const statusNode = document.getElementById("saveStatusText");
  const backendConnectionNode = document.getElementById("backendConnectionText");
  const importLogNode = document.getElementById("importLog");
  const topBackendNode = document.getElementById("topBackendStatus");
  const topSaveNode = document.getElementById("topSaveStatus");
  if (!statusNode || !importLogNode) {
    return;
  }
  const browserSavedAt = uiState.lastSavedAt ? formatDateTime(uiState.lastSavedAt) : "尚未保存";
  if (topBackendNode) {
    topBackendNode.textContent = localDbStatus.available ? "后台已连接 | 暑假模式" : "后台未连接";
  }
  if (topSaveNode) {
    topSaveNode.textContent = `最近保存：${browserSavedAt}`;
  }
  if (backendConnectionNode) {
    backendConnectionNode.textContent = getBackendConnectionText();
  }
  if (localDbStatus.available) {
    const databaseSavedAt = localDbStatus.lastSavedAt
      ? formatDateTime(localDbStatus.lastSavedAt)
      : "尚未写入";
    const historySuffix = localDbHistoryEntries.length ? `；最近保留历史 ${localDbHistoryEntries.length} 条` : "";
    const errorSuffix = localDbStatus.lastError ? `；最近一次后台同步失败：${localDbStatus.lastError}` : "";
    statusNode.textContent = `当前数据会先保存在当前浏览器，并同步写入寒暑假后台（${formatLocalDbTarget()}）。浏览器最近保存：${browserSavedAt}；后台最近写入：${databaseSavedAt}${historySuffix}${errorSuffix}`;
  } else if (isCloudTransitionMode()) {
    statusNode.textContent = `云端过渡模式：当前未连接局域网后台，数据会先保存在当前浏览器。浏览器最近保存：${browserSavedAt}。`;
  } else if (getConfiguredBackendBaseUrl()) {
    const errorSuffix = localDbStatus.lastError ? `；连接失败：${localDbStatus.lastError}` : "";
    statusNode.textContent = `当前未连通寒暑假后台，系统已锁定，不能继续使用。已配置后台地址：${getConfiguredBackendBaseUrl()}${errorSuffix}`;
  } else {
    statusNode.textContent = "当前未连通寒暑假后台，系统已锁定，不能继续使用。";
  }
  renderHistoryControls();
  importLogNode.textContent = uiState.importLog || "还没有导入记录。";
  renderAccessGate();
}

async function importCsvFile() {
  const fileInput = document.getElementById("csvFileInput");
  const entity = document.getElementById("importEntity").value;
  const mode = document.getElementById("importMode").value;
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    uiState.importLog = "请选择一个 CSV 文件后再导入。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  const extension = getFileExtension(file.name);
  if (extension === "xlsx" || extension === "xls") {
    uiState.importLog = `已识别 ${file.name} 为 Excel 文件。当前浏览器直开版请先在 Excel 中另存为 CSV UTF-8，再重新导入。`;
    persistUiState();
    renderSaveStatus();
    return;
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (!rows.length) {
    uiState.importLog = "CSV 没有可识别的数据行。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  const schema = CSV_SCHEMAS[entity];
  const imported = rows.map((row) => schema.fromRow(row)).filter((item) => hasMeaningfulContent(item, entity));
  if (!imported.length) {
    uiState.importLog = "CSV 表头可以识别，但没有导入到有效数据。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  applyEntityImport(entity, imported, mode);
  persistState(`已导入 ${file.name}，对象：${formatEntityLabel(entity)}，数量：${imported.length}，模式：${mode === "replace" ? "替换" : "追加"}。`);
  fileInput.value = "";
  regenerateSchedule();
}

async function importBatchCsvFiles() {
  const fileInput = document.getElementById("batchCsvFileInput");
  const mode = document.getElementById("importMode").value;
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    uiState.importLog = "请先选择一组标准 CSV 文件再批量导入。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  const updates = new Map();
  const importedLogs = [];
  const skippedLogs = [];

  for (const file of files) {
    const extension = getFileExtension(file.name);
    if (extension !== "csv") {
      skippedLogs.push(`${file.name}：不是 CSV，已跳过。`);
      continue;
    }

    const entity = resolveEntityFromFilename(file.name);
    if (!entity) {
      skippedLogs.push(`${file.name}：不是当前原型可识别的标准文件名，已跳过。`);
      continue;
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      skippedLogs.push(`${file.name}：没有可识别的数据行，已跳过。`);
      continue;
    }

    const schema = CSV_SCHEMAS[entity];
    const imported = rows.map((row) => schema.fromRow(row)).filter((item) => hasMeaningfulContent(item, entity));
    if (!imported.length) {
      skippedLogs.push(`${file.name}：表头已识别，但没有有效数据。`);
      continue;
    }

    const existing = updates.get(entity) || [];
    updates.set(entity, [...existing, ...imported]);
    importedLogs.push(`${file.name} → ${formatEntityLabel(entity)} ${imported.length} 条`);
  }

  if (!updates.size) {
    uiState.importLog = skippedLogs.length
      ? `批量导入没有写入任何数据。\n${skippedLogs.join("\n")}`
      : "批量导入没有写入任何数据。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  for (const [entity, imported] of updates.entries()) {
    applyEntityImport(entity, imported, mode);
  }

  const messageLines = [
    `已批量导入 ${files.length} 个文件，模式：${mode === "replace" ? "替换" : "追加"}。`,
    ...importedLogs,
  ];
  if (skippedLogs.length) {
    messageLines.push("跳过：");
    messageLines.push(...skippedLogs);
  }

  persistState(messageLines.join("\n"));
  fileInput.value = "";
  regenerateSchedule();
}

async function importSnapshotFile() {
  const fileInput = document.getElementById("snapshotFileInput");
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    uiState.importLog = "请选择一个寒暑假系统 JSON 快照后再导入。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    const currentState = state;
    state = {
      teachers: Array.isArray(parsed.teachers)
        ? parsed.teachers.map(normalizeTeacher)
        : currentState.teachers,
      rooms: Array.isArray(parsed.rooms)
        ? parsed.rooms.map(normalizeRoom)
        : currentState.rooms,
      demands: Array.isArray(parsed.demands)
        ? parsed.demands.map(normalizeDemand)
        : currentState.demands,
      financialPeriods: Array.isArray(parsed.financialPeriods)
        ? parsed.financialPeriods.map(normalizeFinancialPeriod)
        : currentState.financialPeriods,
      summerClassRevenueRows: Array.isArray(parsed.summerClassRevenueRows)
        ? parsed.summerClassRevenueRows.map(normalizeSummerClassRevenueRow)
        : currentState.summerClassRevenueRows.length
          ? currentState.summerClassRevenueRows
          : createSummerClassRevenueRowsFromReport(
              parsed.summerScheduleSettlementReport || currentState.summerScheduleSettlementReport
            ),
      dividendPolicies: Array.isArray(parsed.dividendPolicies)
        ? parsed.dividendPolicies.map(normalizeDividendPolicy)
        : currentState.dividendPolicies,
      profitExpenseLines: Array.isArray(parsed.profitExpenseLines)
        ? parsed.profitExpenseLines.map(normalizeProfitExpenseLine)
        : currentState.profitExpenseLines,
      settlementStatements: Array.isArray(parsed.settlementStatements)
        ? parsed.settlementStatements.map(normalizeSettlementStatement)
        : currentState.settlementStatements,
      settlementLines: Array.isArray(parsed.settlementLines)
        ? parsed.settlementLines.map(normalizeSettlementLine)
        : currentState.settlementLines,
      compensationRules: Array.isArray(parsed.compensationRules)
        ? parsed.compensationRules.map(normalizeCompensationRule)
        : currentState.compensationRules,
      compensationRuleItems: Array.isArray(parsed.compensationRuleItems)
        ? parsed.compensationRuleItems.map(normalizeCompensationRuleItem)
        : currentState.compensationRuleItems,
      nonBillableSlots: Array.isArray(parsed.nonBillableSlots)
        ? parsed.nonBillableSlots.map(normalizeNonBillableSlot)
        : currentState.nonBillableSlots,
      compensationSlotSummaries: Array.isArray(parsed.compensationSlotSummaries)
        ? parsed.compensationSlotSummaries.map(normalizeCompensationSlotSummary)
        : currentState.compensationSlotSummaries,
      settlementReviewResolutions: Array.isArray(parsed.settlementReviewResolutions)
        ? parsed.settlementReviewResolutions.map(normalizeSettlementReviewResolution)
        : currentState.settlementReviewResolutions,
      scheduleSettlementBridge: parsed.scheduleSettlementBridge
        ? normalizeBridgeReport(parsed.scheduleSettlementBridge)
        : currentState.scheduleSettlementBridge,
      importReconciliation: parsed.importReconciliation
        ? normalizeReconciliationReport(parsed.importReconciliation)
        : currentState.importReconciliation,
      settlementReviewQueue: parsed.settlementReviewQueue
        ? normalizeReviewQueueReport(parsed.settlementReviewQueue)
        : currentState.settlementReviewQueue,
      settlementReviewFollowupReport: parsed.settlementReviewFollowupReport
        ? normalizeSettlementReviewFollowupReport(parsed.settlementReviewFollowupReport)
        : currentState.settlementReviewFollowupReport,
      compensationImportReadinessReport: parsed.compensationImportReadinessReport
        ? normalizeCompensationImportReadinessReport(
            parsed.compensationImportReadinessReport
          )
        : currentState.compensationImportReadinessReport,
      settlementImportWavePackageReport: parsed.settlementImportWavePackageReport
        ? normalizeSettlementImportWavePackageReport(
            parsed.settlementImportWavePackageReport
          )
        : currentState.settlementImportWavePackageReport,
      settlementImportDeferredActionReport:
        parsed.settlementImportDeferredActionReport
          ? normalizeSettlementImportDeferredActionReport(
              parsed.settlementImportDeferredActionReport
            )
          : currentState.settlementImportDeferredActionReport,
      settlementImportExecutionReport: parsed.settlementImportExecutionReport
        ? normalizeSettlementImportExecutionReport(
            parsed.settlementImportExecutionReport
          )
        : currentState.settlementImportExecutionReport,
      settlementOpsActionReport: parsed.settlementOpsActionReport
        ? normalizeSettlementOpsActionReport(parsed.settlementOpsActionReport)
        : currentState.settlementOpsActionReport,
      profitSettlementDividendReport: parsed.profitSettlementDividendReport
        ? normalizeProfitSettlementDividendReport(parsed.profitSettlementDividendReport)
        : currentState.profitSettlementDividendReport,
      summerBigClassRoomOccupancyReport: parsed.summerBigClassRoomOccupancyReport
        ? normalizeSummerBigClassRoomOccupancyReport(parsed.summerBigClassRoomOccupancyReport)
        : currentState.summerBigClassRoomOccupancyReport,
      summerScheduleSettlementReport: parsed.summerScheduleSettlementReport
        ? normalizeSummerScheduleSettlementReport(parsed.summerScheduleSettlementReport)
        : currentState.summerScheduleSettlementReport,
      scheduleInputProfileReport: parsed.scheduleInputProfileReport
        ? normalizeScheduleInputProfileReport(parsed.scheduleInputProfileReport)
        : currentState.scheduleInputProfileReport,
      scheduleDraftImportReport: parsed.scheduleDraftImportReport
        ? normalizeScheduleDraftImportReport(parsed.scheduleDraftImportReport)
        : currentState.scheduleDraftImportReport,
      scheduleDraftReviewReport: parsed.scheduleDraftReviewReport
        ? normalizeScheduleDraftReviewReport(parsed.scheduleDraftReviewReport)
        : currentState.scheduleDraftReviewReport,
      scheduleDraftReviewBulkCandidatesReport:
        parsed.scheduleDraftReviewBulkCandidatesReport
          ? normalizeScheduleDraftReviewBulkCandidatesReport(
              parsed.scheduleDraftReviewBulkCandidatesReport
            )
          : currentState.scheduleDraftReviewBulkCandidatesReport,
      scheduleDraftReviewBulkApplyReport: parsed.scheduleDraftReviewBulkApplyReport
        ? normalizeScheduleDraftReviewBulkApplyReport(
            parsed.scheduleDraftReviewBulkApplyReport
          )
        : currentState.scheduleDraftReviewBulkApplyReport,
      scheduleDraftManualReviewReport: parsed.scheduleDraftManualReviewReport
        ? normalizeScheduleDraftManualReviewReport(parsed.scheduleDraftManualReviewReport)
        : currentState.scheduleDraftManualReviewReport,
      scheduleDraftManualClassnameBatchCandidatesReport:
        parsed.scheduleDraftManualClassnameBatchCandidatesReport
          ? normalizeScheduleDraftManualClassnameBatchCandidatesReport(
              parsed.scheduleDraftManualClassnameBatchCandidatesReport
            )
          : currentState.scheduleDraftManualClassnameBatchCandidatesReport,
      scheduleDraftManualClassnameBatchApplyReport:
        parsed.scheduleDraftManualClassnameBatchApplyReport
          ? normalizeScheduleDraftManualClassnameBatchApplyReport(
              parsed.scheduleDraftManualClassnameBatchApplyReport
            )
          : currentState.scheduleDraftManualClassnameBatchApplyReport,
      scheduleDraftManualClassroomBatchCandidatesReport:
        parsed.scheduleDraftManualClassroomBatchCandidatesReport
          ? normalizeScheduleDraftManualClassroomBatchCandidatesReport(
              parsed.scheduleDraftManualClassroomBatchCandidatesReport
            )
          : currentState.scheduleDraftManualClassroomBatchCandidatesReport,
      scheduleDraftManualClassroomBatchApplyReport:
        parsed.scheduleDraftManualClassroomBatchApplyReport
          ? normalizeScheduleDraftManualClassroomBatchApplyReport(
              parsed.scheduleDraftManualClassroomBatchApplyReport
            )
          : currentState.scheduleDraftManualClassroomBatchApplyReport,
      scheduleDraftManualCombinedBatchCandidatesReport:
        parsed.scheduleDraftManualCombinedBatchCandidatesReport
          ? normalizeScheduleDraftManualCombinedBatchCandidatesReport(
              parsed.scheduleDraftManualCombinedBatchCandidatesReport
            )
          : currentState.scheduleDraftManualCombinedBatchCandidatesReport,
      scheduleDraftManualCombinedBatchApplyReport:
        parsed.scheduleDraftManualCombinedBatchApplyReport
          ? normalizeScheduleDraftManualCombinedBatchApplyReport(
              parsed.scheduleDraftManualCombinedBatchApplyReport
            )
          : currentState.scheduleDraftManualCombinedBatchApplyReport,
      scheduleDraftManualResidualReport: parsed.scheduleDraftManualResidualReport
        ? normalizeScheduleDraftManualResidualReport(
            parsed.scheduleDraftManualResidualReport
          )
        : currentState.scheduleDraftManualResidualReport,
      opsOpenItemsReport: parsed.opsOpenItemsReport
        ? normalizeOpsOpenItemsReport(parsed.opsOpenItemsReport)
        : currentState.opsOpenItemsReport,
      opsChatAnswerSheet: parsed.opsChatAnswerSheet
        ? normalizeOpsChatAnswerSheet(parsed.opsChatAnswerSheet)
        : currentState.opsChatAnswerSheet,
      opsChatAnswerApplyReport: parsed.opsChatAnswerApplyReport
        ? normalizeOpsChatAnswerApplyReport(parsed.opsChatAnswerApplyReport)
        : currentState.opsChatAnswerApplyReport,
      teacherSettlementProfileReport: parsed.teacherSettlementProfileReport
        ? normalizeTeacherSettlementProfileReport(parsed.teacherSettlementProfileReport)
        : currentState.teacherSettlementProfileReport,
      teacherCompensationPolicyReport: parsed.teacherCompensationPolicyReport
        ? normalizeTeacherCompensationPolicyReport(parsed.teacherCompensationPolicyReport)
        : currentState.teacherCompensationPolicyReport,
      teacherRuleItemResolutionTemplate: parsed.teacherRuleItemResolutionTemplate
        ? normalizeTeacherRuleItemResolutionTemplate(
            parsed.teacherRuleItemResolutionTemplate
          )
        : currentState.teacherRuleItemResolutionTemplate,
      teacherRuleBackfillTemplate: parsed.teacherRuleBackfillTemplate
        ? normalizeTeacherRuleBackfillTemplate(parsed.teacherRuleBackfillTemplate)
        : currentState.teacherRuleBackfillTemplate,
    };
    persistState(`已导入寒暑假系统快照：${file.name}。`);
    fileInput.value = "";
    regenerateSchedule();
  } catch (error) {
    uiState.importLog = `寒暑假系统快照导入失败：${error.message}`;
    persistUiState();
    renderSaveStatus();
  }
}

async function importDiagnosticJsonFiles() {
  const fileInput = document.getElementById("diagnosticJsonFileInput");
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    uiState.importLog = "请选择一个或多个诊断 JSON 后再导入。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  let nextBridge = state.scheduleSettlementBridge;
  let nextReconciliation = state.importReconciliation;
  let nextReviewQueue = state.settlementReviewQueue;
  let nextSettlementReviewFollowupReport = state.settlementReviewFollowupReport;
  let nextCompensationImportReadinessReport = state.compensationImportReadinessReport;
  let nextSettlementImportWavePackageReport =
    state.settlementImportWavePackageReport;
  let nextSettlementImportDeferredActionReport =
    state.settlementImportDeferredActionReport;
  let nextSettlementImportExecutionReport = state.settlementImportExecutionReport;
  let nextSettlementOpsActionReport = state.settlementOpsActionReport;
  let nextProfitSettlementDividendReport = state.profitSettlementDividendReport;
  let nextSummerBigClassRoomOccupancyReport = state.summerBigClassRoomOccupancyReport;
  let nextSummerScheduleSettlementReport = state.summerScheduleSettlementReport;
  let nextSummerClassRevenueRows = state.summerClassRevenueRows;
  let nextScheduleInputProfileReport = state.scheduleInputProfileReport;
  let nextScheduleDraftImportReport = state.scheduleDraftImportReport;
  let nextScheduleDraftReviewReport = state.scheduleDraftReviewReport;
  let nextScheduleDraftReviewBulkCandidatesReport =
    state.scheduleDraftReviewBulkCandidatesReport;
  let nextScheduleDraftReviewBulkApplyReport = state.scheduleDraftReviewBulkApplyReport;
  let nextScheduleDraftManualReviewReport = state.scheduleDraftManualReviewReport;
  let nextScheduleDraftManualClassnameBatchCandidatesReport =
    state.scheduleDraftManualClassnameBatchCandidatesReport;
  let nextScheduleDraftManualClassnameBatchApplyReport =
    state.scheduleDraftManualClassnameBatchApplyReport;
  let nextScheduleDraftManualClassroomBatchCandidatesReport =
    state.scheduleDraftManualClassroomBatchCandidatesReport;
  let nextScheduleDraftManualClassroomBatchApplyReport =
    state.scheduleDraftManualClassroomBatchApplyReport;
  let nextScheduleDraftManualCombinedBatchCandidatesReport =
    state.scheduleDraftManualCombinedBatchCandidatesReport;
  let nextScheduleDraftManualCombinedBatchApplyReport =
    state.scheduleDraftManualCombinedBatchApplyReport;
  let nextScheduleDraftManualResidualReport = state.scheduleDraftManualResidualReport;
  let nextOpsOpenItemsReport = state.opsOpenItemsReport;
  let nextOpsChatAnswerSheet = state.opsChatAnswerSheet;
  let nextOpsChatAnswerApplyReport = state.opsChatAnswerApplyReport;
  let nextTeacherSettlementProfileReport = state.teacherSettlementProfileReport;
  let nextTeacherCompensationPolicyReport = state.teacherCompensationPolicyReport;
  let nextTeacherRuleItemResolutionTemplate = state.teacherRuleItemResolutionTemplate;
  let nextTeacherRuleBackfillTemplate = state.teacherRuleBackfillTemplate;
  const importedLogs = [];
  const skippedLogs = [];

  for (const file of files) {
    try {
      const parsed = JSON.parse(await file.text());
      const {
        bridge,
        reconciliation,
        reviewQueue,
        settlementReviewFollowupReport,
        compensationImportReadinessReport,
        settlementImportWavePackageReport,
        settlementImportDeferredActionReport,
        settlementImportExecutionReport,
        settlementOpsActionReport,
        profitSettlementDividendReport,
        summerBigClassRoomOccupancyReport,
        summerScheduleSettlementReport,
        scheduleInputProfileReport,
        scheduleDraftImportReport,
        scheduleDraftReviewReport,
        scheduleDraftReviewBulkCandidatesReport,
        scheduleDraftReviewBulkApplyReport,
        scheduleDraftManualReviewReport,
        scheduleDraftManualClassnameBatchCandidatesReport,
        scheduleDraftManualClassnameBatchApplyReport,
        scheduleDraftManualClassroomBatchCandidatesReport,
        scheduleDraftManualClassroomBatchApplyReport,
        scheduleDraftManualCombinedBatchCandidatesReport,
        scheduleDraftManualCombinedBatchApplyReport,
        scheduleDraftManualResidualReport,
        opsOpenItemsReport,
        opsChatAnswerSheet,
        opsChatAnswerApplyReport,
        teacherSettlementProfileReport,
        teacherCompensationPolicyReport,
        teacherRuleItemResolutionTemplate,
        teacherRuleBackfillTemplate,
      } =
        extractDiagnosticsFromJson(parsed);
      const importedKinds = [];

      if (bridge) {
        nextBridge = normalizeBridgeReport(bridge);
        importedKinds.push("课表-结算桥接报告");
      }
      if (reconciliation) {
        nextReconciliation = normalizeReconciliationReport(reconciliation);
        importedKinds.push("导入对账报告");
      }
      if (reviewQueue) {
        nextReviewQueue = normalizeReviewQueueReport(reviewQueue);
        importedKinds.push("人工复核清单");
      }
      if (settlementReviewFollowupReport) {
        nextSettlementReviewFollowupReport = normalizeSettlementReviewFollowupReport(
          settlementReviewFollowupReport
        );
        importedKinds.push("复核跟进包");
      }
      if (compensationImportReadinessReport) {
        nextCompensationImportReadinessReport =
          normalizeCompensationImportReadinessReport(
            compensationImportReadinessReport
          );
        importedKinds.push("课时费导入就绪报告");
      }
      if (settlementImportWavePackageReport) {
        nextSettlementImportWavePackageReport =
          normalizeSettlementImportWavePackageReport(
            settlementImportWavePackageReport
          );
        importedKinds.push("结算导入分波包");
      }
      if (settlementImportDeferredActionReport) {
        nextSettlementImportDeferredActionReport =
          normalizeSettlementImportDeferredActionReport(
            settlementImportDeferredActionReport
          );
        importedKinds.push("结算延期清零包");
      }
      if (settlementImportExecutionReport) {
        nextSettlementImportExecutionReport =
          normalizeSettlementImportExecutionReport(
            settlementImportExecutionReport
          );
        importedKinds.push("结算导入执行波次");
      }
      if (settlementOpsActionReport) {
        nextSettlementOpsActionReport = normalizeSettlementOpsActionReport(
          settlementOpsActionReport
        );
        importedKinds.push("排课-结算动作总表");
      }
      if (profitSettlementDividendReport) {
        nextProfitSettlementDividendReport = normalizeProfitSettlementDividendReport(
          profitSettlementDividendReport
        );
        importedKinds.push("利润-结算-分红月报");
      }
      if (summerBigClassRoomOccupancyReport) {
        nextSummerBigClassRoomOccupancyReport =
          normalizeSummerBigClassRoomOccupancyReport(
            summerBigClassRoomOccupancyReport
          );
        importedKinds.push("暑期大课教室占用");
      }
      if (summerScheduleSettlementReport) {
        nextSummerScheduleSettlementReport = normalizeSummerScheduleSettlementReport(
          summerScheduleSettlementReport
        );
        if (!nextSummerClassRevenueRows.length) {
          nextSummerClassRevenueRows = createSummerClassRevenueRowsFromReport(
            nextSummerScheduleSettlementReport
          );
        }
        importedKinds.push("暑期排课-结算准备");
      }
      if (scheduleInputProfileReport) {
        nextScheduleInputProfileReport = normalizeScheduleInputProfileReport(
          scheduleInputProfileReport
        );
        importedKinds.push("排课输入画像");
      }
      if (scheduleDraftImportReport) {
        nextScheduleDraftImportReport = normalizeScheduleDraftImportReport(
          scheduleDraftImportReport
        );
        importedKinds.push("排课草稿导入包");
      }
      if (scheduleDraftReviewReport) {
        nextScheduleDraftReviewReport = normalizeScheduleDraftReviewReport(
          scheduleDraftReviewReport
        );
        importedKinds.push("排课草稿复核包");
      }
      if (scheduleDraftReviewBulkCandidatesReport) {
        nextScheduleDraftReviewBulkCandidatesReport =
          normalizeScheduleDraftReviewBulkCandidatesReport(
            scheduleDraftReviewBulkCandidatesReport
          );
        importedKinds.push("排课高置信候选包");
      }
      if (scheduleDraftReviewBulkApplyReport) {
        nextScheduleDraftReviewBulkApplyReport =
          normalizeScheduleDraftReviewBulkApplyReport(
            scheduleDraftReviewBulkApplyReport
          );
        importedKinds.push("排课高置信回写进度");
      }
      if (scheduleDraftManualReviewReport) {
        nextScheduleDraftManualReviewReport = normalizeScheduleDraftManualReviewReport(
          scheduleDraftManualReviewReport
        );
        importedKinds.push("排课残余人工队列");
      }
      if (scheduleDraftManualClassnameBatchCandidatesReport) {
        nextScheduleDraftManualClassnameBatchCandidatesReport =
          normalizeScheduleDraftManualClassnameBatchCandidatesReport(
            scheduleDraftManualClassnameBatchCandidatesReport
          );
        importedKinds.push("排课班名批量候选");
      }
      if (scheduleDraftManualClassnameBatchApplyReport) {
        nextScheduleDraftManualClassnameBatchApplyReport =
          normalizeScheduleDraftManualClassnameBatchApplyReport(
            scheduleDraftManualClassnameBatchApplyReport
          );
        importedKinds.push("排课班名批量回写进度");
      }
      if (scheduleDraftManualClassroomBatchCandidatesReport) {
        nextScheduleDraftManualClassroomBatchCandidatesReport =
          normalizeScheduleDraftManualClassroomBatchCandidatesReport(
            scheduleDraftManualClassroomBatchCandidatesReport
          );
        importedKinds.push("排课教室批量候选");
      }
      if (scheduleDraftManualClassroomBatchApplyReport) {
        nextScheduleDraftManualClassroomBatchApplyReport =
          normalizeScheduleDraftManualClassroomBatchApplyReport(
            scheduleDraftManualClassroomBatchApplyReport
          );
        importedKinds.push("排课教室批量回写进度");
      }
      if (scheduleDraftManualCombinedBatchCandidatesReport) {
        nextScheduleDraftManualCombinedBatchCandidatesReport =
          normalizeScheduleDraftManualCombinedBatchCandidatesReport(
            scheduleDraftManualCombinedBatchCandidatesReport
          );
        importedKinds.push("排课联合批量候选");
      }
      if (scheduleDraftManualCombinedBatchApplyReport) {
        nextScheduleDraftManualCombinedBatchApplyReport =
          normalizeScheduleDraftManualCombinedBatchApplyReport(
            scheduleDraftManualCombinedBatchApplyReport
          );
        importedKinds.push("排课联合批量回写进度");
      }
      if (scheduleDraftManualResidualReport) {
        nextScheduleDraftManualResidualReport =
          normalizeScheduleDraftManualResidualReport(
            scheduleDraftManualResidualReport
          );
        importedKinds.push("排课最终逐条尾项");
      }
      if (opsOpenItemsReport) {
        nextOpsOpenItemsReport = normalizeOpsOpenItemsReport(opsOpenItemsReport);
        importedKinds.push("统一收口待办");
      }
      if (opsChatAnswerSheet) {
        nextOpsChatAnswerSheet = normalizeOpsChatAnswerSheet(opsChatAnswerSheet);
        importedKinds.push("聊天答题卡");
      }
      if (opsChatAnswerApplyReport) {
        nextOpsChatAnswerApplyReport = normalizeOpsChatAnswerApplyReport(
          opsChatAnswerApplyReport
        );
        importedKinds.push("聊天答题卡回填结果");
      }
      if (teacherSettlementProfileReport) {
        nextTeacherSettlementProfileReport = normalizeTeacherSettlementProfileReport(
          teacherSettlementProfileReport
        );
        importedKinds.push("老师结算迁移画像");
      }
      if (teacherCompensationPolicyReport) {
        nextTeacherCompensationPolicyReport =
          normalizeTeacherCompensationPolicyReport(
            teacherCompensationPolicyReport
          );
        importedKinds.push("老师提成政策覆盖");
      }
      if (teacherRuleItemResolutionTemplate) {
        nextTeacherRuleItemResolutionTemplate =
          normalizeTeacherRuleItemResolutionTemplate(
            teacherRuleItemResolutionTemplate
          );
        importedKinds.push("老师覆盖项冲突清理");
      }
      if (teacherRuleBackfillTemplate) {
        nextTeacherRuleBackfillTemplate = normalizeTeacherRuleBackfillTemplate(
          teacherRuleBackfillTemplate
        );
        importedKinds.push("主规则回填建议");
      }

      if (!importedKinds.length) {
        skippedLogs.push(`- ${file.name}：未识别到排课输入画像、排课草稿导入/复核、高置信候选、残余人工队列、班名批量候选、教室批量候选、联合批量候选、最终逐条尾项、统一收口待办、聊天答题卡、聊天答题卡回填结果、桥接、对账、复核清单、复核跟进包、课时费导入就绪报告、结算导入分波包、结算延期清零包、结算导入执行波次、排课-结算动作总表、利润-结算-分红月报、暑期大课教室占用、暑期排课-结算准备、老师结算画像、老师提成政策覆盖、老师覆盖项冲突清理或主规则回填建议数据。`);
        continue;
      }

      importedLogs.push(`- ${file.name}：已导入 ${importedKinds.join("、")}。`);
    } catch (error) {
      skippedLogs.push(`- ${file.name}：JSON 解析失败，${error.message}`);
    }
  }

  if (!importedLogs.length) {
    uiState.importLog = ["诊断 JSON 没有导入任何有效数据。", ...skippedLogs].join("\n");
    persistUiState();
    renderSaveStatus();
    return;
  }

  state = {
    ...state,
    scheduleSettlementBridge: nextBridge,
    importReconciliation: nextReconciliation,
    settlementReviewQueue: nextReviewQueue,
    settlementReviewFollowupReport: nextSettlementReviewFollowupReport,
    compensationImportReadinessReport: nextCompensationImportReadinessReport,
    settlementImportWavePackageReport: nextSettlementImportWavePackageReport,
    settlementImportDeferredActionReport:
      nextSettlementImportDeferredActionReport,
    settlementImportExecutionReport: nextSettlementImportExecutionReport,
    settlementOpsActionReport: nextSettlementOpsActionReport,
    profitSettlementDividendReport: nextProfitSettlementDividendReport,
    summerBigClassRoomOccupancyReport: nextSummerBigClassRoomOccupancyReport,
    summerScheduleSettlementReport: nextSummerScheduleSettlementReport,
    summerClassRevenueRows: nextSummerClassRevenueRows,
    scheduleInputProfileReport: nextScheduleInputProfileReport,
    scheduleDraftImportReport: nextScheduleDraftImportReport,
    scheduleDraftReviewReport: nextScheduleDraftReviewReport,
    scheduleDraftReviewBulkCandidatesReport:
      nextScheduleDraftReviewBulkCandidatesReport,
    scheduleDraftReviewBulkApplyReport: nextScheduleDraftReviewBulkApplyReport,
    scheduleDraftManualReviewReport: nextScheduleDraftManualReviewReport,
    scheduleDraftManualClassnameBatchCandidatesReport:
      nextScheduleDraftManualClassnameBatchCandidatesReport,
    scheduleDraftManualClassnameBatchApplyReport:
      nextScheduleDraftManualClassnameBatchApplyReport,
    scheduleDraftManualClassroomBatchCandidatesReport:
      nextScheduleDraftManualClassroomBatchCandidatesReport,
    scheduleDraftManualClassroomBatchApplyReport:
      nextScheduleDraftManualClassroomBatchApplyReport,
    scheduleDraftManualCombinedBatchCandidatesReport:
      nextScheduleDraftManualCombinedBatchCandidatesReport,
    scheduleDraftManualCombinedBatchApplyReport:
      nextScheduleDraftManualCombinedBatchApplyReport,
    scheduleDraftManualResidualReport: nextScheduleDraftManualResidualReport,
    opsOpenItemsReport: nextOpsOpenItemsReport,
    opsChatAnswerSheet: nextOpsChatAnswerSheet,
    opsChatAnswerApplyReport: nextOpsChatAnswerApplyReport,
    teacherSettlementProfileReport: nextTeacherSettlementProfileReport,
    teacherCompensationPolicyReport: nextTeacherCompensationPolicyReport,
    teacherRuleItemResolutionTemplate: nextTeacherRuleItemResolutionTemplate,
    teacherRuleBackfillTemplate: nextTeacherRuleBackfillTemplate,
  };
  const messageLines = ["已导入诊断 JSON。", ...importedLogs];
  if (skippedLogs.length) {
    messageLines.push("跳过：");
    messageLines.push(...skippedLogs);
  }
  persistState(messageLines.join("\n"));
  fileInput.value = "";
  regenerateSchedule();
}

function extractDiagnosticsFromJson(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return {
      bridge: null,
      reconciliation: null,
      reviewQueue: null,
      settlementReviewFollowupReport: null,
      compensationImportReadinessReport: null,
      settlementImportWavePackageReport: null,
      settlementImportDeferredActionReport: null,
      settlementImportExecutionReport: null,
      settlementOpsActionReport: null,
      profitSettlementDividendReport: null,
      summerBigClassRoomOccupancyReport: null,
      summerScheduleSettlementReport: null,
      scheduleInputProfileReport: null,
      scheduleDraftImportReport: null,
      scheduleDraftReviewReport: null,
      scheduleDraftReviewBulkCandidatesReport: null,
      scheduleDraftReviewBulkApplyReport: null,
      scheduleDraftManualReviewReport: null,
      scheduleDraftManualClassnameBatchCandidatesReport: null,
      scheduleDraftManualClassnameBatchApplyReport: null,
      scheduleDraftManualClassroomBatchCandidatesReport: null,
      scheduleDraftManualClassroomBatchApplyReport: null,
      scheduleDraftManualCombinedBatchCandidatesReport: null,
      scheduleDraftManualCombinedBatchApplyReport: null,
      scheduleDraftManualResidualReport: null,
      opsOpenItemsReport: null,
      opsChatAnswerSheet: null,
      opsChatAnswerApplyReport: null,
      teacherSettlementProfileReport: null,
      teacherCompensationPolicyReport: null,
      teacherRuleItemResolutionTemplate: null,
      teacherRuleBackfillTemplate: null,
    };
  }

  const bridge =
    parsed.scheduleSettlementBridge ||
    (Array.isArray(parsed.period_reports) && (parsed.preview_dir || parsed.input_dir) ? parsed : null);
  const reconciliation =
    parsed.importReconciliation ||
    (parsed.profit_reconciliation && parsed.settlement_reconciliation ? parsed : null);
  const reviewQueue =
    parsed.settlementReviewQueue ||
    (Array.isArray(parsed.review_queue) && Array.isArray(parsed.period_summaries) ? parsed : null);
  const settlementReviewFollowupReport =
    parsed.settlementReviewFollowupReport ||
    (Array.isArray(parsed.followups) &&
    (Array.isArray(parsed.detail_rows) ||
      Array.isArray(parsed.detailRows) ||
      parsed.summary?.pending_item_count !== undefined ||
      parsed.summary?.pendingItemCount !== undefined)
      ? parsed
      : null);
  const compensationImportReadinessReport =
    parsed.compensationImportReadinessReport ||
    (Array.isArray(parsed.period_rows) &&
    Array.isArray(parsed.teacher_period_rows) &&
    (parsed.summary?.source_workbook_count !== undefined ||
      parsed.summary?.sourceWorkbookCount !== undefined ||
      parsed.summary?.compensation_period_count !== undefined ||
      parsed.summary?.compensationPeriodCount !== undefined)
      ? parsed
      : null);
  const settlementImportWavePackageReport =
    parsed.settlementImportWavePackageReport ||
    (Array.isArray(parsed.packages) &&
    Array.isArray(parsed.deferred_rows) &&
    (parsed.summary?.package_count !== undefined ||
      parsed.summary?.packageCount !== undefined ||
      parsed.summary?.deferred_teacher_period_count !== undefined ||
      parsed.summary?.deferredTeacherPeriodCount !== undefined)
      ? parsed
      : null);
  const settlementImportDeferredActionReport =
    parsed.settlementImportDeferredActionReport ||
    (Array.isArray(parsed.packages) &&
    (parsed.summary?.validation_issue_teacher_period_count !== undefined ||
      parsed.summary?.validationIssueTeacherPeriodCount !== undefined ||
      parsed.summary?.total_residual_row_count !== undefined ||
      parsed.summary?.totalResidualRowCount !== undefined)
      ? parsed
      : null);
  const settlementImportExecutionReport =
    parsed.settlementImportExecutionReport ||
    (Array.isArray(parsed.period_rows) &&
    Array.isArray(parsed.teacher_wave_rows) &&
    (parsed.summary?.executable_candidate_teacher_period_count !== undefined ||
      parsed.summary?.executableCandidateTeacherPeriodCount !== undefined ||
      parsed.summary?.ready_after_manual_batches_teacher_period_count !== undefined ||
      parsed.summary?.readyAfterManualBatchesTeacherPeriodCount !== undefined)
      ? parsed
      : null);
  const settlementOpsActionReport =
    parsed.settlementOpsActionReport ||
    (Array.isArray(parsed.period_rows) &&
    Array.isArray(parsed.teacher_action_rows) &&
    (parsed.summary?.actionable_teacher_period_count !== undefined ||
      parsed.summary?.actionableTeacherPeriodCount !== undefined ||
      parsed.summary?.ready_after_bulk_teacher_period_count !== undefined ||
      parsed.summary?.readyAfterBulkTeacherPeriodCount !== undefined)
      ? parsed
      : null);
  const profitSettlementDividendReport =
    parsed.profitSettlementDividendReport ||
    (Array.isArray(parsed.period_rows) &&
    Array.isArray(parsed.teacher_rows) &&
    (parsed.summary?.period_count !== undefined ||
      parsed.summary?.periodCount !== undefined ||
      parsed.summary?.teacher_row_count !== undefined ||
      parsed.summary?.teacherRowCount !== undefined)
      ? parsed
      : null);
  const summerBigClassRoomOccupancyReport =
    parsed.summerBigClassRoomOccupancyReport ||
    (Array.isArray(parsed.occupancy_rows) &&
    Array.isArray(parsed.unresolved_rows) &&
    (parsed.summary?.session_count !== undefined ||
      parsed.summary?.sessionCount !== undefined)
      ? parsed
      : null);
  const summerScheduleSettlementReport =
    parsed.summerScheduleSettlementReport ||
    (Array.isArray(parsed.teacher_rows) &&
    Array.isArray(parsed.class_rows) &&
    (parsed.summary?.teacher_count !== undefined ||
      parsed.summary?.teacherCount !== undefined) &&
    (parsed.summary?.class_count !== undefined ||
      parsed.summary?.classCount !== undefined)
      ? parsed
      : null);
  const scheduleInputProfileReport =
    parsed.scheduleInputProfileReport ||
    (parsed.request_summary &&
    parsed.calendar_summary &&
    (parsed.summary?.course_enrollment_count !== undefined ||
      parsed.summary?.courseEnrollmentCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftImportReport =
    parsed.scheduleDraftImportReport ||
    (parsed.outputs &&
    (parsed.summary?.student_row_count !== undefined ||
      parsed.summary?.studentRowCount !== undefined) &&
    (parsed.summary?.teacher_schedule_row_count !== undefined ||
      parsed.summary?.teacherScheduleRowCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftReviewReport =
    parsed.scheduleDraftReviewReport ||
    (Array.isArray(parsed.review_rows) &&
    (parsed.summary?.unresolved_row_count !== undefined ||
      parsed.summary?.unresolvedRowCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftReviewBulkCandidatesReport =
    parsed.scheduleDraftReviewBulkCandidatesReport ||
    (Array.isArray(parsed.candidate_rows) &&
    (parsed.summary?.row_count !== undefined || parsed.summary?.rowCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftReviewBulkApplyReport =
    parsed.scheduleDraftReviewBulkApplyReport ||
    ((Array.isArray(parsed.applied_rows) ||
      Array.isArray(parsed.skipped_rows) ||
      Array.isArray(parsed.ignored_rows)) &&
    (parsed.summary?.candidate_row_count !== undefined ||
      parsed.summary?.candidateRowCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftManualReviewReport =
    parsed.scheduleDraftManualReviewReport ||
    (Array.isArray(parsed.teacher_period_rows) &&
    Array.isArray(parsed.manual_review_rows) &&
    (parsed.summary?.total_rows !== undefined || parsed.summary?.totalRows !== undefined)
      ? parsed
      : null);
  const scheduleDraftManualClassnameBatchCandidatesReport =
    parsed.scheduleDraftManualClassnameBatchCandidatesReport ||
    (Array.isArray(parsed.batch_rows) &&
    parsed.batch_rows.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.source_note_key || item.sourceNoteKey)
    ) &&
    (parsed.summary?.group_count !== undefined || parsed.summary?.groupCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftManualClassnameBatchApplyReport =
    parsed.scheduleDraftManualClassnameBatchApplyReport ||
    ((Array.isArray(parsed.applied_batches) ||
      Array.isArray(parsed.skipped_batches) ||
      Array.isArray(parsed.ignored_batches)) &&
    Array.isArray(parsed.applied_batches) &&
    parsed.applied_batches.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.resolved_class_name || item.resolvedClassName)
    ) &&
    (parsed.summary?.applied_batch_count !== undefined ||
      parsed.summary?.appliedBatchCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftManualClassroomBatchCandidatesReport =
    parsed.scheduleDraftManualClassroomBatchCandidatesReport ||
    (Array.isArray(parsed.batch_rows) &&
    parsed.batch_rows.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.suggested_classroom_name ||
          item.suggestedClassroomName ||
          item.recommended_resolved_classroom_name ||
          item.recommendedResolvedClassroomName)
    ) &&
    (parsed.summary?.group_count !== undefined || parsed.summary?.groupCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftManualClassroomBatchApplyReport =
    parsed.scheduleDraftManualClassroomBatchApplyReport ||
    ((Array.isArray(parsed.applied_batches) ||
      Array.isArray(parsed.skipped_batches) ||
      Array.isArray(parsed.ignored_batches)) &&
    (
      (Array.isArray(parsed.applied_batches) &&
        parsed.applied_batches.some(
          (item) =>
            item &&
            typeof item === "object" &&
            (item.resolved_classroom_name || item.resolvedClassroomName)
        )) ||
      (Array.isArray(parsed.applied_rows) &&
        parsed.applied_rows.some(
          (item) =>
            item &&
            typeof item === "object" &&
            (item.resolved_classroom_name || item.resolvedClassroomName)
        ))
    ) &&
    (parsed.summary?.applied_batch_count !== undefined ||
      parsed.summary?.appliedBatchCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftManualCombinedBatchCandidatesReport =
    parsed.scheduleDraftManualCombinedBatchCandidatesReport ||
    (Array.isArray(parsed.batch_rows) &&
    parsed.batch_rows.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.recommended_resolved_class_name ||
          item.recommendedResolvedClassName) &&
        (item.recommended_resolved_classroom_name ||
          item.recommendedResolvedClassroomName)
    ) &&
    (parsed.summary?.group_count !== undefined || parsed.summary?.groupCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftManualCombinedBatchApplyReport =
    parsed.scheduleDraftManualCombinedBatchApplyReport ||
    ((Array.isArray(parsed.applied_batches) ||
      Array.isArray(parsed.skipped_batches) ||
      Array.isArray(parsed.ignored_batches)) &&
    (parsed.summary?.applied_batch_count !== undefined ||
      parsed.summary?.appliedBatchCount !== undefined)
      ? parsed
      : null);
  const scheduleDraftManualResidualReport =
    parsed.scheduleDraftManualResidualReport ||
    (Array.isArray(parsed.teacher_period_rows) &&
    Array.isArray(parsed.residual_rows) &&
    (parsed.summary?.row_count !== undefined || parsed.summary?.rowCount !== undefined)
      ? parsed
      : null);
  const opsOpenItemsReport =
    parsed.opsOpenItemsReport ||
    (Array.isArray(parsed.category_rows) &&
    (parsed.summary?.attention_item_count !== undefined ||
      parsed.summary?.attentionItemCount !== undefined)
      ? parsed
      : null);
  const opsChatAnswerSheet =
    parsed.opsChatAnswerSheet ||
    (typeof parsed.reply_template_text === "string" &&
    (parsed.summary?.total_question_count !== undefined ||
      parsed.summary?.totalQuestionCount !== undefined)
      ? parsed
      : null);
  const opsChatAnswerApplyReport =
    parsed.opsChatAnswerApplyReport ||
    (parsed.sections &&
    typeof parsed.sections === "object" &&
    (parsed.summary?.answers_file_exists !== undefined ||
      parsed.summary?.answersFileExists !== undefined ||
      parsed.summary?.parsed_entry_count !== undefined ||
      parsed.summary?.parsedEntryCount !== undefined)
      ? parsed
      : null);
  const teacherSettlementProfileReport =
    parsed.teacherSettlementProfileReport ||
    (Array.isArray(parsed.teacher_profiles) && Array.isArray(parsed.period_summaries)
      ? parsed
      : null);
  const teacherCompensationPolicyReport =
    parsed.teacherCompensationPolicyReport ||
    (Array.isArray(parsed.teacher_rows) &&
    Array.isArray(parsed.period_rows) &&
    (parsed.summary?.reference_period !== undefined ||
      parsed.summary?.referencePeriod !== undefined ||
      parsed.summary?.active_teacher_count !== undefined ||
      parsed.summary?.activeTeacherCount !== undefined)
      ? parsed
      : null);
  const teacherRuleItemResolutionTemplate =
    parsed.teacherRuleItemResolutionTemplate ||
    (Array.isArray(parsed.rows) &&
    parsed.rows.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.scope_label || item.scopeLabel) &&
        (item.effective_start_date || item.effectiveStartDate) &&
        (item.teacher_name || item.teacherName)
    ) &&
    (parsed.summary?.row_count !== undefined || parsed.summary?.rowCount !== undefined)
      ? parsed
      : null);
  const teacherRuleBackfillTemplate =
    parsed.teacherRuleBackfillTemplate ||
    (Array.isArray(parsed.rows) &&
    parsed.rows.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.target_period_name || item.targetPeriodName) &&
        (item.teacher_name || item.teacherName)
    )
      ? parsed
      : null);

  return {
    bridge,
    reconciliation,
    reviewQueue,
    settlementReviewFollowupReport,
    compensationImportReadinessReport,
    settlementImportWavePackageReport,
    settlementImportDeferredActionReport,
    settlementImportExecutionReport,
    settlementOpsActionReport,
    profitSettlementDividendReport,
    summerBigClassRoomOccupancyReport,
    summerScheduleSettlementReport,
    scheduleInputProfileReport,
    scheduleDraftImportReport,
    scheduleDraftReviewReport,
    scheduleDraftReviewBulkCandidatesReport,
    scheduleDraftReviewBulkApplyReport,
    scheduleDraftManualReviewReport,
    scheduleDraftManualClassnameBatchCandidatesReport,
    scheduleDraftManualClassnameBatchApplyReport,
    scheduleDraftManualClassroomBatchCandidatesReport,
    scheduleDraftManualClassroomBatchApplyReport,
    scheduleDraftManualCombinedBatchCandidatesReport,
    scheduleDraftManualCombinedBatchApplyReport,
    scheduleDraftManualResidualReport,
    opsOpenItemsReport,
    opsChatAnswerSheet,
    opsChatAnswerApplyReport,
    teacherSettlementProfileReport,
    teacherCompensationPolicyReport,
    teacherRuleItemResolutionTemplate,
    teacherRuleBackfillTemplate,
  };
}

function normalizeOpsChatAnswerSheet(report) {
  if (!report || typeof report !== "object") {
    return createEmptyOpsChatAnswerSheet();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      total_question_count: Number(
        rawSummary.total_question_count || rawSummary.totalQuestionCount || 0
      ),
      summer_pending_group_count: Number(
        rawSummary.summer_pending_group_count ||
          rawSummary.summerPendingGroupCount ||
          0
      ),
      spring_class_question_count: Number(
        rawSummary.spring_class_question_count ||
          rawSummary.springClassQuestionCount ||
          0
      ),
      spring_room_question_count: Number(
        rawSummary.spring_room_question_count ||
          rawSummary.springRoomQuestionCount ||
          0
      ),
    },
    notes: Array.isArray(report.notes) ? report.notes : [],
    reply_template_text: report.reply_template_text || report.replyTemplateText || "",
    summer_rows: Array.isArray(report.summer_rows)
      ? report.summer_rows
      : Array.isArray(report.summerRows)
        ? report.summerRows
        : [],
    spring_class_rows: Array.isArray(report.spring_class_rows)
      ? report.spring_class_rows
      : Array.isArray(report.springClassRows)
        ? report.springClassRows
        : [],
    spring_room_rows: Array.isArray(report.spring_room_rows)
      ? report.spring_room_rows
      : Array.isArray(report.springRoomRows)
        ? report.springRoomRows
        : [],
  };
}

function normalizeOpsChatAnswerApplyReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyOpsChatAnswerApplyReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      answers_file_exists: Number(
        rawSummary.answers_file_exists || rawSummary.answersFileExists || 0
      ),
      parsed_entry_count: Number(
        rawSummary.parsed_entry_count || rawSummary.parsedEntryCount || 0
      ),
      applied_count: Number(rawSummary.applied_count || rawSummary.appliedCount || 0),
      unknown_key_count: Number(
        rawSummary.unknown_key_count || rawSummary.unknownKeyCount || 0
      ),
      skipped_count: Number(rawSummary.skipped_count || rawSummary.skippedCount || 0),
    },
    notes: Array.isArray(report.notes) ? report.notes : [],
    parse_report:
      report.parse_report && typeof report.parse_report === "object"
        ? report.parse_report
        : report.parseReport && typeof report.parseReport === "object"
          ? report.parseReport
          : createEmptyOpsChatAnswerApplyReport().parse_report,
    sections:
      report.sections && typeof report.sections === "object"
        ? report.sections
        : createEmptyOpsChatAnswerApplyReport().sections,
  };
}

function exportSnapshot() {
  const payload = JSON.stringify(state, null, 2);
  downloadFile(`paike-snapshot-${formatDateForFile(new Date())}.json`, payload, "application/json;charset=utf-8");
  uiState.importLog = "已导出寒暑假系统快照 JSON。";
  persistUiState();
  renderSaveStatus();
}

function exportSelectedCsv() {
  const entity = document.getElementById("importEntity").value;
  const schema = CSV_SCHEMAS[entity];
  const collection = getEntityItems(entity);
  const csv = stringifyCsv(schema.headers, collection.map((item) => schema.toRow(item)));
  downloadFile(schema.filename, csv, "text/csv;charset=utf-8");
  uiState.importLog = `已导出 ${formatEntityLabel(entity)} CSV。`;
  persistUiState();
  renderSaveStatus();
}

function downloadEntityTemplate() {
  const entity = document.getElementById("importEntity").value;
  const schema = CSV_SCHEMAS[entity];
  const sampleRows = getDefaultEntityItems(entity).map((item) => schema.toRow(item));
  const templateName = {
    teacher: "teachers-template.csv",
    room: "classrooms-template.csv",
    demand: "demands-template.csv",
    financialPeriod: "financial-periods-template.csv",
    summerClassRevenueRow: "summer-class-revenue-template.csv",
    dividendPolicy: "dividend-policy-template.csv",
    profitExpenseLine: "profit-expense-lines-template.csv",
    settlementStatement: "settlement-statements-template.csv",
    settlementLine: "settlement-lines-template.csv",
    compensationRule: "teacher-compensation-rules-template.csv",
    compensationRuleItem: "teacher-compensation-rule-items-template.csv",
    nonBillableSlot: "non-billable-slots-template.csv",
    compensationSlotSummary: "compensation-slot-summaries-template.csv",
    settlementReviewResolution: "settlement-review-resolutions-template.csv",
    teacherRuleBackfillRow: "teacher-rule-backfill-template.csv",
  }[entity];

  const csv = stringifyCsv(schema.headers, sampleRows);
  downloadFile(templateName, csv, "text/csv;charset=utf-8");
  uiState.importLog = `已下载 ${formatEntityLabel(entity)} 导入模板。`;
  persistUiState();
  renderSaveStatus();
}

function normalizeTeacher(item) {
  const isCore = Boolean(item.isCore);
  const baselineMaxPerDay = isCore ? 6 : 5;
  const configuredMaxPerDay = Number(item.maxPerDay || 0);
  const normalizedMaxPerDay = configuredMaxPerDay
    ? Math.max(1, Math.min(configuredMaxPerDay, baselineMaxPerDay))
    : baselineMaxPerDay;
  const baselineMaxPerWeek = normalizedMaxPerDay * 6;
  const configuredMaxPerWeek = Number(item.maxPerWeek || 0);
  const normalizedMaxPerWeek = configuredMaxPerWeek
    ? Math.max(normalizedMaxPerDay, Math.min(configuredMaxPerWeek, baselineMaxPerWeek))
    : baselineMaxPerWeek;
  return {
    id: item.id || makeId("teacher"),
    name: item.name || "",
    subject: item.subject || "math",
    gradeFrom: Number(item.gradeFrom || 1),
    gradeTo: Number(item.gradeTo || 1),
    isCore,
    isKey: Boolean(item.isKey),
    isOwner: Boolean(item.isOwner),
    maxPerDay: normalizedMaxPerDay,
    maxPerWeek: normalizedMaxPerWeek,
    weeklyRestDay: item.weeklyRestDay || "",
    schedulePattern: item.schedulePattern || "6_on_1_off",
    fixedRoom: item.fixedRoom || "",
    noEvening: Boolean(item.noEvening),
    status: item.status || "active",
  };
}

function normalizeRoom(item) {
  return {
    id: item.id || makeId("room"),
    name: item.name || "",
    floor: item.floor || "1F",
    maxCapacity: Number(item.maxCapacity || 1),
    roomType: item.roomType || "small_class",
    isFixed: Boolean(item.isFixed),
    summerPriority: Number(item.summerPriority || 0),
    notes: item.notes || "",
    isActive: item.isActive !== false,
  };
}

function normalizeDemand(item) {
  return {
    id: item.id || makeId("demand"),
    name: item.name || "",
    subject: item.subject || "math",
    grade: Number(item.grade || 1),
    size: Number(item.size || 1),
    courseType: item.courseType || "small_class",
    weeklySessions: Number(item.weeklySessions || 1),
    estimatedRevenuePerSession: Number(item.estimatedRevenuePerSession || 0),
    preferredTime: item.preferredTime || "flexible",
    fixedTeacher: item.fixedTeacher || "",
    fixedRoom: item.fixedRoom || "",
    status: item.status || "recruiting",
  };
}

function normalizeFinancialPeriod(item) {
  return {
    id: item.id || makeId("financial"),
    periodName: item.periodName || "",
    grossProfit: Number(item.grossProfit || 0),
    totalExpense: Number(item.totalExpense || 0),
    teachingBusinessExpense: Number(item.teachingBusinessExpense || 0),
    netProfit: Number(item.netProfit || 0),
  };
}

function normalizeSummerClassRevenueRow(item) {
  return {
    id: item.id || makeId("summer-revenue"),
    className: item.className || "",
    subject: item.subject || "",
    grade: item.grade || "",
    courseType: item.courseType || "",
    plannedSize: item.plannedSize || "",
    currentSize: item.currentSize || "",
    teacherNamesText: item.teacherNamesText || "",
    teachingSessionCount: Number(item.teachingSessionCount || 0),
    targetTeachingSessionCount: Number(item.targetTeachingSessionCount || 0),
    estimatedSessionRevenue: item.estimatedSessionRevenue || "",
    estimatedRevenueSource: item.estimatedRevenueSource || "",
    suggestedUnitFee: item.suggestedUnitFee || "",
    suggestedSessionRevenue: item.suggestedSessionRevenue || "",
    suggestedRevenueSource: item.suggestedRevenueSource || "",
    suggestionSampleCount: Number(item.suggestionSampleCount || 0),
    resolutionStatus: item.resolutionStatus || "",
    notes: item.notes || "",
  };
}

function normalizeDividendPolicy(item) {
  return {
    id: item.id || makeId("dividend-policy"),
    effectiveStartPeriod: item.effectiveStartPeriod || "",
    baseDividendRatePercent: Number(item.baseDividendRatePercent || 0),
    monthlyIncrementPercent: Number(item.monthlyIncrementPercent || 0),
    capDividendRatePercent: Number(item.capDividendRatePercent || 0),
    notes: item.notes || "",
  };
}

function normalizeProfitExpenseLine(item) {
  return {
    id: item.id || makeId("profit-expense"),
    periodName: item.periodName || "",
    expenseScope: item.expenseScope || "",
    categoryName: item.categoryName || "",
    amountRaw: item.amountRaw || "",
    notes: item.notes || "",
  };
}

function normalizeSettlementStatement(item) {
  return {
    id: item.id || makeId("settlement"),
    periodName: item.periodName || "",
    periodStart: item.periodStart || "",
    periodEnd: item.periodEnd || "",
    teacherName: item.teacherName || "",
    revenueTotalRaw: item.revenueTotalRaw || "",
    baseSalaryAmount: item.baseSalaryAmount || "",
    socialInsuranceAmount: item.socialInsuranceAmount || "",
    housingFundAmount: item.housingFundAmount || "",
    teachingCommissionAmount: item.teachingCommissionAmount || "",
    makeupCommissionAmount: item.makeupCommissionAmount || "",
    qaCommissionAmount: item.qaCommissionAmount || "",
    subsidyAmount: item.subsidyAmount || "",
    balanceAmountRaw: item.balanceAmountRaw || "",
    grossAmount: item.grossAmount || "",
    adjustmentAmount: item.adjustmentAmount || "",
    finalAmount: item.finalAmount || "",
    status: item.status || "",
    notes: item.notes || "",
  };
}

function normalizeSettlementLine(item) {
  return {
    id: item.id || makeId("settlement-line"),
    periodName: item.periodName || "",
    teacherName: item.teacherName || "",
    studentName: item.studentName || "",
    feeAmountRaw: item.feeAmountRaw || "",
    commissionAmountRaw: item.commissionAmountRaw || "",
    lessonOccurrencesRaw: item.lessonOccurrencesRaw || "",
    lessonCount: item.lessonCount || "",
    commissionTotalAmount: item.commissionTotalAmount || "",
    calcMode: item.calcMode || "",
    studentCount: item.studentCount || "",
    sessionCount: item.sessionCount || "",
    settlementHours: item.settlementHours || "",
    baseAmount: item.baseAmount || "",
    adjustmentAmount: item.adjustmentAmount || "",
    finalAmount: item.finalAmount || "",
    notes: item.notes || "",
  };
}

function normalizeCompensationRule(item) {
  return {
    id: item.id || makeId("rule"),
    teacherName: item.teacherName || "",
    effectiveStartDate: item.effectiveStartDate || "",
    effectiveEndDate: item.effectiveEndDate || "",
    settlementCycle: item.settlementCycle || "",
    calcMode: item.calcMode || "",
    baseAmount: item.baseAmount || "",
    hourlyAmount: item.hourlyAmount || "",
    perStudentAmount: item.perStudentAmount || "",
    revenueShareRatio: item.revenueShareRatio || "",
    notes: item.notes || "",
  };
}

function normalizeCompensationRuleItem(item) {
  return {
    id: item.id || makeId("rule-item"),
    teacherName: item.teacherName || "",
    effectiveStartDate: item.effectiveStartDate || "",
    courseType: item.courseType || "",
    sessionTag: item.sessionTag || "",
    gradeFrom: item.gradeFrom || "",
    gradeTo: item.gradeTo || "",
    calcModeOverride: item.calcModeOverride || "",
    unitAmount: item.unitAmount || "",
    ratioOverride: item.ratioOverride || "",
    priority: Number(item.priority || 0),
    notes: item.notes || "",
  };
}

function normalizeNonBillableSlot(item) {
  return {
    id: item.id || makeId("free-slot"),
    periodName: item.periodName || "",
    teacherName: item.teacherName || "",
    slotDate: item.slotDate || "",
    slotTimeText: item.slotTimeText || "",
    reasonType: item.reasonType || "",
    notes: item.notes || "",
  };
}

function normalizeCompensationSlotSummary(item) {
  return {
    id: item.id || makeId("slot-summary"),
    periodName: item.periodName || "",
    ownerTeacherName: item.ownerTeacherName || "",
    relatedTeacherName: item.relatedTeacherName || "",
    metricType: item.metricType || "",
    rowLabel: item.rowLabel || "",
    rowKind: item.rowKind || "",
    quantityRaw: item.quantityRaw || "",
    quantityValue: item.quantityValue === 0 ? 0 : item.quantityValue || "",
    notes: item.notes || "",
  };
}

function normalizeSettlementReviewResolution(item) {
  return {
    id: item.id || makeId("review-resolution"),
    periodName: item.periodName || "",
    teacherName: item.teacherName || "",
    reviewScope: item.reviewScope || "teacher_period",
    priority: item.priority || "",
    bridgeReviewFlags: item.bridgeReviewFlags || "",
    bridgeInfoFlags: item.bridgeInfoFlags || "",
    reconciliationReviewFlags: item.reconciliationReviewFlags || "",
    recommendedAction: item.recommendedAction || "",
    resolutionStatus: item.resolutionStatus || "pending",
    resolutionType: item.resolutionType || "",
    ownerName: item.ownerName || "",
    decisionSummary: item.decisionSummary || "",
    followUpAction: item.followUpAction || "",
    resolvedByName: item.resolvedByName || "",
    resolvedAt: item.resolvedAt || "",
    notes: item.notes || "",
  };
}

function normalizeBridgeReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyBridgeReport();
  }

  return {
    status: report.status || "",
    preview_dir: report.preview_dir || report.previewDir || "",
    input_dir: report.input_dir || report.inputDir || "",
    period_reports: Array.isArray(report.period_reports)
      ? report.period_reports.map(normalizeBridgePeriodReport)
      : Array.isArray(report.periodReports)
        ? report.periodReports.map(normalizeBridgePeriodReport)
        : [],
  };
}

function normalizeBridgePeriodReport(report) {
  return {
    period_name: report.period_name || report.periodName || "",
    status: report.status || "",
    summary: {
      teacher_count: Number(report.summary?.teacher_count || report.summary?.teacherCount || 0),
      teachers_needing_review: Number(
        report.summary?.teachers_needing_review || report.summary?.teachersNeedingReview || 0
      ),
      summary_only_slot_board_teachers: Number(
        report.summary?.summary_only_slot_board_teachers ||
          report.summary?.summaryOnlySlotBoardTeachers ||
          0
      ),
      total_calendar_billable_cell_count: Number(
        report.summary?.total_calendar_billable_cell_count ||
          report.summary?.totalCalendarBillableCellCount ||
          0
      ),
      total_settlement_session_count:
        report.summary?.total_settlement_session_count ||
        report.summary?.totalSettlementSessionCount ||
        "",
    },
    teacher_reports: Array.isArray(report.teacher_reports)
      ? report.teacher_reports.map(normalizeBridgeTeacherReport)
      : Array.isArray(report.teacherReports)
        ? report.teacherReports.map(normalizeBridgeTeacherReport)
        : [],
  };
}

function normalizeBridgeTeacherReport(report) {
  return {
    ...report,
    period_name: report.period_name || report.periodName || "",
    teacher_name: report.teacher_name || report.teacherName || "",
    status: report.status || "",
    review_flags: Array.isArray(report.review_flags) ? report.review_flags : report.reviewFlags || [],
    info_flags: Array.isArray(report.info_flags) ? report.info_flags : report.infoFlags || [],
    settlement_only_enrollment_supported_name_samples: Array.isArray(
      report.settlement_only_enrollment_supported_name_samples
    )
      ? report.settlement_only_enrollment_supported_name_samples
      : [],
    settlement_only_missing_from_schedule_source_name_samples: Array.isArray(
      report.settlement_only_missing_from_schedule_source_name_samples
    )
      ? report.settlement_only_missing_from_schedule_source_name_samples
      : [],
  };
}

function normalizeReconciliationReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyReconciliationReport();
  }

  return {
    status: report.status || "",
    profit_reconciliation: {
      status: report.profit_reconciliation?.status || report.profitReconciliation?.status || "",
      periods: Array.isArray(report.profit_reconciliation?.periods)
        ? report.profit_reconciliation.periods
        : Array.isArray(report.profitReconciliation?.periods)
          ? report.profitReconciliation.periods
          : [],
    },
    settlement_reconciliation: {
      status:
        report.settlement_reconciliation?.status || report.settlementReconciliation?.status || "",
      period_summaries: Array.isArray(report.settlement_reconciliation?.period_summaries)
        ? report.settlement_reconciliation.period_summaries
        : Array.isArray(report.settlementReconciliation?.periodSummaries)
          ? report.settlementReconciliation.periodSummaries
          : [],
      statement_reports: Array.isArray(report.settlement_reconciliation?.statement_reports)
        ? report.settlement_reconciliation.statement_reports
        : Array.isArray(report.settlementReconciliation?.statementReports)
          ? report.settlementReconciliation.statementReports
          : [],
      mismatches: Array.isArray(report.settlement_reconciliation?.mismatches)
        ? report.settlement_reconciliation.mismatches
        : Array.isArray(report.settlementReconciliation?.mismatches)
          ? report.settlementReconciliation.mismatches
          : [],
      summary_only_slot_boards: Array.isArray(report.settlement_reconciliation?.summary_only_slot_boards)
        ? report.settlement_reconciliation.summary_only_slot_boards
        : Array.isArray(report.settlementReconciliation?.summaryOnlySlotBoards)
          ? report.settlementReconciliation.summaryOnlySlotBoards
          : [],
    },
  };
}

function normalizeReviewQueueReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyReviewQueueReport();
  }

  return {
    status: report.status || "",
    period_summaries: Array.isArray(report.period_summaries)
      ? report.period_summaries
      : Array.isArray(report.periodSummaries)
        ? report.periodSummaries
        : [],
    review_queue: Array.isArray(report.review_queue)
      ? report.review_queue
      : Array.isArray(report.reviewQueue)
        ? report.reviewQueue
        : [],
  };
}

function normalizeSettlementReviewFollowupReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptySettlementReviewFollowupReport();
  }

  const followups = Array.isArray(report.followups)
    ? report.followups.map(normalizeSettlementReviewFollowupRow)
    : [];
  const detailRows = Array.isArray(report.detail_rows)
    ? report.detail_rows.map(normalizeSettlementReviewFollowupDetailRow)
    : Array.isArray(report.detailRows)
      ? report.detailRows.map(normalizeSettlementReviewFollowupDetailRow)
      : [];
  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const followupTypeCounts = Array.isArray(rawSummary.followup_type_counts)
    ? rawSummary.followup_type_counts.map((item) => ({
        followup_type: item.followup_type || item.followupType || "",
        count: Number(item.count || 0),
      }))
    : Array.isArray(rawSummary.followupTypeCounts)
      ? rawSummary.followupTypeCounts.map((item) => ({
          followup_type: item.followup_type || item.followupType || "",
          count: Number(item.count || 0),
        }))
      : [];

  return {
    status: report.status || "",
    summary: {
      pending_item_count: Number(
        rawSummary.pending_item_count || rawSummary.pendingItemCount || followups.length
      ),
      detail_row_count: Number(
        rawSummary.detail_row_count || rawSummary.detailRowCount || detailRows.length
      ),
      followup_type_counts: followupTypeCounts,
    },
    followups,
    detail_rows: detailRows,
  };
}

function normalizeCompensationImportReadinessReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyCompensationImportReadinessReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const rawSourceInventory =
    report.source_inventory && typeof report.source_inventory === "object"
      ? report.source_inventory
      : report.sourceInventory && typeof report.sourceInventory === "object"
        ? report.sourceInventory
        : {};

  return {
    status: report.status || "",
    summary: {
      source_workbook_count: Number(
        rawSummary.source_workbook_count || rawSummary.sourceWorkbookCount || 0
      ),
      compensation_workbook_count: Number(
        rawSummary.compensation_workbook_count ||
          rawSummary.compensationWorkbookCount ||
          0
      ),
      compensation_period_count: Number(
        rawSummary.compensation_period_count || rawSummary.compensationPeriodCount || 0
      ),
      compensation_period_names:
        rawSummary.compensation_period_names ||
        rawSummary.compensationPeriodNames ||
        [],
      teacher_period_count: Number(
        rawSummary.teacher_period_count || rawSummary.teacherPeriodCount || 0
      ),
      missing_statement_teacher_period_count: Number(
        rawSummary.missing_statement_teacher_period_count ||
          rawSummary.missingStatementTeacherPeriodCount ||
          0
      ),
      summary_only_teacher_period_count: Number(
        rawSummary.summary_only_teacher_period_count ||
          rawSummary.summaryOnlyTeacherPeriodCount ||
          0
      ),
      needs_rule_inference_teacher_period_count: Number(
        rawSummary.needs_rule_inference_teacher_period_count ||
          rawSummary.needsRuleInferenceTeacherPeriodCount ||
          0
      ),
      schedule_blocked_teacher_period_count: Number(
        rawSummary.schedule_blocked_teacher_period_count ||
          rawSummary.scheduleBlockedTeacherPeriodCount ||
          0
      ),
      ready_for_rule_migration_teacher_period_count: Number(
        rawSummary.ready_for_rule_migration_teacher_period_count ||
          rawSummary.readyForRuleMigrationTeacherPeriodCount ||
          0
      ),
      high_priority_teacher_period_count: Number(
        rawSummary.high_priority_teacher_period_count ||
          rawSummary.highPriorityTeacherPeriodCount ||
          0
      ),
    },
    source_inventory: {
      source_dir: rawSourceInventory.source_dir || rawSourceInventory.sourceDir || "",
      workbooks: Array.isArray(rawSourceInventory.workbooks)
        ? rawSourceInventory.workbooks.map(normalizeCompensationImportWorkbookRow)
        : [],
      category_counts:
        rawSourceInventory.category_counts || rawSourceInventory.categoryCounts || {},
      compensation_periods:
        rawSourceInventory.compensation_periods ||
        rawSourceInventory.compensationPeriods ||
        [],
      expected_core_files:
        rawSourceInventory.expected_core_files ||
        rawSourceInventory.expectedCoreFiles ||
        [],
    },
    period_rows: Array.isArray(report.period_rows)
      ? report.period_rows.map(normalizeCompensationImportReadinessPeriodRow)
      : Array.isArray(report.periodRows)
        ? report.periodRows.map(normalizeCompensationImportReadinessPeriodRow)
        : [],
    teacher_period_rows: Array.isArray(report.teacher_period_rows)
      ? report.teacher_period_rows.map(normalizeCompensationImportReadinessTeacherRow)
      : Array.isArray(report.teacherPeriodRows)
        ? report.teacherPeriodRows.map(normalizeCompensationImportReadinessTeacherRow)
        : [],
    focus_items: Array.isArray(report.focus_items)
      ? report.focus_items.map(normalizeCompensationImportReadinessTeacherRow)
      : Array.isArray(report.focusItems)
        ? report.focusItems.map(normalizeCompensationImportReadinessTeacherRow)
        : [],
  };
}

function normalizeSettlementImportExecutionReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptySettlementImportExecutionReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      period_count: Number(rawSummary.period_count || rawSummary.periodCount || 0),
      teacher_period_count: Number(
        rawSummary.teacher_period_count || rawSummary.teacherPeriodCount || 0
      ),
      executable_candidate_teacher_period_count: Number(
        rawSummary.executable_candidate_teacher_period_count ||
          rawSummary.executableCandidateTeacherPeriodCount ||
          0
      ),
      ready_now_teacher_period_count: Number(
        rawSummary.ready_now_teacher_period_count ||
          rawSummary.readyNowTeacherPeriodCount ||
          0
      ),
      ready_after_bulk_teacher_period_count: Number(
        rawSummary.ready_after_bulk_teacher_period_count ||
          rawSummary.readyAfterBulkTeacherPeriodCount ||
          0
      ),
      ready_after_manual_batches_teacher_period_count: Number(
        rawSummary.ready_after_manual_batches_teacher_period_count ||
          rawSummary.readyAfterManualBatchesTeacherPeriodCount ||
          0
      ),
      manual_review_after_bulk_teacher_period_count: Number(
        rawSummary.manual_review_after_bulk_teacher_period_count ||
          rawSummary.manualReviewAfterBulkTeacherPeriodCount ||
          0
      ),
      row_by_row_teacher_period_count: Number(
        rawSummary.row_by_row_teacher_period_count ||
          rawSummary.rowByRowTeacherPeriodCount ||
          0
      ),
      blocked_missing_statement_teacher_period_count: Number(
        rawSummary.blocked_missing_statement_teacher_period_count ||
          rawSummary.blockedMissingStatementTeacherPeriodCount ||
          0
      ),
      blocked_rule_backfill_teacher_period_count: Number(
        rawSummary.blocked_rule_backfill_teacher_period_count ||
          rawSummary.blockedRuleBackfillTeacherPeriodCount ||
          0
      ),
      hold_summary_board_teacher_period_count: Number(
        rawSummary.hold_summary_board_teacher_period_count ||
          rawSummary.holdSummaryBoardTeacherPeriodCount ||
          0
      ),
      hold_archive_teacher_period_count: Number(
        rawSummary.hold_archive_teacher_period_count ||
          rawSummary.holdArchiveTeacherPeriodCount ||
          0
      ),
      blocked_other_teacher_period_count: Number(
        rawSummary.blocked_other_teacher_period_count ||
          rawSummary.blockedOtherTeacherPeriodCount ||
          0
      ),
      total_schedule_unresolved_row_count: Number(
        rawSummary.total_schedule_unresolved_row_count ||
          rawSummary.totalScheduleUnresolvedRowCount ||
          0
      ),
      total_batch_gain_row_count: Number(
        rawSummary.total_batch_gain_row_count ||
          rawSummary.totalBatchGainRowCount ||
          0
      ),
      total_manual_batch_gain_row_count: Number(
        rawSummary.total_manual_batch_gain_row_count ||
          rawSummary.totalManualBatchGainRowCount ||
          0
      ),
      profit_period_count: Number(
        rawSummary.profit_period_count || rawSummary.profitPeriodCount || 0
      ),
      profit_ready_current_safe_period_count: Number(
        rawSummary.profit_ready_current_safe_period_count ||
          rawSummary.profitReadyCurrentSafePeriodCount ||
          0
      ),
      profit_ready_after_bulk_period_count: Number(
        rawSummary.profit_ready_after_bulk_period_count ||
          rawSummary.profitReadyAfterBulkPeriodCount ||
          0
      ),
      profit_ready_after_manual_batches_period_count: Number(
        rawSummary.profit_ready_after_manual_batches_period_count ||
          rawSummary.profitReadyAfterManualBatchesPeriodCount ||
          0
      ),
      profit_blocked_period_count: Number(
        rawSummary.profit_blocked_period_count ||
          rawSummary.profitBlockedPeriodCount ||
          0
      ),
    },
    period_rows: Array.isArray(report.period_rows)
      ? report.period_rows.map(normalizeSettlementImportExecutionPeriodRow)
      : Array.isArray(report.periodRows)
        ? report.periodRows.map(normalizeSettlementImportExecutionPeriodRow)
        : [],
    teacher_wave_rows: Array.isArray(report.teacher_wave_rows)
      ? report.teacher_wave_rows.map(normalizeSettlementImportExecutionTeacherRow)
      : Array.isArray(report.teacherWaveRows)
        ? report.teacherWaveRows.map(normalizeSettlementImportExecutionTeacherRow)
        : [],
    focus_rows: Array.isArray(report.focus_rows)
      ? report.focus_rows.map(normalizeSettlementImportExecutionTeacherRow)
      : Array.isArray(report.focusRows)
        ? report.focusRows.map(normalizeSettlementImportExecutionTeacherRow)
        : [],
    notes: Array.isArray(report.notes) ? report.notes : [],
  };
}

function normalizeSettlementImportWavePackageReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptySettlementImportWavePackageReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      package_count: Number(rawSummary.package_count || rawSummary.packageCount || 0),
      current_safe_teacher_period_count: Number(
        rawSummary.current_safe_teacher_period_count ||
          rawSummary.currentSafeTeacherPeriodCount ||
          0
      ),
      after_bulk_teacher_period_count: Number(
        rawSummary.after_bulk_teacher_period_count ||
          rawSummary.afterBulkTeacherPeriodCount ||
          0
      ),
      after_manual_batches_teacher_period_count: Number(
        rawSummary.after_manual_batches_teacher_period_count ||
          rawSummary.afterManualBatchesTeacherPeriodCount ||
          0
      ),
      max_profit_ready_period_count: Number(
        rawSummary.max_profit_ready_period_count ||
          rawSummary.maxProfitReadyPeriodCount ||
          0
      ),
      profit_period_count: Number(
        rawSummary.profit_period_count || rawSummary.profitPeriodCount || 0
      ),
      profit_ready_current_safe_period_count: Number(
        rawSummary.profit_ready_current_safe_period_count ||
          rawSummary.profitReadyCurrentSafePeriodCount ||
          0
      ),
      profit_ready_after_bulk_period_count: Number(
        rawSummary.profit_ready_after_bulk_period_count ||
          rawSummary.profitReadyAfterBulkPeriodCount ||
          0
      ),
      profit_ready_after_manual_batches_period_count: Number(
        rawSummary.profit_ready_after_manual_batches_period_count ||
          rawSummary.profitReadyAfterManualBatchesPeriodCount ||
          0
      ),
      profit_blocked_period_count: Number(
        rawSummary.profit_blocked_period_count ||
          rawSummary.profitBlockedPeriodCount ||
          0
      ),
      deferred_teacher_period_count: Number(
        rawSummary.deferred_teacher_period_count ||
          rawSummary.deferredTeacherPeriodCount ||
          0
      ),
      deferred_execution_wave_counts:
        rawSummary.deferred_execution_wave_counts ||
        rawSummary.deferredExecutionWaveCounts ||
        {},
      source_teacher_period_count: Number(
        rawSummary.source_teacher_period_count ||
          rawSummary.sourceTeacherPeriodCount ||
          0
      ),
    },
    packages: Array.isArray(report.packages)
      ? report.packages.map(normalizeSettlementImportWavePackageEntry)
      : [],
    profit_period_rows: Array.isArray(report.profit_period_rows)
      ? report.profit_period_rows.map(normalizeSettlementImportWaveProfitPeriodRow)
      : Array.isArray(report.profitPeriodRows)
        ? report.profitPeriodRows.map(normalizeSettlementImportWaveProfitPeriodRow)
        : [],
    deferred_rows: Array.isArray(report.deferred_rows)
      ? report.deferred_rows.map(normalizeSettlementImportExecutionTeacherRow)
      : Array.isArray(report.deferredRows)
        ? report.deferredRows.map(normalizeSettlementImportExecutionTeacherRow)
        : [],
    notes: Array.isArray(report.notes) ? report.notes : [],
  };
}

function normalizeSettlementImportDeferredActionReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptySettlementImportDeferredActionReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      package_count: Number(rawSummary.package_count || rawSummary.packageCount || 0),
      execution_wave_counts:
        rawSummary.execution_wave_counts ||
        rawSummary.executionWaveCounts ||
        {},
      validation_status_counts:
        rawSummary.validation_status_counts ||
        rawSummary.validationStatusCounts ||
        {},
      validation_issue_teacher_period_count: Number(
        rawSummary.validation_issue_teacher_period_count ||
          rawSummary.validationIssueTeacherPeriodCount ||
          0
      ),
      total_bulk_candidate_row_count: Number(
        rawSummary.total_bulk_candidate_row_count ||
          rawSummary.totalBulkCandidateRowCount ||
          0
      ),
      total_manual_classname_batch_group_count: Number(
        rawSummary.total_manual_classname_batch_group_count ||
          rawSummary.totalManualClassnameBatchGroupCount ||
          0
      ),
      total_manual_classname_batch_row_count: Number(
        rawSummary.total_manual_classname_batch_row_count ||
          rawSummary.totalManualClassnameBatchRowCount ||
          0
      ),
      total_manual_classroom_batch_group_count: Number(
        rawSummary.total_manual_classroom_batch_group_count ||
          rawSummary.totalManualClassroomBatchGroupCount ||
          0
      ),
      total_manual_classroom_batch_row_count: Number(
        rawSummary.total_manual_classroom_batch_row_count ||
          rawSummary.totalManualClassroomBatchRowCount ||
          0
      ),
      total_manual_combined_batch_group_count: Number(
        rawSummary.total_manual_combined_batch_group_count ||
          rawSummary.totalManualCombinedBatchGroupCount ||
          0
      ),
      total_manual_combined_batch_row_count: Number(
        rawSummary.total_manual_combined_batch_row_count ||
          rawSummary.totalManualCombinedBatchRowCount ||
          0
      ),
      total_residual_row_count: Number(
        rawSummary.total_residual_row_count ||
          rawSummary.totalResidualRowCount ||
          0
      ),
    },
    packages: Array.isArray(report.packages)
      ? report.packages.map(normalizeSettlementImportDeferredActionPackageEntry)
      : [],
  };
}

function normalizeSettlementOpsActionReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptySettlementOpsActionReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      period_count: Number(rawSummary.period_count || rawSummary.periodCount || 0),
      teacher_period_count: Number(
        rawSummary.teacher_period_count || rawSummary.teacherPeriodCount || 0
      ),
      actionable_teacher_period_count: Number(
        rawSummary.actionable_teacher_period_count ||
          rawSummary.actionableTeacherPeriodCount ||
          0
      ),
      ready_now_teacher_period_count: Number(
        rawSummary.ready_now_teacher_period_count ||
          rawSummary.readyNowTeacherPeriodCount ||
          0
      ),
      ready_after_bulk_teacher_period_count: Number(
        rawSummary.ready_after_bulk_teacher_period_count ||
          rawSummary.readyAfterBulkTeacherPeriodCount ||
          0
      ),
      missing_statement_teacher_period_count: Number(
        rawSummary.missing_statement_teacher_period_count ||
          rawSummary.missingStatementTeacherPeriodCount ||
          0
      ),
      summary_board_teacher_period_count: Number(
        rawSummary.summary_board_teacher_period_count ||
          rawSummary.summaryBoardTeacherPeriodCount ||
          0
      ),
      historical_archive_teacher_period_count: Number(
        rawSummary.historical_archive_teacher_period_count ||
          rawSummary.historicalArchiveTeacherPeriodCount ||
          0
      ),
      schedule_bulk_first_teacher_period_count: Number(
        rawSummary.schedule_bulk_first_teacher_period_count ||
          rawSummary.scheduleBulkFirstTeacherPeriodCount ||
          0
      ),
      schedule_manual_batch_teacher_period_count: Number(
        rawSummary.schedule_manual_batch_teacher_period_count ||
          rawSummary.scheduleManualBatchTeacherPeriodCount ||
          0
      ),
      schedule_row_by_row_teacher_period_count: Number(
        rawSummary.schedule_row_by_row_teacher_period_count ||
          rawSummary.scheduleRowByRowTeacherPeriodCount ||
          0
      ),
      total_schedule_unresolved_row_count: Number(
        rawSummary.total_schedule_unresolved_row_count ||
          rawSummary.totalScheduleUnresolvedRowCount ||
          0
      ),
      total_batch_gain_row_count: Number(
        rawSummary.total_batch_gain_row_count ||
          rawSummary.totalBatchGainRowCount ||
          0
      ),
      profit_period_count: Number(
        rawSummary.profit_period_count || rawSummary.profitPeriodCount || 0
      ),
      profit_ready_current_safe_period_count: Number(
        rawSummary.profit_ready_current_safe_period_count ||
          rawSummary.profitReadyCurrentSafePeriodCount ||
          0
      ),
      profit_ready_after_bulk_period_count: Number(
        rawSummary.profit_ready_after_bulk_period_count ||
          rawSummary.profitReadyAfterBulkPeriodCount ||
          0
      ),
      profit_ready_after_manual_batches_period_count: Number(
        rawSummary.profit_ready_after_manual_batches_period_count ||
          rawSummary.profitReadyAfterManualBatchesPeriodCount ||
          0
      ),
      profit_blocked_period_count: Number(
        rawSummary.profit_blocked_period_count ||
          rawSummary.profitBlockedPeriodCount ||
          0
      ),
    },
    period_rows: Array.isArray(report.period_rows)
      ? report.period_rows.map(normalizeSettlementOpsActionPeriodRow)
      : Array.isArray(report.periodRows)
        ? report.periodRows.map(normalizeSettlementOpsActionPeriodRow)
        : [],
    teacher_action_rows: Array.isArray(report.teacher_action_rows)
      ? report.teacher_action_rows.map(normalizeSettlementOpsActionTeacherRow)
      : Array.isArray(report.teacherActionRows)
        ? report.teacherActionRows.map(normalizeSettlementOpsActionTeacherRow)
        : [],
    focus_rows: Array.isArray(report.focus_rows)
      ? report.focus_rows.map(normalizeSettlementOpsActionTeacherRow)
      : Array.isArray(report.focusRows)
        ? report.focusRows.map(normalizeSettlementOpsActionTeacherRow)
        : [],
    notes: Array.isArray(report.notes) ? report.notes : [],
  };
}

function normalizeProfitSettlementDividendReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyProfitSettlementDividendReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      period_count: Number(rawSummary.period_count || rawSummary.periodCount || 0),
      latest_period: rawSummary.latest_period || rawSummary.latestPeriod || "",
      teacher_row_count: Number(rawSummary.teacher_row_count || rawSummary.teacherRowCount || 0),
      periods_with_profit_statement_count: Number(
        rawSummary.periods_with_profit_statement_count ||
          rawSummary.periodsWithProfitStatementCount ||
          0
      ),
      total_teacher_revenue_amount:
        rawSummary.total_teacher_revenue_amount || rawSummary.totalTeacherRevenueAmount || "",
      total_settlement_component_amount:
        rawSummary.total_settlement_component_amount ||
        rawSummary.totalSettlementComponentAmount ||
        "",
      total_net_profit_amount:
        rawSummary.total_net_profit_amount || rawSummary.totalNetProfitAmount || "",
      total_dividend_pool_amount:
        rawSummary.total_dividend_pool_amount || rawSummary.totalDividendPoolAmount || "",
      total_retained_profit_amount:
        rawSummary.total_retained_profit_amount || rawSummary.totalRetainedProfitAmount || "",
    },
    period_rows: Array.isArray(report.period_rows)
      ? report.period_rows.map(normalizeProfitSettlementDividendPeriodRow)
      : Array.isArray(report.periodRows)
        ? report.periodRows.map(normalizeProfitSettlementDividendPeriodRow)
        : [],
    teacher_rows: Array.isArray(report.teacher_rows)
      ? report.teacher_rows.map(normalizeProfitSettlementDividendTeacherRow)
      : Array.isArray(report.teacherRows)
        ? report.teacherRows.map(normalizeProfitSettlementDividendTeacherRow)
        : [],
    latest_period_top_teachers: Array.isArray(report.latest_period_top_teachers)
      ? report.latest_period_top_teachers.map(normalizeProfitSettlementDividendTeacherRow)
      : Array.isArray(report.latestPeriodTopTeachers)
        ? report.latestPeriodTopTeachers.map(normalizeProfitSettlementDividendTeacherRow)
        : [],
    notes: Array.isArray(report.notes) ? report.notes : [],
  };
}

function normalizeProfitSettlementDividendPeriodRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_count: Number(row.teacher_count || row.teacherCount || 0),
    teacher_revenue_total_amount:
      row.teacher_revenue_total_amount || row.teacherRevenueTotalAmount || "",
    base_salary_total_amount:
      row.base_salary_total_amount || row.baseSalaryTotalAmount || "",
    social_insurance_total_amount:
      row.social_insurance_total_amount || row.socialInsuranceTotalAmount || "",
    housing_fund_total_amount:
      row.housing_fund_total_amount || row.housingFundTotalAmount || "",
    teaching_commission_total_amount:
      row.teaching_commission_total_amount || row.teachingCommissionTotalAmount || "",
    makeup_commission_total_amount:
      row.makeup_commission_total_amount || row.makeupCommissionTotalAmount || "",
    qa_commission_total_amount:
      row.qa_commission_total_amount || row.qaCommissionTotalAmount || "",
    subsidy_total_amount: row.subsidy_total_amount || row.subsidyTotalAmount || "",
    settlement_component_total_amount:
      row.settlement_component_total_amount || row.settlementComponentTotalAmount || "",
    component_to_revenue_ratio_percent:
      row.component_to_revenue_ratio_percent || row.componentToRevenueRatioPercent || "",
    statement_balance_total_amount:
      row.statement_balance_total_amount || row.statementBalanceTotalAmount || "",
    profit_teacher_balance_total_amount:
      row.profit_teacher_balance_total_amount || row.profitTeacherBalanceTotalAmount || "",
    teacher_balance_gap_amount:
      row.teacher_balance_gap_amount || row.teacherBalanceGapAmount || "",
    gross_profit_amount: row.gross_profit_amount || row.grossProfitAmount || "",
    total_expense_amount: row.total_expense_amount || row.totalExpenseAmount || "",
    teaching_business_expense_amount:
      row.teaching_business_expense_amount || row.teachingBusinessExpenseAmount || "",
    teaching_business_minus_component_amount:
      row.teaching_business_minus_component_amount ||
      row.teachingBusinessMinusComponentAmount ||
      "",
    net_profit_amount: row.net_profit_amount || row.netProfitAmount || "",
    dividend_rate_percent: row.dividend_rate_percent || row.dividendRatePercent || "",
    dividend_rate_source: row.dividend_rate_source || row.dividendRateSource || "",
    dividend_pool_amount: row.dividend_pool_amount || row.dividendPoolAmount || "",
    retained_profit_amount: row.retained_profit_amount || row.retainedProfitAmount || "",
    expense_parsed_total_amount:
      row.expense_parsed_total_amount || row.expenseParsedTotalAmount || "",
    expense_expression_row_count: Number(
      row.expense_expression_row_count || row.expenseExpressionRowCount || 0
    ),
    expense_unparsed_row_count: Number(
      row.expense_unparsed_row_count || row.expenseUnparsedRowCount || 0
    ),
    top_expense_categories:
      row.top_expense_categories || row.topExpenseCategories || "",
  };
}

function normalizeProfitSettlementDividendTeacherRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    rule_calc_mode: row.rule_calc_mode || row.ruleCalcMode || "",
    rule_display: row.rule_display || row.ruleDisplay || "",
    rule_effective_start_date:
      row.rule_effective_start_date || row.ruleEffectiveStartDate || "",
    rule_effective_end_date:
      row.rule_effective_end_date || row.ruleEffectiveEndDate || "",
    rule_revenue_share_ratio_percent:
      row.rule_revenue_share_ratio_percent || row.ruleRevenueShareRatioPercent || "",
    revenue_total_amount: row.revenue_total_amount || row.revenueTotalAmount || "",
    base_salary_amount: row.base_salary_amount || row.baseSalaryAmount || "",
    social_insurance_amount:
      row.social_insurance_amount || row.socialInsuranceAmount || "",
    housing_fund_amount: row.housing_fund_amount || row.housingFundAmount || "",
    teaching_commission_amount:
      row.teaching_commission_amount || row.teachingCommissionAmount || "",
    makeup_commission_amount:
      row.makeup_commission_amount || row.makeupCommissionAmount || "",
    qa_commission_amount: row.qa_commission_amount || row.qaCommissionAmount || "",
    subsidy_amount: row.subsidy_amount || row.subsidyAmount || "",
    component_total_amount: row.component_total_amount || row.componentTotalAmount || "",
    balance_amount_raw: row.balance_amount_raw || row.balanceAmountRaw || "",
    gross_amount: row.gross_amount || row.grossAmount || "",
    final_amount: row.final_amount || row.finalAmount || "",
    component_to_revenue_ratio_percent:
      row.component_to_revenue_ratio_percent || row.componentToRevenueRatioPercent || "",
    teaching_commission_ratio_percent:
      row.teaching_commission_ratio_percent || row.teachingCommissionRatioPercent || "",
    status: row.status || "",
    notes: row.notes || "",
  };
}

function normalizeSettlementReviewFollowupRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    priority: row.priority || "",
    resolution_status: row.resolution_status || row.resolutionStatus || "pending",
    followup_type: row.followup_type || row.followupType || "",
    readiness_status: row.readiness_status || row.readinessStatus || "",
    recommended_action: row.recommended_action || row.recommendedAction || "",
    next_check_focus: row.next_check_focus || row.nextCheckFocus || "",
    calendar_billable_cell_count: Number(
      row.calendar_billable_cell_count || row.calendarBillableCellCount || 0
    ),
    calendar_non_billable_cell_count: Number(
      row.calendar_non_billable_cell_count || row.calendarNonBillableCellCount || 0
    ),
    calendar_student_name_count: Number(
      row.calendar_student_name_count || row.calendarStudentNameCount || 0
    ),
    enrollment_student_name_count: Number(
      row.enrollment_student_name_count || row.enrollmentStudentNameCount || 0
    ),
    settlement_statement_present:
      row.settlement_statement_present ?? row.settlementStatementPresent ?? false,
    settlement_detail_row_count: Number(
      row.settlement_detail_row_count || row.settlementDetailRowCount || 0
    ),
    settlement_student_name_count: Number(
      row.settlement_student_name_count || row.settlementStudentNameCount || 0
    ),
    matched_student_name_count: Number(
      row.matched_student_name_count || row.matchedStudentNameCount || 0
    ),
    roster_assisted_matched_student_name_count: Number(
      row.roster_assisted_matched_student_name_count ||
        row.rosterAssistedMatchedStudentNameCount ||
        0
    ),
    statement_teaching_commission_amount:
      row.statement_teaching_commission_amount || row.statementTeachingCommissionAmount || "",
    statement_makeup_commission_amount:
      row.statement_makeup_commission_amount || row.statementMakeupCommissionAmount || "",
    reported_teaching_plus_makeup_amount:
      row.reported_teaching_plus_makeup_amount || row.reportedTeachingPlusMakeupAmount || "",
    detail_commission_total_amount:
      row.detail_commission_total_amount || row.detailCommissionTotalAmount || "",
    difference_vs_reported_teaching_commission:
      row.difference_vs_reported_teaching_commission ||
      row.differenceVsReportedTeachingCommission ||
      "",
    difference_vs_reported_teaching_plus_makeup:
      row.difference_vs_reported_teaching_plus_makeup ||
      row.differenceVsReportedTeachingPlusMakeup ||
      "",
    slot_summary_one_to_one_total:
      row.slot_summary_one_to_one_total || row.slotSummaryOneToOneTotal || "",
    slot_summary_makeup_total:
      row.slot_summary_makeup_total || row.slotSummaryMakeupTotal || "",
    slot_summary_free_total: row.slot_summary_free_total || row.slotSummaryFreeTotal || "",
    slot_summary_top_related_teachers: Array.isArray(row.slot_summary_top_related_teachers)
      ? row.slot_summary_top_related_teachers
      : Array.isArray(row.slotSummaryTopRelatedTeachers)
        ? row.slotSummaryTopRelatedTeachers
        : [],
    settlement_only_name_count: Number(
      row.settlement_only_name_count || row.settlementOnlyNameCount || 0
    ),
    settlement_only_name_samples: Array.isArray(row.settlement_only_name_samples)
      ? row.settlement_only_name_samples
      : Array.isArray(row.settlementOnlyNameSamples)
        ? row.settlementOnlyNameSamples
        : [],
    settlement_only_enrollment_supported_name_count: Number(
      row.settlement_only_enrollment_supported_name_count ||
        row.settlementOnlyEnrollmentSupportedNameCount ||
        0
    ),
    settlement_only_enrollment_supported_names: Array.isArray(
      row.settlement_only_enrollment_supported_names
    )
      ? row.settlement_only_enrollment_supported_names
      : Array.isArray(row.settlementOnlyEnrollmentSupportedNames)
        ? row.settlementOnlyEnrollmentSupportedNames
        : [],
    settlement_only_missing_from_schedule_source_name_count: Number(
      row.settlement_only_missing_from_schedule_source_name_count ||
        row.settlementOnlyMissingFromScheduleSourceNameCount ||
        0
    ),
    settlement_only_missing_from_schedule_source_names: Array.isArray(
      row.settlement_only_missing_from_schedule_source_names
    )
      ? row.settlement_only_missing_from_schedule_source_names
      : Array.isArray(row.settlementOnlyMissingFromScheduleSourceNames)
        ? row.settlementOnlyMissingFromScheduleSourceNames
        : [],
    cross_period_settlement_only_name_count: Number(
      row.cross_period_settlement_only_name_count ||
        row.crossPeriodSettlementOnlyNameCount ||
        0
    ),
    cross_period_settlement_only_names: Array.isArray(row.cross_period_settlement_only_names)
      ? row.cross_period_settlement_only_names
      : Array.isArray(row.crossPeriodSettlementOnlyNames)
        ? row.crossPeriodSettlementOnlyNames
        : [],
    cross_period_enrollment_supported_name_count: Number(
      row.cross_period_enrollment_supported_name_count ||
        row.crossPeriodEnrollmentSupportedNameCount ||
        0
    ),
    cross_period_enrollment_supported_names: Array.isArray(
      row.cross_period_enrollment_supported_names
    )
      ? row.cross_period_enrollment_supported_names
      : Array.isArray(row.crossPeriodEnrollmentSupportedNames)
        ? row.crossPeriodEnrollmentSupportedNames
        : [],
    cross_period_missing_from_schedule_source_name_count: Number(
      row.cross_period_missing_from_schedule_source_name_count ||
        row.crossPeriodMissingFromScheduleSourceNameCount ||
        0
    ),
    cross_period_missing_from_schedule_source_names: Array.isArray(
      row.cross_period_missing_from_schedule_source_names
    )
      ? row.cross_period_missing_from_schedule_source_names
      : Array.isArray(row.crossPeriodMissingFromScheduleSourceNames)
        ? row.crossPeriodMissingFromScheduleSourceNames
        : [],
    calendar_only_name_count: Number(row.calendar_only_name_count || row.calendarOnlyNameCount || 0),
    calendar_only_name_samples: Array.isArray(row.calendar_only_name_samples)
      ? row.calendar_only_name_samples
      : Array.isArray(row.calendarOnlyNameSamples)
        ? row.calendarOnlyNameSamples
        : [],
    sheet_kinds: Array.isArray(row.sheet_kinds)
      ? row.sheet_kinds
      : Array.isArray(row.sheetKinds)
        ? row.sheetKinds
        : [],
    bridge_review_flags: Array.isArray(row.bridge_review_flags)
      ? row.bridge_review_flags
      : Array.isArray(row.bridgeReviewFlags)
        ? row.bridgeReviewFlags
        : [],
    bridge_info_flags: Array.isArray(row.bridge_info_flags)
      ? row.bridge_info_flags
      : Array.isArray(row.bridgeInfoFlags)
        ? row.bridgeInfoFlags
        : [],
    reconciliation_review_flags: Array.isArray(row.reconciliation_review_flags)
      ? row.reconciliation_review_flags
      : Array.isArray(row.reconciliationReviewFlags)
        ? row.reconciliationReviewFlags
        : [],
    evidence_lines: Array.isArray(row.evidence_lines)
      ? row.evidence_lines
      : Array.isArray(row.evidenceLines)
        ? row.evidenceLines
        : [],
    detail_lines: Array.isArray(row.detail_lines)
      ? row.detail_lines
      : Array.isArray(row.detailLines)
        ? row.detailLines
        : [],
  };
}

function normalizeSettlementReviewFollowupDetailRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    followup_type: row.followup_type || row.followupType || "",
    detail_type: row.detail_type || row.detailType || "",
    subject_name: row.subject_name || row.subjectName || "",
    detail_value: row.detail_value || row.detailValue || "",
    detail_aux_value: row.detail_aux_value || row.detailAuxValue || "",
    detail_flag: row.detail_flag || row.detailFlag || "",
    note: row.note || "",
  };
}

function isSummerManualResolutionTerminal(status) {
  return SUMMER_MANUAL_TERMINAL_STATUSES.has(String(status || "").trim());
}

function normalizeSummerBigClassManualResolutionRow(row) {
  const candidateTeacherOptions = parseLooseJsonValue(
    row.candidate_teacher_options_json || row.candidateTeacherOptionsJson,
    []
  );
  const suggestedResolutionPayload = parseLooseJsonValue(
    row.suggested_resolution_payload_json || row.suggestedResolutionPayloadJson,
    null
  );
  const candidateResolutionPayloads = parseLooseJsonValue(
    row.candidate_resolution_payloads_json || row.candidateResolutionPayloadsJson,
    []
  );
  return {
    source_sheet: row.source_sheet || row.sourceSheet || "",
    class_group_name: row.class_group_name || row.classGroupName || "",
    subject_name: row.subject_name || row.subjectName || "",
    time_range_text: row.time_range_text || row.timeRangeText || "",
    grade_band_name: row.grade_band_name || row.gradeBandName || "",
    unresolved_row_count: Number(
      row.unresolved_row_count || row.unresolvedRowCount || 0
    ),
    source_row_samples: parseLooseStringArray(
      row.source_row_samples_json || row.sourceRowSamplesJson
    ),
    course_date_samples: parseLooseStringArray(
      row.course_date_samples_json || row.courseDateSamplesJson
    ),
    recommended_resolution:
      row.recommended_resolution || row.recommendedResolution || "",
    suggested_resolved_subject_name:
      row.suggested_resolved_subject_name || row.suggestedResolvedSubjectName || "",
    suggested_teacher_names: parseLooseStringArray(
      row.suggested_teacher_names_json || row.suggestedTeacherNamesJson
    ),
    candidate_teacher_options: Array.isArray(candidateTeacherOptions)
      ? candidateTeacherOptions
          .filter((item) => Array.isArray(item))
          .map((item) =>
            item.map((teacherName) => String(teacherName).trim()).filter(Boolean)
          )
      : [],
    resolution_requirement_summary:
      row.resolution_requirement_summary || row.resolutionRequirementSummary || "",
    suggested_resolution_payload:
      suggestedResolutionPayload &&
      typeof suggestedResolutionPayload === "object" &&
      !Array.isArray(suggestedResolutionPayload)
        ? suggestedResolutionPayload
        : null,
    candidate_resolution_payloads: Array.isArray(candidateResolutionPayloads)
      ? candidateResolutionPayloads.filter(
          (item) => item && typeof item === "object" && !Array.isArray(item)
        )
      : [],
    resolved_subject_name:
      row.resolved_subject_name || row.resolvedSubjectName || "",
    resolved_teacher_names: parseLooseStringArray(
      row.resolved_teacher_names_json || row.resolvedTeacherNamesJson
    ),
    resolution_status: row.resolution_status || row.resolutionStatus || "",
    notes: row.notes || "",
  };
}

function normalizeSummerBigClassRoomOccupancyReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptySummerBigClassRoomOccupancyReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const roomCounts = Array.isArray(rawSummary.room_counts)
    ? rawSummary.room_counts
    : Array.isArray(rawSummary.roomCounts)
      ? rawSummary.roomCounts
      : [];

  return {
    status: report.status || "",
    summary: {
      session_count: Number(rawSummary.session_count || rawSummary.sessionCount || 0),
      occupancy_row_count: Number(
        rawSummary.occupancy_row_count || rawSummary.occupancyRowCount || 0
      ),
      resolved_row_count: Number(
        rawSummary.resolved_row_count || rawSummary.resolvedRowCount || 0
      ),
      unresolved_row_count: Number(
        rawSummary.unresolved_row_count || rawSummary.unresolvedRowCount || 0
      ),
      manual_resolution_group_count: Number(
        rawSummary.manual_resolution_group_count ||
          rawSummary.manualResolutionGroupCount ||
          0
      ),
      manual_resolution_confirmed_group_count: Number(
        rawSummary.manual_resolution_confirmed_group_count ||
          rawSummary.manualResolutionConfirmedGroupCount ||
          0
      ),
      manual_resolution_pending_group_count: Number(
        rawSummary.manual_resolution_pending_group_count ||
          rawSummary.manualResolutionPendingGroupCount ||
          0
      ),
      date_correction_applied_count: Number(
        rawSummary.date_correction_applied_count ||
          rawSummary.dateCorrectionAppliedCount ||
          0
      ),
      room_counts: roomCounts.map((item) => ({
        classroom_name: item.classroom_name || item.classroomName || "",
        count: Number(item.count || 0),
      })),
    },
    occupancy_rows: Array.isArray(report.occupancy_rows)
      ? report.occupancy_rows.map(normalizeSummerBigClassRoomOccupancyRow)
      : Array.isArray(report.occupancyRows)
        ? report.occupancyRows.map(normalizeSummerBigClassRoomOccupancyRow)
        : [],
    unresolved_rows: Array.isArray(report.unresolved_rows)
      ? report.unresolved_rows.map(normalizeSummerBigClassRoomOccupancyRow)
      : Array.isArray(report.unresolvedRows)
        ? report.unresolvedRows.map(normalizeSummerBigClassRoomOccupancyRow)
        : [],
    manual_resolution_rows: Array.isArray(report.manual_resolution_rows)
      ? report.manual_resolution_rows.map(normalizeSummerBigClassManualResolutionRow)
      : Array.isArray(report.manualResolutionRows)
        ? report.manualResolutionRows.map(normalizeSummerBigClassManualResolutionRow)
        : [],
  };
}

function normalizeSummerBigClassRoomOccupancyRow(row) {
  return {
    course_date: row.course_date || row.courseDate || "",
    class_group_name: row.class_group_name || row.classGroupName || "",
    grade_band_name: row.grade_band_name || row.gradeBandName || "",
    subject_name: row.subject_name || row.subjectName || "",
    time_range_text: row.time_range_text || row.timeRangeText || "",
    source_sheet: row.source_sheet || row.sourceSheet || "",
    source_row: row.source_row || row.sourceRow || "",
    teacher_names: parseLooseStringArray(row.teacher_names || row.teacherNames),
    classroom_name: row.classroom_name || row.classroomName || "",
    occupancy_kind: row.occupancy_kind || row.occupancyKind || "",
    resolution_status: row.resolution_status || row.resolutionStatus || "",
    date_correction_applied: parseBooleanLoose(
      row.date_correction_applied ?? row.dateCorrectionApplied,
      false
    ),
    notes: row.notes || "",
  };
}

function normalizeSummerScheduleSettlementReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptySummerScheduleSettlementReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const teacherRows = Array.isArray(report.teacher_rows)
    ? report.teacher_rows
    : Array.isArray(report.teacherRows)
      ? report.teacherRows
      : [];
  const classRows = Array.isArray(report.class_rows)
    ? report.class_rows
    : Array.isArray(report.classRows)
      ? report.classRows
      : [];

  return {
    status: report.status || "",
    summary: {
      teacher_count: Number(rawSummary.teacher_count || rawSummary.teacherCount || 0),
      class_count: Number(rawSummary.class_count || rawSummary.classCount || 0),
      teacher_schedule_row_count: Number(
        rawSummary.teacher_schedule_row_count ||
          rawSummary.teacherScheduleRowCount ||
          0
      ),
      class_session_count: Number(
        rawSummary.class_session_count || rawSummary.classSessionCount || 0
      ),
      excluded_teacher_count: Number(
        rawSummary.excluded_teacher_count ||
          rawSummary.excludedTeacherCount ||
          0
      ),
      excluded_class_count: Number(
        rawSummary.excluded_class_count ||
          rawSummary.excludedClassCount ||
          0
      ),
      excluded_session_count: Number(
        rawSummary.excluded_session_count ||
          rawSummary.excludedSessionCount ||
          0
      ),
      missing_rule_teacher_count: Number(
        rawSummary.missing_rule_teacher_count ||
          rawSummary.missingRuleTeacherCount ||
          0
      ),
      missing_revenue_class_count: Number(
        rawSummary.missing_revenue_class_count ||
          rawSummary.missingRevenueClassCount ||
          0
      ),
      teachers_over_daily_cap_count: Number(
        rawSummary.teachers_over_daily_cap_count ||
          rawSummary.teachersOverDailyCapCount ||
          0
      ),
      teachers_under_daily_target_count: Number(
        rawSummary.teachers_under_daily_target_count ||
          rawSummary.teachersUnderDailyTargetCount ||
          0
      ),
      teacher_missing_to_target_slot_total: Number(
        rawSummary.teacher_missing_to_target_slot_total ||
          rawSummary.teacherMissingToTargetSlotTotal ||
          0
      ),
      teachers_with_evening_violation_count: Number(
        rawSummary.teachers_with_evening_violation_count ||
          rawSummary.teachersWithEveningViolationCount ||
          0
      ),
      classes_below_target_count: Number(
        rawSummary.classes_below_target_count ||
          rawSummary.classesBelowTargetCount ||
          0
      ),
      filled_revenue_class_count: Number(
        rawSummary.filled_revenue_class_count ||
          rawSummary.filledRevenueClassCount ||
          0
      ),
      projected_amount_total:
        rawSummary.projected_amount_total || rawSummary.projectedAmountTotal || "",
      estimated_revenue_total:
        rawSummary.estimated_revenue_total || rawSummary.estimatedRevenueTotal || "",
      suggested_projected_amount_total:
        rawSummary.suggested_projected_amount_total ||
        rawSummary.suggestedProjectedAmountTotal ||
        "",
      suggested_estimated_revenue_total:
        rawSummary.suggested_estimated_revenue_total ||
        rawSummary.suggestedEstimatedRevenueTotal ||
        "",
      mixed_projected_amount_total:
        rawSummary.mixed_projected_amount_total ||
        rawSummary.mixedProjectedAmountTotal ||
        "",
      class_estimated_revenue_total:
        rawSummary.class_estimated_revenue_total ||
        rawSummary.classEstimatedRevenueTotal ||
        "",
      class_suggested_estimated_revenue_total:
        rawSummary.class_suggested_estimated_revenue_total ||
        rawSummary.classSuggestedEstimatedRevenueTotal ||
        "",
      class_mixed_estimated_revenue_total:
        rawSummary.class_mixed_estimated_revenue_total ||
        rawSummary.classMixedEstimatedRevenueTotal ||
        "",
      class_gross_margin_total:
        rawSummary.class_gross_margin_total ||
        rawSummary.classGrossMarginTotal ||
        "",
      class_mixed_gross_margin_total:
        rawSummary.class_mixed_gross_margin_total ||
        rawSummary.classMixedGrossMarginTotal ||
        "",
      actual_projection_supported_class_count: Number(
        rawSummary.actual_projection_supported_class_count ||
          rawSummary.actualProjectionSupportedClassCount ||
          0
      ),
      mixed_projection_supported_class_count: Number(
        rawSummary.mixed_projection_supported_class_count ||
          rawSummary.mixedProjectionSupportedClassCount ||
          0
      ),
      suggested_revenue_coverage_class_count: Number(
        rawSummary.suggested_revenue_coverage_class_count ||
          rawSummary.suggestedRevenueCoverageClassCount ||
          0
      ),
      revenue_template_row_count: Number(
        rawSummary.revenue_template_row_count ||
          rawSummary.revenueTemplateRowCount ||
          0
      ),
    },
    teacher_rows: teacherRows.map((row) => ({
      teacher_name: row.teacher_name || row.teacherName || "",
      subject: row.subject || "",
      status: row.status || "",
      class_count: Number(row.class_count || row.classCount || 0),
      schedule_row_count: Number(
        row.schedule_row_count || row.scheduleRowCount || 0
      ),
      teaching_date_count: Number(
        row.teaching_date_count || row.teachingDateCount || 0
      ),
      max_lessons_per_day: Number(
        row.max_lessons_per_day || row.maxLessonsPerDay || 0
      ),
      target_lessons_per_day: Number(
        row.target_lessons_per_day || row.targetLessonsPerDay || 0
      ),
      max_daily_slot_count: Number(
        row.max_daily_slot_count || row.maxDailySlotCount || 0
      ),
      days_over_daily_cap_count: Number(
        row.days_over_daily_cap_count || row.daysOverDailyCapCount || 0
      ),
      over_cap_date_samples: Array.isArray(row.over_cap_date_samples)
        ? row.over_cap_date_samples
        : Array.isArray(row.overCapDateSamples)
          ? row.overCapDateSamples
          : [],
      under_target_teaching_date_count: Number(
        row.under_target_teaching_date_count ||
          row.underTargetTeachingDateCount ||
          0
      ),
      under_target_date_samples: Array.isArray(row.under_target_date_samples)
        ? row.under_target_date_samples
        : Array.isArray(row.underTargetDateSamples)
          ? row.underTargetDateSamples
          : [],
      missing_to_target_slot_count: Number(
        row.missing_to_target_slot_count ||
          row.missingToTargetSlotCount ||
          0
      ),
      no_evening_classes: row.no_evening_classes || row.noEveningClasses || "",
      evening_slot_count: Number(
        row.evening_slot_count || row.eveningSlotCount || 0
      ),
      evening_violation_count: Number(
        row.evening_violation_count || row.eveningViolationCount || 0
      ),
      missing_rule_row_count: Number(
        row.missing_rule_row_count || row.missingRuleRowCount || 0
      ),
      revenue_input_required_row_count: Number(
        row.revenue_input_required_row_count ||
          row.revenueInputRequiredRowCount ||
          0
      ),
      incomplete_rule_row_count: Number(
        row.incomplete_rule_row_count || row.incompleteRuleRowCount || 0
      ),
      projectable_row_count: Number(
        row.projectable_row_count || row.projectableRowCount || 0
      ),
      estimated_revenue_total:
        row.estimated_revenue_total || row.estimatedRevenueTotal || "",
      projected_amount_total:
        row.projected_amount_total || row.projectedAmountTotal || "",
      filled_class_count: Number(
        row.filled_class_count || row.filledClassCount || 0
      ),
      suggested_estimated_revenue_total:
        row.suggested_estimated_revenue_total ||
        row.suggestedEstimatedRevenueTotal ||
        "",
      suggested_projected_amount_total:
        row.suggested_projected_amount_total ||
        row.suggestedProjectedAmountTotal ||
        "",
      mixed_estimated_revenue_total:
        row.mixed_estimated_revenue_total ||
        row.mixedEstimatedRevenueTotal ||
        "",
      mixed_projected_amount_total:
        row.mixed_projected_amount_total ||
        row.mixedProjectedAmountTotal ||
        "",
      mixed_projected_amount_delta_vs_suggested:
        row.mixed_projected_amount_delta_vs_suggested ||
        row.mixedProjectedAmountDeltaVsSuggested ||
        "",
      mixed_projectable_row_count: Number(
        row.mixed_projectable_row_count || row.mixedProjectableRowCount || 0
      ),
      projection_ratio: row.projection_ratio || row.projectionRatio || "",
      projection_ratio_source:
        row.projection_ratio_source || row.projectionRatioSource || "",
      fixed_classroom_name:
        row.fixed_classroom_name || row.fixedClassroomName || "",
      notes: Array.isArray(row.notes) ? row.notes : [],
    })),
    class_rows: classRows.map((row) => ({
      class_name: row.class_name || row.className || "",
      subject: row.subject || "",
      grade: row.grade || "",
      course_type: row.course_type || row.courseType || "",
      planned_size: row.planned_size || row.plannedSize || "",
      current_size: row.current_size || row.currentSize || "",
      teacher_names: parseLooseStringArray(row.teacher_names || row.teacherNames),
      teacher_names_text:
        row.teacher_names_text || row.teacherNamesText || "",
      teacher_count: Number(row.teacher_count || row.teacherCount || 0),
      teaching_session_count: Number(
        row.teaching_session_count || row.teachingSessionCount || 0
      ),
      teaching_date_count: Number(
        row.teaching_date_count || row.teachingDateCount || 0
      ),
      target_teaching_session_count: Number(
        row.target_teaching_session_count ||
          row.targetTeachingSessionCount ||
          0
      ),
      missing_to_target_session_count: Number(
        row.missing_to_target_session_count ||
          row.missingToTargetSessionCount ||
          0
      ),
      estimated_session_revenue:
        row.estimated_session_revenue || row.estimatedSessionRevenue || "",
      actual_class_estimated_revenue_total:
        row.actual_class_estimated_revenue_total ||
        row.actualClassEstimatedRevenueTotal ||
        "",
      estimated_revenue_source:
        row.estimated_revenue_source || row.estimatedRevenueSource || "",
      suggested_unit_fee:
        row.suggested_unit_fee || row.suggestedUnitFee || "",
      suggested_session_revenue:
        row.suggested_session_revenue || row.suggestedSessionRevenue || "",
      suggested_class_estimated_revenue_total:
        row.suggested_class_estimated_revenue_total ||
        row.suggestedClassEstimatedRevenueTotal ||
        "",
      suggested_revenue_source:
        row.suggested_revenue_source || row.suggestedRevenueSource || "",
      suggestion_sample_count: Number(
        row.suggestion_sample_count || row.suggestionSampleCount || 0
      ),
      mixed_class_estimated_revenue_total:
        row.mixed_class_estimated_revenue_total ||
        row.mixedClassEstimatedRevenueTotal ||
        "",
      actual_projected_amount_total:
        row.actual_projected_amount_total ||
        row.actualProjectedAmountTotal ||
        "",
      mixed_projected_amount_total:
        row.mixed_projected_amount_total ||
        row.mixedProjectedAmountTotal ||
        "",
      actual_gross_margin_total:
        row.actual_gross_margin_total || row.actualGrossMarginTotal || "",
      mixed_gross_margin_total:
        row.mixed_gross_margin_total || row.mixedGrossMarginTotal || "",
      actual_projection_supported_teacher_count: Number(
        row.actual_projection_supported_teacher_count ||
          row.actualProjectionSupportedTeacherCount ||
          0
      ),
      mixed_projection_supported_teacher_count: Number(
        row.mixed_projection_supported_teacher_count ||
          row.mixedProjectionSupportedTeacherCount ||
          0
      ),
      resolution_status: row.resolution_status || row.resolutionStatus || "",
      coverage_status: row.coverage_status || row.coverageStatus || "",
      missing_rule_teacher_count: Number(
        row.missing_rule_teacher_count || row.missingRuleTeacherCount || 0
      ),
      revenue_input_required_teacher_count: Number(
        row.revenue_input_required_teacher_count ||
          row.revenueInputRequiredTeacherCount ||
          0
      ),
      incomplete_rule_teacher_count: Number(
        row.incomplete_rule_teacher_count ||
          row.incompleteRuleTeacherCount ||
          0
      ),
      projectable_teacher_count: Number(
        row.projectable_teacher_count || row.projectableTeacherCount || 0
      ),
      notes: Array.isArray(row.notes) ? row.notes : [],
    })),
    notes: Array.isArray(report.notes) ? report.notes : [],
  };
}

function normalizeScheduleInputProfileReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleInputProfileReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const rawRequestSummary =
    report.request_summary && typeof report.request_summary === "object"
      ? report.request_summary
      : report.requestSummary && typeof report.requestSummary === "object"
        ? report.requestSummary
        : {};
  const rawCalendarSummary =
    report.calendar_summary && typeof report.calendar_summary === "object"
      ? report.calendar_summary
      : report.calendarSummary && typeof report.calendarSummary === "object"
        ? report.calendarSummary
        : {};
  const rawEnrollmentSummary =
    report.enrollment_summary && typeof report.enrollment_summary === "object"
      ? report.enrollment_summary
      : report.enrollmentSummary && typeof report.enrollmentSummary === "object"
        ? report.enrollmentSummary
        : {};
  const rawTransferSummary =
    report.transfer_summary && typeof report.transfer_summary === "object"
      ? report.transfer_summary
      : report.transferSummary && typeof report.transferSummary === "object"
        ? report.transferSummary
        : {};
  const rawTeachingPlanSummary =
    report.teaching_plan_summary && typeof report.teaching_plan_summary === "object"
      ? report.teaching_plan_summary
      : report.teachingPlanSummary && typeof report.teachingPlanSummary === "object"
        ? report.teachingPlanSummary
        : {};
  const rawSummerGroupSummary =
    report.summer_group_summary && typeof report.summer_group_summary === "object"
      ? report.summer_group_summary
      : report.summerGroupSummary && typeof report.summerGroupSummary === "object"
        ? report.summerGroupSummary
        : {};

  return {
    status: report.status || "",
    summary: {
      course_enrollment_count: Number(
        rawSummary.course_enrollment_count || rawSummary.courseEnrollmentCount || 0
      ),
      schedule_request_count: Number(
        rawSummary.schedule_request_count || rawSummary.scheduleRequestCount || 0
      ),
      student_transfer_count: Number(
        rawSummary.student_transfer_count || rawSummary.studentTransferCount || 0
      ),
      calendar_cell_count: Number(
        rawSummary.calendar_cell_count || rawSummary.calendarCellCount || 0
      ),
      teaching_plan_row_count: Number(
        rawSummary.teaching_plan_row_count || rawSummary.teachingPlanRowCount || 0
      ),
      summer_group_row_count: Number(
        rawSummary.summer_group_row_count || rawSummary.summerGroupRowCount || 0
      ),
      calendar_teacher_count: Number(
        rawSummary.calendar_teacher_count || rawSummary.calendarTeacherCount || 0
      ),
      calendar_distinct_course_date_count: Number(
        rawSummary.calendar_distinct_course_date_count ||
          rawSummary.calendarDistinctCourseDateCount ||
          0
      ),
      calendar_date_range_start:
        rawSummary.calendar_date_range_start || rawSummary.calendarDateRangeStart || "",
      calendar_date_range_end:
        rawSummary.calendar_date_range_end || rawSummary.calendarDateRangeEnd || "",
    },
    request_summary: {
      request_type_counts: normalizeKeyCountRows(
        rawRequestSummary.request_type_counts || rawRequestSummary.requestTypeCounts,
        "request_type",
        "requestType"
      ),
      preferred_time_present_count: Number(
        rawRequestSummary.preferred_time_present_count ||
          rawRequestSummary.preferredTimePresentCount ||
          0
      ),
      target_teacher_present_count: Number(
        rawRequestSummary.target_teacher_present_count ||
          rawRequestSummary.targetTeacherPresentCount ||
          0
      ),
      distinct_student_count: Number(
        rawRequestSummary.distinct_student_count ||
          rawRequestSummary.distinctStudentCount ||
          0
      ),
      top_target_teachers: normalizeKeyCountRows(
        rawRequestSummary.top_target_teachers || rawRequestSummary.topTargetTeachers,
        "teacher_name",
        "teacherName"
      ),
      top_subject_scopes: normalizeKeyCountRows(
        rawRequestSummary.top_subject_scopes || rawRequestSummary.topSubjectScopes,
        "subject_scope_text",
        "subjectScopeText"
      ),
    },
    calendar_summary: {
      teacher_count: Number(rawCalendarSummary.teacher_count || rawCalendarSummary.teacherCount || 0),
      distinct_course_date_count: Number(
        rawCalendarSummary.distinct_course_date_count ||
          rawCalendarSummary.distinctCourseDateCount ||
          0
      ),
      date_range_start:
        rawCalendarSummary.date_range_start || rawCalendarSummary.dateRangeStart || "",
      date_range_end:
        rawCalendarSummary.date_range_end || rawCalendarSummary.dateRangeEnd || "",
      distinct_student_name_candidate_count: Number(
        rawCalendarSummary.distinct_student_name_candidate_count ||
          rawCalendarSummary.distinctStudentNameCandidateCount ||
          0
      ),
      course_mode_counts: normalizeKeyCountRows(
        rawCalendarSummary.course_mode_counts || rawCalendarSummary.courseModeCounts,
        "course_mode_hint",
        "courseModeHint"
      ),
      session_tag_counts: normalizeKeyCountRows(
        rawCalendarSummary.session_tag_counts || rawCalendarSummary.sessionTagCounts,
        "session_tag",
        "sessionTag"
      ),
      room_hint_counts: normalizeKeyCountRows(
        rawCalendarSummary.room_hint_counts || rawCalendarSummary.roomHintCounts,
        "room_hint",
        "roomHint"
      ),
      time_range_counts: normalizeKeyCountRows(
        rawCalendarSummary.time_range_counts || rawCalendarSummary.timeRangeCounts,
        "time_range_text",
        "timeRangeText"
      ),
      weekday_counts: normalizeKeyCountRows(
        rawCalendarSummary.weekday_counts || rawCalendarSummary.weekdayCounts,
        "weekday_label",
        "weekdayLabel"
      ),
      month_sheet_counts: normalizeKeyCountRows(
        rawCalendarSummary.month_sheet_counts || rawCalendarSummary.monthSheetCounts,
        "sheet_name",
        "sheetName"
      ),
    },
    enrollment_summary: {
      teacher_counts: normalizeKeyCountRows(
        rawEnrollmentSummary.teacher_counts || rawEnrollmentSummary.teacherCounts,
        "teacher_name",
        "teacherName"
      ),
      subject_counts: normalizeKeyCountRows(
        rawEnrollmentSummary.subject_counts || rawEnrollmentSummary.subjectCounts,
        "subject_text",
        "subjectText"
      ),
      grade_counts: normalizeKeyCountRows(
        rawEnrollmentSummary.grade_counts || rawEnrollmentSummary.gradeCounts,
        "grade_text",
        "gradeText"
      ),
      status_counts: normalizeKeyCountRows(
        rawEnrollmentSummary.status_counts || rawEnrollmentSummary.statusCounts,
        "status_hint",
        "statusHint"
      ),
      distinct_student_count: Number(
        rawEnrollmentSummary.distinct_student_count ||
          rawEnrollmentSummary.distinctStudentCount ||
          0
      ),
      group_peer_name_count: Number(
        rawEnrollmentSummary.group_peer_name_count ||
          rawEnrollmentSummary.groupPeerNameCount ||
          0
      ),
    },
    transfer_summary: {
      subject_counts: normalizeKeyCountRows(
        rawTransferSummary.subject_counts || rawTransferSummary.subjectCounts,
        "subject_text",
        "subjectText"
      ),
      status_counts: normalizeKeyCountRows(
        rawTransferSummary.status_counts || rawTransferSummary.statusCounts,
        "transfer_status",
        "transferStatus"
      ),
      target_class_group_counts: normalizeKeyCountRows(
        rawTransferSummary.target_class_group_counts ||
          rawTransferSummary.targetClassGroupCounts,
        "class_group_name",
        "classGroupName"
      ),
      top_reasons: normalizeKeyCountRows(
        rawTransferSummary.top_reasons || rawTransferSummary.topReasons,
        "reason",
        "reason"
      ),
    },
    teaching_plan_summary: {
      teacher_counts: normalizeKeyCountRows(
        rawTeachingPlanSummary.teacher_counts || rawTeachingPlanSummary.teacherCounts,
        "teacher_name",
        "teacherName"
      ),
      sheet_counts: normalizeKeyCountRows(
        rawTeachingPlanSummary.sheet_counts || rawTeachingPlanSummary.sheetCounts,
        "sheet_name",
        "sheetName"
      ),
      top_titles: normalizeKeyCountRows(
        rawTeachingPlanSummary.top_titles || rawTeachingPlanSummary.topTitles,
        "title",
        "title"
      ),
    },
    summer_group_summary: {
      sheet_counts: normalizeKeyCountRows(
        rawSummerGroupSummary.sheet_counts || rawSummerGroupSummary.sheetCounts,
        "sheet_name",
        "sheetName"
      ),
      distinct_student_count: Number(
        rawSummerGroupSummary.distinct_student_count ||
          rawSummerGroupSummary.distinctStudentCount ||
          0
      ),
      row_size_counts: normalizeKeyCountRows(
        rawSummerGroupSummary.row_size_counts || rawSummerGroupSummary.rowSizeCounts,
        "group_size",
        "groupSize"
      ),
    },
    teacher_profiles: Array.isArray(report.teacher_profiles)
      ? report.teacher_profiles.map(normalizeScheduleInputTeacherProfile)
      : Array.isArray(report.teacherProfiles)
        ? report.teacherProfiles.map(normalizeScheduleInputTeacherProfile)
        : [],
  };
}

function normalizeKeyCountRows(rows, snakeKey, camelKey) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row) => ({
    [snakeKey]: row?.[snakeKey] || row?.[camelKey] || "",
    count: Number(row?.count || 0),
  }));
}

function normalizeScheduleInputTeacherProfile(row) {
  return {
    teacher_name: row.teacher_name || row.teacherName || "",
    calendar_cell_count: Number(row.calendar_cell_count || row.calendarCellCount || 0),
    calendar_billable_cell_count: Number(
      row.calendar_billable_cell_count || row.calendarBillableCellCount || 0
    ),
    calendar_non_billable_cell_count: Number(
      row.calendar_non_billable_cell_count || row.calendarNonBillableCellCount || 0
    ),
    calendar_distinct_course_date_count: Number(
      row.calendar_distinct_course_date_count ||
        row.calendarDistinctCourseDateCount ||
        0
    ),
    calendar_name_candidate_count: Number(
      row.calendar_name_candidate_count || row.calendarNameCandidateCount || 0
    ),
    enrollment_row_count: Number(row.enrollment_row_count || row.enrollmentRowCount || 0),
    request_targeted_count: Number(
      row.request_targeted_count || row.requestTargetedCount || 0
    ),
    teaching_plan_row_count: Number(
      row.teaching_plan_row_count || row.teachingPlanRowCount || 0
    ),
  };
}

function normalizeScheduleDraftImportReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftImportReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      student_row_count: Number(rawSummary.student_row_count || rawSummary.studentRowCount || 0),
      class_group_row_count: Number(
        rawSummary.class_group_row_count || rawSummary.classGroupRowCount || 0
      ),
      demand_row_count: Number(rawSummary.demand_row_count || rawSummary.demandRowCount || 0),
      teacher_schedule_row_count: Number(
        rawSummary.teacher_schedule_row_count || rawSummary.teacherScheduleRowCount || 0
      ),
      regular_class_group_count: Number(
        rawSummary.regular_class_group_count || rawSummary.regularClassGroupCount || 0
      ),
      summer_class_group_count: Number(
        rawSummary.summer_class_group_count || rawSummary.summerClassGroupCount || 0
      ),
      legacy_class_group_count: Number(
        rawSummary.legacy_class_group_count || rawSummary.legacyClassGroupCount || 0
      ),
      request_demand_count: Number(
        rawSummary.request_demand_count || rawSummary.requestDemandCount || 0
      ),
      calendar_schedule_row_count: Number(
        rawSummary.calendar_schedule_row_count || rawSummary.calendarScheduleRowCount || 0
      ),
      summer_schedule_row_count: Number(
        rawSummary.summer_schedule_row_count || rawSummary.summerScheduleRowCount || 0
      ),
      synthetic_schedule_class_name_count: Number(
        rawSummary.synthetic_schedule_class_name_count ||
          rawSummary.syntheticScheduleClassNameCount ||
          0
      ),
      schedule_missing_classroom_count: Number(
        rawSummary.schedule_missing_classroom_count ||
          rawSummary.scheduleMissingClassroomCount ||
          0
      ),
      multi_class_student_count: Number(
        rawSummary.multi_class_student_count || rawSummary.multiClassStudentCount || 0
      ),
      unresolved_teacher_alias_count: Number(
        rawSummary.unresolved_teacher_alias_count ||
          rawSummary.unresolvedTeacherAliasCount ||
          0
      ),
      inactive_teacher_reference_count: Number(
        rawSummary.inactive_teacher_reference_count ||
          rawSummary.inactiveTeacherReferenceCount ||
          0
      ),
      demand_estimated_revenue_filled_count: Number(
        rawSummary.demand_estimated_revenue_filled_count ||
          rawSummary.demandEstimatedRevenueFilledCount ||
          0
      ),
      demand_estimated_revenue_blank_count: Number(
        rawSummary.demand_estimated_revenue_blank_count ||
          rawSummary.demandEstimatedRevenueBlankCount ||
          0
      ),
    },
    unresolved_teacher_aliases: Array.isArray(report.unresolved_teacher_aliases)
      ? report.unresolved_teacher_aliases.map((item) => ({
          raw_teacher_name: item.raw_teacher_name || item.rawTeacherName || "",
          count: Number(item.count || 0),
        }))
      : Array.isArray(report.unresolvedTeacherAliases)
        ? report.unresolvedTeacherAliases.map((item) => ({
            raw_teacher_name: item.raw_teacher_name || item.rawTeacherName || "",
            count: Number(item.count || 0),
          }))
        : [],
    outputs: report.outputs && typeof report.outputs === "object" ? report.outputs : {},
  };
}

function normalizeScheduleDraftReviewReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftReviewReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const teacherCounts = Array.isArray(rawSummary.teacher_counts)
    ? rawSummary.teacher_counts
    : Array.isArray(rawSummary.teacherCounts)
      ? rawSummary.teacherCounts
      : [];
  const issueTypeCounts = Array.isArray(rawSummary.issue_type_counts)
    ? rawSummary.issue_type_counts
    : Array.isArray(rawSummary.issueTypeCounts)
      ? rawSummary.issueTypeCounts
      : [];
  const reviewRows = Array.isArray(report.review_rows)
    ? report.review_rows
    : Array.isArray(report.reviewRows)
      ? report.reviewRows
      : [];

  return {
    status: report.status || "",
    summary: {
      row_count: Number(rawSummary.row_count || rawSummary.rowCount || 0),
      unresolved_row_count: Number(
        rawSummary.unresolved_row_count || rawSummary.unresolvedRowCount || 0
      ),
      draft_class_name_count: Number(
        rawSummary.draft_class_name_count || rawSummary.draftClassNameCount || 0
      ),
      missing_classroom_count: Number(
        rawSummary.missing_classroom_count || rawSummary.missingClassroomCount || 0
      ),
      both_issue_count: Number(
        rawSummary.both_issue_count || rawSummary.bothIssueCount || 0
      ),
      suggested_class_name_count: Number(
        rawSummary.suggested_class_name_count || rawSummary.suggestedClassNameCount || 0
      ),
      suggested_classroom_count: Number(
        rawSummary.suggested_classroom_count || rawSummary.suggestedClassroomCount || 0
      ),
      teacher_counts: teacherCounts.map((item) => ({
        teacher_name: item.teacher_name || item.teacherName || "",
        count: Number(item.count || 0),
      })),
      issue_type_counts: issueTypeCounts.map((item) => ({
        issue_type: item.issue_type || item.issueType || "",
        count: Number(item.count || 0),
      })),
    },
    review_rows: reviewRows.map((row) => ({
      teacher_name: row.teacher_name || row.teacherName || "",
      course_date: row.course_date || row.courseDate || "",
      start_time: row.start_time || row.startTime || "",
      end_time: row.end_time || row.endTime || "",
      current_class_name: row.current_class_name || row.currentClassName || "",
      current_classroom_name:
        row.current_classroom_name || row.currentClassroomName || "",
      issue_flags: row.issue_flags || row.issueFlags || "",
      source_notes: row.source_notes || row.sourceNotes || "",
      suggested_class_name: row.suggested_class_name || row.suggestedClassName || "",
      suggested_classroom_name:
        row.suggested_classroom_name || row.suggestedClassroomName || "",
      suggestion_basis: row.suggestion_basis || row.suggestionBasis || "",
      resolution_status: row.resolution_status || row.resolutionStatus || "",
      resolved_class_name: row.resolved_class_name || row.resolvedClassName || "",
      resolved_classroom_name:
        row.resolved_classroom_name || row.resolvedClassroomName || "",
      owner_name: row.owner_name || row.ownerName || "",
      decision_summary: row.decision_summary || row.decisionSummary || "",
      resolved_by_name: row.resolved_by_name || row.resolvedByName || "",
      resolved_at: row.resolved_at || row.resolvedAt || "",
      notes: row.notes || "",
    })),
  };
}

function normalizeScheduleDraftReviewBulkCandidatesReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftReviewBulkCandidatesReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const actionCounts = Array.isArray(rawSummary.action_counts)
    ? rawSummary.action_counts
    : Array.isArray(rawSummary.actionCounts)
      ? rawSummary.actionCounts
      : [];
  const teacherCounts = Array.isArray(rawSummary.teacher_counts)
    ? rawSummary.teacher_counts
    : Array.isArray(rawSummary.teacherCounts)
      ? rawSummary.teacherCounts
      : [];
  const confirmStatusCounts = Array.isArray(rawSummary.confirm_status_counts)
    ? rawSummary.confirm_status_counts
    : Array.isArray(rawSummary.confirmStatusCounts)
      ? rawSummary.confirmStatusCounts
      : [];
  const candidateRows = Array.isArray(report.candidate_rows)
    ? report.candidate_rows
    : Array.isArray(report.candidateRows)
      ? report.candidateRows
      : [];

  return {
    status: report.status || "",
    summary: {
      row_count: Number(rawSummary.row_count || rawSummary.rowCount || candidateRows.length),
      action_counts: actionCounts.map((item) => ({
        recommendation_action:
          item.recommendation_action || item.recommendationAction || "",
        count: Number(item.count || 0),
      })),
      teacher_counts: teacherCounts.map((item) => ({
        teacher_name: item.teacher_name || item.teacherName || "",
        count: Number(item.count || 0),
      })),
      confirm_status_counts: confirmStatusCounts.map((item) => ({
        confirm_status: item.confirm_status || item.confirmStatus || "",
        count: Number(item.count || 0),
      })),
    },
    candidate_rows: candidateRows.map((row) => ({
      teacher_name: row.teacher_name || row.teacherName || "",
      course_date: row.course_date || row.courseDate || "",
      start_time: row.start_time || row.startTime || "",
      end_time: row.end_time || row.endTime || "",
      issue_flags: row.issue_flags || row.issueFlags || "",
      current_class_name: row.current_class_name || row.currentClassName || "",
      current_classroom_name:
        row.current_classroom_name || row.currentClassroomName || "",
      recommendation_action:
        row.recommendation_action || row.recommendationAction || "",
      recommendation_confidence:
        row.recommendation_confidence || row.recommendationConfidence || "",
      recommended_resolved_class_name:
        row.recommended_resolved_class_name ||
        row.recommendedResolvedClassName ||
        "",
      recommended_resolved_classroom_name:
        row.recommended_resolved_classroom_name ||
        row.recommendedResolvedClassroomName ||
        "",
      recommendation_note: row.recommendation_note || row.recommendationNote || "",
      confirm_status: row.confirm_status || row.confirmStatus || "",
    })),
  };
}

function normalizeScheduleDraftReviewBulkApplyReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftReviewBulkApplyReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      candidate_row_count: Number(
        rawSummary.candidate_row_count || rawSummary.candidateRowCount || 0
      ),
      existing_resolution_row_count: Number(
        rawSummary.existing_resolution_row_count ||
          rawSummary.existingResolutionRowCount ||
          0
      ),
      applied_count: Number(rawSummary.applied_count || rawSummary.appliedCount || 0),
      skipped_count: Number(rawSummary.skipped_count || rawSummary.skippedCount || 0),
      ignored_count: Number(rawSummary.ignored_count || rawSummary.ignoredCount || 0),
      merged_resolution_row_count: Number(
        rawSummary.merged_resolution_row_count ||
          rawSummary.mergedResolutionRowCount ||
          0
      ),
      confirmed_statuses: Array.isArray(rawSummary.confirmed_statuses)
        ? rawSummary.confirmed_statuses
        : Array.isArray(rawSummary.confirmedStatuses)
          ? rawSummary.confirmedStatuses
          : [],
    },
    applied_rows: Array.isArray(report.applied_rows) ? report.applied_rows : [],
    skipped_rows: Array.isArray(report.skipped_rows) ? report.skipped_rows : [],
    ignored_rows: Array.isArray(report.ignored_rows) ? report.ignored_rows : [],
  };
}

function normalizeScheduleDraftManualReviewReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftManualReviewReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const periodSummaries = Array.isArray(report.period_summaries)
    ? report.period_summaries
    : Array.isArray(report.periodSummaries)
      ? report.periodSummaries
      : [];
  const teacherPeriodRows = Array.isArray(report.teacher_period_rows)
    ? report.teacher_period_rows
    : Array.isArray(report.teacherPeriodRows)
      ? report.teacherPeriodRows
      : [];
  const manualReviewRows = Array.isArray(report.manual_review_rows)
    ? report.manual_review_rows
    : Array.isArray(report.manualReviewRows)
      ? report.manualReviewRows
      : [];

  return {
    status: report.status || "",
    summary: {
      total_rows: Number(rawSummary.total_rows || rawSummary.totalRows || 0),
      teacher_period_count: Number(
        rawSummary.teacher_period_count || rawSummary.teacherPeriodCount || 0
      ),
      teacher_count: Number(rawSummary.teacher_count || rawSummary.teacherCount || 0),
      period_count: Number(rawSummary.period_count || rawSummary.periodCount || 0),
      draft_class_name_count: Number(
        rawSummary.draft_class_name_count || rawSummary.draftClassNameCount || 0
      ),
      missing_classroom_count: Number(
        rawSummary.missing_classroom_count || rawSummary.missingClassroomCount || 0
      ),
      both_issue_count: Number(
        rawSummary.both_issue_count || rawSummary.bothIssueCount || 0
      ),
      with_suggested_class_name_count: Number(
        rawSummary.with_suggested_class_name_count ||
          rawSummary.withSuggestedClassNameCount ||
          0
      ),
      with_suggested_classroom_count: Number(
        rawSummary.with_suggested_classroom_count ||
          rawSummary.withSuggestedClassroomCount ||
          0
      ),
      excluded_bulk_candidate_count: Number(
        rawSummary.excluded_bulk_candidate_count ||
          rawSummary.excludedBulkCandidateCount ||
          0
      ),
      scope: rawSummary.scope || "",
    },
    period_summaries: periodSummaries.map((row) => ({
      period_name: row.period_name || row.periodName || "",
      teacher_period_count: Number(
        row.teacher_period_count || row.teacherPeriodCount || 0
      ),
      manual_row_count: Number(row.manual_row_count || row.manualRowCount || 0),
      draft_class_name_count: Number(
        row.draft_class_name_count || row.draftClassNameCount || 0
      ),
      missing_classroom_count: Number(
        row.missing_classroom_count || row.missingClassroomCount || 0
      ),
      both_issue_count: Number(
        row.both_issue_count || row.bothIssueCount || 0
      ),
      top_teacher_periods: Array.isArray(row.top_teacher_periods)
        ? row.top_teacher_periods.map((item) => ({
            teacher_name: item.teacher_name || item.teacherName || "",
            manual_row_count: Number(item.manual_row_count || item.manualRowCount || 0),
            draft_class_name_count: Number(
              item.draft_class_name_count || item.draftClassNameCount || 0
            ),
            missing_classroom_count: Number(
              item.missing_classroom_count || item.missingClassroomCount || 0
            ),
            recommended_action:
              item.recommended_action || item.recommendedAction || "",
            sample_class_names: Array.isArray(item.sample_class_names)
              ? item.sample_class_names.join(" / ")
              : Array.isArray(item.sampleClassNames)
                ? item.sampleClassNames.join(" / ")
                : "",
          }))
        : [],
    })),
    teacher_period_rows: teacherPeriodRows.map((row) => ({
      period_name: row.period_name || row.periodName || "",
      teacher_name: row.teacher_name || row.teacherName || "",
      manual_row_count: Number(row.manual_row_count || row.manualRowCount || 0),
      draft_class_name_count: Number(
        row.draft_class_name_count || row.draftClassNameCount || 0
      ),
      missing_classroom_count: Number(
        row.missing_classroom_count || row.missingClassroomCount || 0
      ),
      both_issue_count: Number(row.both_issue_count || row.bothIssueCount || 0),
      sample_class_names: row.sample_class_names || row.sampleClassNames || "",
      primary_focus: row.primary_focus || row.primaryFocus || "",
      recommended_action: row.recommended_action || row.recommendedAction || "",
    })),
    manual_review_rows: manualReviewRows.map((row) => ({
      period_name: row.period_name || row.periodName || "",
      teacher_name: row.teacher_name || row.teacherName || "",
      course_date: row.course_date || row.courseDate || "",
      start_time: row.start_time || row.startTime || "",
      end_time: row.end_time || row.endTime || "",
      current_class_name: row.current_class_name || row.currentClassName || "",
      current_classroom_name:
        row.current_classroom_name || row.currentClassroomName || "",
      issue_flags: row.issue_flags || row.issueFlags || "",
      manual_review_focus: row.manual_review_focus || row.manualReviewFocus || "",
      manual_review_reason: row.manual_review_reason || row.manualReviewReason || "",
      suggested_class_name: row.suggested_class_name || row.suggestedClassName || "",
      suggested_classroom_name:
        row.suggested_classroom_name || row.suggestedClassroomName || "",
      suggestion_basis: row.suggestion_basis || row.suggestionBasis || "",
      teacher_period_manual_row_count: Number(
        row.teacher_period_manual_row_count ||
          row.teacherPeriodManualRowCount ||
          0
      ),
    })),
  };
}

function normalizeScheduleDraftManualClassnameBatchCandidatesReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftManualClassnameBatchCandidatesReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const batchRows = Array.isArray(report.batch_rows)
    ? report.batch_rows
    : Array.isArray(report.batchRows)
      ? report.batchRows
      : [];

  return {
    status: report.status || "",
    summary: {
      group_count: Number(rawSummary.group_count || rawSummary.groupCount || 0),
      covered_row_count: Number(
        rawSummary.covered_row_count || rawSummary.coveredRowCount || 0
      ),
      teacher_period_count: Number(
        rawSummary.teacher_period_count || rawSummary.teacherPeriodCount || 0
      ),
      teacher_count: Number(rawSummary.teacher_count || rawSummary.teacherCount || 0),
      period_count: Number(rawSummary.period_count || rawSummary.periodCount || 0),
      min_group_size: Number(
        rawSummary.min_group_size || rawSummary.minGroupSize || 0
      ),
      confirmed_group_count: Number(
        rawSummary.confirmed_group_count || rawSummary.confirmedGroupCount || 0
      ),
      exact_evidence_group_count: Number(
        rawSummary.exact_evidence_group_count || rawSummary.exactEvidenceGroupCount || 0
      ),
      exact_evidence_row_count: Number(
        rawSummary.exact_evidence_row_count || rawSummary.exactEvidenceRowCount || 0
      ),
      related_sample_group_count: Number(
        rawSummary.related_sample_group_count || rawSummary.relatedSampleGroupCount || 0
      ),
      related_sample_row_count: Number(
        rawSummary.related_sample_row_count || rawSummary.relatedSampleRowCount || 0
      ),
      alias_rule_only_group_count: Number(
        rawSummary.alias_rule_only_group_count || rawSummary.aliasRuleOnlyGroupCount || 0
      ),
      alias_rule_only_row_count: Number(
        rawSummary.alias_rule_only_row_count || rawSummary.aliasRuleOnlyRowCount || 0
      ),
      low_confidence_group_count: Number(
        rawSummary.low_confidence_group_count || rawSummary.lowConfidenceGroupCount || 0
      ),
      low_confidence_row_count: Number(
        rawSummary.low_confidence_row_count || rawSummary.lowConfidenceRowCount || 0
      ),
      confidence_counts: Array.isArray(rawSummary.confidence_counts)
        ? rawSummary.confidence_counts.map((item) => ({
            recommendation_confidence:
              item.recommendation_confidence || item.recommendationConfidence || "",
            recommendation_confidence_label:
              item.recommendation_confidence_label ||
              item.recommendationConfidenceLabel ||
              "",
            group_count: Number(item.group_count || item.groupCount || 0),
            row_count: Number(item.row_count || item.rowCount || 0),
          }))
        : Array.isArray(rawSummary.confidenceCounts)
          ? rawSummary.confidenceCounts.map((item) => ({
              recommendation_confidence:
                item.recommendation_confidence || item.recommendationConfidence || "",
              recommendation_confidence_label:
                item.recommendation_confidence_label ||
                item.recommendationConfidenceLabel ||
                "",
              group_count: Number(item.group_count || item.groupCount || 0),
              row_count: Number(item.row_count || item.rowCount || 0),
            }))
          : [],
      recommendation_basis_counts: Array.isArray(rawSummary.recommendation_basis_counts)
        ? rawSummary.recommendation_basis_counts.map((item) => ({
            recommendation_basis:
              item.recommendation_basis || item.recommendationBasis || "",
            recommendation_basis_label:
              item.recommendation_basis_label ||
              item.recommendationBasisLabel ||
              "",
            group_count: Number(item.group_count || item.groupCount || 0),
            row_count: Number(item.row_count || item.rowCount || 0),
          }))
        : Array.isArray(rawSummary.recommendationBasisCounts)
          ? rawSummary.recommendationBasisCounts.map((item) => ({
              recommendation_basis:
                item.recommendation_basis || item.recommendationBasis || "",
              recommendation_basis_label:
                item.recommendation_basis_label ||
                item.recommendationBasisLabel ||
                "",
              group_count: Number(item.group_count || item.groupCount || 0),
              row_count: Number(item.row_count || item.rowCount || 0),
            }))
          : [],
    },
    batch_rows: batchRows.map((row) => ({
      batch_id: row.batch_id || row.batchId || "",
      period_name: row.period_name || row.periodName || "",
      teacher_name: row.teacher_name || row.teacherName || "",
      source_note_key: row.source_note_key || row.sourceNoteKey || "",
      row_count: Number(row.row_count || row.rowCount || 0),
      course_date_count: Number(row.course_date_count || row.courseDateCount || 0),
      course_date_range: row.course_date_range || row.courseDateRange || "",
      current_classroom_samples:
        row.current_classroom_samples || row.currentClassroomSamples || "",
      class_name_samples: row.class_name_samples || row.classNameSamples || "",
      source_note_samples: row.source_note_samples || row.sourceNoteSamples || "",
      suggestion_basis_samples:
        row.suggestion_basis_samples || row.suggestionBasisSamples || "",
      matching_schedule_name_samples:
        row.matching_schedule_name_samples || row.matchingScheduleNameSamples || "",
      matching_class_group_samples:
        row.matching_class_group_samples || row.matchingClassGroupSamples || "",
      recommendation_basis:
        row.recommendation_basis || row.recommendationBasis || "",
      exact_schedule_match_count: Number(
        row.exact_schedule_match_count || row.exactScheduleMatchCount || 0
      ),
      exact_class_group_match_count: Number(
        row.exact_class_group_match_count || row.exactClassGroupMatchCount || 0
      ),
      related_schedule_match_count: Number(
        row.related_schedule_match_count || row.relatedScheduleMatchCount || 0
      ),
      related_class_group_match_count: Number(
        row.related_class_group_match_count || row.relatedClassGroupMatchCount || 0
      ),
      recommendation_confidence:
        row.recommendation_confidence || row.recommendationConfidence || "",
      recommendation_note: row.recommendation_note || row.recommendationNote || "",
      confirm_status: row.confirm_status || row.confirmStatus || "",
      recommended_resolved_class_name:
        row.recommended_resolved_class_name ||
        row.recommendedResolvedClassName ||
        "",
    })),
  };
}

function normalizeScheduleDraftManualClassnameBatchApplyReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftManualClassnameBatchApplyReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      applied_batch_count: Number(
        rawSummary.applied_batch_count || rawSummary.appliedBatchCount || 0
      ),
      applied_row_count: Number(
        rawSummary.applied_row_count || rawSummary.appliedRowCount || 0
      ),
      skipped_batch_count: Number(
        rawSummary.skipped_batch_count || rawSummary.skippedBatchCount || 0
      ),
      skipped_row_count: Number(
        rawSummary.skipped_row_count || rawSummary.skippedRowCount || 0
      ),
      ignored_batch_count: Number(
        rawSummary.ignored_batch_count || rawSummary.ignoredBatchCount || 0
      ),
      confirmed_statuses: Array.isArray(rawSummary.confirmed_statuses)
        ? rawSummary.confirmed_statuses
        : Array.isArray(rawSummary.confirmedStatuses)
          ? rawSummary.confirmedStatuses
          : [],
    },
    applied_batches: Array.isArray(report.applied_batches) ? report.applied_batches : [],
    applied_rows: Array.isArray(report.applied_rows) ? report.applied_rows : [],
    skipped_batches: Array.isArray(report.skipped_batches) ? report.skipped_batches : [],
    skipped_rows: Array.isArray(report.skipped_rows) ? report.skipped_rows : [],
    ignored_batches: Array.isArray(report.ignored_batches) ? report.ignored_batches : [],
  };
}

function normalizeScheduleDraftManualClassroomBatchCandidatesReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftManualClassroomBatchCandidatesReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const batchRows = Array.isArray(report.batch_rows)
    ? report.batch_rows
    : Array.isArray(report.batchRows)
      ? report.batchRows
      : [];

  return {
    status: report.status || "",
    summary: {
      group_count: Number(rawSummary.group_count || rawSummary.groupCount || 0),
      covered_row_count: Number(
        rawSummary.covered_row_count || rawSummary.coveredRowCount || 0
      ),
      teacher_period_count: Number(
        rawSummary.teacher_period_count || rawSummary.teacherPeriodCount || 0
      ),
      teacher_count: Number(rawSummary.teacher_count || rawSummary.teacherCount || 0),
      period_count: Number(rawSummary.period_count || rawSummary.periodCount || 0),
      min_group_size: Number(
        rawSummary.min_group_size || rawSummary.minGroupSize || 0
      ),
      confirmed_group_count: Number(
        rawSummary.confirmed_group_count || rawSummary.confirmedGroupCount || 0
      ),
    },
    batch_rows: batchRows.map((row) => ({
      batch_id: row.batch_id || row.batchId || "",
      period_name: row.period_name || row.periodName || "",
      teacher_name: row.teacher_name || row.teacherName || "",
      suggested_classroom_name:
        row.suggested_classroom_name || row.suggestedClassroomName || "",
      suggestion_basis: row.suggestion_basis || row.suggestionBasis || "",
      row_count: Number(row.row_count || row.rowCount || 0),
      course_date_range: row.course_date_range || row.courseDateRange || "",
      class_name_samples: row.class_name_samples || row.classNameSamples || "",
      recommendation_note: row.recommendation_note || row.recommendationNote || "",
      confirm_status: row.confirm_status || row.confirmStatus || "",
      recommended_resolved_classroom_name:
        row.recommended_resolved_classroom_name ||
        row.recommendedResolvedClassroomName ||
        "",
    })),
  };
}

function normalizeScheduleDraftManualClassroomBatchApplyReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftManualClassroomBatchApplyReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      applied_batch_count: Number(
        rawSummary.applied_batch_count || rawSummary.appliedBatchCount || 0
      ),
      applied_row_count: Number(
        rawSummary.applied_row_count || rawSummary.appliedRowCount || 0
      ),
      skipped_batch_count: Number(
        rawSummary.skipped_batch_count || rawSummary.skippedBatchCount || 0
      ),
      skipped_row_count: Number(
        rawSummary.skipped_row_count || rawSummary.skippedRowCount || 0
      ),
      ignored_batch_count: Number(
        rawSummary.ignored_batch_count || rawSummary.ignoredBatchCount || 0
      ),
      confirmed_statuses: Array.isArray(rawSummary.confirmed_statuses)
        ? rawSummary.confirmed_statuses
        : Array.isArray(rawSummary.confirmedStatuses)
          ? rawSummary.confirmedStatuses
          : [],
    },
    applied_batches: Array.isArray(report.applied_batches) ? report.applied_batches : [],
    applied_rows: Array.isArray(report.applied_rows) ? report.applied_rows : [],
    skipped_batches: Array.isArray(report.skipped_batches) ? report.skipped_batches : [],
    skipped_rows: Array.isArray(report.skipped_rows) ? report.skipped_rows : [],
    ignored_batches: Array.isArray(report.ignored_batches) ? report.ignored_batches : [],
  };
}

function normalizeScheduleDraftManualCombinedBatchCandidatesReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftManualCombinedBatchCandidatesReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const batchRows = Array.isArray(report.batch_rows)
    ? report.batch_rows
    : Array.isArray(report.batchRows)
      ? report.batchRows
      : [];

  return {
    status: report.status || "",
    summary: {
      group_count: Number(rawSummary.group_count || rawSummary.groupCount || 0),
      covered_row_count: Number(
        rawSummary.covered_row_count || rawSummary.coveredRowCount || 0
      ),
      teacher_period_count: Number(
        rawSummary.teacher_period_count || rawSummary.teacherPeriodCount || 0
      ),
      teacher_count: Number(rawSummary.teacher_count || rawSummary.teacherCount || 0),
      period_count: Number(rawSummary.period_count || rawSummary.periodCount || 0),
      confirmed_group_count: Number(
        rawSummary.confirmed_group_count || rawSummary.confirmedGroupCount || 0
      ),
      singleton_group_count: Number(
        rawSummary.singleton_group_count || rawSummary.singletonGroupCount || 0
      ),
    },
    batch_rows: batchRows.map((row) => ({
      batch_id: row.batch_id || row.batchId || "",
      period_name: row.period_name || row.periodName || "",
      teacher_name: row.teacher_name || row.teacherName || "",
      issue_flags: row.issue_flags || row.issueFlags || "",
      source_note_key: row.source_note_key || row.sourceNoteKey || "",
      recommended_resolved_class_name:
        row.recommended_resolved_class_name ||
        row.recommendedResolvedClassName ||
        "",
      recommended_resolved_classroom_name:
        row.recommended_resolved_classroom_name ||
        row.recommendedResolvedClassroomName ||
        "",
      recommendation_confidence:
        row.recommendation_confidence || row.recommendationConfidence || "",
      row_count: Number(row.row_count || row.rowCount || 0),
      course_date_count: Number(row.course_date_count || row.courseDateCount || 0),
      course_date_range: row.course_date_range || row.courseDateRange || "",
      current_class_name_samples:
        row.current_class_name_samples || row.currentClassNameSamples || "",
      source_note_samples: row.source_note_samples || row.sourceNoteSamples || "",
      suggestion_basis_samples:
        row.suggestion_basis_samples || row.suggestionBasisSamples || "",
      review_row_keys_json: row.review_row_keys_json || row.reviewRowKeysJson || "",
      recommendation_note: row.recommendation_note || row.recommendationNote || "",
      confirm_status: row.confirm_status || row.confirmStatus || "",
      resolved_class_name: row.resolved_class_name || row.resolvedClassName || "",
      resolved_classroom_name:
        row.resolved_classroom_name || row.resolvedClassroomName || "",
      owner_name: row.owner_name || row.ownerName || "",
      decision_summary: row.decision_summary || row.decisionSummary || "",
      resolved_by_name: row.resolved_by_name || row.resolvedByName || "",
      resolved_at: row.resolved_at || row.resolvedAt || "",
      notes: row.notes || "",
    })),
  };
}

function normalizeScheduleDraftManualCombinedBatchApplyReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftManualCombinedBatchApplyReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      applied_batch_count: Number(
        rawSummary.applied_batch_count || rawSummary.appliedBatchCount || 0
      ),
      applied_row_count: Number(
        rawSummary.applied_row_count || rawSummary.appliedRowCount || 0
      ),
      skipped_batch_count: Number(
        rawSummary.skipped_batch_count || rawSummary.skippedBatchCount || 0
      ),
      skipped_row_count: Number(
        rawSummary.skipped_row_count || rawSummary.skippedRowCount || 0
      ),
      ignored_batch_count: Number(
        rawSummary.ignored_batch_count || rawSummary.ignoredBatchCount || 0
      ),
      confirmed_statuses: Array.isArray(rawSummary.confirmed_statuses)
        ? rawSummary.confirmed_statuses
        : Array.isArray(rawSummary.confirmedStatuses)
          ? rawSummary.confirmedStatuses
          : [],
    },
    applied_batches: Array.isArray(report.applied_batches) ? report.applied_batches : [],
    applied_rows: Array.isArray(report.applied_rows) ? report.applied_rows : [],
    skipped_batches: Array.isArray(report.skipped_batches) ? report.skipped_batches : [],
    skipped_rows: Array.isArray(report.skipped_rows) ? report.skipped_rows : [],
    ignored_batches: Array.isArray(report.ignored_batches) ? report.ignored_batches : [],
  };
}

function normalizeScheduleDraftManualResidualReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyScheduleDraftManualResidualReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  const issueCounts = Array.isArray(rawSummary.issue_counts)
    ? rawSummary.issue_counts
    : Array.isArray(rawSummary.issueCounts)
      ? rawSummary.issueCounts
      : [];
  const categoryCounts = Array.isArray(rawSummary.category_counts)
    ? rawSummary.category_counts
    : Array.isArray(rawSummary.categoryCounts)
      ? rawSummary.categoryCounts
      : [];
  const teacherPeriodRows = Array.isArray(report.teacher_period_rows)
    ? report.teacher_period_rows
    : Array.isArray(report.teacherPeriodRows)
      ? report.teacherPeriodRows
      : [];
  const residualRows = Array.isArray(report.residual_rows)
    ? report.residual_rows
    : Array.isArray(report.residualRows)
      ? report.residualRows
      : [];

  return {
    status: report.status || "",
    summary: {
      row_count: Number(rawSummary.row_count || rawSummary.rowCount || residualRows.length),
      teacher_period_count: Number(
        rawSummary.teacher_period_count ||
          rawSummary.teacherPeriodCount ||
          teacherPeriodRows.length
      ),
      issue_counts: issueCounts.map((item) => ({
        issue_flags: item.issue_flags || item.issueFlags || "",
        count: Number(item.count || 0),
      })),
      category_counts: categoryCounts.map((item) => ({
        residual_category: item.residual_category || item.residualCategory || "",
        count: Number(item.count || 0),
      })),
    },
    teacher_period_rows: teacherPeriodRows.map((row) => ({
      period_name: row.period_name || row.periodName || "",
      teacher_name: row.teacher_name || row.teacherName || "",
      row_count: Number(row.row_count || row.rowCount || 0),
      sample_rows: Array.isArray(row.sample_rows)
        ? row.sample_rows.join(" / ")
        : Array.isArray(row.sampleRows)
          ? row.sampleRows.join(" / ")
          : row.sample_rows || row.sampleRows || "",
    })),
    residual_rows: residualRows.map((row) => ({
      period_name: row.period_name || row.periodName || "",
      teacher_name: row.teacher_name || row.teacherName || "",
      teacher_period_manual_row_count: Number(
        row.teacher_period_manual_row_count ||
          row.teacherPeriodManualRowCount ||
          0
      ),
      course_date: row.course_date || row.courseDate || "",
      start_time: row.start_time || row.startTime || "",
      end_time: row.end_time || row.endTime || "",
      current_class_name: row.current_class_name || row.currentClassName || "",
      current_classroom_name:
        row.current_classroom_name || row.currentClassroomName || "",
      issue_flags: row.issue_flags || row.issueFlags || "",
      source_notes: row.source_notes || row.sourceNotes || "",
      suggested_class_name: row.suggested_class_name || row.suggestedClassName || "",
      suggested_classroom_name:
        row.suggested_classroom_name || row.suggestedClassroomName || "",
      suggestion_basis: row.suggestion_basis || row.suggestionBasis || "",
      resolution_status: row.resolution_status || row.resolutionStatus || "",
      owner_name: row.owner_name || row.ownerName || "",
      decision_summary: row.decision_summary || row.decisionSummary || "",
      notes: row.notes || "",
      manual_review_focus: row.manual_review_focus || row.manualReviewFocus || "",
      manual_review_reason: row.manual_review_reason || row.manualReviewReason || "",
      residual_category: row.residual_category || row.residualCategory || "",
      recommended_manual_action:
        row.recommended_manual_action || row.recommendedManualAction || "",
    })),
  };
}

function normalizeOpsOpenItemsReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyOpsOpenItemsReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      attention_item_count: Number(
        rawSummary.attention_item_count || rawSummary.attentionItemCount || 0
      ),
      summer_pending_group_count: Number(
        rawSummary.summer_pending_group_count ||
          rawSummary.summerPendingGroupCount ||
          0
      ),
      schedule_residual_row_count: Number(
        rawSummary.schedule_residual_row_count ||
          rawSummary.scheduleResidualRowCount ||
          0
      ),
      schedule_residual_teacher_period_count: Number(
        rawSummary.schedule_residual_teacher_period_count ||
          rawSummary.scheduleResidualTeacherPeriodCount ||
          0
      ),
      missing_statement_teacher_period_count: Number(
        rawSummary.missing_statement_teacher_period_count ||
          rawSummary.missingStatementTeacherPeriodCount ||
          0
      ),
      summary_only_teacher_period_count: Number(
        rawSummary.summary_only_teacher_period_count ||
          rawSummary.summaryOnlyTeacherPeriodCount ||
          0
      ),
      future_policy_pending_teacher_count: Number(
        rawSummary.future_policy_pending_teacher_count ||
          rawSummary.futurePolicyPendingTeacherCount ||
          0
      ),
      policy_blocking_teacher_count: Number(
        rawSummary.policy_blocking_teacher_count ||
          rawSummary.policyBlockingTeacherCount ||
          0
      ),
    },
    category_rows: Array.isArray(report.category_rows)
      ? report.category_rows
      : Array.isArray(report.categoryRows)
        ? report.categoryRows
        : [],
    summer_pending_rows: Array.isArray(report.summer_pending_rows)
      ? report.summer_pending_rows
      : Array.isArray(report.summerPendingRows)
        ? report.summerPendingRows
        : [],
    schedule_residual_teacher_period_rows: Array.isArray(
      report.schedule_residual_teacher_period_rows
    )
      ? report.schedule_residual_teacher_period_rows
      : Array.isArray(report.scheduleResidualTeacherPeriodRows)
        ? report.scheduleResidualTeacherPeriodRows
        : [],
    schedule_residual_rows: Array.isArray(report.schedule_residual_rows)
      ? report.schedule_residual_rows
      : Array.isArray(report.scheduleResidualRows)
        ? report.scheduleResidualRows
        : [],
    compensation_missing_statement_rows: Array.isArray(
      report.compensation_missing_statement_rows
    )
      ? report.compensation_missing_statement_rows
      : Array.isArray(report.compensationMissingStatementRows)
        ? report.compensationMissingStatementRows
        : [],
    compensation_summary_only_rows: Array.isArray(report.compensation_summary_only_rows)
      ? report.compensation_summary_only_rows
      : Array.isArray(report.compensationSummaryOnlyRows)
        ? report.compensationSummaryOnlyRows
        : [],
    future_policy_pending_rows: Array.isArray(report.future_policy_pending_rows)
      ? report.future_policy_pending_rows
      : Array.isArray(report.futurePolicyPendingRows)
        ? report.futurePolicyPendingRows
        : [],
    policy_blocking_rows: Array.isArray(report.policy_blocking_rows)
      ? report.policy_blocking_rows
      : Array.isArray(report.policyBlockingRows)
        ? report.policyBlockingRows
        : [],
    notes: Array.isArray(report.notes) ? report.notes : [],
  };
}

function normalizeTeacherSettlementProfileReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyTeacherSettlementProfileReport();
  }

  return {
    status: report.status || "",
    period_summaries: Array.isArray(report.period_summaries)
      ? report.period_summaries
      : Array.isArray(report.periodSummaries)
        ? report.periodSummaries
        : [],
    teacher_profiles: Array.isArray(report.teacher_profiles)
      ? report.teacher_profiles
      : Array.isArray(report.teacherProfiles)
        ? report.teacherProfiles
        : [],
  };
}

function normalizeTeacherCompensationPolicyReport(report) {
  if (!report || typeof report !== "object") {
    return createEmptyTeacherCompensationPolicyReport();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      status: rawSummary.status || "",
      reference_period: rawSummary.reference_period || rawSummary.referencePeriod || "",
      horizon_months: Number(rawSummary.horizon_months || rawSummary.horizonMonths || 0),
      teacher_count: Number(rawSummary.teacher_count || rawSummary.teacherCount || 0),
      active_teacher_count: Number(
        rawSummary.active_teacher_count || rawSummary.activeTeacherCount || 0
      ),
      inactive_teacher_count: Number(
        rawSummary.inactive_teacher_count || rawSummary.inactiveTeacherCount || 0
      ),
      period_row_count: Number(
        rawSummary.period_row_count || rawSummary.periodRowCount || 0
      ),
      current_rule_covered_active_teacher_count: Number(
        rawSummary.current_rule_covered_active_teacher_count ||
          rawSummary.currentRuleCoveredActiveTeacherCount ||
          0
      ),
      current_rule_missing_active_teacher_count: Number(
        rawSummary.current_rule_missing_active_teacher_count ||
          rawSummary.currentRuleMissingActiveTeacherCount ||
          0
      ),
      future_default_pending_teacher_count: Number(
        rawSummary.future_default_pending_teacher_count ||
          rawSummary.futureDefaultPendingTeacherCount ||
          0
      ),
      future_default_pending_teacher_names: Array.isArray(
        rawSummary.future_default_pending_teacher_names
      )
        ? rawSummary.future_default_pending_teacher_names
        : Array.isArray(rawSummary.futureDefaultPendingTeacherNames)
          ? rawSummary.futureDefaultPendingTeacherNames
          : [],
      future_confirmed_teacher_count: Number(
        rawSummary.future_confirmed_teacher_count ||
          rawSummary.futureConfirmedTeacherCount ||
          0
      ),
      future_confirmed_teacher_names: Array.isArray(
        rawSummary.future_confirmed_teacher_names
      )
        ? rawSummary.future_confirmed_teacher_names
        : Array.isArray(rawSummary.futureConfirmedTeacherNames)
          ? rawSummary.futureConfirmedTeacherNames
          : [],
      overlap_issue_teacher_count: Number(
        rawSummary.overlap_issue_teacher_count ||
          rawSummary.overlapIssueTeacherCount ||
          0
      ),
      overlap_issue_teacher_names: Array.isArray(rawSummary.overlap_issue_teacher_names)
        ? rawSummary.overlap_issue_teacher_names
        : Array.isArray(rawSummary.overlapIssueTeacherNames)
          ? rawSummary.overlapIssueTeacherNames
          : [],
      future_gap_teacher_count: Number(
        rawSummary.future_gap_teacher_count || rawSummary.futureGapTeacherCount || 0
      ),
      future_gap_teacher_names: Array.isArray(rawSummary.future_gap_teacher_names)
        ? rawSummary.future_gap_teacher_names
        : Array.isArray(rawSummary.futureGapTeacherNames)
          ? rawSummary.futureGapTeacherNames
          : [],
      duplicate_override_scope_teacher_count: Number(
        rawSummary.duplicate_override_scope_teacher_count ||
          rawSummary.duplicateOverrideScopeTeacherCount ||
          0
      ),
      duplicate_override_scope_teacher_names: Array.isArray(
        rawSummary.duplicate_override_scope_teacher_names
      )
        ? rawSummary.duplicate_override_scope_teacher_names
        : Array.isArray(rawSummary.duplicateOverrideScopeTeacherNames)
          ? rawSummary.duplicateOverrideScopeTeacherNames
          : [],
      duplicate_override_scope_group_count: Number(
        rawSummary.duplicate_override_scope_group_count ||
          rawSummary.duplicateOverrideScopeGroupCount ||
          0
      ),
      rule_item_override_teacher_count: Number(
        rawSummary.rule_item_override_teacher_count ||
          rawSummary.ruleItemOverrideTeacherCount ||
          0
      ),
    },
    teacher_rows: Array.isArray(report.teacher_rows)
      ? report.teacher_rows.map(normalizeTeacherCompensationPolicyTeacherRow)
      : Array.isArray(report.teacherRows)
        ? report.teacherRows.map(normalizeTeacherCompensationPolicyTeacherRow)
        : [],
    period_rows: Array.isArray(report.period_rows)
      ? report.period_rows.map(normalizeTeacherCompensationPolicyPeriodRow)
      : Array.isArray(report.periodRows)
        ? report.periodRows.map(normalizeTeacherCompensationPolicyPeriodRow)
        : [],
    duplicate_override_scope_rows: Array.isArray(report.duplicate_override_scope_rows)
      ? report.duplicate_override_scope_rows.map(
          normalizeTeacherCompensationPolicyConflictRow
        )
      : Array.isArray(report.duplicateOverrideScopeRows)
        ? report.duplicateOverrideScopeRows.map(
            normalizeTeacherCompensationPolicyConflictRow
          )
        : [],
    overlap_issue_rows: Array.isArray(report.overlap_issue_rows)
      ? report.overlap_issue_rows.map(normalizeTeacherCompensationPolicyConflictRow)
      : Array.isArray(report.overlapIssueRows)
        ? report.overlapIssueRows.map(normalizeTeacherCompensationPolicyConflictRow)
        : [],
  };
}

function normalizeTeacherCompensationPolicyTeacherRow(row) {
  return {
    teacher_name: row.teacher_name || row.teacherName || "",
    teacher_status: row.teacher_status || row.teacherStatus || "",
    coverage_status: row.coverage_status || row.coverageStatus || "",
    subject: row.subject || "",
    grade_scope_text: row.grade_scope_text || row.gradeScopeText || "",
    imported_period_names_text:
      row.imported_period_names_text || row.importedPeriodNamesText || "",
    current_rule_display:
      row.current_rule_display || row.currentRuleDisplay || "",
    current_rule_source_label:
      row.current_rule_source_label || row.currentRuleSourceLabel || "",
    current_rule_effective_start_date:
      row.current_rule_effective_start_date ||
      row.currentRuleEffectiveStartDate ||
      "",
    current_rule_effective_end_date:
      row.current_rule_effective_end_date ||
      row.currentRuleEffectiveEndDate ||
      "",
    default_policy_period_count: Number(
      row.default_policy_period_count || row.defaultPolicyPeriodCount || 0
    ),
    confirmed_policy_period_count: Number(
      row.confirmed_policy_period_count || row.confirmedPolicyPeriodCount || 0
    ),
    rule_item_row_count: Number(row.rule_item_row_count || row.ruleItemRowCount || 0),
    distinct_ratio_override_count: Number(
      row.distinct_ratio_override_count || row.distinctRatioOverrideCount || 0
    ),
    ratio_override_values_text:
      row.ratio_override_values_text || row.ratioOverrideValuesText || "",
    duplicate_override_scope_group_count: Number(
      row.duplicate_override_scope_group_count ||
        row.duplicateOverrideScopeGroupCount ||
        0
    ),
    duplicate_override_scope_examples_text:
      row.duplicate_override_scope_examples_text ||
      row.duplicateOverrideScopeExamplesText ||
      "",
    recommended_next_step:
      row.recommended_next_step || row.recommendedNextStep || "",
  };
}

function normalizeTeacherCompensationPolicyPeriodRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    teacher_status: row.teacher_status || row.teacherStatus || "",
    period_status: row.period_status || row.periodStatus || "",
    rule_display: row.rule_display || row.ruleDisplay || "",
    rule_source_label: row.rule_source_label || row.ruleSourceLabel || "",
    effective_start_date:
      row.effective_start_date || row.effectiveStartDate || "",
    effective_end_date: row.effective_end_date || row.effectiveEndDate || "",
    rule_item_row_count: Number(row.rule_item_row_count || row.ruleItemRowCount || 0),
    ratio_override_values_text:
      row.ratio_override_values_text || row.ratioOverrideValuesText || "",
    duplicate_override_scope_group_count: Number(
      row.duplicate_override_scope_group_count ||
        row.duplicateOverrideScopeGroupCount ||
        0
    ),
    duplicate_override_scope_examples_text:
      row.duplicate_override_scope_examples_text ||
      row.duplicateOverrideScopeExamplesText ||
      "",
    recommended_next_step:
      row.recommended_next_step || row.recommendedNextStep || "",
  };
}

function normalizeTeacherCompensationPolicyConflictRow(row) {
  return {
    teacher_name: row.teacher_name || row.teacherName || "",
    effective_start_date:
      row.effective_start_date || row.effectiveStartDate || "",
    scope_label: row.scope_label || row.scopeLabel || "",
    row_count: Number(row.row_count || row.rowCount || 0),
    ratio_override_values_text:
      row.ratio_override_values_text || row.ratioOverrideValuesText || "",
    unit_amount_values_text:
      row.unit_amount_values_text || row.unitAmountValuesText || "",
    priority: row.priority || "",
  };
}

function normalizeTeacherRuleItemResolutionTemplate(report) {
  if (!report || typeof report !== "object") {
    return createEmptyTeacherRuleItemResolutionTemplate();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      row_count: Number(rawSummary.row_count || rawSummary.rowCount || 0),
      confirm_status_counts:
        rawSummary.confirm_status_counts ||
        rawSummary.confirmStatusCounts ||
        {},
    },
    rows: Array.isArray(report.rows)
      ? report.rows.map(normalizeTeacherRuleItemResolutionRow)
      : [],
  };
}

function normalizeTeacherRuleItemResolutionRow(row) {
  return {
    teacher_name: row.teacher_name || row.teacherName || "",
    effective_start_date:
      row.effective_start_date || row.effectiveStartDate || "",
    course_type: row.course_type || row.courseType || "",
    session_tag: row.session_tag || row.sessionTag || "",
    grade_from: row.grade_from || row.gradeFrom || "",
    grade_to: row.grade_to || row.gradeTo || "",
    calc_mode_override:
      row.calc_mode_override || row.calcModeOverride || "",
    priority: row.priority || "",
    scope_label: row.scope_label || row.scopeLabel || "",
    duplicate_row_count: Number(
      row.duplicate_row_count || row.duplicateRowCount || 0
    ),
    candidate_ratio_options_text:
      row.candidate_ratio_options_text || row.candidateRatioOptionsText || "",
    candidate_unit_amount_options_text:
      row.candidate_unit_amount_options_text ||
      row.candidateUnitAmountOptionsText ||
      "",
    candidate_option_summaries_text:
      row.candidate_option_summaries_text ||
      row.candidateOptionSummariesText ||
      "",
    recommended_resolution:
      row.recommended_resolution || row.recommendedResolution || "",
    confirm_status: row.confirm_status || row.confirmStatus || "pending",
    selected_ratio_override:
      row.selected_ratio_override || row.selectedRatioOverride || "",
    selected_unit_amount:
      row.selected_unit_amount || row.selectedUnitAmount || "",
    selected_notes: row.selected_notes || row.selectedNotes || "",
    notes: row.notes || "",
  };
}

function normalizeCompensationImportWorkbookRow(row) {
  return {
    file_name: row.file_name || row.fileName || "",
    file_path: row.file_path || row.filePath || "",
    category: row.category || "",
    period_name: row.period_name || row.periodName || "",
    teacher_name_hint: row.teacher_name_hint || row.teacherNameHint || "",
    size_bytes: Number(row.size_bytes || row.sizeBytes || 0),
    size_kb: row.size_kb || row.sizeKb || "",
    modified_at: row.modified_at || row.modifiedAt || "",
  };
}

function normalizeCompensationImportReadinessPeriodRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    source_workbook_names: row.source_workbook_names || row.sourceWorkbookNames || "",
    teacher_profile_count: Number(row.teacher_profile_count || row.teacherProfileCount || 0),
    student_detail_teacher_count: Number(
      row.student_detail_teacher_count || row.studentDetailTeacherCount || 0
    ),
    summary_only_teacher_count: Number(
      row.summary_only_teacher_count || row.summaryOnlyTeacherCount || 0
    ),
    settlement_statement_teacher_count: Number(
      row.settlement_statement_teacher_count ||
        row.settlementStatementTeacherCount ||
        0
    ),
    settlement_detail_row_count: Number(
      row.settlement_detail_row_count || row.settlementDetailRowCount || 0
    ),
    inferred_rule_count: Number(row.inferred_rule_count || row.inferredRuleCount || 0),
    missing_statement_teacher_count: Number(
      row.missing_statement_teacher_count ||
        row.missingStatementTeacherCount ||
        0
    ),
    missing_statement_teacher_names:
      row.missing_statement_teacher_names || row.missingStatementTeacherNames || "",
    needs_rule_inference_teacher_count: Number(
      row.needs_rule_inference_teacher_count ||
        row.needsRuleInferenceTeacherCount ||
        0
    ),
    needs_rule_inference_teacher_names:
      row.needs_rule_inference_teacher_names ||
      row.needsRuleInferenceTeacherNames ||
      "",
    needs_schedule_review_teacher_count: Number(
      row.needs_schedule_review_teacher_count ||
        row.needsScheduleReviewTeacherCount ||
        0
    ),
    needs_schedule_review_teacher_names:
      row.needs_schedule_review_teacher_names ||
      row.needsScheduleReviewTeacherNames ||
      "",
    needs_manual_review_teacher_count: Number(
      row.needs_manual_review_teacher_count ||
        row.needsManualReviewTeacherCount ||
        0
    ),
    needs_manual_review_teacher_names:
      row.needs_manual_review_teacher_names ||
      row.needsManualReviewTeacherNames ||
      "",
    summary_only_manual_board_teacher_count: Number(
      row.summary_only_manual_board_teacher_count ||
        row.summaryOnlyManualBoardTeacherCount ||
        0
    ),
    summary_only_manual_board_teacher_names:
      row.summary_only_manual_board_teacher_names ||
      row.summaryOnlyManualBoardTeacherNames ||
      "",
    ready_for_rule_migration_teacher_count: Number(
      row.ready_for_rule_migration_teacher_count ||
        row.readyForRuleMigrationTeacherCount ||
        0
    ),
    ready_for_rule_migration_teacher_names:
      row.ready_for_rule_migration_teacher_names ||
      row.readyForRuleMigrationTeacherNames ||
      "",
    historical_archive_teacher_count: Number(
      row.historical_archive_teacher_count || row.historicalArchiveTeacherCount || 0
    ),
    historical_archive_teacher_names:
      row.historical_archive_teacher_names || row.historicalArchiveTeacherNames || "",
    pending_followup_teacher_count: Number(
      row.pending_followup_teacher_count || row.pendingFollowupTeacherCount || 0
    ),
    pending_followup_teacher_names:
      row.pending_followup_teacher_names || row.pendingFollowupTeacherNames || "",
    high_priority_teacher_count: Number(
      row.high_priority_teacher_count || row.highPriorityTeacherCount || 0
    ),
    high_priority_teacher_names:
      row.high_priority_teacher_names || row.highPriorityTeacherNames || "",
    net_profit_amount_raw: row.net_profit_amount_raw || row.netProfitAmountRaw || "",
    dividend_rate_percent: row.dividend_rate_percent || row.dividendRatePercent || "",
    dividend_pool_amount_raw:
      row.dividend_pool_amount_raw || row.dividendPoolAmountRaw || "",
    retained_profit_amount_raw:
      row.retained_profit_amount_raw || row.retainedProfitAmountRaw || "",
    readiness_status_counts:
      row.readiness_status_counts || row.readinessStatusCounts || "",
  };
}

function normalizeCompensationImportReadinessTeacherRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    source_workbook_names: row.source_workbook_names || row.sourceWorkbookNames || "",
    sheet_kinds: row.sheet_kinds || row.sheetKinds || "",
    has_student_detail_sheet: Number(
      row.has_student_detail_sheet || row.hasStudentDetailSheet || 0
    ),
    has_summary_only_slot_board: Number(
      row.has_summary_only_slot_board || row.hasSummaryOnlySlotBoard || 0
    ),
    has_settlement_statement: Number(
      row.has_settlement_statement || row.hasSettlementStatement || 0
    ),
    detail_row_count: Number(row.detail_row_count || row.detailRowCount || 0),
    detail_student_count: Number(row.detail_student_count || row.detailStudentCount || 0),
    free_slot_count: Number(row.free_slot_count || row.freeSlotCount || 0),
    slot_summary_row_count: Number(
      row.slot_summary_row_count || row.slotSummaryRowCount || 0
    ),
    current_rule_display: row.current_rule_display || row.currentRuleDisplay || "",
    current_rule_source_type:
      row.current_rule_source_type || row.currentRuleSourceType || "",
    current_rule_source_label:
      row.current_rule_source_label || row.currentRuleSourceLabel || "",
    current_rule_source_note:
      row.current_rule_source_note || row.currentRuleSourceNote || "",
    future_rule_display: row.future_rule_display || row.futureRuleDisplay || "",
    future_rule_source_type:
      row.future_rule_source_type || row.futureRuleSourceType || "",
    future_rule_source_label:
      row.future_rule_source_label || row.futureRuleSourceLabel || "",
    future_rule_source_note:
      row.future_rule_source_note || row.futureRuleSourceNote || "",
    suggested_rule_display:
      row.suggested_rule_display || row.suggestedRuleDisplay || "",
    readiness_status: row.readiness_status || row.readinessStatus || "",
    review_priority: row.review_priority || row.reviewPriority || "",
    followup_type: row.followup_type || row.followupType || "",
    resolution_status: row.resolution_status || row.resolutionStatus || "",
    recommended_next_step:
      row.recommended_next_step || row.recommendedNextStep || "",
    projected_readiness_status_after_bulk:
      row.projected_readiness_status_after_bulk ||
      row.projectedReadinessStatusAfterBulk ||
      "",
    bridge_status: row.bridge_status || row.bridgeStatus || "",
    schedule_review_unresolved_row_count: Number(
      row.schedule_review_unresolved_row_count ||
        row.scheduleReviewUnresolvedRowCount ||
        0
    ),
    schedule_review_projected_unresolved_row_count: Number(
      row.schedule_review_projected_unresolved_row_count ||
        row.scheduleReviewProjectedUnresolvedRowCount ||
        0
    ),
    schedule_review_projected_row_by_row_count_after_manual_batches: Number(
      row.schedule_review_projected_row_by_row_count_after_manual_batches ||
        row.scheduleReviewProjectedRowByRowCountAfterManualBatches ||
        0
    ),
  };
}

function normalizeSettlementImportExecutionPeriodRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_period_count: Number(
      row.teacher_period_count || row.teacherPeriodCount || 0
    ),
    executable_candidate_teacher_count: Number(
      row.executable_candidate_teacher_count ||
        row.executableCandidateTeacherCount ||
        0
    ),
    ready_now_teacher_count: Number(
      row.ready_now_teacher_count || row.readyNowTeacherCount || 0
    ),
    ready_after_bulk_teacher_count: Number(
      row.ready_after_bulk_teacher_count || row.readyAfterBulkTeacherCount || 0
    ),
    ready_after_manual_batches_teacher_count: Number(
      row.ready_after_manual_batches_teacher_count ||
        row.readyAfterManualBatchesTeacherCount ||
        0
    ),
    manual_review_after_bulk_teacher_count: Number(
      row.manual_review_after_bulk_teacher_count ||
        row.manualReviewAfterBulkTeacherCount ||
        0
    ),
    row_by_row_teacher_count: Number(
      row.row_by_row_teacher_count || row.rowByRowTeacherCount || 0
    ),
    blocked_missing_statement_teacher_count: Number(
      row.blocked_missing_statement_teacher_count ||
        row.blockedMissingStatementTeacherCount ||
        0
    ),
    blocked_rule_backfill_teacher_count: Number(
      row.blocked_rule_backfill_teacher_count ||
        row.blockedRuleBackfillTeacherCount ||
        0
    ),
    hold_summary_board_teacher_count: Number(
      row.hold_summary_board_teacher_count ||
        row.holdSummaryBoardTeacherCount ||
        0
    ),
    hold_archive_teacher_count: Number(
      row.hold_archive_teacher_count || row.holdArchiveTeacherCount || 0
    ),
    blocked_other_teacher_count: Number(
      row.blocked_other_teacher_count || row.blockedOtherTeacherCount || 0
    ),
    total_schedule_unresolved_row_count: Number(
      row.total_schedule_unresolved_row_count ||
        row.totalScheduleUnresolvedRowCount ||
        0
    ),
    total_batch_gain_row_count: Number(
      row.total_batch_gain_row_count || row.totalBatchGainRowCount || 0
    ),
    total_manual_batch_gain_row_count: Number(
      row.total_manual_batch_gain_row_count ||
        row.totalManualBatchGainRowCount ||
        0
    ),
    net_profit_amount_raw: row.net_profit_amount_raw || row.netProfitAmountRaw || "",
    dividend_rate_percent: row.dividend_rate_percent || row.dividendRatePercent || "",
    profit_readiness_status:
      row.profit_readiness_status || row.profitReadinessStatus || "",
    profit_readiness_status_label:
      row.profit_readiness_status_label ||
      row.profitReadinessStatusLabel ||
      "",
    profit_ready_current_safe_teacher_count: Number(
      row.profit_ready_current_safe_teacher_count ||
        row.profitReadyCurrentSafeTeacherCount ||
        0
    ),
    profit_ready_after_bulk_teacher_count: Number(
      row.profit_ready_after_bulk_teacher_count ||
        row.profitReadyAfterBulkTeacherCount ||
        0
    ),
    profit_ready_after_manual_batches_teacher_count: Number(
      row.profit_ready_after_manual_batches_teacher_count ||
        row.profitReadyAfterManualBatchesTeacherCount ||
        0
    ),
    profit_blocking_teacher_count: Number(
      row.profit_blocking_teacher_count ||
        row.profitBlockingTeacherCount ||
        0
    ),
    profit_blocking_teacher_names: Array.isArray(row.profit_blocking_teacher_names)
      ? row.profit_blocking_teacher_names
      : Array.isArray(row.profitBlockingTeacherNames)
        ? row.profitBlockingTeacherNames
        : [],
    profit_blocking_teacher_names_text:
      row.profit_blocking_teacher_names_text ||
      row.profitBlockingTeacherNamesText ||
      "",
    profit_blocking_wave_counts_text:
      row.profit_blocking_wave_counts_text ||
      row.profitBlockingWaveCountsText ||
      "",
    wave_counts_text: row.wave_counts_text || row.waveCountsText || "",
    next_execution_teacher_names:
      row.next_execution_teacher_names || row.nextExecutionTeacherNames || "",
  };
}

function normalizeSettlementImportWavePackageEntry(row) {
  return {
    package_id: row.package_id || row.packageId || "",
    package_short_id: row.package_short_id || row.packageShortId || "",
    label: row.label || "",
    notes: row.notes || "",
    included_execution_waves: Array.isArray(row.included_execution_waves)
      ? row.included_execution_waves
      : Array.isArray(row.includedExecutionWaves)
        ? row.includedExecutionWaves
        : [],
    included_teacher_period_count: Number(
      row.included_teacher_period_count || row.includedTeacherPeriodCount || 0
    ),
    included_teacher_names: Array.isArray(row.included_teacher_names)
      ? row.included_teacher_names
      : Array.isArray(row.includedTeacherNames)
        ? row.includedTeacherNames
        : [],
    included_period_names: Array.isArray(row.included_period_names)
      ? row.included_period_names
      : Array.isArray(row.includedPeriodNames)
        ? row.includedPeriodNames
        : [],
    included_teacher_periods: Array.isArray(row.included_teacher_periods)
      ? row.included_teacher_periods.map(
          normalizeSettlementImportWavePackageTeacherPeriod
        )
      : Array.isArray(row.includedTeacherPeriods)
        ? row.includedTeacherPeriods.map(
            normalizeSettlementImportWavePackageTeacherPeriod
          )
        : [],
    included_profit_period_names: Array.isArray(row.included_profit_period_names)
      ? row.included_profit_period_names
      : Array.isArray(row.includedProfitPeriodNames)
        ? row.includedProfitPeriodNames
        : [],
    has_profit_ready_periods:
      row.has_profit_ready_periods === true ||
      row.has_profit_ready_periods === 1 ||
      row.has_profit_ready_periods === "1" ||
      row.hasProfitReadyPeriods === true ||
      row.hasProfitReadyPeriods === 1 ||
      row.hasProfitReadyPeriods === "1",
    counts: row.counts && typeof row.counts === "object" ? row.counts : {},
    exported_csv_files: Array.isArray(row.exported_csv_files)
      ? row.exported_csv_files
      : Array.isArray(row.exportedCsvFiles)
        ? row.exportedCsvFiles
        : [],
    preflight_status: row.preflight_status || row.preflightStatus || "",
    preflight_blocking_issue_count: Number(
      row.preflight_blocking_issue_count ||
        row.preflightBlockingIssueCount ||
        0
    ),
    remaining_teacher_period_count: Number(
      row.remaining_teacher_period_count || row.remainingTeacherPeriodCount || 0
    ),
    remaining_execution_wave_counts:
      row.remaining_execution_wave_counts ||
      row.remainingExecutionWaveCounts ||
      {},
    paths: row.paths && typeof row.paths === "object" ? row.paths : {},
  };
}

function normalizeSettlementImportWavePackageTeacherPeriod(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    execution_wave: row.execution_wave || row.executionWave || "",
    execution_wave_label:
      row.execution_wave_label || row.executionWaveLabel || "",
    review_priority: row.review_priority || row.reviewPriority || "",
    current_rule_display:
      row.current_rule_display || row.currentRuleDisplay || "",
    future_rule_display: row.future_rule_display || row.futureRuleDisplay || "",
    recommended_next_step:
      row.recommended_next_step || row.recommendedNextStep || "",
    projected_next_step_after_bulk:
      row.projected_next_step_after_bulk ||
      row.projectedNextStepAfterBulk ||
      "",
  };
}

function normalizeSettlementImportWaveProfitPeriodRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_period_count: Number(
      row.teacher_period_count || row.teacherPeriodCount || 0
    ),
    current_safe_teacher_period_count: Number(
      row.current_safe_teacher_period_count ||
        row.currentSafeTeacherPeriodCount ||
        0
    ),
    current_safe_missing_teacher_period_count: Number(
      row.current_safe_missing_teacher_period_count ||
        row.currentSafeMissingTeacherPeriodCount ||
        0
    ),
    after_bulk_teacher_period_count: Number(
      row.after_bulk_teacher_period_count ||
        row.afterBulkTeacherPeriodCount ||
        0
    ),
    after_bulk_missing_teacher_period_count: Number(
      row.after_bulk_missing_teacher_period_count ||
        row.afterBulkMissingTeacherPeriodCount ||
        0
    ),
    after_manual_batches_teacher_period_count: Number(
      row.after_manual_batches_teacher_period_count ||
        row.afterManualBatchesTeacherPeriodCount ||
        0
    ),
    after_manual_batches_missing_teacher_period_count: Number(
      row.after_manual_batches_missing_teacher_period_count ||
        row.afterManualBatchesMissingTeacherPeriodCount ||
        0
    ),
    profit_readiness_status:
      row.profit_readiness_status || row.profitReadinessStatus || "",
    profit_readiness_status_label:
      row.profit_readiness_status_label ||
      row.profitReadinessStatusLabel ||
      "",
    profit_ready_package_short_id:
      row.profit_ready_package_short_id ||
      row.profitReadyPackageShortId ||
      "",
    profit_ready_package_label:
      row.profit_ready_package_label || row.profitReadyPackageLabel || "",
    blocking_teacher_period_count: Number(
      row.blocking_teacher_period_count ||
        row.blockingTeacherPeriodCount ||
        0
    ),
    blocking_execution_wave_counts:
      row.blocking_execution_wave_counts ||
      row.blockingExecutionWaveCounts ||
      {},
    blocking_execution_wave_counts_text:
      row.blocking_execution_wave_counts_text ||
      row.blockingExecutionWaveCountsText ||
      "",
    blocking_teacher_names: Array.isArray(row.blocking_teacher_names)
      ? row.blocking_teacher_names
      : Array.isArray(row.blockingTeacherNames)
        ? row.blockingTeacherNames
        : [],
    blocking_teacher_names_text:
      row.blocking_teacher_names_text || row.blockingTeacherNamesText || "",
    next_recommended_step:
      row.next_recommended_step || row.nextRecommendedStep || "",
    net_profit_amount_raw:
      row.net_profit_amount_raw || row.netProfitAmountRaw || "",
    dividend_rate_percent:
      row.dividend_rate_percent || row.dividendRatePercent || "",
    wave_counts_text: row.wave_counts_text || row.waveCountsText || "",
  };
}

function normalizeSettlementImportDeferredActionCounts(row) {
  const counts = row && typeof row === "object" ? row : {};
  return {
    bulk_candidate_row_count: Number(
      counts.bulk_candidate_row_count || counts.bulkCandidateRowCount || 0
    ),
    manual_classname_batch_group_count: Number(
      counts.manual_classname_batch_group_count ||
        counts.manualClassnameBatchGroupCount ||
        0
    ),
    manual_classname_batch_row_count: Number(
      counts.manual_classname_batch_row_count ||
        counts.manualClassnameBatchRowCount ||
        0
    ),
    manual_classroom_batch_group_count: Number(
      counts.manual_classroom_batch_group_count ||
        counts.manualClassroomBatchGroupCount ||
        0
    ),
    manual_classroom_batch_row_count: Number(
      counts.manual_classroom_batch_row_count ||
        counts.manualClassroomBatchRowCount ||
        0
    ),
    manual_combined_batch_group_count: Number(
      counts.manual_combined_batch_group_count ||
        counts.manualCombinedBatchGroupCount ||
        0
    ),
    manual_combined_batch_row_count: Number(
      counts.manual_combined_batch_row_count ||
        counts.manualCombinedBatchRowCount ||
        0
    ),
    manual_batch_row_count: Number(
      counts.manual_batch_row_count || counts.manualBatchRowCount || 0
    ),
    residual_row_count: Number(
      counts.residual_row_count || counts.residualRowCount || 0
    ),
    followup_detail_row_count: Number(
      counts.followup_detail_row_count || counts.followupDetailRowCount || 0
    ),
  };
}

function normalizeSettlementImportDeferredActionStageRow(row) {
  return {
    stage_key: row.stage_key || row.stageKey || "",
    label: row.label || "",
    row_count: Number(row.row_count || row.rowCount || 0),
    group_count: Number(row.group_count || row.groupCount || 0),
    path: row.path || "",
    note: row.note || "",
  };
}

function normalizeSettlementImportDeferredActionPackageEntry(row) {
  const rawPaths = row.paths && typeof row.paths === "object" ? row.paths : {};
  const rawArtifactSourcePaths =
    row.artifact_source_paths && typeof row.artifact_source_paths === "object"
      ? row.artifact_source_paths
      : row.artifactSourcePaths && typeof row.artifactSourcePaths === "object"
        ? row.artifactSourcePaths
        : {};
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    execution_wave: row.execution_wave || row.executionWave || "",
    execution_wave_label:
      row.execution_wave_label || row.executionWaveLabel || "",
    review_priority: row.review_priority || row.reviewPriority || "",
    readiness_status: row.readiness_status || row.readinessStatus || "",
    projected_readiness_status_after_bulk:
      row.projected_readiness_status_after_bulk ||
      row.projectedReadinessStatusAfterBulk ||
      "",
    blocking_family: row.blocking_family || row.blockingFamily || "",
    blocking_family_label:
      row.blocking_family_label || row.blockingFamilyLabel || "",
    source_workbook_names: Array.isArray(row.source_workbook_names)
      ? row.source_workbook_names
      : Array.isArray(row.sourceWorkbookNames)
        ? row.sourceWorkbookNames
        : [],
    source_workbook_paths: Array.isArray(row.source_workbook_paths)
      ? row.source_workbook_paths
      : Array.isArray(row.sourceWorkbookPaths)
        ? row.sourceWorkbookPaths
        : [],
    current_rule_display:
      row.current_rule_display || row.currentRuleDisplay || "",
    future_rule_display: row.future_rule_display || row.futureRuleDisplay || "",
    future_rule_source_label:
      row.future_rule_source_label || row.futureRuleSourceLabel || "",
    execution_gate_reason:
      row.execution_gate_reason || row.executionGateReason || "",
    execution_path_summary:
      row.execution_path_summary || row.executionPathSummary || "",
    recommended_next_step:
      row.recommended_next_step || row.recommendedNextStep || "",
    projected_next_step_after_bulk:
      row.projected_next_step_after_bulk ||
      row.projectedNextStepAfterBulk ||
      "",
    suggested_completion_signal:
      row.suggested_completion_signal || row.suggestedCompletionSignal || "",
    counts: normalizeSettlementImportDeferredActionCounts(row.counts),
    expected_counts: normalizeSettlementImportDeferredActionCounts(
      row.expected_counts || row.expectedCounts
    ),
    validation_status:
      row.validation_status || row.validationStatus || "",
    validation_issue_count: Number(
      row.validation_issue_count || row.validationIssueCount || 0
    ),
    validation_issues: Array.isArray(row.validation_issues)
      ? row.validation_issues
      : Array.isArray(row.validationIssues)
        ? row.validationIssues
        : [],
    followup_summary:
      row.followup_summary && typeof row.followup_summary === "object"
        ? row.followup_summary
        : row.followupSummary && typeof row.followupSummary === "object"
          ? row.followupSummary
          : null,
    stage_rows: Array.isArray(row.stage_rows)
      ? row.stage_rows.map(normalizeSettlementImportDeferredActionStageRow)
      : Array.isArray(row.stageRows)
        ? row.stageRows.map(normalizeSettlementImportDeferredActionStageRow)
        : [],
    paths: rawPaths,
    artifact_source_paths: rawArtifactSourcePaths,
  };
}

function normalizeSettlementImportExecutionTeacherRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    execution_wave: row.execution_wave || row.executionWave || "",
    execution_wave_label:
      row.execution_wave_label || row.executionWaveLabel || "",
    execution_wave_order: Number(
      row.execution_wave_order || row.executionWaveOrder || 0
    ),
    review_priority: row.review_priority || row.reviewPriority || "",
    readiness_status: row.readiness_status || row.readinessStatus || "",
    projected_readiness_status_after_bulk:
      row.projected_readiness_status_after_bulk ||
      row.projectedReadinessStatusAfterBulk ||
      "",
    blocking_family: row.blocking_family || row.blockingFamily || "",
    blocking_family_label:
      row.blocking_family_label || row.blockingFamilyLabel || "",
    action_stage: row.action_stage || row.actionStage || "",
    action_stage_label: row.action_stage_label || row.actionStageLabel || "",
    is_migratable_now: Number(
      row.is_migratable_now || row.isMigratableNow || 0
    ),
    is_migratable_after_bulk: Number(
      row.is_migratable_after_bulk || row.isMigratableAfterBulk || 0
    ),
    is_migratable_after_manual_batches: Number(
      row.is_migratable_after_manual_batches ||
        row.isMigratableAfterManualBatches ||
        0
    ),
    requires_manual_review_after_bulk: Number(
      row.requires_manual_review_after_bulk ||
        row.requiresManualReviewAfterBulk ||
        0
    ),
    requires_row_by_row_final: Number(
      row.requires_row_by_row_final || row.requiresRowByRowFinal || 0
    ),
    is_hold: Number(row.is_hold || row.isHold || 0),
    is_blocked: Number(row.is_blocked || row.isBlocked || 0),
    has_settlement_statement: Number(
      row.has_settlement_statement || row.hasSettlementStatement || 0
    ),
    has_student_detail_sheet: Number(
      row.has_student_detail_sheet || row.hasStudentDetailSheet || 0
    ),
    has_summary_only_slot_board: Number(
      row.has_summary_only_slot_board || row.hasSummaryOnlySlotBoard || 0
    ),
    source_workbook_names: row.source_workbook_names || row.sourceWorkbookNames || "",
    sheet_kinds: row.sheet_kinds || row.sheetKinds || "",
    current_rule_display: row.current_rule_display || row.currentRuleDisplay || "",
    future_rule_display: row.future_rule_display || row.futureRuleDisplay || "",
    future_rule_source_label:
      row.future_rule_source_label || row.futureRuleSourceLabel || "",
    detail_row_count: Number(row.detail_row_count || row.detailRowCount || 0),
    free_slot_count: Number(row.free_slot_count || row.freeSlotCount || 0),
    schedule_review_unresolved_row_count: Number(
      row.schedule_review_unresolved_row_count ||
        row.scheduleReviewUnresolvedRowCount ||
        0
    ),
    schedule_review_projected_unresolved_row_count: Number(
      row.schedule_review_projected_unresolved_row_count ||
        row.scheduleReviewProjectedUnresolvedRowCount ||
        0
    ),
    schedule_review_projected_row_by_row_count_after_manual_batches: Number(
      row.schedule_review_projected_row_by_row_count_after_manual_batches ||
        row.scheduleReviewProjectedRowByRowCountAfterManualBatches ||
        0
    ),
    schedule_review_auto_candidate_count: Number(
      row.schedule_review_auto_candidate_count ||
        row.scheduleReviewAutoCandidateCount ||
        0
    ),
    schedule_review_manual_classname_batch_row_count: Number(
      row.schedule_review_manual_classname_batch_row_count ||
        row.scheduleReviewManualClassnameBatchRowCount ||
        0
    ),
    schedule_review_manual_classroom_batch_row_count: Number(
      row.schedule_review_manual_classroom_batch_row_count ||
        row.scheduleReviewManualClassroomBatchRowCount ||
        0
    ),
    schedule_review_manual_combined_batch_row_count: Number(
      row.schedule_review_manual_combined_batch_row_count ||
        row.scheduleReviewManualCombinedBatchRowCount ||
        0
    ),
    schedule_review_manual_batch_row_count: Number(
      row.schedule_review_manual_batch_row_count ||
        row.scheduleReviewManualBatchRowCount ||
        0
    ),
    schedule_review_manual_row_by_row_count: Number(
      row.schedule_review_manual_row_by_row_count ||
        row.scheduleReviewManualRowByRowCount ||
        0
    ),
    schedule_batch_gain_row_count: Number(
      row.schedule_batch_gain_row_count || row.scheduleBatchGainRowCount || 0
    ),
    schedule_manual_batch_gain_row_count: Number(
      row.schedule_manual_batch_gain_row_count ||
        row.scheduleManualBatchGainRowCount ||
        0
    ),
    revenue_total_amount: row.revenue_total_amount || row.revenueTotalAmount || "",
    component_total_amount:
      row.component_total_amount || row.componentTotalAmount || "",
    net_profit_amount_raw: row.net_profit_amount_raw || row.netProfitAmountRaw || "",
    dividend_rate_percent: row.dividend_rate_percent || row.dividendRatePercent || "",
    profit_unlock_stage:
      row.profit_unlock_stage || row.profitUnlockStage || "",
    profit_unlock_stage_label:
      row.profit_unlock_stage_label || row.profitUnlockStageLabel || "",
    blocks_period_profit_current_safe: Number(
      row.blocks_period_profit_current_safe ||
        row.blocksPeriodProfitCurrentSafe ||
        0
    ),
    blocks_period_profit_after_bulk: Number(
      row.blocks_period_profit_after_bulk ||
        row.blocksPeriodProfitAfterBulk ||
        0
    ),
    blocks_period_profit_after_manual_batches: Number(
      row.blocks_period_profit_after_manual_batches ||
        row.blocksPeriodProfitAfterManualBatches ||
        0
    ),
    execution_gate_reason:
      row.execution_gate_reason || row.executionGateReason || "",
    execution_path_summary:
      row.execution_path_summary || row.executionPathSummary || "",
    focus_reason: row.focus_reason || row.focusReason || "",
    operator_hint: row.operator_hint || row.operatorHint || "",
    recommended_next_step:
      row.recommended_next_step || row.recommendedNextStep || "",
    projected_next_step_after_bulk:
      row.projected_next_step_after_bulk ||
      row.projectedNextStepAfterBulk ||
      "",
    suggested_input_files:
      Array.isArray(row.suggested_input_files)
        ? row.suggested_input_files
        : Array.isArray(row.suggestedInputFiles)
          ? row.suggestedInputFiles
          : [],
    suggested_completion_signal:
      row.suggested_completion_signal || row.suggestedCompletionSignal || "",
    action_priority_score: Number(
      row.action_priority_score || row.actionPriorityScore || 0
    ),
  };
}

function normalizeSettlementOpsActionPeriodRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_period_count: Number(
      row.teacher_period_count || row.teacherPeriodCount || 0
    ),
    actionable_teacher_period_count: Number(
      row.actionable_teacher_period_count || row.actionableTeacherPeriodCount || 0
    ),
    ready_now_teacher_count: Number(
      row.ready_now_teacher_count || row.readyNowTeacherCount || 0
    ),
    ready_after_bulk_teacher_count: Number(
      row.ready_after_bulk_teacher_count || row.readyAfterBulkTeacherCount || 0
    ),
    missing_statement_teacher_count: Number(
      row.missing_statement_teacher_count || row.missingStatementTeacherCount || 0
    ),
    summary_board_teacher_count: Number(
      row.summary_board_teacher_count || row.summaryBoardTeacherCount || 0
    ),
    historical_archive_teacher_count: Number(
      row.historical_archive_teacher_count || row.historicalArchiveTeacherCount || 0
    ),
    schedule_bulk_first_teacher_count: Number(
      row.schedule_bulk_first_teacher_count ||
        row.scheduleBulkFirstTeacherCount ||
        0
    ),
    schedule_manual_batch_teacher_count: Number(
      row.schedule_manual_batch_teacher_count ||
        row.scheduleManualBatchTeacherCount ||
        0
    ),
    schedule_row_by_row_teacher_count: Number(
      row.schedule_row_by_row_teacher_count ||
        row.scheduleRowByRowTeacherCount ||
        0
    ),
    total_schedule_unresolved_row_count: Number(
      row.total_schedule_unresolved_row_count ||
        row.totalScheduleUnresolvedRowCount ||
        0
    ),
    total_batch_gain_row_count: Number(
      row.total_batch_gain_row_count || row.totalBatchGainRowCount || 0
    ),
    net_profit_amount_raw: row.net_profit_amount_raw || row.netProfitAmountRaw || "",
    dividend_rate_percent: row.dividend_rate_percent || row.dividendRatePercent || "",
    profit_readiness_status:
      row.profit_readiness_status || row.profitReadinessStatus || "",
    profit_readiness_status_label:
      row.profit_readiness_status_label ||
      row.profitReadinessStatusLabel ||
      "",
    profit_ready_current_safe_teacher_count: Number(
      row.profit_ready_current_safe_teacher_count ||
        row.profitReadyCurrentSafeTeacherCount ||
        0
    ),
    profit_ready_after_bulk_teacher_count: Number(
      row.profit_ready_after_bulk_teacher_count ||
        row.profitReadyAfterBulkTeacherCount ||
        0
    ),
    profit_ready_after_manual_batches_teacher_count: Number(
      row.profit_ready_after_manual_batches_teacher_count ||
        row.profitReadyAfterManualBatchesTeacherCount ||
        0
    ),
    profit_blocking_teacher_count: Number(
      row.profit_blocking_teacher_count ||
        row.profitBlockingTeacherCount ||
        0
    ),
    profit_blocking_teacher_names: Array.isArray(row.profit_blocking_teacher_names)
      ? row.profit_blocking_teacher_names
      : Array.isArray(row.profitBlockingTeacherNames)
        ? row.profitBlockingTeacherNames
        : [],
    profit_blocking_teacher_names_text:
      row.profit_blocking_teacher_names_text ||
      row.profitBlockingTeacherNamesText ||
      "",
    profit_blocking_stage_counts_text:
      row.profit_blocking_stage_counts_text ||
      row.profitBlockingStageCountsText ||
      "",
    action_stage_counts_text:
      row.action_stage_counts_text || row.actionStageCountsText || "",
    blocking_family_counts_text:
      row.blocking_family_counts_text || row.blockingFamilyCountsText || "",
    top_action_teacher_names:
      row.top_action_teacher_names || row.topActionTeacherNames || "",
  };
}

function normalizeSettlementOpsActionTeacherRow(row) {
  return {
    period_name: row.period_name || row.periodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    review_priority: row.review_priority || row.reviewPriority || "",
    readiness_status: row.readiness_status || row.readinessStatus || "",
    projected_readiness_status_after_bulk:
      row.projected_readiness_status_after_bulk ||
      row.projectedReadinessStatusAfterBulk ||
      "",
    blocking_family: row.blocking_family || row.blockingFamily || "",
    blocking_family_label:
      row.blocking_family_label || row.blockingFamilyLabel || "",
    action_stage: row.action_stage || row.actionStage || "",
    action_stage_label: row.action_stage_label || row.actionStageLabel || "",
    is_actionable: Number(row.is_actionable || row.isActionable || 0),
    is_ready_now: Number(row.is_ready_now || row.isReadyNow || 0),
    is_ready_after_bulk: Number(
      row.is_ready_after_bulk || row.isReadyAfterBulk || 0
    ),
    has_settlement_statement: Number(
      row.has_settlement_statement || row.hasSettlementStatement || 0
    ),
    has_student_detail_sheet: Number(
      row.has_student_detail_sheet || row.hasStudentDetailSheet || 0
    ),
    has_summary_only_slot_board: Number(
      row.has_summary_only_slot_board || row.hasSummaryOnlySlotBoard || 0
    ),
    source_workbook_names: row.source_workbook_names || row.sourceWorkbookNames || "",
    sheet_kinds: row.sheet_kinds || row.sheetKinds || "",
    current_rule_display:
      row.current_rule_display || row.currentRuleDisplay || "",
    future_rule_display: row.future_rule_display || row.futureRuleDisplay || "",
    future_rule_source_label:
      row.future_rule_source_label || row.futureRuleSourceLabel || "",
    detail_row_count: Number(row.detail_row_count || row.detailRowCount || 0),
    free_slot_count: Number(row.free_slot_count || row.freeSlotCount || 0),
    schedule_review_unresolved_row_count: Number(
      row.schedule_review_unresolved_row_count ||
        row.scheduleReviewUnresolvedRowCount ||
        0
    ),
    schedule_review_projected_unresolved_row_count: Number(
      row.schedule_review_projected_unresolved_row_count ||
        row.scheduleReviewProjectedUnresolvedRowCount ||
        0
    ),
    schedule_review_projected_row_by_row_count_after_manual_batches: Number(
      row.schedule_review_projected_row_by_row_count_after_manual_batches ||
        row.scheduleReviewProjectedRowByRowCountAfterManualBatches ||
        0
    ),
    schedule_review_auto_candidate_count: Number(
      row.schedule_review_auto_candidate_count ||
        row.scheduleReviewAutoCandidateCount ||
        0
    ),
    schedule_review_manual_classname_batch_row_count: Number(
      row.schedule_review_manual_classname_batch_row_count ||
        row.scheduleReviewManualClassnameBatchRowCount ||
        0
    ),
    schedule_review_manual_classroom_batch_row_count: Number(
      row.schedule_review_manual_classroom_batch_row_count ||
        row.scheduleReviewManualClassroomBatchRowCount ||
        0
    ),
    schedule_review_manual_combined_batch_row_count: Number(
      row.schedule_review_manual_combined_batch_row_count ||
        row.scheduleReviewManualCombinedBatchRowCount ||
        0
    ),
    schedule_review_manual_batch_row_count: Number(
      row.schedule_review_manual_batch_row_count ||
        row.scheduleReviewManualBatchRowCount ||
        0
    ),
    schedule_review_manual_row_by_row_count: Number(
      row.schedule_review_manual_row_by_row_count ||
        row.scheduleReviewManualRowByRowCount ||
        0
    ),
    schedule_batch_gain_row_count: Number(
      row.schedule_batch_gain_row_count || row.scheduleBatchGainRowCount || 0
    ),
    schedule_manual_batch_gain_row_count: Number(
      row.schedule_manual_batch_gain_row_count ||
        row.scheduleManualBatchGainRowCount ||
        0
    ),
    revenue_total_amount:
      row.revenue_total_amount || row.revenueTotalAmount || "",
    component_total_amount:
      row.component_total_amount || row.componentTotalAmount || "",
    net_profit_amount_raw: row.net_profit_amount_raw || row.netProfitAmountRaw || "",
    dividend_rate_percent: row.dividend_rate_percent || row.dividendRatePercent || "",
    profit_unlock_stage:
      row.profit_unlock_stage || row.profitUnlockStage || "",
    profit_unlock_stage_label:
      row.profit_unlock_stage_label || row.profitUnlockStageLabel || "",
    blocks_period_profit_current_safe: Number(
      row.blocks_period_profit_current_safe ||
        row.blocksPeriodProfitCurrentSafe ||
        0
    ),
    blocks_period_profit_after_bulk: Number(
      row.blocks_period_profit_after_bulk ||
        row.blocksPeriodProfitAfterBulk ||
        0
    ),
    blocks_period_profit_after_manual_batches: Number(
      row.blocks_period_profit_after_manual_batches ||
        row.blocksPeriodProfitAfterManualBatches ||
        0
    ),
    focus_reason: row.focus_reason || row.focusReason || "",
    operator_hint: row.operator_hint || row.operatorHint || "",
    recommended_next_step:
      row.recommended_next_step || row.recommendedNextStep || "",
    projected_next_step_after_bulk:
      row.projected_next_step_after_bulk ||
      row.projectedNextStepAfterBulk ||
      "",
    suggested_input_files: parseLooseStringArray(
      row.suggested_input_files || row.suggestedInputFiles
    ),
    suggested_completion_signal:
      row.suggested_completion_signal || row.suggestedCompletionSignal || "",
    action_priority_score: Number(
      row.action_priority_score || row.actionPriorityScore || 0
    ),
  };
}

function normalizeTeacherRuleBackfillTemplate(report) {
  if (!report || typeof report !== "object") {
    return createEmptyTeacherRuleBackfillTemplate();
  }

  const rawSummary = report.summary && typeof report.summary === "object" ? report.summary : {};
  return {
    status: report.status || "",
    summary: {
      row_count: Number(rawSummary.row_count || rawSummary.rowCount || 0),
      period_counts: rawSummary.period_counts || rawSummary.periodCounts || {},
      confidence_counts: rawSummary.confidence_counts || rawSummary.confidenceCounts || {},
    },
    rows: Array.isArray(report.rows)
      ? report.rows.map(normalizeTeacherRuleBackfillRow)
      : [],
  };
}

function normalizeTeacherRuleBackfillRow(row) {
  return {
    target_period_name: row.target_period_name || row.targetPeriodName || "",
    teacher_name: row.teacher_name || row.teacherName || "",
    confirm_status: row.confirm_status || row.confirmStatus || "pending",
    suggestion_confidence: row.suggestion_confidence || row.suggestionConfidence || "",
    source_period_name: row.source_period_name || row.sourcePeriodName || "",
    source_rule_display: row.source_rule_display || row.sourceRuleDisplay || "",
    source_effective_start_date:
      row.source_effective_start_date || row.sourceEffectiveStartDate || "",
    source_effective_end_date:
      row.source_effective_end_date || row.sourceEffectiveEndDate || "",
    effective_start_date: row.effective_start_date || row.effectiveStartDate || "",
    effective_end_date: row.effective_end_date || row.effectiveEndDate || "",
    settlement_cycle: row.settlement_cycle || row.settlementCycle || "",
    calc_mode: row.calc_mode || row.calcMode || "",
    base_amount: row.base_amount || row.baseAmount || "",
    hourly_amount: row.hourly_amount || row.hourlyAmount || "",
    per_student_amount: row.per_student_amount || row.perStudentAmount || "",
    revenue_share_ratio: row.revenue_share_ratio || row.revenueShareRatio || "",
    source_rule_notes: row.source_rule_notes || row.sourceRuleNotes || "",
    suggestion_note: row.suggestion_note || row.suggestionNote || "",
    recommended_action: row.recommended_action || row.recommendedAction || "",
    notes: row.notes || "",
  };
}

function buildTeacherRuleBackfillSummary(rows) {
  const period_counts = {};
  const confidence_counts = {};
  rows.forEach((row) => {
    const periodName = String(row.target_period_name || "").trim();
    const confidence = String(row.suggestion_confidence || "").trim();
    if (periodName) {
      period_counts[periodName] = (period_counts[periodName] || 0) + 1;
    }
    if (confidence) {
      confidence_counts[confidence] = (confidence_counts[confidence] || 0) + 1;
    }
  });
  return {
    row_count: rows.length,
    period_counts,
    confidence_counts,
  };
}

function buildTeacherRuleBackfillTemplateFromRows(rows) {
  return {
    status: rows.length ? "ok" : "",
    summary: buildTeacherRuleBackfillSummary(rows),
    rows,
  };
}

function getEntityItems(entity) {
  if (entity === "teacherRuleBackfillRow") {
    return state.teacherRuleBackfillTemplate?.rows || [];
  }
  return state[getCollectionName(entity)] || [];
}

function getDefaultEntityItems(entity) {
  if (entity === "teacherRuleBackfillRow") {
    return DEFAULT_STATE.teacherRuleBackfillTemplate?.rows || [];
  }
  return DEFAULT_STATE[getCollectionName(entity)] || [];
}

function applyEntityImport(entity, imported, mode) {
  if (entity === "teacherRuleBackfillRow") {
    const existing = state.teacherRuleBackfillTemplate?.rows || [];
    const rows = mode === "replace" ? imported : [...existing, ...imported];
    state.teacherRuleBackfillTemplate = buildTeacherRuleBackfillTemplateFromRows(rows);
    return;
  }

  const collectionName = getCollectionName(entity);
  state[collectionName] = mode === "replace" ? imported : [...state[collectionName], ...imported];
}

function createTeacher(name, subject, gradeFrom, gradeTo, isCore, isKey, isOwner, maxPerDay, maxPerWeek, weeklyRestDay, schedulePattern, fixedRoom, noEvening) {
  return normalizeTeacher({
    id: makeId("teacher"),
    name,
    subject,
    gradeFrom,
    gradeTo,
    isCore,
    isKey,
    isOwner,
    maxPerDay,
    maxPerWeek,
    weeklyRestDay,
    schedulePattern,
    fixedRoom,
    noEvening,
    status: "active",
  });
}

function createRoom(name, floor, maxCapacity, roomType, isFixed, summerPriority, notes) {
  return normalizeRoom({
    id: makeId("room"),
    name,
    floor,
    maxCapacity,
    roomType,
    isFixed,
    summerPriority,
    notes,
    isActive: true,
  });
}

function createDemand(
  name,
  subject,
  grade,
  size,
  courseType,
  weeklySessions,
  estimatedRevenuePerSession,
  preferredTime,
  fixedTeacher,
  fixedRoom,
  status
) {
  return normalizeDemand({
    id: makeId("demand"),
    name,
    subject,
    grade,
    size,
    courseType,
    weeklySessions,
    estimatedRevenuePerSession,
    preferredTime,
    fixedTeacher,
    fixedRoom,
    status,
  });
}

function createFinancialPeriod(periodName, grossProfit, totalExpense, teachingBusinessExpense, netProfit) {
  return normalizeFinancialPeriod({
    id: makeId("financial"),
    periodName,
    grossProfit,
    totalExpense,
    teachingBusinessExpense,
    netProfit,
  });
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseValue(rawValue, type) {
  if (type === "number") {
    return Number(rawValue || 0);
  }
  if (type === "boolean") {
    return rawValue === "true";
  }
  return rawValue;
}

function parseBooleanLoose(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "是"].includes(normalized);
}

function parseLooseStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch (error) {
    // Ignore JSON parse failure and fall back to text splitting.
  }
  return raw
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLooseJsonValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  const raw = String(value).trim();
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function toBinary(value) {
  return value ? 1 : 0;
}

function normalizeDemandStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["confirmed", "active", "已确认"].includes(normalized)) {
    return "confirmed";
  }
  if (["planned", "plan", "计划中"].includes(normalized)) {
    return "planned";
  }
  return "recruiting";
}

function getCollectionName(entity) {
  if (entity === "teacher") {
    return "teachers";
  }
  if (entity === "room") {
    return "rooms";
  }
  if (entity === "financialPeriod") {
    return "financialPeriods";
  }
  if (entity === "summerClassRevenueRow") {
    return "summerClassRevenueRows";
  }
  if (entity === "dividendPolicy") {
    return "dividendPolicies";
  }
  if (entity === "profitExpenseLine") {
    return "profitExpenseLines";
  }
  if (entity === "settlementStatement") {
    return "settlementStatements";
  }
  if (entity === "settlementLine") {
    return "settlementLines";
  }
  if (entity === "compensationRule") {
    return "compensationRules";
  }
  if (entity === "compensationRuleItem") {
    return "compensationRuleItems";
  }
  if (entity === "nonBillableSlot") {
    return "nonBillableSlots";
  }
  if (entity === "compensationSlotSummary") {
    return "compensationSlotSummaries";
  }
  if (entity === "settlementReviewResolution") {
    return "settlementReviewResolutions";
  }
  return "demands";
}

function formatEntityLabel(entity) {
  return {
    teacher: "老师",
    room: "教室",
    demand: "待开班",
    financialPeriod: "月度利润",
    summerClassRevenueRow: "暑期单节收入模板",
    dividendPolicy: "分红政策",
    profitExpenseLine: "月度费用明细",
    settlementStatement: "老师月结算汇总",
    settlementLine: "老师结算明细",
    compensationRule: "老师提成主规则",
    compensationRuleItem: "老师提成覆盖",
    nonBillableSlot: "免费时间档",
    compensationSlotSummary: "汇总型时间档板",
    settlementReviewResolution: "结算复核结果",
    teacherRuleBackfillRow: "主规则回填建议",
  }[entity];
}

function hasMeaningfulContent(item, entity) {
  if (entity === "teacher") {
    return Boolean(item.name);
  }
  if (entity === "room") {
    return Boolean(item.name);
  }
  if (entity === "financialPeriod") {
    return Boolean(item.periodName);
  }
  if (entity === "summerClassRevenueRow") {
    return Boolean(item.className);
  }
  if (entity === "dividendPolicy") {
    return Boolean(item.effectiveStartPeriod);
  }
  if (entity === "profitExpenseLine") {
    return Boolean(item.periodName && item.categoryName);
  }
  if (entity === "settlementStatement") {
    return Boolean(item.periodName && item.teacherName);
  }
  if (entity === "settlementLine") {
    return Boolean(item.periodName && item.teacherName && item.studentName);
  }
  if (entity === "compensationRule") {
    return Boolean(item.teacherName && item.effectiveStartDate);
  }
  if (entity === "compensationRuleItem") {
    return Boolean(item.teacherName && item.effectiveStartDate);
  }
  if (entity === "nonBillableSlot") {
    return Boolean(item.periodName && item.teacherName);
  }
  if (entity === "compensationSlotSummary") {
    return Boolean(item.periodName && item.ownerTeacherName && item.relatedTeacherName && item.metricType);
  }
  if (entity === "settlementReviewResolution") {
    return Boolean(item.periodName && item.teacherName);
  }
  if (entity === "teacherRuleBackfillRow") {
    return Boolean(item.target_period_name && item.teacher_name);
  }
  return Boolean(item.name);
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || "").trim();
    });
    return record;
  });
}

function stringifyCsv(headers, rows) {
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => escapeCsvCell(row[header]))
        .join(",")
    ),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

function escapeCsvCell(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function roundAmount(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function toNumber(value) {
  const normalized =
    typeof value === "string" ? value.replaceAll(",", "").trim() : value;
  const parsed = Number(normalized || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

function formatCurrencyOrDash(value) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  return formatCurrency(value);
}

function formatCompactSlotValue(value) {
  const amount = Number(value || 0);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function formatAmountText(value) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? formatCurrency(parsed) : String(value);
}

function formatSignedAmountText(value) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  const parsed = toNumber(value);
  const prefix = parsed > 0 ? "+" : parsed < 0 ? "-" : "";
  return `${prefix}${formatCurrency(Math.abs(parsed))}`;
}

function formatCompactCurrency(value) {
  const amount = toNumber(value);
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(1)}万`;
  }
  return formatCurrency(amount);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatRatioPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatPercentText(value) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}%` : String(value);
}

function formatDiagnosticStatus(status) {
  return {
    ok: "正常",
    needs_review: "待复核",
  }[String(status || "").trim()] || "未识别";
}

function formatDiagnosticFlag(flag) {
  return {
    missing_calendar_rows_for_settlement_teacher: "结算有，课表缺老师",
    low_settlement_student_match_rate: "结算学生匹配率低",
    low_calendar_student_match_rate: "课表学生匹配率低",
    calendar_rows_without_settlement_statement: "课表有，结算汇总缺失",
    missing_settlement_detail_rows: "汇总有，明细缺失",
    roster_supports_some_settlement_only_names: "部分结算学生可被名册解释",
    settlement_students_absent_from_schedule_sources: "部分结算学生在排课源缺失",
    teacher_missing_from_calendar_exports: "老师时间表导出缺失",
    teaching_commission_mismatch: "课时提成差额",
    missing_detail_rows: "没有学生级明细",
    source_sheet_is_summary_only_slot_board: "源表是汇总型时间档板",
    slot_summary_board_captured: "汇总型时间档板已保留",
  }[flag] || flag;
}

function formatReviewPriority(priority) {
  return {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级",
  }[String(priority || "").trim()] || "未识别";
}

function formatBulkRecommendationAction(action) {
  return {
    apply_class_name: "班名批量确认",
    apply_classroom: "教室批量确认",
    apply_class_name_and_classroom: "班名+教室一起确认",
  }[String(action || "").trim()] || (action || "未识别动作");
}

function formatClassnameBatchConfidence(confidence) {
  return {
    high: "高",
    medium: "中",
    low: "低",
    none: "无",
  }[String(confidence || "").trim()] || (confidence || "未标注");
}

function formatClassnameBatchRecommendationBasis(basis) {
  return {
    alias_is_formal: "别名本身已是正式班名",
    numbered_alias_expand: "编号别名补全班字",
    grade_alias_keep: "年级别名沿用原写法",
    alias_rule_with_exact_history_evidence: "别名规则 + 精确历史命中",
    alias_rule_with_related_samples: "别名规则 + 相关历史样本",
    alias_rule_only: "仅别名规则推断",
    none: "无建议",
  }[String(basis || "").trim()] || (basis || "未标注");
}

function formatResolutionStatus(status) {
  return {
    pending: "待处理",
    in_progress: "处理中",
    resolved: "已关闭",
    wont_fix: "仅记录，不处理",
  }[String(status || "").trim()] || "未填写";
}

function formatResolutionType(type) {
  return {
    source_file_missing: "补源文件",
    missing_statement_acknowledged: "结算单缺失已确认",
    summary_only_acknowledged: "汇总型时间档板已确认",
    historical_gap_acknowledged: "历史差异已确认",
    manual_adjustment_required: "需要人工调整",
    reextract_required: "需要重抽取",
  }[String(type || "").trim()] || (type || "未填写");
}

function formatFollowupType(type) {
  return {
    missing_statement_review: "缺老师月结算单",
    summary_slot_board_review: "汇总型时间档板复核",
    persistent_student_gap_review: "结算学生持续缺失",
    schedule_classroom_review: "排课缺教室复核",
    schedule_class_name_review: "排课班名复核",
    manual_review: "人工判断",
  }[String(type || "").trim()] || (type || "未识别");
}

function formatProfileReadinessStatus(status) {
  return {
    ready_for_rule_migration: "可迁移为自动结算底稿",
    historical_archive_confirmed: "历史归档已确认",
    needs_source_backfill: "需补排课源",
    summary_only_manual_board: "汇总型人工板",
    missing_statement: "缺老师月结算汇总",
    needs_rule_inference: "缺主规则",
    needs_schedule_review: "排课复核未完成",
    needs_manual_review: "仍需人工复核",
    needs_free_slot_cleanup: "免费档待清洗",
  }[String(status || "").trim()] || (status || "未识别");
}

function formatProfileSuggestionConfidence(confidence) {
  return {
    high: "高",
    medium: "中",
    low: "低",
  }[String(confidence || "").trim()] || (confidence || "未识别");
}

function formatRuleBackfillConfirmStatus(status) {
  return {
    pending: "待确认",
    confirmed: "已确认",
    approved: "已确认",
    apply: "待合并",
    applied: "已合并",
    skipped: "已跳过",
  }[String(status || "").trim()] || (status || "未填写");
}

function formatTeacherCompensationPolicyStatus(status) {
  return {
    covered: "已覆盖",
    default_policy_pending_uplift: "默认 20% 待涨幅",
    future_policy_confirmed: "未来规则已确认",
    duplicate_override_scope: "覆盖项重复",
    overlap_issue: "规则重叠",
    future_gap: "未来断档",
    current_rule_missing: "当前缺规则",
    inactive_archive: "历史归档",
  }[String(status || "").trim()] || (status || "未识别");
}

function formatScheduleSettlementStatus(status) {
  return {
    missing_rule: "缺结算规则",
    incomplete_rule_config: "规则字段不全",
    revenue_input_required: "缺收入口径",
    partial_rule_support: "部分可投影",
    projectable: "可直接投影",
  }[String(status || "").trim()] || (status || "未识别");
}

function summerScheduleStatusWeight(status) {
  return {
    missing_rule: 0,
    incomplete_rule_config: 1,
    revenue_input_required: 2,
    partial_rule_support: 3,
    projectable: 4,
  }[String(status || "").trim()] ?? 9;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateForFile(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function backfillConfirmStatusWeight(status) {
  return {
    pending: 0,
    confirmed: 1,
    approved: 1,
    apply: 2,
    applied: 3,
    skipped: 4,
  }[String(status || "").trim()] ?? 9;
}

function getFileExtension(filename) {
  const parts = String(filename || "").toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function resolveEntityFromFilename(filename) {
  return IMPORT_READY_FILE_MAP[String(filename || "").trim().toLowerCase()] || "";
}

function formatOption(option) {
  const labels = {
    math: "数学",
    science: "科学",
    small_class: "小班",
    medium_class: "中班",
    large_class: "大班",
    one_to_one: "一对一",
    "6_on_1_off": "上六休一",
    "3_on_1_off": "三上一休",
    evening: "晚课优先",
    weekend: "周末优先",
    flexible: "灵活",
    recruiting: "招生中",
    planned: "计划中",
    confirmed: "已确认",
    active: "启用",
    inactive: "停用",
  };
  return labels[option] || option;
}

function formatExpenseScope(scope) {
  return {
    total_expense: "总支出",
    teaching_business_expense: "小课支出",
  }[scope] || scope || "未分类";
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
