/**
 * A clock wheel where you can drag the arrow to select an 
 *
 * Usage:
 *   import { createAngleSelector } from "./clock.js";
 *   createAngleSelector(document.getElementById("angle-wheel"));
 *
 * Auto-init is also supported for any element with [data-angle-selector].
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// clamp the pointer to the circle
function clampToCircle(cx, cy, radius, x, y) {
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x: cx + (dx / distance) * radius,
    y: cy + (dy / distance) * radius,
  };
}

// get the angle from the pointer
function getAngleFromPointer(pointX, pointY, centerX, centerY) {
  const dx = pointX - centerX;
  const dy = pointY - centerY;
  const radians = Math.atan2(dy, dx);
  const mathDegrees = (((radians * 180) / Math.PI) % 360 + 360) % 360;
  const degrees = (mathDegrees + 90) % 360;
  return { radians, degrees };
}

// create an SVG element
function createSvgElement(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

// create a clock wheel
export function createAngleSelector(target, options = {}) {
  if (!target) {
    throw new Error("createAngleSelector: target element is required.");
  }

  const size = options.size ?? 340; // size of the clock wheel in pixels
  const radius = options.radius ?? 120; // radius of the clock wheel in pixels
  const center = size / 2;
  const initialDegrees = ((options.initialDegrees ?? 0) % 360 + 360) % 360; // initial degrees of the clock wheel

  target.innerHTML = "";
  target.classList.add("angle-selector");
  target.style.maxWidth = `${size}px`;
  target.style.userSelect = "none";

  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.justifyItems = "center";

  const svg = createSvgElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-label": "Interactive clock wheel",
    style: "overflow: visible; touch-action: none;",
  });

  const wheel = createSvgElement("circle", {
    cx: center,
    cy: center,
    r: radius,
    fill: "#ffffff",
    stroke: "#cbd5e1",
    "stroke-width": 3,
  });

  const centerDot = createSvgElement("circle", {
    cx: center,
    cy: center,
    r: 5,
    fill: "#0f172a",
  });

  const arrow = createSvgElement("line", {
    x1: center,
    y1: center,
    x2: center + radius,
    y2: center,
    stroke: "#2563eb",
    "stroke-width": 4,
    "stroke-linecap": "round",
  });

  const handle = createSvgElement("circle", {
    cx: center + radius,
    cy: center,
    r: 8,
    fill: "#2563eb",
  });

  svg.append(wheel, arrow, handle, centerDot);
  wrapper.append(svg);
  target.append(wrapper);

  let dragging = false;
  let currentDegrees = 0;

  function renderAtDegrees(degrees, meta = {}) {
    currentDegrees = ((degrees % 360) + 360) % 360;
    const radians = ((currentDegrees - 90) * Math.PI) / 180;
    const x = center + Math.cos(radians) * radius;
    const y = center + Math.sin(radians) * radius;

    arrow.setAttribute("x2", String(x));
    arrow.setAttribute("y2", String(y));
    handle.setAttribute("cx", String(x));
    handle.setAttribute("cy", String(y));

    if (typeof options.onChange === "function") {
      options.onChange(currentDegrees, radians, {
        source: meta.source ?? "programmatic",
      });
    }
  }

  function updateFromEvent(event) {
    const rect = svg.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const clamped = clampToCircle(center, center, radius, pointerX, pointerY);
    const { degrees } = getAngleFromPointer(clamped.x, clamped.y, center, center);
    renderAtDegrees(degrees, { source: "pointer" });
  }

  function onPointerDown(event) {
    dragging = true;
    updateFromEvent(event);
    svg.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    updateFromEvent(event);
  }

  function onPointerUp(event) {
    dragging = false;
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
  }

  function onLostPointerCapture() {
    dragging = false;
  }

  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);
  svg.addEventListener("lostpointercapture", onLostPointerCapture);

  renderAtDegrees(initialDegrees, { source: "init" });

  return {
    getAngle: () => currentDegrees,
    setAngle: (deg) => renderAtDegrees(deg, { source: "programmatic" }),
    destroy: () => {
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerUp);
      svg.removeEventListener("lostpointercapture", onLostPointerCapture);
      target.innerHTML = "";
    },
  };
}

function autoInit() {
  const nodes = document.querySelectorAll("[data-angle-selector]");
  nodes.forEach((node) => {
    if (!node.__angleSelectorInstance) {
      node.__angleSelectorInstance = createAngleSelector(node);
    }
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }
}
