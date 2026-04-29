/*
  Utility functions for the experiment.
  These functions are used throughout the experiment.
*/

import chroma from "chroma-js";
import {
  COLOR_WHEEL_C,
  COLOR_WHEEL_L,
  NUMEROSITY_MAX,
  NUMEROSITY_MIN,
  ORIENTATION_PERIOD,
  ORIENTATION_GABOR_CONFIG,
  STIMULUS_DIAMETER_PX,
} from "./config.js";

export const DEFAULT_SEQUENCE_META = {
  sequence_id: null,
  sequence_trial_index: null,
  previous_stimulus_value: null,
  pairwise_difference_signed: null,
  pairwise_difference_abs: null,
  pairwise_difference_log_signed: null,
  pairwise_difference_log_abs: null,
};

/*
  Utility functions for angle manipulation.
  These are used to wrap the angle to a specific period. 
  This is important because orientation is 180-periodic and color is 360-periodic.
  So, we will need to wrap the angle to the specific period.
*/
export function wrapAngle(value, period) {
  let wrapped = value % period;
  if (wrapped < 0) wrapped += period;
  return wrapped;
}

/*`
  These are used to calculate the circular error between two angles.
*/
export function circularError(response, target, period) {
  let delta = response - target;
  while (delta > period / 2) delta -= period;
  while (delta < -period / 2) delta += period;
  return delta;
}

/*
  Ease of use function to get the value range for a specific block.
*/
export function valueRange(blockName) {
  if (blockName === "orientation") return ORIENTATION_PERIOD;
  if (blockName === "color") return 360;
  return 75;
}

export function ensureChromaLoaded() {
  if (chroma.valid("lch(50 100 270)")) return;
  throw new Error("Chroma.js is not loaded");
}

/*
  In this experiment, stimulus values for color are represented as hues.
  To make it easier to render the stimulus, we will convert the hue to an LCH color.

  - First, we will wrap the hue to the range of 0 to 360 degrees.
  - Then, we will convert the hue to an LCH color.
  - We will return the LCH color, the hex color, the chroma value, and the hue.
*/
export function lchColorFromHue(hueLikeValue) {
  const hue = wrapAngle(hueLikeValue, 360);
  const color = chroma.lch(COLOR_WHEEL_L, COLOR_WHEEL_C, hue);
  return {
    color,
    hex: color.hex(),
    renderedC: Number(color.get("lch.c").toFixed(3)),
    hue,
  };
}

/*
  Compute the response error for a specific block.
  This is used to compute the error between the response and the stimulus.
  - Orientation is 180-periodic, so we will use the circular error function.
  - Color is 360-periodic, so we will use the circular error function.
  - Numerosity is linear, so we will use the absolute difference.
*/
export function computeResponseError(blockName, responseValue, stimulusValue) {
  if (blockName === "orientation") return circularError(responseValue, stimulusValue, ORIENTATION_PERIOD);
  if (blockName === "color") return circularError(responseValue, stimulusValue, 360);
  return responseValue - stimulusValue;
}

/*
  Normalize the response value for a specific block.
  This is used to normalize the response value to the range of the stimulus value.
  - Orientation is 180-periodic, so we will wrap the value to the range of 0 to 180 degrees.
  - Color is 360-periodic, so we will wrap the value to the range of 0 to 360 degrees.
  - Numerosity is linear, so we will clamp the value to the range of NUMEROSITY_MIN and NUMEROSITY_MAX.
*/
export function normalizeResponseValue(blockName, value) {
  if (blockName === "orientation") return wrapAngle(value, ORIENTATION_PERIOD);
  if (blockName === "color") return wrapAngle(value, 360);
  return Math.max(NUMEROSITY_MIN, Math.min(NUMEROSITY_MAX, Math.round(value)));
}

/*
  The viewport position is a percentage of the viewport width and height, and 
  we will convert the viewport position to a canvas offset.
*/
export function viewportPositionToCanvasOffset(position) {
  return {
    x: window.innerWidth * (position.x / 100) - window.innerWidth / 2,
    y: window.innerHeight * (position.y / 100) - window.innerHeight / 2,
  };
}

export function trialMeta(
  blockName,
  blockIndex,
  blockOrder,
  phase,
  trialNumber,
  quadrant,
  position,
  stimulusValue,
  renderedChroma = null,
  sequenceMeta = DEFAULT_SEQUENCE_META,
) {
  return {
    block_number: blockIndex + 1,
    block_order: blockOrder.join("|"),
    block_order_position: blockIndex + 1,
    block_name: blockName,
    trial_phase: phase,
    is_practice: phase === "practice",
    trial_number: trialNumber,
    quadrant,
    stimulus_x: Number(position.x.toFixed(1)),
    stimulus_y: Number(position.y.toFixed(1)),
    stimulus_value: stimulusValue,
    rendered_chroma: renderedChroma,
    stimulus_contrast: blockName === "orientation" ? ORIENTATION_GABOR_CONFIG.contrast : null,
    stimulus_size_px: STIMULUS_DIAMETER_PX,
    stimulus_size_visual_degrees: null,
    ...DEFAULT_SEQUENCE_META,
    ...sequenceMeta,
  };
}

export function responseStepDelta(blockName, previousValue, nextValue) {
  if (blockName === "orientation") return circularError(nextValue, previousValue, ORIENTATION_PERIOD);
  if (blockName === "color") return circularError(nextValue, previousValue, 360);
  return nextValue - previousValue;
}
