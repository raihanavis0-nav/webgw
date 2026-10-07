(function () {
  "use strict";

  const variations = [
    "charFill",
    "charInverse",
    "charAccent",
    "charAccentInverse",
    "charAccentFill",
    "charBorder",
  ];

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const roundToStep = (value, step) => Math.round(value / step) * step;
  const remap = (value, inMin, inMax, outMin, outMax) =>
    ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;

  function bezierEase(x, x1, y1, x2, y2) {
    const bx = (t) =>
      3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
    const by = (t) =>
      3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
    const bd = (t) =>
      3 * (1 - t) ** 2 * x1 +
      6 * (1 - t) * t * (x2 - x1) +
      3 * t ** 2 * (1 - x2);

    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const delta = bx(t) - x;
      if (Math.abs(delta) < 0.000001) return by(t);
      const derivative = bd(t);
      if (Math.abs(derivative) < 0.000001) break;
      t -= delta / derivative;
    }

    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 20; i += 1) {
      const current = bx(t);
      if (Math.abs(current - x) < 0.000001) return by(t);
      if (current < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return by(t);
  }

  function buildTyper(element) {
    const source = element.textContent.trim();
    const charsTotal = source.replace(/\s/g, "").length;
    if (!charsTotal) return null;

    const nodes = [];
    const divisor = charsTotal > 1 ? charsTotal - 1 : 1;
    let charIndex = 0;

    element.textContent = "";
    source.split(/(\s+)/).forEach((part) => {
      if (part.trim() === "") {
        element.append(document.createTextNode(part));
        return;
      }

      const word = document.createElement("span");
      word.className = "word";
      part.split("").forEach((character) => {
        const position = charIndex / divisor;
        const controlPoint = roundToStep(
          bezierEase(position, 0, 0.75, 0.75, 0),
          0.05
        );
        const span = document.createElement("span");
        span.className = "char charInit";
        span.textContent = character;
        nodes.push({ element: span, controlPoint, currentClass: span.className });
        word.appendChild(span);
        charIndex += 1;
      });
      element.appendChild(word);
    });

    return {
      element,
      nodes,
      frames: 20 * (1 + charsTotal * 0.01),
      denominator: 20 * (1 + charsTotal * 0.01) * 0.5 || 1,
    };
  }

  function setClass(node, className) {
    if (node.currentClass === className) return;
    node.currentClass = className;
    node.element.className = className;
  }

  function resetTyper(typer) {
    typer.nodes.forEach((node) => setClass(node, "char charInit"));
    typer.element.dataset.typerType = "initial";
  }

  function reveal(typer, shouldLoop = false) {
    const shuffled = variations.slice().sort(() => 0.5 - Math.random());
    let frame = 0;
    typer.element.dataset.typerType = "in";

    const interval = window.setInterval(() => {
      frame = clamp(frame + 1, 0, typer.frames);
      const progress = frame / typer.denominator;

      typer.nodes.forEach((node) => {
        let localProgress = progress - node.controlPoint;
        localProgress = roundToStep(clamp(localProgress, 0, 1), 0.1);

        let nextClass = "char charInit";
        if (localProgress > 0) {
          const index = Math.round(remap(localProgress, 0, 1, 0, 3));
          const variation = shuffled[index % shuffled.length];
          nextClass = localProgress >= 1 ? "char" : `char ${variation}`;
        }

        setClass(node, nextClass);
      });

      if (frame >= typer.frames) {
        window.clearInterval(interval);
        typer.nodes.forEach((node) => setClass(node, "char"));
        typer.element.dataset.typerType = "done";

        if (shouldLoop) {
          window.setTimeout(() => {
            resetTyper(typer);
            window.setTimeout(() => reveal(typer, true), 500);
          }, 3200);
        }
      }
    }, 50);
  }

  function init() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll("[data-typer]").forEach((element) => {
        element.dataset.typerType = "done";
      });
      return;
    }

    document.querySelectorAll("[data-typer]").forEach((element) => {
      const typer = buildTyper(element);
      if (!typer) return;
      const shouldLoop = element.hasAttribute("data-typer-loop");
      window.setTimeout(() => reveal(typer, shouldLoop), 450);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
