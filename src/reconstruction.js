import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import PsychophysicsPlugin from "@kurokida/jspsych-psychophysics";
import { createAngleSelector } from "./clock.js";
import {
  NUMEROSITY_MAX,
  NUMEROSITY_MIN,
  ORIENTATION_GABOR_CONFIG,
  RESPONSE_DEADLINE_MS,
} from "./config.js";
import { buildFixationHtml, setFixationClickability } from "./fixation.js";
import { buildMaskHtml, buildOrientationMaskPsychophysicsStimuli } from "./mask.js";
import {
  buildApertureFrameHtml,
  buildColorWheelGradient,
  buildOrientationPsychophysicsStimuli,
  buildPreviewShellHtml,
  buildStimulusHtml,
  buildStimulusInnerHtml,
} from "./stimuli.js";
import {
  computeResponseError,
  lchColorFromHue,
  normalizeResponseValue,
  responseStepDelta,
  wrapAngle,
} from "./utils.js";

const FIXATION_ID = "trial-fixation";
const RESPONSE_UI_STYLE = `
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%, calc(-100% - 36px));
  width:min(560px, calc(100vw - 32px));
  text-align:center;
  visibility:hidden;
  z-index:20;
`;

function buildResponseUiContainer(innerHtml, extraStyle = "") {
  return `
    <div
      style="
        display:grid;
        justify-items:center;
        gap:12px;
        ${extraStyle}
      "
    >
      ${innerHtml}
    </div>
  `;
}

function appendSharedResponseData(data, sharedData) {
  Object.assign(data, sharedData, { segment: "response" });
}

function finalizeResponseData(data, blockName, state, stimulusValue) {
  if (state.timeoutId !== null) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  data.response_timeout = !state.confirmed;
  data.response_initial_value = state.responseInitialValue;
  data.response_reversal_count = state.responseReversalCount;
  data.rendering_timestamp = state.renderingTimestamp;
  data.response_value = state.confirmed ? state.responseValue : null;
  data.response_error = state.confirmed
    ? computeResponseError(blockName, state.responseValue, stimulusValue)
    : null;
}

function attachSharedCleanup(state, handlers) {
  state.cleanupHandlers.push(...handlers);
  window.__sdtPointerCleanup = () => {
    state.cleanupHandlers.forEach((cleanup) => cleanup?.());
    state.cleanupHandlers = [];
    window.__sdtPointerCleanup = null;
  };
}

function cleanupTrial(state) {
  if (state.timeoutId !== null) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }
  state.phaseTimeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
  state.phaseTimeoutIds = [];
  state.cleanupHandlers.forEach((cleanup) => cleanup?.());
  state.cleanupHandlers = [];
  window.__sdtPointerCleanup = null;
}

function armTimeout(jsPsych, state, payload = {}) {
  state.timeoutId = window.setTimeout(() => {
    if (state.confirmed) return;
    jsPsych.finishTrial(payload);
  }, RESPONSE_DEADLINE_MS);
}

function withHiddenOverflow() {
  const root = document.documentElement;
  const body = document.body;
  const previousRootOverflow = root.style.overflow;
  const previousBodyOverflow = body.style.overflow;
  root.style.overflow = "hidden";
  body.style.overflow = "hidden";

  return () => {
    root.style.overflow = previousRootOverflow;
    body.style.overflow = previousBodyOverflow;
  };
}

function buildSharedTrialShell({ displayLayerId, responseUiId, responseUiHtml }) {
  return `
    <div style="position:fixed;inset:0;overflow:hidden;background:#808080;color:#000;">
      <div id="${displayLayerId}" style="position:absolute;inset:0;"></div>
      <div
        id="${responseUiId}"
        style="${RESPONSE_UI_STYLE}"
      >
        ${responseUiHtml}
      </div>
      ${buildFixationHtml({ fixationId: FIXATION_ID })}
    </div>
  `;
}

function buildOrientationOverlayHtml(blockPosition) {
  return `
    <div style="position:fixed;inset:0;pointer-events:none;color:#000;z-index:20;">
      ${buildApertureFrameHtml(blockPosition, "z-index:10;")}
      <div
        id="orientation-response-ui"
        style="${RESPONSE_UI_STYLE}pointer-events:auto;display:grid;justify-items:center;gap:12px;"
      >
        <p>Use the arrow pointer to match the orientation of the grating you just saw.</p>
        <div data-orientation-selector></div>
        <p>Click the central fixation to confirm.</p>
      </div>
      ${buildFixationHtml({ fixationId: FIXATION_ID })}
    </div>
  `;
}

function stripOrientationFrameStimuli(stimuli) {
  return stimuli.filter((stimulus) => !(stimulus.obj_type === "circle" && (stimulus.line_width ?? 0) > 0));
}

function buildColorResponseUi(initialValue) {
  return buildResponseUiContainer(`
    <p>Use the color wheel to match the color of the patch you just saw.</p>
    <div
      id="color-wheel"
      style="
        margin:0 auto;
        width:220px;
        height:220px;
        border-radius:50%;
        background:${buildColorWheelGradient()};
        position:relative;
        cursor:pointer;
      "
    >
      <div
        id="color-pointer"
        style="
          position:absolute;
          left:50%;
          top:50%;
          width:3px;
          height:84px;
          background:#fff;
          transform-origin:bottom center;
          transform:translate(-50%, -100%) rotate(${initialValue}deg);
        "
      ></div>
    </div>
    <p>Click the central fixation to confirm.</p>
  `);
}

function buildNumerosityResponseUi(initialValue) {
  return buildResponseUiContainer(`
    <p>Use the slider to match how many dots you saw.</p>
    <input
      id="num-slider"
      type="range"
      min="${NUMEROSITY_MIN}"
      max="${NUMEROSITY_MAX}"
      step="1"
      value="${Math.round(initialValue)}"
      style="width:min(320px, calc(100vw - 48px));"
    />
    <p>Click the central fixation to confirm.</p>
  `);
}

function buildResponsePreviewMarkup(blockName, blockPosition, state, extra = {}) {
  const innerHtml = state.hasInteracted
    ? buildStimulusInnerHtml(blockName, state.value, extra)
    : "";

  return buildPreviewShellHtml(blockPosition, "", innerHtml);
}

function buildFixationPhaseMarkup(blockPosition) {
  return buildPreviewShellHtml(blockPosition);
}

function setDisplayLayerHtml(layerId, html) {
  const layer = document.getElementById(layerId);
  if (layer) layer.innerHTML = html;
}

function setResponseUiVisibility(responseUiId, visible) {
  const responseUi = document.getElementById(responseUiId);
  if (responseUi) responseUi.style.visibility = visible ? "visible" : "hidden";
}

function createBaseState(responseInitial, responseValue = responseInitial) {
  return {
    value: responseInitial,
    responseValue,
    responseInitialValue: responseInitial,
    responseReversalCount: 0,
    lastResponseDirection: 0,
    previousTrackedValue: responseInitial,
    renderingTimestamp: null,
    hasInteracted: false,
    confirmed: false,
    timeoutId: null,
    phaseTimeoutIds: [],
    cleanupHandlers: [],
  };
}

function trackResponseDirection(state, blockName, nextValue) {
  const delta = responseStepDelta(blockName, state.previousTrackedValue, nextValue);
  if (Math.abs(delta) < 1e-6) return;

  const direction = Math.sign(delta);
  if (state.lastResponseDirection !== 0 && direction !== state.lastResponseDirection) {
    state.responseReversalCount += 1;
  }

  state.lastResponseDirection = direction;
  state.previousTrackedValue = nextValue;
}

function schedulePhase(state, delayMs, callback) {
  const timeoutId = window.setTimeout(callback, delayMs);
  state.phaseTimeoutIds.push(timeoutId);
}

function mountOrientationSelector({ state, jsPsych, stimulusValue }) {
  const root = document.querySelector("[data-orientation-selector]");
  if (!root) return [];

  const selector = createAngleSelector(root, {
    size: 260,
    radius: 95,
    initialDegrees: state.value,
    onChange: (degrees, _radians, meta = {}) => {
      if (meta.source !== "pointer") return;
      const nextValue = normalizeResponseValue("orientation", degrees);
      state.hasInteracted = true;
      trackResponseDirection(state, "orientation", nextValue);
      state.value = nextValue;
      state.responseValue = state.value;
    },
  });

  const confirmCleanup = setFixationClickability(FIXATION_ID, true, () => {
    state.confirmed = true;
    jsPsych.finishTrial({ stimulus_value: stimulusValue });
  });

  return [() => selector.destroy(), confirmCleanup];
}

function mountColorWheel({ state, blockPosition, jsPsych, stimulusValue, displayLayerId }) {
  const wheel = document.getElementById("color-wheel");
  const pointer = document.getElementById("color-pointer");

  const updateUi = () => {
    if (pointer) pointer.style.transform = `translate(-50%, -100%) rotate(${state.value}deg)`;
    setDisplayLayerHtml(
      displayLayerId,
      buildResponsePreviewMarkup("color", blockPosition, state, {
        colorHex: lchColorFromHue(state.value).hex,
      }),
    );
  };

  const pointerToAngle = (ev) => {
    if (!wheel) return;
    const rect = wheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
    const nextValue = normalizeResponseValue("color", degrees + 90);
    state.hasInteracted = true;
    trackResponseDirection(state, "color", nextValue);
    state.value = nextValue;
    state.responseValue = state.value;
    updateUi();
  };

  let dragging = false;
  const onDown = (ev) => {
    dragging = true;
    pointerToAngle(ev);
  };
  const onMove = (ev) => {
    if (dragging) pointerToAngle(ev);
  };
  const onUp = () => {
    dragging = false;
  };

  wheel?.addEventListener("pointerdown", onDown);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);

  const confirmCleanup = setFixationClickability(FIXATION_ID, true, () => {
    state.confirmed = true;
    jsPsych.finishTrial({ stimulus_value: stimulusValue });
  });

  updateUi();

  return [
    () => wheel?.removeEventListener("pointerdown", onDown),
    () => document.removeEventListener("pointermove", onMove),
    () => document.removeEventListener("pointerup", onUp),
    confirmCleanup,
  ];
}

function mountNumerositySlider({ state, blockPosition, jsPsych, stimulusValue, displayLayerId }) {
  const slider = document.getElementById("num-slider");

  const updateUi = () => {
    state.previewSeed = Math.floor(Math.random() * 0x7fffffff);
    if (slider) slider.value = String(Math.round(state.value));
    setDisplayLayerHtml(
      displayLayerId,
      buildResponsePreviewMarkup("numerosity", blockPosition, state, {
        arrangementSeed: state.previewSeed,
      }),
    );
  };

  const onInput = () => {
    const nextValue = Number(slider?.value ?? state.value);
    state.hasInteracted = true;
    trackResponseDirection(state, "numerosity", nextValue);
    state.value = nextValue;
    state.responseValue = Math.round(state.value);
    updateUi();
  };

  slider?.addEventListener("input", onInput);

  const confirmCleanup = setFixationClickability(FIXATION_ID, true, () => {
    state.confirmed = true;
    jsPsych.finishTrial({ stimulus_value: stimulusValue });
  });

  updateUi();

  return [
    () => slider?.removeEventListener("input", onInput),
    confirmCleanup,
  ];
}

function buildHtmlPersistentTrial({
  blockName,
  blockPosition,
  blockQuadrant,
  responseInitial,
  stimulusValue,
  colorMeta,
  sharedData,
  jsPsych,
  timing,
}) {
  const displayLayerId = `${blockName}-display-layer`;
  const responseUiId = `${blockName}-response-ui`;
  const state = createBaseState(
    responseInitial,
    blockName === "numerosity" ? Math.round(responseInitial) : responseInitial,
  );
  state.previewSeed = Math.floor(Math.random() * 0x7fffffff);

  const responseUiHtml = blockName === "color"
    ? buildColorResponseUi(responseInitial)
    : buildNumerosityResponseUi(responseInitial);

  const showStimulus = () => {
    state.renderingTimestamp = Date.now();
    setDisplayLayerHtml(
      displayLayerId,
      buildStimulusHtml(blockName, stimulusValue, blockPosition, {
        colorHex: colorMeta?.hex,
        arrangementSeed: state.previewSeed,
      }),
    );
  };

  const showMask = () => {
    setDisplayLayerHtml(displayLayerId, buildMaskHtml(blockPosition));
  };

  const showFixationOnly = () => {
    setDisplayLayerHtml(displayLayerId, buildFixationPhaseMarkup(blockPosition));
  };

  const showResponse = () => {
    setDisplayLayerHtml(displayLayerId, buildResponsePreviewMarkup(blockName, blockPosition, state, {
      colorHex: colorMeta?.hex,
      arrangementSeed: state.previewSeed,
    }));
    setResponseUiVisibility(responseUiId, true);
    const cleanup = blockName === "color"
      ? mountColorWheel({ state, blockPosition, jsPsych, stimulusValue, displayLayerId })
      : mountNumerositySlider({ state, blockPosition, jsPsych, stimulusValue, displayLayerId });
    attachSharedCleanup(state, cleanup);
    armTimeout(jsPsych, state, { stimulus_value: stimulusValue, quadrant: blockQuadrant });
  };

  return {
    type: HtmlKeyboardResponsePlugin,
    stimulus: buildSharedTrialShell({
      displayLayerId,
      responseUiId,
      responseUiHtml,
    }),
    choices: "NO_KEYS",
    response_ends_trial: false,
    data: { ...sharedData, segment: "response" },
    on_load: () => {
      const overflowCleanup = withHiddenOverflow();
      attachSharedCleanup(state, [overflowCleanup]);
      showFixationOnly();
      schedulePhase(state, timing.stimulusStartMs, showStimulus);
      schedulePhase(state, timing.maskStartMs, showMask);
      schedulePhase(state, timing.responseFixationStartMs, showFixationOnly);
      schedulePhase(state, timing.responseStartMs, showResponse);
    },
    on_finish: (data) => {
      cleanupTrial(state);
      data.quadrant = blockQuadrant;
      finalizeResponseData(data, blockName, state, stimulusValue);
      appendSharedResponseData(data, sharedData);
    },
  };
}

function buildOrientationPersistentTrial({
  blockPosition,
  blockQuadrant,
  responseInitial,
  stimulusValue,
  sharedData,
  jsPsych,
  timing,
}) {
  const responseStartMs = timing.responseStartMs;
  const state = createBaseState(responseInitial);

  const responseStimuli = buildOrientationPsychophysicsStimuli(blockPosition, responseInitial, {
    change_attr: (stim) => {
      stim.tilt = wrapAngle(90 - state.value, 180);
      stim.contrast = state.hasInteracted ? ORIENTATION_GABOR_CONFIG.contrast : 0;
      if (stim.pixi_obj) {
        stim.pixi_obj.alpha = state.hasInteracted ? 1 : 0;
      }
      if (stim.pixi_obj?.filters?.[0]) {
        stim.pixi_obj.filters[0].uniforms.angle_in_degrees = 90 + stim.tilt;
        stim.pixi_obj.filters[0].uniforms.Contrast = stim.contrast;
        stim.pixi_obj.filters[0].uniforms.modulateColor_Alpha = state.hasInteracted ? 1 : 0;
      }
    },
  }).map((stimulus) => ({
    ...stimulus,
    show_start_time: responseStartMs,
  }));

  const stimuli = [
    ...stripOrientationFrameStimuli(buildOrientationPsychophysicsStimuli(blockPosition, stimulusValue)).map((stimulus) => ({
      ...stimulus,
      show_start_time: timing.stimulusStartMs,
      show_end_time: timing.maskStartMs,
    })),
    ...stripOrientationFrameStimuli(
      buildOrientationMaskPsychophysicsStimuli(blockPosition, { includeFixation: false }),
    ).map((stimulus) => ({
      ...stimulus,
      show_start_time: timing.maskStartMs,
      show_end_time: timing.responseFixationStartMs,
    })),
    ...stripOrientationFrameStimuli(responseStimuli),
  ];

  return {
    type: PsychophysicsPlugin,
    pixi: true,
    background_color: "#808080",
    canvas_width: window.innerWidth,
    canvas_height: window.innerHeight,
    stimuli,
    prompt: buildOrientationOverlayHtml(blockPosition),
    choices: "NO_KEYS",
    response_ends_trial: false,
    data: { ...sharedData, segment: "response" },
    on_load: () => {
      const overflowCleanup = withHiddenOverflow();
      attachSharedCleanup(state, [overflowCleanup]);

      schedulePhase(state, timing.stimulusStartMs, () => {
        state.renderingTimestamp = Date.now();
      });

      schedulePhase(state, responseStartMs, () => {
        const responseUi = document.getElementById("orientation-response-ui");
        if (responseUi) responseUi.style.visibility = "visible";
        const cleanup = mountOrientationSelector({ state, jsPsych, stimulusValue });
        attachSharedCleanup(state, cleanup);
        armTimeout(jsPsych, state, { stimulus_value: stimulusValue, quadrant: blockQuadrant });
      });
    },
    on_finish: (data) => {
      cleanupTrial(state);
      data.quadrant = blockQuadrant;
      finalizeResponseData(data, "orientation", state, stimulusValue);
      appendSharedResponseData(data, sharedData);
    },
  };
}

export function buildPersistentTrial({
  blockName,
  blockPosition,
  blockQuadrant,
  responseInitial,
  stimulusValue,
  colorMeta,
  sharedData,
  jsPsych,
  timing,
}) {
  if (blockName === "orientation") {
    return buildOrientationPersistentTrial({
      blockPosition,
      blockQuadrant,
      responseInitial,
      stimulusValue,
      sharedData,
      jsPsych,
      timing,
    });
  }

  return buildHtmlPersistentTrial({
    blockName,
    blockPosition,
    blockQuadrant,
    responseInitial,
    stimulusValue,
    colorMeta,
    sharedData,
    jsPsych,
    timing,
  });
}
