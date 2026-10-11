/* =============================================================
   @-MENTIONS (reader) — clicking a mention link opens a small
   dialog with the character / world entry details.
   Links are written by the admin editor as:
     <a class="mention mention-character"
        data-mention-type="character" data-mention-id="..."
        href="#mention-character-...">@Name</a>
   ============================================================= */
(function () {
  "use strict";

  function ensureDialog() {
    var existing = document.getElementById("mentionDialog");
    if (existing) return existing;

    var dialog = document.createElement("dialog");
    dialog.id = "mentionDialog";
    dialog.className = "mention-dialog";
    dialog.innerHTML =
      '<div class="mention-shell">' +
      '<button class="mention-close" type="button" aria-label="Close">×</button>' +
      '<div class="mention-media" id="mentionMedia"></div>' +
      '<div class="mention-copy">' +
      '<p class="mention-kicker" id="mentionKicker"></p>' +
      '<h2 id="mentionTitle"></h2>' +
      '<p class="mention-meta" id="mentionMeta"></p>' +
      '<p class="mention-body" id="mentionBody"></p>' +
      "</div>" +
      "</div>";

    document.body.appendChild(dialog);

    dialog
      .querySelector(".mention-close")
      .addEventListener("click", function () {
        dialog.close();
      });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });

    return dialog;
  }

  function setMedia(box, src, alt, fallbackText) {
    box.innerHTML = "";
    if (src) {
      var img = document.createElement("img");
      img.src = src;
      img.alt = alt || "";
      img.loading = "lazy";
      box.appendChild(img);
      return;
    }
    var ph = document.createElement("div");
    ph.className = "mention-placeholder";
    ph.textContent = fallbackText || "?";
    box.appendChild(ph);
  }

  function show(kicker, title, meta, body, mediaSrc, mediaAlt, fallbackText) {
    var dialog = ensureDialog();
    document.getElementById("mentionKicker").textContent = kicker;
    document.getElementById("mentionTitle").textContent = title;
    var metaEl = document.getElementById("mentionMeta");
    metaEl.textContent = meta || "";
    metaEl.hidden = !meta;
    document.getElementById("mentionBody").textContent =
      body || "No description yet.";
    setMedia(
      document.getElementById("mentionMedia"),
      mediaSrc,
      mediaAlt,
      fallbackText
    );
    if (!dialog.open) dialog.showModal();
  }

  function entityMeta(entity, type) {
    var reader = window.ThoughtsReader;
    if (!reader) return "";
    if (type === "character") {
      var parts = [];
      var series = reader.seriesById(entity.seriesId);
      var sub = reader.subseriesById(entity.subseriesId);
      if (series) parts.push(series.name);
      if (sub) parts.push(sub.name);
      return parts.join(" / ");
    }
    var bits = [];
    if (entity.category) bits.push(String(entity.category));
    var wseries = reader.seriesById(entity.seriesId);
    if (wseries) bits.push(wseries.name);
    return bits.join(" · ");
  }

  function initials(name) {
    return String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) {
        return w.slice(0, 1).toUpperCase();
      })
      .join("");
  }

  document.addEventListener("click", function (event) {
    var link =
      event.target && event.target.closest
        ? event.target.closest("a[data-mention-type]")
        : null;
    if (!link || !window.ThoughtsReader) return;

    event.preventDefault();

    var type = link.getAttribute("data-mention-type");
    var id = link.getAttribute("data-mention-id");
    var reader = window.ThoughtsReader;

    if (type === "character") {
      var character = reader.characterById(id);
      if (!character) return;
      show(
        "Character",
        character.name || "Unnamed",
        entityMeta(character, "character"),
        character.bio || "",
        character.portrait ? reader.mediaUrl(character.portrait) : "",
        (character.name || "Character") + " portrait",
        initials(character.name)
      );
      return;
    }

    if (type === "world") {
      var entry = reader.worldEntryById(id);
      if (!entry) return;
      show(
        "World",
        entry.name || "Untitled",
        entityMeta(entry, "world"),
        entry.description || "",
        entry.image ? reader.mediaUrl(entry.image) : "",
        (entry.name || "World entry") + " image",
        initials(entry.name)
      );
    }
  });
})();
