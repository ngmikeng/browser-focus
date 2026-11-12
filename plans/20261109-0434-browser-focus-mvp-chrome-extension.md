<!-- source-plan: pasted-content-id-2bc0-i-ve-an-stateless-cupcake.md -->
<!-- status: approved · saved 2026-11-09 04:34 -->

# Plan: Browser Focus MVP Chrome extension

## Context
The brainstorm (`brainstorms/20261109-0316-browser-focus-brainstorm.md`) recommends Phase 1: a Chrome extension that shows **only a chosen zone** of a page's `<video>`, zoomed in, inside an always-on-top **Document Picture-in-Picture** window. It also adds a **caption mode** that re-draws subtitle text, because YouTube's captions are page elements drawn on top of the video, not part of the video picture. The project currently has no code. This plan builds that MVP.

**MVP scope:** works on any page with a `<video>`, with YouTube as the main target.
- Drag/resize a focus zone over the video, with presets.
- Pop-out window showing the zone (crop mode) or the captions as large text (caption mode).
- Basic playback controls.
- The zone and mode are remembered per site.

Out of scope for now: multiple zones, global hotkeys, OCR, Firefox/Safari.

## Stack
- **WXT + TypeScript** for MV3 scaffolding, a hot-reload dev browser, and manifest generation.
- Vanilla DOM: no UI framework. The extension's UI lives in Shadow DOM so the page's CSS can't affect it.
- **Vitest** for unit tests of the zone math.

## Files to create
```
package.json, tsconfig.json, wxt.config.ts     # manifest: name, icons, permissions [storage, activeTab],
                                               # action, commands { toggle-focus: Alt+Shift+F }
entrypoints/background.ts                      # action click / command → tabs.sendMessage({type:'toggle'})
entrypoints/content.ts                         # matches <all_urls>, all_frames; on 'toggle' → controller
src/controller.ts                              # state machine: idle → editing → viewing; wires modules
src/video-finder.ts                            # pick target <video>: largest visible, prefer playing
src/zone.ts                                    # Zone {x,y,w,h} normalized 0–1 to the video's intrinsic frame;
                                               # contentRect(video) (object-fit letterbox), toClient/fromClient,
                                               # toSource(videoWidth/Height), clamp, PRESETS {subtitles, center, full}
src/zone-editor.ts                             # overlay over the video (Shadow DOM): dimmed mask, draggable rect,
                                               # 8 resize handles (pointer events), toolbar [Subtitles|Center|Full]
                                               # [Crop|Captions] [Pop out ▶] [✕]; tracks video via ResizeObserver+scroll
src/pip-viewer.ts                              # documentPictureInPicture.requestWindow({w,h from zone aspect});
                                               # crop: canvas + drawImage(video, sx,sy,sw,sh, 0,0,W,H) driven by
                                               # video.requestVideoFrameCallback (+ one redraw on zone change/pause);
                                               # captions: big text panel; controls bar [⏯ −5 +5 | mode | ✎ edit];
                                               # cleanup on pip 'pagehide'
src/pip-fallback.ts                            # no Document PiP → canvas.captureStream() → hidden <video> →
                                               # requestPictureInPicture() (crop mode only)
src/captions.ts                                # CaptionSource interface; YouTubeCaptions (MutationObserver on
                                               # .ytp-caption-window-container → .ytp-caption-segment text);
                                               # TextTrackCaptions (video.textTracks, mode 'hidden', cuechange)
src/storage.ts                                 # chrome.storage.local: { [hostname]: { zone, mode } }
src/styles.ts                                  # CSS strings for editor overlay + PiP document
tests/zone.test.ts                             # letterbox math, round-trips, clamp, presets
public/icon/*.png                              # simple generated icons
```

## Key design points
- **User gesture for PiP:** `requestWindow()` needs a click from the user. A click on the toolbar icon doesn't reliably count as one inside the page, so the icon or keyboard shortcut only opens the zone editor. The editor's **"Pop out"** button, clicked inside the page, opens the PiP window.
- **Coordinates:** the zone is stored as fractions (0–1) of the video's intrinsic frame. Each frame it is converted to source pixels using `videoWidth/videoHeight`. The editor converts to page pixels using the video's displayed area, minus any letterbox bars. This keeps the zone correct through theater/fullscreen switches and quality changes.
- **Live editing:** clicking ✎ in the PiP window brings the editor back on the page, and the zone updates live in PiP (shared state in the controller). Closing the editor keeps PiP open.
- **Caption mode:** use YouTube's caption elements when present (CC must be turned on; show a hint if no captions appear). Otherwise use `textTracks`. Show the last 1–2 lines in large text, with font size following the window width.
- **Performance:** only draw when a new video frame arrives (`requestVideoFrameCallback`), and stop all loops and observers when the PiP window closes.
- **Persistence:** save `{zone, mode}` per hostname whenever they change. On open, use the saved values, or default to the Subtitles preset in crop mode.

## Implementation order
1. **Scaffold** WXT + TypeScript, and get the toolbar click to log a message in the content script.
2. **Quick check (risk):** confirm `documentPictureInPicture` and cross-document `drawImage` work from a content script on YouTube. If they don't, run the canvas inside the page's own script context instead and message across.
3. `zone.ts` and its tests, then `video-finder.ts`.
4. `zone-editor.ts`.
5. `pip-viewer.ts` crop mode and controls.
6. `captions.ts` and caption mode.
7. `storage.ts`, `pip-fallback.ts`, and icons.

## Verification
- `npm test`: the zone math tests pass.
- `npm run dev`: WXT launches Chrome with the extension loaded. Then, manually:
  1. On a YouTube video, click the icon. The editor appears on the Subtitles preset. Drag and resize the zone, then click Pop out. A floating window shows only the zone, playing smoothly, and it stays on top when you switch to another app.
  2. Switch to theater mode and fullscreen, and change the quality. The zone stays aligned.
  3. Turn CC on and switch to Captions. Large subtitle text follows playback.
  4. ⏯ and ±5s work. ✎ reopens the editor and changes show live.
  5. Close PiP and reopen it. The zone and mode are remembered for youtube.com.
  6. On a non-YouTube page with a `<video>` (e.g. an MDN `<video>` example), crop mode works.
- `npm run build` produces `.output/chrome-mv3`, which loads unpacked through `chrome://extensions` without errors.
