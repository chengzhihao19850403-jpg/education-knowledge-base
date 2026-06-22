const STORAGE_KEY = "paike-june-system-v1";
const STORAGE_META_KEY = "paike-june-system-meta-v1";
const BUNDLED_SNAPSHOT_PATH = "./june-default-snapshot.json";
const BACKEND_STATE_KEY = "june_regular";
const REGULAR_PRIMARY_MONTH = "2026-06";
const LOCAL_DB_HEALTH_PATH = "/api/health";
const LOCAL_DB_STATE_PATH = "/api/state";
const LOCAL_DB_HISTORY_PATH = "/api/history";
const LOCAL_DB_RESTORE_PATH = "/api/restore";
const LOCAL_DB_IMPORT_REGULAR_CSV_PATH = "/api/import/june-regular-csv";
const LOCAL_DB_IMPORT_REGULAR_XLSX_PATH = "/api/import/june-regular-xlsx";
const LOCAL_DB_IMPORT_REGULAR_ROWS_PATH = "/api/import/june-regular-rows";
const LOCAL_DB_AUTOSAVE_DELAY_MS = 800;
const LOCAL_DB_WEB_PROTOCOLS = new Set(["http:", "https:"]);
const NON_PROMOTABLE_BROWSER_SNAPSHOT_ORIGINS = new Set([
  "bundled_snapshot",
  "backend_database",
]);
const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const REGULAR_MODE_WEEKDAY_INDEXES = new Set([2, 3, 4]);
const REGULAR_MODE_WEEKEND_INDEXES = new Set([5, 6]);
const REGULAR_MODE_EVENING_START_MINUTES = 17 * 60;
const REGULAR_MODE_WEEKDAY_PRESET_SLOTS = [
  { slotIndex: 1, startTime: "18:30", endTime: "20:00" },
];
const REGULAR_MODE_WEEKEND_PRESET_SLOTS = [
  { slotIndex: 1, startTime: "08:30", endTime: "10:00" },
  { slotIndex: 2, startTime: "10:10", endTime: "11:40" },
  { slotIndex: 3, startTime: "13:00", endTime: "14:30" },
  { slotIndex: 4, startTime: "14:40", endTime: "16:10" },
  { slotIndex: 5, startTime: "16:20", endTime: "17:50" },
  { slotIndex: 6, startTime: "18:30", endTime: "20:00" },
];

function createEmptyState() {
  return {
    teachers: [],
    rooms: [],
    scheduleEntries: [],
  };
}

function createTeacher(name, subject = "") {
  return {
    id: makeId("june-teacher"),
    name: String(name || "").trim(),
    subject: String(subject || "").trim(),
  };
}

function createRoom(name, floor = "") {
  return {
    id: makeId("june-room"),
    name: String(name || "").trim(),
    floor: String(floor || "").trim() || inferFloorFromRoomName(name),
  };
}

function createEntry(values = {}) {
  return normalizeEntry({
    id: values.id || makeId("june-entry"),
    teacherName: values.teacherName || "",
    className: values.className || "",
    courseDate: values.courseDate || "",
    slotIndex: values.slotIndex || 0,
    startTime: values.startTime || "",
    endTime: values.endTime || "",
    classroomName: values.classroomName || "",
    scheduleStatus: values.scheduleStatus || "scheduled",
    confirmationStatus: values.confirmationStatus || "pending",
    notes: values.notes || "",
  });
}

function createEmptyLocalDbStatus(overrides = {}) {
  return {
    available: false,
    lastSavedAt: "",
    lastError: "",
    dbPath: "",
    backupDir: "",
    releaseDir: "",
    baseUrl: "",
    configuredBaseUrl: "",
    connectionMode: "browser",
    healthUrl: "",
    stateUrl: "",
    historyUrl: "",
    restoreUrl: "",
    importRegularCsvUrl: "",
    importRegularXlsxUrl: "",
    importRegularRowsUrl: "",
    ...overrides,
  };
}

function createEmptyUiState() {
  return {
    selectedMonth: "",
    selectedTeacherName: "all",
    selectedDate: "",
    selectedRoomName: "all",
    selectedStatus: "all",
    selectedConfirmation: "all",
    backendBaseUrl: "",
    lastSavedAt: null,
    browserSnapshotOrigin: "",
    importLog: "还没有导入记录。",
    selectedDbHistoryId: "",
    importQuestions: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inferFloorFromRoomName(name) {
  const value = String(name || "").trim();
  if (value.startsWith("一楼")) {
    return "1F";
  }
  if (value.startsWith("二楼")) {
    return "2F";
  }
  if (value.startsWith("三楼")) {
    return "3F";
  }
  return "";
}

function normalizeTimeText(value) {
  const normalized = String(value || "")
    .trim()
    .replaceAll("：", ":")
    .replaceAll("；", ":")
    .replaceAll(";", ":");
  const match = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return normalized;
  }
  return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
}

function normalizeScheduleStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["adjusted", "changed", "调课"].includes(normalized)) {
    return "adjusted";
  }
  if (["makeup", "补课"].includes(normalized)) {
    return "makeup";
  }
  if (["leave", "paused", "休息", "停课"].includes(normalized)) {
    return "leave";
  }
  return "scheduled";
}

function normalizeConfirmationStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["confirmed", "done", "已确认"].includes(normalized)) {
    return "confirmed";
  }
  return "pending";
}

function normalizeTeacher(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const name = String(item.name || item.teacher_name || item.teacherName || "").trim();
  if (!name) {
    return null;
  }
  return {
    id: item.id || makeId("june-teacher"),
    name,
    subject: String(item.subject || "").trim(),
  };
}

function normalizeRoom(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const name = String(item.name || item.room_name || item.roomName || "").trim();
  if (!name) {
    return null;
  }
  return {
    id: item.id || makeId("june-room"),
    name,
    floor: String(item.floor || item.floor_name || item.floorName || "").trim() || inferFloorFromRoomName(name),
  };
}

function normalizeEntry(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const teacherName = String(item.teacherName || item.teacher_name || "").trim();
  const className = String(item.className || item.class_name || "").trim();
  const courseDate = String(item.courseDate || item.course_date || "").trim();
  const startTime = normalizeTimeText(item.startTime || item.start_time || "");
  const endTime = normalizeTimeText(item.endTime || item.end_time || "");
  const classroomName = String(item.classroomName || item.classroom_name || "").trim();
  const notes = String(item.notes || "").trim();
  const hasContent =
    teacherName || className || courseDate || startTime || endTime || classroomName || notes;
  if (!hasContent) {
    return null;
  }
  return {
    id: item.id || makeId("june-entry"),
    teacherName,
    className,
    courseDate,
    slotIndex: Number(item.slotIndex || item.slot_index || 0),
    startTime,
    endTime,
    classroomName,
    scheduleStatus: normalizeScheduleStatus(item.scheduleStatus || item.schedule_status || ""),
    confirmationStatus: normalizeConfirmationStatus(
      item.confirmationStatus || item.confirmation_status || ""
    ),
    notes,
  };
}

function buildTeacherCatalog(teachers, scheduleEntries) {
  const byName = new Map();
  for (const teacher of teachers) {
    if (teacher?.name && !byName.has(teacher.name)) {
      byName.set(teacher.name, teacher);
    }
  }
  for (const entry of scheduleEntries) {
    if (entry.teacherName && !byName.has(entry.teacherName)) {
      byName.set(entry.teacherName, createTeacher(entry.teacherName));
    }
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

function buildRoomCatalog(rooms, scheduleEntries) {
  const byName = new Map();
  for (const room of rooms) {
    if (room?.name && !byName.has(room.name)) {
      byName.set(room.name, room);
    }
  }
  for (const entry of scheduleEntries) {
    if (entry.classroomName && !byName.has(entry.classroomName)) {
      byName.set(entry.classroomName, createRoom(entry.classroomName));
    }
  }
  return [...byName.values()].sort((left, right) => {
    const floorCompare = left.floor.localeCompare(right.floor, "zh-CN");
    if (floorCompare !== 0) {
      return floorCompare;
    }
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function normalizeState(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return createEmptyState();
  }
  const scheduleEntries = Array.isArray(snapshot.scheduleEntries)
    ? snapshot.scheduleEntries.map(normalizeEntry).filter(Boolean)
    : Array.isArray(snapshot.schedule_entries)
      ? snapshot.schedule_entries.map(normalizeEntry).filter(Boolean)
      : [];
  const teachers = Array.isArray(snapshot.teachers)
    ? snapshot.teachers.map(normalizeTeacher).filter(Boolean)
    : [];
  const rooms = Array.isArray(snapshot.rooms)
    ? snapshot.rooms.map(normalizeRoom).filter(Boolean)
    : [];
  return {
    teachers: buildTeacherCatalog(teachers, scheduleEntries),
    rooms: buildRoomCatalog(rooms, scheduleEntries),
    scheduleEntries: scheduleEntries.sort(compareEntries),
  };
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

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyState();
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return createEmptyState();
  }
}

function loadUiState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_META_KEY);
    if (!raw) {
      return createEmptyUiState();
    }
    const parsed = JSON.parse(raw);
    return {
      ...createEmptyUiState(),
      selectedMonth: parsed.selectedMonth || "",
      selectedTeacherName: parsed.selectedTeacherName || "all",
      selectedDate: parsed.selectedDate || "",
      selectedRoomName: parsed.selectedRoomName || "all",
      selectedStatus: parsed.selectedStatus || "all",
      selectedConfirmation: parsed.selectedConfirmation || "all",
      backendBaseUrl: parsed.backendBaseUrl || "",
      lastSavedAt: parsed.lastSavedAt || null,
      browserSnapshotOrigin: parsed.browserSnapshotOrigin || "",
      importLog: parsed.importLog || "还没有导入记录。",
      selectedDbHistoryId: parsed.selectedDbHistoryId || "",
      importQuestions: Array.isArray(parsed.importQuestions) ? parsed.importQuestions : [],
    };
  } catch (error) {
    return createEmptyUiState();
  }
}

function persistUiState() {
  window.localStorage.setItem(STORAGE_META_KEY, JSON.stringify(uiState));
}

function isCloudDataEnabled() {
  return Boolean(window.JRC_CLOUD?.isEnabled?.() && window.JRC_PAIKE_LEGACY_CLOUD_TRANSITION?.hydrateStores);
}

async function hydrateCloudScheduleStores() {
  if (!isCloudDataEnabled()) return;
  await window.JRC_PAIKE_LEGACY_CLOUD_TRANSITION.hydrateStores([STORAGE_KEY, STORAGE_META_KEY]);
  state = loadState();
  uiState = loadUiState();
}

function syncCatalogsInPlace() {
  state = normalizeState(state);
}

function persistState(message, options = {}) {
  syncCatalogsInPlace();
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

function compareEntries(left, right) {
  return (
    String(left.courseDate || "").localeCompare(String(right.courseDate || "")) ||
    String(left.startTime || "").localeCompare(String(right.startTime || "")) ||
    Number(left.slotIndex || 0) - Number(right.slotIndex || 0) ||
    String(left.teacherName || "").localeCompare(String(right.teacherName || ""), "zh-CN") ||
    String(left.className || "").localeCompare(String(right.className || ""), "zh-CN")
  );
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "尚未保存";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonthLabel(monthValue) {
  if (!/^\d{4}-\d{2}$/.test(monthValue || "")) {
    return monthValue || "未设置";
  }
  const [year, month] = monthValue.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function formatDateLabel(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || "")) {
    return dateValue || "未设置";
  }
  const date = new Date(`${dateValue}T00:00:00`);
  const weekdayIndex = (date.getDay() + 6) % 7;
  return `${dateValue.slice(5)} ${WEEKDAY_LABELS[weekdayIndex]}`;
}

function formatScheduleStatus(status) {
  return {
    scheduled: "正常排课",
    adjusted: "调课",
    makeup: "补课",
    leave: "停课/休息",
  }[String(status || "").trim()] || "正常排课";
}

function formatConfirmationStatus(status) {
  return {
    confirmed: "已确认",
    pending: "待确认",
  }[String(status || "").trim()] || "待确认";
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
    pathname = pathname.replace(/\/(?:api(?:\/(?:health|state))?|prototype(?:\/.+)?|index\.html)\/?$/i, "");
    pathname = pathname.replace(/\/+$/, "");
    return pathname ? `${parsed.origin}${pathname}` : parsed.origin;
  } catch (error) {
    return "";
  }
}

function getConfiguredBackendBaseUrl() {
  return normalizeBackendBaseUrl(uiState.backendBaseUrl || "");
}

function buildLocalDbHealthUrl(baseUrl) {
  return `${baseUrl || ""}${LOCAL_DB_HEALTH_PATH}`;
}

function buildLocalDbStateUrl(baseUrl) {
  const base = baseUrl || "";
  if (!base) {
    return "";
  }
  const url = new URL(`${base}${LOCAL_DB_STATE_PATH}`);
  url.searchParams.set("state_key", BACKEND_STATE_KEY);
  return url.toString();
}

function buildLocalDbHistoryUrl(baseUrl, limit = 20) {
  const base = baseUrl || "";
  if (!base) {
    return "";
  }
  const url = new URL(`${base}${LOCAL_DB_HISTORY_PATH}`);
  url.searchParams.set("state_key", BACKEND_STATE_KEY);
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

function buildLocalDbRestoreUrl(baseUrl) {
  const base = baseUrl || "";
  if (!base) {
    return "";
  }
  const url = new URL(`${base}${LOCAL_DB_RESTORE_PATH}`);
  url.searchParams.set("state_key", BACKEND_STATE_KEY);
  return url.toString();
}

function buildLocalDbImportRegularCsvUrl(baseUrl) {
  const base = baseUrl || "";
  if (!base) {
    return "";
  }
  const url = new URL(`${base}${LOCAL_DB_IMPORT_REGULAR_CSV_PATH}`);
  url.searchParams.set("state_key", BACKEND_STATE_KEY);
  return url.toString();
}

function buildLocalDbImportRegularXlsxUrl(baseUrl) {
  const base = baseUrl || "";
  if (!base) {
    return "";
  }
  const url = new URL(`${base}${LOCAL_DB_IMPORT_REGULAR_XLSX_PATH}`);
  url.searchParams.set("state_key", BACKEND_STATE_KEY);
  return url.toString();
}

function buildLocalDbImportRegularRowsUrl(baseUrl) {
  const base = baseUrl || "";
  if (!base) {
    return "";
  }
  const url = new URL(`${base}${LOCAL_DB_IMPORT_REGULAR_ROWS_PATH}`);
  url.searchParams.set("state_key", BACKEND_STATE_KEY);
  return url.toString();
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
      const response = await fetch(buildLocalDbHealthUrl(candidate.baseUrl), { cache: "no-store" });
      if (!response.ok) {
        let errorPayload = null;
        try {
          errorPayload = await response.json();
        } catch (error) {}
        throw new Error(errorPayload?.message || errorPayload?.error || `HTTP ${response.status}`);
      }
      const payload = await response.json();
      const stateUrl = buildLocalDbStateUrl(candidate.baseUrl);
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
        healthUrl: buildLocalDbHealthUrl(candidate.baseUrl),
        stateUrl,
        historyUrl: buildLocalDbHistoryUrl(candidate.baseUrl),
        restoreUrl: buildLocalDbRestoreUrl(candidate.baseUrl),
        importRegularCsvUrl: buildLocalDbImportRegularCsvUrl(candidate.baseUrl),
        importRegularXlsxUrl: buildLocalDbImportRegularXlsxUrl(candidate.baseUrl),
        importRegularRowsUrl: buildLocalDbImportRegularRowsUrl(candidate.baseUrl),
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

function parseDateTimeSafe(value) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function parseDateOnlySafe(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim())) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimeToMinutes(value) {
  const normalized = normalizeTimeText(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function getRegularModeWeekdayIndex(dateValue) {
  const date = parseDateOnlySafe(dateValue);
  return date ? (date.getDay() + 6) % 7 : -1;
}

function isRegularModeWeekendDate(dateValue) {
  return REGULAR_MODE_WEEKEND_INDEXES.has(getRegularModeWeekdayIndex(dateValue));
}

function isRegularModeAllowedDate(dateValue) {
  const weekdayIndex = getRegularModeWeekdayIndex(dateValue);
  return REGULAR_MODE_WEEKDAY_INDEXES.has(weekdayIndex) || REGULAR_MODE_WEEKEND_INDEXES.has(weekdayIndex);
}

function getPreferredRegularModeDate(dateOptions, preferredDateValue = "") {
  if (
    preferredDateValue &&
    dateOptions.includes(preferredDateValue) &&
    isRegularModeAllowedDate(preferredDateValue)
  ) {
    return preferredDateValue;
  }
  const allowedDates = dateOptions.filter((dateValue) => isRegularModeAllowedDate(dateValue));
  if (!allowedDates.length) {
    return dateOptions[0] || "";
  }
  if (preferredDateValue) {
    const nextAllowedDate = allowedDates.find((dateValue) => dateValue >= preferredDateValue);
    if (nextAllowedDate) {
      return nextAllowedDate;
    }
  }
  return allowedDates[0];
}

function getRegularModePresetSlots(dateValue) {
  return isRegularModeWeekendDate(dateValue)
    ? REGULAR_MODE_WEEKEND_PRESET_SLOTS
    : REGULAR_MODE_WEEKDAY_PRESET_SLOTS;
}

function getSuggestedRegularModeSlot(dateValue) {
  const presetSlots = getRegularModePresetSlots(dateValue);
  if (!presetSlots.length) {
    return { slotIndex: 0, startTime: "18:30", endTime: "20:00" };
  }
  let scopedEntries = state.scheduleEntries.filter((entry) => entry.courseDate === dateValue);
  if (uiState.selectedTeacherName !== "all") {
    scopedEntries = scopedEntries.filter((entry) => entry.teacherName === uiState.selectedTeacherName);
  } else if (uiState.selectedRoomName !== "all") {
    scopedEntries = scopedEntries.filter((entry) => entry.classroomName === uiState.selectedRoomName);
  }
  const usedTimeKeys = new Set(
    scopedEntries.map((entry) => `${normalizeTimeText(entry.startTime)}-${normalizeTimeText(entry.endTime)}`)
  );
  return (
    presetSlots.find(
      (slot) => !usedTimeKeys.has(`${normalizeTimeText(slot.startTime)}-${normalizeTimeText(slot.endTime)}`)
    ) || presetSlots[presetSlots.length - 1]
  );
}

function getSuggestedEntryDate() {
  if (uiState.selectedDate && isRegularModeAllowedDate(uiState.selectedDate)) {
    return uiState.selectedDate;
  }
  return getPreferredRegularModeDate(buildMonthDateOptions(uiState.selectedMonth), uiState.selectedDate);
}

function renderFilterHint() {
  const hintNode = document.getElementById("filterHint");
  if (!hintNode) {
    return;
  }
  if (!uiState.selectedDate || isRegularModeAllowedDate(uiState.selectedDate)) {
    hintNode.hidden = true;
    hintNode.classList.remove("is-warning");
    hintNode.textContent = "";
    return;
  }
  const suggestedDate = getPreferredRegularModeDate(buildMonthDateOptions(uiState.selectedMonth), uiState.selectedDate);
  const suggestedSlot = getSuggestedRegularModeSlot(suggestedDate);
  const suggestedLabel = suggestedDate
    ? `${formatDateLabel(suggestedDate)} ${suggestedSlot.startTime}-${suggestedSlot.endTime}`
    : "本月最近可用时段";
  hintNode.hidden = false;
  hintNode.classList.add("is-warning");
  hintNode.textContent = `当前选中 ${formatDateLabel(uiState.selectedDate)}，不属于平时正式口径；点击“新增排课行”时，会自动改用 ${suggestedLabel}。`;
}

function getRegularModeViolation(entry) {
  const date = parseDateOnlySafe(entry.courseDate);
  if (!date) {
    return "缺少有效上课日期，无法判断是否符合平时模式。";
  }
  const weekdayIndex = (date.getDay() + 6) % 7;
  if (REGULAR_MODE_WEEKEND_INDEXES.has(weekdayIndex)) {
    return "";
  }
  if (!REGULAR_MODE_WEEKDAY_INDEXES.has(weekdayIndex)) {
    return "平时模式不排周一、周二课程。";
  }
  const startMinutes = parseTimeToMinutes(entry.startTime);
  if (startMinutes === null || startMinutes < REGULAR_MODE_EVENING_START_MINUTES) {
    return "周三到周五只保留晚课，建议开始时间不早于 17:00。";
  }
  return "";
}

function collectRegularModeViolations(entries) {
  return entries
    .map((entry) => ({ entry, violation: getRegularModeViolation(entry) }))
    .filter((item) => item.violation);
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
      uiState.importLog = `读取平时后台历史失败：${error.message}`;
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
    uiState.importLog = "当前没有连接到平时后台，暂时不能恢复历史版本。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  const historyId = Number(uiState.selectedDbHistoryId || 0);
  if (!historyId) {
    uiState.importLog = "请先在平时后台历史里选一个可恢复的版本。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  const selectedEntry = localDbHistoryEntries.find((entry) => Number(entry.id) === historyId);
  const confirmLabel = formatHistoryEntryLabel(selectedEntry) || `#${historyId}`;
  if (!window.confirm(`确定恢复这个平时后台版本吗？\n${confirmLabel}\n\n恢复后，后台当前版本会被替换，但也会再记一条新的恢复记录。`)) {
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
    applyLocalSnapshot(payload.snapshot || {}, "已从平时后台恢复选中版本。", {
      syncLocalDb: false,
      browserSnapshotOrigin: "backend_database",
    });
    uiState.importLog = `已恢复平时后台版本：${confirmLabel}`;
    persistUiState();
    await refreshLocalDatabaseHistory({ silent: true });
    renderApp();
  } catch (error) {
    localDbStatus.lastError = error.message;
    uiState.importLog = `恢复平时后台历史失败：${error.message}`;
    persistUiState();
    renderSaveStatus();
  }
}

async function fetchLocalDatabaseState(options = {}) {
  if (!localDbStatus.available) {
    return null;
  }
  try {
    const response = await fetch(localDbStatus.stateUrl, { cache: "no-store" });
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
      stateKey: payload.state_key || BACKEND_STATE_KEY,
    };
  } catch (error) {
    localDbStatus.lastError = error.message;
    if (!options.silent) {
      uiState.importLog = `读取平时后台失败：${error.message}`;
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
    const response = await fetch(localDbStatus.stateUrl, {
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
      uiState.importLog = `保存到平时后台失败：${error.message}`;
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
  state = normalizeState(snapshot);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  persistState(message, {
    ...options,
    browserSnapshotOrigin: options.browserSnapshotOrigin || "backend_database",
  });
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
    state = normalizeState(parsed);
    persistState(forceFresh ? "已重新载入平时系统内置数据。" : "已自动载入平时系统内置数据。", {
      browserSnapshotOrigin: "bundled_snapshot",
    });
  } catch (error) {
    if (!hasSavedState) {
      state = createEmptyState();
      uiState.importLog = `平时系统内置数据载入失败：${error.message}`;
      persistUiState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }
}

async function syncLocalDatabaseSnapshot() {
  const forceFresh = shouldForceBundledSnapshot();
  const browserSnapshot = parseSnapshotSafe(window.localStorage.getItem(STORAGE_KEY));
  const browserSavedAt = uiState.lastSavedAt || "";
  const browserSnapshotOrigin = uiState.browserSnapshotOrigin || "";

  if (forceFresh) {
    await loadBundledSnapshotIfNeeded();
    await saveStateToLocalDatabase({
      note: "fresh_query_reload",
      source: "browser_fresh_reload",
      silent: true,
    });
    renderSaveStatus();
    return;
  }

  const databaseState = await fetchLocalDatabaseState({ silent: true });
  const databaseSavedAt = databaseState?.savedAt || "";
  const shouldPromoteBrowserState =
    browserSnapshot &&
    (!databaseState?.snapshot ||
      (!NON_PROMOTABLE_BROWSER_SNAPSHOT_ORIGINS.has(browserSnapshotOrigin) &&
        (!browserSavedAt || parseDateTimeSafe(browserSavedAt) >= parseDateTimeSafe(databaseSavedAt))));

  if (shouldPromoteBrowserState) {
    const migrated = await saveSnapshotToLocalDatabase(browserSnapshot, {
      note: databaseState?.snapshot ? "browser_state_newer_than_db" : "browser_state_initial_migration",
      source: databaseState?.snapshot ? "browser_migration_newer" : "browser_migration_initial",
      silent: true,
    });
    if (migrated) {
      uiState.importLog = databaseState?.snapshot
        ? "已把当前浏览器里较新的平时数据同步到后台数据库。"
        : "已把当前浏览器里的平时数据迁入后台数据库。";
      persistUiState();
    }
    return;
  }

  if (databaseState?.snapshot) {
    applyLocalSnapshot(databaseState.snapshot, "已从平时后台载入数据。", {
      syncLocalDb: false,
      browserSnapshotOrigin: "backend_database",
    });
    return;
  }

  await loadBundledSnapshotIfNeeded();
  await saveStateToLocalDatabase({
    note: "seed_from_bundled_snapshot",
    source: "browser_seed_snapshot",
    silent: true,
  });
}

async function initializePersistence() {
  localDbStatus = await detectLocalDatabase();
  updatePersistenceControls();
  if (!localDbStatus.available) {
    localDbHistoryEntries = [];
    uiState.importLog = isCloudDataEnabled()
      ? "已进入云端平时排课模式。当前页面保持旧版操作习惯，新增、修改、上传表格后会同步到云端。"
      : "当前没有连通平时后台。只有连接到主控电脑后台后，才允许查看和编辑正式排课内容。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  await syncLocalDatabaseSnapshot();
  await refreshLocalDatabaseHistory({ silent: true });
  renderSaveStatus();
}

function updatePersistenceControls() {
  const saveButton = document.getElementById("saveButton");
  const loadDbButton = document.getElementById("loadDbButton");
  const historySelect = document.getElementById("dbHistorySelect");
  const refreshHistoryButton = document.getElementById("refreshDbHistoryButton");
  const restoreHistoryButton = document.getElementById("restoreDbHistoryButton");
  if (saveButton) {
    saveButton.textContent = isCloudDataEnabled() ? "保存到云端平时排课" : "保存到平时后台";
  }
  if (loadDbButton) {
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
    uiState.importLog = "请输入可用的平时后台地址，例如 http://192.168.1.20:8000。";
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
    uiState.importLog = `连接平时后台失败：${normalizedBaseUrl}；${localDbStatus.lastError || "未能连通"}`;
    persistUiState();
    renderSaveStatus();
    return;
  }

  await syncLocalDatabaseSnapshot();
  await refreshLocalDatabaseHistory({ silent: true });
  renderApp();
}

async function clearConfiguredBackend() {
  uiState.backendBaseUrl = "";
  persistUiState();
  setBackendBaseUrlInputValue("");
  await initializePersistence();
  renderApp();
}

async function loadStateFromLocalDatabase() {
  if (!localDbStatus.available) {
    uiState.importLog = "当前没有连接到平时后台。请先填写后台地址，或直接打开局域网平时系统页面。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  const payload = await fetchLocalDatabaseState();
  if (!payload || !payload.snapshot) {
    uiState.importLog = "平时后台里还没有可读取的数据。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  applyLocalSnapshot(payload.snapshot, "已从平时后台读取当前数据。", {
    syncLocalDb: false,
  });
  renderApp();
}

function getBackendConnectionText() {
  const configuredBaseUrl = getConfiguredBackendBaseUrl();
  if (localDbStatus.available) {
    return localDbStatus.connectionMode === "same_origin"
      ? `已连接系统后台（平时模式）：${localDbStatus.baseUrl}`
      : `已连接平时后台：${localDbStatus.baseUrl}`;
  }
  if (isCloudDataEnabled()) {
    return "已启用云端共享数据（平时模式）。老师在不同电脑、手机打开后，会读取同一份云端排课数据。";
  }
  if (isCloudTransitionMode()) {
    return "云端过渡模式：当前先使用老师熟悉的平时排课界面，数据保存在当前浏览器；正式多人同步会逐步接入云数据库。";
  }
  if (configuredBaseUrl) {
    return `已配置系统后台（平时模式）：${configuredBaseUrl}。当前未连通，请确认后台服务已启动，且两台电脑在同一网络。`;
  }
  return "当前未连接系统后台（平时模式）。老师在自己电脑打开页面时，可在这里填写后台地址，例如 http://192.168.1.20:8000。";
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
      <h1 class="access-gate-title">当前无法使用平时排课系统</h1>
      <p class="access-gate-text">
        这台电脑现在不在同一局域网，或无法正常读写平时后台数据，所以已禁止录入。
      </p>
      <ol class="access-gate-list">
        <li>请确认这台电脑和主控电脑在同一个局域网。</li>
        <li>请使用主控电脑发出的局域网链接打开，不要使用本地拷贝页面。</li>
        <li>请确认主控电脑上的排课服务窗口仍在运行。</li>
      </ol>
      <div class="access-gate-detail">${escapeHtml(details.join("\n") || "未检测到可用的平时后台连接。")}</div>
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
    historySelect.innerHTML = '<option value="">当前未连接平时后台</option>';
    historySelect.disabled = true;
    refreshHistoryButton.disabled = true;
    restoreHistoryButton.disabled = true;
    historyHint.textContent = "连接平时后台后，这里会显示最近保存记录；恢复后也会再记一条恢复记录。";
    return;
  }

  if (!localDbHistoryEntries.length) {
    historySelect.innerHTML = '<option value="">平时后台里还没有历史记录</option>';
    historySelect.disabled = true;
    refreshHistoryButton.disabled = false;
    restoreHistoryButton.disabled = true;
    historyHint.textContent = localDbStatus.backupDir
      ? `后台磁盘备份目录：${localDbStatus.backupDir}`
      : "平时后台里还没有历史记录。";
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

function formatImportQuestion(question) {
  if (!question || typeof question !== "object") {
    return "";
  }
  const rowNumber = question.row_number ? `第 ${question.row_number} 行` : "某一行";
  const message = String(question.message || "").trim();
  return message || `${rowNumber} 需要老师确认。`;
}

function getQuestionRowValue(question, field) {
  return String(question?.row?.[field] || "");
}

function getQuestionSuggestedValue(question, field) {
  return String(question?.suggested_row?.[field] || "");
}

function getQuestionSuggestionCandidates(question, field) {
  if (!Array.isArray(question?.suggestion_candidates?.[field])) {
    return [];
  }
  return question.suggestion_candidates[field].map((value) => String(value || "")).filter(Boolean);
}

function getQuestionFocusFields(question) {
  if (Array.isArray(question?.focus_fields) && question.focus_fields.length) {
    return new Set(question.focus_fields.map((field) => String(field)));
  }
  if (question?.type === "invalid_date") {
    return new Set(["course_date"]);
  }
  if (question?.type === "invalid_time") {
    return new Set(["start_time", "end_time"]);
  }
  return new Set();
}

function getQuestionSourceText(question) {
  const sourceNote = String(question?.source_note || getQuestionRowValue(question, "notes") || "").trim();
  if (!sourceNote) {
    return "";
  }
  const match = sourceNote.match(/来源：[^；]+/);
  return match ? match[0] : sourceNote;
}

function buildQuestionFieldConfigs(question) {
  const focusFields = getQuestionFocusFields(question);
  return [
    { key: "teacher_name", label: "老师" },
    { key: "class_name", label: "班级" },
    { key: "course_date", label: "日期" },
    { key: "slot_index", label: "序号" },
    { key: "start_time", label: "开始" },
    { key: "end_time", label: "结束" },
    { key: "classroom_name", label: "教室" },
    { key: "notes", label: "备注", wide: true },
  ].map((field) => ({
    ...field,
    focused: focusFields.has(field.key),
    suggestedValue: getQuestionSuggestedValue(question, field.key),
    suggestionCandidates: getQuestionSuggestionCandidates(question, field.key),
  }));
}

function getQuestionSuggestionText(question) {
  return String(question?.suggestion_note || "").trim();
}

function renderImportQuestions() {
  const node = document.getElementById("importQuestions");
  if (!node) {
    return;
  }
  const questions = Array.isArray(uiState.importQuestions) ? uiState.importQuestions : [];
  if (!questions.length) {
    node.textContent = "上传后，如果有缺老师、缺教室、日期时间格式不清楚的行，会在这里提示。";
    node.classList.toggle("empty-state", true);
    return;
  }
  node.classList.toggle("empty-state", false);
  const summaryText = `当前有 ${questions.length} 行需要老师确认。先补红框字段，再点下面的提交按钮。`;
  node.innerHTML = `
    <div class="question-summary">${escapeHtml(summaryText)}</div>
    ${questions
      .map((question, index) => {
        const sourceText = getQuestionSourceText(question);
        const suggestionText = getQuestionSuggestionText(question);
        return `
          <div class="question-card">
            <div class="question-header">
              <div>
                <div class="question-title">${escapeHtml(formatImportQuestion(question))}</div>
                ${sourceText ? `<div class="question-source">${escapeHtml(sourceText)}</div>` : ""}
                ${suggestionText ? `<div class="question-suggestion-note">系统建议：${escapeHtml(suggestionText)}</div>` : ""}
              </div>
              <div class="question-header-actions">
                <button class="button button-secondary question-apply-button" data-question-apply-index="${index}">采用本行建议</button>
                <button class="button button-ghost question-remove-button" data-question-remove-index="${index}">先跳过这行</button>
              </div>
            </div>
            <div class="question-grid">
              ${buildQuestionFieldConfigs(question)
                .map(
                  (field) => `
                    <label class="question-field${field.wide ? " is-wide" : ""}${field.focused ? " is-focus" : ""}">
                      <span class="field-label">${escapeHtml(field.label)}</span>
                      <input
                        class="cell-input"
                        data-question-index="${index}"
                        data-question-field="${escapeHtml(field.key)}"
                        value="${escapeHtml(getQuestionRowValue(question, field.key))}"
                      >
                      ${
                        field.suggestedValue && field.suggestedValue !== getQuestionRowValue(question, field.key)
                          ? `<button class="question-field-suggestion" type="button" data-question-index="${index}" data-question-field-apply="${escapeHtml(field.key)}">采用建议：${escapeHtml(field.suggestedValue)}</button>`
                          : ""
                      }
                      ${
                        field.suggestionCandidates.length
                          ? `<div class="question-candidate-row">
                              ${field.suggestionCandidates
                                .map(
                                  (candidate) => `<button class="question-candidate-chip" type="button" data-question-index="${index}" data-question-field-candidate="${escapeHtml(field.key)}" data-question-candidate-value="${escapeHtml(candidate)}">${escapeHtml(candidate)}</button>`
                                )
                                .join("")}
                            </div>`
                          : ""
                      }
                    </label>
                  `
                )
                .join("")}
            </div>
          </div>
        `;
      })
      .join("")}
    <div class="tool-action-row import-question-actions">
      <button id="submitImportQuestionsButton" class="button button-secondary">提交已补齐的问题行</button>
      <button id="clearImportQuestionsButton" class="button button-ghost">先清空问题列表</button>
    </div>
  `;
}

function renderSaveStatus() {
  const statusNode = document.getElementById("saveStatusText");
  const backendNode = document.getElementById("backendConnectionText");
  const importLogNode = document.getElementById("importLog");
  const topBackendNode = document.getElementById("topBackendStatus");
  const topSaveNode = document.getElementById("topSaveStatus");
  if (!statusNode || !backendNode || !importLogNode) {
    return;
  }
  const browserSavedAt = uiState.lastSavedAt ? formatDateTime(uiState.lastSavedAt) : "尚未保存";
  backendNode.textContent = getBackendConnectionText();
  if (topBackendNode) {
    topBackendNode.textContent = localDbStatus.available
      ? "后台已连接 | 平时模式"
      : isCloudDataEnabled()
        ? "云端已连接 | 平时模式"
        : "后台未连接";
  }
  if (topSaveNode) {
    topSaveNode.textContent = `最近保存：${browserSavedAt}`;
  }
  if (localDbStatus.available) {
    const databaseSavedAt = localDbStatus.lastSavedAt
      ? formatDateTime(localDbStatus.lastSavedAt)
      : "尚未写入";
    const historySuffix = localDbHistoryEntries.length ? `；最近保留历史 ${localDbHistoryEntries.length} 条` : "";
    const errorSuffix = localDbStatus.lastError ? `；最近一次后台同步失败：${localDbStatus.lastError}` : "";
    statusNode.textContent = `当前数据会先保存在当前浏览器，并同步写入平时后台（${localDbStatus.baseUrl}）。浏览器最近保存：${browserSavedAt}；后台最近写入：${databaseSavedAt}${historySuffix}${errorSuffix}`;
  } else if (isCloudDataEnabled()) {
    statusNode.textContent = `当前使用云端共享排课数据。修改会先保存在当前浏览器，并自动同步到云端；最近保存：${browserSavedAt}。`;
  } else if (isCloudTransitionMode()) {
    statusNode.textContent = `云端过渡模式：当前未连接局域网后台，数据会先保存在当前浏览器。浏览器最近保存：${browserSavedAt}。`;
  } else if (getConfiguredBackendBaseUrl()) {
    const errorSuffix = localDbStatus.lastError ? `；连接失败：${localDbStatus.lastError}` : "";
    statusNode.textContent = `当前未连通平时后台，系统已锁定，不能继续使用。已配置后台地址：${getConfiguredBackendBaseUrl()}${errorSuffix}`;
  } else {
    statusNode.textContent = "当前未连通平时后台，系统已锁定，不能继续使用。";
  }
  renderHistoryControls();
  importLogNode.textContent = uiState.importLog || "还没有导入记录。";
  renderImportQuestions();
  renderAccessGate();
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

function getFileExtension(filename) {
  const parts = String(filename || "").split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
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

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

function normalizeEntryFromCsvRow(row) {
  return normalizeEntry({
    teacherName: row.teacher_name,
    className: row.class_name,
    courseDate: row.course_date,
    slotIndex: row.slot_index,
    startTime: row.start_time,
    endTime: row.end_time,
    classroomName: row.classroom_name,
    scheduleStatus: row.schedule_status,
    confirmationStatus: row.confirmation_status,
    notes: row.notes,
  });
}

function exportSnapshot() {
  syncCatalogsInPlace();
  downloadFile(
    `june-schedule-snapshot-${new Date().toISOString().slice(0, 10)}.json`,
    `${JSON.stringify(clone(state), null, 2)}\n`,
    "application/json"
  );
  uiState.importLog = "已导出平时系统 JSON 快照。";
  persistUiState();
  renderSaveStatus();
}

async function importScheduleCsvFile() {
  const fileInput = document.getElementById("scheduleCsvFileInput");
  const file = fileInput?.files && fileInput.files[0];
  if (!file) {
    uiState.importLog = "请选择老师排课 CSV 文件后再导入。";
    persistUiState();
    renderSaveStatus();
    return;
  }

  const extension = getFileExtension(file.name);
  if (!["csv", "xlsx"].includes(extension)) {
    uiState.importLog = `当前只支持导入 CSV 或 XLSX。${file.name} 请改成模板表格式后再上传。`;
    persistUiState();
    renderSaveStatus();
    return;
  }

  if (
    localDbStatus.available &&
    ((extension === "csv" && localDbStatus.importRegularCsvUrl) ||
      (extension === "xlsx" && localDbStatus.importRegularXlsxUrl))
  ) {
    try {
      let response;
      if (extension === "csv") {
        const csvText = await file.text();
        const rows = parseCsv(csvText);
        const entries = rows.map(normalizeEntryFromCsvRow).filter(Boolean);
        if (!entries.length) {
          uiState.importLog = "CSV 没有识别到可导入的排课行。";
          uiState.importQuestions = [];
          persistUiState();
          renderSaveStatus();
          return;
        }
        response = await fetch(localDbStatus.importRegularCsvUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_name: file.name,
            csv_text: csvText,
          }),
        });
      } else {
        response = await fetch(localDbStatus.importRegularXlsxUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_name: file.name,
            file_base64: arrayBufferToBase64(await file.arrayBuffer()),
          }),
        });
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      state = normalizeState(payload.snapshot || {});
      localDbStatus.lastSavedAt = payload.saved_at || "";
      localDbStatus.lastError = "";
      uiState.importQuestions = Array.isArray(payload.questions) ? payload.questions : [];
      const acceptedCount = Number(payload.accepted_count || 0);
      const questionCount = Number(payload.question_count || 0);
      const warningCount = Number(payload.warning_count || 0);
      const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
      const summerSync = payload.summer_sync && typeof payload.summer_sync === "object" ? payload.summer_sync : null;
      const summerDemandCount = Number(summerSync?.demand_count || 0);
      const summerWarningCount = Number(summerSync?.warning_count || 0);
      const summerWarnings = Array.isArray(summerSync?.warnings) ? summerSync.warnings : [];
      const warningSuffix =
        warningCount && warnings.length
          ? `\n注意：${warnings.slice(0, 3).join("；")}${warningCount > 3 ? "；其余警告已省略" : ""}`
          : "";
      const summerSuffix = summerSync
        ? `；暑假模式已同步 ${summerDemandCount} 个待开班`
        : "";
      const summerWarningSuffix =
        summerWarningCount && summerWarnings.length
          ? `\n暑假提示：${summerWarnings.slice(0, 3).join("；")}${summerWarningCount > 3 ? "；其余提示已省略" : ""}`
          : "";
      uiState.importLog =
        `已上传 ${file.name} 并同步到平时后台：写入 ${acceptedCount} 行` +
        (questionCount ? `，待老师确认 ${questionCount} 行` : "") +
        (warningCount ? `，跳过警告 ${warningCount} 行` : "") +
        `${summerSuffix}。${warningSuffix}${summerWarningSuffix}`;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      uiState.lastSavedAt = new Date().toISOString();
      uiState.browserSnapshotOrigin = "backend_database";
      persistUiState();
      await refreshLocalDatabaseHistory({ silent: true });
      renderApp();
      return;
    } catch (error) {
      localDbStatus.lastError = error.message;
      uiState.importLog = `上传并写入平时后台失败：${error.message}`;
      uiState.importQuestions = [];
      persistUiState();
      renderSaveStatus();
      return;
    }
  }

  if (extension !== "csv") {
    uiState.importLog = isCloudDataEnabled()
      ? "云端 XLSX 自动拆分解析器还在迁移中。当前请先把老师排课表另存为 CSV 后上传，或直接在排课明细里新增/修改。"
      : "当前未连接后台时，只能本地导入 CSV；XLSX 需要连接主控电脑后台后再上传。";
    uiState.importQuestions = [];
    persistUiState();
    renderSaveStatus();
    return;
  }

  const csvText = await file.text();
  const rows = parseCsv(csvText);
  const entries = rows.map(normalizeEntryFromCsvRow).filter(Boolean);
  if (!entries.length) {
    uiState.importLog = "CSV 没有识别到可导入的排课行。";
    uiState.importQuestions = [];
    persistUiState();
    renderSaveStatus();
    return;
  }

  state = normalizeState({
    teachers: state.teachers,
    rooms: state.rooms,
    scheduleEntries: entries,
  });
  uiState.importQuestions = [];
  persistState(`已导入老师排课 CSV：${file.name}，共 ${entries.length} 行。`);
  renderApp();
}

async function importSnapshotFile() {
  const fileInput = document.getElementById("snapshotFileInput");
  const file = fileInput?.files && fileInput.files[0];
  if (!file) {
    uiState.importLog = "请选择平时系统 JSON 快照后再导入。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeState(parsed);
    uiState.importQuestions = [];
    persistState(`已导入平时系统快照：${file.name}。`);
    renderApp();
  } catch (error) {
    uiState.importLog = `导入平时系统快照失败：${error.message}`;
    uiState.importQuestions = [];
    persistUiState();
    renderSaveStatus();
  }
}

function buildMonthOptions() {
  const months = new Set();
  for (const entry of state.scheduleEntries) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(entry.courseDate || "")) {
      months.add(entry.courseDate.slice(0, 7));
    }
  }
  if (!months.size) {
    months.add(new Date().toISOString().slice(0, 7));
  }
  return [...months].sort();
}

function buildMonthDateOptions(monthValue) {
  if (!/^\d{4}-\d{2}$/.test(monthValue || "")) {
    return [];
  }
  const [year, month] = monthValue.split("-").map(Number);
  const dayCount = new Date(year, month, 0).getDate();
  return Array.from({ length: dayCount }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${monthValue}-${day}`;
  });
}

function ensureUiSelections() {
  const monthOptions = buildMonthOptions();
  if (!monthOptions.includes(uiState.selectedMonth)) {
    uiState.selectedMonth = monthOptions.includes(REGULAR_PRIMARY_MONTH)
      ? REGULAR_PRIMARY_MONTH
      : monthOptions[monthOptions.length - 1];
  }

  const teacherOptions = ["all", ...state.teachers.map((teacher) => teacher.name)];
  if (!teacherOptions.includes(uiState.selectedTeacherName)) {
    uiState.selectedTeacherName = "all";
  }

  const roomOptions = ["all", ...state.rooms.map((room) => room.name)];
  if (!roomOptions.includes(uiState.selectedRoomName)) {
    uiState.selectedRoomName = "all";
  }

  const dateOptions = buildMonthDateOptions(uiState.selectedMonth);
  if (!dateOptions.includes(uiState.selectedDate)) {
    const firstEntryDate = getMonthlyFilteredEntries({ ignoreDate: true })[0]?.courseDate || "";
    uiState.selectedDate = getPreferredRegularModeDate(dateOptions, firstEntryDate);
  }
}

function getMonthlyFilteredEntries(options = {}) {
  return state.scheduleEntries
    .filter((entry) => {
      if (uiState.selectedMonth && entry.courseDate.slice(0, 7) !== uiState.selectedMonth) {
        return false;
      }
      if (uiState.selectedTeacherName !== "all" && entry.teacherName !== uiState.selectedTeacherName) {
        return false;
      }
      if (uiState.selectedRoomName !== "all" && entry.classroomName !== uiState.selectedRoomName) {
        return false;
      }
      if (uiState.selectedStatus !== "all" && entry.scheduleStatus !== uiState.selectedStatus) {
        return false;
      }
      if (
        uiState.selectedConfirmation !== "all" &&
        entry.confirmationStatus !== uiState.selectedConfirmation
      ) {
        return false;
      }
      if (!options.ignoreDate && uiState.selectedDate && entry.courseDate !== uiState.selectedDate) {
        return false;
      }
      return true;
    })
    .sort(compareEntries);
}

function getTableEntries() {
  return getMonthlyFilteredEntries({ ignoreDate: true });
}

function buildCalendarCells(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const dayCount = new Date(year, month, 0).getDate();
  const offset = (firstDate.getDay() + 6) % 7;
  const cells = Array.from({ length: offset }, () => ({ date: "", day: "", weekdayLabel: "" }));
  for (let day = 1; day <= dayCount; day += 1) {
    const dateValue = `${monthValue}-${String(day).padStart(2, "0")}`;
    const date = new Date(`${dateValue}T00:00:00`);
    cells.push({
      date: dateValue,
      day,
      weekdayLabel: WEEKDAY_LABELS[(date.getDay() + 6) % 7],
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: "", day: "", weekdayLabel: "" });
  }
  return cells;
}

function renderMetrics() {
  const metricsNode = document.getElementById("metrics");
  if (!metricsNode) {
    return;
  }
  const monthEntries = getMonthlyFilteredEntries({ ignoreDate: true });
  const activeTeachers = new Set(monthEntries.map((entry) => entry.teacherName).filter(Boolean)).size;
  const activeRooms = new Set(monthEntries.map((entry) => entry.classroomName).filter(Boolean)).size;
  const pendingCount = monthEntries.filter((entry) => entry.confirmationStatus === "pending").length;
  const adjustedCount = monthEntries.filter((entry) => entry.scheduleStatus !== "scheduled").length;
  const regularModeViolations = collectRegularModeViolations(monthEntries);

  const cards = [
    {
      label: "当前月份",
      value: formatMonthLabel(uiState.selectedMonth),
      note: "正式使用优先维护 2026 年 6 月平时课。",
    },
    {
      label: "月内排课行",
      value: String(monthEntries.length),
      note: "当前筛选口径下的全部排课行。",
    },
    {
      label: "活跃老师",
      value: String(activeTeachers),
      note: "当前月份有课的老师人数。",
    },
    {
      label: "使用教室",
      value: String(activeRooms),
      note: "当前月份实际排到的教室数。",
    },
    {
      label: "待确认",
      value: String(pendingCount),
      note: "待家长或老师确认的排课行。",
    },
    {
      label: "调课/补课",
      value: String(adjustedCount),
      note: "用于跟踪平时临时调整。",
    },
    {
      label: "模式违例",
      value: String(regularModeViolations.length),
      note: "非周三到周五晚课，或非周末全天的排课行。",
      warning: regularModeViolations.length > 0,
    },
  ];

  metricsNode.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card ${card.warning ? "is-warning" : ""}">
          <div class="metric-label">${escapeHtml(card.label)}</div>
          <div class="metric-value">${escapeHtml(card.value)}</div>
          <div class="metric-note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function setSelectOptions(selectNode, options, selectedValue) {
  if (!selectNode) {
    return;
  }
  selectNode.innerHTML = options
    .map(
      (option) => `
        <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>
          ${escapeHtml(option.label)}
        </option>
      `
    )
    .join("");
}

function renderFilters() {
  ensureUiSelections();
  setSelectOptions(
    document.getElementById("monthFilter"),
    buildMonthOptions().map((month) => ({ value: month, label: formatMonthLabel(month) })),
    uiState.selectedMonth
  );
  setSelectOptions(
    document.getElementById("teacherFilter"),
    [
      { value: "all", label: "全部老师" },
      ...state.teachers.map((teacher) => ({ value: teacher.name, label: teacher.name })),
    ],
    uiState.selectedTeacherName
  );
  setSelectOptions(
    document.getElementById("dateFilter"),
    buildMonthDateOptions(uiState.selectedMonth).map((dateValue) => ({
      value: dateValue,
      label: formatDateLabel(dateValue),
    })),
    uiState.selectedDate
  );
  setSelectOptions(
    document.getElementById("roomFilter"),
    [
      { value: "all", label: "全部教室" },
      ...state.rooms.map((room) => ({ value: room.name, label: room.name })),
    ],
    uiState.selectedRoomName
  );
  const statusNode = document.getElementById("statusFilter");
  if (statusNode) {
    statusNode.value = uiState.selectedStatus;
  }
  const confirmationNode = document.getElementById("confirmationFilter");
  if (confirmationNode) {
    confirmationNode.value = uiState.selectedConfirmation;
  }
}

function renderTeacherCalendar() {
  const node = document.getElementById("teacherCalendar");
  if (!node) {
    return;
  }
  if (!uiState.selectedMonth) {
    node.innerHTML = '<div class="empty-state">当前还没有可显示的月份。</div>';
    return;
  }
  const calendarEntries = getMonthlyFilteredEntries({ ignoreDate: true });
  const entryMap = new Map();
  for (const entry of calendarEntries) {
    if (!entryMap.has(entry.courseDate)) {
      entryMap.set(entry.courseDate, []);
    }
    entryMap.get(entry.courseDate).push(entry);
  }

  const weekdayHeaders = WEEKDAY_LABELS.map(
    (label) => `<div class="calendar-cell calendar-weekday">${escapeHtml(label)}</div>`
  ).join("");
  const cells = buildCalendarCells(uiState.selectedMonth)
    .map((cell) => {
      if (!cell.date) {
        return '<div class="calendar-cell is-empty"></div>';
      }
      const entries = (entryMap.get(cell.date) || []).sort(compareEntries);
      const chips = entries.length
        ? entries
            .map(
              (entry) => `
                <div class="entry-chip ${escapeHtml(entry.confirmationStatus)} ${escapeHtml(entry.scheduleStatus)}">
                  <div class="entry-chip-title">${escapeHtml(entry.startTime || "--")} - ${escapeHtml(entry.endTime || "--")} · ${escapeHtml(entry.className || "未命名班级")}</div>
                  <div class="entry-chip-meta">${escapeHtml(entry.teacherName || "未填老师")} · ${escapeHtml(entry.classroomName || "未填教室")} · ${escapeHtml(formatConfirmationStatus(entry.confirmationStatus))}</div>
                </div>
              `
            )
            .join("")
        : '<div class="calendar-day-meta">当天暂无排课</div>';
      return `
        <div class="calendar-cell">
          <div class="calendar-day-label">
            <span>${escapeHtml(String(cell.day))}</span>
            <span class="calendar-day-meta">${escapeHtml(cell.weekdayLabel)}</span>
          </div>
          <div class="entry-chip-list">${chips}</div>
        </div>
      `;
    })
    .join("");
  node.innerHTML = `${weekdayHeaders}${cells}`;
}

function renderRoomDayBoard() {
  const node = document.getElementById("roomDayBoard");
  if (!node) {
    return;
  }
  if (!uiState.selectedDate) {
    node.innerHTML = '<div class="empty-state">当前还没有可显示的日期。</div>';
    return;
  }
  const entries = getMonthlyFilteredEntries().sort(compareEntries);
  const entryMap = new Map();
  for (const room of state.rooms) {
    entryMap.set(room.name, []);
  }
  for (const entry of entries) {
    if (!entryMap.has(entry.classroomName)) {
      entryMap.set(entry.classroomName, []);
    }
    entryMap.get(entry.classroomName).push(entry);
  }

  const roomCards = [...entryMap.entries()]
    .filter(([roomName]) => uiState.selectedRoomName === "all" || roomName === uiState.selectedRoomName)
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN"))
    .map(([roomName, roomEntries]) => {
      const details = roomEntries.length
        ? roomEntries
            .map(
              (entry) => `
                <div class="entry-chip ${escapeHtml(entry.confirmationStatus)} ${escapeHtml(entry.scheduleStatus)}">
                  <div class="entry-chip-title">${escapeHtml(entry.startTime || "--")} - ${escapeHtml(entry.endTime || "--")} · ${escapeHtml(entry.className || "未命名班级")}</div>
                  <div class="entry-chip-meta">${escapeHtml(entry.teacherName || "未填老师")} · ${escapeHtml(formatScheduleStatus(entry.scheduleStatus))} · ${escapeHtml(formatConfirmationStatus(entry.confirmationStatus))}</div>
                </div>
              `
            )
            .join("")
        : '<p class="empty-state">当天该教室暂无排课。</p>';
      return `
        <article class="room-card">
          <h3>${escapeHtml(roomName || "未命名教室")}</h3>
          <p>${escapeHtml(formatDateLabel(uiState.selectedDate))}</p>
          <div class="entry-chip-list">${details}</div>
        </article>
      `;
    });
  node.innerHTML = roomCards.length
    ? roomCards.join("")
    : '<div class="empty-state">当前筛选下没有教室数据。</div>';
}

function renderEntriesTable() {
  const body = document.getElementById("entryTableBody");
  if (!body) {
    return;
  }
  const entries = getTableEntries();
  if (!entries.length) {
    body.innerHTML = `
      <tr>
        <td colspan="11" class="empty-state">当前筛选下还没有平时排课行。可以先导入 <code>teacher-schedules-template.csv</code>，或直接点“新增排课行”。</td>
      </tr>
    `;
    return;
  }

  const html = entries
    .map((entry) => {
      const index = state.scheduleEntries.findIndex((item) => item.id === entry.id);
      const regularModeViolation = getRegularModeViolation(entry);
      return `
        <tr class="${regularModeViolation ? "is-invalid" : ""}">
          <td><input class="cell-input" data-index="${index}" data-field="teacherName" value="${escapeHtml(entry.teacherName)}"></td>
          <td><input class="cell-input" data-index="${index}" data-field="className" value="${escapeHtml(entry.className)}"></td>
          <td><input class="cell-input" data-index="${index}" data-field="courseDate" type="date" value="${escapeHtml(entry.courseDate)}"></td>
          <td><input class="cell-input" data-index="${index}" data-field="slotIndex" type="number" min="0" value="${escapeHtml(String(entry.slotIndex || 0))}"></td>
          <td><input class="cell-input" data-index="${index}" data-field="startTime" value="${escapeHtml(entry.startTime)}"></td>
          <td><input class="cell-input" data-index="${index}" data-field="endTime" value="${escapeHtml(entry.endTime)}"></td>
          <td><input class="cell-input" data-index="${index}" data-field="classroomName" value="${escapeHtml(entry.classroomName)}"></td>
          <td>
            <select class="cell-select" data-index="${index}" data-field="scheduleStatus">
              <option value="scheduled" ${entry.scheduleStatus === "scheduled" ? "selected" : ""}>正常排课</option>
              <option value="adjusted" ${entry.scheduleStatus === "adjusted" ? "selected" : ""}>调课</option>
              <option value="makeup" ${entry.scheduleStatus === "makeup" ? "selected" : ""}>补课</option>
              <option value="leave" ${entry.scheduleStatus === "leave" ? "selected" : ""}>停课/休息</option>
            </select>
          </td>
          <td>
            <select class="cell-select" data-index="${index}" data-field="confirmationStatus">
              <option value="confirmed" ${entry.confirmationStatus === "confirmed" ? "selected" : ""}>已确认</option>
              <option value="pending" ${entry.confirmationStatus === "pending" ? "selected" : ""}>待确认</option>
            </select>
          </td>
          <td>
            <input class="cell-input" data-index="${index}" data-field="notes" value="${escapeHtml(entry.notes)}">
            ${regularModeViolation ? `<div class="cell-warning">${escapeHtml(regularModeViolation)}</div>` : ""}
          </td>
          <td><button class="mini-button" data-delete-index="${index}">删除</button></td>
        </tr>
      `;
    })
    .join("");
  body.innerHTML = html;
}

function renderSimpleEntryList() {
  const node = document.getElementById("simpleEntryList");
  if (!node) {
    return;
  }
  const entries = getMonthlyFilteredEntries();
  if (!entries.length) {
    node.innerHTML = `
      <div class="empty-state">当前筛选下还没有平时排课行。可以先导入 <code>teacher-schedules-template.csv</code>，或直接点“新增排课行”。</div>
    `;
    return;
  }

  node.innerHTML = entries
    .map((entry) => {
      const index = state.scheduleEntries.findIndex((item) => item.id === entry.id);
      const regularModeViolation = getRegularModeViolation(entry);
      const dateLabel = formatDateLabel(entry.courseDate);
      const timeLabel = `${entry.startTime || "--"} - ${entry.endTime || "--"}`;
      return `
        <article class="simple-edit-card ${regularModeViolation ? "is-invalid" : ""}">
          <div class="simple-card-header">
            <div class="simple-card-title">
              <strong>${escapeHtml(entry.className || "未命名班级")}</strong>
              <div class="simple-card-meta">${escapeHtml(entry.teacherName || "未填老师")} · ${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</div>
            </div>
            <button class="simple-remove-button" data-delete-index="${index}">删除</button>
          </div>
          <div class="simple-card-grid">
            <label class="simple-card-field">
              <span class="field-label">老师</span>
              <input class="cell-input" data-index="${index}" data-field="teacherName" value="${escapeHtml(entry.teacherName)}">
            </label>
            <label class="simple-card-field">
              <span class="field-label">班级</span>
              <input class="cell-input" data-index="${index}" data-field="className" value="${escapeHtml(entry.className)}">
            </label>
            <label class="simple-card-field">
              <span class="field-label">日期</span>
              <input class="cell-input" data-index="${index}" data-field="courseDate" type="date" value="${escapeHtml(entry.courseDate)}">
            </label>
            <label class="simple-card-field">
              <span class="field-label">序号</span>
              <input class="cell-input" data-index="${index}" data-field="slotIndex" type="number" min="0" value="${escapeHtml(String(entry.slotIndex || 0))}">
            </label>
            <label class="simple-card-field">
              <span class="field-label">开始</span>
              <input class="cell-input" data-index="${index}" data-field="startTime" value="${escapeHtml(entry.startTime)}">
            </label>
            <label class="simple-card-field">
              <span class="field-label">结束</span>
              <input class="cell-input" data-index="${index}" data-field="endTime" value="${escapeHtml(entry.endTime)}">
            </label>
            <label class="simple-card-field">
              <span class="field-label">教室</span>
              <input class="cell-input" data-index="${index}" data-field="classroomName" value="${escapeHtml(entry.classroomName)}">
            </label>
            <label class="simple-card-field">
              <span class="field-label">排课状态</span>
              <select class="cell-select" data-index="${index}" data-field="scheduleStatus">
                <option value="scheduled" ${entry.scheduleStatus === "scheduled" ? "selected" : ""}>正常排课</option>
                <option value="adjusted" ${entry.scheduleStatus === "adjusted" ? "selected" : ""}>调课</option>
                <option value="makeup" ${entry.scheduleStatus === "makeup" ? "selected" : ""}>补课</option>
                <option value="leave" ${entry.scheduleStatus === "leave" ? "selected" : ""}>停课/休息</option>
              </select>
            </label>
            <label class="simple-card-field">
              <span class="field-label">确认状态</span>
              <select class="cell-select" data-index="${index}" data-field="confirmationStatus">
                <option value="confirmed" ${entry.confirmationStatus === "confirmed" ? "selected" : ""}>已确认</option>
                <option value="pending" ${entry.confirmationStatus === "pending" ? "selected" : ""}>待确认</option>
              </select>
            </label>
            <label class="simple-card-field is-wide">
              <span class="field-label">备注</span>
              <input class="cell-input" data-index="${index}" data-field="notes" value="${escapeHtml(entry.notes)}">
              ${regularModeViolation ? `<div class="cell-warning">${escapeHtml(regularModeViolation)}</div>` : ""}
            </label>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderApp() {
  ensureUiSelections();
  persistUiState();
  renderFilters();
  renderFilterHint();
  renderMetrics();
  renderTeacherCalendar();
  renderRoomDayBoard();
  renderEntriesTable();
  renderSimpleEntryList();
  renderSaveStatus();
}

function updateUiFilter(field, value) {
  uiState[field] = value;
  persistUiState();
  renderApp();
}

async function submitImportQuestions() {
  if (!localDbStatus.available || !localDbStatus.importRegularRowsUrl) {
    uiState.importLog = "当前没有连接平时后台，不能提交问题修正。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  const questions = Array.isArray(uiState.importQuestions) ? uiState.importQuestions : [];
  if (!questions.length) {
    uiState.importLog = "当前没有待补齐的问题行。";
    persistUiState();
    renderSaveStatus();
    return;
  }
  try {
    const response = await fetch(localDbStatus.importRegularRowsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_name: "question-resolution",
        rows: questions.map((question) => question.row || {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state = normalizeState(payload.snapshot || {});
    localDbStatus.lastSavedAt = payload.saved_at || "";
    localDbStatus.lastError = "";
    uiState.importQuestions = Array.isArray(payload.questions) ? payload.questions : [];
    const acceptedCount = Number(payload.accepted_count || 0);
    const questionCount = Number(payload.question_count || 0);
    uiState.importLog =
      `已提交问题修正：写入 ${acceptedCount} 行` +
      (questionCount ? `，仍有 ${questionCount} 行待确认` : "，问题已清空") +
      "。";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    uiState.lastSavedAt = new Date().toISOString();
    uiState.browserSnapshotOrigin = "backend_database";
    persistUiState();
    await refreshLocalDatabaseHistory({ silent: true });
    renderApp();
  } catch (error) {
    localDbStatus.lastError = error.message;
    uiState.importLog = `提交问题修正失败：${error.message}`;
    persistUiState();
    renderSaveStatus();
  }
}

function handleImportQuestionsChange(event) {
  const index = Number(event.target.getAttribute("data-question-index"));
  const field = event.target.getAttribute("data-question-field");
  if (!field || Number.isNaN(index) || !uiState.importQuestions[index]) {
    return;
  }
  const nextQuestions = [...uiState.importQuestions];
  nextQuestions[index] = {
    ...nextQuestions[index],
    row: {
      ...(nextQuestions[index].row || {}),
      [field]: String(event.target.value || "").trim(),
    },
  };
  uiState.importQuestions = nextQuestions;
  persistUiState();
}

function handleImportQuestionsClick(event) {
  const applyIndex = event.target.getAttribute("data-question-apply-index");
  if (applyIndex !== null) {
    const index = Number(applyIndex);
    const question = uiState.importQuestions[index];
    if (!Number.isNaN(index) && question && question.suggested_row) {
      uiState.importQuestions = uiState.importQuestions.map((item, questionIndex) =>
        questionIndex === index
          ? {
              ...item,
              row: {
                ...(item.row || {}),
                ...(item.suggested_row || {}),
              },
            }
          : item
      );
      uiState.importLog = `已采用第 ${question.row_number || index + 1} 行的系统建议。`;
      persistUiState();
      renderSaveStatus();
    }
    return;
  }
  const applyField = event.target.getAttribute("data-question-field-apply");
  if (applyField !== null) {
    const index = Number(event.target.getAttribute("data-question-index"));
    const question = uiState.importQuestions[index];
    if (!Number.isNaN(index) && question) {
      const suggestedValue = getQuestionSuggestedValue(question, applyField);
      if (suggestedValue) {
        uiState.importQuestions = uiState.importQuestions.map((item, questionIndex) =>
          questionIndex === index
            ? {
                ...item,
                row: {
                  ...(item.row || {}),
                  [applyField]: suggestedValue,
                },
              }
            : item
        );
        persistUiState();
        renderSaveStatus();
      }
    }
    return;
  }
  const applyCandidateField = event.target.getAttribute("data-question-field-candidate");
  if (applyCandidateField !== null) {
    const index = Number(event.target.getAttribute("data-question-index"));
    const candidateValue = String(event.target.getAttribute("data-question-candidate-value") || "").trim();
    if (!Number.isNaN(index) && uiState.importQuestions[index] && candidateValue) {
      uiState.importQuestions = uiState.importQuestions.map((item, questionIndex) =>
        questionIndex === index
          ? {
              ...item,
              row: {
                ...(item.row || {}),
                [applyCandidateField]: candidateValue,
              },
            }
          : item
      );
      uiState.importLog = `已采用候选${candidateValue}。`;
      persistUiState();
      renderSaveStatus();
    }
    return;
  }
  const removeIndex = event.target.getAttribute("data-question-remove-index");
  if (removeIndex !== null) {
    const index = Number(removeIndex);
    if (!Number.isNaN(index) && uiState.importQuestions[index]) {
      uiState.importQuestions = uiState.importQuestions.filter((_, questionIndex) => questionIndex !== index);
      uiState.importLog = `已先跳过 1 行待确认记录，当前还剩 ${uiState.importQuestions.length} 行。`;
      persistUiState();
      renderSaveStatus();
    }
    return;
  }
  if (event.target.id === "submitImportQuestionsButton") {
    submitImportQuestions();
    return;
  }
  if (event.target.id === "clearImportQuestionsButton") {
    uiState.importQuestions = [];
    uiState.importLog = "已清空当前问题列表。";
    persistUiState();
    renderSaveStatus();
  }
}

function handleEntryTableChange(event) {
  const deleteIndex = event.target.getAttribute("data-delete-index");
  if (deleteIndex !== null) {
    const index = Number(deleteIndex);
    if (state.scheduleEntries[index]) {
      state.scheduleEntries.splice(index, 1);
      persistState("已删除一条平时排课行。");
      renderApp();
    }
    return;
  }

  const index = Number(event.target.getAttribute("data-index"));
  const field = event.target.getAttribute("data-field");
  if (!field || !state.scheduleEntries[index]) {
    return;
  }
  const value = event.target.value;
  if (field === "slotIndex") {
    state.scheduleEntries[index][field] = Number(value || 0);
  } else if (field === "scheduleStatus") {
    state.scheduleEntries[index][field] = normalizeScheduleStatus(value);
  } else if (field === "confirmationStatus") {
    state.scheduleEntries[index][field] = normalizeConfirmationStatus(value);
  } else if (field === "startTime" || field === "endTime") {
    state.scheduleEntries[index][field] = normalizeTimeText(value);
  } else {
    state.scheduleEntries[index][field] = String(value || "").trim();
  }
  state.scheduleEntries = state.scheduleEntries.map(normalizeEntry).filter(Boolean).sort(compareEntries);
  persistState();
  renderApp();
}

function addEntry() {
  ensureUiSelections();
  const suggestedDate = getSuggestedEntryDate();
  const suggestedSlot = getSuggestedRegularModeSlot(suggestedDate);
  state.scheduleEntries.push(
    createEntry({
      teacherName: uiState.selectedTeacherName !== "all" ? uiState.selectedTeacherName : "",
      className: "",
      courseDate: suggestedDate || `${uiState.selectedMonth}-01`,
      slotIndex: suggestedSlot.slotIndex,
      startTime: suggestedSlot.startTime,
      endTime: suggestedSlot.endTime,
      classroomName: uiState.selectedRoomName !== "all" ? uiState.selectedRoomName : "",
      scheduleStatus: "scheduled",
      confirmationStatus: "pending",
      notes: "",
    })
  );
  persistState("已新增一条平时排课行。");
  renderApp();
}

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
  document.getElementById("connectBackendButton")?.addEventListener("click", connectConfiguredBackend);
  document.getElementById("clearBackendButton")?.addEventListener("click", clearConfiguredBackend);
  document.getElementById("refreshDbHistoryButton")?.addEventListener("click", () => {
    refreshLocalDatabaseHistory();
  });
  document.getElementById("restoreDbHistoryButton")?.addEventListener("click", restoreSelectedHistoryVersion);
  document.getElementById("dbHistorySelect")?.addEventListener("change", (event) => {
    uiState.selectedDbHistoryId = event.target.value || "";
    persistUiState();
  });
  document.getElementById("saveButton")?.addEventListener("click", async () => {
    if (localDbStatus.available) {
      const result = await saveStateToLocalDatabase({
        note: "manual_save",
        source: "browser_manual",
      });
      if (!result) {
        uiState.importLog = `保存到平时后台失败：${localDbStatus.lastError || "未知错误"}`;
        persistUiState();
        renderSaveStatus();
        return;
      }
      await refreshLocalDatabaseHistory({ silent: true });
      persistState("已手动保存到平时后台。", { syncLocalDb: false });
      renderSaveStatus();
      return;
    }
    persistState("已手动保存当前模式。", { syncLocalDb: false });
    renderSaveStatus();
  });
  document.getElementById("loadDbButton")?.addEventListener("click", loadStateFromLocalDatabase);
  document.getElementById("exportSnapshotButton")?.addEventListener("click", exportSnapshot);
  document.getElementById("addEntryButton")?.addEventListener("click", addEntry);
  document.getElementById("importScheduleCsvButton")?.addEventListener("click", importScheduleCsvFile);
  document.getElementById("importSnapshotButton")?.addEventListener("click", importSnapshotFile);
  document.getElementById("monthFilter")?.addEventListener("change", (event) => {
    updateUiFilter("selectedMonth", event.target.value);
  });
  document.getElementById("teacherFilter")?.addEventListener("change", (event) => {
    updateUiFilter("selectedTeacherName", event.target.value);
  });
  document.getElementById("dateFilter")?.addEventListener("change", (event) => {
    updateUiFilter("selectedDate", event.target.value);
  });
  document.getElementById("roomFilter")?.addEventListener("change", (event) => {
    updateUiFilter("selectedRoomName", event.target.value);
  });
  document.getElementById("statusFilter")?.addEventListener("change", (event) => {
    updateUiFilter("selectedStatus", event.target.value);
  });
  document.getElementById("confirmationFilter")?.addEventListener("change", (event) => {
    updateUiFilter("selectedConfirmation", event.target.value);
  });
  document.getElementById("entryTableBody")?.addEventListener("change", handleEntryTableChange);
  document.getElementById("entryTableBody")?.addEventListener("click", handleEntryTableChange);
  document.getElementById("simpleEntryList")?.addEventListener("change", handleEntryTableChange);
  document.getElementById("simpleEntryList")?.addEventListener("click", handleEntryTableChange);
  document.getElementById("importQuestions")?.addEventListener("change", handleImportQuestionsChange);
  document.getElementById("importQuestions")?.addEventListener("click", handleImportQuestionsClick);
}

let state = loadState();
let uiState = loadUiState();
let localDbStatus = createEmptyLocalDbStatus();
let localDbHistoryEntries = [];
let localDbAutosaveTimer = null;
let localDbAutosaveNote = "";

document.addEventListener("DOMContentLoaded", async () => {
  await hydrateCloudScheduleStores();
  bindEvents();
  await initializePersistence();
  renderApp();
});
