// Makes everything outside `node` inert: every sibling of the node and of each
// of its ancestors, up to <body>. Returns a function that undoes exactly what
// it changed. Left alone: elements marked `data-inert-exempt` (the landscape
// overlay), elements that were already inert, and custom elements, which here
// are framework utilities (Next's route announcer and dev overlay).

const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"]);

export function inertOthers(node: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  let current: HTMLElement = node;
  while (current !== document.body && current.parentElement) {
    const parent: HTMLElement = current.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === current || !(sibling instanceof HTMLElement)) continue;
      if (SKIP.has(sibling.tagName) || sibling.tagName.includes("-")) continue;
      if (sibling.inert || sibling.hasAttribute("data-inert-exempt")) continue;
      sibling.inert = true;
      changed.push(sibling);
    }
    current = parent;
  }
  return () => {
    for (const el of changed) el.inert = false;
  };
}
