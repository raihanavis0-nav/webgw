/* =============================================================
   MENU.JS — fullscreen nav overlay for the homepage.
   Builds the navigation links and wires open/close to the existing
   #menuBtn.
   ============================================================= */
(function () {
  "use strict";

  var LINKS = [
    { label: "Home", href: "index.html" },
    { label: "About", href: "about.html" },
    { label: "Work", href: "work.html" },
    { label: "Contact", href: "contact.html" },
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function init() {
    var menu = document.getElementById("megaMenu");
    var btn = document.getElementById("menuBtn");
    if (!menu || !btn) return;

    var nav = menu.querySelector(".mega-nav");
    var current = location.pathname.split("/").pop() || "index.html";

    LINKS.forEach(function (link, i) {
      var a = document.createElement("a");
      a.className = "mega-link" + (link.href === current ? " is-active" : "");
      a.href = link.href;
      a.style.setProperty("--i", i);
      a.setAttribute("data-cursor", "");
      a.innerHTML =
        '<span class="mega-idx">' +
        String(i + 1).padStart(2, "0") +
        "</span>" +
        '<span class="mega-word">' +
        esc(link.label) +
        "</span>";
      nav.appendChild(a);
    });

    function open() {
      menu.classList.add("open");
      menu.setAttribute("aria-hidden", "false");
      btn.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", "Close menu");
      document.body.style.overflow = "hidden";
    }
    function close() {
      menu.classList.remove("open");
      menu.setAttribute("aria-hidden", "true");
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Open menu");
      document.body.style.overflow = "";
    }

    // Override the shared mobile-nav behaviour from core.js on home.
    btn.addEventListener(
      "click",
      function (e) {
        e.stopImmediatePropagation();
        if (menu.classList.contains("open")) close();
        else open();
      },
      true
    );

    var closeBtn = menu.querySelector(".mega-close");
    if (closeBtn) closeBtn.addEventListener("click", close);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
