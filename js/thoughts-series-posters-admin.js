(function () {
  "use strict";

  var posters = [];
  var selected = -1;
  var uploading = false;
  var options = null;
  var dragStart = null;
  function $(id) { return document.getElementById(id); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function status(text, error) {
    var node = $("seriesPosterStatus");
    node.textContent = text || "";
    node.classList.toggle("is-error", Boolean(error));
  }
  function normalizedPoster(p) {
    return {
      path: String(p.path || ""),
      x: clamp(Number.isFinite(Number(p.x)) ? Number(p.x) : 50, 0, 100),
      y: clamp(Number.isFinite(Number(p.y)) ? Number(p.y) : 50, 0, 100),
      zoom: clamp(Number.isFinite(Number(p.zoom)) ? Number(p.zoom) : 100, 100, 250)
    };
  }
  function current() { return selected >= 0 ? posters[selected] : null; }
  function ratio() {
    var w = Number($("seriesPosterWidth").value);
    var h = Number($("seriesPosterHeight").value);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w > 10 || h > 10 || w / h < .2 || w / h > 5) return "";
    return w + ":" + h;
  }
  function updateFrame() {
    var frame = $("seriesPosterFrame");
    var img = $("seriesPosterImage");
    var label = $("seriesPosterPlaceholder");
    var obj = current();
    var parts = ratio().split(":").map(Number);
    frame.style.aspectRatio = parts.length === 2 && parts[0] > 0 && parts[1] > 0 ? parts[0] + "/" + parts[1] : "2/3";
    if (!obj) {
      img.hidden = true;
      img.removeAttribute("src");
      label.hidden = false;
      $("seriesPosterControls").hidden = true;
      $("seriesPosterCropValues").textContent = "";
      return;
    }
    var src = options.mediaUrl(obj.path);
    if (img.getAttribute("src") !== src) img.src = src;
    img.hidden = false;
    label.hidden = true;
    $("seriesPosterControls").hidden = false;
    img.style.objectPosition = obj.x + "% " + obj.y + "%";
    img.style.transformOrigin = obj.x + "% " + obj.y + "%";
    img.style.transform = "scale(" + obj.zoom / 100 + ")";
    $("seriesPosterX").value = obj.x;
    $("seriesPosterY").value = obj.y;
    $("seriesPosterZoom").value = obj.zoom;
    $("seriesPosterCropValues").textContent = "X " + obj.x + "% · Y " + obj.y + "% · Zoom " + obj.zoom + "%";
  }
  function makeAction(label, description, callback, disabled) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = description;
    button.setAttribute("aria-label", description);
    button.disabled = Boolean(disabled) || uploading;
    button.addEventListener("click", function (event) {
      event.stopPropagation();
      callback();
    });
    return button;
  }
  function render() {
    var host = $("seriesPosterList");
    host.textContent = "";
    if (!posters.length) {
      var empty = document.createElement("p");
      empty.className = "series-posters-empty";
      empty.textContent = "No posters yet. The existing Series cover can be used until you add posters.";
      host.appendChild(empty);
    }
    posters.forEach(function (poster, index) {
      var row = document.createElement("div");
      row.className = "series-poster-row";
      row.classList.toggle("is-selected", index === selected);

      var choose = document.createElement("button");
      choose.type = "button";
      choose.className = "series-poster-choose";
      choose.setAttribute("aria-label", "Preview poster " + (index + 1));
      choose.setAttribute("aria-pressed", index === selected ? "true" : "false");
      var image = document.createElement("img");
      image.src = options.mediaUrl(poster.path);
      image.alt = "";
      image.loading = "lazy";
      choose.appendChild(image);
      var text = document.createElement("span");
      text.textContent = "Poster " + String(index + 1).padStart(2, "0") + (index === 0 ? " · Default" : "");
      choose.appendChild(text);
      choose.addEventListener("click", function () { selected = index; render(); });
      row.appendChild(choose);

      var actions = document.createElement("div");
      actions.className = "series-poster-row-actions";
      actions.appendChild(makeAction("↑", "Move poster up", function () { move(index, -1); }, index === 0));
      actions.appendChild(makeAction("↓", "Move poster down", function () { move(index, 1); }, index === posters.length - 1));
      if (index !== 0) actions.appendChild(makeAction("★", "Set as default poster", function () {
        var entry = posters.splice(index, 1)[0];
        posters.unshift(entry);
        selected = 0;
        render();
      }));
      actions.appendChild(makeAction("×", "Remove poster", function () {
        posters.splice(index, 1);
        selected = posters.length ? Math.min(index, posters.length - 1) : -1;
        render();
      }));
      row.appendChild(actions);
      host.appendChild(row);
    });
    updateFrame();
  }
  function move(from, change) {
    var to = from + change;
    if (to < 0 || to >= posters.length) return;
    var entry = posters.splice(from, 1)[0];
    posters.splice(to, 0, entry);
    selected = to;
    render();
  }
  function open(series) {
    var value = series || {};
    posters = Array.isArray(value.posters) ? value.posters.filter(function (p) { return p && p.path; }).map(normalizedPoster) : [];
    var parts = String(value.posterRatio || "2:3").split(":");
    $("seriesPosterWidth").value = Number(parts[0]) || 2;
    $("seriesPosterHeight").value = Number(parts[1]) || 3;
    $("seriesPosterFiles").value = "";
    selected = posters.length ? 0 : -1;
    uploading = false;
    status("");
    render();
  }
  function upload(files) {
    var candidates = Array.from(files || []).filter(function (file) {
      return /^image\/(png|jpeg|webp)$/i.test(file.type);
    });
    if (!candidates.length) { status("Select PNG, JPEG or WebP images.", true); return; }
    if (posters.length + candidates.length > 20) {
      status("Maximum 20 posters per Series.", true);
      return;
    }
    if (uploading) return;
    uploading = true;
    $("saveEntityBtn").disabled = true;
    render();
    // Sequential GitHub commits avoid conflicts on the archive data branch.
    var queue = Promise.resolve();
    candidates.forEach(function (file, index) {
      queue = queue.then(function () {
        status("Uploading poster " + (index + 1) + " of " + candidates.length + "…");
        return options.uploadFile(file).then(function (result) {
          posters.push(normalizedPoster({ path: result.path }));
          if (selected < 0) selected = 0;
          render();
        });
      });
    });
    queue.then(function () {
      status(candidates.length + (candidates.length === 1 ? " poster" : " posters") + " uploaded. Save Series to publish.");
    }).catch(function (error) {
      status("Upload stopped: " + (error.message || "Please retry remaining files."), true);
    }).finally(function () {
      uploading = false;
      $("saveEntityBtn").disabled = false;
      render();
    });
  }
  function init(config) {
    options = config;
    $("seriesPosterFiles").addEventListener("change", function () {
      upload(this.files);
      this.value = "";
    });
    ["seriesPosterWidth", "seriesPosterHeight"].forEach(function (id) {
      $(id).addEventListener("input", function () {
        if (!ratio()) status("Ratio must be between 1:5 and 5:1.", true);
        else status("");
        updateFrame();
      });
    });
    ["X", "Y", "Zoom"].forEach(function (key) {
      $("seriesPoster" + key).addEventListener("input", function () {
        var poster = current();
        if (!poster) return;
        poster[key.toLowerCase()] = Number(this.value);
        updateFrame();
      });
    });
    var frame = $("seriesPosterFrame");
    frame.addEventListener("pointerdown", function (event) {
      if (!current()) return;
      dragStart = { x: event.clientX, y: event.clientY, px: current().x, py: current().y };
      frame.setPointerCapture(event.pointerId);
      frame.classList.add("is-dragging");
    });
    frame.addEventListener("pointermove", function (event) {
      if (!dragStart || !current()) return;
      current().x = Math.round(clamp(dragStart.px - (event.clientX - dragStart.x) / frame.clientWidth * 100, 0, 100));
      current().y = Math.round(clamp(dragStart.py - (event.clientY - dragStart.y) / frame.clientHeight * 100, 0, 100));
      updateFrame();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (name) {
      frame.addEventListener(name, function () { dragStart = null; frame.classList.remove("is-dragging"); });
    });
  }
  function getValue() {
    if (uploading) throw new Error("Poster upload is still in progress.");
    var value = ratio();
    if (!value) throw new Error("Choose a valid poster ratio between 1:5 and 5:1.");
    return { posterRatio: value, posters: posters.map(normalizedPoster) };
  }
  window.ArchiveSeriesPosters = { init: init, open: open, getValue: getValue };
})();