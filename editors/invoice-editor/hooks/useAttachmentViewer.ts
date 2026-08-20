import { useCallback, useEffect, useRef, useState } from "react";
import { useAttachmentService } from "@powerhousedao/reactor-browser";
import { ensureAttachmentService } from "../../shared/attachments.js";
import type { AttachmentRef } from "./useFileUpload.js";

export interface UseAttachmentViewerResult {
  /**
   * Object URL for the currently-open attachment, or `null` when nothing is
   * open. Use it directly as an `<iframe>` / `<img>` `src`. The modal/preview is
   * considered open exactly when this is non-null.
   */
  url: string | null;
  /** MIME type of the open attachment (e.g. `application/pdf`, `image/png`), or `null`. */
  mimeType: string | null;
  /** True while the attachment bytes are being fetched. */
  isLoading: boolean;
  /** The last fetch error, or `undefined`. */
  error: Error | undefined;
  /** Fetch the bytes for `ref` from the attachment service and open the preview. */
  view: (ref: AttachmentRef) => Promise<void>;
  /** Close the preview and release the object URL. */
  close: () => void;
}

/**
 * Editor-wide helper for reading a stored attachment back from its
 * `attachment://` ref and exposing it as an object URL suitable for previewing
 * (e.g. a PDF in an `<iframe>`).
 *
 * Pairs with {@link useFileUpload}: upload returns a ref you store on the
 * document; this hook resolves that ref to viewable bytes via the
 * Connect-provided attachment service (`useAttachmentService().get(ref)`).
 *
 * The object URL is revoked automatically on `close()`, when a new `view()`
 * supersedes it, and on unmount — so callers never leak blob URLs.
 *
 * Usage:
 * ```tsx
 * const viewer = useAttachmentViewer();
 * <button onClick={() => viewer.view(baseInvoiceRef)}>View</button>
 * <PDFReviewModal viewOnly open={viewer.url !== null} pdfUrl={viewer.url}
 *   onReject={viewer.close} ... />
 * ```
 */
export function useAttachmentViewer(): UseAttachmentViewerResult {
  // Reading an attachment needs the same service that uploading does, and
  // Connect supplies none for a local-only drive. Every current caller also
  // mounts `useFileUpload` (which registers it), but relying on that would make
  // any future view-only component fail; the call is idempotent, so register
  // here too rather than depend on a sibling hook.
  useEffect(() => {
    ensureAttachmentService();
  }, []);

  const service = useAttachmentService();
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const urlRef = useRef<string | null>(null);

  const setObjectUrl = useCallback((next: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setUrl(next);
  }, []);

  const view = useCallback(
    async (ref: AttachmentRef) => {
      setIsLoading(true);
      setError(undefined);
      try {
        if (!service) {
          throw new Error("Attachment service is not available");
        }
        const response = await service.get(ref);
        const buffer = await new Response(response.body).arrayBuffer();
        const type = response.header.mimeType || "application/octet-stream";
        const blob = new Blob([buffer], { type });
        setMimeType(type);
        setObjectUrl(URL.createObjectURL(blob));
      } catch (e) {
        setObjectUrl(null);
        setMimeType(null);
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setIsLoading(false);
      }
    },
    [service, setObjectUrl],
  );

  const close = useCallback(() => {
    setObjectUrl(null);
    setMimeType(null);
    setError(undefined);
  }, [setObjectUrl]);

  // Release the object URL if the component unmounts while a preview is open.
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return { url, mimeType, isLoading, error, view, close };
}
