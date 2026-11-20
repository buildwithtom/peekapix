export interface Selector {
  text: string;
  note?: string;
}

export function elementName(element: Element) {
  const id = element.id ? '#' + element.id : '';
  const firstClass = element.classList.item(0);
  return element.localName + (id || (firstClass ? '.' + firstClass : ''));
}

export function selectorFor(element: Element): Selector {
  const root = element.getRootNode() as Document | ShadowRoot;
  const scoped = root instanceof ShadowRoot;
  const tag = (node: Element) => CSS.escape(node.localName);
  const id = (node: Element) => '#' + CSS.escape(node.id);
  const unique = (selector: string) => {
    const matches = root.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  };
  const result = (text: string, note?: string): Selector => ({
    text,
    note: [scoped ? 'Apply inside the element’s shadow root.' : undefined, note].filter(Boolean).join(' ') || undefined,
  });

  if (element.id && unique(id(element))) return result(id(element), 'Verify this ID is stable on your page.');
  const classNames = [...element.classList].slice(0, 8);
  for (const name of classNames) {
    const candidate = tag(element) + '.' + CSS.escape(name);
    if (unique(candidate)) return result(candidate, 'Verify the class name is stable on your page.');
  }
  if (unique(tag(element))) return result(tag(element), 'This tag is unique in the current DOM.');
  if (classNames.length > 1) {
    const candidate = tag(element) + classNames.map(name => '.' + CSS.escape(name)).join('');
    if (unique(candidate)) return result(candidate, 'Verify the class names are stable on your page.');
  }

  const path: string[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.id) {
      const candidate = [id(node), ...path].join(' > ');
      if (unique(candidate)) return result(candidate, 'Positional selector. Verify it against your markup.');
    }
    let index = 1;
    for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.localName === node.localName && sibling.namespaceURI === node.namespaceURI) index++;
    }
    path.unshift(`${tag(node)}:nth-of-type(${index})`);
    const candidate = path.join(' > ');
    if (unique(candidate)) return result(candidate, 'Positional selector. Verify it against your markup.');
  }
  return result(path.join(' > '), 'Verify this selector before applying it.');
}
