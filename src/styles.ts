const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

/** Styles for the zone editor + toast, inside the extension's Shadow DOM on the page. */
export const EDITOR_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  position: fixed; inset: 0; z-index: 2147483647;
  pointer-events: none; font: 13px/1.3 ${FONT}; color: #fff;
}
.clip {
  position: fixed; overflow: hidden; pointer-events: auto; cursor: crosshair;
  outline: 1px dashed rgba(255,255,255,.35);
}
.zone {
  position: absolute; cursor: move;
  border: 2px solid #4cc2ff; border-radius: 2px;
  box-shadow: 0 0 0 99999px rgba(0,0,0,.55);
}
.zone .label {
  position: absolute; left: 4px; top: 4px; padding: 1px 6px; border-radius: 3px;
  background: #4cc2ff; color: #002233; font-weight: 600; font-size: 11px; pointer-events: none;
}
.h { position: absolute; width: 12px; height: 12px; background: #fff; border: 2px solid #4cc2ff; border-radius: 50%; }
.h[data-e="nw"] { left: -7px; top: -7px; cursor: nwse-resize; }
.h[data-e="n"]  { left: calc(50% - 6px); top: -7px; cursor: ns-resize; }
.h[data-e="ne"] { right: -7px; top: -7px; cursor: nesw-resize; }
.h[data-e="e"]  { right: -7px; top: calc(50% - 6px); cursor: ew-resize; }
.h[data-e="se"] { right: -7px; bottom: -7px; cursor: nwse-resize; }
.h[data-e="s"]  { left: calc(50% - 6px); bottom: -7px; cursor: ns-resize; }
.h[data-e="sw"] { left: -7px; bottom: -7px; cursor: nesw-resize; }
.h[data-e="w"]  { left: -7px; top: calc(50% - 6px); cursor: ew-resize; }
.bar {
  position: fixed; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;
  padding: 5px; border-radius: 8px; pointer-events: auto;
  background: rgba(20,22,26,.92); box-shadow: 0 4px 18px rgba(0,0,0,.4);
}
.bar .sep { width: 1px; height: 20px; background: rgba(255,255,255,.18); margin: 0 3px; }
button {
  all: unset; cursor: pointer; padding: 5px 9px; border-radius: 5px;
  font: 500 12px/1 ${FONT}; color: #e8eaed; background: rgba(255,255,255,.08);
}
button:hover { background: rgba(255,255,255,.18); }
button[aria-pressed="true"] { background: #4cc2ff; color: #002233; }
button.primary { background: #4cc2ff; color: #002233; font-weight: 700; }
button.primary:hover { background: #7dd3ff; }
button:disabled { opacity: .4; cursor: not-allowed; }
.toast {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  padding: 9px 14px; border-radius: 8px; background: rgba(20,22,26,.95); color: #fff;
  box-shadow: 0 4px 18px rgba(0,0,0,.4); pointer-events: none;
}
`;

/** Styles for the Document Picture-in-Picture window. */
export const PIP_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #000; color: #fff; overflow: hidden; font: 14px/1.3 ${FONT}; }
.stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
canvas { width: 100%; height: 100%; object-fit: contain; display: block; }
.captions {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: .15em; padding: 8px 14px 8px;
  text-align: center; font-weight: 600; line-height: 1.2;
  font-size: clamp(14px, 5.5vw, 64px); text-shadow: 0 1px 3px #000;
}
.captions.stale { opacity: .45; }
.captions .hint { font-size: 13px; font-weight: 400; opacity: .7; }
.controls {
  position: absolute; left: 0; right: 0; bottom: 0; display: flex; gap: 4px; justify-content: center;
  padding: 6px; background: linear-gradient(transparent, rgba(0,0,0,.75));
  opacity: 0; transition: opacity .15s;
}
body:hover .controls, .controls:focus-within { opacity: 1; }
button {
  all: unset; cursor: pointer; padding: 5px 9px; border-radius: 5px;
  font: 500 12px/1 ${FONT}; color: #fff; background: rgba(255,255,255,.15);
}
button:hover { background: rgba(255,255,255,.3); }
button:disabled { opacity: .4; cursor: not-allowed; }
.hidden { display: none !important; }
label.ontop {
  display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 5px; cursor: pointer;
  font: 500 12px/1 ${FONT}; background: rgba(255,255,255,.15); user-select: none;
}
label.ontop:hover { background: rgba(255,255,255,.3); }
label.ontop input { margin: 0; accent-color: #4cc2ff; cursor: pointer; }
.hint-toast {
  position: absolute; top: 6px; left: 50%; transform: translateX(-50%);
  max-width: calc(100% - 12px); padding: 5px 10px; border-radius: 6px;
  background: rgba(76,194,255,.95); color: #002233; font-size: 12px; font-weight: 600;
  text-align: center; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,.4);
  transition: opacity .5s;
}
.hint-toast.fade { opacity: 0; }
`;
