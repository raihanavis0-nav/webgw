/* Dedicated Write-on-Paper screenplay editor. Reuses Story Admin's authenticated Save action
   and protected draft backup; the master document is a list of logical screenplay blocks. */
(function () {
  "use strict";
  var E = window.ScriptEngine;
  if (!E) return;
  var model = [], selected = 0, config = null, open = false;
  var ui = {}, reflowTimer = null, statusTimer = null, pages = [];
  var sceneOpen = false, revision = 0;

  function $(id) { return document.getElementById(id); }
  function create(tag, className, label) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (label != null) node.textContent = label;
    return node;
  }
  function button(text, title) {
    var node = create("button", "", text);
    node.type = "button";
    if (title) node.title = title;
    return node;
  }
  function status(text, error) {
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.toggle("script-status-error", Boolean(error));
  }
  function updatePicker() {
    if (!ui.character) return;
    var block = model[selected];
    var isCharacter = block && block.kind === "character";
    ui.character.hidden = !isCharacter;
    if (isCharacter && config) {
      var data = config.getData ? config.getData() : {};
      var seriesId = config.getSeriesId ? config.getSeriesId() : "";
      var names = (data.characters || []).filter(function (person) {
        return !person.seriesId || String(person.seriesId) === String(seriesId);
      }).map(function (person) { return person.name || ""; }).filter(Boolean);
      var previous = ui.character.value;
      ui.character.replaceChildren();
      var blank = create("option", "", "Character…");
      blank.value = "";
      ui.character.appendChild(blank);
      [...new Set(names)].sort().forEach(function (name) {
        var option = create("option", "", name); option.value = name;
        ui.character.appendChild(option);
      });
      ui.character.value = names.includes(previous) ? previous : "";
    }
  }
  function updateToolbar() {
    if (!ui.element) return;
    ui.element.value = model[selected] ? E.kind(model[selected].kind) : "action";
    ui.position.textContent = "Element: " + ui.element.value.toUpperCase() +
      " · " + model.length + " blocks · " + pages.length + " pages";
    updatePicker();
  }

  function blockNodes(source) {
    return Array.from(ui.pages.querySelectorAll('[data-script-source="' + source + '"]'));
  }
  function readText(node) {
    if (!node) return "";
    if (node.childNodes.length === 1 && node.firstChild.tagName === "BR") return "";
    return (node.innerText || node.textContent || "").replace(/\r/g, "").replace(/\n$/, "");
  }
  function syncBlocks() {
    model.forEach(function (block, index) {
      var nodes = blockNodes(index);
      if (nodes.length) block.text = nodes.map(readText).join("");
    });
  }
  function getCaret(node) {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount || !node.contains(selection.anchorNode)) return 0;
    var range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(node);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  }
  function bookmarkFor(node) {
    var source = Number(node.dataset.scriptSource);
    var before = 0;
    var siblings = blockNodes(source);
    for (var i = 0; i < siblings.length; i++) {
      if (siblings[i] === node) break;
      before += readText(siblings[i]).length;
    }
    return { source: source, offset: before + getCaret(node) };
  }
  function focusAt(source, offset) {
    var nodes = blockNodes(source);
    if (!nodes.length) return;
    var current = nodes[nodes.length - 1], remaining = Math.max(0, offset || 0);
    for (var i = 0; i < nodes.length; i++) {
      var size = readText(nodes[i]).length;
      if (remaining <= size) { current = nodes[i]; break; }
      remaining -= size;
    }
    current.focus({ preventScroll: true });
    var walker = document.createTreeWalker(current, NodeFilter.SHOW_TEXT);
    var node, last = null;
    while ((node = walker.nextNode())) {
      last = node;
      if (remaining <= node.nodeValue.length) {
        var selection = window.getSelection(), range = document.createRange();
        range.setStart(node, remaining); range.collapse(true);
        selection.removeAllRanges(); selection.addRange(range);
        current.scrollIntoView({ block: "nearest" });
        return;
      }
      remaining -= node.nodeValue.length;
    }
    var sel = window.getSelection(), end = document.createRange();
    if (last) end.setStart(last, last.nodeValue.length);
    else end.selectNodeContents(current);
    end.collapse(!last);
    sel.removeAllRanges(); sel.addRange(end);
    current.scrollIntoView({ block: "nearest" });
  }
  function saveToDraft() {
    if (!config) return;
    var legacy = $("storyBodyInput");
    if (!legacy) return;
    var html = E.serialize(model);
    if (legacy.value === html) return;
    legacy.value = html;
    legacy.dispatchEvent(new Event("input", { bubbles: true }));
    status("Unsaved · local draft backup active");
  }
  function reflow(bookmark) {
    if (!open || !ui.pages) return;
    pages = E.render(ui.pages, model, { editable: true });
    ui.pageCount.textContent = pages.length + (pages.length === 1 ? " page" : " pages");
    drawNavigator();
    updateToolbar();
    if (bookmark) focusAt(bookmark.source, bookmark.offset);
  }
  function scheduleReflow(bookmark) {
    clearTimeout(reflowTimer);
    reflowTimer = setTimeout(function () {
      syncBlocks();
      saveToDraft();
      reflow(bookmark);
    }, 180);
  }
  function drawNavigator() {
    ui.nav.replaceChildren();
    var scenes = 0;
    model.forEach(function (block, index) {
      if (block.kind !== "scene") return;
      scenes++;
      var item = button("", "Go to scene " + scenes);
      item.className = "script-scene-link";
      item.appendChild(create("strong", "", String(scenes).padStart(2,"0") + " · " + (block.text || "Untitled scene").slice(0,90)));
      var page = pages.findIndex(function (page) {
        return page.fragments.some(function (fragment) { return fragment.source === index; });
      });
      item.appendChild(create("small", "", "Page " + (page + 1)));
      item.addEventListener("click", function () { focusAt(index, 0); });
      ui.nav.appendChild(item);
    });
    if (!scenes) ui.nav.appendChild(create("small", "", "Add a scene using the Scene button."));
  }

  function applyKind(next) {
    if (!model.length) model.push({ kind: "action", text: "" });
    syncBlocks();
    var at = selected, target = E.kind(next);
    model[at].kind = target;
    saveToDraft();
    reflow({ source: at, offset: 0 });
  }
  function handleEnter(event, node) {
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    syncBlocks();
    var at = Number(node.dataset.scriptSource);
    var cursor = bookmarkFor(node).offset;
    var previous = model[at];
    var first = previous.text.slice(0, cursor), rest = previous.text.slice(cursor);
    previous.text = first;
    model.splice(at + 1, 0, { kind: E.NEXT[E.kind(previous.kind)] || "action", text: rest });
    selected = at + 1;
    saveToDraft();
    reflow({ source: selected, offset: 0 });
  }
  function insertScene() {
    syncBlocks();
    var text = E.sceneHeading(ui.sceneType.value, ui.sceneTime.value, ui.sceneLocation.value);
    var chosen = model[selected];
    if (!chosen || chosen.text.trim()) { selected += 1; model.splice(selected, 0, { kind:"scene", text: text }); }
    else model[selected] = { kind:"scene", text:text };
    saveToDraft(); reflow({ source:selected, offset:text.length });
    ui.sceneLocation.value = "";
    ui.sceneCompose.hidden = true;
  }
  function handleKeydown(event) {
    var node = event.target.closest && event.target.closest(".script-block[contenteditable]");
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault(); doSave(); return;
    }
    if (!node || !ui.pages.contains(node)) return;
    if (event.key === "Enter") return handleEnter(event, node);
    if (event.key === "Tab") {
      event.preventDefault();
      var k = E.KINDS.indexOf(E.kind(model[selected].kind));
      applyKind(E.KINDS[(k + (event.shiftKey ? E.KINDS.length - 1 : 1)) % E.KINDS.length]);
      return;
    }
    if (event.key === "Backspace" && !readText(node) && bookmarkFor(node).offset === 0 && selected > 0) {
      event.preventDefault();
      syncBlocks();
      model.splice(selected, 1);
      selected--;
      saveToDraft(); reflow({ source:selected, offset:model[selected].text.length });
    }
  }

  function doSave() {
    if (!open) return;
    clearTimeout(reflowTimer);
    syncBlocks();
    saveToDraft();
    status("Saving to archive…");
    $("saveStoryBtn").click();
  }
  function openWorkspace(options) {
    config = options || {};
    var source = $("storyBodyInput").value || "";
    if (window.ThoughtsEditor && !source) source = window.ThoughtsEditor.getContent();
    model = E.parse(source);
    if (!model.length) model = [{ kind:"scene", text:"" }];
    selected = 0;
    revision++;
    open = true;
    ui.shell.hidden = false;
    ui.title.textContent = $("storyTitleInput").value.trim() || "Untitled script";
    document.body.classList.add("script-workspace-open");
    ui.sceneCompose.hidden = true;
    ui.navPanel.hidden = false;
    reflow({ source:0, offset:0 });
    status("Local draft · click Save to publish changes");
  }
  function closeWorkspace() {
    if (!open) return;
    clearTimeout(reflowTimer);
    syncBlocks();
    saveToDraft();
    // Keep the classic editor bridge from overwriting the script draft when returning.
    if (window.ThoughtsEditor) window.ThoughtsEditor.setContent(E.serialize(model));
    open = false;
    ui.shell.hidden = true;
    document.body.classList.remove("script-workspace-open");
    $("scriptOpenBtn").focus();
  }

  function setup() {
    var storyBody = $("storyBodyEditor");
    if (!storyBody) return;
    var launcher = create("div", "script-launch");
    launcher.id = "scriptLaunchRow";
    launcher.innerHTML = '<div><strong>Dedicated Script Workspace</strong><p>Write on Letter-size screenplay pages with smart elements and a scene navigator.</p></div>';
    var start = button("Edit Script ↗");
    start.id = "scriptOpenBtn";
    start.addEventListener("click", function () { openWorkspace({
      getData: function () { return window.ScriptAdminData && window.ScriptAdminData.getData(); },
      getSeriesId: function () { return $("storySeriesInput").value; }
    }); });
    launcher.appendChild(start);
    storyBody.insertAdjacentElement("afterend", launcher);
    var shell = create("section", "script-workspace");
    shell.id = "scriptWorkspace";
    shell.hidden = true;
    shell.setAttribute("aria-label", "Dedicated screenplay writing workspace");
    var toolbar = create("header", "script-toolbar");
    var close = button("← Back", "Return to story properties");
    close.addEventListener("click", closeWorkspace);
    toolbar.appendChild(close);
    var heading = create("div", "script-toolbar-title");
    heading.appendChild(create("strong", "", "Untitled script"));
    heading.appendChild(create("small", "", "Script / Write on Paper"));
    ui.title = heading.firstChild;
    toolbar.appendChild(heading);
    var toggleNav = button("Scenes");
    toggleNav.addEventListener("click", function () {
      ui.navPanel.hidden = !ui.navPanel.hidden;
      toggleNav.setAttribute("aria-pressed", String(!ui.navPanel.hidden));
    });
    toolbar.appendChild(toggleNav);
    var element = create("select");
    element.setAttribute("aria-label", "Current screenplay element");
    E.KINDS.forEach(function (kind) {
      var opt = create("option", "", kind.charAt(0).toUpperCase() + kind.slice(1));
      opt.value = kind; element.appendChild(opt);
    });
    element.addEventListener("change", function () { applyKind(element.value); });
    toolbar.appendChild(element);
    ui.element = element;
    var character = create("select");
    character.setAttribute("aria-label", "Insert existing story character");
    character.addEventListener("change", function () {
      if (!character.value || !model[selected]) return;
      model[selected].text = character.value.toUpperCase();
      saveToDraft(); reflow({ source:selected, offset:model[selected].text.length });
    });
    toolbar.appendChild(character); ui.character = character;
    var addScene = button("+ Scene", "Build a scene heading");
    addScene.addEventListener("click", function () {
      ui.sceneCompose.hidden = !ui.sceneCompose.hidden;
      if (!ui.sceneCompose.hidden) ui.sceneLocation.focus();
    });
    toolbar.appendChild(addScene);
    var print = button("PDF / Print", "Print Letter pages or Save as PDF");
    print.addEventListener("click", function () {
      clearTimeout(reflowTimer); syncBlocks(); saveToDraft(); reflow();
      window.print();
    });
    toolbar.appendChild(print);
    var save = button("Save", "Save draft to server");
    save.id = "scriptSave"; save.addEventListener("click", doSave);
    toolbar.appendChild(save);
    shell.appendChild(toolbar);
    var composer = create("section", "script-scene-compose");
    composer.hidden = true;
    ui.sceneCompose = composer;
    var type = create("select"); type.setAttribute("aria-label","Scene type");
    ["INT.", "EXT.", "INT./EXT.", "EXT./INT.", "EST."].forEach(function (value) {
      var opt = create("option", "", value); opt.value = value; type.appendChild(opt);
    }); ui.sceneType = type; composer.appendChild(type);
    var location = create("input"); location.placeholder="Scene location"; location.setAttribute("aria-label","Scene location");
    ui.sceneLocation = location; composer.appendChild(location);
    var time = create("select"); time.setAttribute("aria-label","Time of day");
    ["DAY","NIGHT","MORNING","AFTERNOON","EVENING","DAWN","DUSK","CONTINUOUS","LATER"].forEach(function (name) {
      var opt = create("option", "", name); opt.value = name; time.appendChild(opt);
    }); ui.sceneTime = time; composer.appendChild(time);
    var insert = button("Insert heading"); insert.addEventListener("click", insertScene);
    composer.appendChild(insert);
    location.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); insertScene(); } });
    shell.appendChild(composer);
    var main = create("div", "script-main");
    var side = create("aside", "script-sidebar");
    side.appendChild(create("p", "script-sidebar-label", "Scene Navigator"));
    ui.nav = create("nav"); ui.nav.setAttribute("aria-label","Scenes");
    side.appendChild(ui.nav); main.appendChild(side); ui.navPanel = side;
    var stage = create("main", "script-stage");
    var pageHost = create("div", "script-pages"); stage.appendChild(pageHost);
    ui.pages = pageHost; main.appendChild(stage); shell.appendChild(main);
    pageHost.addEventListener("focusin", function (event) {
      var node = event.target.closest && event.target.closest("[data-script-source]");
      if (!node) return;
      selected = Number(node.dataset.scriptSource); updateToolbar();
    });
    pageHost.addEventListener("keydown", handleKeydown);
    pageHost.addEventListener("input", function (event) {
      var node = event.target.closest && event.target.closest("[data-script-source]");
      if (!node) return;
      selected = Number(node.dataset.scriptSource);
      var bookmark = bookmarkFor(node);
      syncBlocks(); saveToDraft();
      scheduleReflow(bookmark);
    });
    var footer = create("footer", "script-footer");
    ui.position = create("span", "", "Element: SCENE");
    footer.appendChild(ui.position);
    var statusNode = create("span", "script-save-state", "");
    ui.status = statusNode; footer.appendChild(statusNode);
    ui.pageCount = create("span", "", "1 page"); footer.appendChild(ui.pageCount);
    shell.appendChild(footer);
    document.body.appendChild(shell);
    ui.shell = shell;
    window.addEventListener("beforeprint", function () {
      if (open) { clearTimeout(reflowTimer); syncBlocks(); saveToDraft(); reflow(); }
    });
    document.addEventListener("keydown", function (event) {
      if (open && event.key === "Escape") { event.preventDefault(); closeWorkspace(); }
    });
    var indicator = $("saveIndicator");
    if (indicator) new MutationObserver(function () {
      if (!open) return;
      var message = indicator.getAttribute("aria-label") || "";
      if (message === "Saved") status("Saved to archive");
      else if (message === "Unsaved") status("Unsaved · local draft backup active");
    }).observe(indicator, { attributes:true, attributeFilter:["aria-label"] });
  }
  window.ScriptWorkspace = {
    refreshMode: function (active) {
      var workspace = $("storyWorkspace");
      if (workspace) workspace.classList.toggle("is-script-story", Boolean(active));
    },
    close: closeWorkspace,
    isOpen: function () { return open; }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
