/** Read native plaintext-editing DOM structurally. innerText adds layout-derived
 * newlines (and can apply CSS casing); textContent loses DIV/BR line breaks. */
export function readEditableText(
  root: Node,
  preserveTerminalBreak = false,
): string {
  const children = [...root.childNodes].filter(
    (n) => n.nodeType === 1 || n.nodeType === 3,
  );
  let output = "",
    previousBlock = false;
  children.forEach((node, index) => {
    const tag = node.nodeType === 1 ? (node as Element).tagName : "",
      block = ["DIV", "P", "LI"].includes(tag);
    if (
      index > 0 &&
      (block || previousBlock) &&
      !(block && !previousBlock && output.endsWith("\n"))
    )
      output += "\n";
    if (node.nodeType === 3) output += node.textContent ?? "";
    else if (tag === "BR") {
      if (index < children.length - 1 || preserveTerminalBreak) output += "\n";
    } else output += readEditableText(node, preserveTerminalBreak);
    previousBlock = block;
  });
  return output;
}
/** Normalize browser-generated paragraph wrappers while retaining the caret.
 * IME composition callers defer this until compositionend. */
export function normalizeEditableText(el: HTMLElement, value: string) {
  const terminalLine = value.endsWith("\n");
  if (
    el.childNodes.length === (terminalLine ? 2 : 1) &&
    el.firstChild?.nodeType === 3 &&
    el.textContent === value &&
    (!terminalLine || (el.lastChild as Element)?.tagName === "BR")
  )
    return;
  const selection = el.ownerDocument.getSelection();
  let caret: number | undefined;
  if (
    selection?.isCollapsed &&
    selection.focusNode &&
    el.contains(selection.focusNode)
  ) {
    const prefix = el.ownerDocument.createRange();
    prefix.selectNodeContents(el);
    prefix.setEnd(selection.focusNode, selection.focusOffset);
    caret = readEditableText(prefix.cloneContents(), true).length;
  }
  el.textContent = value;
  // A BR provides a visual caret line without adding any authored source text.
  // readEditableText deliberately ignores this terminal caret placeholder.
  if (terminalLine) el.append(el.ownerDocument.createElement("br"));
  if (caret !== undefined && selection) {
    const range = el.ownerDocument.createRange();
    range.setStart(el.firstChild ?? el, Math.min(caret, value.length));
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
/** Native plaintext-only Enter may append a second newline as a caret scaffold.
 * Insert the authored break ourselves, before that scaffold reaches the DOM. */
export function replaceEditableSelection(
  el: HTMLElement,
  text: string,
): boolean {
  const selection = el.ownerDocument.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return false;
  range.deleteContents();
  const inserted = el.ownerDocument.createTextNode(text);
  range.insertNode(inserted);
  range.setStartAfter(inserted);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
