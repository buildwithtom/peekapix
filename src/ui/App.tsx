import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { copyText } from '../core/clipboard';
import type { Session } from '../core/session';
import { ComparePanel } from './Compare';
import { IconButton } from './Controls';
import { Brand, Icon } from './Icons';
import { Inspector } from './Inspector';

export function App({ session }: { session: Session }) {
  const view = useSyncExternalStore(session.subscribe, session.get);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [feedback, setFeedback] = useState('');
  const timer = useRef<number>(undefined);
  const mounted = useRef(false);
  const { mode, picking, collapsed, overlays, selections, boxes, notice } = view;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  function copy(text: string) {
    if (!text) return;
    window.clearTimeout(timer.current);
    const report = (message: string) => {
      if (!mounted.current) return;
      setFeedback(message);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFeedback(''), 2500);
    };
    void copyText(text, session.shadow).then(
      () => report('Copied to clipboard.'),
      () => report('Clipboard access is unavailable on this page.'),
    );
  }

  const hasPanel = mode === 'compare' || !!selections.item;
  const indicator = picking === 'item' ? 'Picking an element' : picking ? `Picking ${picking.toUpperCase()}`
    : mode === 'compare' && selections.a && selections.b ? 'A and B pinned' : selections.item && mode === 'inspect' ? 'Element pinned' : 'Picking paused';
  const dockLabel = picking ? 'Pause picking' : 'Pick an element';
  return <div className="toolkit" data-side={side}>
    <div className="dock" role="toolbar" aria-label="Peekapix tools">
      <Brand/>
      <div className="mode-segments" role="group" aria-label="Inspection mode">
        <button type="button" aria-pressed={mode === 'inspect'}
          onClick={() => mode === 'inspect' ? session.pick('item') : session.setMode('inspect')}>
          <Icon name="inspect"/>Inspect
        </button>
        <button type="button" aria-pressed={mode === 'compare'}
          onClick={() => session.setMode('compare')}>
          <Icon name="compare"/>Compare
        </button>
      </div>
      <div className="dock-actions">
        <IconButton icon="move" label="Move Peekapix dock"
          onClick={() => setSide(side === 'right' ? 'left' : 'right')}/>
        <IconButton icon="close" label="Deactivate Peekapix" onClick={session.close}/>
      </div>
    </div>
    <div className="status-strip">
      <span className="status-label" role="status"><span className={`signal-dot ${picking ? 'live' : ''}`}/>{indicator}</span>
      {mode === 'inspect' && <button type="button" className="text-button" onClick={() => session.pick('item')}>
        {dockLabel}
      </button>}
      <IconButton icon={overlays ? 'overlay' : 'hidden'} label={overlays ? 'Hide measurements' : 'Show measurements'}
        onClick={() => session.toggleOverlays()}/>
      {collapsed && <IconButton icon="expand" label="Expand panel" onClick={() => session.togglePanel()}/>}
    </div>
    {hasPanel && <section hidden={collapsed} className={`panel panel-${mode}`} aria-label={mode === 'inspect' ? 'Inspector' : 'Comparison'}>
      <header className="panel-header">
        <h2>{mode === 'inspect' ? 'Inspector' : 'Compare elements'}</h2>
        <IconButton icon="shrink" label="Collapse panel" onClick={() => session.togglePanel()}/>
      </header>
      {mode === 'inspect' && selections.item ? <div className="panel-scroll" tabIndex={0} aria-label="Computed CSS properties">
        <Inspector snapshot={selections.item.snapshot} box={boxes.item} copy={copy}/>
      </div> : <ComparePanel view={view} session={session} copy={copy}/>}
    </section>}
    {!hasPanel && mode === 'inspect' && <p className="instruction">
      {picking ? <>Point and click, or Tab and press Enter. <kbd>Esc</kbd> pauses.</> : <>Choose Inspect to resume picking.</>}
    </p>}
    <div className="announcement" role="status" aria-live="polite">
      {(feedback || notice) && <span>{feedback || notice}</span>}
    </div>
  </div>;
}
