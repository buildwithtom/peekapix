import { useState } from 'react';
import { compare, differenceDeclarations, type ComparisonRow, type Side } from '../core/css';
import { dimensions, formatPixels, type Box, type Measurement } from '../core/geometry';
import type { Snapshot } from '../core/inspect';
import { sections } from '../core/properties';
import { Session, otherSide } from '../core/session';
import { CssValue, IconButton, type Copy } from './Controls';
import { Icon } from './Icons';

type View = ReturnType<Session['get']>;
interface Props {
  view: View;
  session: Session;
  copy: Copy;
}

export function ComparePanel({ view, session, copy }: Props) {
  const { selections, boxes, picking, measurement, preview } = view;
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [all, setAll] = useState(false);
  const [target, setTarget] = useState<Side>('b');
  const source = otherSide(target);
  const canCompare = !!selections.a && !!selections.b;
  const rows = selections.a && selections.b ? compare(selections.a.snapshot, selections.b.snapshot) : [];
  const different = rows.filter(row => row.different);
  const changes = differenceDeclarations(rows, source);
  const eligible = new Set(rows.filter(row => row.different && row.property.preview && row[source]).map(row => row.property.key));
  const selected = new Set([...checked].filter(key => eligible.has(key)));
  const applied = new Set(preview?.declarations.map(({ key }) => key) ?? []);
  const count = different.length;

  function toggleProperty(key: string) {
    setChecked(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return <>
    <div className="compare-summary">
      <div className="references">
        {(['a', 'b'] as const).map(side => <Reference
          key={side} side={side} snapshot={selections[side]?.snapshot} box={boxes[side]}
          active={picking === side} onPick={() => { setChecked(new Set()); session.pick(side); }}
        />)}
      </div>
      {canCompare && <>
        <div className="comparison-toolbar">
          <span className="diff-count"><b>{count}</b> {count === 1 ? 'difference' : 'differences'}</span>
          <div className="small-segments" role="group" aria-label="Property visibility">
            <button type="button" aria-pressed={!all} onClick={() => setAll(false)}>Differences</button>
            <button type="button" aria-pressed={all} onClick={() => setAll(true)}>All</button>
          </div>
          <IconButton icon="swap" label="Swap A and B" onClick={() => { setChecked(new Set()); session.swap(); }}/>
        </div>
        <GeometryReadout measurement={measurement}/>
      </>}
    </div>
    {canCompare ? <>
      <div className="comparison-scroll panel-scroll" tabIndex={0} aria-label="Compared CSS properties">
        {!all && !count && <div className="empty-comparison">
          <Icon name="check"/>
          <h3>Values match</h3>
          <p>A and B have the same values for the properties shown here.</p>
          <button className="text-button" type="button" onClick={() => setAll(true)}>Show all properties</button>
        </div>}
        <div className="difference-list" role="table" aria-label="CSS property comparison">
          {sections.map(section => {
            const visible = (all ? rows : different).filter(row => row.property.section === section);
            if (!visible.length) return null;
            return <div key={section} role="rowgroup" aria-label={section}>
              <div className="diff-head difference-grid" role="row">
                <h3 role="columnheader">{section}</h3><span role="columnheader">A</span><span role="columnheader">B</span>
              </div>
              {visible.map(row => <Difference
                key={row.property.key} row={row} selectable={!picking && eligible.has(row.property.key)}
                selected={selected.has(row.property.key)} applied={applied.has(row.property.key)}
                onToggle={() => toggleProperty(row.property.key)} copy={copy}
              />)}
            </div>;
          })}
        </div>
      </div>
      <footer className="preview-controls">
        {preview && <div className="preview-banner" role="status" title="The rows show the values before this preview.">
          <span className="signal-dot"/><span><strong>Preview on {preview.target.toUpperCase()}</strong> · {preview.declarations.length} {preview.declarations.length === 1 ? 'property' : 'properties'}</span>
          <IconButton icon="undo" label="Undo last preview" onClick={() => session.undoPreview()}/>
          <button type="button" className="text-button" onClick={() => { setChecked(new Set()); session.resetPreview(); }}>Reset</button>
        </div>}
        <div className="preview-main">
          <label className="direction">
            <span>Match direction</span>
            <select value={target} disabled={!!preview} onChange={event => { setTarget(event.target.value as Side); setChecked(new Set()); }}>
              <option value="b">Match B to A</option>
              <option value="a">Match A to B</option>
            </select>
          </label>
          <div className="preview-action">
            <button className="button primary" type="button" disabled={!selected.size || !!picking}
              onClick={() => { if (session.applyPreview(target, selected)) setChecked(new Set()); }}>
              {selected.size ? `Preview ${selected.size} ${selected.size === 1 ? 'property' : 'properties'}` : 'Preview selected'}
            </button>
            {!preview && !selected.size && eligible.size > 0 && <span>Check properties to preview.</span>}
          </div>
        </div>
        <div className="export-actions">
          <button className="text-button" type="button" disabled={!changes.length} onClick={() => copy(session.rule(target, changes))}>
            <Icon name="copy"/>Copy differences
          </button>
          <button className="text-button" type="button" disabled={!preview} onClick={() => {
            if (preview) copy(session.rule(preview.target, preview.declarations));
          }}><Icon name="copy"/>Copy preview patch</button>
        </div>
      </footer>
    </> : <div className="compare-empty">
      <Icon name="compare"/>
      <p>{picking ? `Pick element ${picking.toUpperCase()} on the page.` : 'Choose a reference to start comparing.'}</p>
      <span>{picking ? 'Point and click, or Tab and press Enter.' : 'Each reference can be replaced independently.'}</span>
    </div>}
  </>;
}

function Reference({ side, snapshot, box, active, onPick }: {
  side: Side;
  snapshot?: Snapshot;
  box: Box | null;
  active: boolean;
  onPick: () => void;
}) {
  const letter = side.toUpperCase();
  const name = snapshot?.name.startsWith(snapshot.tag + '#') ? snapshot.name.slice(snapshot.tag.length) : snapshot?.name;
  return <div className={`reference reference-${side}`} data-picking={active}>
    <span className="reference-letter" aria-label={`Element ${letter}`}>{letter}</span>
    <div className="reference-data">
      <strong title={snapshot?.name}>{name ?? `Element ${letter}`}</strong>
      <code>{active ? 'Picking…' : snapshot ? box ? dimensions(box) : 'Hidden' : 'Awaiting selection'}</code>
    </div>
    <IconButton icon={active ? 'close' : 'replace'} label={active ? `Pause picking ${letter}` : snapshot ? `Replace ${letter}` : `Pick ${letter}`}
      onClick={onPick}/>
  </div>;
}

function GeometryReadout({ measurement }: { measurement: Measurement | null }) {
  let label = 'Geometry';
  let value = 'Selection unavailable';
  if (measurement?.kind === 'gap') {
    const { distance, axis } = measurement;
    label = `${axis.charAt(0).toUpperCase()}${axis.slice(1)} gap`;
    value = formatPixels(distance);
  } else if (measurement?.kind === 'overlap') {
    label = 'Bounds overlap';
    value = dimensions({ x: 0, y: 0, ...measurement });
  } else if (measurement?.kind === 'touching') {
    label = 'Bounds touch';
    value = '0px';
  }
  return <div className="geometry-readout" title="Distance uses rendered, axis-aligned bounds. CSS margin, padding, and gap appear in Spacing.">
    <Icon name="ruler"/><span>{label}</span><strong>{value}</strong><span className="geometry-source">Rendered bounds</span>
  </div>;
}

function Difference({ row, selectable, selected, applied, onToggle, copy }: {
  row: ComparisonRow;
  selectable: boolean;
  selected: boolean;
  applied: boolean;
  onToggle: () => void;
  copy: Copy;
}) {
  const { property, different } = row;
  return <div className="difference-grid diff-row" role="row" data-different={different} data-checked={selected}>
    <div className="diff-property" role="rowheader">
      {selectable
        ? <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${property.key} for preview`}/>
        : <span className="diff-mark" aria-hidden="true">{different ? '≠' : '·'}</span>}
      <span>{property.label}{applied && <span className="applied-marker">Preview</span>}</span>
    </div>
    {(['a', 'b'] as const).map(side => <div className="diff-cell" role="cell" key={side}>
      {row[side] && !property.measurement
        ? <button type="button" className="value-button" onClick={() => copy(row[side])}
          aria-label={`Copy ${side.toUpperCase()} ${property.key}: ${row[side]}`}><CssValue value={row[side]}/></button>
        : <CssValue value={row[side]}/>}
    </div>)}
  </div>;
}
