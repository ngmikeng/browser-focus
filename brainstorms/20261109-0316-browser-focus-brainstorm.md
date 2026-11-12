# Browser Focus — Brainstorm

> **Date:** 2026-11-09 03:16
> **Status:** Idea / exploration
> **One-liner:** A small, always-on-top mini player that shows only a chosen zone of a video or web page, zoomed in, such as just the subtitles.

---

## 1. Idea summary

You open a YouTube video (or any web page) in a small floating window in a corner of the screen. You don't see the whole frame. Instead you pick a **focus zone**: a rectangle you can drag and resize. The mini window shows only that zone, scaled up to fill the window.

The typical case is a thin strip showing **only the subtitles** of a video. You can keep it in a screen corner while you work in other apps.

Core concepts:

| Concept | Meaning |
|---|---|
| **Source** | The thing being watched: a YouTube video, any `<video>`, any web page, or a screen region |
| **Focus zone** | A rectangle on the source (stored as normalized 0–1 coordinates) |
| **Viewer** | The small floating window that renders the zone, zoomed to fit |
| **Preset** | A saved zone, e.g. "Subtitles – bottom 18%" or "Slides – right 60%" |

---

## 2. Use cases

- **Subtitles only**: follow a talk, lecture, or foreign-language video while coding, without a full video taking up the screen.
- **Language learning**: show huge subtitles in a corner. Pairs well with a "pause after each line" mode.
- **Tutorials**: focus on the code editor area or the slide in a screen-recorded tutorial.
- **Live streams and sports**: keep only the scoreboard, timer, or chat visible.
- **Dashboards and monitoring**: pin one tile of a web dashboard (build status, price, graph) always on top.
- **Accessibility**: magnify a specific area for low-vision users without zooming the whole screen.
- **Meetings/webinars**: keep only the presenter's shared-screen area or a speaker's face.

---

## 3. Features

### MVP
- Load a source: a YouTube URL, or "use the video in the current tab".
- An overlay for **drawing, dragging, and resizing** the focus rectangle on the source.
- The viewer shows only that rectangle, scaled to fit (keeping the aspect ratio, or stretched).
- The viewer is **small, movable, resizable, and always on top**.
- Basic controls: play/pause, seek ±5s, mute, volume.
- A one-click **"Subtitle strip"** preset (the bottom ~15–20% of the frame, full width).

### Next
- Saved presets per site or channel (e.g. a "youtube.com/@channel → subtitle zone" mapping).
- **Multiple zones** in one viewer (e.g. slide + subtitles stacked).
- Viewer opacity and **click-through** mode (the window floats over other apps without catching the mouse).
- Global hotkeys: toggle the viewer, nudge the zone, play/pause.
- Snap to screen corners; remember position.
- Filters: contrast boost, invert, background blur outside the subtitle.

### Ideas / stretch
- **Subtitle text mode**: re-render caption text in a big custom font instead of cropping pixels (see §4.5).
- **Auto-follow**: detect where subtitles appear and move the zone automatically.
- OCR of burned-in subtitles, then translation, a dictionary, or copy-to-clipboard.
- A "pause after each subtitle line" mode for language learners.
- A transcript history panel (scroll back through recent lines).

---

## 4. Technical analysis

The hard question is **where the pixels come from** and **how the window stays on top of everything**. There are four main approaches.

### 4.1 Approach A — Web page with a cropped YouTube iframe (CSS crop)

```
┌ container (overflow:hidden, size = viewer) ┐
│  ┌ iframe (YouTube embed, scaled & shifted) ┼──────┐
│  │       ░░░░░ only this part visible ░░░░░ │      │
└──┼──────────────────────────────────────────┘      │
   └─────────────────────────────────────────────────┘
```

- Wrap the YouTube embed in an `overflow: hidden` box and apply `transform: translate(-x, -y) scale(k)` to the iframe.
- Control playback with the **YouTube IFrame Player API** (`playVideo`, `seekTo`, `getCurrentTime`).
- ✅ Very easy, pure HTML/JS, a good prototype in a day.
- ❌ It only lives inside a browser tab, not floating over other apps.
- ❌ Many non-YouTube sites refuse iframes (`X-Frame-Options`, CSP `frame-ancestors`).
- ❌ YouTube's own controls and overlays get cropped or scaled along with the video, so you need your own control bar.
- ❌ You cannot read the iframe's pixels (cross-origin), only move it around visually.

### 4.2 Approach B — Browser extension + Document Picture-in-Picture ⭐ recommended

```
 YouTube tab                         Document PiP window (always on top)
┌──────────────────────────┐        ┌───────────────────────────┐
│  <video> ──────────┐     │        │  <canvas>                 │
│        ┌─────────┐ │     │ draw   │   "zoomed subtitle zone"  │
│        │ zone    │ ├─────┼──────▶ │                           │
│        └─────────┘ │     │        │ [▶] [⟲5] [⟳5] [zone✎]     │
└────────────────────┘─────┘        └───────────────────────────┘
```

- A **content script** runs on the page and finds the `<video>` element directly (same page, no iframe problems).
- Each frame: `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H)` copies **only the zone** onto a canvas, driven by `video.requestVideoFrameCallback()` (more efficient than `requestAnimationFrame`).
- The canvas is shown in a **Document Picture-in-Picture** window (`documentPictureInPicture.requestWindow()`, Chrome/Edge 116+):
  - It is a real always-on-top OS window that floats over **all apps**.
  - It can hold **any HTML**: canvas, custom controls, a zone editor.
- Fallback where Document PiP is not available: `canvas.captureStream()` → hidden `<video>` → `requestPictureInPicture()` (classic video PiP: always on top, but no custom UI inside).
- ✅ Works on **any site with a `<video>`** (YouTube, Vimeo, course platforms, Twitch, …).
- ✅ Light: no app to install beyond the extension, reuses the browser's player, login, and ads.
- ✅ Direct access to YouTube's caption DOM for the subtitle text mode.
- ❌ Chromium only for Document PiP (Firefox/Safari would get the classic PiP fallback).
- ❌ The source tab must stay open (it can be in the background).
- ❌ DRM-protected video (Netflix, Disney+…) draws as **black** on the canvas.

### 4.3 Approach C — Desktop app (Electron / Tauri)

- A frameless, `alwaysOnTop`, optionally transparent window holding a `<webview>` that loads any URL.
- Crop with CSS transforms inside the webview, or capture the webview to an offscreen canvas.
- ✅ Can load any page (iframe blocking does not apply to a top-level webview).
- ✅ Full control of the window: click-through, global hotkeys, tray icon, per-monitor positions.
- ❌ Heavy (Electron ≈ 100MB+), and you basically ship and maintain a browser.
- ❌ Separate logins and cookies from your main browser, so YouTube Premium and other accounts need a separate sign-in.
- ❌ More hassle from Google sign-in, which blocks embedded browsers.

### 4.4 Approach D — Screen-region mirror (most general)

- Capture **any part of the screen** with `getDisplayMedia()` (web) or **ScreenCaptureKit** (native macOS, Swift), crop it, and render it zoomed in a floating window.
- Inside the browser, the **Region Capture API** (`CropTarget` + `track.cropTo()`) can crop a tab capture to a specific element.
- ✅ Works with **anything**: native apps (VLC, IINA, Zoom), games, any site.
- ❌ Requires screen-recording permission.
- ❌ The source must actually be **visible on screen** (it cannot be hidden behind other windows), which undercuts the "small corner" goal unless the source sits on another monitor.
- ❌ Protected content is still black. Uses more CPU/GPU.

### 4.5 Key insight: subtitles are often *text*, not pixels

- YouTube closed captions are **DOM elements** drawn over the video (`.ytp-caption-window-container`, `.ytp-caption-segment`). They are **not part of the video frames**.
  - So a canvas crop of the `<video>` will **not contain YouTube CC** at all. ⚠️ This is important for approach B.
  - The better option: **observe the caption DOM** with a `MutationObserver` and render the text in the viewer: large, crisp, any font, any color, with zero video decoding.
  - Alternative: fetch the timed-text track (`timedtext` / the caption tracks in the player response) and sync it to `video.currentTime`. That is more robust than DOM scraping and enables history and transcript.
- **Burned-in (hardcoded) subtitles** are part of the pixels, so the crop approach is right for them. Optional OCR later (Tesseract.js, or the browser's Shape Detection `TextDetector` where available).
- For the approach A iframe crop, YouTube CC *are* visible, because you are scaling the whole player including its overlays.

➡ The product should support two modes:
1. **Crop mode**: a pixel crop of any zone (slides, scoreboard, burned-in subs).
2. **Caption mode**: re-render subtitle text (YouTube CC, `<track>` WebVTT, other players' caption DOM).

### 4.6 Comparison

| | A. iframe + CSS | B. Extension + Doc PiP ⭐ | C. Electron/Tauri | D. Screen mirror |
|---|---|---|---|---|
| Effort to MVP | ⭐ very low | low–medium | medium–high | medium |
| Floats over other apps | ❌ | ✅ | ✅ | ✅ |
| Works on | YouTube embeds, iframe-friendly sites | any page with `<video>` | any URL | anything on screen |
| Uses your browser login | partially | ✅ | ❌ | ✅ |
| YouTube CC visible | ✅ (as pixels) | via caption mode | ✅ (as pixels) | ✅ (as pixels) |
| Source can be hidden | n/a | ✅ (background tab) | ✅ | ❌ |
| DRM content | ❌ | ❌ | ❌ | ❌ |
| Install footprint | none | extension | big app | small/native app |

---

## 5. Risks & constraints

- **DRM**: Netflix, Disney+, Prime and other protected videos render black in canvas and screen capture. Caption mode may still work if the captions are DOM text.
- **YouTube ToS and ads**: embedding via the official player is fine. Hiding ads or controls inside the embed could be a ToS issue. Approach B keeps the real player in its own tab, which is cleaner.
- **Fragile selectors**: YouTube changes its DOM. Isolate the caption and video adapters per site and keep them small.
- **Coordinate drift**: the player resizes (theater mode, fullscreen, window resize) and video resolution changes. Store zones as **normalized 0–1 coordinates relative to the video's intrinsic frame** (`videoWidth/videoHeight`), not CSS pixels. Account for letterboxing.
- **Performance**: a canvas copy at 60fps is cheap at small sizes. Use `requestVideoFrameCallback`, pause the loop when the video is paused, and cap the size.
- **Browser support**: Document PiP is Chromium-only for now. Plan the classic PiP fallback.
- **Autoplay/audio**: audio still comes from the source tab, which is good. Muting the viewer is irrelevant.

---

## 6. Prior art / alternatives

| Existing thing | What it does | Gap vs. this idea |
|---|---|---|
| Browser built-in PiP | Floats the whole video | No zone/crop, no zoom |
| Floating-browser apps (e.g. Helium-style) | Always-on-top mini browser | Shows the whole page, no zone focus |
| OBS / screen tools with crop | Crop + scale a region | Heavy, made for recording/streaming |
| macOS Zoom / magnifier | Magnify around the cursor | Follows the cursor, not a fixed zone; not a floating mini window |
| Language-learning extensions | Dual subtitles, transcripts | Mostly inside the page, not a floating focus window |

**Differentiator:** *region focus*. You pin the one part of the content you care about, in a tiny always-on-top window, and drop everything else.

---

## 7. UX sketches

**Viewer (subtitle strip, bottom-right corner):**
```
                                         ┌──────────────────────────────┐
                                         │  and that's why the cache    │
                                         │  invalidation is so hard…    │
                                         └─[▶]─[⟲]─[⟳]─[✎ zone]─[⚙]─────┘
```

**Zone editor (overlay on the source video):**
```
┌───────────────────────────────────────────────┐
│                                               │
│               (dimmed video)                  │
│                                               │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  and that's why the cache invalidation  ┃◀─ drag to move
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━■━┛  │
│                                          ▲    │
└──────────────────────────────────────────┼────┘
   Presets: [Subtitles] [Center] [Custom]  resize handle
```

**Flow:**
1. On a video page, click the extension icon (or press a hotkey).
2. The zone overlay appears with the "Subtitles" preset preselected. Adjust it by dragging.
3. Press Enter, or "Pop out". A Document PiP window opens showing the zone, zoomed.
4. Move the PiP window to a corner. Click ✎ to edit the zone again; the overlay returns on the source.
5. The zone is remembered for this site/channel next time.

---

## 8. Recommended roadmap

| Phase | Goal | Scope |
|---|---|---|
| **0 — Prototype (≈1 day)** | Validate the *feel* | Single HTML page: YouTube IFrame API + CSS crop (approach A), draggable zone, subtitle preset |
| **1 — MVP extension** | Real always-on-top usage | Chrome MV3 extension: content script, zone overlay, canvas crop → **Document PiP** (approach B), plus **caption mode** for YouTube CC; classic PiP fallback |
| **2 — Polish** | Daily driver | Presets per site/channel, multiple zones, hotkeys, filters, transcript history |
| **3 — Optional** | Beyond the browser | Native macOS app with ScreenCaptureKit (approach D) or Tauri (approach C) for non-browser sources |

Suggested stack for Phase 1: **TypeScript + Vite + a Chrome MV3 extension** (e.g. CRXJS or WXT), with plain DOM or a tiny UI lib (Preact/Svelte) for the PiP UI.

---

## 9. Open questions

1. **Platform**: browser-only (extension) to begin with, or do you need native apps and non-browser sources too?
2. **Scope of sources**: YouTube only first, or any `<video>` site from day one?
3. **Main use case**: is it mostly **subtitles**? If so, caption mode alone might be the MVP and the crop mode comes second.
4. **Audience**: a personal tool, or a product to publish (Chrome Web Store, store policies, YouTube ToS review)?
5. **Browsers**: is Chromium-only (Chrome/Edge/Arc/Brave) acceptable for v1?

---

## 10. Recommendation

Start with a **Phase 0 HTML prototype** to confirm the experience feels good. Then build a **Chrome extension that uses Document Picture-in-Picture**, with two modes: **crop mode** (canvas zone of the `<video>`) and **caption mode** (re-rendered subtitle text).

This combination gives a true always-on-top corner window, works on most video sites, reuses your browser login, and handles the subtitle case well. YouTube CC are not in the video pixels, so caption mode is required for that case anyway.
