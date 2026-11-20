import regular from '@fontsource/barlow/files/barlow-latin-400-normal.woff2?inline';
import semibold from '@fontsource/barlow/files/barlow-latin-600-normal.woff2?inline';
import bold from '@fontsource/barlow/files/barlow-latin-700-normal.woff2?inline';
import mono from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?inline';

export function loadFonts() {
  const list = [
    ['Peekapix Barlow', '400', regular],
    ['Peekapix Barlow', '600', semibold],
    ['Peekapix Barlow', '700', bold],
    ['Peekapix Plex Mono', '400', mono],
  ] as const;
  const loaded: FontFace[] = [];
  for (const [family, weight, url] of list) {
    const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), char => char.charCodeAt(0));
    const font = new FontFace(family, bytes, { weight });
    // Font faces in a shadow stylesheet do not resolve consistently. Binary faces also work under page CSP.
    void font.loaded.catch(() => {});
    document.fonts.add(font);
    loaded.push(font);
  }
  return () => loaded.forEach(font => document.fonts.delete(font));
}
