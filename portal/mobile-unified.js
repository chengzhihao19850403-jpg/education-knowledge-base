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

  function writeFeedbackRows(rows) {
    localStorage.setItem(feedbackStoreKey, JSON.stringify(rows.slice(0, 300)));
  }

  function mergeFeedbackRows(...groups) {
    const map = new Map();
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = String(row.id || "").trim() || `FB-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      map.set(id, { ...row, id });
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
        <p class="jrc-feedback-message">提交后管理员会在后台统一整理。</p>
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

    openButton.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) content.focus();
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
      message.textContent = result.ok ? "已提交到云端，管理员会统一查看。" : "已暂存在当前设备，云端连接恢复后可再同步。";
      window.setTimeout(() => {
        panel.hidden = true;
        message.textContent = "提交后管理员会在后台统一整理。";
      }, 1400);
    });
  }

  function init() {
    enhanceTables();
    enhanceActionGroups();
    ensureFloatingHome();
    ensureSectionDock();
    ensureFeedbackDock();
    enhanceFormFocus();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
