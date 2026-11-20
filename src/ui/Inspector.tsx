import { formatDeclarations } from '../core/css';
import { dimensions, type Box } from '../core/geometry';
import type { Snapshot } from '../core/inspect';
import { inspectorGroups } from '../core/properties';
import { CssValue, IconButton, type Copy } from './Controls';
import { Icon } from './Icons';

interface Props {
  snapshot: Snapshot;
  box: Box | null;
  copy: Copy;
}

export function Inspector({ snapshot, box, copy }: Props) {
  const { selector, classes, values } = snapshot;
  return <>
    <div className="element-identity">
      <div className="identity-target">
        <span className="tag-mark">{snapshot.tag}</span>
        <button className="selector-copy" type="button" title={selector.note}
          aria-label={'Copy selector ' + selector.text} onClick={() => copy(selector.text)}>
          <code>{selector.text}</code><Icon name="copy"/>
        </button>
      </div>
      {classes.length > 0 && <div className="class-list" aria-label="CSS classes">
        {classes.map(name => <code key={name}>.{name}</code>)}
      </div>}
      {snapshot.frame && <p className="muted">Showing the frame element. Its embedded document is outside this inspection.</p>}
    </div>
    <div className="box-readout" aria-label="Box model measurements">
      <div className="nested-box margin-box">
        <div><span>Margin</span><code>{values.margin || '—'}</code></div>
        <div className="nested-box padding-box">
          <div><span>Padding</span><code>{values.padding || '—'}</code></div>
          <div className="size-box"><Icon name="ruler"/><span>Rendered box</span><strong>{box ? dimensions(box) : 'Hidden'}</strong></div>
        </div>
      </div>
    </div>
    {inspectorGroups.map(({ name, fields }) => {
      const declarations = fields.flatMap(([key, label]) => {
        const value = values[key];
        if (!value || (values.border && /^border-(top|right|bottom|left)$/.test(key))
          || (value === 'normal' && key.endsWith('-gap'))) return [];
        return [{ key, label, value }];
      });
      return <section className="property-section" key={name} aria-label={name}>
        <header className="section-heading">
          <h3>{name}</h3>
          <IconButton icon="copy" label={`Copy ${name.toLowerCase()} CSS`} onClick={() => copy(formatDeclarations(declarations))}/>
        </header>
        <dl className="property-list">
          {declarations.map(({ key, label, value }) => <div className="property-line" key={key}>
            <dt>{label}</dt>
            <dd><button className="value-button" type="button" aria-label={`Copy ${key}: ${value}`}
              onClick={() => copy(formatDeclarations([{ key, value }]))}><CssValue value={value}/><Icon name="copy"/></button></dd>
          </div>)}
        </dl>
      </section>;
    })}
  </>;
}
