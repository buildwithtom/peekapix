import { dimensions, formatPixels, sameBox, type Box, type Measurement } from './geometry';

interface Mark {
  outline: HTMLDivElement;
  label: HTMLDivElement;
  box: Box | null;
  lower: boolean;
  viewport: string;
}

export class Overlays {
  readonly layer = document.createElement('div');
  private readonly shields = new Map<Element, { node: HTMLDivElement; box: Box }>();
  private readonly marks: Record<'hover' | 'a' | 'b', Mark>;
  private readonly ruler = document.createElement('div');
  private readonly rulerLabel = document.createElement('span');

  constructor(root: ShadowRoot) {
    this.layer.className = 'overlay-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    this.marks = { hover: this.makeMark('hover'), a: this.makeMark('a'), b: this.makeMark('b') };
    this.ruler.className = 'ruler';
    this.rulerLabel.className = 'ruler-label';
    this.layer.append(this.ruler, this.rulerLabel);
    root.append(this.layer);
    this.drawRuler(null);
  }

  private makeMark(kind: string): Mark {
    const outline = document.createElement('div');
    const label = document.createElement('div');
    outline.className = 'outline outline-' + kind;
    label.className = 'outline-label outline-label-' + kind;
    this.layer.append(outline, label);
    outline.hidden = label.hidden = true;
    return { outline, label, box: null, lower: false, viewport: '' };
  }

  mark(kind: keyof typeof this.marks, box: Box | null, name = '', lower = false) {
    const mark = this.marks[kind];
    const { outline, label } = mark;
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const viewport = width + 'x' + height;
    const text = box ? name + '  ' + dimensions(box) : '';
    if (sameBox(mark.box, box) && mark.lower === lower && mark.viewport === viewport && (!box || label.textContent === text)) return;
    Object.assign(mark, { box, lower, viewport });
    const visible = !!box && box.x < width && box.x + box.width > 0 && box.y < height && box.y + box.height > 0;
    outline.hidden = label.hidden = !visible;
    if (!box || !visible) return;

    place(outline, box);
    if (label.textContent !== text) label.textContent = text;
    const top = lower || box.y < 31 ? box.y + box.height + 3 : box.y - 26;
    label.style.transform = `translate(${Math.max(4, Math.min(box.x, width - label.offsetWidth - 4))}px, ${Math.max(4, Math.min(top, height - 27))}px)`;
  }

  drawRuler(measurement: Measurement | null) {
    const gap = measurement?.kind === 'gap' ? measurement : null;
    const onscreen = gap && [gap.from, gap.to].every(([x, y]) => x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight);
    this.ruler.hidden = this.rulerLabel.hidden = !onscreen;
    if (!gap || !onscreen) return;
    const [x, y] = gap.from;
    const [toX, toY] = gap.to;
    this.ruler.style.width = gap.distance + 'px';
    this.ruler.style.transform = `translate(${x}px, ${y}px) rotate(${Math.atan2(toY - y, toX - x)}rad)`;
    this.rulerLabel.textContent = formatPixels(gap.distance);
    const labelX = Math.max(25, Math.min((x + toX) / 2, window.innerWidth - 25));
    const labelY = Math.max(20, (y + toY) / 2);
    this.rulerLabel.style.transform = `translate(${labelX}px, ${labelY}px) translate(-50%, -50%)`;
  }

  coverFrames(boxes: ReadonlyMap<Element, Box>) {
    for (const [frame, { node }] of this.shields) {
      if (boxes.has(frame)) continue;
      node.remove();
      this.shields.delete(frame);
    }
    for (const [frame, box] of boxes) {
      const shield = this.shields.get(frame);
      if (shield && sameBox(shield.box, box)) continue;
      const node = shield?.node ?? document.createElement('div');
      if (!shield) {
        node.className = 'frame-shield';
        this.layer.append(node);
      }
      place(node, box);
      this.shields.set(frame, { node, box });
    }
  }

  isShield(node: EventTarget | null | undefined) {
    return node instanceof HTMLDivElement && node.parentNode === this.layer && node.className === 'frame-shield';
  }
}

function place(node: HTMLElement, box: Box) {
  node.style.width = box.width + 'px';
  node.style.height = box.height + 'px';
  node.style.transform = `translate(${box.x}px, ${box.y}px)`;
}
