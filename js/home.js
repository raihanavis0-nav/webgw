/* Homepage-only page transition. */
(function () {
  "use strict";

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  function init() {
    const curtain = document.getElementById("pageCurtain");
    if (!curtain || reducedMotion) return;

    document.addEventListener("click", function (event) {
      const link = event.target.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (
        !href ||
        link.target === "_blank" ||
        href.charAt(0) === "#" ||
        href.indexOf("mailto:") === 0 ||
        href.indexOf("tel:") === 0 ||
        /^https?:/i.test(href) ||
        link.hasAttribute("download")
      ) {
        return;
      }

      event.preventDefault();
      curtain.classList.add("cover");

      window.setTimeout(function () {
        window.location.href = href;
      }, 320);
    });

    window.addEventListener("pageshow", function () {
      curtain.classList.remove("cover");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
