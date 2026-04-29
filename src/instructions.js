import { PRACTICE_TRIALS_PER_BLOCK, RESPONSE_DEADLINE_MS } from "./config.js";

const BLOCK_COPY = {
  orientation: {
    description: "an oriented grating",
    response: "During the response phase, use the circular slider to match the orientation you saw, then click the central fixation to confirm.",
  },
  color: {
    description: "a colored patch",
    response: "During the response phase, use the color wheel to match the color you saw, then click the central fixation to confirm.",
  },
  numerosity: {
    description: "a number of dots",
    response: "During the response phase, use the slider to match the number of dots you saw, then click the central fixation to confirm.",
  },
};

export function buildBlockIntroHtml(blockIndex, blockName) {
  const copy = BLOCK_COPY[blockName];
  return `
    <div class="readable-text">
      <p><strong>Block ${blockIndex + 1}</strong></p>
      <p>In this block, you will be shown ${copy.description} for a very small amount of time, after which it will be masked with a blur. Then, you will be asked to provide a response based on the stimulus you last saw. Note: the stimuli will always appear in the same location during this block, and it will be marked with a black border.</p>
      <p>${copy.response}</p>
      <p><strong>Please keep your eyes on the central fixation throughout the block.</strong> Also, note that the stimuli will come very quickly, so you must be ready to respond immediately.</p>
      <p>You will begin with ${PRACTICE_TRIALS_PER_BLOCK} practice trials before the main trials, and you must confirm your response within ${Math.round(RESPONSE_DEADLINE_MS / 1000)} seconds.</p>
      <p>Press Enter to begin.</p>
    </div>
  `;
}

export function buildPracticeCompleteHtml(blockIndex) {
  return `
    <div class="readable-text">
      <p>Practice complete for block ${blockIndex + 1}.</p>
      <p>The main trials will start next. <strong>Please continue keeping your eyes on the central fixation.</strong></p>
      <p>Press Enter to begin the main trials.</p>
    </div>
  `;
}

export function buildExperimentEndHtml() {
  return `
    <div class="readable-text">
      <p><strong>Thank you for participating.</strong></p>
      <p>You have completed the experiment.</p>
      <p>In this study, we were studying the individual differences of serial dependence. Serial dependence is when perceptual judgements are influenced by previously seen stimuli. We aimed to observe this phenomenon within individuals because there is not much known about the stability of serial dependence effects within individuals across domains such as orientation, color, and numerosity. If you have any questions about our study, please contact Principal Investigators jdeleeuw@vassar.edu and jolong@vassar.edu.</p>
      <p>Thank you for your participation in our study.</p>
      <p>Press Enter to finish.</p>
    </div>
  `;
}
