import type { ReactNode, SyntheticEvent } from "react";
import { INVOICE_LOCKED_MESSAGE } from "../utils/invoicePermissions.js";

interface ReadOnlyRegionProps {
  /** When false, the controls inside become read-only. */
  readonly editable: boolean;
  /** Overrides the hover explanation. */
  readonly message?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

function block(event: SyntheticEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Blocks the **form controls** in the subtree, one control at a time, rather
 * than deadening the container.
 *
 * The targeting matters. An earlier version put `inert` (or an overlay) on the
 * wrapper, which blocked the entire card — labels, headings and static text went
 * dead and dimmed along with the fields, so a locked section read as broken
 * rather than read-only. These selectors reach only the controls themselves, so
 * everything around them stays live: headings are readable, label text is
 * selectable, and any sibling control left outside the region keeps working.
 *
 * `pointer-events-none` on a control means a click lands on the container
 * instead, so the field never focuses — no caret, no focus ring, no flash
 * suggesting it can be typed into. The muted background marks it as read-only,
 * and because the click reaches the container, the container's `title` explains
 * why on hover.
 *
 * `role` selectors are included because the design-system `Select` and
 * `DatePicker` are composed from divs rather than native `<select>`/`<input>`.
 *
 * Keyboard paths are covered separately, since `pointer-events-none` does not
 * stop tab-focus: `beforeinput` catches every way text could enter a field
 * (typing, IME, autofill) and cancelling it also cancels deletion, while
 * Enter/Space is cancelled on non-text controls.
 *
 * Workflow controls (status, payments, accounting tags, export) must stay usable
 * in every status, so they belong *outside* any region wrapped here.
 */
const BLOCKED_CONTROL_STYLES = [
  // Native controls
  "[&_input]:pointer-events-none",
  "[&_input]:bg-muted",
  "[&_input]:caret-transparent",
  "[&_textarea]:pointer-events-none",
  "[&_textarea]:bg-muted",
  "[&_textarea]:caret-transparent",
  "[&_select]:pointer-events-none",
  "[&_button]:pointer-events-none",
  // Design-system composites (div-based select / date picker)
  "[&_[role=combobox]]:pointer-events-none",
  "[&_[role=button]]:pointer-events-none",
  "[&_[role=listbox]]:pointer-events-none",
].join(" ");

export function ReadOnlyRegion({
  editable,
  message = INVOICE_LOCKED_MESSAGE,
  className,
  children,
}: ReadOnlyRegionProps) {
  if (editable) {
    return className ? <div className={className}>{children}</div> : children;
  }

  return (
    <div
      className={`cursor-not-allowed ${BLOCKED_CONTROL_STYLES} ${className ?? ""}`}
      title={message}
      onBeforeInputCapture={block}
      onPasteCapture={block}
      onCutCapture={block}
      onDropCapture={block}
      onKeyDownCapture={(e) => {
        const el = e.target;
        const isTextEntry =
          el instanceof HTMLElement &&
          (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
        if (!isTextEntry && (e.key === "Enter" || e.key === " ")) block(e);
      }}
    >
      {children}
    </div>
  );
}
