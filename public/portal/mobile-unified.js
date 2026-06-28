(function () {
  const feedbackStoreKey = "jrc-site-feedback-v1";

  function currentEmployee() {
    return window.JRC_CURRENT_EMPLOYEE || null;
  }

  function safeParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw || "");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readFeedbackRows() {
    const rows = safeParse(localStorage.getItem(feedbackStoreKey), []);
    return Array.isArray(rows) ? rows : [];
  }

  function rowBelongsToCurrentUser(row) {
    const employee = currentEmployee();
    if (!employee) return false;
    const currentName = String(employee.name || "").trim();
    const currentUsername = String(employee.username || "").trim().toLowerCase();
    const rowName = String(row?.userName || row?.name || "").trim();
    const rowUsername = String(row?.username || "").trim().toLowerCase();
    return Boolean((currentName && rowName === currentName) || (currentUsername && rowUsername === currentUsername));
  }

  function statusTone(status) {
    if (["已确认解决", "已处理", "已转任务"].includes(status)) return "done";
    if (status === "继续反馈") return "warn";
    return "open";
  }

  function feedbackStats(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const processedStatuses = ["已确认解决", "已处理", "已转任务"];
    const processed = list.filter((row) => processedStatuses.includes(row?.status || "")).length;
    const reopened = list.filter((row) => row?.status === "继续反馈").length;
    return {
      total: list.length,
      processed,
      pending: Math.max(0, list.length - processed),
      reopened
    };
  }

  function writeFeedbackRows(rows) {
    localStorage.setItem(feedbackStoreKey, JSON.stringify(rows.slice(0, 300)));
  }

  function mergeFeedbackRows(...groups) {
    const map = new Map();
    const rowTime = (row) => {
      const notes = Array.isArray(row?.reviewNotes) ? row.reviewNotes : [];
      const noteTime = notes.map((note) => Date.parse(note?.time || "") || 0).reduce((max, value) => Math.max(max, value), 0);
      return Math.max(
        Date.parse(row?.updatedAt || "") || 0,
        Date.parse(row?.processedAt || "") || 0,
        Date.parse(row?.confirmedAt || "") || 0,
        Date.parse(row?.reopenedAt || "") || 0,
        Date.parse(row?.createdAt || "") || 0,
        noteTime
      );
    };
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = String(row.id || "").trim() || `FB-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const existing = map.get(id);
      if (!existing) {
        map.set(id, { ...row, id });
        return;
      }
      const rowIsNewer = rowTime(row) >= rowTime(existing);
      map.set(id, rowIsNewer ? { ...existing, ...row, id } : { ...row, ...existing, id });
    });
    return [...map.values()]
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
      .slice(0, 300);
  }

  function systemName() {
    const subtitle = document.querySelector(".brand-subtitle")?.textContent?.trim();
    const title = document.querySelector("h1")?.textContent?.trim();
    if (subtitle && title) return `${subtitle}｜${title}`;
    return title || document.title || "匠人程工作台";
  }

  async function saveFeedback(row) {
    let rows = mergeFeedbackRows([row], readFeedbackRows());
    writeFeedbackRows(rows);
    if (!window.JRC_CLOUD?.writeModuleData) {
      return { ok: false, localOnly: true };
    }
    try {
      if (window.JRC_CLOUD?.readModuleData) {
        const remote = await window.JRC_CLOUD.readModuleData(feedbackStoreKey);
        const remoteRows = Array.isArray(remote?.data?.payload) ? remote.data.payload : [];
        rows = mergeFeedbackRows([row], readFeedbackRows(), remoteRows);
        writeFeedbackRows(rows);
      }
      const result = await window.JRC_CLOUD.writeModuleData(feedbackStoreKey, "siteFeedback", rows);
      return result?.ok ? { ok: true } : { ok: false, localOnly: true };
    } catch {
      return { ok: false, localOnly: true };
    }
  }

  function enhanceTables() {
    document.querySelectorAll(".table-wrap").forEach((wrap) => {
      wrap.setAttribute("data-scroll-hint", "true");
      if (!wrap.hasAttribute("tabindex")) wrap.setAttribute("tabindex", "0");
      if (!wrap.getAttribute("aria-label")) wrap.setAttribute("aria-label", "可横向滑动的数据表格");
      const table = wrap.querySelector("table");
      if (table && !table.getAttribute("role")) {
        table.setAttribute("role", "table");
      }
    });
  }

  function enhanceActionGroups() {
    document.querySelectorAll(".actions, .section-actions, .top-actions, .filters").forEach((group) => {
      const buttons = group.querySelectorAll("button, .button, .nav-link, .status-chip");
      if (buttons.length >= 2) group.setAttribute("data-action-group", "true");
    });
  }

  function ensureFloatingHome() {
    const path = window.location.pathname;
    const isPortalHome = path.endsWith("/portal/index.html") || path.endsWith("/portal/") || path.endsWith("/portal");
    if (isPortalHome || document.querySelector(".jrc-floating-home")) return;
    const link = document.createElement("a");
    link.className = "jrc-floating-home";
    link.href = "/jrcedu/portal/index.html";
    link.textContent = "返回工作台";
    document.body.appendChild(link);
  }

  function ensurePwaHead() {
    const head = document.head;
    if (!head) return;
    const addMeta = (name, content) => {
      if (head.querySelector(`meta[name="${name}"]`)) return;
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      head.appendChild(meta);
    };
    const addLink = (rel, href, extra = {}) => {
      if (head.querySelector(`link[rel="${rel}"]`)) return;
      const link = document.createElement("link");
      link.rel = rel;
      link.href = href;
      Object.entries(extra).forEach(([key, value]) => link.setAttribute(key, value));
      head.appendChild(link);
    };
    addMeta("theme-color", "#0d9488");
    addMeta("apple-mobile-web-app-capable", "yes");
    addMeta("apple-mobile-web-app-title", "匠人程工作台");
    addMeta("mobile-web-app-capable", "yes");
    addLink("manifest", "/jrcedu/manifest.webmanifest");
    addLink("apple-touch-icon", "/jrcedu/icon.svg");
  }

  function slugifyHeading(text, fallback) {
    const base = String(text || "").trim().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fa5-]/g, "");
    return base || fallback;
  }

  function ensureSectionDock() {
    if (document.querySelector(".jrc-section-dock")) return;
    const sections = [...document.querySelectorAll("main > section[id], main > article[id]")]
      .map((section, index) => {
        const heading = section.querySelector("h2, h1");
        const title = heading?.textContent?.trim();
        if (!title) return null;
        if (!section.id) section.id = slugifyHeading(title, `section-${index + 1}`);
        return { id: section.id, title, node: section };
      })
      .filter(Boolean);
    if (sections.length < 4) return;

    const shell = document.querySelector("main .shell") || document.querySelector("main");
    const topbar = document.querySelector(".topbar");
    if (!shell || !topbar) return;

    const dock = document.createElement("nav");
    dock.className = "jrc-section-dock";
    dock.setAttribute("aria-label", "页面分段导航");
    dock.innerHTML = `
      <strong>快速跳转</strong>
      <div class="jrc-section-dock__scroll">
        ${sections.map((section) => `<a class="jrc-section-dock__link" href="#${section.id}">${section.title}</a>`).join("")}
      </div>
    `;
    topbar.insertAdjacentElement("afterend", dock);

    const links = [...dock.querySelectorAll(".jrc-section-dock__link")];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const activeId = visible.target.id;
      links.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`));
    }, {
      rootMargin: "-20% 0px -55% 0px",
      threshold: [0.1, 0.25, 0.5]
    });

    sections.forEach((section) => observer.observe(section.node));
  }

  function enhanceFormFocus() {
    if (!window.matchMedia?.("(max-width: 760px)")?.matches) return;
    document.querySelectorAll("input, select, textarea").forEach((node) => {
      node.addEventListener("focus", () => {
        window.setTimeout(() => {
          node.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 180);
      }, { passive: true });
    });
  }

  function ensureFeedbackDock() {
    if (document.querySelector(".jrc-feedback-dock")) return;
    const dock = document.createElement("div");
    dock.className = "jrc-feedback-dock";
    dock.innerHTML = `
      <button class="jrc-help-button" type="button">使用方法AI提问助手</button>
      <div class="jrc-help-panel" hidden>
        <div class="jrc-feedback-head">
          <strong>使用方法AI提问助手</strong>
          <button type="button" class="jrc-help-close" aria-label="关闭使用方法助手">×</button>
        </div>
        <div class="jrc-help-quick">
          <button type="button" data-jrc-help-question="这个页面应该先看哪里、先点哪里？">怎么用</button>
          <button type="button" data-jrc-help-question="这个页面的数据不对，我应该怎么核对？">怎么核对</button>
          <button type="button" data-jrc-help-question="我看不懂这个系统，应该怎么反馈问题？">怎么反馈</button>
        </div>
        <label>
          你的问题
          <textarea class="jrc-help-question" placeholder="例如：这个页面我应该先点哪里？试听结束后下一步怎么做？"></textarea>
        </label>
        <button class="jrc-help-submit" type="button">问 AI</button>
        <div class="jrc-help-answer" aria-live="polite">
          点上面的快捷问题，或输入当前页面的使用问题后点“问 AI”。
        </div>
      </div>
      <button class="jrc-feedback-button" type="button">反馈问题</button>
      <div class="jrc-feedback-panel" hidden>
        <div class="jrc-feedback-head">
          <strong>反馈问题</strong>
          <button type="button" class="jrc-feedback-close" aria-label="关闭反馈">×</button>
        </div>
        <label>
          问题类型
          <select class="jrc-feedback-type">
            <option>不好操作</option>
            <option>看不懂</option>
            <option>数据不对</option>
            <option>按钮点不开</option>
            <option>手机显示问题</option>
            <option>功能建议</option>
          </select>
        </label>
        <label>
          紧急程度
          <select class="jrc-feedback-severity">
            <option>普通</option>
            <option>紧急</option>
            <option>可后置</option>
          </select>
        </label>
        <label>
          问题说明
          <textarea class="jrc-feedback-content" placeholder="请写清楚在哪个页面、点了什么、希望怎么改。"></textarea>
        </label>
        <button class="jrc-feedback-submit" type="button">提交反馈</button>
        <p class="jrc-feedback-message">提交后可在这里查看状态，也可进入试用反馈整改系统复核。</p>
        <div class="jrc-feedback-history">
          <div class="jrc-feedback-history__head">
            <strong>我的反馈</strong>
            <a href="/jrcedu/portal/trial-feedback.html">查看全部</a>
          </div>
          <div class="jrc-feedback-history__stats"></div>
          <div class="jrc-feedback-history__list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(dock);

    const panel = dock.querySelector(".jrc-feedback-panel");
    const openButton = dock.querySelector(".jrc-feedback-button");
    const closeButton = dock.querySelector(".jrc-feedback-close");
    const submitButton = dock.querySelector(".jrc-feedback-submit");
    const message = dock.querySelector(".jrc-feedback-message");
    const content = dock.querySelector(".jrc-feedback-content");
    const type = dock.querySelector(".jrc-feedback-type");
    const severity = dock.querySelector(".jrc-feedback-severity");
    const historyStats = dock.querySelector(".jrc-feedback-history__stats");
    const historyList = dock.querySelector(".jrc-feedback-history__list");
    const helpPanel = dock.querySelector(".jrc-help-panel");
    const helpButton = dock.querySelector(".jrc-help-button");
    const helpCloseButton = dock.querySelector(".jrc-help-close");
    const helpQuestion = dock.querySelector(".jrc-help-question");
    const helpSubmit = dock.querySelector(".jrc-help-submit");
    const helpAnswer = dock.querySelector(".jrc-help-answer");

    function pageUsageContext() {
      const title = systemName();
      const headings = [...document.querySelectorAll("h1, h2, .nav-item h3, .quick-card strong")]
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .slice(0, 18);
      const actions = [...document.querySelectorAll(".trial-toolbar a, .top-actions a, .top-actions button, .section-actions button, .button")]
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .slice(0, 24);
      return [
        `当前页面：${title}`,
        `页面地址：${location.pathname}`,
        headings.length ? `页面栏目：${headings.join("、")}` : "",
        actions.length ? `可见按钮：${actions.join("、")}` : "",
        "请只回答当前工作台/当前页面怎么使用，不要闲聊。回答要短，直接告诉老师先看哪里、点哪里、核对哪里。"
      ].filter(Boolean).join("\n");
    }

    function setHelpAnswer(text, tone = "") {
      if (!helpAnswer) return;
      helpAnswer.classList.toggle("is-error", tone === "error");
      helpAnswer.classList.toggle("is-loading", tone === "loading");
      helpAnswer.textContent = text || "";
    }

    function localUsageAnswer(question) {
      const title = systemName();
      const text = String(question || "");
      if (/反馈|提问题|问题/.test(text)) {
        return "如果只是看不懂或觉得不好用，点下面的“反馈问题”，写清楚页面、你点了什么、希望怎么改。提交后可以在“我的反馈”里查看处理状态。";
      }
      if (/核对|数据不对|不对/.test(text)) {
        return `先在${title}里确认筛选条件、日期/老师/学生/负责人是否选对；再看页面里的明细或操作留痕。如果仍不一致，点“反馈问题”并写清楚学生、日期、页面和你认为不对的数据。`;
      }
      return `当前是${title}。先看页面顶部的主标题和快捷按钮，再按页面里的主导航进入对应板块；如果不确定下一步，输入具体问题后点“问 AI”。`;
    }

    async function askUsageHelp(question) {
      const text = String(question || "").trim();
      if (!text) {
        setHelpAnswer("请先输入你想问的使用问题。", "error");
        return;
      }
      if (!window.JRC_CLOUD?.aiAssistant) {
        setHelpAnswer(localUsageAnswer(text));
        return;
      }
      helpSubmit.disabled = true;
      setHelpAnswer("正在按当前页面说明生成回答...", "loading");
      try {
        const employee = currentEmployee() || {};
        const response = await window.JRC_CLOUD.aiAssistant({
          mode: "help",
          target: systemName(),
          text: `${pageUsageContext()}\n\n老师问题：${text}`,
          operatorName: employee.name || "",
          operatorUsername: employee.username || "",
          operatorRole: employee.role || ""
        });
        if (!response?.ok || response.data?.warning || response.data?.provider === "local") {
          throw new Error(response?.data?.message || response?.message || "AI 暂时不可用");
        }
        const result = response.data?.result || {};
        const answer = String(result.parentMessage || result.polishedText || result.summary || "").trim();
        setHelpAnswer(answer || localUsageAnswer(text));
      } catch {
        setHelpAnswer(`AI 暂时不可用，先给你本地使用建议：\n${localUsageAnswer(text)}`);
      } finally {
        helpSubmit.disabled = false;
      }
    }

    function renderMyFeedbackHistory() {
      if (!historyList) return;
      const allMine = readFeedbackRows()
        .filter(rowBelongsToCurrentUser)
        .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
      const mine = allMine.slice(0, 5);
      if (historyStats) {
        const stats = feedbackStats(allMine);
        historyStats.innerHTML = `
          <span>共提 ${stats.total} 条</span>
          <span>已处理 ${stats.processed} 条</span>
          <span>待处理 ${stats.pending} 条</span>
          ${stats.reopened ? `<span>继续反馈 ${stats.reopened} 条</span>` : ""}
        `;
      }
      historyList.innerHTML = mine.length ? mine.map((row) => {
        const status = row.status || "待处理";
        const createdAt = String(row.createdAt || "").replace("T", " ").slice(0, 16);
        const contentText = String(row.content || "").slice(0, 44);
        const notes = Array.isArray(row.reviewNotes) ? row.reviewNotes : [];
        const latestNote = notes[notes.length - 1];
        const progressText = row.resolution || latestNote?.text || "";
        return `
          <div class="jrc-feedback-history__item">
            <span class="jrc-feedback-history__status ${statusTone(status)}">${status}</span>
            <strong>${row.type || "试用反馈"}｜${row.system || "未知页面"}</strong>
            <p>${contentText}${String(row.content || "").length > 44 ? "..." : ""}</p>
            ${progressText ? `<p><b>进展：</b>${String(progressText).slice(0, 54)}${String(progressText).length > 54 ? "..." : ""}</p>` : ""}
            <small>${createdAt || "刚刚"}</small>
          </div>
        `;
      }).join("") : `<p class="jrc-feedback-history__empty">你还没有提交过反馈。</p>`;
    }

    async function hydrateFeedbackHistory() {
      if (!window.JRC_CLOUD?.readModuleData) {
        renderMyFeedbackHistory();
        return;
      }
      try {
        const remote = await window.JRC_CLOUD.readModuleData(feedbackStoreKey);
        const remoteRows = Array.isArray(remote?.data?.payload) ? remote.data.payload : [];
        if (remoteRows.length) writeFeedbackRows(mergeFeedbackRows(readFeedbackRows(), remoteRows));
      } catch {
        // The local list is still useful if cloud history is temporarily unavailable.
      }
      renderMyFeedbackHistory();
    }

    openButton.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden && helpPanel) helpPanel.hidden = true;
      if (!panel.hidden) {
        hydrateFeedbackHistory();
        content.focus();
      }
    });
    closeButton.addEventListener("click", () => {
      panel.hidden = true;
    });
    submitButton.addEventListener("click", async () => {
      const text = content.value.trim();
      if (!text) {
        message.textContent = "请先写一下问题说明。";
        return;
      }
      const employee = currentEmployee();
      submitButton.disabled = true;
      message.textContent = "正在提交...";
      const row = {
        id: `FB-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        system: systemName(),
        type: type.value,
        severity: severity?.value || "普通",
        content: text,
        url: location.href,
        userName: employee?.name || "未登录",
        username: employee?.username || "",
        role: employee?.role || "",
        userAgent: navigator.userAgent,
        status: "待处理",
        createdAt: new Date().toISOString()
      };
      const result = await saveFeedback(row);
      content.value = "";
      submitButton.disabled = false;
      renderMyFeedbackHistory();
      message.textContent = result.ok ? "已提交到云端，可在“我的反馈”查看处理状态。" : "已暂存在当前设备，云端连接恢复后可再同步。";
      window.setTimeout(() => {
        panel.hidden = true;
        message.textContent = "提交后可在这里查看状态，也可进入试用反馈整改系统复核。";
      }, 1400);
    });

    helpButton?.addEventListener("click", () => {
      helpPanel.hidden = !helpPanel.hidden;
      if (!helpPanel.hidden && panel) panel.hidden = true;
      if (!helpPanel.hidden) helpQuestion?.focus();
    });
    helpCloseButton?.addEventListener("click", () => {
      helpPanel.hidden = true;
    });
    helpSubmit?.addEventListener("click", () => {
      askUsageHelp(helpQuestion?.value || "");
    });
    helpQuestion?.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        askUsageHelp(helpQuestion.value);
      }
    });
    dock.querySelectorAll("[data-jrc-help-question]").forEach((button) => {
      button.addEventListener("click", () => {
        const question = button.getAttribute("data-jrc-help-question") || "";
        if (helpQuestion) helpQuestion.value = question;
        askUsageHelp(question);
      });
    });

    renderMyFeedbackHistory();
  }

  function init() {
    ensurePwaHead();
    enhanceTables();
    enhanceActionGroups();
    ensureFloatingHome();
    const runDeferredEnhancements = () => {
      ensureSectionDock();
      ensureFeedbackDock();
      enhanceFormFocus();
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runDeferredEnhancements, { timeout: 1200 });
    } else {
      window.setTimeout(runDeferredEnhancements, 320);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
