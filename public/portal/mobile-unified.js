(function () {
  function enhanceTables() {
    document.querySelectorAll(".table-wrap").forEach((wrap) => {
      wrap.setAttribute("data-scroll-hint", "true");
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

  function init() {
    enhanceTables();
    enhanceActionGroups();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
