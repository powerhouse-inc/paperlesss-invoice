/** Maximum size for any uploaded file (PDF invoice, time tracking report, receipt). */
export const MAX_UPLOAD_MB = 15;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

function checkSize(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `File is too large (${mb} MB). Maximum is ${MAX_UPLOAD_MB} MB.`;
  }
  return null;
}

/**
 * Validates a PDF-only upload (invoice / time tracking report). Returns a
 * human-readable error message, or `null` when the file passes. The input
 * `accept` attribute is only a picker hint and is bypassable, so we enforce
 * type here; the extension is a fallback when the browser reports no MIME.
 */
export function validatePdfUpload(file: File): string | null {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF files are supported.";
  return checkSize(file);
}

const RECEIPT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/avif",
];
const RECEIPT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".avif"];

/**
 * Validates an expense-receipt upload: a PDF or a JPEG/PNG/GIF image. Returns a
 * human-readable error message, or `null` when the file passes.
 */
export function validateReceiptUpload(file: File): string | null {
  const name = file.name.toLowerCase();
  const isAccepted =
    RECEIPT_MIME_TYPES.includes(file.type) ||
    RECEIPT_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!isAccepted)
    return "Only PDF, JPEG, PNG, GIF, or AVIF files are supported.";
  return checkSize(file);
}
