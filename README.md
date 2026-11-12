# Browser Focus

A Chrome extension that shows **only one zone of a video**, zoomed in, in a small **always-on-top window**. A typical use is showing just the subtitle strip in a corner of the screen while you work in other apps.

```
 YouTube tab                              Focus window (stays on top of every app)
┌──────────────────────────────┐         ┌──────────────────────────────┐
│                              │         │  and that's why the cache    │
│        (video picture)       │  ───▶   │  invalidation is so hard…    │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │         └─[−5s]─[⏯]─[+5s]─[Aa]─[✎]─────┘
│ ┃ and that's why the cache ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
└──────────────────────────────┘
```

- **Crop mode**: shows the chosen zone of the video, scaled up.
- **Captions mode**: shows the subtitle text in large, sharp type instead of video pixels.
- Works on **any page with a `<video>`** (YouTube, Vimeo, course sites, …), including videos inside iframes.
- Remembers the zone and mode **per website**.

> Requires **Chrome / Edge / Brave 116+** (Document Picture-in-Picture). Other browsers fall back to classic Picture-in-Picture, which supports crop mode only.

---

## Install

### Option A: build and load unpacked (normal use)

```bash
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
4. Optional: pin **Browser Focus** to the toolbar from the puzzle-piece menu.

After pulling new changes, run `npm run build` again and click ↻ on the extension card.

### Option B: development mode (hot reload)

```bash
npm install
npm run dev
```

This opens a separate Chrome window with the extension loaded. It reloads automatically when you edit the code.

---

## How to use

### 1. Open the zone editor
On a page with a video, either:
- click the **Browser Focus** toolbar icon, or
- press **Alt+Shift+F** (on macOS: **Option+Shift+F**).

A dimmed overlay appears on the video, with a blue **Focus zone** box (by default the *Subtitles* preset at the bottom of the picture) and a toolbar above it.

### 2. Choose the zone

| Action | How |
|---|---|
| Move the zone | Drag inside the blue box |
| Resize | Drag one of the 8 round handles |
| Draw a new zone | Drag on the dimmed area outside the box |
| Presets | **Subtitles** (bottom strip) · **Center** · **Full** |
| View mode | **Crop** (video pixels) · **Captions** (subtitle text) |

### 3. Pop it out
Click **Pop out ▶** (or press **Enter**). A small window opens that stays on top of all apps. Move and resize it wherever you like, for example to a corner of the screen.

> **Window position:** Chrome decides where the window first appears (bottom-right) and doesn't let extensions move it. Drag it once to where you want it, e.g. the bottom-left corner. Chrome remembers that spot and opens the window there next time.

### 4. Controls in the focus window
Hover over the window to show the controls:

| Button / key | Does |
|---|---|
| **−5s** / **←** | Back 5 seconds |
| **⏯** / **Space** / **K** | Play / pause |
| **+5s** / **→** | Forward 5 seconds |
| **Aa Captions** / **▣ Crop** | Switch view mode |
| **✎ Zone** | Reopen the editor on the page. Changes show up in the window live. Click **Done ✓** when finished |
| **☑ On top** | Uncheck to turn the focus window into a normal window that other apps can cover. Check it again to go back on top. Chrome only allows an always-on-top window right after a click on the video page, so the extension usually brings the video tab forward and asks you to click **Pop out ▶** once more. The choice is remembered for the next pop-out |

Close the window with its normal close button. Press **Esc** (or **✕**) to close the editor on the page.

### Using captions mode on YouTube
YouTube draws subtitles as text on top of the video, not inside the video picture. Captions mode reads that text and shows it large and crisp.

1. Turn on **CC** (subtitles) in the YouTube player.
2. Switch the focus window to **Aa Captions**.

Until a subtitle appears, the window shows *"Waiting for captions…"*. Between lines, the last line stays visible, dimmed, so you can finish reading it.

On other sites, captions mode uses the video's standard subtitle track (`<track>` / WebVTT) if there is one. If a site has no captions, the Captions button is disabled.

> **Tip:** subtitles burned into the video picture (hardcoded) aren't text. Use **Crop** mode with the **Subtitles** preset for those.

---

## Known limitations

- **DRM videos** (Netflix, Disney+, Prime Video, …) show as a **black** picture in crop mode. Browsers block copying protected video. Captions mode may still work if the site's captions are page text.
- **The source tab must stay open.** The video keeps playing in its tab. Audio comes from there too.
- **Background tabs:** Chrome may stop drawing video frames when the source tab is hidden, which can freeze the picture in crop mode. *(Still being tested.)*
- **Install warning:** Chrome says the extension can *"read and change data on all websites"*. It needs that to find videos on any page, including inside iframes. It only acts when you click the icon or press the shortcut, and it stores only your zone and mode per site, in local extension storage.
- Only **one focus window** at a time.
- With **On top** unchecked, the focus window is a normal browser popup. It has a small address bar showing `about:blank`, and it closes when the source page is closed or reloaded.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "No video found on this page" | Start the video first, scroll it into view, or reload the page after installing the extension. |
| Nothing happens on click | Make sure you're on the latest build: run `npm run build`, then click ↻ on the extension in `chrome://extensions`. Tabs opened before installing are handled automatically. A red **!** on the icon means the page can't run extensions (`chrome://…`, the Web Store). |
| Shortcut doesn't work | Another app or extension is using it. Change it at `chrome://extensions/shortcuts`. |
| "Could not open the focus window" | Click **Pop out** again. The window can only be opened right after a click. |
| Captions window says "Waiting for captions…" | Turn on CC in the player. |

---

## Development

```bash
npm run dev       # Chrome with the extension, hot reload
npm run build     # production build → .output/chrome-mv3
npm run zip       # packaged zip for sharing / store upload
npm test          # unit tests (Vitest)
npm run compile   # type-check (tsc)
```

Built with [WXT](https://wxt.dev) and TypeScript (Manifest V3), with no UI framework.

### Project structure

```
entrypoints/
  background.ts      toolbar click / shortcut → sends "toggle" to the tab
  content.ts         runs on every page (all frames), hands off to the controller
src/
  controller.ts      opens and closes the editor and the focus window, keeps them in sync
  zone.ts            zone math: normalized 0–1 coordinates, letterboxing, presets
  zone-editor.ts     drag/resize overlay on the page (Shadow DOM), toasts
  pip-viewer.ts      Document Picture-in-Picture window: crop canvas, captions, controls
  pip-fallback.ts    classic PiP fallback (canvas → stream → <video>)
  captions.ts        caption sources: YouTube CC (DOM) and <track> text tracks
  video-finder.ts    picks the target video (largest visible, prefers playing)
  storage.ts         per-site settings in chrome.storage.local
  styles.ts          CSS for the editor and the focus window
tests/
  zone.test.ts       unit tests for the zone math
```

### How it works (short version)

1. The zone is stored as **fractions of the video frame** (`x, y, w, h` from 0 to 1). This keeps it correct when the player resizes, switches to theater/fullscreen, or changes quality.
2. **Pop out** calls `documentPictureInPicture.requestWindow()` from the click, since a user gesture is required.
3. In crop mode, the focus window copies only the zone from the page's `<video>` onto a `<canvas>` with `drawImage(video, sx, sy, sw, sh, …)`. It redraws on its own frame clock, and only when the video frame or the zone changes.
4. In captions mode, a `MutationObserver` watches YouTube's caption elements (or `cuechange` on text tracks) and shows the text.

### Project docs

- `brainstorms/`: idea exploration and plans that weren't approved.
- `plans/`: approved implementation plans (saved automatically by a Claude Code hook; see `CLAUDE.md`).
