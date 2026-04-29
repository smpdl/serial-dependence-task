/*
  Shared stimulus and preview rendering helpers.
*/

import {
  APERTURE_BORDER_COLOR,
  APERTURE_BORDER_PX,
  ORIENTATION_GABOR_CONFIG,
  STIMULUS_DIAMETER_PX,
} from "./config.js";
import { lchColorFromHue, viewportPositionToCanvasOffset, wrapAngle } from "./utils.js";

// For the psychophysics plugin, we will use a cross as the fixation stimulus.
export function buildCanvasFixationStimulus() {
  return {
    obj_type: "cross",
    startX: 0,
    startY: 0,
    origin_center: true,
    line_length: 28,
    line_width: 4,
    line_color: "#ffffff",
  };
}

export function buildCanvasApertureBorderStimulus(position) {
  const canvasOffset = viewportPositionToCanvasOffset(position);
  const borderRadius = STIMULUS_DIAMETER_PX / 2 - APERTURE_BORDER_PX / 2;
  return {
    obj_type: "circle",
    origin_center: true,
    startX: canvasOffset.x,
    startY: canvasOffset.y,
    radius: borderRadius,
    line_width: APERTURE_BORDER_PX,
    line_color: APERTURE_BORDER_COLOR,
  };
}
// steps are 1 degree apart. The del E for this is ~0.444.
// this will give us a good resolution for the color wheel.
export function buildColorWheelGradient() {
  const stops = [];
  for (let hue = 0; hue <= 360; hue += 1) {
    stops.push(`${lchColorFromHue(hue).hex} ${hue}deg`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

export function positionStyle(position) {
  const canvasOffset = viewportPositionToCanvasOffset(position);
  return `
    position:absolute;
    top:calc(50% + ${canvasOffset.y.toFixed(1)}px);
    left:calc(50% + ${canvasOffset.x.toFixed(1)}px);
    transform:translate(-50%, -50%);
  `;
}

// build the style for the aperture shell.
// this is the shell that contains the stimulus.
// we will just use a simple circle with a border.
function buildApertureStyle(position, extraStyle = "") {
  return `
    ${positionStyle(position)}
    width:${STIMULUS_DIAMETER_PX}px;
    height:${STIMULUS_DIAMETER_PX}px;
    border:${APERTURE_BORDER_PX}px solid ${APERTURE_BORDER_COLOR};
    border-radius:50%;
    box-sizing:border-box;
    overflow:hidden;
    background:#808080;
    ${extraStyle}
  `;
}

// build the HTML for the aperture shell.
// this is the shell that contains the stimulus.
// we will just use a simple circle with a border.
export function buildApertureShellHtml(position, extraStyle = "", content = "") {
  return `
    <div style="${buildApertureStyle(position, extraStyle)}">
      ${content}
    </div>
  `;
}

function createSeededRng(seed) {
  let state = Math.imul(seed ^ 0x6D2B79F5, 1) >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

// create the markup for the numerosity stimulus.
// we will use 
function buildNumerosityDotMarkup(stimulusValue, arrangementSeed = null) {
  const dots = [];
  const nDots = stimulusValue;
  const radius = STIMULUS_DIAMETER_PX / 2 - APERTURE_BORDER_PX - 8;
  const dotRadius = 5;
  const rand = arrangementSeed === null ? Math.random : createSeededRng(arrangementSeed);
  let attempts = 0;

  while (dots.length < nDots && attempts < 10000) {
    attempts += 1;
    const angle = rand() * (Math.PI * 2);
    const dist = Math.sqrt(rand()) * (radius - dotRadius);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const overlaps = dots.some((d) => Math.hypot(d.x - x, d.y - y) < dotRadius * 2 + 2);
    if (!overlaps) dots.push({ x, y });
  }

  return dots
    .map(
      (d) => `<div style="
        position:absolute;
        width:${dotRadius * 2}px;
        height:${dotRadius * 2}px;
        border-radius:50%;
        background:#fff;
        left:calc(50% + ${d.x.toFixed(1)}px - ${dotRadius}px);
        top:calc(50% + ${d.y.toFixed(1)}px - ${dotRadius}px);
      "></div>`,
    )
    .join("");
}

export function buildOrientationPsychophysicsStimuli(position, stimulusValue, extra = {}) {
  const canvasOffset = viewportPositionToCanvasOffset(position);
  const borderRadius = STIMULUS_DIAMETER_PX / 2 - APERTURE_BORDER_PX / 2;
  const apertureRadius = borderRadius - APERTURE_BORDER_PX / 2;
  const { change_attr: userChangeAttr = null, ...gaborExtra } = extra;

  // this is the masking circle
  const backgroundCircle = {
    obj_type: "circle",
    origin_center: true,
    startX: canvasOffset.x,
    startY: canvasOffset.y,
    radius: apertureRadius,
    line_width: 0,
    fill_color: "#808080",
  };

  const gaborStimulus = {
    obj_type: "gabor",
    origin_center: true,
    startX: canvasOffset.x,
    startY: canvasOffset.y,
    width: ORIENTATION_GABOR_CONFIG.width,
    tilt: wrapAngle(90 - stimulusValue, 180),
    sf: ORIENTATION_GABOR_CONFIG.sf,
    sc: ORIENTATION_GABOR_CONFIG.sc,
    contrast: ORIENTATION_GABOR_CONFIG.contrast,
    disableNorm: ORIENTATION_GABOR_CONFIG.disableNorm,
    phase: ORIENTATION_GABOR_CONFIG.phase,
    method: ORIENTATION_GABOR_CONFIG.method,
    ...gaborExtra,
  };

  const borderCircle = {
    obj_type: "circle",
    origin_center: true,
    startX: canvasOffset.x,
    startY: canvasOffset.y,
    radius: borderRadius,
    line_width: APERTURE_BORDER_PX,
    line_color: APERTURE_BORDER_COLOR,
  };

  const stimuli = [backgroundCircle, gaborStimulus, borderCircle];

  gaborStimulus.change_attr = (stim, elapsedTime, elapsedFrames) => {
    userChangeAttr?.(stim, elapsedTime, elapsedFrames);
  };

  return stimuli;
}

function buildOrientationApertureContent() {
  return "";
}

function buildColorApertureContent(colorHex) {
  return `
    <div style="
      position:absolute;
      inset:0;
      border-radius:50%;
      background:${colorHex};
    "></div>
  `;
}

function buildNumerosityApertureContent(stimulusValue, arrangementSeed = null) {
  return `
    <div style="position:absolute;inset:0;border-radius:50%;">
      ${buildNumerosityDotMarkup(Math.round(stimulusValue), arrangementSeed)}
    </div>
  `;
}

export function buildStimulusInnerHtml(blockName, stimulusValue, extra = {}) {
  if (blockName === "orientation") return buildOrientationApertureContent(stimulusValue);
  if (blockName === "color") return buildColorApertureContent(extra.colorHex ?? "#808080");
  return buildNumerosityApertureContent(stimulusValue, extra.arrangementSeed ?? null);
}

export function buildStimulusHtml(blockName, stimulusValue, position, extra = {}) {
  return buildApertureShellHtml(position, extra.apertureStyle ?? "", buildStimulusInnerHtml(blockName, stimulusValue, extra));
}

export function buildPreviewShellHtml(position, extraStyle = "", content = "") {
  return buildApertureShellHtml(position, extraStyle, content);
}

export function buildApertureFrameHtml(position, extraStyle = "") {
  return buildApertureShellHtml(position, `background:transparent;pointer-events:none;${extraStyle}`, "");
}
