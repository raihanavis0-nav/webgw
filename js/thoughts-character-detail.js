(function () {
  "use strict";

  var grid = null;
  var observer = null;
  var scheduled = false;

  function characterInfo(card) {
    var name = card.querySelector("h3");
    var meta = card.querySelector(".character-meta");
    var bio = card.querySelector(".character-bio");
    var image = card.querySelector(".character-portrait");
    var placeholder = card.querySelector(".character-portrait-placeholder");

    return {
      name: name ? name.textContent.trim() : "Unnamed",
      meta: meta && !meta.hidden ? meta.textContent.trim() : "",
      bio: bio ? bio.textContent.trim() : "",
      imageSrc: image ? image.currentSrc || image.src : "",
      imageAlt: image ? image.alt || "" : "",
      initials: placeholder ? ((placeholder.querySelector(".character-portrait-monogram") || placeholder).textContent.trim()) : "",
    };
  }

  function ensureDialog() {
    var existing = document.getElementById("characterDetailDialog");
    if (existing) return existing;

    var dialog = document.createElement("dialog");
    dialog.id = "characterDetailDialog";
    dialog.className = "character-detail-dialog";
    dialog.setAttribute("aria-labelledby", "characterDetailName");
    dialog.innerHTML =
      '<div class="character-detail-shell">' +
      '<button class="character-detail-close" type="button" aria-label="Close character details">×</button>' +
      '<div class="character-detail-portrait" id="characterDetailPortrait"></div>' +
      '<div class="character-detail-copy">' +
      '<p class="character-detail-kicker">Character</p>' +
      '<h2 id="characterDetailName"></h2>' +
      '<p class="character-detail-meta" id="characterDetailMeta"></p>' +
      '<div class="character-detail-rule" aria-hidden="true"></div>' +
      '<div class="character-detail-bio" id="characterDetailBio"></div>' +
      '<div class="character-detail-credit" id="characterDetailCredit" hidden></div>' +
      "</div>" +
      "</div>";

    document.body.appendChild(dialog);

    dialog.querySelector(".character-detail-close").addEventListener("click", function () {
      dialog.close();
    });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });

    return dialog;
  }

  function openDetails(card) {
    var info = characterInfo(card);
    var dialog = ensureDialog();
    var portrait = document.getElementById("characterDetailPortrait");
    var name = document.getElementById("characterDetailName");
    var meta = document.getElementById("characterDetailMeta");
    var bio = document.getElementById("characterDetailBio");
    var credit = document.getElementById("characterDetailCredit");

    portrait.innerHTML = "";

    function showPortraitPlaceholder() {
      var placeholder = document.createElement("div");
      placeholder.className = "character-detail-placeholder";
      placeholder.textContent = info.initials || info.name.slice(0, 2).toUpperCase();
      portrait.replaceChildren(placeholder);
    }
    if (info.imageSrc) {
      var image = document.createElement("img");
      image.alt = info.imageAlt || info.name + " portrait";
      image.addEventListener("error", function () {
        // A failed thumbnail must not replace the portrait of another open character.
        if (image.parentNode === portrait) showPortraitPlaceholder();
      });
      portrait.appendChild(image);
      image.src = info.imageSrc;
    } else {
      showPortraitPlaceholder();
    }

    name.textContent = info.name;
    meta.textContent = info.meta;
    meta.hidden = !info.meta;
    // Parse stored biographies without changing source data: skip duplicate Name,
    // keep optional custom fields, and give casting credit its own compact footer.
    bio.replaceChildren();
    credit.replaceChildren();
    credit.hidden = true;
    var lines = (info.bio || "No description yet.").split(/\n/).map(function (line) {
      return line.trim();
    }).filter(Boolean);
    function sameName(a, b) {
      return String(a || "").trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
        String(b || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
    }
    var portrayed = "";
    lines.forEach(function (line) {
      // Preserve the spelling in the stored data; normalize only the display label.
      var cast = /^po(?:r)?trayed\s+by\s*:?\s*(.+)$/i.exec(line);
      if (cast) {
        portrayed = cast[1].trim();
        return;
      }
      var match = /^([^:\n]{1,32})\s*:\s*(.+)$/.exec(line);
      if (match) {
        var fieldName = match[1].trim();
        var fieldValue = match[2].trim();
        if (/^name$/i.test(fieldName) && sameName(fieldValue, info.name)) return;
        if (/^po(?:r)?trayed\s+by$/i.test(fieldName)) {
          portrayed = fieldValue;
          return;
        }
        var row = document.createElement("dl");
        row.className = "character-detail-fact";
        var label = document.createElement("dt");
        var value = document.createElement("dd");
        label.textContent = fieldName;
        value.textContent = fieldValue;
        row.appendChild(label);
        row.appendChild(value);
        bio.appendChild(row);
      } else {
        var paragraph = document.createElement("p");
        paragraph.className = "character-detail-paragraph";
        paragraph.textContent = line;
        bio.appendChild(paragraph);
      }
    });
    if (portrayed) {
      var creditLabel = document.createElement("span");
      creditLabel.className = "character-detail-credit-label";
      creditLabel.textContent = "PORTRAYED BY";
      var creditLink = document.createElement("a");
      creditLink.className = "character-detail-credit-name";
      // Search only the stored casting name; do not assume a TMDB/IMDb profile.
      creditLink.href = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(portrayed);
      creditLink.target = "_blank";
      creditLink.rel = "noopener noreferrer";
      creditLink.textContent = portrayed;
      creditLink.setAttribute("aria-label", "Search Google Images for " + portrayed + " (opens a new tab)");
      credit.appendChild(creditLabel);
      credit.appendChild(creditLink);
      credit.hidden = false;
    }
    if (!dialog.open) dialog.showModal();
  }

  function activatePortrait(card) {
    if (!card || card.dataset.characterDetailReady === "true") return;

    var target = card.querySelector(
      ".character-portrait, .character-portrait-placeholder"
    );
    if (!target) return;

    var bio = card.querySelector(".character-bio");
    if (bio) bio.hidden = true;

    target.classList.add("character-detail-trigger");
    target.setAttribute("role", "button");
    target.setAttribute("tabindex", "0");
    target.setAttribute("aria-haspopup", "dialog");
    target.setAttribute(
      "aria-label",
      "View " +
        ((card.querySelector("h3") && card.querySelector("h3").textContent.trim()) ||
          "character") +
        " details"
    );

    target.addEventListener("click", function () {
      openDetails(card);
    });

    target.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDetails(card);
    });

    card.dataset.characterDetailReady = "true";
  }

  function decorate() {
    scheduled = false;
    if (!grid) return;

    grid.querySelectorAll(".character-card").forEach(activatePortrait);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  function init() {
    grid = document.getElementById("characterGrid");
    if (!grid) return;

    schedule();
    observer = new MutationObserver(schedule);
    observer.observe(grid, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
