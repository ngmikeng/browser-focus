import { describe, expect, it } from 'vitest';
import {
  MIN_SIZE,
  PRESETS,
  clampZone,
  contentRect,
  fromClient,
  isZone,
  toClient,
  toSource,
  zoneAspect,
  type Rect,
} from '../src/zone';

const box = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
});

describe('contentRect', () => {
  it('fills the box when aspect ratios match', () => {
    expect(contentRect(box(10, 20, 1600, 900), 1920, 1080)).toEqual(box(10, 20, 1600, 900));
  });

  it('pillarboxes a 4:3 video in a 16:9 box', () => {
    const r = contentRect(box(0, 0, 1600, 900), 640, 480);
    expect(r.height).toBe(900);
    expect(r.width).toBe(1200);
    expect(r.left).toBe(200);
    expect(r.top).toBe(0);
  });

  it('letterboxes a 21:9 video in a 16:9 box', () => {
    const r = contentRect(box(0, 0, 1600, 900), 2100, 900);
    expect(r.width).toBe(1600);
    expect(r.height).toBeCloseTo(1600 / (2100 / 900));
    expect(r.top).toBeCloseTo((900 - r.height) / 2);
  });

  it('overflows the box for object-fit: cover', () => {
    const r = contentRect(box(0, 0, 1600, 900), 640, 480, 'cover');
    expect(r.width).toBe(1600);
    expect(r.height).toBe(1200);
    expect(r.top).toBe(-150);
  });

  it('returns the box when the video size is unknown', () => {
    expect(contentRect(box(1, 2, 3, 4), 0, 0)).toEqual(box(1, 2, 3, 4));
  });
});

describe('toClient / fromClient', () => {
  const content = box(200, 50, 1200, 900);

  it('round-trips a zone', () => {
    const z = { x: 0.1, y: 0.7, w: 0.8, h: 0.25 };
    const back = fromClient(toClient(z, content), content);
    expect(back.x).toBeCloseTo(z.x);
    expect(back.y).toBeCloseTo(z.y);
    expect(back.w).toBeCloseTo(z.w);
    expect(back.h).toBeCloseTo(z.h);
  });

  it('maps the subtitles preset to the bottom of the picture', () => {
    const r = toClient(PRESETS.subtitles, content);
    expect(r.top).toBeCloseTo(50 + 0.76 * 900);
    expect(r.left).toBeCloseTo(200 + 0.05 * 1200);
  });

  it('clamps a rect dragged outside the picture', () => {
    const z = fromClient(box(-100, 900, 400, 200), content);
    expect(z.x).toBe(0);
    expect(z.y + z.h).toBeLessThanOrEqual(1);
  });
});

describe('clampZone', () => {
  it('enforces a minimum size', () => {
    const z = clampZone({ x: 0.5, y: 0.5, w: 0, h: 0.001 });
    expect(z.w).toBe(MIN_SIZE);
    expect(z.h).toBe(MIN_SIZE);
  });

  it('keeps the zone inside the frame', () => {
    expect(clampZone({ x: 0.9, y: 0.95, w: 0.5, h: 0.5 })).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(clampZone({ x: -1, y: -1, w: 2, h: 2 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('toSource / zoneAspect', () => {
  it('converts to integer source pixels', () => {
    expect(toSource(PRESETS.subtitles, 1920, 1080)).toEqual({
      left: 96,
      top: 821,
      width: 1728,
      height: 216,
    });
  });

  it('computes the real-pixel aspect ratio', () => {
    expect(zoneAspect(PRESETS.full, 1920, 1080)).toBeCloseTo(16 / 9);
    expect(zoneAspect(PRESETS.subtitles, 1920, 1080)).toBeCloseTo(1728 / 216);
  });
});

describe('isZone', () => {
  it('validates stored values', () => {
    expect(isZone({ x: 0, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isZone({ x: 0, y: 0, w: 1 })).toBe(false);
    expect(isZone({ x: NaN, y: 0, w: 1, h: 1 })).toBe(false);
    expect(isZone(null)).toBe(false);
  });
});
