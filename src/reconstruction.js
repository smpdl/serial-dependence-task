/*
  Builds the response page.
*/

import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import PsychophysicsPlugin from "@kurokida/jspsych-psychophysics";
import { createAngleSelector } from "./clock.js";
import {
  NUMEROSITY_MAX,
  NUMEROSITY_MIN,
  RESPONSE_DEADLINE_MS,
} from "./config.js";
import {
  buildOrientationPsychophysicsStimuli,
  buildColorWheelGradient,
  buildPreviewShellHtml,
  buildStimulusInnerHtml,
} from "./stimuli.js";
import {
  computeResponseError,
  lchColorFromHue,
  normalizeResponseValue,
  wrapAngle,
} from "./utils.js";

/*
  This is the base response layout.
  It includes the preview layer and the control elements.
*/
function buildResponseLayout({ blockName, blockPosition, controlHtml, promptHtml }) {
  return `
    <div id="response-root" style="position:relative;width:100vw;height:100vh;color:#000;">
      <div id="response-preview-layer" style="position:absolute;inset:0;pointer-events:none;">
        ${buildPreviewShellHtml(blockPosition)}
      </div>
      <div style="max-width:520px;margin:0 auto;padding-top:24px;text-align:center;">
        <p>${promptHtml}</p>
        ${controlHtml}
      </div>
    </div>
  `;
}

function buildOrientationResponseMarkup() {
  return `
    <div style="position:fixed;inset:0;pointer-events:none;color:#000;">
      <div style="max-width:520px;margin:0 auto;padding-top:24px;text-align:center;pointer-events:auto;">
        <p>Use the arrow pointer to match the orientation of the grating you just saw.</p>
        <div style="display:grid;justify-items:center;gap:12px;">
          <div data-orientation-selector></div>
        </div>
        <button id="confirm-btn" class="jspsych-btn" style="margin-top:16px;">Continue</button>
      </div>
    </div>
  `;
}

function buildColorResponseHtml(blockPosition, initialValue) {
  return buildResponseLayout({
    blockPosition,
    promptHtml: "Use the color wheel to match the color of the patch you just saw.",
    controlHtml: `
      <div id="color-wheel" style="
        margin:0 auto;
        width:220px;
        height:220px;
        border-radius:50%;
        background:${buildColorWheelGradient()};
        position:relative;
        cursor:pointer;
      ">
        <div id="color-pointer" style="
          position:absolute;
          left:50%;
          top:50%;
          width:3px;
          height:84px;
          background:#fff;
          transform-origin:bottom center;
          transform:translate(-50%, -100%) rotate(${initialValue}deg);
        "></div>
      </div>
      <button id="confirm-btn" class="jspsych-btn" style="margin-top:16px;">Continue</button>
    `,
  });
}

function buildNumerosityResponseHtml(blockPosition, initialValue) {
  return buildResponseLayout({
    blockPosition,
    promptHtml: "Use the slider to match how many dots you saw.",
    controlHtml: `
      <input
        id="num-slider"
        type="range"
        min="${NUMEROSITY_MIN}"
        max="${NUMEROSITY_MAX}"
        step="1"
        value="${Math.round(initialValue)}"
        style="width:320px;"
      />
      <button id="confirm-btn" class="jspsych-btn" style="margin-top:16px;">Continue</button>
    `,
  });
}

function buildResponsePreviewMarkup(blockName, blockPosition, state, extra = {}) {
  const content = state.hasInteracted
    ? buildStimulusInnerHtml(blockName, state.value, extra)
    : "";

  return `
    <div style="position:absolute;inset:0;pointer-events:none;">
      ${buildPreviewShellHtml(blockPosition).replace("</div>", `${content}</div>`)}
    </div>
  `;
}

function setPreviewHtml(blockName, blockPosition, state, extra = {}) {
  const layer = document.getElementById("response-preview-layer");
  if (!layer) return;

  layer.innerHTML = buildResponsePreviewMarkup(blockName, blockPosition, state, extra);
}

// runs all the cleanup functions and resets the timeout id.
function attachSharedCleanup(state, handlers) {
  window.__sdtPointerCleanup = () => {
    handlers.forEach((cleanup) => cleanup());
    state.timeoutId = null;
    window.__sdtPointerCleanup = null;
  };
}
// check if the response timed out and set the response data.
// if not, set the response data to the response value, and calculate
// the response error.
function finalizeResponseData(data, blockName, state, stimulusValue) {
  if (state.timeoutId !== null) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  const responseTimedOut = !state.confirmed;
  data.response_timeout = responseTimedOut;
  data.stimulus_value = stimulusValue;
  data.response_value = responseTimedOut ? null : state.responseValue;
  data.response_error = responseTimedOut
    ? null
    : computeResponseError(blockName, state.responseValue, stimulusValue);
}

function mountOrientationSelector({ state, jsPsych, stimulusValue, onFirstInteraction = null }) {
  const valueEl = document.getElementById("response-value");
  const root = document.querySelector("[data-orientation-selector]");
  const confirmBtn = document.getElementById("confirm-btn");
  if (!root) return () => {};

  // create the angle selector so that the participant can select the orientation of the grating.
  const selector = createAngleSelector(root, {
    size: 260,
    radius: 95,
    initialDegrees: state.value,
    // when the participant interacts with the angle selector, we will update the state.
    onChange: (degrees, _radians, meta = {}) => {
      // this is to make sure that we don't preview the response value when the participant is not interacting with the angle selector.
      // and initially, the preview is not shown.
      const isUserInteraction = meta.source === "pointer";
      if (!isUserInteraction) {
        if (valueEl) valueEl.textContent = normalizeResponseValue("orientation", degrees).toFixed(1);
        return;
      }
      if (!state.hasInteracted) onFirstInteraction?.();
      state.hasInteracted = true;
      state.value = normalizeResponseValue("orientation", degrees);
      state.responseValue = state.value;
      if (valueEl) valueEl.textContent = state.value.toFixed(1);
    },
  });

  const onConfirm = () => {
    state.confirmed = true;
    jsPsych.finishTrial({
      stimulus_value: stimulusValue,
    });
  };

  if (valueEl) valueEl.textContent = state.value.toFixed(1);
  confirmBtn?.addEventListener("click", onConfirm);
  return [
    () => selector.destroy(),
    () => confirmBtn?.removeEventListener("click", onConfirm),
  ];
}

function mountColorWheel({ state, blockPosition, jsPsych, stimulusValue }) {
  const wheel = document.getElementById("color-wheel");
  const valueEl = document.getElementById("response-value");
  const pointer = document.getElementById("color-pointer");
  const confirmBtn = document.getElementById("confirm-btn");

  // update the UI to show the current value and the preview.
  const updateUi = () => {
    if (pointer) pointer.style.transform = `translate(-50%, -100%) rotate(${state.value}deg)`;
    if (valueEl) valueEl.textContent = state.value.toFixed(1);
    setPreviewHtml("color", blockPosition, state, { colorHex: lchColorFromHue(state.value).hex });
  };

  // convert the pointer positon to an angle.
  const pointerToAngle = (ev) => {
    if (!wheel) return;
    // get the bounding rectangle of the color wheel.
    const rect = wheel.getBoundingClientRect();
    // get the center of the color wheel.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // get the distance between the pointer and the center of the color wheel.
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    // convert the distance to an angle.
    const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
    // update the state and the UI.
    state.hasInteracted = true;
    state.value = normalizeResponseValue("color", degrees + 90);
    state.responseValue = state.value;
    updateUi();
  };

  let dragging = false;
  // when the pointer is down, we will start dragging.
  const onDown = (ev) => {
    dragging = true;
    pointerToAngle(ev);
  };
  // when the pointer is moving, we will update the angle.
  const onMove = (ev) => {
    if (dragging) pointerToAngle(ev);
  };
  // when the pointer is up, we will stop dragging.
  const onUp = () => {
    dragging = false;
  };
  // when the participant confirms the response, we will finish the trial.
  const onConfirm = () => {
    state.confirmed = true;
    jsPsych.finishTrial({
      stimulus_value: stimulusValue,
    });
  };

  // attach the event listeners to the color wheel and the document.
  wheel?.addEventListener("pointerdown", onDown);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  confirmBtn?.addEventListener("click", onConfirm);
  updateUi();

  // return the cleanup functions to be used in the trial.
  return [
    // remove the event listeners from the color wheel.
    () => wheel?.removeEventListener("pointerdown", onDown),
    // remove the event listeners from the document.
    () => document.removeEventListener("pointermove", onMove),
    // remove the event listeners from the document.
    () => document.removeEventListener("pointerup", onUp),
    // remove the event listeners from the confirm button.
    () => confirmBtn?.removeEventListener("click", onConfirm),
  ];
}

function mountNumerositySlider({ state, blockPosition, jsPsych, stimulusValue }) {
  const slider = document.getElementById("num-slider");
  const valueEl = document.getElementById("response-value");
  const confirmBtn = document.getElementById("confirm-btn");

  const updateUi = () => {
    if (slider) slider.value = String(Math.round(state.value));
    if (valueEl) valueEl.textContent = String(Math.round(state.value));
    setPreviewHtml("numerosity", blockPosition, state, {
      arrangementSeed: Math.floor(Math.random() * 0x7fffffff),
    });
  };

  const onInput = () => {
    state.hasInteracted = true;
    state.value = Number(slider?.value ?? state.value);
    state.responseValue = Math.round(state.value);
    updateUi();
  };
  const onConfirm = () => {
    state.confirmed = true;
    jsPsych.finishTrial({
      stimulus_value: stimulusValue,
    });
  };

  slider?.addEventListener("input", onInput);
  confirmBtn?.addEventListener("click", onConfirm);
  setPreviewHtml("numerosity", blockPosition, state);

  return [
    () => slider?.removeEventListener("input", onInput),
    () => confirmBtn?.removeEventListener("click", onConfirm),
  ];
}

function armTimeout(jsPsych, state, payload = {}) {
  state.timeoutId = window.setTimeout(() => {
    if (state.confirmed) return;
    jsPsych.finishTrial(payload);
  }, RESPONSE_DEADLINE_MS);
}

export function buildOrientationResponse({ responseInitial, stimulusValue, blockPosition, blockQuadrant, jsPsych }) {
  const state = {
    value: responseInitial,
    responseValue: responseInitial,
    hasInteracted: false,
    confirmed: false,
    timeoutId: null,
  };

  // builds the object for jsPsych to show everything properly
  const stimuli = buildOrientationPsychophysicsStimuli(blockPosition, responseInitial, {
    modulate_color: [1, 1, 1, 0],
    // this is the function that will be called when the stimulus is changed.
    // we will use this to update the tilt of the stimulus and the alpha of the stimulus.
    change_attr: (stim) => {
      stim.tilt = wrapAngle(90 - state.value, 180);
      // if user hasn't interacted with the stimulus, we will set the alpha to 0.
      if (stim.pixi_obj) {
        stim.pixi_obj.alpha = state.hasInteracted ? 1 : 0;
      }
      // if the stimulus has a filter, we will update the filter uniforms.
      if (stim.pixi_obj?.filters?.[0]) {
        stim.pixi_obj.filters[0].uniforms.angle_in_degrees = 90 + stim.tilt;
        stim.pixi_obj.filters[0].uniforms.Contrast = state.hasInteracted ? stim.contrast : 0;
        stim.pixi_obj.filters[0].uniforms.modulateColor_Alpha = state.hasInteracted ? 1 : 0;
      }
    },
  });
  // find the gabor stimulus in the stimuli array.
  const gaborStimulus = stimuli.find((stim) => stim.obj_type === "gabor");

  // this is the function that will be called when the participant first interacts with the stimulus.
  // we will use this to set the alpha of the stimulus to 1.
  const onFirstInteraction = () => {
    if (gaborStimulus?.instance?.pixi_obj) {
      gaborStimulus.instance.pixi_obj.alpha = 1;
    }
    if (gaborStimulus?.instance?.pixi_obj?.filters?.[0]) {
      gaborStimulus.instance.pixi_obj.filters[0].uniforms.Contrast = gaborStimulus.contrast;
      gaborStimulus.instance.pixi_obj.filters[0].uniforms.modulateColor_Alpha = 1;
    }
  };

  // return the object for jsPsych to show everything properly
  return {
    type: PsychophysicsPlugin,
    pixi: true,
    background_color: "#808080",
    canvas_width: window.innerWidth,
    canvas_height: window.innerHeight,
    stimuli,
    prompt: buildOrientationResponseMarkup(),
    choices: "NO_KEYS",
    response_ends_trial: false,
    trial_duration: RESPONSE_DEADLINE_MS,
    on_load: () => {
      const cleanup = mountOrientationSelector({
        state,
        jsPsych,
        stimulusValue,
        onFirstInteraction,
      });
      attachSharedCleanup(state, cleanup);
    },
    on_finish: (data) => {
      data.quadrant = blockQuadrant;
      finalizeResponseData(data, "orientation", state, stimulusValue);
    },
  };
}

export function buildColorResponse({ responseInitial, stimulusValue, blockQuadrant, blockPosition, jsPsych }) {
  const state = {
    value: responseInitial,
    responseValue: responseInitial,
    hasInteracted: false,
    confirmed: false,
    timeoutId: null,
  };

  return {
    type: HtmlKeyboardResponsePlugin,
    stimulus: buildColorResponseHtml(blockPosition, responseInitial),
    choices: "NO_KEYS",
    on_load: () => {
      const cleanup = mountColorWheel({ state, blockPosition, jsPsych, stimulusValue });
      attachSharedCleanup(state, cleanup);
      armTimeout(jsPsych, state, {
        stimulus_value: stimulusValue,
        quadrant: blockQuadrant,
      });
    },
    on_finish: (data) => {
      data.quadrant = blockQuadrant;
      finalizeResponseData(data, "color", state, stimulusValue);
    },
  };
}

export function buildNumerosityResponse({ responseInitial, stimulusValue, blockQuadrant, blockPosition, jsPsych }) {
  const state = {
    value: responseInitial,
    responseValue: Math.round(responseInitial),
    hasInteracted: false,
    confirmed: false,
    timeoutId: null,
  };

  return {
    type: HtmlKeyboardResponsePlugin,
    stimulus: buildNumerosityResponseHtml(blockPosition, responseInitial),
    choices: "NO_KEYS",
    on_load: () => {
      const cleanup = mountNumerositySlider({ state, blockPosition, jsPsych, stimulusValue });
      attachSharedCleanup(state, cleanup);
      armTimeout(jsPsych, state, {
        stimulus_value: stimulusValue,
        quadrant: blockQuadrant,
      });
    },
    on_finish: (data) => {
      data.quadrant = blockQuadrant;
      finalizeResponseData(data, "numerosity", state, stimulusValue);
    },
  };
}
