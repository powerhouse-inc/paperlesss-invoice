/**
 * Regression guard for the attachment reference read model.
 *
 * `AttachmentSchemaCompiler` builds an "effective schema" per action by
 * concatenating the codegen-injected scalars, the state schemas and every
 * operation schema, then validating the result with `buildASTSchema`. Any
 * duplicate type name in that union makes compilation throw, which surfaces at
 * runtime only as a failed indexing job:
 *
 *   Attachment schema compilation failed for document type "powerhouse/invoice",
 *   version 1, action "SET_BASE_INVOICE": the effective GraphQL schema is invalid
 *
 * Two collisions caused that failure and this test locks both out:
 *  1. the state schema declared `scalar AttachmentRef`, which the compiler
 *     already injects (scalars are exempt from its de-duplication pass);
 *  2. the state schema declared `type Address`, colliding with the injected
 *     reserved `scalar Address` -- hence the rename to `InvoiceAddress`.
 */
import { AttachmentSchemaCompiler } from "@powerhousedao/reactor-attachments";
import type { DocumentModelModule } from "document-model";
import { describe, expect, it } from "vitest";
import { Invoice } from "../../module.js";

/**
 * The reactor holds registered modules with their state parameter widened --
 * `registerModules(...modules: DocumentModelModule<any>[])` and
 * `getModule(): DocumentModelModule<any>` -- and it is that widened value the
 * read model hands to `forModuleAction`. Mirroring the widening here reproduces
 * the production call exactly; passing the concrete
 * `DocumentModelModule<InvoicePHState>` instead fails to type check, because
 * `Reducer` is invariant in its state parameter.
 */
const registeredInvoice: DocumentModelModule<any> = Invoice;

/**
 * The effective schema is shared by every action, so these four
 * AttachmentRef-carrying actions are representative of the whole model.
 */
const ATTACHMENT_ACTIONS = [
  "SET_BASE_INVOICE",
  "SET_TIME_TRACKING_REPORT",
  "ADD_LINE_ITEM_RECEIPT",
  "REMOVE_LINE_ITEM_RECEIPT",
] as const;

describe("attachment schema compilation", () => {
  it.each(ATTACHMENT_ACTIONS)(
    "compiles an attachment extractor for %s",
    (actionType) => {
      const compiler = new AttachmentSchemaCompiler();

      expect(() =>
        compiler.forModuleAction(registeredInvoice, actionType),
      ).not.toThrow();
    },
  );
});
