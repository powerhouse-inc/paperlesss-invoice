import type { KeyboardEvent } from "react";
import { type ValidationResult } from "../validation/validationManager.js";

/**
 * Maps an external ValidationResult to the `warnings` prop shape expected by
 * document-engineering's `TextInput` / `Textarea`. Returns `undefined` when the
 * field is valid or unvalidated. Replaces the mapping the former `InputField`
 * wrapper performed, so call sites can pass `warnings={toInputWarnings(v)}`
 * instead of a bespoke `validation` prop.
 */
export function toInputWarnings(
  validation?: ValidationResult | null,
): string[] | undefined {
  return validation && !validation.isValid ? [validation.message] : undefined;
}

/**
 * On Enter: blur the current field and move focus to the next focusable element.
 * Preserves the keyboard navigation the former `InputField` wrapper provided;
 * attach as `onKeyDown={focusNextOnEnter}` on a `TextInput`.
 */
export function focusNextOnEnter(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== "Enter") return;
  e.preventDefault();
  e.currentTarget.blur();
  const focusableElements = document.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  const currentIndex = Array.from(focusableElements).indexOf(e.currentTarget);
  if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
    (focusableElements[currentIndex + 1] as HTMLElement).focus();
  }
}
