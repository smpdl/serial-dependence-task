import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import {
  MASK_DURATION_MS,
  PRE_RESPONSE_FIXATION_DURATION_MS,
  PRE_STIMULUS_FIXATION_DURATION_MS,
  STIMULUS_DURATION_MS,
} from "./config.js";
import { buildScreenWithFixation } from "./fixation.js";
import { buildPersistentTrial } from "./reconstruction.js";

function buildTrialTiming() {
  const fixationStartMs = 0;
  const stimulusStartMs = fixationStartMs + PRE_STIMULUS_FIXATION_DURATION_MS;
  const maskStartMs = stimulusStartMs + STIMULUS_DURATION_MS;
  const responseFixationStartMs = maskStartMs + MASK_DURATION_MS;
  const responseStartMs = responseFixationStartMs + PRE_RESPONSE_FIXATION_DURATION_MS;

  return {
    fixationStartMs,
    stimulusStartMs,
    maskStartMs,
    responseFixationStartMs,
    responseStartMs,
    preStimulusFixationDurationMs: PRE_STIMULUS_FIXATION_DURATION_MS,
    stimulusDurationMs: STIMULUS_DURATION_MS,
    maskDurationMs: MASK_DURATION_MS,
    preResponseFixationDurationMs: PRE_RESPONSE_FIXATION_DURATION_MS,
  };
}

function buildPracticeTimeoutTrial(jsPsych) {
  return {
    timeline: [
      {
        type: HtmlKeyboardResponsePlugin,
        stimulus: buildScreenWithFixation(`
          <div class="readable-text" style="display:grid;justify-items:center;">
            <div style="border:3px solid #c62828;border-radius:12px;padding:18px 22px;max-width:520px;">
            <p><strong>Timed out.</strong></p>
            <p>Please respond before the deadline on the next practice trial.</p>
            </div>
          </div>
        `),
        choices: "NO_KEYS",
        trial_duration: 2000,
      },
    ],
    conditional_function: () => {
      const lastTrial = jsPsych.data.get().last(1).values()[0];
      return lastTrial?.response_timeout === true;
    },
  };
}

export function appendSingleTrial({
  timeline,
  sharedData,
  blockPosition,
  blockQuadrant,
  responseInitial,
  stimulusValue,
  colorMeta,
  blockName,
  jsPsych,
}) {
  timeline.push(
    buildPersistentTrial({
      blockName,
      blockPosition,
      blockQuadrant,
      responseInitial,
      stimulusValue,
      colorMeta,
      sharedData,
      jsPsych,
      timing: buildTrialTiming(),
    }),
  );

  if (sharedData.is_practice) {
    timeline.push(buildPracticeTimeoutTrial(jsPsych));
  }
}
