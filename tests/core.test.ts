import assert from 'node:assert/strict';
import test from 'node:test';
import { compare, differenceDeclarations, formatDeclarations, formatRule } from '../src/core/css';
import { dimensions, measure, type Box } from '../src/core/geometry';
import type { Snapshot } from '../src/core/inspect';

const box = (x: number, y: number, width = 20, height = 10): Box => ({ x, y, width, height });
const snapshot = (width: number, values: Record<string, string>): Snapshot => ({
  tag: 'button', name: 'button.sample', classes: ['sample'], selector: { text: '.sample' }, values,
  box: box(0, 0, width), frame: false,
});

test('compare identifies individual spacing sides, rendered dimensions and equal values', () => {
  const a = snapshot(52, { 'padding-top': '12px', 'padding-right': '16px', color: 'rgb(1, 2, 3)' });
  const b = snapshot(61, { 'padding-top': '8px', 'padding-right': '16px', color: 'rgb(1, 2, 3)' });
  const rows = compare(a, b);
  assert.deepEqual(rows.filter(row => row.different).map(row => row.property.key), ['rendered-width', 'padding-top']);
  assert.deepEqual(differenceDeclarations(rows, 'a'), [{ key: 'padding-top', value: '12px' }]);
  assert.deepEqual(differenceDeclarations(rows, 'b'), [{ key: 'padding-top', value: '8px' }]);
  assert.ok(rows.some(row => row.property.key === 'color' && !row.different));
});

test('CSS exports readable declarations and includes selector scope guidance when supplied', () => {
  const declarations = [{ key: 'padding-top', value: '12px' }, { key: 'font-weight', value: '600' }];
  assert.equal(formatDeclarations(declarations), 'padding-top: 12px;\nfont-weight: 600;');
  assert.equal(formatRule({ text: 'button:nth-of-type(2)', note: 'Verify this selector.' }, declarations),
    '/* Verify this selector. */\nbutton:nth-of-type(2) {\n  padding-top: 12px;\n  font-weight: 600;\n}');
  assert.equal(formatRule({ text: '#sample' }, []), '');
});

test('missing or non-applicable values are excluded from the source CSS export', () => {
  const a = snapshot(20, { 'row-gap': 'normal' });
  const b = snapshot(20, {});
  const rows = compare(a, b);
  const gap = rows.find(row => row.property.key === 'row-gap');
  assert.equal(gap?.different, true);
  assert.deepEqual(differenceDeclarations(rows, 'b'), []);
  assert.deepEqual(differenceDeclarations(rows, 'a'), [{ key: 'row-gap', value: 'normal' }]);
});

test('rectangle distances cover aligned, diagonal, touching, and overlapping bounds', () => {
  assert.deepEqual(measure(box(10, 10), box(35, 13)), { kind: 'gap', axis: 'horizontal', distance: 5, from: [30, 16.5], to: [35, 16.5] });
  assert.deepEqual(measure(box(13, 38), box(10, 10)), { kind: 'gap', axis: 'vertical', distance: 18, from: [21.5, 20], to: [21.5, 38] });
  assert.deepEqual(measure(box(0, 0), box(23, 14)), { kind: 'gap', axis: 'diagonal', distance: 5, from: [20, 10], to: [23, 14] });
  assert.deepEqual(measure(box(0, 0), box(20, 4)), { kind: 'touching' });
  assert.deepEqual(measure(box(0, 0), box(11, 7)), { kind: 'overlap', width: 9, height: 3 });
  assert.equal(dimensions(box(0, 0, 20.146, 10.2)), '20.15px × 10.2px');
});
