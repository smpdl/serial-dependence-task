import {
  FACTOR_SEQUENCE_SPECS,
  TARGET_SIGN_COUNT_PER_BIN,
  computePairwiseDifference,
  getDifferenceBin,
  getDifferenceMagnitudeForBinning,
  getSequenceSpec,
  validateSequence,
} from "./sequenceSpecs.js";

/*
  This is a seeded random number generator.
  It is used to generate the sequence of stimulus values.
*/
class SeededRng {
  constructor(seed) { // convert the seed to an unsigned 32-bit integer.
    this.state = seed >>> 0;
  }

  next() { // generate a random number between 0 and 1.
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(min, max) { // generate a random integer between min and max.
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick(items) { // pick a random item from the array.
    return items[Math.floor(this.next() * items.length)];
  }

  shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.next() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }
}

function createRemainingTargets() { // create the remaining targets for the sequence.
  return Array.from({ length: 5 }, () => ({
    positive: TARGET_SIGN_COUNT_PER_BIN,
    negative: TARGET_SIGN_COUNT_PER_BIN,
  }));
}

function hasRemainingTargets(remainingTargets) { // check if there are any remaining targets.
  return remainingTargets.some((target) => target.positive > 0 || target.negative > 0);
}

function buildCircularSequence(blockName, rng) { // build the circular sequence.
  const spec = getSequenceSpec(blockName);

  // try to build the sequence 2000 times.
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const sequence = [Number((rng.next() * spec.period).toFixed(3))]; // start the sequence with a random value.
    const remainingTargets = createRemainingTargets(); // create the remaining targets.
    let consecutiveSmallDifferences = 0; // count the number of consecutive small differences.
    let failed = false; // flag to indicate if the sequence failed to build.

    // build the sequence until there are no remaining targets.
    while (hasRemainingTargets(remainingTargets)) {
      const categories = []; // categories are the bins for the sequence.
      remainingTargets.forEach((target, binIndex) => {
        if (target.positive > 0) categories.push({ binIndex, sign: 1 });
        if (target.negative > 0) categories.push({ binIndex, sign: -1 });
      });

      const orderedCategories = rng.shuffle(categories).sort((left, right) => { // sort the categories by the remaining targets.
        const leftRemaining = remainingTargets[left.binIndex][left.sign > 0 ? "positive" : "negative"]; // get the remaining targets for the left category.
        const rightRemaining = remainingTargets[right.binIndex][right.sign > 0 ? "positive" : "negative"]; // get the remaining targets for the right category.
        return rightRemaining - leftRemaining;
      });

      const currentValue = sequence[sequence.length - 1]; // get the current value.
      let nextValue = null;
      let nextCategory = null; // the next category to add to the sequence.

      for (const category of orderedCategories) { // loop through the categories.
        const lower = spec.binEdges[category.binIndex]; // get the lower bound of the category.
        const upper = spec.binEdges[category.binIndex + 1]; // get the upper bound of the category.
        const minMagnitude = Math.max(lower, 0.25);
        const maxMagnitude = upper - (category.binIndex === spec.binEdges.length - 2 ? 0 : 0.25);

        // try to find a value in the category that is not a small difference.
        for (let candidateAttempt = 0; candidateAttempt < 30; candidateAttempt += 1) {
          const magnitude = Number((minMagnitude + rng.next() * (maxMagnitude - minMagnitude)).toFixed(3));
          const candidateValue = Number((((currentValue + category.sign * magnitude) % spec.period) + spec.period).toFixed(3)) % spec.period;
          const candidateDifference = computePairwiseDifference(blockName, candidateValue, currentValue);
          const candidateBin = getDifferenceBin(blockName, candidateValue, currentValue);

          if (candidateBin.index !== category.binIndex) continue;
          const localMagnitude = getDifferenceMagnitudeForBinning(blockName, candidateDifference);
          const repeatIndex = sequence.length - spec.repetitionConfig.maxApproxRepeatSpan;
          // check if the candidate value is a near-repeat.
          const repeatsRecentValue = repeatIndex >= 0
            && getDifferenceMagnitudeForBinning(
              blockName,
              computePairwiseDifference(blockName, candidateValue, sequence[repeatIndex]),
            ) <= spec.repetitionConfig.repeatBackTolerance;
          // check if the candidate value is a small difference.
          const nextSmallCount = localMagnitude < spec.repetitionConfig.smallDifferenceThreshold
            ? consecutiveSmallDifferences + 1
            : 0;

          if (repeatsRecentValue) continue;
          if (nextSmallCount > spec.repetitionConfig.maxConsecutiveSmallDifferences) continue;

          nextValue = candidateValue;
          nextCategory = category;
          break;
        }

        if (nextValue !== null) break;
      }

      if (nextValue === null || nextCategory === null) {
        failed = true;
        break;
      }

      // get the magnitude of the difference between the current and next value.
      const binMagnitude = getDifferenceMagnitudeForBinning(
        blockName,
        computePairwiseDifference(blockName, nextValue, currentValue),
      );
      // if the magnitude is less than the small difference threshold, count the number of consecutive small differences.
      consecutiveSmallDifferences = binMagnitude < spec.repetitionConfig.smallDifferenceThreshold
        ? consecutiveSmallDifferences + 1
        : 0;
      remainingTargets[nextCategory.binIndex][nextCategory.sign > 0 ? "positive" : "negative"] -= 1;
      sequence.push(nextValue);
    }

    if (!failed) {
      validateSequence(blockName, sequence);
      return sequence;
    }
  }

  throw new Error(`Unable to build a circular sequence for ${blockName}.`);
}

function getNumerosityCandidates(currentValue, binIndex, sign) {
  const candidates = [];
  // try to find candidates in the numerosity range.
  for (let candidate = FACTOR_SEQUENCE_SPECS.numerosity.minStimulus; candidate <= FACTOR_SEQUENCE_SPECS.numerosity.maxStimulus; candidate += 1) {
    const signedDifference = candidate - currentValue;
    if (signedDifference === 0) continue;
    if (Math.sign(signedDifference) !== sign) continue;
    const bin = getDifferenceBin("numerosity", candidate, currentValue);
    if (bin.index === binIndex) candidates.push(candidate);
  }
  return candidates;
}

function buildNumerositySequence(rng) {
  const spec = getSequenceSpec("numerosity");
  for (let attempt = 0; attempt < 10000; attempt += 1) { // try to build the sequence 10000 times.
    const remainingTargets = createRemainingTargets(); // create the remaining targets.
    const sequence = [rng.nextInt(spec.minStimulus, spec.maxStimulus)]; // start the sequence with a random value.
    let consecutiveSmallDifferences = 0; // count the number of consecutive small differences.
    let failed = false; // flag to indicate if the sequence failed to build.

    // build the sequence until there are no remaining targets.
    while (hasRemainingTargets(remainingTargets)) {
      const currentValue = sequence[sequence.length - 1]; // get the current value.
      const categoryOptions = []; // category options are the options for the next category.

      remainingTargets.forEach((target, binIndex) => { // loop through the remaining targets.
        if (target.positive > 0) { // add the positive candidates to the category options.
          const candidates = getNumerosityCandidates(currentValue, binIndex, 1).filter((candidateValue) => { // filter the candidates to only include the candidates that are not a near-repeat.  
            const repeatIndex = sequence.length - spec.repetitionConfig.maxApproxRepeatSpan;
            if (repeatIndex >= 0 && candidateValue === sequence[repeatIndex]) return false;
            return true;
          });
          if (candidates.length > 0) categoryOptions.push({ binIndex, sign: 1, candidates });
        }

        if (target.negative > 0) { // add the negative candidates to the category options.
          const candidates = getNumerosityCandidates(currentValue, binIndex, -1).filter((candidateValue) => {
            const repeatIndex = sequence.length - spec.repetitionConfig.maxApproxRepeatSpan;
            if (repeatIndex >= 0 && candidateValue === sequence[repeatIndex]) return false;
            return true;
          });
          if (candidates.length > 0) categoryOptions.push({ binIndex, sign: -1, candidates });
        }
      });

      if (categoryOptions.length === 0) { // if there are no category options, the sequence failed to build.
        failed = true;
        break;
      }

      categoryOptions.sort((left, right) => { // sort the category options by the remaining targets.
        if (left.candidates.length !== right.candidates.length) return left.candidates.length - right.candidates.length;
        const leftRemaining = remainingTargets[left.binIndex][left.sign > 0 ? "positive" : "negative"];
        const rightRemaining = remainingTargets[right.binIndex][right.sign > 0 ? "positive" : "negative"];
        return rightRemaining - leftRemaining;
      });

      let nextChoice = null;
      for (const option of categoryOptions.slice(0, 6)) { // loop through the category options.
        const rankedCandidates = rng.shuffle(option.candidates).sort((left, right) => {
          const leftMobility = countFutureOptions(left, remainingTargets, option);
          const rightMobility = countFutureOptions(right, remainingTargets, option);
          return rightMobility - leftMobility;
        });

        for (const candidateValue of rankedCandidates) { // loop through the ranked candidates.
          const differenceMagnitude = getDifferenceMagnitudeForBinning(
            "numerosity",
            computePairwiseDifference("numerosity", candidateValue, currentValue),
          );
          // if the magnitude is less than the small difference threshold, count the number of consecutive small differences.
          const nextSmallCount = differenceMagnitude < spec.repetitionConfig.smallDifferenceThreshold
            ? consecutiveSmallDifferences + 1
            : 0;
          // if the number of consecutive small differences is greater than the max consecutive small differences, continue.
          if (nextSmallCount > spec.repetitionConfig.maxConsecutiveSmallDifferences) continue;
          // set the next choice.
          nextChoice = { ...option, candidateValue, nextSmallCount };
          break;
        }

        if (nextChoice) break;
      }

      if (!nextChoice) { // if there is no next choice, the sequence failed to build.
        failed = true;
        break;
      }

      remainingTargets[nextChoice.binIndex][nextChoice.sign > 0 ? "positive" : "negative"] -= 1;
      sequence.push(nextChoice.candidateValue);
      consecutiveSmallDifferences = nextChoice.nextSmallCount;
    }

    if (!failed) {
      validateSequence("numerosity", sequence);
      return sequence;
    }
  }

  throw new Error("Unable to build a numerosity sequence.");
}

function countFutureOptions(candidateValue, remainingTargets, usedOption) { // count the number of future options for the candidate value.
  const simulatedTargets = remainingTargets.map((target) => ({ ...target }));
  simulatedTargets[usedOption.binIndex][usedOption.sign > 0 ? "positive" : "negative"] -= 1;

  let total = 0; // count the number of future options.
  simulatedTargets.forEach((target, binIndex) => {
    if (target.positive > 0) total += getNumerosityCandidates(candidateValue, binIndex, 1).length; // count the number of future options for the positive candidate value.
    if (target.negative > 0) total += getNumerosityCandidates(candidateValue, binIndex, -1).length; // count the number of future options for the negative candidate value.
  });
  return total;
}

function buildAllSequences() { // build all the sequences.
  return {
    color: buildCircularSequence("color", new SeededRng(0xC0A0C0)),
    orientation: buildCircularSequence("orientation", new SeededRng(0x0A17E)),
    numerosity: buildNumerositySequence(new SeededRng(0x4E554D45)),
  };
}

function normalizeSequencesForJson(sequences) { // normalize the sequences for JSON.
  return Object.fromEntries(Object.entries(sequences).map(([blockName, stimuli]) => {
    const summary = validateSequence(blockName, stimuli);
    return [
      blockName,
      {
        sequenceId: getSequenceSpec(blockName).sequenceId,
        metadata: {
          stimulusCount: summary.stimulusCount,
          differenceCount: summary.differenceCount,
          binCounts: summary.binCounts,
          signedCounts: summary.signedCounts,
        },
        stimuli: stimuli.map((value) => Number(value.toFixed(3))),
      },
    ];
  }));
}

const sequences = buildAllSequences(); // build all the sequences.
process.stdout.write(`${JSON.stringify(normalizeSequencesForJson(sequences), null, 2)}\n`); // write the sequences to the console.
