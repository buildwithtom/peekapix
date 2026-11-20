export type Section = 'Layout & geometry' | 'Spacing' | 'Typography' | 'Appearance';

export interface Property {
  key: string;
  label: string;
  section: Section;
  preview?: true;
  measurement?: 'width' | 'height';
  optional?: true;
}

const sides = ['top', 'right', 'bottom', 'left'];
const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

export const properties: readonly Property[] = [
  { key: 'rendered-width', label: 'Rendered width', section: 'Layout & geometry', measurement: 'width' },
  { key: 'rendered-height', label: 'Rendered height', section: 'Layout & geometry', measurement: 'height' },
  { key: 'width', label: 'CSS width', section: 'Layout & geometry' },
  { key: 'height', label: 'CSS height', section: 'Layout & geometry' },
  { key: 'display', label: 'Display', section: 'Layout & geometry' },
  { key: 'position', label: 'Position', section: 'Layout & geometry' },
  { key: 'box-sizing', label: 'Box sizing', section: 'Layout & geometry' },
  { key: 'align-items', label: 'Align items', section: 'Layout & geometry' },
  { key: 'justify-content', label: 'Justify content', section: 'Layout & geometry' },
  ...(['padding', 'margin'] as const).flatMap(kind => sides.map(side => ({
    key: kind + '-' + side, label: kind + ' ' + side, section: 'Spacing' as const, preview: true as const,
  }))),
  { key: 'row-gap', label: 'Row gap', section: 'Spacing', preview: true, optional: true },
  { key: 'column-gap', label: 'Column gap', section: 'Spacing', preview: true, optional: true },
  { key: 'font-family', label: 'Font family', section: 'Typography' },
  { key: 'font-size', label: 'Font size', section: 'Typography', preview: true },
  { key: 'font-weight', label: 'Font weight', section: 'Typography', preview: true },
  { key: 'line-height', label: 'Line height', section: 'Typography', preview: true },
  { key: 'letter-spacing', label: 'Letter spacing', section: 'Typography', preview: true },
  { key: 'color', label: 'Text color', section: 'Typography', preview: true },
  { key: 'background-color', label: 'Background', section: 'Appearance', preview: true },
  ...sides.map(side => ({ key: 'border-' + side, label: 'Border ' + side, section: 'Appearance' as const })),
  ...corners.map(corner => ({
    key: 'border-' + corner + '-radius', label: corner + ' radius', section: 'Appearance' as const, preview: true as const,
  })),
  { key: 'box-shadow', label: 'Box shadow', section: 'Appearance' },
  { key: 'opacity', label: 'Opacity', section: 'Appearance', preview: true },
];

export const sections: readonly Section[] = ['Layout & geometry', 'Spacing', 'Typography', 'Appearance'];
export const previewableProperties = new Set(properties.filter(property => property.preview).map(property => property.key));

export const inspectorGroups: ReadonlyArray<{
  name: string;
  fields: ReadonlyArray<readonly [key: string, label: string]>;
}> = [
  {
    name: 'Layout',
    fields: [
      ['width', 'CSS width'], ['height', 'CSS height'], ['display', 'Display'], ['position', 'Position'],
      ['box-sizing', 'Box sizing'], ['align-items', 'Align items'], ['justify-content', 'Justify content'],
      ['margin', 'Margin'], ['padding', 'Padding'], ['row-gap', 'Row gap'], ['column-gap', 'Column gap'],
    ],
  },
  { name: 'Typography', fields: properties.filter(property => property.section === 'Typography').map(({ key, label }) => [key, label]) },
  {
    name: 'Appearance',
    fields: [
      ['background-color', 'Background'], ['border', 'Border'], ...sides.map(side => ['border-' + side, 'Border ' + side] as const),
      ['border-radius', 'Border radius'], ['box-shadow', 'Box shadow'], ['opacity', 'Opacity'],
    ],
  },
];
