/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddLineItemReceiptInput,
  RemoveLineItemReceiptInput,
  SetBaseInvoiceInput,
  SetTimeTrackingReportInput,
} from "../types.js";

export type SetTimeTrackingReportAction = Action & {
  type: "SET_TIME_TRACKING_REPORT";
  input: SetTimeTrackingReportInput;
};
export type SetBaseInvoiceAction = Action & {
  type: "SET_BASE_INVOICE";
  input: SetBaseInvoiceInput;
};
export type AddLineItemReceiptAction = Action & {
  type: "ADD_LINE_ITEM_RECEIPT";
  input: AddLineItemReceiptInput;
};
export type RemoveLineItemReceiptAction = Action & {
  type: "REMOVE_LINE_ITEM_RECEIPT";
  input: RemoveLineItemReceiptInput;
};

export type InvoiceAttachmentsAction =
  | SetTimeTrackingReportAction
  | SetBaseInvoiceAction
  | AddLineItemReceiptAction
  | RemoveLineItemReceiptAction;
