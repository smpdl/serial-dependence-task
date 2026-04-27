/*
  This file contains the runtime functions for the main sequence.
  It is used to get the main sequence, the practice sequence, and the trial metadata.
  The precomputed main sequences are set by the sequence generator.
*/


import { MAIN_TRIALS_PER_BLOCK, PRACTICE_SEQUENCES, PRACTICE_TRIALS_PER_BLOCK } from "../config.js";
import { buildSequenceMetadata, validateSequence } from "./sequenceSpecs.js";

let precomputedMainSequences = null;
let validatedSummaries = null;

export function setPrecomputedMainSequences(sequenceData) {
  precomputedMainSequences = sequenceData;
  validatedSummaries = Object.fromEntries(
    Object.entries(precomputedMainSequences).map(([blockName, entry]) => [
      blockName,
      validateSequence(blockName, entry.stimuli),
    ]),
  );
}

function requireInitializedSequences() {
  if (!precomputedMainSequences || !validatedSummaries) {
    throw new Error("Precomputed main sequences have not been initialized.");
  }
}

export function getMainSequence(blockName) {
  requireInitializedSequences();
  const sequenceEntry = precomputedMainSequences[blockName];
  if (!sequenceEntry) throw new Error(`Missing precomputed main sequence for ${blockName}.`);
  return sequenceEntry;
}

export function getMainSequenceSummary(blockName) {
  requireInitializedSequences();
  const summary = validatedSummaries[blockName];
  if (!summary) throw new Error(`Missing validated summary for ${blockName}.`);
  return summary;
}

export function getMainSequenceTrial(blockName, trialNumber) {
  if (trialNumber < 1 || trialNumber > MAIN_TRIALS_PER_BLOCK) {
    throw new Error(`Main-sequence trial ${trialNumber} is out of range for ${blockName}.`);
  }

  const sequenceEntry = getMainSequence(blockName);
  const stimulusValue = sequenceEntry.stimuli[trialNumber - 1];
  const previousValue = trialNumber > 1 ? sequenceEntry.stimuli[trialNumber - 2] : null;

  return {
    stimulusValue,
    previousValue,
    sequenceMeta: buildSequenceMetadata(
      blockName,
      sequenceEntry.sequenceId,
      trialNumber,
      stimulusValue,
      previousValue,
    ),
  };
}

export function getPracticeSequenceTrial(blockName, trialNumber) {
  if (trialNumber < 1 || trialNumber > PRACTICE_TRIALS_PER_BLOCK) {
    throw new Error(`Practice-sequence trial ${trialNumber} is out of range for ${blockName}.`);
  }

  const practiceSequence = PRACTICE_SEQUENCES[blockName];
  if (!practiceSequence) {
    throw new Error(`Missing fixed practice sequence for ${blockName}.`);
  }
  if (practiceSequence.length !== PRACTICE_TRIALS_PER_BLOCK) {
    throw new Error(
      `Practice sequence length for ${blockName} (${practiceSequence.length}) does not match PRACTICE_TRIALS_PER_BLOCK (${PRACTICE_TRIALS_PER_BLOCK}).`,
    );
  }

  const sequenceIndex = trialNumber - 1;

  return {
    stimulusValue: practiceSequence[sequenceIndex],
    sequenceIndex,
  };
}
