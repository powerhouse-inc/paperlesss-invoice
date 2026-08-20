import type { InvoiceAttachmentsOperations } from "document-models/invoice/v1";
import {
  BaseInvoiceNotEditableError,
  ReceiptNotAddableError,
  ReceiptNotRemovableError,
  TimeTrackingReportNotEditableError,
} from "../../gen/attachments/error.js";

/**
 * Statuses in which invoice *content* may still be edited. Workflow operations
 * (status transitions, payments, accounting tags) are deliberately not gated —
 * they are how an issued invoice progresses.
 */
const EDITABLE_STATUSES: string[] = ["DRAFT", "REJECTED"];

export const invoiceAttachmentsOperations: InvoiceAttachmentsOperations = {
  setTimeTrackingReportOperation(state, action) {
    if (!EDITABLE_STATUSES.includes(state.status)) {
      throw new TimeTrackingReportNotEditableError(
        `Cannot change the time tracking report while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    state.timeTrackingReport = action.input.timeTrackingReport ?? null;
  },
  setBaseInvoiceOperation(state, action) {
    if (!EDITABLE_STATUSES.includes(state.status)) {
      throw new BaseInvoiceNotEditableError(
        `Cannot change the base invoice while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    state.baseInvoice = action.input.baseInvoice ?? null;
  },
  addLineItemReceiptOperation(state, action) {
    if (!EDITABLE_STATUSES.includes(state.status)) {
      throw new ReceiptNotAddableError(
        `Cannot attach a receipt while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    const item = state.lineItems.find((x) => x.id === action.input.lineItemId);
    if (!item) {
      throw new Error("Line item matching input.lineItemId not found");
    }
    if (!item.receipts.includes(action.input.receipt)) {
      item.receipts.push(action.input.receipt);
    }
  },
  removeLineItemReceiptOperation(state, action) {
    if (!EDITABLE_STATUSES.includes(state.status)) {
      throw new ReceiptNotRemovableError(
        `Cannot remove a receipt while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    const item = state.lineItems.find((x) => x.id === action.input.lineItemId);
    if (!item) {
      throw new Error("Line item matching input.lineItemId not found");
    }
    item.receipts = item.receipts.filter((r) => r !== action.input.receipt);
  },
};
