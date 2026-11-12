import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { Controller } from '../src/controller';

interface Instance {
  isAlive(): boolean;
}
declare global {
  interface Window {
    __browserFocus?: Instance;
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true, // videos embedded in iframes (e.g. YouTube embeds on other sites)
  main() {
    // The background may inject this script again on demand. Skip it if a live copy already
    // runs here. A copy left over from before an extension reload is dead (its runtime is
    // gone), so a new one takes over.
    if (window.__browserFocus?.isAlive()) return;
    window.__browserFocus = { isAlive: () => !!browser.runtime?.id };

    const controller = new Controller();
    browser.runtime.onMessage.addListener((msg: unknown) => {
      if ((msg as { type?: string })?.type === 'toggle') void controller.toggle();
    });
  },
});
