import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface PartyFormModalProps {
  readonly open: boolean;
  /** Modal heading, e.g. "Issuer details". */
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * Modal shell for an invoice party's full form.
 *
 * The overlay sits at `z-50`, deliberately NOT higher. Every design-system
 * dropdown (Select, CountryCodePicker, DatePicker) renders its popover through
 * a Radix portal on `document.body` carrying a hard-coded `z-50`. An overlay
 * above that value paints over those popovers, so the fields inside look
 * clickable but their options are invisible. Matching `z-50` lets the popover
 * win on DOM order instead -- its portal is appended after this one, since it
 * opens later. `ConfirmationModal` uses `z-50` for the same reason.
 *
 * There is deliberately no Save/Cancel pair. The fields inside dispatch their
 * own edits on blur (see CLAUDE.md), so every change is already committed to
 * the document by the time this closes — a "Cancel" button would imply a
 * rollback that does not exist. Closing is therefore the only action.
 */
export function PartyFormModal({
  open,
  title,
  onClose,
  children,
}: PartyFormModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
      >
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="truncate text-xl font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        <footer className="flex justify-end border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
          >
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
