import { createRemoteAttachmentService } from "@powerhousedao/reactor-attachments/client";
import { setAttachmentService } from "@powerhousedao/reactor-browser";
import { getSwitchboardOrigin } from "./graphql.js";

/**
 * Connect only constructs an attachment service when a **default drive** is
 * configured, because it scrapes the Switchboard origin out of that drive's URL
 * (`new URL(defaultDrives[0].url).origin`). A document living in a local,
 * browser-only drive therefore gets no attachment service at all, and the first
 * upload fails with "AttachmentClient not available".
 *
 * The attachment store is drive-independent — `createRemoteAttachmentService`
 * takes only an origin, and the API it talks to (`<origin>/attachments/*`) is a
 * flat content-addressed store with no notion of drives. So we can point a
 * service at the paired Switchboard ourselves and keep the document local.
 *
 * Idempotent, and never overrides a service Connect already provided.
 */

let installed = false;

export function ensureAttachmentService(): void {
  if (installed || typeof window === "undefined") return;

  // Connect (or a previous call) already wired one up — leave it alone.
  if (window.ph?.attachmentService) {
    installed = true;
    return;
  }

  setAttachmentService(
    createRemoteAttachmentService({
      remoteUrl: getSwitchboardOrigin(),
      // Resolved per request, so a Renown login that completes after this call
      // is still picked up. Returning undefined sends no Authorization header,
      // which is what a Switchboard with auth disabled expects.
      jwtHandler: async () => {
        const renown = window.ph?.renown;
        if (!renown?.user) return undefined;
        return renown.getBearerToken({ expiresIn: 10 });
      },
    }),
  );

  installed = true;
}
