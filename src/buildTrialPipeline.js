import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import PsychophysicsPlugin from "@kurokida/jspsych-psychophysics";
import { FIXATION_HTML, TRIAL_PHASE_SEQUENCE } from "./config.js";
import { buildMaskHtml, buildOrientationMaskPsychophysicsStimuli } from "./mask.js";
import {
  buildColorResponse,
  buildNumerosityResponse,
  buildOrientationResponse,
} from "./reconstruction.js";
import {
  buildCanvasFixationStimulus,
  buildOrientationPsychophysicsStimuli,
  buildStimulusHtml,
} from "./stimuli.js";


function addTimelineSegment(timeline, segment, stimulus, sharedData, extraConfig = {}) {
  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus,
    choices: "NO_KEYS",
    data: { ...sharedData, segment },
    ...extraConfig,
  });
}

function buildFullScreenHtml(content) {
  return `<div style="position:relative;width:100vw;height:100vh;">${content}</div>`;
}

export function buildTrialPhaseDefinitions({ blockName, stimulusValue, blockPosition, colorMeta }) {
  if (blockName === "orientation") {
    return [
      {
        segment: "stimulus",
        type: PsychophysicsPlugin,
        pixi: true,
        background_color: "#808080",
        canvas_width: window.innerWidth,
        canvas_height: window.innerHeight,
        // we will need a canvas fixation stimulus to ensure the participant is fixating on the stimulus.
        stimuli: [
          ...buildOrientationPsychophysicsStimuli(blockPosition, stimulusValue),
          buildCanvasFixationStimulus(),
        ],
        choices: "NO_KEYS",
        trial_duration: 500,
      },
      {
        segment: "mask",
        type: PsychophysicsPlugin,
        pixi: true,
        background_color: "#808080",
        canvas_width: window.innerWidth,
        canvas_height: window.innerHeight,
        stimuli: buildOrientationMaskPsychophysicsStimuli(blockPosition),
        trial_duration: 1000,
      },
      {
        segment: "fixation",
        type: PsychophysicsPlugin,
        pixi: true,
        background_color: "#808080",
        canvas_width: window.innerWidth,
        canvas_height: window.innerHeight,
        stimuli: [buildCanvasFixationStimulus()],
        trial_duration: 250,
      },
    ];
  }

  return [
    {
      segment: "stimulus",
      stimulus: buildFullScreenHtml(
        `${buildStimulusHtml(blockName, stimulusValue, blockPosition, { colorHex: colorMeta?.hex })}${FIXATION_HTML}`,
      ),
      trial_duration: 500,
    },
    {
      segment: "mask",
      stimulus: buildFullScreenHtml(`${buildMaskHtml(blockPosition)}${FIXATION_HTML}`),
      trial_duration: 1000,
    },
    {
      segment: "fixation",
      stimulus: buildFullScreenHtml(FIXATION_HTML),
      trial_duration: 250,
    },
  ];
}

function buildResponseTask({ blockName, responseInitial, stimulusValue, blockQuadrant, blockPosition, jsPsych }) {
  if (blockName === "orientation") {
    return buildOrientationResponse({
      responseInitial,
      stimulusValue,
      blockPosition,
      blockQuadrant,
      jsPsych,
    });
  }
  if (blockName === "color") {
    return buildColorResponse({
      responseInitial,
      stimulusValue,
      blockQuadrant,
      blockPosition,
      jsPsych,
    });
  }
  return buildNumerosityResponse({
    responseInitial,
    stimulusValue,
    blockQuadrant,
    blockPosition,
    jsPsych,
  });
}

function appendSharedResponseData(data, sharedData) {
  data.block_number = sharedData.block_number;
  data.block_name = sharedData.block_name;
  data.trial_phase = sharedData.trial_phase;
  data.segment = "response";
  data.trial_number = sharedData.trial_number;
  data.quadrant = sharedData.quadrant;
  data.stimulus_x = sharedData.stimulus_x;
  data.stimulus_y = sharedData.stimulus_y;
  data.stimulus_value = sharedData.stimulus_value;
  data.rendered_chroma = sharedData.rendered_chroma;
}

export function appendSingleTrial({
  timeline,
  phase,
  sharedData,
  blockPosition,
  blockQuadrant,
  responseInitial,
  stimulusValue,
  colorMeta,
  blockName,
  jsPsych,
}) {
  const phaseDefinitions = buildTrialPhaseDefinitions({
    blockName,
    stimulusValue,
    blockPosition,
    colorMeta,
  });

  phaseDefinitions.forEach((segment) => {
    if (segment.type) {
      timeline.push({
        ...segment,
        data: { ...sharedData, segment: segment.segment },
      });
      return;
    }

    addTimelineSegment(timeline, segment.segment, segment.stimulus, sharedData, {
      trial_duration: segment.trial_duration,
    });
  });

  const responseTrial = buildResponseTask({
    blockName,
    responseInitial,
    stimulusValue,
    blockQuadrant,
    blockPosition,
    jsPsych,
  });

  timeline.push({
    ...responseTrial,
    data: { ...sharedData, segment: "response" },
    on_finish: (data) => {
      if (window.__sdtPointerCleanup) window.__sdtPointerCleanup();
      responseTrial.on_finish?.(data);
      appendSharedResponseData(data, sharedData);
    },
  });
  // add a post-response fixation stimulus to ensure the participant is fixating on the fixation cross.
  // or otherwise the participant may not have time to actually fixate on the fixation cross
  addTimelineSegment(
    timeline,
    "post_response_fixation",
    buildFullScreenHtml(FIXATION_HTML),
    sharedData,
    { trial_duration: 250 },
  );

}
