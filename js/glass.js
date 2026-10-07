/* =============================================================
   GLASS.JS — "liquid glass" refraction for the dock + lightbox nav.
   -------------------------------------------------------------
   Builds an SVG displacement map sized to each target, then feeds it
   through three feDisplacementMap passes at slightly different scales
   (one per colour channel) to get the chromatic fringing that makes it
   read as glass rather than plain blur.

   backdrop-filter: url(#svg-filter) is Chromium-only, so this bails out
   everywhere else and the CSS blur() already on those elements stays as
   the fallback. Nothing here changes layout.
   ============================================================= */
(function () {
  "use strict";

  // Safari/Firefox parse blur() but not an SVG filter reference.
  var SUPPORTED =
    window.CSS &&
    CSS.supports &&
    (CSS.supports("backdrop-filter", "url(#g)") ||
      CSS.supports("-webkit-backdrop-filter", "url(#g)"));
  if (!SUPPORTED) return;

  var NS = "http://www.w3.org/2000/svg";
  var uid = 0;
  var defs = null;

  // Targets: `depth` scales the refraction relative to the element's
  // short edge, so a 44px button and a 280px dock bend proportionally.
  var TARGETS = [
    { sel: ".home-dock", depth: 1.5, saturate: 1.4, brightness: 1.05 },
    // .lb-close shares the lightbox button styling, so it has to match
    // or it reads as flat next to the glassy arrows.
    { sel: ".lb-nav, .lb-close", depth: 1.1, saturate: 1.2, brightness: 1.05 },
  ];

  function ensureDefs() {
    if (defs) return defs;
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.cssText =
      "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    defs = document.createElementNS(NS, "defs");
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  // Red channel drives X displacement, blue drives Y. The blurred grey
  // rect in the middle is "no displacement", so only the rim refracts.
  function displacementMap(w, h, r) {
    var inset = Math.max(1, Math.min(w, h) * 0.04);
    var blur = Math.max(2, Math.min(w, h) * 0.14);
    var svg =
      '<svg viewBox="0 0 ' +
      w +
      " " +
      h +
      '" xmlns="' +
      NS +
      '">' +
      "<defs>" +
      '<linearGradient id="x" x1="100%" y1="0%" x2="0%" y2="0%">' +
      '<stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="red"/>' +
      "</linearGradient>" +
      '<linearGradient id="y" x1="0%" y1="0%" x2="0%" y2="100%">' +
      '<stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="blue"/>' +
      "</linearGradient>" +
      "</defs>" +
      '<rect width="' + w + '" height="' + h + '" fill="black"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + r + '" fill="url(#x)"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + r +
      '" fill="url(#y)" style="mix-blend-mode:difference"/>' +
      '<rect x="' + inset + '" y="' + inset +
      '" width="' + (w - inset * 2) + '" height="' + (h - inset * 2) +
      '" rx="' + r + '" fill="hsl(0 0% 50% / 0.93)" style="filter:blur(' +
      blur + 'px)"/>' +
      "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function channel(rgb) {
    // feColorMatrix that keeps a single channel plus alpha.
    var m = { r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0", g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0", b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" };
    return m[rgb] + "  0 0 0 1 0";
  }

  function buildFilter(id, href, scale) {
    var f = document.createElementNS(NS, "filter");
    f.setAttribute("id", id);
    f.setAttribute("color-interpolation-filters", "sRGB");

    var img = document.createElementNS(NS, "feImage");
    img.setAttribute("x", "0");
    img.setAttribute("y", "0");
    img.setAttribute("width", "100%");
    img.setAttribute("height", "100%");
    img.setAttribute("result", "map");
    img.setAttribute("href", href);
    f.appendChild(img);

    // Three passes, ~6% apart — that offset is the chromatic aberration.
    [
      ["r", scale],
      ["g", scale * 0.944],
      ["b", scale * 0.889],
    ].forEach(function (pair) {
      var key = pair[0];
      var disp = document.createElementNS(NS, "feDisplacementMap");
      disp.setAttribute("in", "SourceGraphic");
      disp.setAttribute("in2", "map");
      disp.setAttribute("xChannelSelector", "R");
      disp.setAttribute("yChannelSelector", "B");
      disp.setAttribute("scale", String(pair[1]));
      disp.setAttribute("result", "d" + key);
      f.appendChild(disp);

      var cm = document.createElementNS(NS, "feColorMatrix");
      cm.setAttribute("in", "d" + key);
      cm.setAttribute("type", "matrix");
      cm.setAttribute("values", channel(key));
      cm.setAttribute("result", key);
      f.appendChild(cm);
    });

    var b1 = document.createElementNS(NS, "feBlend");
    b1.setAttribute("in", "r");
    b1.setAttribute("in2", "g");
    b1.setAttribute("mode", "screen");
    b1.setAttribute("result", "rg");
    f.appendChild(b1);

    var b2 = document.createElementNS(NS, "feBlend");
    b2.setAttribute("in", "rg");
    b2.setAttribute("in2", "b");
    b2.setAttribute("mode", "screen");
    b2.setAttribute("result", "out");
    f.appendChild(b2);

    var soft = document.createElementNS(NS, "feGaussianBlur");
    soft.setAttribute("in", "out");
    soft.setAttribute("stdDeviation", "0.25");
    f.appendChild(soft);

    return f;
  }

  function apply(el, cfg) {
    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width);
    var h = Math.round(rect.height);
    if (!w || !h) return; // hidden (e.g. closed lightbox) — retry on resize

    var cs = getComputedStyle(el);
    var radius = parseFloat(cs.borderTopLeftRadius) || 0;
    // A 50% radius resolves to half the box; clamp so the map matches.
    radius = Math.min(radius, Math.min(w, h) / 2);

    var id = el.__glassId || (el.__glassId = "glass-" + ++uid);
    var old = document.getElementById(id);
    if (old) old.remove();

    var scale = -Math.min(w, h) * cfg.depth;
    ensureDefs().appendChild(
      buildFilter(id, displacementMap(w, h, radius), scale)
    );

    var chain =
      "url(#" + id + ") saturate(" + cfg.saturate + ") brightness(" +
      cfg.brightness + ")";
    el.style.backdropFilter = chain;
    el.style.webkitBackdropFilter = chain;
  }

  function init() {
    var watched = [];
    TARGETS.forEach(function (cfg) {
      Array.prototype.forEach.call(
        document.querySelectorAll(cfg.sel),
        function (el) {
          apply(el, cfg);
          watched.push({ el: el, cfg: cfg });
        }
      );
    });
    if (!watched.length) return;

    // Marks the page so CSS can thin out the frost that would otherwise
    // hide the refraction behind an almost-opaque panel.
    document.documentElement.classList.add("glass-on");

    var redraw = function () {
      watched.forEach(function (w) {
        apply(w.el, w.cfg);
      });
    };
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(redraw);
      watched.forEach(function (w) {
        ro.observe(w.el);
      });
    } else {
      window.addEventListener("resize", redraw);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
