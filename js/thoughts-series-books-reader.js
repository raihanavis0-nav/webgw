/* Framework-free, accessible book selector for Series. */
(function () {
  "use strict";

  var dialog = null;
  var opener = null;
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fanPositions = [
    { x: "-76%", y: "10%", r: "-23deg" },
    { x: "-39%", y: "-5%", r: "-12deg" },
    { x: "0%", y: "-12%", r: "0deg" },
    { x: "39%", y: "-5%", r: "12deg" },
    { x: "76%", y: "10%", r: "23deg" }
  ];

  function validPoster(p) {
    return p && typeof p.path === "string" &&
      /^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(png|jpg|jpeg|webp)$/i.test(p.path) &&
      !p.path.includes("..");
  }

  function validCover(path) {
    return typeof path === "string" && validPoster({ path: path });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function getCover(series, posters) {
    if (validCover(series.cover)) return { path: series.cover };
    return posters.length ? posters[0] : null;
  }

  function imageFor(poster, mediaUrl) {
    var image = el("img", "reader-book-artwork");
    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    image.src = mediaUrl(poster.path);
    var x = Number(poster.x), y = Number(poster.y), zoom = Number(poster.zoom);
    image.style.objectPosition = (Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 50) + "% " +
      (Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 50) + "%";
    image.style.transformOrigin = image.style.objectPosition;
    image.style.transform = "scale(" + (Number.isFinite(zoom) ? Math.max(100, Math.min(250, zoom)) : 100) / 100 + ")";
    return image;
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = el("dialog", "reader-book-dialog");
    dialog.id = "readerSeriesBookDialog";
    dialog.setAttribute("aria-label", "Inside the Series");
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      dialog.classList.remove("is-open");
      if (opener && opener.isConnected && !opener.closest("[hidden]")) {
        try { opener.focus({ preventScroll: true }); } catch (_) { opener.focus(); }
      }
      opener = null;
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function continueTo(callback) {
    if (dialog && dialog.open) dialog.close();
    if (typeof callback === "function") callback();
  }

  function openBook(series, cover, count, books, directStories, onSeries, onSubseries, onStory, mediaUrl, trigger) {
    var modal = ensureDialog();
    if (modal.open) modal.close();
    opener = trigger;
    modal.replaceChildren();

    var stage = el("div", "reader-book-stage");
    var close = el("button", "reader-book-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close book");
    close.addEventListener("click", function () { modal.close(); });

    var intro = el("p", "reader-book-overlay-kicker", "THE ARCHIVE / OPEN BOOK");
    var scene = el("div", "reader-book-scene");
    var spread = el("div", "reader-book-spread");

    var left = el("section", "reader-book-inside reader-book-left");
    left.appendChild(el("span", "reader-book-chapter-mark", "SERIES"));
    left.appendChild(el("h2", "reader-book-inside-title", series.name || "Untitled"));
    if (series.description) left.appendChild(el("p", "reader-book-inside-description", series.description));
    var total = el("p", "reader-book-inside-meta", count + (count === 1 ? " chapter" : " chapters") +
      (books.length ? " · " + books.length + (books.length === 1 ? " sub-series" : " sub-series") : ""));
    left.appendChild(total);

    var right = el("section", "reader-book-inside reader-book-right");
    right.appendChild(el("span", "reader-book-chapter-mark", "CONTENTS"));
    right.appendChild(el("h3", "reader-book-contents-title", "Inside this series"));
    var contents = el("nav", "reader-book-contents");
    contents.setAttribute("aria-label", "Sub-series and chapters in " + (series.name || "Series"));
    books.forEach(function (book, index) {
      var link = el("button", "reader-book-toc-row");
      link.type = "button";
      link.setAttribute("aria-label", "Read " + (book.name || "Sub-series"));
      link.appendChild(el("span", "reader-book-toc-index", String(index + 1).padStart(2, "0")));
      var copy = el("span", "reader-book-toc-copy");
      copy.appendChild(el("strong", "", book.name || "Untitled sub-series"));
      if (book.chapterCount != null) copy.appendChild(el("small", "", book.chapterCount +
        (book.chapterCount === 1 ? " chapter" : " chapters")));
      link.appendChild(copy);
      link.appendChild(el("span", "reader-book-toc-arrow", "›"));
      link.addEventListener("click", function () { continueTo(function () { onSubseries(book.id); }); });
      contents.appendChild(link);
    });
    // A story can belong directly to a series without a sub-series.
    // Display each as a real chapter instead of hiding it behind a grouping link.
    directStories.forEach(function (story, index) {
      var direct = el("button", "reader-book-toc-row");
      direct.type = "button";
      direct.setAttribute("aria-label", "Read " + (story.title || "Untitled chapter"));
      direct.appendChild(el("span", "reader-book-toc-index", String(books.length + index + 1).padStart(2, "0")));
      var directCopy = el("span", "reader-book-toc-copy");
      directCopy.appendChild(el("strong", "", story.title || "Untitled chapter"));
      directCopy.appendChild(el("small", "", "Chapter"));
      direct.appendChild(directCopy);
      direct.appendChild(el("span", "reader-book-toc-arrow", "›"));
      direct.addEventListener("click", function () {
        continueTo(function () { onStory(story.slug); });
      });
      contents.appendChild(direct);
    });
    if (!books.length && !directStories.length) {
      contents.appendChild(el("p", "reader-book-no-chapters", "No published chapters yet."));
    }
    right.appendChild(contents);
    var explore = el("button", "reader-book-explore", "Explore full series  →");
    explore.type = "button";
    explore.addEventListener("click", function () { continueTo(onSeries); });
    right.appendChild(explore);
    spread.appendChild(left);
    spread.appendChild(right);

    var coverLeaf = el("div", "reader-book-cover-leaf");
    var coverFace = el("div", "reader-book-cover-face");
    if (cover) coverFace.appendChild(imageFor(cover, mediaUrl));
    else coverFace.appendChild(el("span", "reader-book-cover-monogram", String(series.name || "S").charAt(0).toUpperCase()));
    var coverCopy = el("div", "reader-book-cover-caption");
    coverCopy.appendChild(el("small", "", "THE ARCHIVE"));
    coverCopy.appendChild(el("strong", "", series.name || "Untitled"));
    coverFace.appendChild(coverCopy);
    coverLeaf.appendChild(coverFace);

    spread.appendChild(coverLeaf);
    scene.appendChild(spread);
    stage.appendChild(close);
    stage.appendChild(intro);
    stage.appendChild(scene);
    modal.appendChild(stage);
    modal.showModal();
    if (reducedMotion) modal.classList.add("is-open");
    else requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (modal.open) modal.classList.add("is-open");
      });
    });
  }

  function create(series, count, books, directStories, onSeries, onSubseries, onStory, mediaUrl) {
    var posters = Array.isArray(series.posters) ? series.posters.filter(validPoster).slice(0, 5) : [];
    var cover = getCover(series, posters);
    var card = el("article", "reader-series-card reader-book-card");
    var trigger = el("button", "reader-book-trigger");
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-label", "Open 3D book for " + (series.name || "Untitled"));

    var visual = el("span", "reader-book-visual");
    var fan = el("span", "reader-book-fan");
    fan.setAttribute("aria-hidden", "true");
    if (posters.length > 1) {
      posters.forEach(function (poster, index) {
        // Keep smaller stacks symmetrical instead of fanning only to the left.
        var layouts = { 2: [1, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };
        var position = fanPositions[layouts[posters.length][index]];
        var page = el("span", "reader-book-fan-card");
        page.style.setProperty("--fan-x", position.x);
        page.style.setProperty("--fan-y", position.y);
        page.style.setProperty("--fan-r", position.r);
        page.style.setProperty("--fan-index", String(index));
        page.appendChild(imageFor(poster, mediaUrl));
        fan.appendChild(page);
      });
    }
    visual.appendChild(fan);
    var volume = el("span", "reader-book-volume");
    var pages = el("span", "reader-book-page-edges");
    volume.appendChild(pages);
    var front = el("span", "reader-book-front");
    if (cover) front.appendChild(imageFor(cover, mediaUrl));
    else front.appendChild(el("span", "reader-book-monogram", String(series.name || "S").charAt(0).toUpperCase()));
    front.appendChild(el("span", "reader-book-spine"));
    front.appendChild(el("span", "reader-book-front-label", "SERIES"));
    volume.appendChild(front);
    visual.appendChild(volume);
    trigger.appendChild(visual);

    var copy = el("span", "reader-series-copy reader-book-card-copy");
    copy.appendChild(el("strong", "", series.name || "Untitled"));
    copy.appendChild(el("span", "", count + (count === 1 ? " chapter" : " chapters") +
      (posters.length > 1 ? " · " + posters.length + " posters" : "")));
    trigger.appendChild(copy);
    trigger.addEventListener("click", function () {
      openBook(series, cover, count, books, directStories, onSeries, onSubseries, onStory, mediaUrl, trigger);
    });
    card.appendChild(trigger);
    return card;
  }

  function stopAll() {
    if (dialog && dialog.open) dialog.close();
  }

  window.ArchiveSeriesBooksReader = { create: create, stopAll: stopAll };
})();
