import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icons';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string };
export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return <button
    type="button" className={`icon-button ${className ?? ''}`} aria-label={label} title={label} {...props}
  ><Icon name={icon}/></button>;
}

export function CssValue({ value }: { value: string }) {
  const color = /^(rgb\(|rgba\(|hsl\(|hsla\(|color\(|lab\(|lch\(|oklab\(|oklch\(|#)/.test(value) && CSS.supports('color', value);
  return <code className="css-value">
    {color && <span className="swatch" aria-hidden="true" style={{ backgroundColor: value }}/>}
    {value || '—'}
  </code>;
}

export type Copy = (text: string) => void;
