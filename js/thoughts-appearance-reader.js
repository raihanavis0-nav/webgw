(function () {
  "use strict";
  var RAW = "https://raw.githubusercontent.com/raihanavis0-nav/webgw/thoughts-data/";
  function $(id) { return document.getElementById(id); }
  function safeImage(path) {
    return /^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(gif|png|jpg|jpeg|webp)$/i.test(String(path || "")) && !String(path).includes("..")
      ? RAW + String(path).split("/").map(encodeURIComponent).join("/") : "";
  }
  // Interface settings: fonts + logo. Brand assets live on the main
  // branch, so they resolve as site-relative paths (not the data branch).
  var FONT_CHOICES = ["Inter", "Newsreader", "Space Grotesk", "Instrument Serif", "Archivo"];
  var DEFAULT_LOGO = "assets/img/logo-railnavis.png";
  function validFont(name) {
    return FONT_CHOICES.indexOf(String(name || "")) !== -1 ? String(name) : "Inter";
  }
  function safeLogo(path) {
    var p = String(path || "");
    if (p === "none") return "none";
    return /^assets\/(img|thoughts)\/[a-zA-Z0-9._\/-]+\.(png|jpg|jpeg|webp|gif|svg)$/i.test(p) && p.indexOf("..") === -1 ? p : "";
  }
  function applyInterface(appearance) {
    var iface = (appearance && appearance.interface) || {};
    var displayFont = validFont(iface.displayFont);
    var bodyFont = validFont(iface.bodyFont);
    if (window.SubseriesThemes && typeof window.SubseriesThemes.loadFont === "function") {
      window.SubseriesThemes.loadFont(displayFont);
      if (bodyFont !== displayFont) window.SubseriesThemes.loadFont(bodyFont);
    }
    var rootStyle = document.documentElement.style;
    rootStyle.setProperty("--reader-display", '"' + displayFont + '", system-ui, sans-serif');
    rootStyle.setProperty("--reader-body-font", '"' + bodyFont + '", system-ui, sans-serif');
    var gateLogo = $("readerGateLogo");
    if (gateLogo) {
      var logo = safeLogo(iface.logo);
      if (logo === "none") {
        gateLogo.hidden = true;
      } else {
        gateLogo.hidden = false;
        var src = logo || DEFAULT_LOGO;
        if (gateLogo.getAttribute("src") !== src) gateLogo.setAttribute("src", src);
      }
    }
  }
  function applyFrame(prefix, config, fallback) {
    var frame = $(prefix + "Media");
    var img = $(prefix + "Image");
    if (!frame || !img) return;
    var slot = config || {};
    var url = safeImage(slot.image);
    frame.hidden = !url;
    if (!url) { img.removeAttribute("src"); return; }
    var ratio = /^([1-9][0-9]*):([1-9][0-9]*)$/.exec(slot.ratio || fallback);
    frame.style.aspectRatio = ratio ? ratio[1] + " / " + ratio[2] : "3 / 1";
    var x = Math.max(0, Math.min(100, slot.x == null ? 50 : Number(slot.x)));
    var y = Math.max(0, Math.min(100, slot.y == null ? 50 : Number(slot.y)));
    var zoom = Math.max(100, Math.min(250, Number(slot.zoom) || 100));
    img.style.objectPosition = x + "% " + y + "%";
    img.style.transformOrigin = x + "% " + y + "%";
    img.style.transform = "scale(" + (zoom / 100) + ")";
    img.src = url;
  }
  function apply(appearance) {
    var a = appearance || {};
    if ($("readerArchiveTitle")) $("readerArchiveTitle").textContent = a.title || "Archive";
    if ($("readerArchiveSubtitle")) $("readerArchiveSubtitle").textContent = a.subtitle || "Choose a series and discover its world.";
    if ($("readerLoginTitle")) $("readerLoginTitle").textContent = a.title || "Archive";
    if (a.accent && /^#[a-fA-F0-9]{6}$/.test(a.accent)) document.documentElement.style.setProperty("--reader-accent", a.accent);
    applyFrame("readerLogin", a.login, "4:3");
    // The old Library hero banner is paused while posters take priority.
    var hero = $("readerHeroMedia"), heroImg = $("readerHeroImage");
    if (hero) hero.hidden = true;
    if (heroImg) heroImg.removeAttribute("src");
    applyInterface(a);
  }
  function load() {
    fetch("/api/thoughts/auth?appearance=1", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("Appearance unavailable"); return r.json(); })
      .then(function (r) { apply(r.appearance); })
      .catch(function () { /* Keep the archive usable with default appearance. */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();