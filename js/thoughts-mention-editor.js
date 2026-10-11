/* =============================================================
   @-MENTIONS (admin editor) — type "@" inside the story editor to
   get an autocomplete dropdown of characters + world entries.
   Selecting one inserts a mention link that the reader turns into
   a clickable reference dialog.

   Usage:
     window.ThoughtsMentionEditor.init({
       editorId: "storyBodyEditor",
       getItems: function () {
         return [{ type: "character"|"world", id: "...", name: "...", hint: "..." }];
       }
     });
   ============================================================= */
(function () {
  "use strict";

  var editor = null;
  var getItems = null;
  var picker = null;
  var activeIndex = -1;
  var currentMatches = [];
  var mentionRange = null;

  function items() {
    try {
      var list = typeof getItems === "function" ? getItems() : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  // Find an "@query" directly before the caret inside a text node.
  function mentionQueryAtCaret() {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.isCollapsed) return null;
    var range = selection.getRangeAt(0);
    var node = range.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    if (!editor.contains(node)) return null;

    var text = node.textContent.slice(0, range.startOffset);
    var match = /(^|[\s(>"']|\u00a0)@([\p{L}\p{N} _.\-]{0,32})$/u.exec(text);
    if (!match) return null;

    var query = match[2];
    var at = text.length - query.length - 1;
    var queryRange = range.cloneRange();
    queryRange.setStart(node, at);
    queryRange.setEnd(node, range.startOffset);
    return { query: query, range: queryRange };
  }

  function ensurePicker() {
    if (picker) return picker;
    picker = document.createElement("div");
    picker.className = "mention-picker";
    picker.hidden = true;
    picker.setAttribute("role", "listbox");
    document.body.appendChild(picker);

    picker.addEventListener("mousedown", function (event) {
      // Keep the editor selection while clicking a row.
      event.preventDefault();
    });
    picker.addEventListener("click", function (event) {
      var row = event.target.closest(".mention-picker-row");
      if (!row) return;
      selectIndex(Number(row.getAttribute("data-index")));
    });
    return picker;
  }

  function closePicker() {
    if (picker) picker.hidden = true;
    activeIndex = -1;
    currentMatches = [];
    mentionRange = null;
  }

  function isOpen() {
    return Boolean(picker && !picker.hidden);
  }

  function renderPicker(matches, query) {
    var box = ensurePicker();
    currentMatches = matches;
    activeIndex = matches.length ? 0 : -1;
    box.innerHTML = "";

    if (!matches.length) {
      var empty = document.createElement("div");
      empty.className = "mention-picker-empty";
      empty.textContent = query
        ? 'No matches for "@' + query + '"'
        : "No characters or world entries yet.";
      box.appendChild(empty);
    }

    matches.slice(0, 8).forEach(function (item, index) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "mention-picker-row" + (index === 0 ? " is-active" : "");
      row.setAttribute("role", "option");
      row.setAttribute("data-index", String(index));

      var name = document.createElement("span");
      name.textContent = item.name || "Unnamed";
      var kind = document.createElement("small");
      kind.textContent = item.type === "world" ? "World" : "Character";
      if (item.hint) kind.textContent += " · " + item.hint;
      row.appendChild(name);
      row.appendChild(kind);
      box.appendChild(row);
    });

    // Position under the caret.
    try {
      var rect = mentionRange.getBoundingClientRect();
      var top = rect.bottom + window.scrollY + 6;
      var left = Math.min(
        rect.left + window.scrollX,
        window.scrollX + window.innerWidth - 330
      );
      box.style.top = Math.max(8, top) + "px";
      box.style.left = Math.max(8, left) + "px";
    } catch (_) {}

    box.hidden = false;
  }

  function highlight() {
    if (!picker) return;
    picker.querySelectorAll(".mention-picker-row").forEach(function (row) {
      row.classList.toggle(
        "is-active",
        Number(row.getAttribute("data-index")) === activeIndex
      );
    });
    var active = picker.querySelector(".mention-picker-row.is-active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }

  function selectIndex(index) {
    var item = currentMatches[index];
    var range = mentionRange;
    closePicker();
    if (!item || !range) return;

    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    range.deleteContents();

    var link = document.createElement("a");
    link.className = "mention mention-" + item.type;
    link.setAttribute("data-mention-type", item.type);
    link.setAttribute("data-mention-id", String(item.id));
    link.setAttribute("href", "#mention-" + item.type + "-" + String(item.id));
    link.textContent = "@" + (item.name || "Unnamed");

    range.insertNode(link);
    var space = document.createTextNode(" ");
    link.parentNode.insertBefore(space, link.nextSibling);

    var caret = document.createRange();
    caret.setStartAfter(space);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);

    editor.focus();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function update() {
    var found = mentionQueryAtCaret();
    if (!found) {
      closePicker();
      return;
    }
    mentionRange = found.range;
    var q = found.query.trim().toLowerCase();
    var matches = items().filter(function (item) {
      if (!q) return true;
      return String(item.name || "").toLowerCase().indexOf(q) !== -1;
    });
    renderPicker(matches, found.query.trim());
  }

  function onKeyDown(event) {
    if (!isOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePicker();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopImmediatePropagation();
      var count = Math.min(currentMatches.length, 8);
      if (!count) return;
      activeIndex =
        event.key === "ArrowDown"
          ? (activeIndex + 1) % count
          : (activeIndex - 1 + count) % count;
      highlight();
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      if (activeIndex >= 0 && activeIndex < currentMatches.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectIndex(activeIndex);
      } else {
        closePicker();
      }
    }
  }

  function init(options) {
    var config = options || {};
    editor = document.getElementById(config.editorId || "storyBodyEditor");
    getItems = config.getItems;
    if (!editor || typeof getItems !== "function") return;

    // NOTE on ordering: this keydown listener is registered from the
    // admin's DOMContentLoaded wiring, which runs before the editor
    // bridge initializes the editor (script order in thoughts-admin.html).
    // At-target listeners fire in registration order, so when the picker
    // is open, stopImmediatePropagation() below reliably blocks the
    // editor's own Enter handling for that keypress.
    editor.addEventListener("keydown", onKeyDown);
    editor.addEventListener("input", update);
    editor.addEventListener("keyup", function (event) {
      if (event.key && event.key.length === 1) update();
    });
    editor.addEventListener("click", update);
    document.addEventListener("click", function (event) {
      if (picker && !picker.hidden && !picker.contains(event.target)) closePicker();
    });
    document.addEventListener("scroll", function () { if (isOpen()) closePicker(); }, true);
  }

  // init() is called from the admin wiring (see thoughts-admin.js),
  // which runs before the editor bridge initializes the editor.
  window.ThoughtsMentionEditor = { init: init };
})();
