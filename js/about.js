/* About-page content renderer. */
(function () {
  "use strict";

  function init() {
    if (typeof siteData === "undefined" || !window.SiteCore) return;

    const { $, el, escapeHtml, observeReveals } = window.SiteCore;

    const skills = $("#skillsList");
    if (skills && Array.isArray(siteData.skills)) {
      siteData.skills.forEach((skill) => {
        skills.appendChild(
          el("span", "skill-chip", escapeHtml(skill))
        );
      });
    }

    const stats = $("#statsList");
    if (stats && Array.isArray(siteData.stats)) {
      siteData.stats.forEach((stat) => {
        const item = el("li", "stat");
        item.innerHTML =
          '<div class="stat-value" data-target="' +
          Number(stat.value || 0) +
          '">0</div>' +
          '<div class="stat-label">' +
          escapeHtml(stat.label) +
          "</div>";
        stats.appendChild(item);
      });
    }

    observeReveals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
