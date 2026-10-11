(function () {
  "use strict";

  var API = {
    auth: "/api/thoughts/auth",
    content: "/api/thoughts/content",
    media: "/api/thoughts/media",
  };

  var state = {
    data: {
      series: [],
      subseries: [],
      characters: [],
      stories: [],
      worldEntries: [],
      galleryItems: [],
    },
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setTheme(theme, persist) {
    var next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;

    if (persist) {
      localStorage.setItem("thoughts_theme", next);
    }

    document.querySelectorAll("[data-theme-choice]").forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        button.getAttribute("data-theme-choice") === next ? "true" : "false"
      );
    });
  }

  function setupThemeSwitch() {
    setTheme(document.documentElement.dataset.theme || "light", false);

    document.querySelectorAll("[data-theme-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        setTheme(button.getAttribute("data-theme-choice"), true);
      });
    });
  }

  function apiJson(url, options) {
    options = options || {};
    options.credentials = "same-origin";
    options.headers = Object.assign(
      { Accept: "application/json" },
      options.headers || {}
    );

    if (options.body && !options.headers["Content-Type"]) {
      options.headers["Content-Type"] = "application/json";
    }

    return fetch(url, options).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          if (!response.ok) {
            var error = new Error(body.error || "Request failed.");
            error.status = response.status;
            throw error;
          }
          return body;
        });
    });
  }

  function mediaUrl(path) {
    return API.media + "?path=" + encodeURIComponent(String(path || ""));
  }

  function characterInitials(name) {
    var parts = String(name || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (
      parts[0].slice(0, 1) +
      parts[parts.length - 1].slice(0, 1)
    ).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeUrl(value, image) {
    var url = String(value || "").trim();
    if (!url) return "";

    if (image && /^assets\/thoughts\//i.test(url)) {
      return mediaUrl(url);
    }

    if (/^https?:\/\//i.test(url)) return url;
    if (!image && /^mailto:/i.test(url)) return url;
    if (!image && /^#/.test(url)) return url;
    if (!image && /^(\.\.?\/|\/)/.test(url)) return url;

    return "";
  }

  function inlineMarkdown(source) {
    var tokens = [];
    var text = String(source || "");

    function stash(html) {
      var key = "@@TOKEN" + tokens.length + "@@";
      tokens.push(html);
      return key;
    }

    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, url) {
      var clean = safeUrl(url, true);
      if (!clean) return escapeHtml(_);

      var caption = alt
        ? "<figcaption>" + escapeHtml(alt) + "</figcaption>"
        : "";

      return stash(
        '<figure><img src="' +
          escapeHtml(clean) +
          '" alt="' +
          escapeHtml(alt) +
          '" loading="lazy" />' +
          caption +
          "</figure>"
      );
    });

    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
      var clean = safeUrl(url, false);
      if (!clean) return escapeHtml(_);

      var external = /^https?:\/\//i.test(clean);

      return stash(
        '<a href="' +
          escapeHtml(clean) +
          '"' +
          (external ? ' target="_blank" rel="noopener noreferrer"' : "") +
          ">" +
          escapeHtml(label) +
          "</a>"
      );
    });

    text = text.replace(
      new RegExp("\\x60([^\\x60]+)\\x60", "g"),
      function (_, code) {
        return stash("<code>" + escapeHtml(code) + "</code>");
      }
    );

    text = escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");

    tokens.forEach(function (html, index) {
      text = text.replace("@@TOKEN" + index + "@@", html);
    });

    return text;
  }

  function markdownToHtml(source) {
    var lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
    var out = [];
    var paragraph = [];
    var list = null;
    var quote = [];
    var code = [];
    var inCode = false;

    function flushParagraph() {
      if (!paragraph.length) return;
      out.push("<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>");
      paragraph = [];
    }

    function flushList() {
      if (!list) return;

      out.push(
        "<" +
          list.type +
          ">" +
          list.items
            .map(function (item) {
              return "<li>" + inlineMarkdown(item) + "</li>";
            })
            .join("") +
          "</" +
          list.type +
          ">"
      );

      list = null;
    }

    function flushQuote() {
      if (!quote.length) return;
      out.push(
        "<blockquote><p>" +
          inlineMarkdown(quote.join(" ")) +
          "</p></blockquote>"
      );
      quote = [];
    }

    function flushCode() {
      if (!code.length) return;
      out.push("<pre><code>" + escapeHtml(code.join("\n")) + "</code></pre>");
      code = [];
    }

    lines.forEach(function (line) {
      if (line.trim().slice(0, 3) === String.fromCharCode(96, 96, 96)) {
        flushParagraph();
        flushList();
        flushQuote();
        if (inCode) flushCode();
        inCode = !inCode;
        return;
      }

      if (inCode) {
        code.push(line);
        return;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        flushQuote();
        return;
      }

      var heading = line.match(/^(#{2,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        flushQuote();

        var level = heading[1].length;
        out.push(
          "<h" +
            level +
            ">" +
            inlineMarkdown(heading[2]) +
            "</h" +
            level +
            ">"
        );
        return;
      }

      var quoted = line.match(/^>\s?(.*)$/);
      if (quoted) {
        flushParagraph();
        flushList();
        quote.push(quoted[1]);
        return;
      }

      var unordered = line.match(/^[-*]\s+(.+)$/);
      if (unordered) {
        flushParagraph();
        flushQuote();

        if (!list || list.type !== "ul") {
          flushList();
          list = { type: "ul", items: [] };
        }

        list.items.push(unordered[1]);
        return;
      }

      var ordered = line.match(/^\d+\.\s+(.+)$/);
      if (ordered) {
        flushParagraph();
        flushQuote();

        if (!list || list.type !== "ol") {
          flushList();
          list = { type: "ol", items: [] };
        }

        list.items.push(ordered[1]);
        return;
      }

      flushList();
      flushQuote();
      paragraph.push(line.trim());
    });

    flushParagraph();
    flushList();
    flushQuote();

    if (inCode || code.length) flushCode();

    return out.join("\n");
  }

  function looksLikeRichStoryBody(value) {
    return /<(?:p|div|h[2-4]|blockquote|ul|ol|li|figure|figcaption|span|font|strong|b|em|i|u|s|strike|br|pre|code|img|hr|sub|sup|table|thead|tbody|tr|th|td)\b/i.test(
      String(value || "")
    );
  }

  function renderStoryBody(body) {
    var host = $("storyBody");
    if (!host) return;

    var source = String(body || "");
    if (
      looksLikeRichStoryBody(source) &&
      window.ThoughtsRichContent &&
      typeof window.ThoughtsRichContent.forDisplay === "function"
    ) {
      host.innerHTML = window.ThoughtsRichContent.forDisplay(
        source,
        "/api/thoughts/media"
      );
      return;
    }

    host.innerHTML = markdownToHtml(source);
  }

  function formatDate(iso) {
    var date = new Date(String(iso || "") + "T12:00:00");
    if (Number.isNaN(date.getTime())) return iso || "";

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function formatShortDate(iso) {
    var date = new Date(String(iso || "") + "T12:00:00");
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(date);
  }

  function sortByOrderName(a, b) {
    var ao = Number(a.order || 0);
    var bo = Number(b.order || 0);

    if (ao !== bo) return ao - bo;

    return String(a.name || a.title || "").localeCompare(
      String(b.name || b.title || "")
    );
  }

  function sortStories(a, b) {
    var order = Number(a.order || 0) - Number(b.order || 0);
    if (order) return order;

    var date = String(a.date || "").localeCompare(String(b.date || ""));
    if (date) return date;

    return String(a.title || "").localeCompare(String(b.title || ""));
  }

  function seriesById(id) {
    return state.data.series.find(function (item) {
      return String(item.id) === String(id);
    });
  }

  function subseriesById(id) {
    return state.data.subseries.find(function (item) {
      return String(item.id) === String(id);
    });
  }

  function characterById(id) {
    return state.data.characters.find(function (item) {
      return String(item.id) === String(id);
    });
  }

  function storyById(id) {
    return state.data.stories.find(function (item) {
      return String(item.id) === String(id);
    });
  }

  function storyUrl(slug) {
    return "read?story=" + encodeURIComponent(slug);
  }

  function storyFormat(story) {
    return story && story.format === "screenplay" ? "screenplay" : "prose";
  }

  function readingMinutes(story) {
    var text = String((story && story.body) || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    var words = text ? text.split(" ").length : 0;
    return Math.max(1, Math.round(words / 200));
  }

  function createStoryList(stories) {
    var list = document.createElement("div");
    list.className = "story-list";

    stories.slice().sort(sortStories).forEach(function (story, index) {
      var row = document.createElement("div");
      row.className = "story-row";

      var order = document.createElement("span");
      order.className = "story-index";
      var displayOrder =
        Number(story.order || 0) > 0 ? Number(story.order) : index + 1;
      order.textContent = String(displayOrder).padStart(2, "0");

      var titleStack = document.createElement("div");
      titleStack.className = "story-title-stack";

      var link = document.createElement("a");
      link.href = storyUrl(story.slug);
      link.textContent = story.title || "Untitled";
      titleStack.appendChild(link);

      var meta = document.createElement("p");
      meta.className = "story-meta";

      var minutes = document.createElement("span");
      minutes.className = "story-reading-time";
      minutes.textContent = readingMinutes(story) + " min read";
      meta.appendChild(minutes);

      titleStack.appendChild(meta);

      var synopsisText = String(story.synopsis || "").trim();
      if (synopsisText) {
        row.classList.add("has-list-synopsis");

        var synopsis = document.createElement("p");
        synopsis.className = "story-list-synopsis";
        synopsis.textContent = synopsisText;
        synopsis.title = synopsisText;
        titleStack.appendChild(synopsis);
      }

      var time = document.createElement("time");
      time.dateTime = story.date || "";
      time.textContent = formatShortDate(story.date);

      var arrow = document.createElement("span");
      arrow.className = "story-row-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↗";
      row.appendChild(order);
      row.appendChild(titleStack);
      row.appendChild(time);
      row.appendChild(arrow);
      list.appendChild(row);
    });

    return list;
  }

  // Story discovery: search + random, wrapping a story list.
  // The format filter was removed: each book/series is uniformly one
  // format, so a per-list filter could never match anything.
  function createStoryDiscovery(stories) {
    var wrapper = document.createElement("div");
    wrapper.className = "story-discovery";

    var toolbar = document.createElement("div");
    toolbar.className = "story-discovery-toolbar";

    var search = document.createElement("input");
    search.type = "search";
    search.className = "archive-search-input";
    search.placeholder = "Search stories";
    search.setAttribute("aria-label", "Search stories");
    search.autocomplete = "off";

    // Single format label for the whole list (uniform per book/series).
    var seenFormats = {};
    (stories || []).forEach(function (story) {
      seenFormats[storyFormat(story)] = true;
    });
    var formatKeys = Object.keys(seenFormats);
    var listFormat = formatKeys.length === 1 ? formatKeys[0] : "";

    var listHost = document.createElement("div");

    function currentFiltered() {
      var q = search.value.trim().toLowerCase();
      return (stories || []).filter(function (story) {
        if (!q) return true;
        var hay = (
          String(story.title || "") +
          " " +
          String(story.synopsis || "")
        ).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }

    function render() {
      var filtered = currentFiltered();
      listHost.innerHTML = "";
      if (!filtered.length) {
        var empty = document.createElement("p");
        empty.className = "discovery-empty";
        empty.textContent = "No stories match.";
        listHost.appendChild(empty);
        return;
      }
      listHost.appendChild(createStoryList(filtered));
    }

    var random = document.createElement("button");
    random.type = "button";
    random.className = "discovery-random-btn";
    random.textContent = "↯ Random";
    random.setAttribute("aria-label", "Open a random story");
    random.addEventListener("click", function () {
      var pool = currentFiltered();
      if (!pool.length) return;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      window.location.href = storyUrl(pick.slug);
    });

    search.addEventListener("input", render);

    toolbar.appendChild(search);
    if (listFormat) {
      var formatLabel = document.createElement("span");
      formatLabel.className = "discovery-format-label";
      formatLabel.textContent = listFormat === "screenplay" ? "Script" : "Prose";
      toolbar.appendChild(formatLabel);
    }
    toolbar.appendChild(random);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(listHost);
    render();
    return wrapper;
  }

  function archiveFocusStorageKey(kind, id) {
    return "thoughts_archive_focus_" + kind + "_" + id;
  }

  function getArchiveFocusMode(kind, id) {
    try {
      return localStorage.getItem(archiveFocusStorageKey(kind, id)) === "cover"
        ? "cover"
        : "title";
    } catch (error) {
      return "title";
    }
  }

  function applyArchiveFocusMode(layout, kind, id, mode) {
    var next = mode === "cover" ? "cover" : "title";
    layout.dataset.focus = next;

    layout.querySelectorAll("[data-archive-focus]").forEach(function (button) {
      var active = button.getAttribute("data-archive-focus") === next;
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    try {
      localStorage.setItem(archiveFocusStorageKey(kind, id), next);
    } catch (error) {
      // Preference persistence is optional.
    }
  }

  function createArchiveFocusToggle(layout, kind, id) {
    var toggle = document.createElement("div");
    toggle.className = "archive-focus-toggle";
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", "Archive display focus");

    ["title", "cover"].forEach(function (mode, index) {
      if (index) {
        var slash = document.createElement("span");
        slash.className = "archive-focus-separator";
        slash.textContent = "/";
        slash.setAttribute("aria-hidden", "true");
        toggle.appendChild(slash);
      }

      var button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-archive-focus", mode);
      button.textContent = mode === "cover" ? "Cover" : "Title";
      button.addEventListener("click", function () {
        applyArchiveFocusMode(layout, kind, id, mode);
      });
      toggle.appendChild(button);
    });

    return toggle;
  }

  function archiveCollapseStorageKey(kind, id) {
    return "thoughts_archive_collapsed_" + kind + "_" + id;
  }

  function getArchiveCollapsed(kind, id) {
    try {
      return localStorage.getItem(archiveCollapseStorageKey(kind, id)) === "1";
    } catch (error) {
      return false;
    }
  }

  function setArchiveCollapsed(section, kind, id, collapsed) {
    var isCollapsed = Boolean(collapsed);
    section.classList.toggle("reader-is-collapsed", isCollapsed);

    section.querySelectorAll(".archive-collapse-toggle").forEach(function (button) {
      if (
        button.getAttribute("data-collapse-kind") !== kind ||
        button.getAttribute("data-collapse-id") !== String(id)
      ) {
        return;
      }

      button.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      button.setAttribute(
        "aria-label",
        (isCollapsed ? "Expand " : "Collapse ") +
          (button.getAttribute("data-collapse-label") || "section")
      );

      var icon = button.querySelector(".archive-collapse-icon");
      if (icon) icon.textContent = isCollapsed ? "▸" : "▾";
    });

    try {
      localStorage.setItem(
        archiveCollapseStorageKey(kind, id),
        isCollapsed ? "1" : "0"
      );
    } catch (error) {
      // Collapse persistence is optional.
    }
  }

  function createArchiveCollapseButton(section, kind, id, label, banner) {
    var button = document.createElement("button");
    button.type = "button";
    button.className =
      "archive-collapse-toggle" + (banner ? " on-banner" : "");
    button.setAttribute("data-collapse-kind", kind);
    button.setAttribute("data-collapse-id", String(id));
    button.setAttribute("data-collapse-label", label || "section");

    var icon = document.createElement("span");
    icon.className = "archive-collapse-icon";
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setArchiveCollapsed(
        section,
        kind,
        id,
        !section.classList.contains("reader-is-collapsed")
      );
    });

    return button;
  }

  function createBookCover(item, label, layout, toggle) {
    var frame = document.createElement("div");
    frame.className = "archive-book-cover-frame";

    var image = document.createElement("img");
    image.className = "archive-book-cover";
    image.src = mediaUrl(item.cover);
    image.alt = (label || "Book") + " cover";
    image.loading = "lazy";
    image.addEventListener("error", function () {
      frame.remove();
      if (toggle) toggle.remove();
      layout.classList.add("cover-unavailable");
      layout.dataset.focus = "title";
    });

    frame.appendChild(image);
    return frame;
  }


  // Existing data maps directly: Series = World, Sub-series = Book, Story = Chapter.
  function seriesContext() {
    var p = new URLSearchParams(window.location.search);
    return {
      seriesId: p.get("series") || "",
      bookId: p.get("book") || "",
    };
  }
  function goToCollection(seriesId, bookId, view) {
    var query = new URLSearchParams();
    if (seriesId) query.set("series", seriesId);
    if (bookId) query.set("book", bookId);
    if (view && view !== "stories") query.set("view", view);
    history.pushState({}, "", "read" + (query.toString() ? "?" + query.toString() : ""));
    renderHome();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function renderBreadcrumb(targetId, seriesId, bookId, chapterName) {
    var host = $(targetId);
    if (!host) return false;
    host.replaceChildren();

    var series = seriesId ? seriesById(seriesId) : null;
    var subseries = series && bookId ? subseriesById(bookId) : null;
    if (subseries && String(subseries.seriesId) !== String(series.id)) subseries = null;
    var items = [];
    items.push({ label: "Library", href: "read" });
    function hrefFor(id, book) {
      var q = new URLSearchParams();
      if (id) q.set("series", id);
      if (book) q.set("book", book);
      return "read" + (q.toString() ? "?" + q.toString() : "");
    }
    if (series) items.push({ label: series.name || "Series", href: hrefFor(series.id) });
    if (subseries) items.push({ label: subseries.name || "Sub-series", href: hrefFor(series.id, subseries.id) });
    if (chapterName) items.push({ label: chapterName, href: "" });

    // Do not add a redundant breadcrumb to the top-level series gallery.
    var visible = items.length > 1;
    host.hidden = !visible;
    host.classList.toggle("is-visible", visible);
    if (!visible) return false;

    var list = document.createElement("ol");
    items.forEach(function (item, index) {
      var li = document.createElement("li");
      var last = index === items.length - 1;
      var node = document.createElement(last ? "span" : "a");
      node.textContent = item.label;
      if (last) node.setAttribute("aria-current", "page");
      else node.href = item.href;
      li.appendChild(node);
      list.appendChild(li);
    });
    host.appendChild(list);
    return true;
  }

  function archiveHeading(host, label, title, description, back) {
    var wrap = document.createElement("header");
    wrap.className = "archive-hierarchy-heading";
    if (back) {
      var previous = document.createElement("button");
      previous.type = "button"; previous.className = "archive-hierarchy-back";
      previous.textContent = "← " + label;
      previous.addEventListener("click", back);
      wrap.appendChild(previous);
    }
    var kicker = document.createElement("span");
    kicker.className = "archive-hierarchy-kicker";
    kicker.textContent = seriesContext().bookId ? "THE CHAPTERS" : "THE COLLECTION";
    wrap.appendChild(kicker);
    var headline = document.createElement("h3");
    headline.textContent = title;
    wrap.appendChild(headline);
    if (description) {
      var text = document.createElement("p");
      text.textContent = description;
      wrap.appendChild(text);
    }
    host.appendChild(wrap);
  }

  // Universal "back to all series" + series context for the
  // Characters / World / Timeline panels. The stories panel renders its
  // own hierarchy heading; these panels had no way back at all.
  function syncPanelContext(sectionId) {
    var section = $(sectionId);
    if (!section) return;
    var heading = section.querySelector(".section-heading");
    if (!heading) return;

    var context = seriesContext();
    var back = heading.querySelector(".archive-panel-back");
    var ctx = heading.querySelector(".archive-panel-context");

    if (!context.seriesId) {
      if (back) back.remove();
      if (ctx) ctx.remove();
      return;
    }

    var view = section.getAttribute("data-archive-panel") || "stories";
    if (!back) {
      back = document.createElement("button");
      back.type = "button";
      back.className = "archive-panel-back";
      back.addEventListener("click", function () {
        goToCollection("", "", back.getAttribute("data-view"));
      });
      heading.insertBefore(back, heading.firstChild);
    }
    back.setAttribute("data-view", view);
    back.textContent = "← All series";

    var series = seriesById(context.seriesId);
    var book = context.bookId ? subseriesById(context.bookId) : null;
    var ctxText = series ? series.name || "" : "";
    if (book && book.name) ctxText += (ctxText ? " / " : "") + book.name;
    if (!ctx) {
      ctx = document.createElement("p");
      ctx.className = "archive-panel-context";
      heading.appendChild(ctx);
    }
    ctx.textContent = ctxText;
    ctx.hidden = !ctxText;
  }
  function collectionCard(item, type, count, onClick) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "archive-collection-card";
    var media = document.createElement("span");
    media.className = "archive-collection-card-media";
    if (item.cover || item.banner) {
      var image = document.createElement("img");
      image.src = mediaUrl(item.cover || item.banner);
      image.alt = ""; image.loading = "lazy";
      media.appendChild(image);
    }
    var text = document.createElement("span");
    text.className = "archive-collection-card-body";
    var meta = document.createElement("small");
    meta.textContent = type + " · " + count;
    var title = document.createElement("strong");
    title.textContent = item.name || "Untitled";
    text.appendChild(meta); text.appendChild(title);
    if (item.description) {
      var desc = document.createElement("span");
      desc.textContent = item.description;
      text.appendChild(desc);
    }
    card.appendChild(media); card.appendChild(text);
    card.addEventListener("click", onClick);
    return card;
  }
  // Poster layout is a reader preference, not a change to the Series data.
  var POSTER_LAYOUT_KEY = "thoughts_subseries_poster_layout";
  function savedPosterLayout() {
    try {
      return localStorage.getItem(POSTER_LAYOUT_KEY) === "list" ? "list" : "grid";
    } catch (_) {
      return "grid";
    }
  }

  function createPosterLayoutSwitch(grid) {
    var bar = document.createElement("div");
    bar.className = "reader-poster-layout-bar";
    var label = document.createElement("span");
    label.className = "reader-poster-layout-label";
    label.textContent = "VIEW";
    bar.appendChild(label);

    var group = document.createElement("div");
    group.className = "reader-poster-layout-switch";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Sub-series poster layout");
    var buttons = {};
    var icons = {
      grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
      list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h12M9 12h12M9 19h12"/><rect x="3" y="3" width="3" height="4" rx=".5"/><rect x="3" y="10" width="3" height="4" rx=".5"/><rect x="3" y="17" width="3" height="4" rx=".5"/></svg>'
    };
    function apply(layout) {
      var list = layout === "list";
      grid.classList.toggle("is-list-view", list);
      buttons.grid.setAttribute("aria-pressed", String(!list));
      buttons.list.setAttribute("aria-pressed", String(list));
      try {
        localStorage.setItem(POSTER_LAYOUT_KEY, list ? "list" : "grid");
      } catch (_) {}
    }
    ["grid", "list"].forEach(function (layout) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "reader-poster-layout-button";
      button.setAttribute("aria-label", layout === "grid" ? "Grid view" : "List view");
      button.title = layout === "grid" ? "Grid view" : "List view";
      button.innerHTML = icons[layout];
      button.addEventListener("click", function () { apply(layout); });
      buttons[layout] = button;
      group.appendChild(button);
    });
    bar.appendChild(group);
    // Apply stored layout without persisting or rerendering the poster cards.
    var list = savedPosterLayout() === "list";
    grid.classList.toggle("is-list-view", list);
    buttons.grid.setAttribute("aria-pressed", String(!list));
    buttons.list.setAttribute("aria-pressed", String(list));
    return bar;
  }

  function renderSeriesNavigator() {
    var host = $("seriesList");
    host.innerHTML = "";
    if (window.SubseriesThemes) window.SubseriesThemes.applyUi(document.body, null);
    var context = seriesContext();
    var series = state.data.series.find(function (s) { return String(s.id) === context.seriesId; });
    var stories = state.data.stories || [];
    // The static "Discover Worlds" heading is redundant once drilled into
    // a series — the hierarchy heading below already carries the title.
    var staticHeading = document.querySelector("#seriesSection > .section-heading");
    if (staticHeading) staticHeading.hidden = Boolean(series);
    if (!series) {
      var seriesGrid = document.createElement("div");
      seriesGrid.className = "reader-series-grid reader-library-books";
      state.data.series.slice().sort(sortByOrderName).forEach(function (item) {
        var chapterList = stories.filter(function (story) { return story.seriesId === item.id; });
        var count = chapterList.length;
        var books = state.data.subseries
          .filter(function (subseries) { return subseries.seriesId === item.id; })
          .slice().sort(sortByOrderName)
          .map(function (subseries) {
            return {
              id: subseries.id,
              name: subseries.name,
              chapterCount: chapterList.filter(function (story) { return story.subseriesId === subseries.id; }).length
            };
          });
        var directCount = chapterList.filter(function (story) { return !story.subseriesId; }).length;
        seriesGrid.appendChild(window.ArchiveSeriesBooksReader.create(
          item, count, books, directCount,
          function () { goToCollection(item.id, "", "stories"); },
          function (subseriesId) { goToCollection(item.id, subseriesId, "stories"); },
          mediaUrl
        ));
      });
      host.appendChild(seriesGrid);
      if (!state.data.series.length) archiveHeading(host, "", "No series yet", "New worlds will appear here.");
      return;
    }

    var book = state.data.subseries.find(function (item) {
      return String(item.id) === context.bookId && item.seriesId === series.id;
    });
    if (window.SubseriesThemes) window.SubseriesThemes.applyUi(document.body, book && book.uiTheme);
    archiveHeading(host, "All series", book ? (book.name || "Book") : (series.name || "Series"),
      book ? book.description : series.description, function () {
        goToCollection(book ? series.id : "", "", "stories");
      });
    if (!book) {
      var books = state.data.subseries.filter(function (s) { return s.seriesId === series.id; }).sort(sortByOrderName);
      var bookGrid = document.createElement("div");
      bookGrid.className = "reader-series-grid reader-books-grid";
      books.forEach(function (item) {
        var count = stories.filter(function (story) { return story.subseriesId === item.id; }).length;
        // Only posters saved on this Sub-series are shown; Series posters belong to Series only.
        bookGrid.appendChild(window.ArchiveSeriesPostersReader.create(item, count, function () {
          goToCollection(series.id, item.id, "stories");
        }, mediaUrl, "Book"));
      });
      if (books.length) host.appendChild(createPosterLayoutSwitch(bookGrid));
      host.appendChild(bookGrid);
      var standalones = stories.filter(function (story) { return story.seriesId === series.id && !story.subseriesId; });
      if (standalones.length) {
        archiveHeading(host, "", "Standalone chapters", "");
        host.appendChild(createStoryDiscovery(standalones));
      }
      return;
    }
    var chapters = stories.filter(function (story) { return story.subseriesId === book.id && story.seriesId === series.id; });
    var wrapper = document.createElement("div");
    wrapper.className = "archive-hierarchy-chapters";
    wrapper.appendChild(createStoryDiscovery(chapters));
    host.appendChild(wrapper);
  }

  function renderSeries() {
    renderSeriesNavigator();
  }

  function characterMeta(character) {
    var series = seriesById(character.seriesId);
    var subseries = subseriesById(character.subseriesId);
    var parts = [];

    if (series) parts.push(series.name);
    if (subseries) parts.push(subseries.name);

    return parts.join(" / ");
  }

  function characterPortraitPlaceholder(character) {
    var name = (character && character.name) || "Unnamed";
    var placeholder = document.createElement("div");
    placeholder.className = "character-portrait-placeholder character-portrait-editorial";
    placeholder.setAttribute("aria-label", name + " portrait unavailable");
    var seed = 0;
    for (var i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) % 997;
    placeholder.dataset.tone = String(seed % 4);

    var top = document.createElement("span");
    top.className = "character-portrait-topline";
    top.textContent = "CHARACTER ARCHIVE";
    top.setAttribute("aria-hidden", "true");

    var initials = document.createElement("span");
    initials.className = "character-portrait-monogram";
    initials.textContent = characterInitials(name);
    initials.setAttribute("aria-hidden", "true");

    var bottom = document.createElement("span");
    bottom.className = "character-portrait-bottomline";
    bottom.textContent = "PORTRAIT NOT AVAILABLE";
    bottom.setAttribute("aria-hidden", "true");

    placeholder.appendChild(top);
    placeholder.appendChild(initials);
    placeholder.appendChild(bottom);
    return placeholder;
  }

  function renderCharacters() {
    syncPanelContext("charactersSection");
    var section = $("charactersSection");
    var grid = $("characterGrid");
    grid.innerHTML = "";

    var chosenSeries = seriesContext().seriesId;
    var characters = state.data.characters
      .filter(function (item) { return !chosenSeries || item.seriesId === chosenSeries; })
      .slice()
      .sort(sortByOrderName);

    section.dataset.hasContent = characters.length ? "true" : "false";

    characters.forEach(function (character) {
      var card = document.createElement("article");
      card.className = "character-card";

      if (character.portrait) {
        var image = document.createElement("img");
        image.className = "character-portrait";
        image.alt = (character.name || "Character") + " portrait";
        image.loading = "lazy";
        image.addEventListener("error", function () {
          if (image.parentNode !== card) return;
          // The detail interaction was bound to the original portrait element.
          // Allow the observer to attach it again to the replacement.
          card.dataset.characterDetailReady = "false";
          image.replaceWith(characterPortraitPlaceholder(character));
        });
        card.appendChild(image);
        image.src = mediaUrl(character.portrait);
      } else {
        card.appendChild(characterPortraitPlaceholder(character));
      }

      var name = document.createElement("h3");
      name.textContent = character.name || "Unnamed";
      card.appendChild(name);

      var metaText = chosenSeries
        ? (subseriesById(character.subseriesId) || {}).name || ""
        : characterMeta(character);
      if (metaText) {
        var meta = document.createElement("p");
        meta.className = "character-meta";
        meta.textContent = metaText;
        card.appendChild(meta);
      }

      if (character.bio) {
        var bio = document.createElement("p");
        bio.className = "character-bio";
        bio.textContent = character.bio;
        card.appendChild(bio);
      }

      grid.appendChild(card);
    });
  }

  var activeWorldCategory = "";

  function archiveViewFromUrl() {
    var view = new URLSearchParams(window.location.search).get("view") || "stories";
    return ["stories", "characters", "world", "timeline"].includes(view)
      ? view
      : "stories";
  }

  function archiveViewLabel(view) {
    return {
      stories: "Stories",
      characters: "Characters",
      world: "World",
      timeline: "Timeline",
    }[view] || "Stories";
  }

  function setArchiveView(view, pushHistory) {
    var next = ["stories", "characters", "world", "timeline"].includes(view)
      ? view
      : "stories";
    // Tab switching must preserve the selected Book's theme.
    document.querySelectorAll("[data-archive-view]").forEach(function (button) {
      var active = button.getAttribute("data-archive-view") === next;
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    var activePanel = null;
    document.querySelectorAll("[data-archive-panel]").forEach(function (panel) {
      var active = panel.getAttribute("data-archive-panel") === next;
      panel.hidden = !active;
      if (active) activePanel = panel;
    });

    var hasContent = activePanel && activePanel.dataset.hasContent !== "false";
    var empty = $("emptyState");
    var emptyText = $("emptyStateText");

    if (empty) empty.hidden = Boolean(hasContent);
    if (emptyText) {
      emptyText.textContent =
        next === "characters"
            ? "No characters yet."
            : next === "timeline"
              ? "No stories have Timeline metadata yet."
              : next === "world"
                ? "No World entries yet."
                : "Nothing published here yet.";
    }

    if (pushHistory) {
      var selected = seriesContext().seriesId;
      var params = new URLSearchParams();
      if (selected) params.set("series", selected);
      // Preserve the current Book for Characters, World and Timeline too.
      if (selected && seriesContext().bookId) params.set("book", seriesContext().bookId);
      if (next !== "stories") params.set("view", next);
      history.pushState({}, "", "read" + (params.toString() ? "?" + params.toString() : ""));
    }

    document.title = archiveViewLabel(next) + " — Archive";
  }

  function worldCategoryLabel(value) {
    return {
      locations: "Locations",
      organizations: "Organizations",
      events: "Events",
      objects: "Objects",
      terms: "Terms",
    }[value] || "World";
  }

  function worldEntryMatches(entry, needle) {
    if (!needle) return true;

    var relatedCharacters = (entry.relatedCharacterIds || [])
      .map(characterById)
      .filter(Boolean)
      .map(function (character) {
        return character.name || "";
      });

    var relatedStories = (entry.relatedStoryIds || [])
      .map(storyById)
      .filter(Boolean)
      .map(function (story) {
        return story.title || "";
      });

    return [
      entry.name,
      entry.description,
      worldCategoryLabel(entry.category),
    ]
      .concat(relatedCharacters, relatedStories)
      .join(" ")
      .toLowerCase()
      .includes(needle);
  }

  function renderWorldEntry(entry) {
    var article = document.createElement("article");
    article.className = "world-entry";

    if (entry.image) {
      var media = document.createElement("div");
      media.className = "world-entry-media";

      var image = document.createElement("img");
      image.src = mediaUrl(entry.image);
      image.alt = entry.name || "World image";
      image.loading = "lazy";
      media.appendChild(image);
      article.appendChild(media);
    }

    var copy = document.createElement("div");
    copy.className = "world-entry-copy";

    var title = document.createElement("h4");
    title.textContent = entry.name || "Untitled";
    copy.appendChild(title);

    if (entry.description) {
      var description = document.createElement("p");
      description.className = "world-entry-description";
      description.textContent = entry.description;
      copy.appendChild(description);
    }

    var relatedCharacters = (entry.relatedCharacterIds || [])
      .map(characterById)
      .filter(Boolean);
    var relatedStories = (entry.relatedStoryIds || [])
      .map(storyById)
      .filter(Boolean);

    if (relatedCharacters.length || relatedStories.length) {
      var related = document.createElement("div");
      related.className = "world-related";

      var label = document.createElement("span");
      label.className = "world-related-label";
      label.textContent = "Related";
      related.appendChild(label);

      relatedCharacters.forEach(function (character) {
        var chip = document.createElement("span");
        chip.className = "world-related-chip";
        chip.textContent = character.name || "Character";
        related.appendChild(chip);
      });

      relatedStories.forEach(function (story) {
        var link = document.createElement("a");
        link.className = "world-related-chip";
        link.href = storyUrl(story.slug);
        link.textContent = story.title || "Story";
        related.appendChild(link);
      });

      copy.appendChild(related);
    }

    article.appendChild(copy);
    return article;
  }

  function showWorldEntries(category, needle) {
    var categoryGrid = $("worldCategoryGrid");
    var view = $("worldEntriesView");
    var host = $("worldEntriesList");
    var title = $("worldViewTitle");

    activeWorldCategory = category || "";
    host.innerHTML = "";

    var query = String(needle || "").trim().toLowerCase();
    var items = state.data.worldEntries
      .filter(function (entry) {
        var categoryMatch =
          category === "__search__" || !category || entry.category === category;
        return categoryMatch && worldBelongsToSeries(entry) && worldEntryMatches(entry, query);
      })
      .slice()
      .sort(sortByOrderName);

    title.textContent =
      category === "__search__"
        ? "Search results"
        : category ? worldCategoryLabel(category) : "All entries";
    categoryGrid.querySelectorAll(".world-category-card").forEach(function (button) {
      button.setAttribute("aria-pressed",
        button.dataset.category === (category === "__search__" ? "" : category) ? "true" : "false");
    });

    items.forEach(function (entry) {
      host.appendChild(renderWorldEntry(entry));
    });

    categoryGrid.hidden = false;
    view.hidden = false;

    var empty = $("emptyState");
    if (empty && archiveViewFromUrl() === "world") {
      empty.hidden = items.length > 0;
    }
  }

  function showWorldCategories() {
    activeWorldCategory = "";
    $("worldCategoryGrid").hidden = false;
    var input = $("worldSearchInput");
    if (input && input.value) input.value = "";
    showWorldEntries("", "");
  }

  function worldBelongsToSeries(entry) {
    var chosen = seriesContext().seriesId;
    if (!chosen) return true;
    if (entry.seriesId) return entry.seriesId === chosen;
    return (entry.relatedStoryIds || []).some(function (id) {
      var story = storyById(id);
      return story && story.seriesId === chosen;
    }) || (entry.relatedCharacterIds || []).some(function (id) {
      var character = characterById(id);
      return character && character.seriesId === chosen;
    });
  }

  function renderWorld() {
    syncPanelContext("worldSection");
    var section = $("worldSection");
    var host = $("worldCategoryGrid");
    host.innerHTML = "";
    activeWorldCategory = "";

    var categories = [
      "",
      "locations",
      "organizations",
      "events",
      "objects",
      "terms",
    ];

    categories.forEach(function (category) {
      var items = state.data.worldEntries.filter(function (entry) {
        return (!category || entry.category === category) && worldBelongsToSeries(entry);
      });

      var card = document.createElement("button");
      card.type = "button";
      card.className = "world-category-card";
      card.dataset.category = category;
      card.setAttribute("aria-pressed", category ? "false" : "true");
      card.disabled = !items.length;

      var label = document.createElement("strong");
      label.textContent = category ? worldCategoryLabel(category) : "All";

      var count = document.createElement("span");
      count.textContent = String(items.length).padStart(2, "0");

      var arrow = document.createElement("span");
      arrow.className = "world-category-arrow";
      arrow.textContent = "";

      card.appendChild(label);
      card.appendChild(count);
      card.appendChild(arrow);

      card.addEventListener("click", function () {
        if (items.length) showWorldEntries(category, "");
      });

      host.appendChild(card);
    });

    host.hidden = false;
    section.dataset.hasContent = state.data.worldEntries.some(worldBelongsToSeries) ? "true" : "false";
    showWorldEntries("", "");
  }

  function filterWorld(value) {
    var needle = String(value || "").trim().toLowerCase();

    if (!needle) {
      if (activeWorldCategory && activeWorldCategory !== "__search__") {
        showWorldEntries(activeWorldCategory, "");
      } else {
        showWorldCategories();
      }
      return;
    }

    showWorldEntries("__search__", needle);
  }

  function renderTimeline() {
    syncPanelContext("timelineSection");
    var section = $("timelineSection");
    var host = $("timelineList");
    host.innerHTML = "";

    var stories = state.data.stories
      .filter(function (story) {
        return (
          story &&
          (!seriesContext().seriesId || story.seriesId === seriesContext().seriesId) &&
          story.timelineEnabled === true &&
          String(story.timelineLabel || "").trim()
        );
      })
      .slice()
      .sort(function (a, b) {
        var order = Number(a.timelineOrder || 0) - Number(b.timelineOrder || 0);
        return order || sortStories(a, b);
      });

    var lastGroup = null;

    stories.forEach(function (story) {
      var group = String(story.timelineGroup || "").trim();

      if (group && group !== lastGroup) {
        var groupHeading = document.createElement("div");
        groupHeading.className = "timeline-group-heading";
        groupHeading.textContent = group;
        host.appendChild(groupHeading);
      }
      lastGroup = group;

      var row = document.createElement("article");
      row.className = "timeline-entry";

      var label = document.createElement("div");
      label.className = "timeline-label";
      label.textContent = story.timelineLabel;

      var copy = document.createElement("div");
      copy.className = "timeline-copy";

      var title = document.createElement("h3");
      var link = document.createElement("a");
      link.href = storyUrl(story.slug);
      link.textContent = story.title || "Untitled";
      title.appendChild(link);

      var meta = document.createElement("p");
      meta.className = "timeline-meta";
      var series = seriesById(story.seriesId);
      var subseries = subseriesById(story.subseriesId);
      meta.textContent = [series && series.name, subseries && subseries.name]
        .filter(Boolean)
        .join(" / ");

      copy.appendChild(title);
      if (meta.textContent) copy.appendChild(meta);

      if (story.synopsis) {
        var synopsis = document.createElement("p");
        synopsis.className = "timeline-synopsis";
        synopsis.textContent = story.synopsis;
        copy.appendChild(synopsis);
      }

      row.appendChild(label);
      row.appendChild(copy);
      host.appendChild(row);
    });

    section.dataset.hasContent = stories.length ? "true" : "false";
  }


  function renderHome() {
    $("libraryHome").hidden = false;
    $("storyView").hidden = true;
    if (window.ArchiveSeriesPostersReader) window.ArchiveSeriesPostersReader.stopAll();
    if (window.ArchiveSeriesBooksReader) window.ArchiveSeriesBooksReader.stopAll();
    var context = seriesContext();
    var hasSeries = state.data.series.some(function (item) { return String(item.id) === context.seriesId; });
    document.body.dataset.readerLevel = hasSeries ? "series" : "selector";
    var chosenBook = hasSeries && state.data.subseries.some(function (item) {
      return String(item.id) === context.bookId && item.seriesId === context.seriesId;
    });
    document.body.dataset.readerScope = chosenBook ? "book" : hasSeries ? "series" : "selector";
    var tab = document.querySelector('[data-archive-view="stories"]');
    if (tab) tab.textContent = chosenBook ? "Chapters" : "Series";
    $("archiveSectionNav").hidden = !hasSeries;
    var hasBreadcrumb = renderBreadcrumb("readerHierarchyNav", hasSeries ? context.seriesId : "", chosenBook ? context.bookId : "", "");
    $("libraryHome").classList.toggle("has-reader-breadcrumb", hasBreadcrumb);

    renderSeries();
    renderCharacters();
    renderWorld();
    renderTimeline();

    $("seriesSection").dataset.hasContent =
      state.data.stories.length > 0 ? "true" : "false";

    setArchiveView(hasSeries ? archiveViewFromUrl() : "stories", false);
    if (window.EditorialReading) window.EditorialReading.renderHome(state.data);
  }

  function renderStoryCharacters(story) {
    var host = $("storyCharacters");
    host.innerHTML = "";

    var characters = (story.characterIds || [])
      .map(characterById)
      .filter(Boolean);

    if (!characters.length) {
      host.hidden = true;
      return;
    }

    characters.forEach(function (character) {
      var chip = document.createElement("div");
      chip.className = "story-character-chip";

      if (character.portrait) {
        var image = document.createElement("img");
        image.src = mediaUrl(character.portrait);
        image.alt = "";
        image.loading = "lazy";
        chip.appendChild(image);
      } else {
        var placeholder = document.createElement("span");
        placeholder.className = "avatar-placeholder";
        placeholder.textContent = String(character.name || "?")
          .slice(0, 1)
          .toUpperCase();
        chip.appendChild(placeholder);
      }

      var name = document.createElement("span");
      name.textContent = character.name || "Unnamed";
      chip.appendChild(name);
      host.appendChild(chip);
    });

    host.hidden = false;
  }

  function renderStoryNav(story) {
    var prev = $("prevStory");
    var next = $("nextStory");

    prev.hidden = true;
    next.hidden = true;

    var siblings = state.data.stories
      .filter(function (item) {
        if (item.seriesId !== story.seriesId) return false;

        if (story.subseriesId) {
          return item.subseriesId === story.subseriesId;
        }

        return !item.subseriesId;
      })
      .sort(sortStories);

    var index = siblings.findIndex(function (item) {
      return item.id === story.id;
    });

    if (index > 0) {
      var previous = siblings[index - 1];
      prev.href = storyUrl(previous.slug);
      prev.textContent = "← " + previous.title;
      prev.hidden = false;
    }

    if (index >= 0 && index < siblings.length - 1) {
      var following = siblings[index + 1];
      next.href = storyUrl(following.slug);
      next.textContent = following.title + " →";
      next.hidden = false;
    }

    $("storyNav").hidden = prev.hidden && next.hidden;
  }

  function renderStory(story) {
    document.body.dataset.readerScope = "chapter";
    if (window.ArchiveSeriesPostersReader) window.ArchiveSeriesPostersReader.stopAll();
    var series = seriesById(story.seriesId);
    var subseries = subseriesById(story.subseriesId);
    // Sub-series theme paints the viewport, while its chapter paper has a separate color.
    if (window.SubseriesThemes) {
      window.SubseriesThemes.applyUi(document.body, subseries && subseries.uiTheme);
      window.SubseriesThemes.applyPaper($("chapterPaper"), subseries && subseries.paperTheme);
    }
    var path = [];

    if (series) path.push(series.name);
    if (subseries) path.push(subseries.name);

    $("storyPath").textContent = path.join(" / ");
    var chapterBreadcrumb = renderBreadcrumb("readerStoryBreadcrumb", story.seriesId, story.subseriesId, story.title || "Chapter");
    $("storyView").classList.toggle("has-reader-breadcrumb", chapterBreadcrumb);
    var back = $("readerStoryBack");
    if (back) {
      var query = new URLSearchParams();
      if (story.seriesId) query.set("series", story.seriesId);
      if (story.subseriesId) query.set("book", story.subseriesId);
      back.href = "read" + (query.toString() ? "?" + query.toString() : "");
    }
    $("storyTitle").textContent = story.title || "Untitled";
    var dateText = formatDate(story.date);
    var mins = readingMinutes(story);
    $("storyDate").textContent =
      (dateText ? dateText + " · " : "") + mins + " min read";

    // Content warning, when the author set one.
    var cwHost = $("storyContentWarning");
    if (cwHost) {
      var cwText = String(story.contentWarning || "").trim();
      cwHost.hidden = !cwText;
      if (cwText) {
        cwHost.innerHTML = "";
        var cwLabel = document.createElement("strong");
        cwLabel.textContent = "Content warning: ";
        cwHost.appendChild(cwLabel);
        cwHost.appendChild(document.createTextNode(cwText));
      }
    }

    // Banners are temporarily removed from the reader. Keep old uploads and metadata.
    var storyBanner = $("storyBanner");
    if (storyBanner) {
      storyBanner.hidden = true;
      storyBanner.removeAttribute("src");
    }

    renderStoryBody(story.body || "");

    // Screenplay stories get script typography (see css/thoughts-screenplay.css).
    // Stories without a format field default to prose.
    var isScreenplay = story.format === "screenplay";
    var bodyHost = $("storyBody");
    if (bodyHost) bodyHost.classList.toggle("is-screenplay", isScreenplay);
    document.body.dataset.storyFormat = isScreenplay ? "screenplay" : "prose";

    renderStoryCharacters(story);
    renderStoryNav(story);

    $("libraryHome").hidden = true;
    $("storyView").hidden = false;
    if (window.EditorialReading) window.EditorialReading.renderStory(story);
    document.title = (story.title || "Story") + " — Stories";
  }

  function renderLibrary() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get("story");

    if (!slug) {
      renderHome();
      return;
    }

    var story = state.data.stories.find(function (item) {
      return item.slug === slug;
    });

    if (!story) {
      renderHome();
      return;
    }

    renderStory(story);
  }

  function showGate(message) {
    $("readerAuthLoading").hidden = true;
    if (window.SubseriesThemes) window.SubseriesThemes.applyUi(document.body, null);
    document.body.classList.add("is-locked");
    $("accessGate").hidden = false;
    $("libraryApp").hidden = true;
    $("lockButton").hidden = true;
    $("gateStatus").textContent = message || "";
    $("accessCodeInput").value = "";
    $("readerLoadRetry").hidden = true;
    if (window.ReaderEntrance) window.ReaderEntrance.setDestination("gate");
    if (!window.ReaderEntrance || !window.ReaderEntrance.isBlocking()) {
      $("accessCodeInput").focus();
    }
    document.title = "Stories";
  }

  function showLibrary() {
    $("readerAuthLoading").hidden = true;
    document.body.classList.remove("is-locked");
    $("accessGate").hidden = true;
    $("libraryApp").hidden = false;
    $("lockButton").hidden = false;
    $("gateStatus").textContent = "";
    $("readerLoadRetry").hidden = true;
    if (window.ReaderEntrance) window.ReaderEntrance.setDestination("library");
  }

  function normalizeReaderData(data) {
    var source = data || {};
    return {
      series: Array.isArray(source.series) ? source.series : [],
      subseries: Array.isArray(source.subseries) ? source.subseries : [],
      characters: Array.isArray(source.characters) ? source.characters : [],
      stories: Array.isArray(source.stories) ? source.stories : [],
      worldEntries: Array.isArray(source.worldEntries) ? source.worldEntries : [],
      galleryItems: Array.isArray(source.galleryItems) ? source.galleryItems : [],
    };
  }

  var readerRefreshPromise = null;
  var readerLastRefreshAttempt = 0;
  var readerUpdatePending = false;
  function refreshReaderContent(force) {
    if (document.hidden || document.body.classList.contains("is-locked") ||
        $("libraryApp").hidden) return Promise.resolve();
    if (readerRefreshPromise) return readerRefreshPromise;
    if (!force && Date.now() - readerLastRefreshAttempt < 12000) return Promise.resolve();
    readerLastRefreshAttempt = Date.now();
    var refreshTask = apiJson(API.content, { cache: "no-store" })
      .then(function (result) {
        if (document.body.classList.contains("is-locked")) return;
        var next = normalizeReaderData(result.data);
        // Most focus/visibility changes should not rerender or reset reading position.
        if (JSON.stringify(state.data) === JSON.stringify(next)) {
          readerUpdatePending = false;
          return;
        }
        var y = window.scrollY;
        state.data = next;
        readerUpdatePending = false;
        renderLibrary();
        window.scrollTo(0, y);
      })
      .catch(function (error) {
        if (error && error.status === 401) showGate("Reader session expired. Enter the access code again.");
        // Network errors are non-destructive: keep displaying the last good data.
      })
      .finally(function () { readerRefreshPromise = null; });
    readerRefreshPromise = window.ReaderMotionLoader
      ? window.ReaderMotionLoader.track(refreshTask, "Refreshing library…", true)
      : refreshTask;
    return readerRefreshPromise;
  }

  function loadLibrary() {
    return apiJson(API.content, { cache: "no-store" })
      .then(function (result) {
        state.data = normalizeReaderData(result.data);
        readerUpdatePending = false;
        readerLastRefreshAttempt = Date.now();
        showLibrary();
        renderLibrary();
      })
      .catch(function (error) {
        if (error.status === 401) {
          showGate();
          return;
        }

        showGate("Could not load archive data. Your login is still valid — retry without entering a password.");
        $("readerLoadRetry").hidden = false;
      });
  }

  function unlock() {
    var code = $("accessCodeInput").value;
    var button = $("unlockButton");

    if (!code) {
      $("gateStatus").textContent = "Enter the access code.";
      return;
    }

    button.disabled = true;
    $("gateStatus").textContent = "Checking…";

    var unlockTask = apiJson(API.auth, {
      method: "POST",
      body: JSON.stringify({ action: "unlock", code: code }),
    })
      .then(function () {
        $("accessCodeInput").value = "";
        return loadLibrary();
      })
      .catch(function (error) {
        $("gateStatus").textContent = error.message || "Wrong access code.";
      })
      .finally(function () {
        button.disabled = false;
      });
    if (window.ReaderMotionLoader) window.ReaderMotionLoader.track(unlockTask, "Opening library…");
  }

  function lock() {
    apiJson(API.auth, {
      method: "POST",
      body: JSON.stringify({ action: "lock" }),
    })
      .catch(function () {
        return null;
      })
      .finally(function () {
        state.data = {
          series: [],
          subseries: [],
          characters: [],
          stories: [],
          worldEntries: [],
          galleryItems: [],
        };
        history.replaceState({}, "", "read");
        showGate();
      });
  }

  function checkSession() {
    $("gateStatus").textContent = "";

    var sessionTask = apiJson(API.auth)
      .then(function (result) {
        if (!result.configured) {
          showGate("Reader access is not configured yet.");
          $("unlockButton").disabled = true;
          return;
        }

        if (!result.authenticated) {
          showGate();
          return;
        }

        return loadLibrary();
      })
      .catch(function () {
        showGate("Could not check access. Please retry.");
        $("readerLoadRetry").hidden = false;
      });
    // The entrance owns initial loading, preventing a second spinner overlay.
    return sessionTask;
  }

  // Internal chapter links and Back navigation keep the loaded authenticated app alive.
  // Passwords are never cached: the secure reader session cookie remains authoritative.
  function handleArchiveLink(event) {
    if (event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        document.body.classList.contains("is-locked")) return;
    var target = event.target;
    var link = target && target.closest ? target.closest("a[href]") : null;
    if (!link || !$("libraryApp").contains(link) ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")) return;
    var dest;
    try {
      dest = new URL(link.href, window.location.href);
    } catch (_) { return; }
    if (dest.origin !== window.location.origin ||
        !["/read", "/read/", "/thoughts", "/thoughts/"].includes(dest.pathname)) return;
    event.preventDefault();
    var path = dest.pathname + dest.search + dest.hash;
    if (path !== window.location.pathname + window.location.search + window.location.hash) {
      history.pushState({}, "", path);
    }
    renderLibrary();
    window.scrollTo(0, 0);
  }

  function wire() {
    setupThemeSwitch();
    document.addEventListener("click", handleArchiveLink);

    $("unlockButton").addEventListener("click", unlock);
    $("readerLoadRetry").addEventListener("click", function () { $("readerLoadRetry").hidden = true; checkSession(); });
    $("accessCodeInput").addEventListener("keydown", function (event) {
      if (event.key === "Enter") unlock();
    });
    $("lockButton").addEventListener("click", lock);

    document.querySelectorAll("[data-archive-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        setArchiveView(button.getAttribute("data-archive-view"), true);
      });
    });

    var worldSearch = $("worldSearchInput");
    if (worldSearch) {
      worldSearch.addEventListener("input", function () {
        filterWorld(worldSearch.value);
      });
    }

    $("worldBackButton").addEventListener("click", showWorldCategories);

    window.addEventListener("popstate", function () {
      renderLibrary();
    });

    // Revalidate when returning from Story Admin, without a page reload or password prompt.
    window.addEventListener("focus", function () {
      refreshReaderContent(false);
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshReaderContent(readerUpdatePending);
    });
    window.addEventListener("storage", function (event) {
      if (event.key === "thoughts_reader_content_updated") {
        readerUpdatePending = true;
        refreshReaderContent(true);
      }
    });
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) refreshReaderContent(true);
    });

    checkSession();
  }

  document.addEventListener("DOMContentLoaded", wire);

  // Public read API for companion modules (e.g. the @-mention dialog).
  window.ThoughtsReader = {
    characterById: characterById,
    worldEntryById: function (id) {
      return (state.data.worldEntries || []).find(function (item) {
        return String(item.id) === String(id);
      });
    },
    seriesById: seriesById,
    subseriesById: subseriesById,
    mediaUrl: mediaUrl
  };
})();
