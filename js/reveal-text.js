/* =============================================================
   REVEAL-TEXT.JS — rectangular per-line text reveal.
   -------------------------------------------------------------
   Splits [data-reveal-text] into visual lines (measured, not guessed),
   wraps each in its own masked row, then plays them in on scroll with
   a stagger. Re-splits on resize because line breaks move.

   Loads AFTER main.js so content that main.js injects (e.g. #aboutText
   from siteData) is already in place before it gets split.
   ============================================================= */
(function () {
  "use strict";

  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Group words into lines by their rendered offsetTop — the only
  // reliable way to know where the browser actually wrapped the text.
  function measureLines(el, text) {
    el.textContent = "";
    var words = text.split(" ");
    var probes = words.map(function (word, i) {
      var s = document.createElement("span");
      s.textContent = word;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
      return s;
    });

    var lines = [];
    var current = null;
    var lastTop = null;
    probes.forEach(function (s) {
      var top = s.offsetTop;
      if (lastTop === null || Math.abs(top - lastTop) > 1) {
        current = [];
        lines.push(current);
        lastTop = top;
      }
      current.push(s.textContent);
    });
    return lines;
  }

  function build(el) {
    var text = el.__rtText;
    if (!text) {
      text = el.textContent.replace(/\s+/g, " ").trim();
      if (!text) return false;
      el.__rtText = text;
    }

    el.classList.remove("rt-ready");
    var lines = measureLines(el, text);

    el.textContent = "";
    lines.forEach(function (words, i) {
      var line = document.createElement("span");
      line.className = "rt-line";
      line.style.setProperty("--i", i);

      var inner = document.createElement("span");
      inner.className = "rt-line-in";
      inner.textContent = words.join(" ");

      var mask = document.createElement("span");
      mask.className = "rt-mask";
      mask.setAttribute("aria-hidden", "true");

      line.appendChild(inner);
      line.appendChild(mask);
      el.appendChild(line);
      // Lines are block-level, so this space never renders — but without
      // it, copying the paragraph runs the last word of one line into the
      // first word of the next.
      if (i < lines.length - 1) el.appendChild(document.createTextNode(" "));
    });
    el.classList.add("rt-ready");
    return true;
  }

  // A split line should occupy exactly one line box. If any is taller,
  // the measurement was stale (font or layout shifted mid-build), so
  // rebuild once against the settled layout.
  function verify(el) {
    var lh = parseFloat(getComputedStyle(el).lineHeight) || 0;
    if (!lh) return;
    var wrapped = Array.prototype.some.call(
      el.querySelectorAll(".rt-line"),
      function (l) {
        return l.getBoundingClientRect().height > lh * 1.4;
      }
    );
    if (wrapped) build(el);
  }

  function play(el) {
    Array.prototype.forEach.call(el.querySelectorAll(".rt-line"), function (l) {
      l.classList.add("rt-in");
    });
  }

  function init() {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll("[data-reveal-text]")
    );
    if (!targets.length) return;

    var built = targets.filter(build);
    if (!built.length) return;
    built.forEach(verify);

    if (REDUCE) {
      built.forEach(play);
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          play(e.target);
          e.target.__rtPlayed = true;
          io.unobserve(e.target);
        });
      },
      // A low threshold matters for paragraphs taller than the viewport:
      // a high one could never be satisfied, leaving the text hidden.
      { threshold: 0.01, rootMargin: "0px 0px -8% 0px" }
    );
    built.forEach(function (el) {
      io.observe(el);
    });

    // Safety net: these lines start at opacity 0, so if the observer
    // never fires the copy would be invisible for good. Never let body
    // text depend solely on an animation hook.
    setTimeout(function () {
      built.forEach(function (el) {
        if (el.__rtPlayed) return;
        var box = el.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) {
          play(el);
          el.__rtPlayed = true;
          io.unobserve(el);
        }
      });
    }, 2500);

    // Line breaks change with width, so rebuild — but keep already
    // played text visible instead of replaying it mid-read.
    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        built.forEach(function (el) {
          var played = el.__rtPlayed;
          if (!build(el)) return;
          if (played) play(el);
          else io.observe(el);
        });
      }, 200);
    });
  }

  // Lines MUST be measured with the final webfont. Measuring against the
  // fallback produces lines sized for a narrower face, so each one wraps
  // again once Space Grotesk swaps in and words get orphaned.
  function start() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(init);
    } else {
      init();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
