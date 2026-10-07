/* Films-page search, sorting, and rendering. */
(function () {
  "use strict";

  function parseFilm(entry) {
    if (entry && typeof entry === "object") {
      return {
        title: entry.title || "",
        rating: entry.rating == null ? null : Number(entry.rating),
      };
    }

    const text = String(entry || "").trim();
    const match = text.match(/^(.*)\(([^()]*)\)\s*$/);
    if (!match) return { title: text, rating: null };

    const ratingMatch = match[2]
      .trim()
      .match(/^(\d+(?:\.\d+)?)\s*\/\s*5$/);

    return {
      title: match[1].trim(),
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    };
  }

  function init() {
    if (typeof siteData === "undefined" || !window.SiteCore) return;

    const { $, el } = window.SiteCore;
    const list = $("#filmList");
    if (!list || !Array.isArray(siteData.films)) return;

    const all = siteData.films
      .map(parseFilm)
      .map((film, index) => ({ ...film, order: index }));

    const search = $("#filmSearch");
    const sort = $("#filmSort");
    const count = $("#filmCount");

    function paint(items) {
      list.innerHTML = "";

      if (count) {
        count.textContent =
          items.length + (items.length === 1 ? " film" : " films");
      }

      if (!items.length) {
        list.appendChild(
          el("p", "film-empty", "No films match your search.")
        );
        return;
      }

      const fragment = document.createDocumentFragment();

      items.forEach((film) => {
        const item = el("div", "film-item");
        item.textContent = film.title;
        if (film.rating != null) item.title = film.rating + " / 5";
        fragment.appendChild(item);
      });

      list.appendChild(fragment);
    }

    function apply() {
      let items = all.slice();
      const query = String(search && search.value ? search.value : "")
        .trim()
        .toLowerCase();

      if (query) {
        items = items.filter((film) =>
          film.title.toLowerCase().includes(query)
        );
      }

      const mode = (sort && sort.value) || "recent";

      if (mode === "az") {
        items.sort((a, b) => a.title.localeCompare(b.title));
      } else if (mode === "za") {
        items.sort((a, b) => b.title.localeCompare(a.title));
      } else if (mode === "rating") {
        items.sort(
          (a, b) =>
            (b.rating == null ? -1 : b.rating) -
            (a.rating == null ? -1 : a.rating)
        );
      } else {
        items.sort((a, b) => a.order - b.order);
      }

      paint(items);
    }

    if (search) search.addEventListener("input", apply);
    if (sort) sort.addEventListener("change", apply);
    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
