import type { ReactNode } from 'react';

const lines: Record<string, ReactNode> = {
  inspect: <><path d="M6 3H3v3m7-3h3v3M3 10v3h3m7-3v3h-3"/><path d="M8 6v4M6 8h4"/></>,
  compare: <><path d="M2.5 4.5h4v7h-4zM9.5 4.5h4v7h-4z"/><path d="M8 2.5v11"/></>,
  close: <path d="m4.5 4.5 7 7m0-7-7 7"/>,
  move: <><path d="M2.5 3.5h11v9h-11z"/><path d="M6 4v8m2-4h3m-1.5-1.5L11 8l-1.5 1.5"/></>,
  copy: <><rect x="5.5" y="5.5" width="7" height="7" rx="1"/><path d="M10 3.5H4.5a1 1 0 0 0-1 1V10"/></>,
  swap: <><path d="M3 5h10m-2.5-2.5L13 5l-2.5 2.5M13 11H3m2.5-2.5L3 11l2.5 2.5"/></>,
  replace: <><path d="M5.5 3.5H3.5v9h9v-2M8 8l5-5m-4 0h4v4"/></>,
  shrink: <path d="M4 8h8"/>,
  expand: <path d="M4 8h8M8 4v8"/>,
  overlay: <><path d="M6 3H3v3m7-3h3v3M3 10v3h3m7-3v3h-3"/><circle cx="8" cy="8" r="1.5"/></>,
  hidden: <><path d="M6 3H3v3m7-3h3v3M3 10v3h3m7-3v3h-3"/><path d="m6 6 4 4"/></>,
  ruler: <><path d="M2.5 5h11v6h-11zM5.5 5v2.5M8 5v3.5m2.5-3.5v2.5"/></>,
  undo: <path d="m5 3-2.5 3L5 9M3 6h6a3.5 3.5 0 0 1 0 7H7"/>,
  check: <path d="m3.5 8 3 3 6-6"/>,
};

export function Icon({ name }: { name: keyof typeof lines }) {
  return <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">{lines[name]}</svg>;
}

export function Brand() {
  return <span className="brand">
    <BrandMark/>
    <span>peekapix<span className="brand-dot">.</span></span>
  </span>;
}

export function BrandMark() {
  return <svg className="brand-mark" aria-hidden="true" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="#202724"/>
    <path fill="none" stroke="#d9fc78" strokeWidth="4" d="M25 12H12v13M39 12h13v13M12 39v13h13m27-13v13H39"/>
    <path fill="#d9fc78" fillRule="evenodd" d="M23 19h14a9 9 0 0 1 0 18h-8v8h-6Zm6 6v6h8a3 3 0 1 0 0-6Z"/>
    <rect x="39" y="41" width="5" height="5" fill="#e28567"/>
  </svg>;
}
