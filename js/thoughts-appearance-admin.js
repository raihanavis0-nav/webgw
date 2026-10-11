(function () {
  "use strict";
  var defaults = {
    title: "Archive",
    subtitle: "Choose a series and discover its world.",
    accent: "#92785b",
    login: { image: "", ratio: "4:3", x: 50, y: 50, zoom: 100 },
    hero: { image: "", ratio: "3:1", x: 50, y: 50, zoom: 100 },
    interface: { displayFont: "Inter", bodyFont: "Inter", logo: "", layoutWidth: "standard", cardStyle: "soft" }
  };
  var FONT_CHOICES = ["Inter", "Newsreader", "Space Grotesk", "Instrument Serif", "Archivo"];
  function validFont(name) {
    return FONT_CHOICES.includes(String(name || "")) ? String(name) : "Inter";
  }
  var draft = JSON.parse(JSON.stringify(defaults));
  var previewUrls = {};
  var logoPreviewUrl = "";
  var pending = [];
  var saveFn = null;
  var dirty = false;
  function $(id) { return document.getElementById(id); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function slotName(name) { return "appearance" + name.charAt(0).toUpperCase() + name.slice(1); }
  function adminMedia(path) { return "/api/thoughts-admin/media?path=" + encodeURIComponent(path); }
  function merged(data) {
    var next = clone(defaults), a = data || {};
    ["title", "subtitle", "accent"].forEach(function (key) {
      if (typeof a[key] === "string") next[key] = a[key];
    });
    ["login", "hero"].forEach(function (key) {
      var source = a[key] || {};
      ["image", "ratio", "x", "y", "zoom"].forEach(function (field) {
        if (source[field] !== undefined) next[key][field] = source[field];
      });
    });
    var iface = a.interface || {};
    next.interface.displayFont = validFont(iface.displayFont);
    next.interface.bodyFont = validFont(iface.bodyFont);
    next.interface.logo = typeof iface.logo === "string" ? iface.logo : "";
    next.interface.layoutWidth = ["narrow", "standard", "wide"].includes(iface.layoutWidth) ? iface.layoutWidth : "standard";
    next.interface.cardStyle = ["square", "soft", "rounded"].includes(iface.cardStyle) ? iface.cardStyle : "soft";
    return next;
  }
  function showStatus(message, error) {
    var node = $("appearanceStatus");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(error));
  }
  function updateSlot(name) {
    var id = slotName(name), s = draft[name], frame = $(id + "Frame"), img = $(id + "Image");
    if (!frame || !img) return;
    var src = previewUrls[name] || (s.image ? adminMedia(s.image) : "");
    frame.classList.toggle("has-image", Boolean(src));
    frame.style.aspectRatio = String(s.ratio || "3:1").replace(":", " / ");
    var x = Number(s.x), y = Number(s.y), zoom = Number(s.zoom);
    img.style.objectPosition = x + "% " + y + "%";
    img.style.transformOrigin = x + "% " + y + "%";
    img.style.transform = "scale(" + (zoom / 100) + ")";
    if (src && img.getAttribute("src") !== src) img.src = src;
    else img.removeAttribute("src");
    $(id + "Empty").hidden = Boolean(src);
    $(id + "PositionText").textContent = "X " + x + "% · Y " + y + "% · Zoom " + zoom + "%";
  }
  function logoPreviewSrc(path) {
    if (logoPreviewUrl) return logoPreviewUrl;
    return path && path !== "none" ? adminMedia(path) : "";
  }
  function updateLogoPreview() {
    var img = $("appearanceLogoPreview");
    var empty = $("appearanceLogoEmpty");
    if (!img || !empty) return;
    var src = logoPreviewSrc(draft.interface.logo);
    if (src) {
      img.src = src;
      img.hidden = false;
      empty.textContent = draft.interface.logo === "" || !draft.interface.logo
        ? "Default Railnavis logo."
        : draft.interface.logo;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      empty.textContent = draft.interface.logo === "none"
        ? "Logo hidden."
        : "No logo uploaded — using the default Railnavis logo.";
    }
  }
  function uploadLogo(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/i.test(file.type)) {
      showStatus("Use PNG, JPEG, WebP, or SVG.", true);
      return;
    }
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = URL.createObjectURL(file);
    updateLogoPreview();
    showStatus("Uploading logo…");
    var ext = (file.name.split(".").pop() || "png").toLowerCase();
    if (!["png", "jpg", "jpeg", "webp", "svg"].includes(ext)) ext = "png";
    var operation = compressedUpload(file).then(function (converted) {
      if (converted.blob.size > 2750000) throw new Error("File is too large. Use an image under 2.7 MB.");
      return blobToBase64(converted.blob).then(function (content) {
        return fetch("/api/thoughts-admin/upload", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ filename: "logo", extension: converted.ext, content: content })
        });
      });
    }).then(function (response) {
      return response.json().then(function (result) {
        if (!response.ok) throw new Error(result.error || "Upload failed.");
        draft.interface.logo = result.path;
        dirty = true;
        updateLogoPreview();
        showStatus("Logo uploaded. Click Save to publish.");
      });
    }).catch(function (error) {
      showStatus(error.message || "Upload failed.", true);
      throw error;
    });
    pending.push(operation);
    operation.then(function () { pending = pending.filter(function (p) { return p !== operation; }); },
      function () { pending = pending.filter(function (p) { return p !== operation; }); });
  }
  function updatePreview() {
    $("appearancePreviewTitle").textContent = draft.title || "Archive";
    $("appearancePreviewSubtitle").textContent = draft.subtitle || "";
    $("appearanceLoginTitle").textContent = draft.title || "Archive";
    $("appearanceLivePreview").style.setProperty("--reader-accent", draft.accent);
    $("appearanceLivePreview").style.setProperty("--reader-card-radius", ({ square: "0px", soft: "14px", rounded: "22px" })[draft.interface.cardStyle] || "14px");
    $("appearanceLivePreview").style.setProperty("--appearance-demo-width", ({ narrow: "340px", standard: "400px", wide: "480px" })[draft.interface.layoutWidth] || "400px");
    updateSlot("login");
    updateSlot("hero");
    updateLogoPreview();
  }
  function readForm() {
    draft.title = $("appearanceTitle").value.trim().slice(0, 120) || "Archive";
    draft.subtitle = $("appearanceSubtitle").value.trim().slice(0, 280);
    draft.accent = $("appearanceAccent").value;
    draft.interface.displayFont = validFont($("appearanceDisplayFont").value);
    draft.interface.bodyFont = validFont($("appearanceBodyFont").value);
    draft.interface.layoutWidth = $("appearanceLayoutWidth").value;
    draft.interface.cardStyle = $("appearanceCardStyle").value;
    ["login", "hero"].forEach(function (key) {
      var id = slotName(key);
      draft[key].ratio = $(id + "Ratio").value;
      ["x", "y", "zoom"].forEach(function (field) {
        draft[key][field] = Number($(id + field.charAt(0).toUpperCase() + field.slice(1)).value);
      });
    });
    dirty = true;
    updatePreview();
    showStatus("Unsaved changes — preview only. Save to publish.");
  }
  function render(value) {
    if (dirty) return;
    draft = merged(value);
    $("appearanceTitle").value = draft.title;
    $("appearanceSubtitle").value = draft.subtitle;
    $("appearanceAccent").value = /^#[\da-f]{6}$/i.test(draft.accent) ? draft.accent : defaults.accent;
    $("appearanceDisplayFont").value = validFont(draft.interface.displayFont);
    $("appearanceBodyFont").value = validFont(draft.interface.bodyFont);
    $("appearanceLayoutWidth").value = draft.interface.layoutWidth;
    $("appearanceCardStyle").value = draft.interface.cardStyle;
    updateLogoPreview();
    ["login", "hero"].forEach(function (name) {
      var id = slotName(name);
      $(id + "Ratio").value = draft[name].ratio;
      ["x", "y", "zoom"].forEach(function (key) {
        $(id + key.charAt(0).toUpperCase() + key.slice(1)).value = draft[name][key];
      });
    });
    updatePreview();
    showStatus("");
  }
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(",")[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  function compressedUpload(file) {
    if (file.type === "image/gif") return Promise.resolve({ blob: file, ext: "gif" });
    if (file.size <= 2600000) {
      var ext = (file.name.split(".").pop() || "").toLowerCase();
      if (["png", "jpg", "jpeg", "webp"].includes(ext)) return Promise.resolve({ blob: file, ext: ext });
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, 1600 / image.naturalWidth);
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (blob) resolve({ blob: blob, ext: "webp" });
          else reject(new Error("Image conversion failed."));
        }, "image/webp", 0.78);
      };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Invalid image.")); };
      image.src = url;
    });
  }
  function uploadFile(name, file) {
    if (!file) return;
    if (!/^image\/(gif|png|jpeg|webp)$/i.test(file.type)) { showStatus("Use GIF, PNG, JPEG, or WebP.", true); return; }
    if (previewUrls[name]) URL.revokeObjectURL(previewUrls[name]);
    previewUrls[name] = URL.createObjectURL(file);
    updatePreview();
    showStatus("Uploading artwork…");
    var operation = compressedUpload(file).then(function (converted) {
      if (converted.blob.size > 2750000) throw new Error("File is too large. Use an image/GIF under 2.7 MB.");
      return blobToBase64(converted.blob).then(function (content) {
        return fetch("/api/thoughts-admin/upload", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ filename: file.name.replace(/\.[^.]+$/, ""), extension: converted.ext, content: content })
        });
      });
    }).then(function (response) {
      return response.json().then(function (result) {
        if (!response.ok) throw new Error(result.error || "Upload failed.");
        draft[name].image = result.path;
        dirty = true;
        showStatus("Artwork uploaded. Adjust the crop and click Save to publish.");
      });
    }).catch(function (error) {
      showStatus(error.message || "Upload failed.", true);
      throw error;
    });
    pending.push(operation);
    operation.then(function () { pending = pending.filter(function (p) { return p !== operation; }); },
      function () { pending = pending.filter(function (p) { return p !== operation; }); });
  }
  function enableDrag(name) {
    var id = slotName(name), frame = $(id + "Frame");
    var start = null;
    frame.addEventListener("pointerdown", function (event) {
      if (!draft[name].image && !previewUrls[name]) return;
      start = { px: event.clientX, py: event.clientY, x: Number(draft[name].x), y: Number(draft[name].y) };
      frame.setPointerCapture(event.pointerId);
      frame.classList.add("dragging");
    });
    frame.addEventListener("pointermove", function (event) {
      if (!start) return;
      draft[name].x = Math.max(0, Math.min(100, Math.round(start.x - (event.clientX - start.px) / frame.clientWidth * 100)));
      draft[name].y = Math.max(0, Math.min(100, Math.round(start.y - (event.clientY - start.py) / frame.clientHeight * 100)));
      $(id + "X").value = draft[name].x;
      $(id + "Y").value = draft[name].y;
      dirty = true; updatePreview(); showStatus("Crop adjusted. Save to publish.");
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (eventName) {
      frame.addEventListener(eventName, function () { start = null; frame.classList.remove("dragging"); });
    });
  }
  function init(options) {
    saveFn = options.save;
    ["appearanceTitle", "appearanceSubtitle", "appearanceAccent"].forEach(function (id) {
      $(id).addEventListener("input", readForm);
    });
    ["appearanceDisplayFont", "appearanceBodyFont", "appearanceLayoutWidth", "appearanceCardStyle"].forEach(function (id) {
      $(id).addEventListener("change", readForm);
    });
    $("appearanceLogoUpload").addEventListener("change", function () {
      uploadLogo(this.files && this.files[0]);
      this.value = "";
    });
    $("appearanceLogoRemove").addEventListener("click", function () {
      draft.interface.logo = "none";
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      logoPreviewUrl = "";
      dirty = true;
      updateLogoPreview();
      showStatus("Logo hidden in preview. Save to publish.");
    });
    $("appearanceLogoReset").addEventListener("click", function () {
      draft.interface.logo = "";
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      logoPreviewUrl = "";
      dirty = true;
      updateLogoPreview();
      showStatus("Default logo restored in preview. Save to publish.");
    });
    ["login", "hero"].forEach(function (name) {
      var id = slotName(name);
      [id + "Ratio", id + "X", id + "Y", id + "Zoom"].forEach(function (control) {
        $(control).addEventListener("input", readForm);
      });
      $(id + "Upload").addEventListener("change", function () {
        uploadFile(name, this.files && this.files[0]); this.value = "";
      });
      $(id + "Remove").addEventListener("click", function () {
        draft[name].image = "";
        if (previewUrls[name]) URL.revokeObjectURL(previewUrls[name]);
        previewUrls[name] = ""; dirty = true; updatePreview();
        showStatus("Artwork removed from preview. Save to publish.");
      });
      enableDrag(name);
    });
    document.querySelectorAll("[data-appearance-device]").forEach(function (button) {
      button.addEventListener("click", function () {
        var mobile = this.dataset.appearanceDevice === "mobile";
        $("appearanceLivePreview").classList.toggle("is-mobile", mobile);
        document.querySelectorAll("[data-appearance-device]").forEach(function (b) { b.setAttribute("aria-pressed", b === button ? "true" : "false"); });
      });
    });
    $("saveAppearanceBtn").addEventListener("click", function () {
      var button = this; button.disabled = true; showStatus("Saving appearance…");
      Promise.all(pending.slice()).then(function () { return saveFn(clone(draft)); })
        .then(function () {
          dirty = false;
          Object.keys(previewUrls).forEach(function (name) {
            if (previewUrls[name]) URL.revokeObjectURL(previewUrls[name]);
          });
          previewUrls = {};
          if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
          logoPreviewUrl = "";
          render(draft);
          showStatus("Saved. Refresh /read to see the published design.");
        }).catch(function (error) { showStatus(error.message || "Save failed.", true); })
        .finally(function () { button.disabled = false; });
    });
  }
  window.ArchiveAppearanceAdmin = { init: init, render: render };
})();