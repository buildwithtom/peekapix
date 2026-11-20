import { differenceDeclarations, compare, formatRule, type Declaration, type Side } from './css';
import { measure, sameBox, type Box, type Measurement } from './geometry';
import { isVisible, readBox, readSnapshot, sameStyle, type Snapshot } from './inspect';
import { Overlays } from './overlays';
import { Preview, canPreview } from './preview';
import { elementName, selectorFor } from './selector';

type Mode = 'inspect' | 'compare';
type Slot = 'item' | Side;
type Entry = { element: Element; snapshot: Snapshot };
type Selection = { [key in Slot]: Entry | null };
const frameSelector = 'iframe, frame';

interface SessionView {
  mode: Mode;
  picking: Slot | null;
  collapsed: boolean;
  overlays: boolean;
  selections: Readonly<Selection>;
  boxes: Readonly<Record<Slot, Box | null>>;
  measurement: Measurement | null;
  preview: { target: Side; declarations: Declaration[] } | null;
  notice: string;
}

export const otherSide = (side: Side): Side => side === 'a' ? 'b' : 'a';

export class Session {
  private view: SessionView = {
    mode: 'inspect', picking: 'item', collapsed: false, overlays: true,
    selections: { item: null, a: null, b: null },
    boxes: { item: null, a: null, b: null }, measurement: null, preview: null, notice: '',
  };
  private observers = new Set<() => void>();
  private readonly events = new AbortController();
  private readonly overlays: Overlays;
  private readonly watchHost: MutationObserver;
  private frame = 0;
  private styleReadAt = -Infinity;
  private pointer: { x: number; y: number } | null = null;
  private frames = new Set<Element>();
  private framesDirty = true;
  private lastPick: { element: Element; time: number } | null = null;
  private preview: Preview | null = null;

  constructor(readonly shadow: ShadowRoot, readonly close: () => void) {
    this.overlays = new Overlays(shadow);
    this.watchHost = new MutationObserver(records => {
      if (!shadow.host.isConnected) {
        close();
        return;
      }
      if (!this.view.picking || this.framesDirty) return;
      this.framesDirty = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof Element && (node.matches(frameSelector) || !!node.querySelector(frameSelector))));
    });
    this.watchHost.observe(document, { childList: true, subtree: true });

    const options = { capture: true, signal: this.events.signal };
    window.addEventListener('pointermove', this.onPointer, options);
    window.addEventListener('pointerover', this.onPointer, options);
    window.addEventListener('pointerout', this.onPointerOut, options);
    for (const kind of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick']) {
      window.addEventListener(kind, this.blockSelectionEvent, options);
    }
    window.addEventListener('click', this.onClick, options);
    window.addEventListener('dblclick', this.onClick, options);
    window.addEventListener('keydown', this.onKey, options);
    window.addEventListener('pagehide', close, options);
    this.coverFrames(null);
    this.frame = requestAnimationFrame(this.tick);
  }

  get = () => this.view;

  subscribe = (callback: () => void) => {
    this.observers.add(callback);
    return () => { this.observers.delete(callback); };
  };

  setMode(mode: Mode) {
    if (mode === this.view.mode && mode === 'compare' && this.view.selections.a && this.view.selections.b) {
      this.update({ collapsed: false });
      return;
    }
    this.resetPreview();
    const picking = mode === 'inspect' ? 'item'
      : !this.view.selections.a ? 'a' : !this.view.selections.b ? 'b' : null;
    if (mode !== this.view.mode) this.pause();
    this.update({ mode, picking, collapsed: false, notice: '', measurement: null });
  }

  pick(slot: Slot) {
    if (this.view.picking === slot) {
      this.pause();
      return;
    }
    this.resetPreview();
    this.update({ picking: slot, notice: '' });
  }

  pause() {
    this.pointer = null;
    this.framesDirty = true;
    this.frames.clear();
    this.overlays.coverFrames(new Map());
    this.update({ picking: null });
  }

  togglePanel() {
    this.update({ collapsed: !this.view.collapsed });
  }

  toggleOverlays() {
    this.update({ overlays: !this.view.overlays });
  }

  swap() {
    this.resetPreview();
    const { item, a, b } = this.view.selections;
    this.pause();
    this.update({ selections: { item, a: b, b: a }, notice: 'Swapped A and B.' });
  }

  applyPreview(target: Side, keys: ReadonlySet<string>) {
    const { a, b } = this.view.selections;
    const element = this.view.selections[target]?.element;
    if (!a || !b || !element || !element.isConnected || !canPreview(element)) {
      this.update({ notice: 'This element cannot be previewed. Pick another element.' });
      return false;
    }
    if (this.preview && this.preview.element !== element) this.resetPreview();
    const matching = differenceDeclarations(compare(a.snapshot, b.snapshot), otherSide(target)).filter(({ key }) => keys.has(key));
    this.preview ??= new Preview(element);
    const count = this.preview.apply(matching);
    if (!count) {
      if (!this.preview.declarations.length) this.preview = null;
      this.update({ notice: 'No supported styles were applied.' });
      return false;
    }
    this.update({ preview: { target, declarations: this.preview.declarations }, notice: '' });
    return true;
  }

  undoPreview() {
    const target = this.view.preview?.target;
    if (!this.preview || !target) return;
    this.preview.undo();
    const declarations = this.preview.declarations;
    if (!declarations.length) this.preview = null;
    this.update({ preview: declarations.length ? { target, declarations } : null, notice: 'Last preview undone.' });
  }

  resetPreview() {
    if (!this.preview) return;
    this.preview.reset();
    this.preview = null;
    this.update({ preview: null, notice: 'Original styles restored.' });
  }

  rule(slot: Slot, declarations: readonly Declaration[]) {
    const selection = this.view.selections[slot];
    return selection?.element.isConnected ? formatRule(selectorFor(selection.element), declarations) : '';
  }

  destroy() {
    this.events.abort();
    this.watchHost.disconnect();
    cancelAnimationFrame(this.frame);
    this.preview?.reset();
    this.observers.clear();
  }

  private update(view: Partial<SessionView>) {
    this.view = { ...this.view, ...view };
    for (const observer of this.observers) observer();
  }

  private own(event: Event) {
    return event.composedPath().includes(this.shadow.host);
  }

  private onPointer = (event: PointerEvent) => {
    if (!this.view.picking) return;
    this.pointer = this.own(event) && !this.overlays.isShield(event.composedPath()[0])
      ? null : { x: event.clientX, y: event.clientY };
  };

  private onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget === null) this.pointer = null;
  };

  private blockSelectionEvent = (event: Event) => {
    if (!this.view.picking || (this.own(event) && !this.overlays.isShield(event.composedPath()[0]))) return;
    if ((event as MouseEvent).button === 0 || event.type === 'auxclick') block(event);
  };

  private onClick = (event: MouseEvent) => {
    const path = event.composedPath();
    const shield = this.overlays.isShield(path[0]);
    if (!shield && path.includes(this.shadow.host)) return;
    const target = shield ? this.hit(event.clientX, event.clientY) : path.find(node => node instanceof Element);
    const selectionDoubleClick = event.detail > 1 && this.lastPick && this.lastPick.element === target
      && event.timeStamp - this.lastPick.time < 1000;
    if (!this.view.picking && !selectionDoubleClick) return;
    block(event);
    if (event.type === 'dblclick' || !(target instanceof Element)) return;
    if (this.select(target)) this.lastPick = { element: target, time: event.timeStamp };
  };

  private onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.view.picking) {
      block(event);
      this.pause();
    } else if (event.key === 'Escape' && this.own(event)) {
      block(event);
      this.togglePanel();
    } else if (event.key === 'Enter' && this.view.picking && !this.own(event)
      && !event.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey
      && document.activeElement && document.activeElement !== document.body) {
      block(event);
      if (!event.repeat) this.select(deepFocus());
    }
  };

  private select(element: Element | null) {
    const slot = this.view.picking;
    if (!slot) return false;
    const box = element && readBox(element);
    if (!element || !box || !isVisible(element)) {
      this.update({ notice: 'This element has no visible bounding box. Pick another element.' });
      return false;
    }
    const { selections } = this.view;
    const other = slot === 'item' ? null : selections[otherSide(slot)];
    if (other?.element === element) {
      this.update({ notice: 'A and B need separate elements. Pick a different element.' });
      return false;
    }
    const snapshot = readSnapshot(element, box);
    const next = { ...selections, [slot]: { element, snapshot } };
    const picking = slot === 'item' ? null : next.a ? next.b ? null : 'b' : 'a';
    this.pause();
    this.update({
      selections: next, picking, collapsed: false,
      notice: snapshot.frame ? 'Frame boundary selected. Content inside embedded frames is unavailable.' : '',
    });
    return true;
  }

  private hit(x: number, y: number) {
    let target = document.elementFromPoint(x, y);
    if (target === this.shadow.host) {
      if (!this.overlays.isShield(this.shadow.elementFromPoint(x, y))) return null;
      target = document.elementsFromPoint(x, y).find(node => node !== this.shadow.host) ?? null;
    }
    while (target?.shadowRoot) {
      const inner = target.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === target || !insideShadow(inner, target.shadowRoot)) break;
      target = inner;
    }
    return target;
  }

  private coverFrames(hover: Element | null) {
    if (this.framesDirty) {
      this.frames = new Set(document.querySelectorAll(frameSelector));
      this.framesDirty = false;
    }
    if (hover?.matches(frameSelector)) this.frames.add(hover);
    const boxes = new Map<Element, Box>();
    for (const frame of this.frames) {
      const box = readBox(frame);
      if (box && isVisible(frame) && box.x < window.innerWidth && box.y < window.innerHeight
        && box.x + box.width > 0 && box.y + box.height > 0) boxes.set(frame, box);
    }
    this.overlays.coverFrames(boxes);
  }

  private tick = (time: number) => {
    this.frame = requestAnimationFrame(this.tick);
    const { mode, picking, overlays, selections, boxes } = this.view;
    if (!picking && !selections.item && !selections.a && !selections.b) return;
    const primary = mode === 'inspect' ? 'item' : 'a';
    const slots: Slot[] = mode === 'inspect' ? ['item'] : ['a', 'b'];
    const fresh = { ...selections };
    const nextBoxes = { ...boxes };
    let nextNotice: string | undefined;
    let removed = false;
    let snapshotChanged = false;
    const sampleStyles = time - this.styleReadAt >= 300;
    if (sampleStyles) this.styleReadAt = time;

    for (const slot of slots) {
      const entry = selections[slot];
      if (!entry) {
        nextBoxes[slot] = null;
        continue;
      }
      if (!entry.element.isConnected) {
        this.resetPreview();
        fresh[slot] = null;
        nextBoxes[slot] = null;
        nextNotice = 'A selected element was removed from the page.';
        removed = true;
        continue;
      }
      const box = readBox(entry.element);
      nextBoxes[slot] = box && isVisible(entry.element) ? box : null;
      if (sampleStyles && !this.preview) {
        const snapshot = readSnapshot(entry.element, nextBoxes[slot], entry.snapshot);
        if (!sameStyle(snapshot, entry.snapshot) || !sameBox(snapshot.box, entry.snapshot.box)) {
          fresh[slot] = { element: entry.element, snapshot };
          snapshotChanged = true;
        }
      }
    }

    const a = nextBoxes[primary];
    const b = mode === 'compare' ? nextBoxes.b : null;
    const measurement = a && b ? measure(a, b) : null;
    const hover = picking && this.pointer ? this.hit(this.pointer.x, this.pointer.y) : null;
    const hoverBox = hover && isVisible(hover) ? readBox(hover) : null;
    if (picking) this.coverFrames(hover);

    this.overlays.mark('a', overlays ? a : null, mode === 'compare' ? 'A' : fresh.item?.snapshot.name);
    this.overlays.mark('b', overlays ? b : null, 'B', !!a && !!b && Math.abs(a.y - b.y) < 24 && Math.abs(a.x - b.x) < 130);
    const duplicate = hover && slots.some(slot => fresh[slot]?.element === hover);
    this.overlays.mark('hover', overlays && !duplicate ? hoverBox : null, hover ? elementName(hover) : '');
    this.overlays.drawRuler(overlays ? measurement : null);

    if (removed || snapshotChanged || slots.some(slot => !sameBox(boxes[slot], nextBoxes[slot]))) {
      this.update({ selections: fresh, boxes: nextBoxes, measurement, ...(nextNotice ? { notice: nextNotice } : {}) });
    }
  };
}

function insideShadow(element: Element, root: ShadowRoot) {
  if (element.getRootNode() === root) return true;
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.assignedSlot?.getRootNode() === root) return true;
  }
  return false;
}

function deepFocus() {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
}

function block(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}
