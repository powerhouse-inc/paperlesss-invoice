import type { Status } from "document-models/invoice";

/**
 * Invoice statuses in which the invoice's *content* may still be changed:
 * invoice fields, issuer/payer details, line items, and attachments. Every other
 * status — `ISSUED`, `ACCEPTED`, `CANCELLED`, and the `PAYMENT*` family — is
 * view-only.
 *
 * `REJECTED` is editable because a rejected invoice goes back to the issuer to
 * be corrected and resubmitted.
 *
 * Deliberately **not** covered: status transitions, payments, and accounting
 * tags. Those are how an already-issued invoice progresses toward being paid, so
 * freezing them would strand it.
 *
 * This mirrors the reducer guards in `document-models/invoice/v1/src/reducers/*`.
 * The reducers are the real enforcement — an MCP or GraphQL caller never runs
 * this code — and the UI uses it only to avoid offering edits that would be
 * rejected anyway.
 */
const EDITABLE_STATUSES = [
  "DRAFT",
  "REJECTED",
] as const satisfies readonly Status[];

/** Whether the invoice's content may be edited in this status. */
export function canEditInvoice(status: Status): boolean {
  return (EDITABLE_STATUSES as readonly Status[]).includes(status);
}

/** Shown on hover over any control frozen by the status rule. */
export const INVOICE_LOCKED_MESSAGE =
  "This invoice is read-only. Set the status to DRAFT or REJECTED to edit it.";
