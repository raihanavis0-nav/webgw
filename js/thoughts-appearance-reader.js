(function () {
  "use strict";
  var RAW = "https://raw.githubusercontent.com/raihanavis0-nav/webgw/thoughts-data/";
  function $(id) { return document.getElementById(id); }
  function safeImage(path) {
    return /^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(gif|png|jpg|jpeg|webp)$/i.test(String(path || "")) && !String(path).includes("..")
      ? RAW + String(path).split("/").map(encodeURIComponent).join("/") : "";
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
    applyFrame("readerHero", a.hero, "3:1");
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