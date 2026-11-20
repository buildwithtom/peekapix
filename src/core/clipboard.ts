export async function copyText(text: string, shadow: ShadowRoot) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Plain HTTP and restrictive clipboard policies can require a user-gesture fallback.
  }
  const focused = shadow.activeElement;
  const input = document.createElement('textarea');
  input.className = 'clipboard-input';
  input.value = text;
  input.readOnly = true;
  shadow.append(input);
  input.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
  } finally {
    input.remove();
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}
