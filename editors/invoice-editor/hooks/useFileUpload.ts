import { useCallback, useEffect } from "react";
import {
  useAttachmentUpload,
  type AttachmentUploadStage,
  type UseAttachmentUploadReturn,
} from "@powerhousedao/reactor-browser";
import { ensureAttachmentService } from "../../shared/attachments.js";

/**
 * Byte-level upload progress: `{ percent (0-100), loaded, total, indeterminate }`.
 *
 * Derived from the hook's return type rather than imported by name, because
 * reactor-browser exposes the shape but not the type alias. Deriving it keeps
 * this in lockstep with upstream instead of drifting into a hand-copied
 * duplicate — which is the failure mode the upstream rework was guarding
 * against.
 */
export type UploadProgress = UseAttachmentUploadReturn["progress"];

/**
 * An opaque attachment reference, e.g. `attachment://v1:<sha256>`.
 *
 * Structurally identical to the document model's `AttachmentRef` scalar (and to
 * reactor's own `AttachmentRef`), so a ref returned by {@link useFileUpload} can
 * be passed straight into the generated action creators
 * (`actions.setBaseInvoice`, `actions.setTimeTrackingReport`,
 * `actions.addLineItemReceipt`, …) with no cast.
 */
export type AttachmentRef = `attachment://v${number}:${string}`;

export interface UseFileUploadResult {
  /**
   * Hash-first upload, per the attachment service's documented ordering:
   *   1. hash the file locally (the ref is known immediately, no network),
   *   2. call `onRef(ref)` so the caller can dispatch the document action
   *      **before** the bytes are uploaded (the ref becomes durable/indexed
   *      right away),
   *   3. stream the bytes.
   *
   * Resolves with the ref once the bytes have landed. Rejects if hashing or
   * upload fails (and {@link error} is populated) — the caller should roll back
   * the ref it dispatched in `onRef`.
   */
  uploadFile: (
    file: File,
    onRef?: (ref: AttachmentRef) => void,
  ) => Promise<AttachmentRef>;
  /**
   * Upload lifecycle stage:
   * `idle | hashing | reserving | uploading | done | error`.
   *
   * Mirrors reactor-browser's own vocabulary. Replaces the former
   * `UploadStatus` enum, a parallel set of names that had already drifted from
   * the client's stages (it never gained `reserving`).
   */
  stage: AttachmentUploadStage;
  /**
   * Byte-level progress. Note `percent` is 0-100, **not** the 0..1 fraction the
   * old `progress` number used.
   */
  progress: UploadProgress;
  /** The last upload error, or `undefined`. */
  error: Error | undefined;
  /** True while hashing, reserving, or uploading. */
  isUploading: boolean;
}

/**
 * Editor-wide helper for uploading a file to the Powerhouse attachment service
 * and getting back an opaque `attachment://` ref to store on the invoice.
 *
 * Wraps reactor-browser's `useAttachmentUpload`, which itself wires
 * `useAttachments()` → the attachment service Connect provides globally — so a
 * component only needs to call `uploadFile(file)` and then dispatch the ref.
 *
 * The ref is content-addressed (hash of the bytes), so identical files
 * deduplicate to the same ref server-side.
 *
 * Usage:
 * ```tsx
 * const [document, dispatch] = useSelectedInvoiceDocument();
 * const { uploadFile, isUploading, error } = useFileUpload();
 *
 * async function onFile(file: File) {
 *   await uploadFile(file, (ref) =>
 *     dispatch(actions.setBaseInvoice({ baseInvoice: ref })),
 *   );
 * }
 * ```
 *
 * Each hook instance tracks a single upload at a time (one shared
 * stage/progress). For concurrent uploads (e.g. several line-item receipts at
 * once) call the hook per slot, or upload sequentially.
 */
export function useFileUpload(): UseFileUploadResult {
  // Register an attachment service on mount when Connect hasn't (it only does
  // so for drives loaded from a remote Switchboard, so a local-only drive gets
  // none — see `ensureAttachmentService`).
  //
  // This has to run at mount rather than inside `uploadFile`: the `preprocess`
  // / `upload` callbacks below close over the client that `useAttachmentUpload`
  // resolved during *this* render, so a service registered mid-upload would be
  // invisible to them and the call would still throw "AttachmentClient not
  // available". Registering here instead re-renders the hook (the setter
  // dispatches a window event that `useAttachmentService` subscribes to) so the
  // client is in place well before any user interaction.
  useEffect(() => {
    ensureAttachmentService();
  }, []);

  const { preprocess, upload, stage, progress, error } = useAttachmentUpload();

  const uploadFile = useCallback(
    async (
      file: File,
      onRef?: (ref: AttachmentRef) => void,
    ): Promise<AttachmentRef> => {
      // 1. Hash locally — ref is known here, no network yet.
      const result = await preprocess(file);
      // 2. Let the caller record the ref before the bytes are in flight.
      onRef?.(result.ref);
      // 3. Stream the bytes.
      await upload(result);
      return result.ref;
    },
    [preprocess, upload],
  );

  return {
    uploadFile,
    stage,
    progress,
    error,
    // `reserving` is included deliberately: the server reserves the blob
    // between hashing and streaming, and the old enum had no such stage, so
    // callers gating on `isUploading` briefly saw the upload as finished
    // mid-flight (re-enabling buttons over an in-progress transfer).
    isUploading:
      stage === "hashing" || stage === "reserving" || stage === "uploading",
  };
}
