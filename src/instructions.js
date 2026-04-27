import { PRACTICE_TRIALS_PER_BLOCK, RESPONSE_DEADLINE_MS } from "./config.js";

const BLOCK_COPY = {
  orientation: {
    description: "You will see an oriented grating.",
    response: "During the response phase, use the circular slider to match the orientation you saw.",
  },
  color: {
    description: "You will see a colored patch.",
    response: "During the response phase, use the color wheel to match the color you saw.",
  },
  numerosity: {
    description: "You will see a numbers of dots.",
    response: "During the response phase, use the slider to match how many dots you saw.",
  },
};

export function buildBlockIntroHtml(blockIndex, blockName) {
  const copy = BLOCK_COPY[blockName];
  return `
    <div class="readable-text">
      <p><strong>Block ${blockIndex + 1}</strong></p>
      <p>${copy.description}</p>
      <p>The stimulus will always appear in the same location during this block.</p>
      <p>You will begin with ${PRACTICE_TRIALS_PER_BLOCK} practice trials before the main trials.</p>
      <p>${copy.response}</p>
      <p>You must confirm your response within ${Math.round(RESPONSE_DEADLINE_MS / 1000)} seconds.</p>
      <p>Please keep your eyes on the central fixation throughout the block.</p>
      <p>Press any key to begin.</p>
    </div>
  `;
}

export function buildPracticeCompleteHtml(blockIndex) {
  return `
    <div class="readable-text">
      <p><strong>Practice complete for block ${blockIndex + 1}.</strong></p>
      <p>The main trials will start next.</p>
      <p>Please continue keeping your eyes on the central fixation.</p>
      <p>Press any key to begin the main trials.</p>
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
    </div>
  `;
}
