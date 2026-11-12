import type { CaptionSource } from './captions';
import { getFlag, setFlag, type ViewMode } from './storage';
import { PIP_CSS } from './styles';
import { toSource, zoneAspect, type Zone } from './zone';

/** Minimal typing for the Document Picture-in-Picture API (Chrome 116+). */
interface DocumentPictureInPicture {
  requestWindow(opts?: { width?: number; height?: number; disallowReturnToOpener?: boolean }): Promise<Window>;
  readonly window: Window | null;
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export interface Viewer {
  setZone(z: Zone): void;
  setMode(m: ViewMode): void;
  close(): void;
}

export interface ViewerHandlers {
  onEdit(): void;
  onMode(m: ViewMode): void;
  /** "On top" checkbox: the controller reopens the viewer in the other kind of window. */
  onTopChange(onTop: boolean): void;
  onClose(): void;
}

export const docPipSupported = () => !!window.documentPictureInPicture;

const MAX_CANVAS_W = 1920;
const PLACEMENT_HINT = 'placement-hint-shown';
const HINT_MS = 6000;

/** Window size that fits the zone's aspect ratio. */
export function pipSize(zone: Zone, vw: number, vh: number, mode: ViewMode) {
  if (mode === 'captions') return { width: 560, height: 150 };
  const aspect = zoneAspect(zone, vw, vh);
  let width = aspect >= 3 ? 640 : 480;
  let height = Math.round(width / aspect);
  if (height < 90) height = 90;
  if (height > 540) {
    height = 540;
    width = Math.round(height * aspect);
  }
  return { width: Math.max(240, width), height };
}

/** Where to open the window: the current viewer window's position and size, if switching. */
export interface WindowPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Focus window that shows the zone (crop mode) or the subtitle text (caption mode).
 * - onTop: a Document PiP window, always on top of other apps.
 * - not onTop: a normal popup window (window.open) that other windows can cover.
 * Both are same-origin about:blank documents, so the same UI is built into either.
 * Must be opened from a user gesture (a click on the page or in the current focus window).
 */
export class PipViewer implements Viewer {
  private win!: Window;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private capEl!: HTMLDivElement;
  private modeBtn!: HTMLButtonElement;
  private playBtn!: HTMLButtonElement;
  private onTopBox!: HTMLInputElement;
  private raf = 0;
  private lastTime = -1;
  private dirty = true;
  private closed = false;
  private captionsStarted = false;
  private hadCaption = false;

  private constructor(
    private video: HTMLVideoElement,
    private zone: Zone,
    private mode: ViewMode,
    private captions: CaptionSource | null,
    private handlers: ViewerHandlers,
    private onTop: boolean,
  ) {}

  static async open(
    video: HTMLVideoElement,
    zone: Zone,
    mode: ViewMode,
    captions: CaptionSource | null,
    handlers: ViewerHandlers,
    onTop: boolean,
    placement?: WindowPlacement,
  ): Promise<PipViewer> {
    const size = placement ?? pipSize(zone, video.videoWidth, video.videoHeight, mode);
    const v = new PipViewer(video, zone, mode, captions, handlers, onTop);
    if (onTop) {
      const api = window.documentPictureInPicture;
      if (!api) throw new Error('Document Picture-in-Picture is not supported');
      api.window?.close(); // only one PiP window per page
      v.win = await api.requestWindow({ width: size.width, height: size.height });
    } else {
      let features = `popup,width=${size.width},height=${size.height}`;
      if (placement) features += `,left=${placement.left},top=${placement.top}`;
      const win = window.open('', '_blank', features);
      if (!win) throw new Error('The popup window was blocked');
      v.win = win;
    }
    v.build();
    return v;
  }

  /** Current window position and size, so a replacement window can open in the same spot. */
  placement(): WindowPlacement | undefined {
    if (this.closed) return undefined;
    const w = this.win;
    return { left: w.screenX, top: w.screenY, width: w.innerWidth, height: w.innerHeight };
  }

  get isOnTop() {
    return this.onTop;
  }

  /** The "On top" checkbox couldn't switch windows: put it back. */
  revertOnTop() {
    if (!this.closed) this.onTopBox.checked = this.onTop;
  }

  setZone(z: Zone) {
    this.zone = z;
    this.dirty = true;
  }

  setMode(m: ViewMode) {
    this.mode = m;
    this.dirty = true;
    this.applyMode();
  }

  close() {
    if (this.closed) return;
    this.cleanup();
    this.win.close();
  }

  private build() {
    const d = this.win.document;
    d.title = 'Browser Focus';
    const style = d.createElement('style');
    style.textContent = PIP_CSS;
    d.head.append(style);

    const stage = d.createElement('div');
    stage.className = 'stage';
    this.canvas = d.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.capEl = d.createElement('div');
    this.capEl.className = 'captions';
    stage.append(this.canvas, this.capEl);

    const controls = d.createElement('div');
    controls.className = 'controls';
    const btn = (label: string, title: string, fn: () => void) => {
      const b = d.createElement('button');
      b.textContent = label;
      b.title = title;
      b.onclick = fn;
      controls.append(b);
      return b;
    };
    btn('−5s', 'Back 5 seconds', () => this.seek(-5));
    this.playBtn = btn('⏯', 'Play / pause', () => (this.video.paused ? this.video.play() : this.video.pause()));
    btn('+5s', 'Forward 5 seconds', () => this.seek(5));
    this.modeBtn = btn('', '', () => this.handlers.onMode(this.mode === 'crop' ? 'captions' : 'crop'));
    btn('✎ Zone', 'Edit the focus zone on the page', () => this.handlers.onEdit());
    const onTopLabel = d.createElement('label');
    onTopLabel.className = 'ontop';
    onTopLabel.title = 'Keep this window on top of other apps';
    this.onTopBox = d.createElement('input');
    this.onTopBox.type = 'checkbox';
    this.onTopBox.checked = this.onTop;
    this.onTopBox.onchange = () => this.handlers.onTopChange(this.onTopBox.checked);
    onTopLabel.append(this.onTopBox, 'On top');
    controls.append(onTopLabel);

    d.body.append(stage, controls);
    d.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        this.playBtn.click();
      } else if (e.key === 'ArrowLeft') this.seek(-5);
      else if (e.key === 'ArrowRight') this.seek(5);
    });
    this.win.addEventListener('pagehide', () => {
      if (this.closed) return;
      this.cleanup();
      this.handlers.onClose();
    });

    this.applyMode();
    this.loop();
    if (this.onTop) void this.showPlacementHint();
  }

  /**
   * First pop-out only: Chrome picks the window position (bottom-right) and extensions
   * can't move it, but Chrome remembers where the user drags it.
   */
  private async showPlacementHint() {
    if (await getFlag(PLACEMENT_HINT)) return;
    setFlag(PLACEMENT_HINT);
    if (this.closed) return;
    const d = this.win.document;
    const hint = d.createElement('div');
    hint.className = 'hint-toast';
    hint.textContent = 'Drag this window wherever you like. Chrome will remember the spot.';
    d.body.append(hint);
    this.win.setTimeout(() => hint.classList.add('fade'), HINT_MS);
    this.win.setTimeout(() => hint.remove(), HINT_MS + 600);
  }

  private seek(delta: number) {
    const v = this.video;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
  }

  private applyMode() {
    const crop = this.mode === 'crop';
    this.canvas.classList.toggle('hidden', !crop);
    this.capEl.classList.toggle('hidden', crop);
    this.modeBtn.textContent = crop ? 'Aa Captions' : '▣ Crop';
    this.modeBtn.disabled = crop && !this.captions;
    this.modeBtn.title = this.modeBtn.disabled ? 'No captions found on this video' : 'Switch view mode';
    if (!crop) this.startCaptions();
  }

  private startCaptions() {
    if (this.captionsStarted) return;
    this.captionsStarted = true;
    if (!this.captions) {
      this.renderCaptions([]);
      return;
    }
    this.renderCaptions([]);
    this.captions.start((lines) => this.renderCaptions(lines));
  }

  private renderCaptions(lines: string[]) {
    const d = this.win.document;
    if (lines.length) {
      this.hadCaption = true;
      this.capEl.classList.remove('stale');
      this.capEl.replaceChildren(
        ...lines.slice(-2).map((t) => {
          const div = d.createElement('div');
          div.textContent = t;
          return div;
        }),
      );
    } else if (this.hadCaption) {
      this.capEl.classList.add('stale'); // keep the last line, dimmed, so it can still be read
    } else {
      const hint = d.createElement('div');
      hint.className = 'hint';
      hint.textContent = this.captions
        ? 'Waiting for captions… turn on CC (subtitles) in the player.'
        : 'No captions found on this video.';
      this.capEl.replaceChildren(hint);
    }
  }

  /** Draw on the PiP window's frame clock, only when the video frame or the zone changed. */
  private loop = () => {
    if (this.closed) return;
    const v = this.video;
    if (this.mode === 'crop' && v.videoWidth && (this.dirty || v.currentTime !== this.lastTime)) {
      this.dirty = false;
      this.lastTime = v.currentTime;
      const s = toSource(this.zone, v.videoWidth, v.videoHeight);
      const scale = Math.min(1, MAX_CANVAS_W / s.width);
      const cw = Math.round(s.width * scale);
      const ch = Math.round(s.height * scale);
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }
      try {
        this.ctx.drawImage(v, s.left, s.top, s.width, s.height, 0, 0, cw, ch);
      } catch {
        /* frame not ready yet */
      }
    }
    this.raf = this.win.requestAnimationFrame(this.loop);
  };

  private cleanup() {
    this.closed = true;
    try {
      this.win.cancelAnimationFrame(this.raf);
    } catch {
      /* window already gone */
    }
    this.captions?.stop();
  }
}
