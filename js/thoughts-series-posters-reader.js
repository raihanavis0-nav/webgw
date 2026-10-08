(function () {
  "use strict";
  var stops = [];
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function isPoster(value) {
    return value && typeof value.path === "string" && /^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(?:png|jpg|jpeg|webp)$/i.test(value.path) && !value.path.includes("..");
  }
  function ratio(value) {
    var match = String(value || "2:3").match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (!match) return "2 / 3";
    var w = Number(match[1]), h = Number(match[2]);
    return w > 0 && h > 0 && w / h >= .2 && w / h <= 5 ? w + " / " + h : "2 / 3";
  }
  function frameImage(node, poster) {
    node.style.objectPosition = (poster.x == null ? 50 : clamp(Number(poster.x),0,100)) + "% " +
      (poster.y == null ? 50 : clamp(Number(poster.y),0,100)) + "%";
    node.style.transformOrigin = node.style.objectPosition;
    node.style.transform = "scale(" + (poster.zoom == null ? 100 : clamp(Number(poster.zoom),100,250)) / 100 + ")";
  }
  function posterCard(series, count, onOpen, mediaUrl) {
    var posters = Array.isArray(series.posters) ? series.posters.filter(isPoster) : [];
    if (!posters.length && (series.cover || series.banner)) posters = [{ path: series.cover || series.banner, x: 50, y: 50, zoom: 100 }];
    var entry = document.createElement("article");
    entry.className = "reader-series-card";
    entry.style.setProperty("--poster-ratio", ratio(series.posterRatio));
    var open = document.createElement("button");
    open.type = "button";
    open.className = "reader-series-open";
    open.setAttribute("aria-label", "Open series " + (series.name || "Untitled"));

    var frame = document.createElement("span");
    frame.className = "reader-series-frame";
    var front = document.createElement("img"), back = document.createElement("img");
    var placeholder = document.createElement("span");
    placeholder.className = "reader-series-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = String(series.name || "A").trim().charAt(0).toUpperCase();
    front.className = "reader-series-image reader-series-front";
    back.className = "reader-series-image reader-series-next";
    front.alt = "";
    back.alt = "";
    back.setAttribute("aria-hidden", "true");
    front.loading = "lazy";
    front.decoding = "async";
    back.decoding = "async";
    frame.appendChild(placeholder);
    if (posters.length) {
      front.src = mediaUrl(posters[0].path);
      frameImage(front, posters[0]);
      frame.appendChild(front);
      frame.appendChild(back);
      placeholder.hidden = true;
      front.addEventListener("error", function () {
        if (index === 0) placeholder.hidden = false;
      });
    }

    var copy = document.createElement("span");
    copy.className = "reader-series-copy";
    var title = document.createElement("strong");
    title.textContent = series.name || "Untitled";
    var detail = document.createElement("span");
    detail.textContent = count + (count === 1 ? " chapter" : " chapters");
    copy.appendChild(title);
    copy.appendChild(detail);
    open.appendChild(frame);
    open.appendChild(copy);
    open.addEventListener("click", onOpen);
    entry.appendChild(open);

    var index = 0, interval = null, busy = false, active = false, cooldown = null;
    function updateCount() { if (counter) counter.textContent = String(index + 1).padStart(2, "0") + " / " + String(posters.length).padStart(2, "0"); }
    function stop() {
      active = false;
      entry.classList.remove("is-active");
      if (interval) clearInterval(interval);
      interval = null;
    }
    stops.push(stop);
    function next() {
      if (posters.length < 2 || busy || !entry.isConnected || document.hidden) return;
      busy = true;
      var nextIndex = (index + 1) % posters.length;
      var target = posters[nextIndex];
      var image = new Image();
      image.onload = function () {
        if (!entry.isConnected) { busy = false; return; }
        back.src = image.src;
        frameImage(back, target);
        // Two image layers prevent blank frames during the crossfade.
        back.classList.add("is-visible");
        var ms = reduceMotion ? 0 : 420;
        if (ms === 0) back.style.transition = "none";
        cooldown = setTimeout(function () {
          front.src = image.src;
          frameImage(front, target);
          back.classList.remove("is-visible");
          index = nextIndex;
          updateCount();
          busy = false;
          back.style.removeProperty("transition");
        }, ms);
      };
      image.onerror = function () { busy = false; };
      image.src = mediaUrl(target.path);
    }
    function start() {
      if (active || posters.length < 2 || reduceMotion || document.hidden) return;
      if (window.matchMedia && !window.matchMedia("(hover: hover)").matches) return;
      active = true;
      entry.classList.add("is-active");
      interval = setInterval(next, 5000);
    }
    entry.addEventListener("pointerenter", start);
    entry.addEventListener("pointerleave", stop);
    entry.addEventListener("focusin", start);
    entry.addEventListener("focusout", function (event) {
      if (!event.relatedTarget || !entry.contains(event.relatedTarget)) stop();
    });

    var counter = null;
    if (posters.length > 1) {
      var controls = document.createElement("div");
      controls.className = "reader-series-poster-controls";
      counter = document.createElement("span");
      counter.className = "reader-series-poster-counter";
      controls.appendChild(counter);
      var change = document.createElement("button");
      change.className = "reader-series-next-button";
      change.type = "button";
      change.textContent = "›";
      change.setAttribute("aria-label", "Show next poster for " + (series.name || "Series"));
      change.title = "Next poster";
      change.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        next();
      });
      controls.appendChild(change);
      entry.appendChild(controls);
      updateCount();
    }
    return entry;
  }
  function stopAll() {
    stops.forEach(function (fn) { fn(); });
    stops.length = 0;
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stopAll(); });
  window.ArchiveSeriesPostersReader = { create: posterCard, stopAll: stopAll };
})();