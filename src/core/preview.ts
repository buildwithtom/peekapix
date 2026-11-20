import type { Declaration } from './css';
import { previewableProperties } from './properties';

type InlineValue = { value: string; priority: string };
type Stylable = HTMLElement | SVGElement | MathMLElement;
interface Edit {
  before: string | null;
  after: string | null;
  changes: ReadonlyArray<{ key: string; before: InlineValue; after: InlineValue }>;
  previousPatch: ReadonlyMap<string, string>;
}

export function canPreview(element: Element): element is Stylable {
  return 'style' in element && element.style instanceof CSSStyleDeclaration;
}

const inlineValue = (style: CSSStyleDeclaration, key: string): InlineValue => ({
  value: style.getPropertyValue(key),
  priority: style.getPropertyPriority(key),
});

export class Preview {
  private edits: Edit[] = [];
  private patch = new Map<string, string>();

  constructor(readonly element: Stylable) {}

  get declarations(): Declaration[] {
    return [...this.patch].map(([key, value]) => ({ key, value }));
  }

  apply(declarations: readonly Declaration[]) {
    const element = this.element;
    const style = element.style;
    const before = element.getAttribute('style');
    const previousPatch = new Map(this.patch);
    const changes = declarations.flatMap(({ key, value }) => {
      if (!previewableProperties.has(key) || !CSS.supports(key, value)) return [];
      const original = inlineValue(style, key);
      style.setProperty(key, value, 'important');
      const after = inlineValue(style, key);
      if (!after.value || after.priority !== 'important') return [];
      this.patch.set(key, value);
      return [{ key, before: original, after }];
    });
    if (changes.length) this.edits.push({ before, after: element.getAttribute('style'), changes, previousPatch });
    return changes.length;
  }

  undo() {
    const edit = this.edits.pop();
    if (!edit) return;
    const element = this.element;
    if (element.getAttribute('style') === edit.after) {
      // Restores shorthand order, whitespace and the distinction between an empty and absent attribute.
      if (edit.before === null) element.removeAttribute('style');
      else element.setAttribute('style', edit.before);
    } else {
      // Keep unrelated inline edits and newer writes to declarations the page replaced.
      for (const change of [...edit.changes].reverse()) {
        const current = inlineValue(element.style, change.key);
        if (current.value !== change.after.value || current.priority !== change.after.priority) continue;
        if (change.before.value) element.style.setProperty(change.key, change.before.value, change.before.priority);
        else element.style.removeProperty(change.key);
      }
    }
    this.patch = new Map(edit.previousPatch);
  }

  reset() {
    while (this.edits.length) this.undo();
  }
}
