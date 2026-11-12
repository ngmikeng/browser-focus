import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

const CONTENT_SCRIPT = '/content-scripts/content.js';

export default defineBackground(() => {
  const send = (tabId: number) => browser.tabs.sendMessage(tabId, { type: 'toggle' });

  const toggle = async (tabId?: number) => {
    if (tabId == null) return;
    try {
      await send(tabId);
    } catch {
      // No content script in the tab: it was opened before the extension was installed or
      // reloaded. Inject it now (host_permissions covers it) and retry.
      try {
        await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
        await send(tabId);
      } catch (err) {
        // Pages like chrome:// or the Web Store can't run extensions: flag it on the icon.
        console.warn('[browser-focus] cannot run on this tab', err);
        await browser.action.setBadgeBackgroundColor({ tabId, color: '#d93025' });
        await browser.action.setBadgeText({ tabId, text: '!' });
        await browser.action.setTitle({ tabId, title: 'Browser Focus cannot run on this page' });
        setTimeout(() => browser.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 3000);
      }
    }
  };

  // The focus window asks to bring its source tab forward (see Controller.askForPopOutClick).
  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    const tab = sender.tab;
    if ((msg as { type?: string })?.type !== 'focus-tab' || tab?.id == null) return;
    void browser.tabs.update(tab.id, { active: true }).catch(() => {});
    void browser.windows.update(tab.windowId, { focused: true }).catch(() => {});
  });

  browser.action.onClicked.addListener((tab) => void toggle(tab.id));
  browser.commands.onCommand.addListener((command, tab) => {
    if (command === 'toggle-focus') void toggle(tab?.id);
  });
});
