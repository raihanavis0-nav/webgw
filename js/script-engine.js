/* Script mode layout and serialization. One Story = one screenplay document.
   Text is stored as sanitized sp-* paragraphs; page breaks are derived, never stored. */
(function (root) {
  "use strict";
  var KINDS = ["scene", "action", "character", "dialogue", "parenthetical", "transition"];
  var NEXT = { scene: "action", action: "action", character: "dialogue", dialogue: "character",
    parenthetical: "dialogue", transition: "scene" };
  var HEADING = /^(?:INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.)\s/i;
  function kind(value) { return KINDS.includes(value) ? value : "action"; }
  function escape(text) {
    return String(text == null ? "" : text).replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function normalize(text) { return String(text || "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, ""); }
  function parse(html) {
    var source = String(html || "");
    if (!root.document) return [];
    var template = root.document.createElement("template");
    template.innerHTML = source;
    var rich = /<(?:p|div|br|h[1-6])\b/i.test(source);
    if (!rich) return normalize(source).split(/\n{2,}/).filter(Boolean).map(function (line) {
      var s = line.trim();
      return { kind: HEADING.test(s) ? "scene" : "action", text: line };
    });
    var blocks = [];
    function flatten(node) {
      if (node.nodeType === 3) return node.nodeValue || "";
      if (node.nodeType !== 1) return "";
      if (node.tagName === "BR") return "\n";
      return Array.from(node.childNodes).map(flatten).join("");
    }
    Array.from(template.content.children).forEach(function (node) {
      if (!["P", "DIV", "H2", "H3"].includes(node.tagName)) return;
      var match = String(node.className || "").match(/\bsp-(scene|action|character|dialogue|parenthetical|transition)\b/);
      var text = flatten(node).replace(/\n$/, "");
      var k = match ? match[1] : HEADING.test(text) ? "scene" : "action";
      blocks.push({ kind: k, text: text });
    });
    return blocks;
  }
  function serialize(blocks) {
    return (blocks || []).map(function (block) {
      return '<p class="sp-' + kind(block.kind) + '">' +
        escape(normalize(block.text)).replace(/\n/g, "<br>") + "</p>";
    }).join("\n");
  }
  function sceneHeading(place, when, where) {
    var prefix = ["INT.", "EXT.", "INT./EXT.", "EXT./INT.", "EST."].includes(place) ? place : "INT.";
    var location = String(where || "").trim().toUpperCase() || "LOCATION";
    var time = String(when || "DAY").trim().toUpperCase() || "DAY";
    return prefix + " " + location + " - " + time;
  }
  function label(type) { return kind(type).toUpperCase(); }
  function makeParagraph(piece, editable) {
    var el = root.document.createElement("p");
    el.className = "script-block sp-" + kind(piece.kind);
    el.dataset.scriptSource = String(piece.source);
    if (piece.part) el.dataset.scriptPart = String(piece.part);
    // Do not number an empty scene heading before the writer has created a scene.
    if (piece.kind === "scene" && piece.sceneNumber && String(piece.text || "").trim()) {
      el.dataset.sceneNumber = String(piece.sceneNumber);
    }
    el.textContent = piece.text || "";
    if (editable) {
      el.contentEditable = "true";
      el.spellcheck = true;
      el.setAttribute("role", "textbox");
      el.setAttribute("aria-label", label(piece.kind) + " screenplay element");
    }
    if (editable) {
      var hints = {
        scene: "INT. / EXT. LOCATION - TIME",
        action: "Describe what happens…",
        character: "CHARACTER NAME",
        dialogue: "Write the dialogue…",
        parenthetical: "(action or emotion)",
        transition: "CUT TO:"
      };
      el.dataset.placeholder = hints[piece.kind] || "Start writing…";
      if (!piece.text) el.appendChild(root.document.createElement("br"));
    }
    return el;
  }
  function newPage() { return { fragments: [], used: 0 }; }
  function compute(blocks, measure, pageHeight) {
    var max = pageHeight || 864;
    var pages = [newPage()], current = pages[0], scene = 0;
    (blocks || []).forEach(function (block, source) {
      var type = kind(block.kind), original = normalize(block.text);
      if (type === "scene") scene++;
      var sceneNumber = type === "scene" ? scene : null;
      var remainingText = original;
      var part = 0;
      // Split unusually long blocks at word boundaries. Source remains a single logical block.
      do {
        var space = max - current.used;
        var cost = Math.ceil(measure(type, remainingText));
        if (cost > space && current.fragments.length) {
          current = newPage(); pages.push(current);
          space = max;
        }
        var chunk = remainingText;
        if (cost > space && remainingText.trim()) {
          var tokens = remainingText.match(/\S+\s*|\s+/g) || [remainingText];
          var low = 1, high = tokens.length, fit = 0;
          while (low <= high) {
            var mid = Math.floor((low + high) / 2);
            if (measure(type, tokens.slice(0, mid).join("")) <= space) {
              fit = mid; low = mid + 1;
            } else high = mid - 1;
          }
          if (fit > 0 && fit < tokens.length) {
            chunk = tokens.slice(0, fit).join("");
          }
          // Unbreakable single word: place it on this page rather than spinning forever.
        }
        var fragment = { source: source, kind: type, text: chunk,
          part: part, sceneNumber: sceneNumber };
        current.fragments.push(fragment);
        current.used += Math.min(max, Math.ceil(measure(type, chunk)));
        remainingText = remainingText.slice(chunk.length);
        part++;
        if (remainingText) { current = newPage(); pages.push(current); }
      } while (remainingText);
    });
    return pages;
  }
  function measureFor(host) {
    var shell = root.document.createElement("div");
    shell.className = "script-measurer";
    var content = root.document.createElement("div");
    content.className = "script-page-content";
    shell.appendChild(content);
    root.document.body.appendChild(shell);
    return {
      measure: function (type, text) {
        var item = makeParagraph({ kind: type, text: text, source: 0 }, false);
        content.replaceChildren(item);
        var css = root.getComputedStyle(item);
        return item.getBoundingClientRect().height +
          parseFloat(css.marginTop || 0) + parseFloat(css.marginBottom || 0);
      },
      done: function () { shell.remove(); }
    };
  }
  function paginate(blocks) {
    if (!root.document) return [];
    var calc = measureFor();
    try { return compute(blocks, calc.measure, 864); }
    finally { calc.done(); }
  }
  function render(host, blocks, opts) {
    if (!host) return [];
    opts = opts || {};
    var pages = paginate(blocks);
    var fragment = root.document.createDocumentFragment();
    pages.forEach(function (page, index) {
      var sheet = root.document.createElement("section");
      sheet.className = "script-page";
      sheet.setAttribute("aria-label", "Page " + (index + 1));
      var number = root.document.createElement("span");
      number.className = "script-page-number";
      number.textContent = (index + 1) + ".";
      sheet.appendChild(number);
      var content = root.document.createElement("div");
      content.className = "script-page-content";
      page.fragments.forEach(function (piece) {
        content.appendChild(makeParagraph(piece, Boolean(opts.editable)));
      });
      sheet.appendChild(content);
      fragment.appendChild(sheet);
    });
    host.replaceChildren(fragment);
    return pages;
  }
  function renderAdaptive(host, blocks) {
    host.replaceChildren();
    var wrap = root.document.createElement("div");
    wrap.className = "script-adaptive-content";
    (blocks || []).forEach(function (block, i) {
      wrap.appendChild(makeParagraph({ kind: block.kind, text: block.text, source: i }, false));
    });
    host.appendChild(wrap);
  }
  var api = { KINDS: KINDS, NEXT: NEXT, kind: kind, parse: parse,
    serialize: serialize, sceneHeading: sceneHeading, compute: compute,
    paginate: paginate, render: render, renderAdaptive: renderAdaptive };
  root.ScriptEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
