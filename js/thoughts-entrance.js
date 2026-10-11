/* Entrance appears once per Reader page load; never between chapters.
   The configured Appearance > Login Artwork stays mounted, preserving GIF playback. */
(function () {
  "use strict";

  var MIN_OPEN_MS = 1500;
  var APPEARANCE_FALLBACK_MS = 3000;
  var started = Date.now();
  var intro = null;
  var readyButton = null;
  var waiting = null;
  var destination = "";
  var artworkReady = false;
  var entered = false;

  function $(id) { return document.getElementById(id); }

  function setLibraryInert(active) {
    var library = $("libraryApp");
    if (!library) return;
    library.inert = !!active;
    if (active) library.setAttribute("aria-hidden", "true");
    else library.removeAttribute("aria-hidden");
  }

  function showReady() {
    if (!intro || intro.hidden || entered || !artworkReady || !destination ||
        Date.now() - started < MIN_OPEN_MS) return;
    if (!readyButton.hidden) return;
    waiting.hidden = true;
    readyButton.hidden = false;
    intro.classList.add("is-ready");
    readyButton.focus({ preventScroll: true });
  }

  function focusGate() {
    var input = $("accessCodeInput");
    if (input && !input.disabled) input.focus({ preventScroll: true });
  }

  function closeEntrance() {
    intro.hidden = true;
    intro.classList.remove("is-ready", "is-gate");
    document.body.classList.remove("reader-entrance-active");
    setLibraryInert(false);
    var main = $("libraryHome");
    if (main && !main.hidden) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }

  function revealGate() {
    intro.hidden = false;
    intro.classList.add("is-gate");
    intro.classList.remove("is-ready");
    readyButton.hidden = true;
    waiting.hidden = true;
    document.body.classList.add("reader-entrance-active");
    setLibraryInert(true);
    focusGate();
  }

  function enter() {
    if (!destination || readyButton.hidden || entered) return;
    entered = true;
    if (destination === "gate") revealGate();
    else closeEntrance();
  }

  function setDestination(next) {
    destination = next === "library" ? "library" : "gate";
    if (!intro) return;
    if (entered) {
      if (destination === "gate") revealGate();
      else closeEntrance();
      return;
    }
    setLibraryInert(true);
    showReady();
  }

  function setAppearanceReady() {
    artworkReady = true;
    showReady();
  }

  function setTitle(title) {
    var heading = $("readerEntranceTitle");
    if (heading) heading.textContent = title || "Archive";
  }

  function isBlocking() {
    return !!intro && !intro.hidden && !entered;
  }

  function init() {
    intro = $("readerEntrance");
    readyButton = $("readerEntranceEnter");
    waiting = $("readerEntranceWait");
    if (!intro || !readyButton || !waiting) return;
    document.body.classList.add("reader-entrance-active");
    readyButton.addEventListener("click", enter);
    // A broken/slow appearance endpoint must not block the entire Reader.
    window.setTimeout(setAppearanceReady, APPEARANCE_FALLBACK_MS);
    window.setTimeout(showReady, MIN_OPEN_MS);
    showReady();
  }

  window.ReaderEntrance = {
    setDestination: setDestination,
    setAppearanceReady: setAppearanceReady,
    setTitle: setTitle,
    isBlocking: isBlocking
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
