import { formatPixels } from './geometry';
import type { Snapshot } from './inspect';
import { properties, type Property } from './properties';
import type { Selector } from './selector';

export interface Declaration {
  key: string;
  value: string;
}

export interface ComparisonRow {
  property: Property;
  a: string;
  b: string;
  different: boolean;
}

export type Side = 'a' | 'b';

export function compare(a: Snapshot, b: Snapshot): ComparisonRow[] {
  return properties.flatMap(property => {
    const value = (snapshot: Snapshot) => property.measurement
      ? snapshot.box ? formatPixels(snapshot.box[property.measurement]) : ''
      : snapshot.values[property.key] ?? '';
    const left = value(a);
    const right = value(b);
    if (!left && !right && !property.optional) return [];
    return [{ property, a: left, b: right, different: left !== right }];
  });
}

export function differenceDeclarations(rows: readonly ComparisonRow[], source: Side): Declaration[] {
  return rows.flatMap(({ property, different, ...values }) =>
    different && !property.measurement && values[source] ? [{ key: property.key, value: values[source] }] : []);
}

export function formatDeclarations(declarations: readonly Declaration[]) {
  return declarations.filter(({ value }) => value).map(({ key, value }) => `${key}: ${value};`).join('\n');
}

export function formatRule(selector: Selector, declarations: readonly Declaration[]) {
  const lines = formatDeclarations(declarations);
  if (!lines) return '';
  const comment = selector.note ? `/* ${selector.note} */\n` : '';
  return `${comment}${selector.text} {\n${lines.split('\n').map(line => '  ' + line).join('\n')}\n}`;
}
