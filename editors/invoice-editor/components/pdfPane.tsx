import { X } from "lucide-react";

interface PdfPaneProps {
  /** Object URL for the PDF bytes (from `useAttachmentViewer`). */
  readonly url: string | null;
  /** Shown in the pane header. */
  readonly fileName?: string | null;
  /** Renders a close affordance in the header when provided. */
  readonly onClose?: () => void;
}

/**
 * Inline PDF box — the same viewer the "View Uploaded Invoice" / time-tracking
 * modals use, but living in the layout instead of over it.
 *
 * This is an `<iframe>`, which hands the file to the browser's built-in PDF
 * viewer. That is the point: it brings zoom, download, print, page navigation
 * and its own internal scrolling for free, and its scrolling is contained —
 * paging through a long PDF never grows this box or moves the invoice editor
 * beside it.
 *
 * An earlier revision rendered pages to a canvas via pdf.js to strip the
 * browser's toolbar. That was the wrong trade: it removed the very controls
 * that are wanted here, and because every page was laid out in the document
 * flow, a multi-page PDF stretched the pane and forced the whole editor to
 * scroll. The two goals are mutually exclusive — you cannot both suppress the
 * native toolbar and keep the native features — and the native features win.
 *
 * Sizing note: this component fills its parent (`h-full` + `min-h-0`) and never
 * sets its own height. The bounded height comes from the container, so the box
 * stays put and the iframe scrolls internally.
 */
export function PdfPane({ url, fileName, onClose }: PdfPaneProps) {
  const title = fileName?.trim() ? fileName : "Uploaded invoice";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">
            Attached to this invoice.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close PDF pane"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* min-h-0 is what keeps the iframe inside the box: without it the flex
          child takes its content height and the pane grows instead of scrolling. */}
      <div className="min-h-0 flex-1 bg-background">
        {url ? (
          <iframe src={url} title={title} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No preview available
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfPane;
