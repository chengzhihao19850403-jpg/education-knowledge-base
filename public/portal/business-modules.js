(function () {
  const nowText = () => new Date().toLocaleString("zh-CN", { hour12: false });

  function $(id) {
    return document.getElementById(id);
  }

  function readStore(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, rows) {
    localStorage.setItem(key, JSON.stringify(rows));
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = String(value);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function rowMatches(row, keyword) {
    if (!keyword) return true;
    return Object.values(row).some((value) => String(value || "").toLowerCase().includes(keyword));
  }

  function actionButtons(index) {
    return `
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" data-action="edit" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(23,33,50,0.12); background:#fff; color:#172132; cursor:pointer;">编辑</button>
        <button type="button" data-action="delete" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(185,28,28,0.18); background:rgba(185,28,28,0.08); color:#b91c1c; cursor:pointer;">删除</button>
      </div>
    `;
  }

  function bindRowActions(tableBodyId, handlers) {
    const body = $(tableBodyId);
    if (!body) return;
    body.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const index = Number(button.getAttribute("data-index"));
      if (action === "edit") handlers.onEdit(index);
      if (action === "delete") handlers.onDelete(index);
    });
  }

  function initStudentService() {
    if (!$("studentServiceTableBody")) return;
    const key = "jrc-student-service-v2";
    const defaults = {
      student: "学生 A",
      className: "暑假数学提升班",
      teacher: "待同步",
      type: "课后反馈",
      risk: "正常",
      next: "建立真实档案字段",
      content: "记录课堂掌握情况、作业完成情况、家长反馈和下一步跟进事项。"
    };
    const samples = [
      { student: "学生 A", className: "暑假数学提升班", teacher: "待同步", type: "课后反馈", risk: "正常", content: "待从课后反馈同步", next: "建立真实档案字段", createdAt: nowText() },
      { student: "学生 B", className: "六月份平时课", teacher: "待同步", type: "学习跟踪", risk: "关注", content: "待从排课课次同步", next: "同步剩余课时", createdAt: nowText() },
      { student: "学生 C", className: "试听转正式", teacher: "待同步", type: "家长沟通", risk: "正常", content: "待从招生试听同步", next: "生成入学交接单", createdAt: nowText() }
    ];
    let rows = readStore(key, samples);
    let editingIndex = -1;

    function fillForm(row) {
      $("studentNameInput").value = row.student || "";
      $("studentClassInput").value = row.className || "";
      $("studentTeacherInput").value = row.teacher || "";
      $("studentServiceTypeInput").value = row.type || "学习跟踪";
      $("studentRiskInput").value = row.risk || "正常";
      $("studentNextActionInput").value = row.next || "";
      $("studentContentInput").value = row.content || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("studentSaveButton", "保存服务记录");
    }

    function render() {
      const keyword = $("studentFilterInput")?.value.trim().toLowerCase() || "";
      $("studentServiceTableBody").innerHTML = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => rowMatches(row, keyword))
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.student)}</td>
            <td>${escapeHtml(row.className)}</td>
            <td>${escapeHtml(row.teacher)}</td>
            <td>${escapeHtml(row.type)}<br>${escapeHtml(row.content)}</td>
            <td>${escapeHtml(row.createdAt || "-")}</td>
            <td>${escapeHtml(row.risk)}</td>
            <td>${escapeHtml(row.next)}</td>
            <td>${actionButtons(index)}</td>
          </tr>
        `).join("");
      setText("studentMetricTotal", rows.length);
      setText("studentMetricFeedback", rows.filter((row) => row.type === "课后反馈").length);
      setText("studentMetricRisk", rows.filter((row) => row.risk !== "正常").length);
      setText("studentMetricCommunication", rows.filter((row) => row.type === "家长沟通").length);
    }

    $("studentSaveButton")?.addEventListener("click", () => {
      const student = $("studentNameInput")?.value.trim();
      if (!student) {
        setText("studentServiceMessage", "请先填写学生姓名。");
        return;
      }
      const payload = {
        student,
        className: $("studentClassInput")?.value.trim() || "-",
        teacher: $("studentTeacherInput")?.value.trim() || "-",
        type: $("studentServiceTypeInput")?.value || "学习跟踪",
        risk: $("studentRiskInput")?.value || "正常",
        content: $("studentContentInput")?.value.trim() || "-",
        next: $("studentNextActionInput")?.value.trim() || "-",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        setText("studentServiceMessage", `已更新 ${student} 的服务记录。`);
      } else {
        rows.unshift(payload);
        setText("studentServiceMessage", `已保存 ${student} 的服务记录。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("studentFilterInput")?.addEventListener("input", render);
    $("studentExportButton")?.addEventListener("click", () => downloadJson("学生与家长服务数据.json", rows));
    $("studentResetButton")?.addEventListener("click", () => {
      rows = samples.map((row) => ({ ...row }));
      writeStore(key, rows);
      resetForm();
      render();
      setText("studentServiceMessage", "已恢复样例数据。");
    });
    bindRowActions("studentServiceTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("studentSaveButton", "保存修改");
        setText("studentServiceMessage", `正在编辑 ${rows[index].student}。`);
      },
      onDelete(index) {
        const removed = rows[index];
        rows.splice(index, 1);
        writeStore(key, rows);
        if (editingIndex === index) resetForm();
        render();
        setText("studentServiceMessage", `已删除 ${removed.student} 的记录。`);
      }
    });
    resetForm();
    render();
  }

  function initCurriculumProducts() {
    if (!$("curriculumTableBody")) return;
    const key = "jrc-curriculum-products-v2";
    const defaults = {
      name: "五年级暑假第 1 讲",
      subject: "数学 / 五年级",
      type: "课程大纲",
      classType: "暑假班",
      version: "V0.1",
      owner: "待指定",
      note: "说明本次资料适用对象、重点难点和老师使用注意事项。"
    };
    const samples = [
      { name: "暑假数学提升课", subject: "数学 / 小学高段", type: "讲义", classType: "暑假班", status: "待导入讲义", version: "V0.1", owner: "待指定", note: "补课程大纲和课次安排", createdAt: nowText() },
      { name: "初一数学衔接课", subject: "数学 / 初一", type: "题库", classType: "暑假班、平时班", status: "待整理题库", version: "V0.1", owner: "待指定", note: "标注重点难点", createdAt: nowText() },
      { name: "科学专题课", subject: "科学 / 3-8 年级", type: "备课资料", classType: "平时班", status: "待上传资料", version: "V0.1", owner: "待指定", note: "建立资料目录", createdAt: nowText() }
    ];
    let rows = readStore(key, samples);
    let editingIndex = -1;

    function fillForm(row) {
      $("curriculumNameInput").value = row.name || "";
      $("curriculumSubjectInput").value = row.subject || "";
      $("curriculumTypeInput").value = row.type || "备课资料";
      $("curriculumClassTypeInput").value = row.classType || "";
      $("curriculumVersionInput").value = row.version || "V0.1";
      $("curriculumOwnerInput").value = row.owner || "";
      $("curriculumNoteInput").value = row.note || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("curriculumSaveButton", "保存资料版本");
    }

    function render() {
      const keyword = $("curriculumFilterInput")?.value.trim().toLowerCase() || "";
      $("curriculumTableBody").innerHTML = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => rowMatches(row, keyword))
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.subject)}</td>
            <td>${escapeHtml(row.classType)}</td>
            <td>${escapeHtml(row.type)} / ${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.version)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${escapeHtml(row.note)}</td>
            <td>${actionButtons(index)}</td>
          </tr>
        `).join("");
      setText("curriculumMetricOutline", rows.filter((row) => row.type === "课程大纲").length);
      setText("curriculumMetricMaterials", rows.filter((row) => ["讲义", "题库"].includes(row.type)).length);
      setText("curriculumMetricProducts", new Set(rows.map((row) => row.classType)).size);
      setText("curriculumMetricPreparation", rows.filter((row) => row.type === "备课资料").length);
    }

    $("curriculumSaveButton")?.addEventListener("click", () => {
      const name = $("curriculumNameInput")?.value.trim();
      if (!name) {
        setText("curriculumMessage", "请先填写资料名称。");
        return;
      }
      const payload = {
        name,
        subject: $("curriculumSubjectInput")?.value.trim() || "-",
        type: $("curriculumTypeInput")?.value || "备课资料",
        classType: $("curriculumClassTypeInput")?.value || "-",
        status: editingIndex >= 0 ? rows[editingIndex].status : "已录入",
        version: $("curriculumVersionInput")?.value.trim() || "V0.1",
        owner: $("curriculumOwnerInput")?.value.trim() || "-",
        note: $("curriculumNoteInput")?.value.trim() || "-",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        setText("curriculumMessage", `已更新 ${name}。`);
      } else {
        rows.unshift(payload);
        setText("curriculumMessage", `已保存 ${name}。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("curriculumFilterInput")?.addEventListener("input", render);
    $("curriculumExportButton")?.addEventListener("click", () => downloadJson("教研与课程产品数据.json", rows));
    $("curriculumResetButton")?.addEventListener("click", () => {
      rows = samples.map((row) => ({ ...row }));
      writeStore(key, rows);
      resetForm();
      render();
      setText("curriculumMessage", "已恢复样例数据。");
    });
    bindRowActions("curriculumTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("curriculumSaveButton", "保存修改");
        setText("curriculumMessage", `正在编辑 ${rows[index].name}。`);
      },
      onDelete(index) {
        const removed = rows[index];
        rows.splice(index, 1);
        writeStore(key, rows);
        if (editingIndex === index) resetForm();
        render();
        setText("curriculumMessage", `已删除 ${removed.name}。`);
      }
    });
    resetForm();
    render();
  }

  function initHrTraining() {
    if (!$("hrTaskTableBody")) return;
    const key = "jrc-hr-training-tasks-v2";
    const defaults = {
      type: "入职",
      employee: "待选择",
      system: "统一登录、财务",
      status: "待处理",
      owner: "管理员",
      next: "补齐信息并归档",
      note: "记录调整原因、对应系统、执行时间和是否需要财务同步。"
    };
    const samples = [
      { type: "员工基础档案核对", employee: "全体员工", system: "统一登录、财务", status: "处理中", owner: "管理员", next: "补齐手机号、微信、入职日期、提成比例", note: "统一整理员工档案", createdAt: nowText() },
      { type: "系统权限分组", employee: "学管、财务、授课老师", system: "所有系统", status: "处理中", owner: "管理员", next: "按真实岗位继续细分查看和修改权限", note: "权限逐步细化", createdAt: nowText() },
      { type: "培训记录归档", employee: "学管、授课老师", system: "知识库问答系统", status: "待处理", owner: "学管负责人", next: "同步学习内容和阶段测试结果", note: "后续接知识库测试", createdAt: nowText() }
    ];
    let rows = readStore(key, samples);
    let editingIndex = -1;

    function fillForm(row) {
      $("hrTypeInput").value = row.type || "培训记录";
      $("hrEmployeeInput").value = row.employee || "";
      $("hrSystemInput").value = row.system || "";
      $("hrStatusInput").value = row.status || "待处理";
      $("hrOwnerInput").value = row.owner || "";
      $("hrNextInput").value = row.next || "";
      $("hrNoteInput").value = row.note || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("hrSaveButton", "保存人事事项");
    }

    function render() {
      const keyword = $("hrFilterInput")?.value.trim().toLowerCase() || "";
      $("hrTaskTableBody").innerHTML = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => rowMatches(row, keyword))
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.employee)}</td>
            <td>${escapeHtml(row.system)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${escapeHtml(row.next)}<br>${escapeHtml(row.note)}</td>
            <td>${actionButtons(index)}</td>
          </tr>
        `).join("");
      const employees = Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [];
      setText("hrMetricEmployees", employees.length || 0);
      setText("hrMetricRegular", employees.filter((employee) => !employee.regularDate).length);
      setText("hrMetricCommission", employees.filter((employee) => employee.commissionRate).length);
      setText("hrMetricTraining", rows.filter((row) => row.type === "培训记录" || row.system.includes("知识库")).length);
    }

    $("hrSaveButton")?.addEventListener("click", () => {
      const employee = $("hrEmployeeInput")?.value.trim();
      if (!employee) {
        setText("hrMessage", "请先填写员工姓名或对象。");
        return;
      }
      const payload = {
        type: $("hrTypeInput")?.value || "培训记录",
        employee,
        system: $("hrSystemInput")?.value.trim() || "-",
        status: $("hrStatusInput")?.value || "待处理",
        owner: $("hrOwnerInput")?.value.trim() || "-",
        next: $("hrNextInput")?.value.trim() || "-",
        note: $("hrNoteInput")?.value.trim() || "-",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        setText("hrMessage", `已更新 ${employee} 的事项。`);
      } else {
        rows.unshift(payload);
        setText("hrMessage", `已保存 ${employee} 的事项。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("hrFilterInput")?.addEventListener("input", render);
    $("hrExportButton")?.addEventListener("click", () => downloadJson("人事与培训事项数据.json", rows));
    $("hrResetButton")?.addEventListener("click", () => {
      rows = samples.map((row) => ({ ...row }));
      writeStore(key, rows);
      resetForm();
      render();
      setText("hrMessage", "已恢复样例数据。");
    });
    bindRowActions("hrTaskTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("hrSaveButton", "保存修改");
        setText("hrMessage", `正在编辑 ${rows[index].employee} 的事项。`);
      },
      onDelete(index) {
        const removed = rows[index];
        rows.splice(index, 1);
        writeStore(key, rows);
        if (editingIndex === index) resetForm();
        render();
        setText("hrMessage", `已删除 ${removed.employee} 的事项。`);
      }
    });
    resetForm();
    render();
  }

  function initCampusOperations() {
    if (!$("campusTableBody")) return;
    const key = "jrc-campus-operations-v2";
    const defaults = {
      title: "教室可用状态核对",
      type: "教室",
      area: "全校区",
      owner: "待指定",
      status: "待处理",
      due: "暑假班前",
      note: "记录发生时间、地点、影响范围、处理要求和是否需要通知家长或老师。"
    };
    const samples = [
      { title: "教室可用状态核对", type: "教室", area: "全校区", owner: "待指定", status: "待处理", due: "暑假班前", note: "同步到排课教室占用", createdAt: nowText() },
      { title: "暑假值班表", type: "值班", area: "前台 / 教室", owner: "待指定", status: "待处理", due: "每周更新", note: "和暑假课程高峰匹配", createdAt: nowText() },
      { title: "门店异常记录", type: "异常记录", area: "校区日常", owner: "待指定", status: "需复盘", due: "即时处理", note: "记录原因、处理人、复盘结果", createdAt: nowText() }
    ];
    let rows = readStore(key, samples);
    let editingIndex = -1;

    function fillForm(row) {
      $("campusTitleInput").value = row.title || "";
      $("campusTypeInput").value = row.type || "异常记录";
      $("campusAreaInput").value = row.area || "";
      $("campusOwnerInput").value = row.owner || "";
      $("campusStatusInput").value = row.status || "待处理";
      $("campusDueInput").value = row.due || "";
      $("campusNoteInput").value = row.note || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("campusSaveButton", "保存运营事项");
    }

    function render() {
      const keyword = $("campusFilterInput")?.value.trim().toLowerCase() || "";
      $("campusTableBody").innerHTML = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => rowMatches(row, keyword))
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.area)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.due)}</td>
            <td>${escapeHtml(row.note)}</td>
            <td>${actionButtons(index)}</td>
          </tr>
        `).join("");
      setText("campusMetricRoom", rows.filter((row) => row.type === "教室").length);
      setText("campusMetricDuty", rows.filter((row) => row.type === "值班" || row.type === "暑假排班").length);
      setText("campusMetricSafety", rows.filter((row) => row.type === "安全检查").length);
      setText("campusMetricOpen", rows.filter((row) => row.status !== "已完成").length);
    }

    $("campusSaveButton")?.addEventListener("click", () => {
      const title = $("campusTitleInput")?.value.trim();
      if (!title) {
        setText("campusMessage", "请先填写事项名称。");
        return;
      }
      const payload = {
        title,
        type: $("campusTypeInput")?.value || "异常记录",
        area: $("campusAreaInput")?.value.trim() || "-",
        owner: $("campusOwnerInput")?.value.trim() || "-",
        status: $("campusStatusInput")?.value || "待处理",
        due: $("campusDueInput")?.value.trim() || "-",
        note: $("campusNoteInput")?.value.trim() || "-",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        setText("campusMessage", `已更新运营事项：${title}。`);
      } else {
        rows.unshift(payload);
        setText("campusMessage", `已保存运营事项：${title}。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("campusFilterInput")?.addEventListener("input", render);
    $("campusExportButton")?.addEventListener("click", () => downloadJson("校区运营事项数据.json", rows));
    $("campusResetButton")?.addEventListener("click", () => {
      rows = samples.map((row) => ({ ...row }));
      writeStore(key, rows);
      resetForm();
      render();
      setText("campusMessage", "已恢复样例数据。");
    });
    bindRowActions("campusTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("campusSaveButton", "保存修改");
        setText("campusMessage", `正在编辑 ${rows[index].title}。`);
      },
      onDelete(index) {
        const removed = rows[index];
        rows.splice(index, 1);
        writeStore(key, rows);
        if (editingIndex === index) resetForm();
        render();
        setText("campusMessage", `已删除运营事项：${removed.title}。`);
      }
    });
    resetForm();
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initStudentService();
    initCurriculumProducts();
    initHrTraining();
    initCampusOperations();
  });
})();
