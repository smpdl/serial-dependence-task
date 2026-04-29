export const STIMULUS_DIAMETER_PX = 250;
export const MASK_BLUR_PX = 5;
export const APERTURE_BORDER_PX = 10;
export const APERTURE_BORDER_COLOR = "#000";

export const RESPONSE_DEADLINE_MS = 5000;
export const PRE_STIMULUS_FIXATION_DURATION_MS = 250;
export const STIMULUS_DURATION_MS = 500;
export const MASK_DURATION_MS = 1000;
export const PRE_RESPONSE_FIXATION_DURATION_MS = 250;

export const PRACTICE_TRIALS_PER_BLOCK = 10;
export const MAIN_TRIALS_PER_BLOCK = 201;

export const TRIAL_PHASE_SEQUENCE = ["fixation", "stimulus", "mask", "fixation", "response"];

export const PRACTICE_SEQUENCES = {
  color: [0, 40, 80, 120, 160, 200, 240, 280, 320, 350],
  orientation: [0, 20, 40, 60, 80, 100, 120, 140, 160, 170],
  numerosity: [25, 28, 32, 37, 42, 47, 52, 57, 61, 65],
};

export const BLOCK_NAMES = ["orientation"];
export const QUADRANTS = ["upper_left", "upper_right", "lower_left", "lower_right"];

export const ORIENTATION_PERIOD = 180;
export const NUMEROSITY_MIN = 25;
export const NUMEROSITY_MAX = 65;

export const FIXATION_COLOR = "#fff";
export const FIXATION_FONT_SIZE_PX = 74;
export const FIXATION_LINE_HEIGHT = 1;
export const FIXATION_HIT_SIZE_PX = 112;

export const ORIENTATION_GABOR_CONFIG = {
  width: STIMULUS_DIAMETER_PX - APERTURE_BORDER_PX * 4,
  sf: 0.03,
  sc: 30,
  contrast: 0.55,
  disableNorm: true,
  phase: 0,
  method: "pixi",
};

// These viewport positions are kept as an approximation of the
// desired eccentricity.
export const STIMULUS_POSITIONS = {
  upper_left: { x: 30, y: 30 },
  upper_right: { x: 70, y: 30 },
  lower_left: { x: 30, y: 70 },
  lower_right: { x: 70, y: 70 },
};

// these are the default values for the color wheel.
export const COLOR_WHEEL_L = 70;
export const COLOR_WHEEL_C = 40;
