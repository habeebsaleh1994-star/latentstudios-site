import type { KeyboardEvent } from "react";
export function trapDialogTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const elements = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button, a[href], input, textarea, select, [tabindex="0"]',
    ),
  ).filter(
    (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
  );
  const first = elements[0],
    last = elements.at(-1),
    active = event.currentTarget.ownerDocument.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first?.focus();
  }
}
