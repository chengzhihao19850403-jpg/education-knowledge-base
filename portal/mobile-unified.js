(function () {
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

  function init() {
    enhanceTables();
    enhanceActionGroups();
    ensureFloatingHome();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
