/**
 * A focus zone, normalized to the video's intrinsic frame (0–1 on both axes).
 * Normalized coordinates survive player resizes, theater/fullscreen and quality changes.
 */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type PresetName = 'subtitles' | 'center' | 'full';

export const PRESETS: Record<PresetName, Zone> = {
  subtitles: { x: 0.05, y: 0.76, w: 0.9, h: 0.2 },
  center: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
  full: { x: 0, y: 0, w: 1, h: 1 },
};

/** Smallest zone side, as a fraction of the frame, so the zone can't collapse to nothing. */
export const MIN_SIZE = 0.03;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Keep a zone inside the frame and at least MIN_SIZE on each side. */
export function clampZone(z: Zone): Zone {
  const w = Math.min(1, Math.max(MIN_SIZE, z.w));
  const h = Math.min(1, Math.max(MIN_SIZE, z.h));
  const x = Math.min(1 - w, clamp01(z.x));
  const y = Math.min(1 - h, clamp01(z.y));
  return { x, y, w, h };
}

/**
 * Where the video picture is actually drawn inside the element box, honoring
 * `object-fit: contain` letterboxing (the default for <video>).
 * `box` is the element's client rect; `vw`/`vh` the intrinsic video size.
 */
export function contentRect(box: Rect, vw: number, vh: number, fit = 'contain'): Rect {
  if (!vw || !vh || !box.width || !box.height || fit === 'fill') return { ...box };
  const boxRatio = box.width / box.height;
  const videoRatio = vw / vh;
  const cover = fit === 'cover';
  // contain: fit the limiting side; cover: fill the limiting side
  const fitWidth = cover ? videoRatio < boxRatio : videoRatio > boxRatio;
  const width = fitWidth ? box.width : box.height * videoRatio;
  const height = fitWidth ? box.width / videoRatio : box.height;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

/** Zone → page (client) pixel rect, given the drawn video content rect. */
export function toClient(z: Zone, content: Rect): Rect {
  return {
    left: content.left + z.x * content.width,
    top: content.top + z.y * content.height,
    width: z.w * content.width,
    height: z.h * content.height,
  };
}

/** Page (client) pixel rect → zone, given the drawn video content rect. */
export function fromClient(r: Rect, content: Rect): Zone {
  if (!content.width || !content.height) return { ...PRESETS.full };
  return clampZone({
    x: (r.left - content.left) / content.width,
    y: (r.top - content.top) / content.height,
    w: r.width / content.width,
    h: r.height / content.height,
  });
}

/** Zone → source pixel rect in the decoded frame, for drawImage(video, sx, sy, sw, sh, …). */
export function toSource(z: Zone, vw: number, vh: number): Rect {
  return {
    left: Math.round(z.x * vw),
    top: Math.round(z.y * vh),
    width: Math.max(1, Math.round(z.w * vw)),
    height: Math.max(1, Math.round(z.h * vh)),
  };
}

/** Aspect ratio (width / height) of the zone in real pixels. */
export function zoneAspect(z: Zone, vw: number, vh: number): number {
  if (!vw || !vh) return z.w / z.h;
  return (z.w * vw) / (z.h * vh);
}

export function isZone(v: unknown): v is Zone {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return ['x', 'y', 'w', 'h'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}
