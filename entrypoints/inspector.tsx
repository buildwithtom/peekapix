import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { loadFonts } from '../src/core/fonts';
import { closeMessage, type Activation } from '../src/core/protocol';
import { Session } from '../src/core/session';
import { App } from '../src/ui/App';
import styles from '../src/ui/inspector.css?inline';

type IsolatedWorld = typeof globalThis & { __peekapixStop?: (notify: boolean) => void };

export default defineUnlistedScript({
  globalName: true,
  main(): Activation {
    const world = globalThis as IsolatedWorld;
    if (world.__peekapixStop) {
      world.__peekapixStop(false);
      return 'inactive';
    }
    if (!(document.documentElement instanceof HTMLElement) || document.contentType === 'application/pdf') return 'unsupported';

    const focused = document.activeElement;
    const host = document.createElement('peekapix-inspector');
    for (const [key, value] of Object.entries({
      all: 'initial', position: 'fixed', inset: '0', display: 'block', 'pointer-events': 'none',
      'z-index': '2147483647', direction: 'ltr', 'unicode-bidi': 'isolate', 'color-scheme': 'light dark',
    })) host.style.setProperty(key, value, 'important');

    const shadow = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    shadow.adoptedStyleSheets = [sheet];
    const mount = document.createElement('div');
    mount.className = 'mount';
    shadow.append(mount);
    document.documentElement.append(host);

    const root = createRoot(mount);
    const releaseFonts = loadFonts();
    const session = new Session(shadow, () => stop(true));
    const validity = window.setInterval(() => {
      if (!browser.runtime?.id) stop(false);
    }, 1000);

    function stop(notify: boolean) {
      if (world.__peekapixStop !== stop) return;
      delete world.__peekapixStop;
      window.clearInterval(validity);
      const shouldRestoreFocus = !!shadow.activeElement;
      session.destroy();
      root.unmount();
      host.remove();
      releaseFonts();
      if (shouldRestoreFocus && focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });
      if (notify && browser.runtime?.id) void browser.runtime.sendMessage(closeMessage).catch(() => {});
    }

    world.__peekapixStop = stop;
    try {
      flushSync(() => root.render(<App session={session}/>));
    } catch (error) {
      stop(false);
      throw error;
    }
    return 'active';
  },
});
