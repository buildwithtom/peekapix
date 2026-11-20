import type { Box } from './geometry';
import { inspectorGroups, properties } from './properties';
import { elementName, selectorFor, type Selector } from './selector';

export interface Snapshot {
  tag: string;
  name: string;
  classes: string[];
  selector: Selector;
  values: Record<string, string>;
  box: Box | null;
  frame: boolean;
}

const cssKeys = [...new Set([
  ...properties.filter(property => !property.measurement).map(property => property.key),
  ...inspectorGroups.flatMap(group => group.fields.map(([key]) => key)),
])];

export function readBox(element: Element): Box | null {
  if (!element.isConnected) return null;
  const { x, y, width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

export function readSnapshot(element: Element, box: Box | null, previous?: Snapshot): Snapshot {
  const style = getComputedStyle(element);
  const values: Record<string, string> = Object.fromEntries(cssKeys.map(key => [key, style.getPropertyValue(key)]));
  const acceptsGap = /(?:flex|grid)/.test(style.display) || style.columnCount !== 'auto' || style.columnWidth !== 'auto';
  if (!acceptsGap) {
    values['row-gap'] = '';
    values['column-gap'] = '';
  }
  const name = elementName(element);
  const classes = [...element.classList];
  const keepSelector = previous?.name === name && classes.length === previous.classes.length
    && classes.every((value, index) => value === previous.classes[index]);
  return {
    tag: element.localName,
    name,
    classes,
    selector: keepSelector ? previous.selector : selectorFor(element),
    values,
    box,
    frame: element instanceof HTMLIFrameElement || element instanceof HTMLFrameElement,
  };
}

export function sameStyle(a: Snapshot, b: Snapshot) {
  return a.selector.text === b.selector.text && a.selector.note === b.selector.note && a.name === b.name
    && a.classes.length === b.classes.length && a.classes.every((name, index) => name === b.classes[index])
    && cssKeys.every(key => a.values[key] === b.values[key]);
}

export function isVisible(element: Element) {
  return element.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
}
