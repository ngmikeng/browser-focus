import { EDITOR_CSS } from './styles';
import type { ViewMode } from './storage';
import { videoBox } from './video-finder';
import { MIN_SIZE, PRESETS, clampZone, contentRect, toClient, type PresetName, type Rect, type Zone } from './zone';

export interface EditorOptions {
  zone: Zone;
  mode: ViewMode;
  captionsAvailable: boolean;
  viewing: boolean;
  onZone(zone: Zone): void;
  onMode(mode: ViewMode): void;
  onPopOut(): void;
  onClose(): void;
}

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};

/** Mount point for the extension's page UI: a Shadow DOM host that follows fullscreen. */
export function createHost(): { host: HTMLElement; root: ShadowRoot; attach(): void } {
  const host = document.createElement('browser-focus-ui');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = EDITOR_CSS;
  root.append(style);
  // In fullscreen only the fullscreen element's subtree is rendered, so move the host inside it.
  const attach = () => {
    const fs = document.fullscreenElement;
    const parent = fs && !(fs instanceof HTMLVideoElement) ? fs : document.documentElement;
    if (host.parentNode !== parent) parent.append(host);
  };
  attach();
  return { host, root, attach };
}

/** Drag/resize overlay that lets the user pick the focus zone on top of the video. */
export class ZoneEditor {
  private ui = createHost();
  private el = h('div', 'root');
  private clip = h('div', 'clip');
  private zoneEl = h('div', 'zone');
  private bar = h('div', 'bar');
  private presetBtns = new Map<PresetName, HTMLButtonElement>();
  private modeBtns = new Map<ViewMode, HTMLButtonElement>();
  private popBtn = h('button', 'primary');
  private content: Rect = { left: 0, top: 0, width: 0, height: 0 };
  private raf = 0;
  private zone: Zone;
  private onFs = () => this.ui.attach();
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.opts.onClose();
    } else if (e.key === 'Enter' && !this.opts.viewing) {
      e.stopPropagation();
      e.preventDefault();
      this.opts.onPopOut();
    }
  };

  constructor(private video: HTMLVideoElement, private opts: EditorOptions) {
    this.zone = opts.zone;
    this.build();
    this.ui.root.append(this.el);
    document.addEventListener('fullscreenchange', this.onFs);
    window.addEventListener('keydown', this.onKey, true);
    this.tick();
  }

  setZone(z: Zone) {
    this.zone = z;
    this.layoutZone();
    this.syncPresets();
  }

  setMode(m: ViewMode) {
    this.opts.mode = m;
    for (const [k, b] of this.modeBtns) b.setAttribute('aria-pressed', String(k === m));
  }

  setViewing(viewing: boolean) {
    this.opts.viewing = viewing;
    this.popBtn.textContent = viewing ? 'Done ✓' : 'Pop out ▶';
    this.popBtn.title = viewing ? 'Close the editor (the window stays open)' : 'Open the focus window (Enter)';
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('fullscreenchange', this.onFs);
    window.removeEventListener('keydown', this.onKey, true);
    this.ui.host.remove();
  }

  private build() {
    // handles
    for (const e of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as Edge[]) {
      const hd = h('div', 'h');
      hd.dataset.e = e;
      this.zoneEl.append(hd);
    }
    this.zoneEl.append(h('span', 'label', 'Focus zone'));
    this.clip.append(this.zoneEl);
    this.clip.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // toolbar
    const presets: [PresetName, string][] = [
      ['subtitles', 'Subtitles'],
      ['center', 'Center'],
      ['full', 'Full'],
    ];
    for (const [name, label] of presets) {
      const b = h('button', '', label);
      b.onclick = () => this.commit(PRESETS[name]);
      this.presetBtns.set(name, b);
      this.bar.append(b);
    }
    this.bar.append(h('span', 'sep'));
    const modes: [ViewMode, string, string][] = [
      ['crop', 'Crop', 'Show the zone of the video, zoomed in'],
      ['captions', 'Captions', 'Show subtitle text in large type'],
    ];
    for (const [m, label, title] of modes) {
      const b = h('button', '', label);
      b.title = title;
      if (m === 'captions' && !this.opts.captionsAvailable) {
        b.disabled = true;
        b.title = 'No captions found on this video';
      }
      b.onclick = () => {
        this.setMode(m);
        this.opts.onMode(m);
      };
      this.modeBtns.set(m, b);
      this.bar.append(b);
    }
    this.bar.append(h('span', 'sep'));
    this.popBtn.onclick = () => (this.opts.viewing ? this.opts.onClose() : this.opts.onPopOut());
    const close = h('button', '', '✕');
    close.title = 'Close (Esc)';
    close.onclick = () => this.opts.onClose();
    this.bar.append(this.popBtn, close);

    this.el.append(this.clip, this.bar);
    this.setMode(this.opts.mode);
    this.setViewing(this.opts.viewing);
    this.syncPresets();
  }

  /** Follow the video every frame: handles scroll, resize, theater mode, layout shifts. */
  private tick = () => {
    this.ui.attach();
    const style = getComputedStyle(this.video);
    this.content = contentRect(videoBox(this.video), this.video.videoWidth, this.video.videoHeight, style.objectFit);
    const c = this.content;
    Object.assign(this.clip.style, {
      left: `${c.left}px`,
      top: `${c.top}px`,
      width: `${c.width}px`,
      height: `${c.height}px`,
    });
    this.layoutZone();
    // toolbar above the picture, or inside its top edge when there is no room
    const barH = this.bar.offsetHeight || 34;
    const top = c.top - barH - 8 >= 4 ? c.top - barH - 8 : Math.max(4, c.top + 8);
    this.bar.style.left = `${Math.max(4, c.left + 8)}px`;
    this.bar.style.top = `${top}px`;
    this.raf = requestAnimationFrame(this.tick);
  };

  private layoutZone() {
    const r = toClient(this.zone, { left: 0, top: 0, width: this.content.width, height: this.content.height });
    Object.assign(this.zoneEl.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }

  private syncPresets() {
    for (const [name, b] of this.presetBtns) {
      const p = PRESETS[name];
      const same = (['x', 'y', 'w', 'h'] as const).every((k) => Math.abs(p[k] - this.zone[k]) < 1e-3);
      b.setAttribute('aria-pressed', String(same));
    }
  }

  private commit(z: Zone) {
    this.setZone(clampZone(z));
    this.opts.onZone(this.zone);
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const c = this.content;
    if (!c.width || !c.height) return;
    const start = { x: e.clientX, y: e.clientY };
    const z0 = { ...this.zone };
    const toNorm = (cx: number, cy: number) => ({ x: (cx - c.left) / c.width, y: (cy - c.top) / c.height });

    let apply: (dx: number, dy: number, ev: PointerEvent) => Zone;
    if (target.classList.contains('h')) {
      const edge = target.dataset.e as Edge;
      apply = (dx, dy) => resize(z0, edge, dx, dy);
    } else if (target === this.zoneEl || this.zoneEl.contains(target)) {
      apply = (dx, dy) => ({ ...z0, x: z0.x + dx, y: z0.y + dy });
    } else {
      // drag on the dimmed area: draw a new zone from this point
      const p0 = toNorm(start.x, start.y);
      apply = (_dx, _dy, ev) => {
        const p = toNorm(ev.clientX, ev.clientY);
        return {
          x: Math.min(p0.x, p.x),
          y: Math.min(p0.y, p.y),
          w: Math.max(MIN_SIZE, Math.abs(p.x - p0.x)),
          h: Math.max(MIN_SIZE, Math.abs(p.y - p0.y)),
        };
      };
    }

    this.clip.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / c.width;
      const dy = (ev.clientY - start.y) / c.height;
      this.commit(apply(dx, dy, ev));
    };
    const up = (ev: PointerEvent) => {
      this.clip.releasePointerCapture(ev.pointerId);
      this.clip.removeEventListener('pointermove', move);
      this.clip.removeEventListener('pointerup', up);
      this.clip.removeEventListener('pointercancel', up);
    };
    this.clip.addEventListener('pointermove', move);
    this.clip.addEventListener('pointerup', up);
    this.clip.addEventListener('pointercancel', up);
  }
}

/** Resize a zone by dragging one edge/corner by (dx, dy) in normalized units. */
export function resize(z: Zone, edge: Edge, dx: number, dy: number): Zone {
  let { x, y, w, h: hh } = z;
  if (edge.includes('w')) {
    const nx = Math.min(Math.max(0, z.x + dx), z.x + z.w - MIN_SIZE);
    w = z.x + z.w - nx;
    x = nx;
  }
  if (edge.includes('e')) w = Math.min(Math.max(MIN_SIZE, z.w + dx), 1 - z.x);
  if (edge.includes('n')) {
    const ny = Math.min(Math.max(0, z.y + dy), z.y + z.h - MIN_SIZE);
    hh = z.y + z.h - ny;
    y = ny;
  }
  if (edge.includes('s')) hh = Math.min(Math.max(MIN_SIZE, z.h + dy), 1 - z.y);
  return { x, y, w, h: hh };
}

/** Short message near the top of the page. */
export function toast(message: string, ms = 2600) {
  const ui = createHost();
  const el = h('div', 'toast', message);
  ui.root.append(el);
  setTimeout(() => ui.host.remove(), ms);
}
