export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Measurement =
  | { kind: 'gap'; axis: 'horizontal' | 'vertical' | 'diagonal'; distance: number; from: [number, number]; to: [number, number] }
  | { kind: 'overlap'; width: number; height: number }
  | { kind: 'touching' };

export const formatPixels = (value: number) => `${Number(value.toFixed(2))}px`;
export const dimensions = (box: Box) => `${formatPixels(box.width)} × ${formatPixels(box.height)}`;

export function sameBox(a: Box | null, b: Box | null) {
  return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);
}

export function measure(a: Box, b: Box): Measurement {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const x = right - left;
  const y = bottom - top;

  if (x > 0 && y > 0) return { kind: 'overlap', width: x, height: y };
  if (x >= 0 && y >= 0) return { kind: 'touching' };

  return {
    kind: 'gap',
    axis: x >= 0 ? 'vertical' : y >= 0 ? 'horizontal' : 'diagonal',
    distance: Math.hypot(Math.min(0, x), Math.min(0, y)),
    from: [x < 0 ? right : (left + right) / 2, y < 0 ? bottom : (top + bottom) / 2],
    to: [x < 0 ? left : (left + right) / 2, y < 0 ? top : (top + bottom) / 2],
  };
}
