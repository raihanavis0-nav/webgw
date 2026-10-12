/* Story admin usability: local recovery, preview, explicit publishing and chapter navigation. */
(function () {
  "use strict";
  var PREFIX = "archive_story_backup_v2_";
  var MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  var current = null;
  var timer = 0;
  var restoring = false;
  var filter = "all";
  var libraryData = null;
  var recoveredOpen = null;
  var openTreeStory = null;
  var pendingRecovery = false;
  var dirtyLocal = false;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, content) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null) node.textContent = content;
    return node;
  }
  function key(id) { return PREFIX + encodeURIComponent(String(id || "")); }
  function escape(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function read(id) {
    try {
      var saved = JSON.parse(localStorage.getItem(key(id)) || "null");
      if (!saved || saved.version !== 2 || saved.id !== String(id) ||
          !saved.draft || !Number.isFinite(saved.at) ||
          Date.now() - saved.at > MAX_AGE) return null;
      return saved;
    } catch (_) { return null; }
  }
  function clear(id) {
    if (!id) return;
    try { localStorage.removeItem(key(id)); } catch (_) {}
  }
  function backupNow() {
    clearTimeout(timer);
    timer = 0;
    if (!dirtyLocal || !current || restoring || pendingRecovery ||
        !$("storyWorkspace") || $("storyWorkspace").hidden) return;
    try {
      var draft = current.getDraft();
      if (window.ThoughtsEditor) draft.body = window.ThoughtsEditor.getContent();
      var synopsis = $("storySynopsisInput");
      var saved = {
        version: 2, id: String(draft.id), at: Date.now(),
        draft: draft, synopsis: synopsis ? synopsis.value : ""
      };
      localStorage.setItem(key(draft.id), JSON.stringify(saved));
      var note = $("archiveLocalDraftStatus");
      if (note) { note.hidden = false; note.textContent = "Draft backed up on this device"; }
    } catch (_) {
      var note = $("archiveLocalDraftStatus");
      if (note) { note.hidden = false; note.textContent = "Local backup unavailable — use Save"; }
    }
  }
  function scheduleBackup() {
    if (!current || restoring || pendingRecovery) return;
    dirtyLocal = true;
    clearTimeout(timer);
    timer = setTimeout(backupNow, 700);
  }
  function hideRecovery() {
    var banner = $("archiveRecoveryBanner");
    if (banner) banner.hidden = true;
  }
  function onOpen(options) {
    current = options;
    pendingRecovery = false;
    dirtyLocal = false;
    hideRecovery();
    var note = $("archiveLocalDraftStatus");
    if (note) note.hidden = true;
    if (restoring) return;
    var saved = read(options.draft.id);
    if (!saved) return;
    pendingRecovery = true;
    var bar = $("archiveRecoveryBanner");
    if (!bar) return;
    var details = bar.querySelector(".archive-recovery-description");
    if (details) {
      details.textContent = "Unsaved changes from " +
        new Date(saved.at).toLocaleString() +
        " are available on this device. Restore or discard them.";
    }
    bar.hidden = false;
    var restore = $("archiveRecoverBtn");
    var discard = $("archiveDiscardRecoveryBtn");
    restore.onclick = function () {
      restoring = true;
      try {
        options.restoreDraft(saved.draft);
        if (window.ThoughtsEditor) window.ThoughtsEditor.setContent(saved.draft.body || "");
        var synopsis = $("storySynopsisInput");
        if (synopsis) {
          synopsis.value = saved.synopsis || "";
          synopsis.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } finally { restoring = false; }
      pendingRecovery = false;
      hideRecovery();
      // Synopsis sync may run on the next frame when the workspace first opens.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var synopsis = $("storySynopsisInput");
          if (synopsis) {
            synopsis.value = saved.synopsis || "";
            synopsis.dispatchEvent(new Event("input", { bubbles: true }));
          }
          scheduleBackup();
        });
      });
      if ($("storyBodyEditor")) $("storyBodyEditor").focus();
    };
    discard.onclick = function () {
      clear(options.draft.id);
      pendingRecovery = false;
      hideRecovery();
      scheduleBackup();
    };
  }
  function onSaved(id) {
    clearTimeout(timer);
    timer = 0;
    dirtyLocal = false;
    pendingRecovery = false;
    clear(id);
    hideRecovery();
    var note = $("archiveLocalDraftStatus");
    if (note) note.hidden = true;
    updatePublish();
  }
  function onExit() {
    clearTimeout(timer);
    timer = 0;
    dirtyLocal = false;
    // Preserve an unreviewed recovery snapshot when the editor is closed.
    // Only the user's explicit Discard or a successful server save clears it.
    if (current && !pendingRecovery) clear(current.draft.id);
    hideRecovery();
    pendingRecovery = false;
    current = null;
  }

  function updatePublish() {
    var button = $("archivePublishBtn"), checkbox = $("storyPublishedInput");
    if (!button || !checkbox) return;
    var published = checkbox.checked;
    button.textContent = published ? "Unpublish" : "Publish";
    button.classList.toggle("is-unpublish", published);
    button.setAttribute("aria-label", published ? "Move story to draft" : "Publish story");
  }

  function showPreview() {
    if (!current) return;
    var draft = current.getDraft();
    if (window.ThoughtsEditor) draft.body = window.ThoughtsEditor.getContent();
    var synopsisInput = $("storySynopsisInput");
    var synopsis = synopsisInput ? synopsisInput.value.trim() : (draft.synopsis || "");
    var dialog = $("archiveStoryPreviewDialog");
    var iframe = $("archivePreviewFrame");
    if (!dialog || !iframe) return;
    var content = window.ThoughtsRichContent
      ? window.ThoughtsRichContent.forDisplay(draft.body || "", "/api/thoughts-admin/media")
      : escape(draft.body || "").replace(/\n/g, "<br>");
    var data = current.getData();
    var series = (data.series || []).find(function (v) { return String(v.id) === String(draft.seriesId); });
    var book = (data.subseries || []).find(function (v) { return String(v.id) === String(draft.subseriesId); });
    var path = [series && series.name, book && book.name].filter(Boolean).join(" / ");
    var names = (draft.characterIds || []).map(function (id) {
      return (data.characters || []).find(function (v) { return String(v.id) === String(id); });
    }).filter(Boolean).map(function (v) {
      var avatar = String(v.portrait || "");
      var valid = /^assets\/thoughts\/[a-z0-9._/-]+$/i.test(avatar) && !avatar.includes("..");
      var image = valid
        ? '<img src="/api/thoughts-admin/media?path=' + encodeURIComponent(avatar) + '" alt="" loading="lazy">'
        : '<span class="avatar-placeholder">' + escape(String(v.name || "?").charAt(0).toUpperCase()) + '</span>';
      return '<div class="story-character-chip">' + image +
        '<span>' + escape(v.name || "Unnamed") + '</span></div>';
    }).join("");
    var wordText = String(draft.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    var words = wordText ? wordText.split(" ").length : 0;
    var minutes = Math.max(1, Math.round(words / 200));
    var parsedDate = new Date(String(draft.date || "") + "T12:00:00");
    var formattedDate = !Number.isNaN(parsedDate.getTime())
      ? new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"long", year:"numeric" }).format(parsedDate)
      : String(draft.date || "");
    var dateLine = (formattedDate ? formattedDate + " · " : "") + minutes + " min read";
    // Styles are the very same stylesheets used by /read; iframe executes no scripts.
    var appearance = data.appearance && data.appearance.interface ? data.appearance.interface : {};
    var allowedFonts = ["Inter","Newsreader","Space Grotesk","Instrument Serif","Archivo"];
    var displayFont = allowedFonts.includes(appearance.displayFont) ? appearance.displayFont : "Inter";
    var bodyFont = allowedFonts.includes(appearance.bodyFont) ? appearance.bodyFont : "Inter";
    var markup = '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="stylesheet" href="/css/thoughts.css">' +
      '<link rel="stylesheet" href="/css/subseries-theme.css">' +
      '<link rel="stylesheet" href="/css/thoughts-screenplay.css">' +
      '<link rel="stylesheet" href="/css/thoughts-appearance.css">' +
      '<style>:root{--reader-display:"' + displayFont + '",system-ui,sans-serif;' +
      '--reader-body-font:"' + bodyFont + '",system-ui,sans-serif}' +
      'body{background:#e7e2d8;margin:0}#storyView .chapter-paper{margin:16px auto 48px}' +
      '.story-synopsis{white-space:pre-line;color:#77736a;margin:16px 0}' +
      '</style></head><body><article id="storyView" class="story-view">' +
      '<div class="chapter-paper" id="chapterPaper">' +
      '<header class="story-header"><p class="story-path">' + escape(path) +
      '</p><h1>' + escape(draft.title || "Untitled") + '</h1>' +
      (synopsis ? '<p class="story-synopsis">' + escape(synopsis) + '</p>' : '') +
      '<p class="story-date">' + escape(dateLine) + '</p>' +
      (draft.contentWarning ? '<p class="story-content-warning"><strong>Content warning: </strong>' +
        escape(draft.contentWarning) + '</p>' : '') +
      '</header>' + (names ? '<section class="story-characters">' + names + '</section>' : '') +
      '<div class="post-body' + (draft.format === "screenplay" ? ' is-screenplay' : '') +
      '">' + content + '</div></div></article></body></html>';
    // Apply the active Sub-series background/accent/font without changing the
    // admin page. The Reader uses these same SubseriesThemes CSS variables.
    if (window.SubseriesThemes && book && book.uiTheme) {
      var uiProxy = document.createElement("div");
      window.SubseriesThemes.applyUi(uiProxy, book.uiTheme);
      if (uiProxy.classList.contains("subseries-ui-themed")) {
        var uiCss = ["--subseries-ui-bg","--subseries-ui-ink",
          "--subseries-ui-font","--subseries-ui-accent"].map(function (name) {
          return name + ":" + uiProxy.style.getPropertyValue(name);
        }).join(";");
        markup = markup.replace("<body><article",
          '<body class="subseries-ui-themed" style="' + uiCss + '"><article');
      }
      if (book.uiTheme.font && window.SubseriesThemes.validFont(book.uiTheme.font)) {
        var family = encodeURIComponent(book.uiTheme.font).replace(/%20/g, "+");
        markup = markup.replace("</head>", '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' +
          family + '&display=swap"></head>');
      }
    }
    if (window.SubseriesThemes) {
      var temp = document.createElement("div");
      window.SubseriesThemes.applyPaper(temp, book && book.paperTheme);
      var paperCss = ["--chapter-paper-bg","--chapter-paper-ink","--chapter-paper-max-width","--chapter-paper-radius"]
        .map(function (name) { return name + ":" + temp.style.getPropertyValue(name); }).join(";");
      markup = markup.replace('<div class="chapter-paper" id="chapterPaper">',
        '<div class="chapter-paper" id="chapterPaper" style="' + paperCss + '">');
    }
    iframe.srcdoc = markup;
    dialog.showModal();
  }

  function enhanceEditor() {
    var bar = document.querySelector("#storyWorkspace .workspace-actions");
    if (!bar || $("archivePreviewBtn")) return;
    var preview = el("button", "quiet-action archive-preview-action", "Preview");
    preview.id = "archivePreviewBtn"; preview.type = "button";
    preview.addEventListener("click", showPreview);
    var save = $("saveStoryBtn");
    bar.insertBefore(preview, save);
    var publish = el("button", "primary-action archive-publish-action", "Publish");
    publish.id = "archivePublishBtn"; publish.type = "button";
    save.insertAdjacentElement("afterend", publish);
    publish.addEventListener("click", function () {
      var checkbox = $("storyPublishedInput");
      if (!current || !checkbox || save.disabled) return;
      if (checkbox.checked &&
        !window.confirm("Unpublish this chapter and move it back to draft?")) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      updatePublish();
      save.click();
    });
    $("storyPublishedInput").addEventListener("change", updatePublish);
    updatePublish();
    var workspaceBar = document.querySelector("#storyWorkspace .workspace-bar");
    var localNote = el("p", "archive-local-draft-status", "");
    localNote.id = "archiveLocalDraftStatus"; localNote.hidden = true;
    workspaceBar.insertAdjacentElement("afterend", localNote);
    var banner = el("section", "archive-recovery-banner");
    banner.id = "archiveRecoveryBanner";
    banner.setAttribute("role", "status");
    banner.hidden = true;
    var copy = el("div", "");
    copy.appendChild(el("strong", "", "Recover unsaved draft?"));
    copy.appendChild(el("p", "archive-recovery-description", ""));
    banner.appendChild(copy);
    var controls = el("div", "archive-recovery-actions");
    var restore = el("button", "primary-action", "Restore");
    restore.id = "archiveRecoverBtn"; restore.type = "button";
    var discard = el("button", "quiet-action", "Discard");
    discard.id = "archiveDiscardRecoveryBtn"; discard.type = "button";
    controls.appendChild(restore); controls.appendChild(discard);
    banner.appendChild(controls);
    localNote.insertAdjacentElement("afterend", banner);
    var dialog = el("dialog", "archive-preview-dialog");
    dialog.id = "archiveStoryPreviewDialog";
    var top = el("header", "archive-preview-header");
    top.appendChild(el("strong", "", "Reader preview"));
    top.appendChild(el("span", "", "Unsaved changes — visible only to you"));
    var close = el("button", "quiet-action", "Close");
    close.type = "button";
    close.addEventListener("click", function () { dialog.close(); });
    top.appendChild(close);
    dialog.appendChild(top);
    var frame = el("iframe", "archive-preview-frame");
    frame.id = "archivePreviewFrame"; frame.setAttribute("title", "Story reader preview");
    frame.setAttribute("sandbox", "allow-same-origin");
    dialog.appendChild(frame);
    document.body.appendChild(dialog);
    document.addEventListener("input", function (event) {
      if (event.target && event.target.closest &&
          event.target.closest("#storyWorkspace, #storyActionsDialog")) scheduleBackup();
    });
    document.addEventListener("change", function (event) {
      if (event.target && event.target.closest &&
          event.target.closest("#storyWorkspace, #storyActionsDialog")) scheduleBackup();
    });
  }

  function renderLibrary(data, callbacks) {
    libraryData = data;
    recoveredOpen = callbacks && callbacks.openRecoveredDraft;
    openTreeStory = callbacks && callbacks.openStoryFromTree;
    var host = $("adminSeriesList");
    if (!host || !data) return;
    var shell = $("archiveStoryLibraryShell");
    if (!shell) {
      shell = el("div", "archive-story-library-shell");
      shell.id = "archiveStoryLibraryShell";
      var sidebar = el("nav", "archive-story-nav");
      sidebar.id = "archiveStoryTree";
      sidebar.setAttribute("aria-label", "Series and sub-series navigation");
      host.parentNode.insertBefore(shell, host);
      shell.appendChild(sidebar); shell.appendChild(host);
      var search = $("adminStorySearch");
      if (search) search.addEventListener("input", function () { applyFilters(libraryData); });
    }
    var tree = $("archiveStoryTree");
    tree.replaceChildren();
    tree.appendChild(el("span", "archive-story-nav-kicker", "CONTENTS"));
    (data.series || []).slice().sort(function (a,b) {
      return Number(a.order || 0) - Number(b.order || 0);
    }).forEach(function (series) {
      var block = Array.from(host.querySelectorAll(".admin-series-block"))
        .find(function (node) { return node.dataset.sortId === String(series.id); });
      var link = el("button", "archive-story-nav-series", series.name || "Untitled");
      link.type = "button"; link.title = series.name || "Untitled";
      link.addEventListener("click", function () {
        if (!block) return;
        block.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      tree.appendChild(link);
      function addChapter(chapter, direct) {
        var button = el("button", "archive-story-nav-chapter" +
          (direct ? " is-direct" : ""), chapter.title || "Untitled");
        button.type = "button";
        button.title = chapter.title || "Untitled chapter";
        button.addEventListener("click", function () {
          if (typeof openTreeStory === "function") openTreeStory(chapter.id);
        });
        tree.appendChild(button);
      }
      (data.stories || []).filter(function (story) {
        return String(story.seriesId) === String(series.id) && !story.subseriesId;
      }).sort(function (a,b) { return Number(a.order || 0) - Number(b.order || 0); })
        .forEach(function (story) { addChapter(story, true); });
      (data.subseries || []).filter(function (v) { return String(v.seriesId) === String(series.id); })
        .sort(function (a,b) { return Number(a.order || 0) - Number(b.order || 0); })
        .forEach(function (sub) {
          var sublink = el("button", "archive-story-nav-sub", sub.name || "Untitled");
          sublink.type = "button";
          sublink.addEventListener("click", function () {
            if (!block) return;
            var item = Array.from(block.querySelectorAll(".subseries-block"))
              .find(function (node) { return node.dataset.sortId === String(sub.id); });
            if (item) item.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          tree.appendChild(sublink);
          (data.stories || []).filter(function (story) {
            return String(story.seriesId) === String(series.id) &&
              String(story.subseriesId) === String(sub.id);
          }).sort(function (a,b) { return Number(a.order || 0) - Number(b.order || 0); })
            .forEach(function (story) { addChapter(story, false); });
        });
    });
    var parent = $("adminStorySearch") && $("adminStorySearch").parentElement;
    if (parent && !$("archiveStoryStatusFilter")) {
      var select = el("select", "archive-story-status-filter");
      select.id = "archiveStoryStatusFilter";
      select.setAttribute("aria-label", "Filter stories by publication status");
      [["all","All stories"],["draft","Drafts"],["published","Published"]]
        .forEach(function (pair) {
          var option = el("option", "", pair[1]); option.value = pair[0];
          select.appendChild(option);
        });
      select.addEventListener("change", function () { filter = select.value; applyFilters(libraryData); });
      var addSeries = $("addSeriesBtn");
      if (addSeries && addSeries.parentElement === parent) parent.insertBefore(select, addSeries);
      else parent.appendChild(select);
    }
    renderRecoveryList();
    applyFilters(data);
  }
  function renderRecoveryList() {
    var host = $("archiveStoryLibraryShell");
    if (!host) return;
    var panel = $("archiveDraftsInLibrary");
    if (!panel) {
      panel = el("section", "archive-local-recovery-list");
      panel.id = "archiveDraftsInLibrary";
      host.insertAdjacentElement("beforebegin", panel);
    }
    panel.replaceChildren();
    var items = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var name = localStorage.key(i);
        if (!name || name.indexOf(PREFIX) !== 0) continue;
        var id = decodeURIComponent(name.slice(PREFIX.length));
        var snapshot = read(id);
        if (snapshot) items.push(snapshot);
        else localStorage.removeItem(name);
      }
    } catch (_) {}
    items.sort(function (a,b) { return b.at - a.at; });
    if (!items.length) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.appendChild(el("strong", "", "Unsaved drafts on this device"));
    panel.appendChild(el("p", "", "These backups are stored in this browser, not published or saved to the server. Clear them on shared devices."));
    var actions = el("div", "archive-local-recovery-links");
    items.slice(0, 8).forEach(function (snapshot) {
      var button = el("button", "", "Recover: " + (snapshot.draft.title || "Untitled"));
      button.type = "button";
      button.addEventListener("click", function () {
        if (typeof recoveredOpen === "function") recoveredOpen(snapshot.draft);
      });
      actions.appendChild(button);
    });
    panel.appendChild(actions);
  }
  function applyFilters(data) {
    var host = $("adminSeriesList"); if (!host) return;
    var search = $("adminStorySearch");
    var q = String((search && search.value) || "").toLowerCase().trim();
    var byId = new Map((data.stories || []).map(function (story) { return [String(story.id), story]; }));
    host.querySelectorAll(".admin-story-row").forEach(function (row) {
      var story = byId.get(String(row.dataset.sortId));
      if (!story) return;
      var series = (data.series || []).find(function (v) { return String(v.id) === String(story.seriesId); });
      var sub = (data.subseries || []).find(function (v) { return String(v.id) === String(story.subseriesId); });
      var haystack = [story.title, story.synopsis, series && series.name, sub && sub.name]
        .filter(Boolean).join(" ").toLowerCase();
      var status = story.published === false ? "draft" : "published";
      row.hidden = !!((q && haystack.indexOf(q) === -1) || (filter !== "all" && filter !== status));
    });
    host.querySelectorAll(".admin-series-block").forEach(function (block) {
      block.hidden = !!(q || filter !== "all") && !block.querySelector(".admin-story-row:not([hidden])");
    });
    host.querySelectorAll(".subseries-block").forEach(function (block) {
      block.hidden = !!(q || filter !== "all") && !block.querySelector(".admin-story-row:not([hidden])");
    });
  }
  function init() {
    enhanceEditor();
    window.addEventListener("pagehide", function () {
      if (dirtyLocal) backupNow();
    });
  }
  window.ArchiveAdminExperience = {
    onOpen: onOpen, onSaved: onSaved, onExit: onExit,
    scheduleBackup: scheduleBackup, renderLibrary: renderLibrary
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();