/* Work-page album, collection, and lightbox logic. */
(function () {
  "use strict";

  let lightboxState = { items: [], index: 0 };

  function init() {
    if (typeof siteData === "undefined" || !window.SiteCore) return;

    const { $, $$, el, escapeHtml, setText, observeReveals } =
      window.SiteCore;

    const grid = $("#projectGrid");
    const filters = $("#projectFilters");
    if (!grid || !Array.isArray(siteData.projects)) return;

    function isCollection(project) {
      return (
        project &&
        Array.isArray(project.images) &&
        project.images.length > 0
      );
    }

    function filterProjects(category) {
      $$("#projectGrid .album-item").forEach((item) => {
        const show =
          category === "All" || item.dataset.category === category;
        item.style.display = show ? "" : "none";
      });
    }

    function refreshScrollLock() {
      const lightbox = $("#lightbox");
      const collection = $("#collection");
      const open =
        (lightbox && lightbox.classList.contains("open")) ||
        (collection && collection.classList.contains("open"));

      document.body.style.overflow = open ? "hidden" : "";
    }

    function initCollection() {
      const collection = $("#collection");
      if (!collection) return;

      const close = $("#colClose");
      if (close) close.addEventListener("click", closeCollection);

      collection.addEventListener("click", (event) => {
        if (event.target === collection) closeCollection();
      });

      document.addEventListener("keydown", (event) => {
        if (
          event.key !== "Escape" ||
          !collection.classList.contains("open")
        ) {
          return;
        }

        const lightbox = $("#lightbox");
        if (lightbox && lightbox.classList.contains("open")) return;

        closeCollection();
      });
    }

    function openCollection(data) {
      const collection = $("#collection");
      if (!collection) return;

      setText("#colKicker", data.category || "Collection");
      setText("#colTitle", data.title || "Album");

      const description = $("#colDesc");
      if (description) {
        description.textContent = data.description || "";
        description.style.display = data.description ? "" : "none";
      }

      const collectionGrid = $("#colGrid");
      collectionGrid.innerHTML = "";

      (data.images || []).forEach((src, index) => {
        const item = el("figure", "album-item");
        const image = el("img");

        image.src = src;
        image.alt =
          (data.title || "Artwork") + " " + (index + 1);
        image.loading = "lazy";

        item.appendChild(image);
        item.dataset.src = src;
        item.dataset.title = data.title
          ? data.title +
            " (" +
            (index + 1) +
            "/" +
            data.images.length +
            ")"
          : "";
        item.style.cursor = "zoom-in";
        item.setAttribute("data-cursor", "");
        item.addEventListener("click", () => openLightbox(item));

        collectionGrid.appendChild(item);
      });

      collection.scrollTop = 0;
      collection.classList.add("open");
      collection.setAttribute("aria-hidden", "false");
      refreshScrollLock();
    }

    function closeCollection() {
      const collection = $("#collection");
      if (!collection) return;

      collection.classList.remove("open");
      collection.setAttribute("aria-hidden", "true");
      refreshScrollLock();
    }

    function initLightbox() {
      const lightbox = $("#lightbox");
      if (!lightbox || lightbox.dataset.ready === "true") return;

      lightbox.dataset.ready = "true";

      const close = $("#lbClose");
      const previous = $("#lbPrev");
      const next = $("#lbNext");

      if (close) close.addEventListener("click", closeLightbox);
      if (previous) {
        previous.addEventListener("click", () => stepLightbox(-1));
      }
      if (next) {
        next.addEventListener("click", () => stepLightbox(1));
      }

      lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) closeLightbox();
      });

      document.addEventListener("keydown", (event) => {
        if (!lightbox.classList.contains("open")) return;

        if (event.key === "Escape") closeLightbox();
        else if (event.key === "ArrowLeft") stepLightbox(-1);
        else if (event.key === "ArrowRight") stepLightbox(1);
      });
    }

    function openLightbox(clicked) {
      const lightbox = $("#lightbox");
      if (!lightbox) return;

      const container =
        clicked.closest(".collection-grid") ||
        clicked.closest("#projectGrid");

      const pool = container
        ? Array.from(container.querySelectorAll(".album-item"))
        : $$(".album-item");

      lightboxState.items = pool.filter(
        (item) =>
          item.dataset.src && item.style.display !== "none"
      );
      lightboxState.index = Math.max(
        0,
        lightboxState.items.indexOf(clicked)
      );

      paintLightbox();
      lightbox.classList.add("open");
      lightbox.setAttribute("aria-hidden", "false");
      refreshScrollLock();
    }

    function paintLightbox() {
      const image = $("#lbImg");
      const caption = $("#lbCaption");
      const item = lightboxState.items[lightboxState.index];

      if (!item || !image) return;

      image.src = item.dataset.src;
      image.alt = item.dataset.title || "";
      if (caption) caption.textContent = item.dataset.title || "";

      const multiple = lightboxState.items.length > 1;
      ["#lbPrev", "#lbNext"].forEach((selector) => {
        const button = $(selector);
        if (button) button.style.display = multiple ? "" : "none";
      });
    }

    function stepLightbox(direction) {
      if (!lightboxState.items.length) return;

      lightboxState.index =
        (lightboxState.index +
          direction +
          lightboxState.items.length) %
        lightboxState.items.length;

      paintLightbox();
    }

    function closeLightbox() {
      const lightbox = $("#lightbox");
      if (!lightbox) return;

      lightbox.classList.remove("open");
      lightbox.setAttribute("aria-hidden", "true");
      refreshScrollLock();
    }

    function buildAlbum(looseFiles) {
      const projects = siteData.projects || [];
      const collections = projects.filter(isCollection);
      const singles = projects.filter(
        (project) => project.image && !isCollection(project)
      );

      const items = collections.map((project) => ({
        type: "collection",
        title: project.album || project.title || "Album",
        category: project.category || "",
        description: project.description || "",
        cover: project.cover || project.images[0],
        images: project.images,
      }));

      singles.forEach((project) => {
        items.push({
          type: "single",
          image: project.image,
          title: project.title || "",
          category: project.category || "",
        });
      });

      const used = new Set(
        items
          .filter((item) => item.image)
          .map((item) => item.image)
      );

      looseFiles.forEach((file) => {
        const src = "assets/img/" + file;
        if (!used.has(src)) {
          items.push({
            type: "single",
            image: src,
            title: "",
            category: "",
          });
        }
      });

      const categories = [
        ...new Set(
          items.map((item) => item.category).filter(Boolean)
        ),
      ];

      if (filters && categories.length > 1) {
        ["All", ...categories].forEach((category, index) => {
          const button = el(
            "button",
            "filter-btn" + (index === 0 ? " active" : ""),
            escapeHtml(category)
          );

          button.setAttribute("data-cursor", "");
          button.addEventListener("click", () => {
            $$(".filter-btn").forEach((item) => {
              item.classList.remove("active");
            });
            button.classList.add("active");
            filterProjects(category);
          });

          filters.appendChild(button);
        });
      }

      items.forEach((project) => {
        const item = el("figure", "album-item reveal");
        item.dataset.category = project.category || "";

        if (project.type === "collection") {
          const image = el("img");
          image.src = project.cover;
          image.alt = project.title || "Album";
          image.loading = "lazy";

          item.appendChild(image);
          item.classList.add("is-collection");
          item.style.cursor = "pointer";
          item.setAttribute("data-cursor", "");

          const badge = el(
            "span",
            "album-badge",
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 21h12a2 2 0 0 0 2-2V9"/></svg><span>' +
              project.images.length +
              "</span>"
          );

          item.appendChild(badge);
          item.addEventListener("click", () =>
            openCollection(project)
          );
        } else {
          const image = el("img");
          image.src = project.image;
          image.alt = project.title || "Artwork";
          image.loading = "lazy";

          item.appendChild(image);
          item.dataset.src = project.image;
          item.dataset.title = project.title || "";
          item.style.cursor = "zoom-in";
          item.setAttribute("data-cursor", "");
          item.addEventListener("click", () =>
            openLightbox(item)
          );
        }

        if (project.title || project.category) {
          const caption = el("figcaption", "album-cap");
          caption.innerHTML =
            (project.category
              ? '<span class="album-cap-cat">' +
                escapeHtml(project.category) +
                "</span>"
              : "") +
            (project.title
              ? '<span class="album-cap-title">' +
                escapeHtml(project.title) +
                "</span>"
              : "");

          item.appendChild(caption);
        }

        grid.appendChild(item);
      });

      initLightbox();
      observeReveals();
    }

    initCollection();

    fetch("assets/img/manifest.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => [])
      .then((files) => {
        buildAlbum(Array.isArray(files) ? files : []);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
