/* Per-series community ratings (shared totals, per-browser editable vote). */
(function () {
  "use strict";
  var API = "/api/thoughts/content";
  var known = null;
  var loading = null;
  var views = [];
  var busy = {};

  function browserIdentity(id) {
    try {
      var key = "archive_rating_voter_v1_" + id;
      var value = localStorage.getItem(key);
      if (value && /^[a-f0-9]{32}$/.test(value)) return value;
      if (!window.crypto || !window.crypto.getRandomValues) return null;
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      value = Array.from(bytes).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
      localStorage.setItem(key, value);
      return value;
    } catch (_) { return null; }
  }

  function savedVote(id) {
    try {
      var score = Number(localStorage.getItem("archive_rating_value_v1_" + id));
      return Number.isInteger(score) && score >= 1 && score <= 5 ? score : 0;
    } catch (_) { return 0; }
  }
  function saveVote(id, score) {
    try { localStorage.setItem("archive_rating_value_v1_" + id, String(score)); }
    catch (_) {}
  }

  function request(url, options) {
    return fetch(url, Object.assign({
      credentials: "same-origin", cache: "no-store",
      headers: { Accept: "application/json" },
    }, options || {})).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error(body.error || "Could not update community ratings.");
          error.status = response.status;
          throw error;
        }
        return body;
      });
    });
  }

  function refreshViews() {
    views = views.filter(function (view) { return view.host.isConnected; });
    views.forEach(render);
  }

  function load() {
    if (loading) return loading;
    loading = request(API + "?ratings=1").then(function (payload) {
      known = payload && payload.available ? {
        available: true, books: payload.books || {}
      } : { available: false, books: {} };
      refreshViews();
    }).catch(function () {
      known = { available: false, books: {} };
      refreshViews();
    });
    return loading;
  }

  function render(view) {
    var entry = known && known.books && known.books[view.id];
    var available = Boolean(known && known.available);
    var current = savedVote(view.id);
    view.summary.textContent = !known ? "Loading ratings…" :
      !available ? "Community ratings unavailable" :
      entry && entry.count > 0
        ? entry.average.toFixed(1) + " / 5 · " + entry.count +
          (entry.count === 1 ? " rating" : " ratings")
        : "No community ratings yet";
    view.hint.textContent = !known ? "Loading…" :
      !available ? "Rating service is not configured or temporarily offline." :
      !view.voterId ? "Ratings need browser storage to be enabled." :
      busy[view.id] ? "Saving rating…" :
      current ? "Your rating: " + current + "/5 · Tap to change" : "Rate this book";
    view.buttons.forEach(function (button, index) {
      var score = index + 1;
      button.disabled = !available || !view.voterId || Boolean(busy[view.id]);
      button.textContent = score <= current ? "★" : "☆";
      button.classList.toggle("is-selected", score <= current);
      button.setAttribute("aria-pressed", String(score === current));
    });
  }

  function submit(view, score) {
    if (!known || !known.available || !view.voterId || busy[view.id]) return;
    busy[view.id] = true;
    refreshViews();
    request(API, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId: view.id, voterId: view.voterId, rating: score }),
    }).then(function (result) {
      if (!result || !result.summary) throw new Error("Invalid rating response.");
      known.books[view.id] = result.summary;
      saveVote(view.id, score);
      view.error.textContent = "";
    }).catch(function (error) {
      view.error.textContent = error.message || "Could not save your rating.";
      if (error.status === 503) known.available = false;
    }).finally(function () {
      delete busy[view.id];
      refreshViews();
    });
  }

  function mount(host, id, name) {
    if (!host || typeof id !== "string" || !id) return;
    var block = document.createElement("section");
    block.className = "reader-community-rating";
    block.setAttribute("aria-label", "Community rating for " + (name || "this book"));
    var summary = document.createElement("p");
    summary.className = "reader-rating-summary";
    summary.setAttribute("aria-live", "polite");
    var stars = document.createElement("div");
    stars.className = "reader-rating-stars";
    stars.setAttribute("role", "group");
    stars.setAttribute("aria-label", "Rate " + (name || "book") + " from 1 to 5 stars");
    var hint = document.createElement("p");
    hint.className = "reader-rating-hint";
    var error = document.createElement("p");
    error.className = "reader-rating-error";
    error.setAttribute("role", "status");
    var view = {
      host: block, id: id, voterId: browserIdentity(id),
      summary: summary, hint: hint, error: error, buttons: [],
    };
    for (var i = 1; i <= 5; i++) {
      (function (score) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "reader-rating-star";
        button.setAttribute("aria-label", "Give " + score + " of 5 stars");
        button.addEventListener("click", function () { submit(view, score); });
        stars.appendChild(button);
        view.buttons.push(button);
      })(i);
    }
    block.appendChild(summary);
    block.appendChild(stars);
    block.appendChild(hint);
    block.appendChild(error);
    host.appendChild(block);
    views.push(view);
    render(view);
    load();
    return block;
  }

  window.ArchiveBookRatings = { mount: mount };
})();
