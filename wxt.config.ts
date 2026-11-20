import { defineConfig } from 'wxt';

const icons = {
  16: 'icons/16.png',
  32: 'icons/32.png',
  48: 'icons/48.png',
  128: 'icons/128.png',
};

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Peekapix',
    description: 'Look closer. Fix smarter. Inspect, compare, and preview CSS directly on the page.',
    minimum_chrome_version: '127',
    permissions: ['activeTab', 'scripting'],
    action: {
      default_title: 'Peekapix · Inspect this page',
      default_icon: icons,
    },
    icons,
  },
});
