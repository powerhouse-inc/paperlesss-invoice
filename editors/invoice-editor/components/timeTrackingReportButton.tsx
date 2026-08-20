import { type ChangeEvent, useEffect, useRef } from "react";
import { FileClock } from "lucide-react";
import { usePHToast } from "@powerhousedao/reactor-browser";
import { actions, useSelectedInvoiceDocument } from "document-models/invoice";
import { useFileUpload } from "../hooks/useFileUpload.js";
import { useAttachmentViewer } from "../hooks/useAttachmentViewer.js";
import { validatePdfUpload } from "../utils/pdfUpload.js";
import { canEditInvoice } from "../utils/invoicePermissions.js";
import PDFReviewModal from "./PDFReviewModal.js";

/**
 * Upload + view a time tracking report PDF, stored on the invoice's
 * `timeTrackingReport` attachment field. Mirrors the base-invoice upload
 * (hash-first: dispatch the ref, then stream the bytes; PDF-only + 15 MB guard)
 * but with **no** AI parsing — the file is just attached and made viewable.
 *
 * Shows "Add Time Tracking Report" until one is attached, then flips to
 * "View Time Tracking Report", which opens a read-only PDF preview.
 */
export function TimeTrackingReportButton() {
  const [document, dispatch] = useSelectedInvoiceDocument();
  const timeTrackingReport = document.state.global.timeTrackingReport;

  // Adding a report is frozen outside DRAFT/REJECTED; an already-attached
  // report stays viewable in every status.
  const canEdit = canEditInvoice(document.state.global.status);

  const toast = usePHToast();
  const { uploadFile, isUploading } = useFileUpload();
  const viewer = useAttachmentViewer();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (viewer.error) {
      toast?.("Couldn't load the time tracking report.", { type: "error" });
    }
  }, [viewer.error, toast]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validatePdfUpload(file);
    if (validationError) {
      toast?.(validationError, { type: "error" });
      event.target.value = "";
      return;
    }
    event.target.value = ""; // allow re-selecting the same file later

    // Hash-first: record the ref immediately, stream the bytes in the
    // background, and roll the ref back if the upload fails.
    void uploadFile(file, (ref) => {
      dispatch(actions.setTimeTrackingReport({ timeTrackingReport: ref }));
    }).catch((err: unknown) => {
      console.error("Time tracking report upload failed:", err);
      dispatch(actions.setTimeTrackingReport({ timeTrackingReport: null }));
      toast?.("Couldn't attach the time tracking report. Please try again.", {
        type: "error",
      });
    });
  }

  const buttonClass =
    "flex items-center gap-2 px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors text-sm font-medium text-foreground disabled:opacity-60";

  return (
    <>
      {timeTrackingReport ? (
        <button
          onClick={() => void viewer.view(timeTrackingReport)}
          disabled={viewer.isLoading}
          className={buttonClass}
          title="View Time Tracking Report"
        >
          <FileClock className="w-4 h-4" />
          <span>
            {viewer.isLoading ? "Loading…" : "View Time Tracking Report"}
          </span>
        </button>
      ) : canEdit ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={buttonClass}
          title="Add Time Tracking Report"
        >
          <FileClock className="w-4 h-4" />
          <span>{isUploading ? "Uploading…" : "Add Time Tracking Report"}</span>
        </button>
      ) : null}

      {canEdit && (
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFile}
        />
      )}

      {/* Read-only preview of the stored time tracking report */}
      <PDFReviewModal
        open={viewer.url !== null}
        viewOnly
        pdfUrl={viewer.url}
        base64Pdf={null}
        fileName="Time tracking report"
        reviewData={null}
        onAccept={() => {}}
        onReject={viewer.close}
      />
    </>
  );
}
