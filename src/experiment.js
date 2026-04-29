/**
 * @title Experiment 
 * @description This experiment tries to quantify individual differences for serial dependence effect in orientation, color perception, and numerosity.
 * @version 1.0.0
 * @assets assets/
 */

import "../styles/main.scss";

import { initJsPsych } from "jspsych";
import PipePlugin from "@jspsych-contrib/plugin-pipe";
import {
  BLOCK_NAMES,
  MAIN_TRIALS_PER_BLOCK,
  NUMEROSITY_MIN,
  PRACTICE_TRIALS_PER_BLOCK,
  QUADRANTS,
  STIMULUS_POSITIONS,
} from "./config.js";

import { pushBlockIntro, pushBootstrapTimeline, pushExperimentEnd, pushPracticeComplete } from "./bootstrap.js";
import { getMainSequenceTrial, getPracticeSequenceTrial, setPrecomputedMainSequences } from "./sampling/sequenceRuntime.js";
import { appendSingleTrial } from "./buildTrialPipeline.js";
import { ensureChromaLoaded, lchColorFromHue, trialMeta } from "./utils.js";

// sequenceData.json has the precomputed set of sequences for the experiment.
// it is used to ensure that the sequences are the same for each participant and
// we have adequate coverage of the stimulus space.
async function loadSequenceData(assetPaths) {
  const jsonPath = assetPaths.misc?.find((path) => path.includes("sequenceData.json"));
  if (!jsonPath) {
    throw new Error("Could not find sequenceData.json in assetPaths.misc.");
  }

  let sequenceData = null;
  console.log("Found sequenceData.json in assetPaths:", jsonPath);

  try {
    const response = await fetch(jsonPath);
    sequenceData = await response.json();
    console.log("Successfully loaded sequence data from assetPaths");
  } catch (error) {
    console.error("Failed to load sequence data from assetPaths:", error);
    throw error;
  }

  return sequenceData;
}

function buildSaveDataTrial(jsPsych, filename) {
  return {
    type: PipePlugin,
    action: "save",
    experiment_id: "aFmbbDSZhzMd",
    filename,
    data_string: () => jsPsych.data.get().json(),
  };
}

export async function run({ assetPaths }) {
  const jsPsych = initJsPsych();
  const timeline = [];
  const subjectId = jsPsych.randomization.randomID(10);
  const filename = `${subjectId}.json`;
  jsPsych.data.addProperties({
    subject_id: subjectId,
    data_filename: filename,
  });
  // block order will be randomized for each participant.
  // we will not do counterbalancing for the block order or quadrant assignment.
  // because of the nature of online experiment. 
  const blockOrder = jsPsych.randomization.shuffle(BLOCK_NAMES);
  const blockQuadrants = jsPsych.randomization.sampleWithoutReplacement(QUADRANTS, blockOrder.length);

  // load the chorma library for color computation.
  // essential dependency for the experiment.
  ensureChromaLoaded();
  setPrecomputedMainSequences(await loadSequenceData(assetPaths));

  // bootstrap the timeline with necessary plugins, initial welcome message
  // consent form, fullscreen, and instructions.
  pushBootstrapTimeline(timeline, assetPaths, jsPsych);

  // loop through each block and add the trials to the timeline.
  // for each block, we will add practice trials first, then main trials.
  blockOrder.forEach((blockName, blockIndex) => {

    // since we have found that in foveal conditions, we can better isolate the
    // serial dependence effect, we will place the stimuli in specific quadrants.
    // this will be randomized for each block, so no two blocks will have the same
    // quadrant assignment.
    const blockQuadrant = blockQuadrants[blockIndex];

    // based on the quadrant, we will place the stimuli in specific stimulus positions 
    // defined in the config. 
    const blockPosition = STIMULUS_POSITIONS[blockQuadrant];

    // push the block intro message to the timeline.
    // this will include the block name, the number of practice trials, and the instructions.
    pushBlockIntro(timeline, blockIndex, blockName);

    // add a trial to the timeline.
    // this will include the stimulus, response, and feedback.
    const addTrial = (phase, trialNumber) => {
      const mainSequenceTrial = phase === "main" ? getMainSequenceTrial(blockName, trialNumber) : null;
      const practiceSequenceTrial = phase === "practice" ? getPracticeSequenceTrial(blockName, trialNumber) : null;
      const stimulusValue = mainSequenceTrial?.stimulusValue ?? practiceSequenceTrial.stimulusValue;
      const colorMeta = blockName === "color" ? lchColorFromHue(stimulusValue) : null;
      const responseInitial = blockName === "numerosity" ? NUMEROSITY_MIN : 0;
      const sharedData = trialMeta(
        blockName,
        blockIndex,
        blockOrder,
        phase,
        trialNumber,
        blockQuadrant,
        blockPosition,
        stimulusValue,
        colorMeta?.renderedC ?? null,
        mainSequenceTrial?.sequenceMeta,
      );

      // append the trial to the timeline.
      appendSingleTrial({
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
      });
    };

    // add the practice trials to the timeline.
    for (let i = 1; i <= PRACTICE_TRIALS_PER_BLOCK; i += 1) addTrial("practice", i);
    // push the practice complete message to the timeline.
    pushPracticeComplete(timeline, blockIndex);
    // add the main trials to the timeline.
    for (let i = 1; i <= MAIN_TRIALS_PER_BLOCK; i += 1) addTrial("main", i);
  });

  // push the experiment end message to the timeline.
  pushExperimentEnd(timeline);
  timeline.push(buildSaveDataTrial(jsPsych, filename));
  // run the timeline.
  await jsPsych.run(timeline);
  // return the jsPsych instance.
  return jsPsych;
}
