/* Smooth dot shift appears only when an actual async request exceeds 180 ms. */
(function () {
  "use strict";
  var pending = 0;
  var timer = null;
  var indicator = null;
  var statusLabel = null;

  function ensure() {
    if (indicator) return indicator;
    indicator = document.createElement("div");
    indicator.id = "readerNetworkWait";
    indicator.className = "reader-network-wait";
    indicator.setAttribute("role", "status");
    indicator.setAttribute("aria-live", "polite");
    indicator.hidden = true;
    var content = document.createElement("span");
    content.className = "reader-dot-shift";
    content.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 3; i++) content.appendChild(document.createElement("i"));
    statusLabel = document.createElement("span");
    statusLabel.className = "reader-network-wait-label";
    statusLabel.textContent = "Loading…";
    indicator.appendChild(content);
    indicator.appendChild(statusLabel);
    document.body.appendChild(indicator);
    return indicator;
  }

  function show(label, subtle) {
    ensure();
    statusLabel.textContent = label || "Loading…";
    indicator.classList.toggle("is-subtle", !!subtle);
    indicator.hidden = false;
  }

  function hide() {
    if (timer != null) clearTimeout(timer);
    timer = null;
    if (indicator) indicator.hidden = true;
  }

  function track(task, label, subtle) {
    pending++;
    if (pending === 1) {
      timer = window.setTimeout(function () {
        if (pending > 0) show(label, subtle);
      }, 180);
    }
    return Promise.resolve(task).finally(function () {
      pending = Math.max(0, pending - 1);
      if (pending === 0) hide();
    });
  }

  window.ReaderMotionLoader = { track: track };
})();
