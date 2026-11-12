import { browser } from 'wxt/browser';
import { isZone, type Zone } from './zone';

export type ViewMode = 'crop' | 'captions';

export interface SiteSettings {
  zone: Zone;
  mode: ViewMode;
}

const key = (host: string) => `site:${host}`;

export async function loadSite(host: string): Promise<Partial<SiteSettings>> {
  try {
    const got = await browser.storage.local.get(key(host));
    const v = got[key(host)] as Partial<SiteSettings> | undefined;
    if (!v) return {};
    return {
      zone: isZone(v.zone) ? v.zone : undefined,
      mode: v.mode === 'captions' || v.mode === 'crop' ? v.mode : undefined,
    };
  } catch {
    return {};
  }
}

/** Boolean flags/preferences, e.g. "hint already shown", "window not on top". */
export async function getFlag(name: string): Promise<boolean> {
  try {
    const got = await browser.storage.local.get(`flag:${name}`);
    return got[`flag:${name}`] === true;
  } catch {
    return false;
  }
}

export function setFlag(name: string, value = true): void {
  browser.storage.local.set({ [`flag:${name}`]: value }).catch(() => {});
}

let pending: ReturnType<typeof setTimeout> | undefined;

/** Debounced save, so dragging the zone doesn't hammer storage. */
export function saveSite(host: string, settings: SiteSettings): void {
  clearTimeout(pending);
  pending = setTimeout(() => {
    browser.storage.local.set({ [key(host)]: settings }).catch(() => {});
  }, 300);
}
