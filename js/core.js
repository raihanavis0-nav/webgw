/* Shared runtime for the public portfolio pages. */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const el = (tag, cls, html) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  };

  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function setText(sel, text) {
    const node = $(sel);
    if (node && text !== undefined) node.textContent = text;
  }

  function makeInitials(name) {
    return (name || "?")
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function renderProfile() {
    const profile = siteData.profile;
    if (!profile) return;

    setText("#aboutText", profile.about);
    setText("#homeMeta", profile.location);

    const brand = $("#brandLogo");
    if (brand && brand.dataset.staticBrand !== "true") {
      if (profile.logo) {
        brand.classList.add("brand-img");
        brand.innerHTML =
          '<img src="' +
          escapeHtml(profile.logo) +
          '" alt="' +
          escapeHtml(profile.name) +
          '" />';

        const image = brand.querySelector("img");
        if (image) {
          image.addEventListener("error", () => {
            brand.classList.remove("brand-img");
            brand.innerHTML =
              escapeHtml(profile.name) + "<span>✦</span>";
          });
        }
      } else {
        brand.innerHTML =
          escapeHtml(profile.name) + "<span>✦</span>";
      }
    }

    const footer = $("#footerName");
    if (footer) {
      footer.innerHTML =
        '© <span id="year"></span> ' + escapeHtml(profile.name);
    }

    const avatar = $("#avatarBox");
    if (avatar) {
      if (profile.avatar) {
        avatar.style.backgroundImage =
          'url("' + String(profile.avatar).replace(/"/g, "%22") + '")';
        avatar.textContent = "";
      } else {
        avatar.textContent = makeInitials(profile.name);
      }
    }

    const email = $("#emailBtn");
    if (email && profile.email) {
      email.href = "mailto:" + profile.email;
      email.textContent = profile.email;
    }

    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  const ICONS = {
    instagram:
      '<rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/>',
    behance:
      '<path fill="currentColor" d="M1.6 5.2h6.2c2.4 0 4 1.1 4 3.1 0 1.3-.7 2.2-1.8 2.7 1.5.4 2.4 1.5 2.4 3.1 0 2.4-1.9 3.7-4.4 3.7H1.6V5.2zm5.7 4.8c1 0 1.6-.5 1.6-1.3S8.3 7.4 7.3 7.4H4.3V10h3zm.4 5.1c1.1 0 1.8-.5 1.8-1.4s-.7-1.4-1.8-1.4h-3.4v2.8h3.4z"/>' +
      '<rect x="15.4" y="5.4" width="7.1" height="1.9" fill="currentColor"/>' +
      '<path fill="currentColor" d="M19 8.6c-2.6 0-4.3 1.9-4.3 4.5s1.7 4.5 4.4 4.5c2 0 3.5-1.1 3.9-2.9h-2.3c-.2.6-.8 1-1.6 1-1.1 0-1.8-.7-1.9-1.9h5.9c0-.2.1-.4.1-.7 0-2.6-1.7-4.5-4.2-4.5zm-1.8 3.7c.2-1.1.9-1.7 1.8-1.7s1.6.6 1.7 1.7h-3.5z"/>',
    foriio:
      '<path fill="currentColor" d="M12.9 4.5c-.6-.3-1.3-.5-2.1-.5-2.4 0-4 1.6-4 4.1v1.2H5.1v2.9h1.7v7.3h3.1v-7.3h2.5V9.3h-2.5V8.2c0-.8.4-1.2 1-1.2.3 0 .6.1.9.3l1.1-2.8z"/>' +
      '<circle cx="16.9" cy="9.9" r="1.7" fill="currentColor"/>' +
      '<circle cx="21.4" cy="9.9" r="1.7" fill="currentColor"/>',
    medium:
      '<circle cx="6.3" cy="12" r="5.4" fill="currentColor"/>' +
      '<ellipse cx="15.8" cy="12" rx="2.7" ry="5.1" fill="currentColor"/>' +
      '<ellipse cx="21.3" cy="12" rx="1.3" ry="4.5" fill="currentColor"/>',
    letterboxd:
      '<circle cx="5.5" cy="12" r="3.5" fill="currentColor"/>' +
      '<circle cx="12" cy="12" r="3.5" fill="currentColor"/>' +
      '<circle cx="18.5" cy="12" r="3.5" fill="currentColor"/>',
  };

  function iconMarkup(social) {
    if (social.icon && ICONS[social.icon]) {
      return (
        '<svg class="social-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        ICONS[social.icon] +
        "</svg>"
      );
    }

    if (social.icon) {
      return (
        '<img class="social-ico social-ico-img" src="' +
        escapeHtml(social.icon) +
        '" alt="" aria-hidden="true" />'
      );
    }

    return escapeHtml(social.short || social.name.slice(0, 2));
  }

  function renderSocials() {
    const socials = Array.isArray(siteData.socials) ? siteData.socials : [];

    const list = $("#socialList");
    if (list) {
      socials.forEach((social) => {
        const link = el("a", "social-link");
        link.href = social.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute("data-cursor", "");
        link.innerHTML = "<span>" + escapeHtml(social.name) + "</span>";
        list.appendChild(link);
      });
    }

    const dock = $("#homeDock");
    if (dock) {
      socials.forEach((social) => {
        const link = el("a");
        link.href = social.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute("data-cursor", "");
        link.setAttribute("aria-label", social.name);
        link.setAttribute("title", social.name);
        link.innerHTML = iconMarkup(social);
        dock.appendChild(link);
      });
    }
  }

  function initNav() {
    const navbar = $("#navbar");
    if (!navbar) return;

    const menuBtn = $("#menuBtn");
    const navLinks = $("#navLinks");
    const progress = $("#scrollProgress");

    let current = location.pathname.split("/").pop();
    if (!current) current = "index.html";

    $$(".nav-link").forEach((link) => {
      if (link.getAttribute("href") === current) {
        link.classList.add("active");
      }
    });

    function onScroll() {
      const y = window.scrollY;
      navbar.classList.toggle("scrolled", y > 30);
      const height = document.body.scrollHeight - window.innerHeight;
      if (progress) {
        progress.style.width =
          (height > 0 ? (y / height) * 100 : 0) + "%";
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (menuBtn && navLinks) {
      const closeMenu = () => {
        navLinks.classList.remove("open");
        menuBtn.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      };

      menuBtn.addEventListener("click", () => {
        const open = navLinks.classList.toggle("open");
        menuBtn.classList.toggle("open", open);
        menuBtn.setAttribute("aria-expanded", String(open));
      });

      $$(".nav-link").forEach((link) => {
        link.addEventListener("click", closeMenu);
      });
    }
  }

  function initTheme() {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.removeItem("theme");
  }

  let revealObserver = null;

  function animateCount(node) {
    const target = parseFloat(node.dataset.target) || 0;
    const duration = 1400;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = Math.round(target * eased);

      if (progress < 1) requestAnimationFrame(step);
      else node.textContent = target;
    }

    requestAnimationFrame(step);
  }

  function observeReveals() {
    if (!("IntersectionObserver" in window)) {
      $$(".reveal").forEach((node) => node.classList.add("visible"));
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("visible");
            entry.target
              .querySelectorAll("[data-target]")
              .forEach(animateCount);
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.12 }
      );
    }

    $$(".reveal:not(.visible)").forEach((node) => {
      revealObserver.observe(node);
    });
  }

  window.SiteCore = {
    $,
    $$,
    el,
    escapeHtml,
    setText,
    observeReveals,
  };

  function init() {
    if (typeof siteData === "undefined") {
      console.error("data.js not loaded — siteData was not found.");
      return;
    }

    renderProfile();
    renderSocials();
    initNav();
    initTheme();
    observeReveals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
