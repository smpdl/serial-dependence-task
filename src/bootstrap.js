import FullscreenPlugin from "@jspsych/plugin-fullscreen";
import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import PreloadPlugin from "@jspsych/plugin-preload";
import {
  buildBlockIntroHtml,
  buildExperimentEndHtml,
  buildPracticeCompleteHtml,
} from "./instructions.js";

export function pushBootstrapTimeline(timeline, assetPaths, jsPsych) {
  timeline.push({
    type: PreloadPlugin,
    images: assetPaths.images,
    audio: assetPaths.audio,
    video: assetPaths.video,
  });

  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus: "<p>Welcome to the experiment.</p><p>Press any key from your keyboard to continue.</p>",
  });

  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus: `
      <h3>Consent Form</h3>
      <div style="max-width:760px;margin:0 auto;text-align:left;line-height:1.5;">
        <p>For this study, you will be asked to give a response about visual stimulus right at your peripheral vision. Your responses will be kept completely confidential.</p>
        <p>The study should take you around 30 minutes to complete. You will receive $5 USD for your participation. Your participation in this research is voluntary. You have the right to withdraw at any point during the study. The Principal Investigator of this study can be contacted at jdeleeuw@vassar.edu and jolong@vassar.edu.</p>
        <p>By clicking the button below, you acknowledge:</p>
        <ul>
          <li>Your participation in the study is voluntary.</li>
          <li>You are at least 18 years of age.</li>
          <li>You must have 20/20 vision with or without correction.</li>
          <li>You must not be color-blind.</li>
          <li>You are aware that you may choose to terminate your participation at any time for any reason.</li>
        </ul>
      </div>
      <p>Press <strong>Y</strong> to consent and continue.</p>
      <p>Press <strong>N</strong> to decline and exit the experiment.</p>
    `,
    choices: ["y", "n"],
    on_finish: (data) => {
      if (data.response === "n") {
        jsPsych.abortExperiment();
      }
    },
  });

  timeline.push({
    type: FullscreenPlugin,
    fullscreen_mode: true,
  });
}

export function pushBlockIntro(timeline, blockIndex, blockName) {
  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus: buildBlockIntroHtml(blockIndex, blockName),
  });
}

export function pushPracticeComplete(timeline, blockIndex) {
  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus: buildPracticeCompleteHtml(blockIndex),
  });
}

export function pushExperimentEnd(timeline) {
  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus: buildExperimentEndHtml(),
  });
}
