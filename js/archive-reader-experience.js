/* Reader-wide chapter search, backed by the already authenticated library data. */
(function () {
  "use strict";
  var data = null, dialog = null, searchInput = null, results = null;
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function setData(next) {
    data = next && typeof next === "object" ? next : null;
    if (dialog && dialog.open) search();
  }
  function createDialog() {
    if (dialog) return;
    var host = $("libraryApp");
    if (!host) return;
    dialog = el("dialog", "archive-reader-search-dialog");
    dialog.id = "archiveReaderSearchDialog";
    dialog.setAttribute("aria-label", "Search all chapters");
    var shell = el("div", "archive-reader-search-shell");
    var head = el("div", "archive-reader-search-head");
    var label = el("strong", "", "Find a chapter");
    var close = el("button", "archive-reader-search-close", "Close");
    close.type = "button";
    close.addEventListener("click", function () { dialog.close(); });
    head.appendChild(label); head.appendChild(close);
    shell.appendChild(head);
    var field = el("div", "archive-reader-search-field");
    var icon = el("span", "", "⌕");
    icon.setAttribute("aria-hidden", "true");
    searchInput = el("input", "", "");
    searchInput.type = "search";
    searchInput.autocomplete = "off";
    searchInput.placeholder = "Search stories, series or synopsis";
    searchInput.setAttribute("aria-label", "Search all chapters");
    searchInput.addEventListener("input", search);
    field.appendChild(icon); field.appendChild(searchInput);
    shell.appendChild(field);
    results = el("div", "archive-reader-search-results");
    results.setAttribute("role", "region");
    results.setAttribute("aria-live", "polite");
    shell.appendChild(results);
    shell.appendChild(el("p", "archive-reader-search-hint", "Search titles and descriptions across every published series."));
    dialog.appendChild(shell);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    host.appendChild(dialog);
  }
  function show() {
    if (document.body.classList.contains("is-locked") || !$("libraryApp") || $("libraryApp").hidden) return;
    createDialog();
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    searchInput.value = "";
    search();
    searchInput.focus({ preventScroll: true });
  }
  function search() {
    if (!results) return;
    var q = String(searchInput.value || "").toLowerCase().trim();
    var words = q.split(/\s+/).filter(Boolean);
    var stories = data && Array.isArray(data.stories) ? data.stories.slice() : [];
    var series = data && Array.isArray(data.series) ? data.series : [];
    var books = data && Array.isArray(data.subseries) ? data.subseries : [];
    var matches = stories.filter(function (story) {
      if (!story || story.published === false || !story.slug) return false;
      var parent = series.find(function (v) { return String(v.id) === String(story.seriesId); });
      var book = books.find(function (v) { return String(v.id) === String(story.subseriesId); });
      var text = [story.title, story.synopsis, parent && parent.name, book && book.name]
        .filter(Boolean).join(" ").toLowerCase();
      return words.every(function (part) { return text.indexOf(part) !== -1; });
    });
    if (!words.length) matches.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    matches = matches.slice(0, words.length ? 30 : 10);
    results.replaceChildren();
    var intro = el("p", "archive-reader-search-count",
      words.length ? matches.length + (matches.length === 30 ? "+" : "") + " results" : "RECENT CHAPTERS");
    results.appendChild(intro);
    if (!matches.length) {
      results.appendChild(el("p", "archive-reader-search-empty", "No matching published chapters."));
      return;
    }
    matches.forEach(function (story) {
      var seriesItem = series.find(function (v) { return String(v.id) === String(story.seriesId); });
      var book = books.find(function (v) { return String(v.id) === String(story.subseriesId); });
      var link = el("a", "archive-reader-search-result");
      link.href = "read?story=" + encodeURIComponent(story.slug);
      link.appendChild(el("strong", "", story.title || "Untitled chapter"));
      link.appendChild(el("small", "",
        [seriesItem && seriesItem.name, book && book.name].filter(Boolean).join(" / ") || "Chapter"));
      var synopsis = String(story.synopsis || "").trim();
      if (synopsis) link.appendChild(el("span", "", synopsis.length > 115 ? synopsis.slice(0, 112) + "…" : synopsis));
      link.addEventListener("click", function () { dialog.close(); });
      results.appendChild(link);
    });
  }
  function init() {
    createDialog();
    ["readerLibrarySearchBtn", "readerCollectionSearchBtn"].forEach(function (id) {
      var button = $(id);
      if (button) button.addEventListener("click", show);
    });
    document.addEventListener("keydown", function (event) {
      var mod = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      var slash = event.key === "/" && !event.altKey && !event.ctrlKey && !event.metaKey;
      if (!mod && !slash) return;
      if (document.body.classList.contains("is-locked")) return;
      if (slash && event.target.closest &&
          event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      if (dialog && dialog.open) { searchInput.focus(); return; }
      show();
    });
  }
  window.ArchiveReaderExperience = { setData: setData, showSearch: show };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();