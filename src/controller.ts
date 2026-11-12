import { browser } from 'wxt/browser';
import { detectCaptions } from './captions';
import { ClassicPipViewer } from './pip-fallback';
import { PipViewer, docPipSupported, type Viewer, type WindowPlacement } from './pip-viewer';
import { getFlag, loadSite, saveSite, setFlag, type ViewMode } from './storage';
import { findTargetVideo } from './video-finder';
import { ZoneEditor, toast } from './zone-editor';
import { PRESETS, type Zone } from './zone';

/** Stored when the user unchecks "On top", so the next pop-out uses a normal window. */
const NOT_ON_TOP = 'not-on-top';

/**
 * Wires the editor and the viewer together. The editor and the viewer can be open at the
 * same time: zone edits show up live in the PiP window.
 */
export class Controller {
  private video: HTMLVideoElement | null = null;
  private editor: ZoneEditor | null = null;
  private viewer: Viewer | null = null;
  private zone: Zone = PRESETS.subtitles;
  private mode: ViewMode = 'crop';
  private host = location.hostname;
  private onTop = true;
  /** "On top" was re-checked in a popup but Chrome blocked PiP: waiting for a Pop out click. */
  private pendingOnTop = false;

  constructor() {
    // A normal popup window outlives the page, unlike Document PiP: close it with the page.
    window.addEventListener('pagehide', () => this.viewer?.close());
    void getFlag(NOT_ON_TOP).then((v) => (this.onTop = !v));
  }

  /** Toolbar icon / keyboard shortcut. */
  async toggle() {
    if (this.editor) return this.closeEditor();
    await this.openEditor();
  }

  private async openEditor() {
    const video = this.viewer && this.video?.isConnected ? this.video : findTargetVideo();
    if (!video) {
      if (window === window.top && !hasLargeIframe()) toast('Browser Focus: no video found on this page.');
      return;
    }
    if (video !== this.video) {
      this.video = video;
      const saved = await loadSite(this.host);
      this.zone = saved.zone ?? PRESETS.subtitles;
      this.mode = saved.mode ?? 'crop';
    }
    const captionsAvailable = !!detectCaptions(video);
    if (this.mode === 'captions' && !captionsAvailable) this.mode = 'crop';

    this.editor = new ZoneEditor(video, {
      zone: this.zone,
      mode: this.mode,
      captionsAvailable,
      viewing: !!this.viewer && !this.pendingOnTop,
      onZone: (z) => {
        this.zone = z;
        this.viewer?.setZone(z);
        this.save();
      },
      onMode: (m) => this.setMode(m),
      onPopOut: () => void this.popOut(),
      onClose: () => this.closeEditor(),
    });
  }

  private closeEditor() {
    this.editor?.destroy();
    this.editor = null;
  }

  private setMode(m: ViewMode) {
    this.mode = m;
    this.editor?.setMode(m);
    this.viewer?.setMode(m);
    this.save();
  }

  /** Runs inside the "Pop out" click, so the window request has a user gesture. */
  private async popOut() {
    this.pendingOnTop = false;
    this.viewer?.close();
    this.viewer = null;
    try {
      this.viewer = await this.openViewer(this.onTop);
      if (this.viewer) this.closeEditor();
    } catch (err) {
      console.warn('[browser-focus] could not open the focus window', err);
      toast('Could not open the focus window. Click "Pop out" again.');
    }
  }

  /**
   * "On top" checkbox in the focus window (runs inside that click). Opens the other kind of
   * window in the same spot first, then closes the old one, so a failure keeps the old one.
   */
  private async setOnTop(onTop: boolean) {
    const old = this.viewer;
    if (!(old instanceof PipViewer)) return;
    if (onTop === old.isOnTop) {
      // Unchecked again while waiting for the Pop out click: cancel the pending switch.
      this.pendingOnTop = false;
      this.onTop = onTop;
      setFlag(NOT_ON_TOP, !onTop);
      this.editor?.setViewing(true);
      return;
    }
    try {
      const next = await this.openViewer(onTop, old.placement());
      if (!next) return old.revertOnTop();
      old.close();
      this.viewer = next;
      this.onTop = onTop;
      setFlag(NOT_ON_TOP, !onTop);
    } catch (err) {
      if (onTop && err instanceof DOMException && err.name === 'NotAllowedError') return this.askForPopOutClick();
      console.warn('[browser-focus] could not switch the focus window', err);
      old.revertOnTop();
    }
  }

  /**
   * Chrome only opens an always-on-top (PiP) window right after a click on the video's page.
   * A click in the normal popup doesn't count, so bring the page forward and ask for a click
   * on "Pop out". The popup stays open until then.
   */
  private askForPopOutClick() {
    this.pendingOnTop = true;
    this.onTop = true;
    setFlag(NOT_ON_TOP, false);
    void browser.runtime.sendMessage({ type: 'focus-tab' }).catch(() => {});
    if (this.editor) this.editor.setViewing(false);
    else void this.openEditor();
    toast('Click "Pop out ▶" to put the focus window back on top.', 6000);
  }

  private async openViewer(onTop: boolean, placement?: WindowPlacement): Promise<Viewer | null> {
    const video = this.video;
    if (!video) return null;
    let viewer: Viewer | null = null;
    const onClose = () => {
      if (this.viewer === viewer) this.onViewerClosed();
    };
    if (onTop && !docPipSupported()) {
      if (!ClassicPipViewer.supported()) {
        toast('Picture-in-Picture is not available in this browser.');
        return null;
      }
      if (this.mode === 'captions') toast('Captions mode needs Document Picture-in-Picture (Chrome 116+).');
      return (viewer = await ClassicPipViewer.open(video, this.zone, onClose));
    }
    const handlers = {
      onEdit: () => {
        if (!this.editor) void this.openEditor();
      },
      onMode: (m: ViewMode) => this.setMode(m),
      onTopChange: (t: boolean) => void this.setOnTop(t),
      onClose,
    };
    return (viewer = await PipViewer.open(video, this.zone, this.mode, detectCaptions(video), handlers, onTop, placement));
  }

  private onViewerClosed() {
    this.viewer = null;
    this.editor?.setViewing(false);
  }

  private save() {
    saveSite(this.host, { zone: this.zone, mode: this.mode });
  }
}

function hasLargeIframe() {
  return Array.from(document.querySelectorAll('iframe')).some((f) => {
    const r = f.getBoundingClientRect();
    return r.width >= 200 && r.height >= 100;
  });
}
