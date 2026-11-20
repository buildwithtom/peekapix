export const closeMessage = { type: 'peekapix:closed' } as const;
export const actionTitle = 'Peekapix · Inspect this page';
export type Activation = 'active' | 'inactive' | 'unsupported';
export type Failure = 'restricted' | 'file' | 'injection';

export const failureMessages: Record<Failure, { title: string; message: string }> = {
  restricted: {
    title: 'This page is protected',
    message: 'Chrome protects its internal pages, the Chrome Web Store, and some built-in viewers. Open a regular website to use Peekapix.',
  },
  file: {
    title: 'File access is off',
    message: 'To inspect local files, open Peekapix’s Details in chrome://extensions and enable “Allow access to file URLs”.',
  },
  injection: {
    title: 'Inspector couldn’t open',
    message: 'Chrome didn’t allow Peekapix to open on this tab. Try reloading the page or opening a regular website.',
  },
};
