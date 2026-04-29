import {
  FIXATION_COLOR,
  FIXATION_FONT_SIZE_PX,
  FIXATION_HIT_SIZE_PX,
  FIXATION_LINE_HEIGHT,
} from "./config.js";

export function buildFixationHtml({
  fixationId = "trial-fixation",
  clickable = false,
} = {}) {
  return `
    <button
      id="${fixationId}"
      type="button"
      aria-label="Central fixation"
      style="
        position:absolute;
        top:50%;
        left:50%;
        transform:translate(-50%, -50%);
        width:${FIXATION_HIT_SIZE_PX}px;
        height:${FIXATION_HIT_SIZE_PX}px;
        display:grid;
        place-items:center;
        padding:0;
        border:0;
        background:transparent;
        color:${FIXATION_COLOR};
        font-size:${FIXATION_FONT_SIZE_PX}px;
        line-height:${FIXATION_LINE_HEIGHT};
        z-index:30;
        pointer-events:${clickable ? "auto" : "none"};
        cursor:${clickable ? "pointer" : "default"};
      "
    >+</button>
  `;
}

export function buildScreenWithFixation(
  content,
  {
    fixationId = "screen-fixation",
    clickableFixation = false,
    rootId = "screen-with-fixation",
    contentWrapperStyle = "",
    includeFixation = true,
  } = {},
) {
  return `
    <div
      id="${rootId}"
      style="
        position:fixed;
        inset:0;
        overflow:hidden;
        background:#808080;
        color:#000;
      "
    >
      <div
        style="
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%, calc(-100% - 36px));
          width:min(760px, calc(100vw - 48px));
          text-align:center;
          ${contentWrapperStyle}
        "
      >
        ${content}
      </div>
      ${includeFixation
        ? buildFixationHtml({ fixationId, clickable: clickableFixation })
        : ""}
    </div>
  `;
}

export function setFixationClickability(fixationId, clickable, onClick = null) {
  const fixation = document.getElementById(fixationId);
  if (!fixation) return () => {};

  fixation.style.pointerEvents = clickable ? "auto" : "none";
  fixation.style.cursor = clickable ? "pointer" : "default";
  if (onClick) fixation.addEventListener("click", onClick);

  return () => {
    if (onClick) fixation.removeEventListener("click", onClick);
    fixation.style.pointerEvents = "none";
    fixation.style.cursor = "default";
  };
}
