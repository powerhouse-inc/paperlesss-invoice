/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type {
  AddLineItemReceiptAction,
  RemoveLineItemReceiptAction,
  SetBaseInvoiceAction,
  SetTimeTrackingReportAction,
} from "./actions.js";

export interface InvoiceAttachmentsOperations {
  setTimeTrackingReportOperation: (
    state: InvoiceGlobalState,
    action: SetTimeTrackingReportAction,
    dispatch?: SignalDispatch,
  ) => void;
  setBaseInvoiceOperation: (
    state: InvoiceGlobalState,
    action: SetBaseInvoiceAction,
    dispatch?: SignalDispatch,
  ) => void;
  addLineItemReceiptOperation: (
    state: InvoiceGlobalState,
    action: AddLineItemReceiptAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeLineItemReceiptOperation: (
    state: InvoiceGlobalState,
    action: RemoveLineItemReceiptAction,
    dispatch?: SignalDispatch,
  ) => void;
}
