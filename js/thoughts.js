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

      row.appendChild(order);
      row.appendChild(titleStack);
      row.appendChild(time);
      list.appendChild(row);
    });

    return list;
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
  function renderSeriesNavigator() {
    var host = $("seriesList");
    host.innerHTML = "";
    if (window.SubseriesThemes) window.SubseriesThemes.applyUi(document.body, null);
    var context = seriesContext();
    var series = state.data.series.find(function (s) { return String(s.id) === context.seriesId; });
    var stories = state.data.stories || [];
    if (!series) {
      var seriesGrid = document.createElement("div");
      seriesGrid.className = "reader-series-grid";
      state.data.series.slice().sort(sortByOrderName).forEach(function (item) {
        var count = stories.filter(function (story) { return story.seriesId === item.id; }).length;
        seriesGrid.appendChild(window.ArchiveSeriesPostersReader.create(item, count, function () {
          goToCollection(item.id, "", "stories");
        }, mediaUrl));
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
      var shortcuts = document.createElement("div");
      shortcuts.className = "archive-hierarchy-quicklinks";
      [["characters", "Meet the characters"], ["world", "Explore the world"], ["timeline", "Timeline"]].forEach(function (item) {
        var button = document.createElement("button"); button.type = "button";
        button.textContent = item[1];
        button.addEventListener("click", function () { goToCollection(series.id, "", item[0]); });
        shortcuts.appendChild(button);
      });
      host.appendChild(shortcuts);
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
      host.appendChild(bookGrid);
      var standalones = stories.filter(function (story) { return story.seriesId === series.id && !story.subseriesId; });
      if (standalones.length) {
        archiveHeading(host, "", "Standalone chapters", "");
        host.appendChild(createStoryList(standalones));
      }
      return;
    }
    var chapters = stories.filter(function (story) { return story.subseriesId === book.id && story.seriesId === series.id; });
    var wrapper = document.createElement("div");
    wrapper.className = "archive-hierarchy-chapters";
    wrapper.appendChild(createStoryList(chapters));
    host.appendChild(wrapper);
  }

  function renderSeries() {
    renderSeriesNavigator();
    return;
    var host = $("seriesList");
    host.innerHTML = "";

    var stories = state.data.stories || [];
    var seriesItems = state.data.series.slice().sort(sortByOrderName);

    seriesItems.forEach(function (series) {
      var directStories = stories.filter(function (story) {
        return story.seriesId === series.id && !story.subseriesId;
      });

      var subseriesItems = state.data.subseries
        .filter(function (subseries) {
          return subseries.seriesId === series.id;
        })
        .sort(sortByOrderName);

      var hasNestedStories = subseriesItems.some(function (subseries) {
        return stories.some(function (story) {
          return story.subseriesId === subseries.id;
        });
      });

      if (!directStories.length && !hasNestedStories) return;

      var block = document.createElement("section");
      block.className = "series-block";

      var totalStories = stories.filter(function (story) {
        return story.seriesId === series.id;
      }).length;

      var titleRow = document.createElement("div");
      titleRow.className = "series-title-row";

      var title = document.createElement("h3");
      title.className = "series-title";
      title.textContent = series.name || "Untitled series";

      var seriesCollapseButton = createArchiveCollapseButton(
        block,
        "series",
        series.id,
        series.name || "Series",
        false
      );

      var count = document.createElement("span");
      count.className = "series-meta";
      count.textContent =
        totalStories + (totalStories === 1 ? " story" : " stories");

      titleRow.appendChild(seriesCollapseButton);
      titleRow.appendChild(title);
      titleRow.appendChild(count);

      if (series.banner) {
        block.classList.add("has-cinematic-banner");

        var seriesBannerShell = document.createElement("div");
        seriesBannerShell.className = "archive-banner-shell series-banner-shell";

        var seriesBanner = document.createElement("img");
        seriesBanner.className = "series-banner";
        seriesBanner.src = mediaUrl(series.banner);
        seriesBanner.alt = "";
        seriesBanner.loading = "lazy";

        var seriesCaption = document.createElement("div");
        seriesCaption.className = "archive-banner-caption";

        var seriesBannerMeta = document.createElement("span");
        seriesBannerMeta.className = "archive-banner-meta";
        seriesBannerMeta.textContent =
          totalStories + (totalStories === 1 ? " story" : " stories");

        seriesCaption.appendChild(seriesBannerMeta);
        seriesBannerShell.appendChild(seriesBanner);
        seriesBannerShell.appendChild(seriesCaption);

        seriesBanner.addEventListener("error", function () {
          block.classList.remove("has-cinematic-banner");
          seriesBannerShell.remove();
        });

        block.appendChild(seriesBannerShell);
      }

      var seriesDescription = null;
      if (series.description) {
        seriesDescription = document.createElement("p");
        seriesDescription.className = "series-description";
        seriesDescription.textContent = series.description;
      }

      if (series.cover) {
        block.classList.add("has-book-cover");

        var seriesLayout = document.createElement("div");
        seriesLayout.className = "archive-book-layout series-book-layout";

        var seriesCopy = document.createElement("div");
        seriesCopy.className = "archive-book-copy";
        seriesCopy.appendChild(titleRow);
        if (seriesDescription) seriesCopy.appendChild(seriesDescription);

        var seriesToggle = createArchiveFocusToggle(
          seriesLayout,
          "series",
          series.id
        );
        var seriesCover = createBookCover(
          series,
          series.name || "Series",
          seriesLayout,
          seriesToggle
        );

        seriesLayout.appendChild(seriesToggle);
        seriesLayout.appendChild(seriesCopy);
        seriesLayout.appendChild(seriesCover);
        block.appendChild(seriesLayout);

        applyArchiveFocusMode(
          seriesLayout,
          "series",
          series.id,
          getArchiveFocusMode("series", series.id)
        );
      } else {
        block.appendChild(titleRow);
        if (seriesDescription) block.appendChild(seriesDescription);
      }

      if (directStories.length) {
        block.appendChild(createStoryList(directStories));
      }

      subseriesItems.forEach(function (subseries) {
        var nestedStories = stories.filter(function (story) {
          return story.subseriesId === subseries.id;
        });

        if (!nestedStories.length) return;

        var nested = document.createElement("section");
        nested.className = "subseries-block";

        var nestedTitleRow = document.createElement("div");
        nestedTitleRow.className = "archive-subseries-title-row";

        var nestedTitle = document.createElement("h4");
        nestedTitle.className = "subseries-title";
        nestedTitle.textContent = subseries.name || "Untitled sub-series";

        var nestedCollapseButton = createArchiveCollapseButton(
          nested,
          "subseries",
          subseries.id,
          subseries.name || "Sub-series",
          false
        );

        nestedTitleRow.appendChild(nestedCollapseButton);
        nestedTitleRow.appendChild(nestedTitle);

        if (subseries.banner) {
          nested.classList.add("has-cinematic-banner");

          var subseriesBannerShell = document.createElement("div");
          subseriesBannerShell.className =
            "archive-banner-shell subseries-banner-shell";

          var subseriesBanner = document.createElement("img");
          subseriesBanner.className = "subseries-banner";
          subseriesBanner.src = mediaUrl(subseries.banner);
          subseriesBanner.alt = "";
          subseriesBanner.loading = "lazy";

          var subseriesCaption = document.createElement("div");
          subseriesCaption.className = "archive-banner-caption";

          var subseriesBannerMeta = document.createElement("span");
          subseriesBannerMeta.className = "archive-banner-meta";
          subseriesBannerMeta.textContent =
            nestedStories.length +
            (nestedStories.length === 1 ? " story" : " stories");

          subseriesCaption.appendChild(subseriesBannerMeta);
          subseriesBannerShell.appendChild(subseriesBanner);
          subseriesBannerShell.appendChild(subseriesCaption);

          subseriesBanner.addEventListener("error", function () {
            nested.classList.remove("has-cinematic-banner");
            subseriesBannerShell.remove();
          });

          nested.appendChild(subseriesBannerShell);
        }

        var nestedDescription = null;
        if (subseries.description) {
          nestedDescription = document.createElement("p");
          nestedDescription.className = "subseries-description";
          nestedDescription.textContent = subseries.description;
        }

        if (subseries.cover) {
          nested.classList.add("has-book-cover");

          var nestedLayout = document.createElement("div");
          nestedLayout.className = "archive-book-layout subseries-book-layout";

          var nestedCopy = document.createElement("div");
          nestedCopy.className = "archive-book-copy";
          nestedCopy.appendChild(nestedTitleRow);
          if (nestedDescription) nestedCopy.appendChild(nestedDescription);

          var nestedToggle = createArchiveFocusToggle(
            nestedLayout,
            "subseries",
            subseries.id
          );
          var nestedCover = createBookCover(
            subseries,
            subseries.name || "Sub-series",
            nestedLayout,
            nestedToggle
          );

          nestedLayout.appendChild(nestedToggle);
          nestedLayout.appendChild(nestedCopy);
          nestedLayout.appendChild(nestedCover);
          nested.appendChild(nestedLayout);

          applyArchiveFocusMode(
            nestedLayout,
            "subseries",
            subseries.id,
            getArchiveFocusMode("subseries", subseries.id)
          );
        } else {
          nested.appendChild(nestedTitleRow);
          if (nestedDescription) nested.appendChild(nestedDescription);
        }

        nested.appendChild(createStoryList(nestedStories));
        setArchiveCollapsed(
          nested,
          "subseries",
          subseries.id,
          getArchiveCollapsed("subseries", subseries.id)
        );
        block.appendChild(nested);
      });

      setArchiveCollapsed(
        block,
        "series",
        series.id,
        getArchiveCollapsed("series", series.id)
      );
      host.appendChild(block);
    });
  }

  function characterMeta(character) {
    var series = seriesById(character.seriesId);
    var subseries = subseriesById(character.subseriesId);
    var parts = [];

    if (series) parts.push(series.name);
    if (subseries) parts.push(subseries.name);

    return parts.join(" / ");
  }

  function renderCharacters() {
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
        image.src = mediaUrl(character.portrait);
        image.alt = (character.name || "Character") + " portrait";
        image.loading = "lazy";
        card.appendChild(image);
      } else {
        var placeholder = document.createElement("div");
        placeholder.className = "character-portrait-placeholder";
        placeholder.textContent = characterInitials(character.name);
        placeholder.setAttribute("aria-label", "No portrait uploaded");
        card.appendChild(placeholder);
      }

      var name = document.createElement("h3");
      name.textContent = character.name || "Unnamed";
      card.appendChild(name);

      var metaText = characterMeta(character);
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
  var galleryAlbums = [];

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
        ? "Search"
        : worldCategoryLabel(category);

    items.forEach(function (entry) {
      host.appendChild(renderWorldEntry(entry));
    });

    categoryGrid.hidden = true;
    view.hidden = false;

    var empty = $("emptyState");
    if (empty && archiveViewFromUrl() === "world") {
      empty.hidden = items.length > 0;
    }
  }

  function showWorldCategories() {
    activeWorldCategory = "";
    $("worldCategoryGrid").hidden = false;
    $("worldEntriesView").hidden = true;

    var input = $("worldSearchInput");
    if (input && input.value) input.value = "";

    var section = $("worldSection");
    if ($("emptyState") && archiveViewFromUrl() === "world") {
      $("emptyState").hidden = section.dataset.hasContent !== "false";
    }
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
    var section = $("worldSection");
    var host = $("worldCategoryGrid");
    host.innerHTML = "";
    activeWorldCategory = "";

    var categories = [
      "locations",
      "organizations",
      "events",
      "objects",
      "terms",
    ];

    categories.forEach(function (category) {
      var items = state.data.worldEntries.filter(function (entry) {
        return entry.category === category && worldBelongsToSeries(entry);
      });

      var card = document.createElement("button");
      card.type = "button";
      card.className = "world-category-card";
      card.disabled = !items.length;

      var label = document.createElement("strong");
      label.textContent = worldCategoryLabel(category);

      var count = document.createElement("span");
      count.textContent = String(items.length).padStart(2, "0");

      var arrow = document.createElement("span");
      arrow.className = "world-category-arrow";
      arrow.textContent = "→";

      card.appendChild(label);
      card.appendChild(count);
      card.appendChild(arrow);

      card.addEventListener("click", function () {
        if (items.length) showWorldEntries(category, "");
      });

      host.appendChild(card);
    });

    $("worldEntriesView").hidden = true;
    host.hidden = false;
    section.dataset.hasContent = state.data.worldEntries.some(worldBelongsToSeries) ? "true" : "false";
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

  function galleryMedia(path, label, kind, shape, caption) {
    return {
      path: path || "",
      label: label || "Untitled",
      kind: kind || "Archive",
      shape: shape || "wide",
      caption: caption || "",
    };
  }

  function uniqueGalleryMedia(items) {
    var seen = new Set();
    return items.filter(function (item) {
      if (!item.path || seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });
  }

  function buildGalleryAlbums() {
    var albums = [];

    var covers = [];
    state.data.series.forEach(function (series) {
      if (series.cover) {
        covers.push(
          galleryMedia(series.cover, series.name, "Series cover", "portrait", "")
        );
      }
    });
    state.data.subseries.forEach(function (subseries) {
      if (subseries.cover) {
        covers.push(
          galleryMedia(
            subseries.cover,
            subseries.name,
            "Sub-series cover",
            "portrait",
            ""
          )
        );
      }
    });
    covers = uniqueGalleryMedia(covers);
    if (covers.length) {
      albums.push({ id: "covers", title: "Covers", type: "Archive", items: covers });
    }

    var banners = [];
    state.data.series.forEach(function (series) {
      if (series.banner) {
        banners.push(
          galleryMedia(series.banner, series.name, "Series banner", "wide", "")
        );
      }
    });
    state.data.subseries.forEach(function (subseries) {
      if (subseries.banner) {
        banners.push(
          galleryMedia(
            subseries.banner,
            subseries.name,
            "Sub-series banner",
            "wide",
            ""
          )
        );
      }
    });
    state.data.stories.forEach(function (story) {
      if (story.banner) {
        banners.push(
          galleryMedia(story.banner, story.title, "Story header", "wide", "")
        );
      }
    });
    state.data.galleryItems
      .filter(function (item) {
        return item.category === "banner";
      })
      .sort(function (a, b) {
        return Number(a.order || 0) - Number(b.order || 0);
      })
      .forEach(function (item) {
        banners.push(
          galleryMedia(
            item.image,
            item.title || "Banner",
            "Banner",
            "wide",
            item.caption || ""
          )
        );
      });
    banners = uniqueGalleryMedia(banners);
    // Legacy banner gallery is hidden for now; stored artwork is untouched.

    ["poster", "artwork"].forEach(function (category) {
      var items = state.data.galleryItems
        .filter(function (item) {
          return item.category === category;
        })
        .slice()
        .sort(function (a, b) {
          return Number(a.order || 0) - Number(b.order || 0);
        })
        .map(function (item) {
          return galleryMedia(
            item.image,
            item.title || (category === "poster" ? "Poster" : "Artwork"),
            category === "poster" ? "Poster" : "Artwork",
            category === "poster" ? "poster" : "wide",
            item.caption || ""
          );
        });

      items = uniqueGalleryMedia(items);
      if (items.length) {
        albums.push({
          id: category === "poster" ? "posters" : "artwork",
          title: category === "poster" ? "Posters" : "Artwork",
          type: "Archive",
          items: items,
        });
      }
    });

    return albums;
  }

  function renderGalleryItem(item) {
    var figure = document.createElement("figure");
    figure.className = "gallery-item";
    figure.dataset.shape = item.shape || "wide";

    var link = document.createElement("a");
    link.href = mediaUrl(item.path);
    link.target = "_blank";
    link.rel = "noopener";

    var image = document.createElement("img");
    image.src = mediaUrl(item.path);
    image.alt = item.label || item.kind || "Archive image";
    image.loading = "lazy";
    link.appendChild(image);

    var caption = document.createElement("figcaption");

    var title = document.createElement("span");
    title.textContent = item.label || "Untitled";

    var meta = document.createElement("span");
    meta.textContent = item.kind || "Archive";

    caption.appendChild(title);
    caption.appendChild(meta);

    if (item.caption) {
      var note = document.createElement("p");
      note.className = "gallery-item-caption";
      note.textContent = item.caption;
      figure.appendChild(link);
      figure.appendChild(caption);
      figure.appendChild(note);
      return figure;
    }

    figure.appendChild(link);
    figure.appendChild(caption);
    return figure;
  }

  function openGalleryAlbum(albumId) {
    var album = galleryAlbums.find(function (item) {
      return item.id === albumId;
    });
    if (!album) return;

    var host = $("galleryGrid");
    host.innerHTML = "";

    album.items.forEach(function (item) {
      host.appendChild(renderGalleryItem(item));
    });

    $("galleryAlbumTitle").textContent = album.title;
    $("galleryAlbumGrid").hidden = true;
    $("galleryAlbumView").hidden = false;
  }

  function showGalleryAlbums() {
    $("galleryAlbumGrid").hidden = false;
    $("galleryAlbumView").hidden = true;
  }

  function renderGallery() {
    var section = $("gallerySection");
    var host = $("galleryAlbumGrid");
    host.innerHTML = "";
    galleryAlbums = buildGalleryAlbums();

    galleryAlbums.forEach(function (album) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-album-card";
      button.dataset.shape =
        album.id === "posters"
          ? "poster"
          : album.items[0] && album.items[0].shape
            ? album.items[0].shape
            : "wide";

      var media = document.createElement("span");
      media.className = "gallery-album-cover";

      var image = document.createElement("img");
      image.src = mediaUrl(album.items[0].path);
      image.alt = "";
      image.loading = "lazy";
      media.appendChild(image);

      var copy = document.createElement("span");
      copy.className = "gallery-album-copy";

      var title = document.createElement("strong");
      title.textContent = album.title;

      var meta = document.createElement("span");
      meta.textContent =
        album.type +
        " · " +
        album.items.length +
        (album.items.length === 1 ? " image" : " images");

      copy.appendChild(title);
      copy.appendChild(meta);

      button.appendChild(media);
      button.appendChild(copy);
      button.addEventListener("click", function () {
        openGalleryAlbum(album.id);
      });

      host.appendChild(button);
    });

    showGalleryAlbums();
    section.dataset.hasContent = galleryAlbums.length ? "true" : "false";
  }

  function renderHome() {
    $("libraryHome").hidden = false;
    $("storyView").hidden = true;
    if (window.ArchiveSeriesPostersReader) window.ArchiveSeriesPostersReader.stopAll();
    var context = seriesContext();
    var hasSeries = state.data.series.some(function (item) { return String(item.id) === context.seriesId; });
    document.body.dataset.readerLevel = hasSeries ? "series" : "selector";
    $("archiveSectionNav").hidden = !hasSeries;

    renderSeries();
    renderCharacters();
    renderWorld();
    renderTimeline();

    $("seriesSection").dataset.hasContent =
      state.data.stories.length > 0 ? "true" : "false";

    setArchiveView(hasSeries ? archiveViewFromUrl() : "stories", false);
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
    var back = $("readerStoryBack");
    if (back) {
      var query = new URLSearchParams();
      if (story.seriesId) query.set("series", story.seriesId);
      if (story.subseriesId) query.set("book", story.subseriesId);
      back.href = "read" + (query.toString() ? "?" + query.toString() : "");
    }
    $("storyTitle").textContent = story.title || "Untitled";
    $("storyDate").textContent = formatDate(story.date);

    // Banners are temporarily removed from the reader. Keep old uploads and metadata.
    var storyBanner = $("storyBanner");
    if (storyBanner) {
      storyBanner.hidden = true;
      storyBanner.removeAttribute("src");
    }

    renderStoryBody(story.body || "");

    renderStoryCharacters(story);
    renderStoryNav(story);

    $("libraryHome").hidden = true;
    $("storyView").hidden = false;
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
    $("accessCodeInput").focus();
    document.title = "Stories";
  }

  function showLibrary() {
    $("readerAuthLoading").hidden = true;
    document.body.classList.remove("is-locked");
    $("accessGate").hidden = true;
    $("libraryApp").hidden = false;
    $("lockButton").hidden = false;
    $("gateStatus").textContent = "";
  }

  function loadLibrary() {
    return apiJson(API.content)
      .then(function (result) {
        var data = result.data || {};
        state.data = {
          series: Array.isArray(data.series) ? data.series : [],
          subseries: Array.isArray(data.subseries) ? data.subseries : [],
          characters: Array.isArray(data.characters) ? data.characters : [],
          stories: Array.isArray(data.stories) ? data.stories : [],
          worldEntries: Array.isArray(data.worldEntries) ? data.worldEntries : [],
          galleryItems: Array.isArray(data.galleryItems) ? data.galleryItems : [],
        };

        showLibrary();
        renderLibrary();
      })
      .catch(function (error) {
        if (error.status === 401) {
          showGate();
          return;
        }

        showGate("The private archive could not be loaded right now.");
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

    apiJson(API.auth, {
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

    apiJson(API.auth)
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
        showGate("Could not check access right now.");
      });
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
    $("galleryBackButton").addEventListener("click", showGalleryAlbums);

    window.addEventListener("popstate", function () {
      renderLibrary();
    });

    checkSession();
  }

  document.addEventListener("DOMContentLoaded", wire);
})();
