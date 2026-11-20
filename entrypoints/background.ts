import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { actionTitle, closeMessage, failureMessages, type Activation, type Failure } from '../src/core/protocol';

export default defineBackground(() => {
  const pending = new Map<number, Promise<void>>();

  function status(tabId: number, badge: string, title: string) {
    return Promise.all([
      browser.action.setBadgeText({ tabId, text: badge }),
      browser.action.setTitle({ tabId, title }),
    ]);
  }

  async function explain(tabId: number, reason: Failure) {
    await status(tabId, '!', 'Peekapix · ' + failureMessages[reason].title);
    await browser.action.setPopup({ tabId, popup: `unavailable.html?reason=${reason}` });
    const tab = await browser.tabs.get(tabId);
    // Browser policy can block opening. The badge and next click still give access.
    if (tab.active) await browser.action.openPopup({ windowId: tab.windowId }).catch(() => {});
  }

  async function toggle(tabId: number, url?: string) {
    if (url && (!/^(https?:|file:)/.test(url) || /^https:\/\/chromewebstore\.google\.com(?:[/:]|$)/.test(url))) {
      await explain(tabId, 'restricted');
      return;
    }
    await status(tabId, '…', 'Peekapix · Opening inspector');
    let result: Activation | undefined;
    try {
      const [frame] = await browser.scripting.executeScript({
        target: { tabId },
        files: ['/inspector.js'],
      });
      result = frame?.result as Activation | undefined;
    } catch {
      const deniedFile = url?.startsWith('file:') && !(await browser.extension.isAllowedFileSchemeAccess());
      await explain(tabId, deniedFile ? 'file' : url ? 'injection' : 'restricted');
      return;
    }
    if (result === 'active') {
      await status(tabId, 'ON', 'Peekapix · Deactivate');
    } else if (result === 'inactive') {
      await status(tabId, '', actionTitle);
    } else {
      await explain(tabId, result === 'unsupported' ? 'restricted' : 'injection');
    }
  }

  browser.action.setBadgeBackgroundColor({ color: '#364337' }).catch(() => {});
  browser.action.onClicked.addListener(tab => {
    const id = tab.id;
    if (id === undefined) return;
    const task = (pending.get(id) ?? Promise.resolve()).then(() => toggle(id, tab.url)).catch(() => {});
    pending.set(id, task);
    void task.then(() => { if (pending.get(id) === task) pending.delete(id); });
  });

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (typeof message !== 'object' || message === null || !('type' in message)
      || message.type !== closeMessage.type || sender.tab?.id === undefined || sender.frameId !== 0) return;
    void status(sender.tab.id, '', actionTitle).catch(() => {});
  });

  browser.tabs.onUpdated.addListener((id, change) => {
    if (change.status !== 'loading') return;
    void browser.action.setPopup({ tabId: id, popup: '' }).catch(() => {});
    void status(id, '', actionTitle).catch(() => {});
  });
});
