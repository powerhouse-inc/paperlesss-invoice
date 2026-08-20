import type { InvoiceAttachmentsOperations } from "document-models/invoice/v1";
import {
  BaseInvoiceNotEditableError,
  ReceiptNotAddableError,
  ReceiptNotRemovableError,
  TimeTrackingReportNotEditableError,
} from "../../gen/attachments/error.js";

export const invoiceAttachmentsOperations: InvoiceAttachmentsOperations = {
  setTimeTrackingReportOperation(state, action) {
    if (!["DRAFT", "REJECTED"].includes(state.status)) {
      throw new TimeTrackingReportNotEditableError(
        `Cannot change the time tracking report while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    state.timeTrackingReport = action.input.timeTrackingReport ?? null;
  },
  setBaseInvoiceOperation(state, action) {
    if (!["DRAFT", "REJECTED"].includes(state.status)) {
      throw new BaseInvoiceNotEditableError(
        `Cannot change the base invoice while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    state.baseInvoice = action.input.baseInvoice ?? null;
  },
  addLineItemReceiptOperation(state, action) {
    if (!["DRAFT", "REJECTED"].includes(state.status)) {
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
    if (!["DRAFT", "REJECTED"].includes(state.status)) {
      throw new ReceiptNotRemovableError(
        `Cannot remove a receipt while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    const item = state.lineItems.find((x) => x.id === action.input.lineItemId);
    if (!item) {
      throw new Error("Line item matching input.lineItemId not found");
    }
    item.receipts = (item.receipts ?? []).filter(
      (r) => r !== action.input.receipt,
    );
  },
};
