/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddLineItemReceiptInputSchema,
  RemoveLineItemReceiptInputSchema,
  SetBaseInvoiceInputSchema,
  SetTimeTrackingReportInputSchema,
} from "../schema/zod.js";
import type {
  AddLineItemReceiptInput,
  RemoveLineItemReceiptInput,
  SetBaseInvoiceInput,
  SetTimeTrackingReportInput,
} from "../types.js";
import type {
  AddLineItemReceiptAction,
  RemoveLineItemReceiptAction,
  SetBaseInvoiceAction,
  SetTimeTrackingReportAction,
} from "./actions.js";

export const setTimeTrackingReport = (input: SetTimeTrackingReportInput) =>
  createAction<SetTimeTrackingReportAction>(
    "SET_TIME_TRACKING_REPORT",
    { ...input },
    undefined,
    SetTimeTrackingReportInputSchema,
    "global",
  );

export const setBaseInvoice = (input: SetBaseInvoiceInput) =>
  createAction<SetBaseInvoiceAction>(
    "SET_BASE_INVOICE",
    { ...input },
    undefined,
    SetBaseInvoiceInputSchema,
    "global",
  );

export const addLineItemReceipt = (input: AddLineItemReceiptInput) =>
  createAction<AddLineItemReceiptAction>(
    "ADD_LINE_ITEM_RECEIPT",
    { ...input },
    undefined,
    AddLineItemReceiptInputSchema,
    "global",
  );

export const removeLineItemReceipt = (input: RemoveLineItemReceiptInput) =>
  createAction<RemoveLineItemReceiptAction>(
    "REMOVE_LINE_ITEM_RECEIPT",
    { ...input },
    undefined,
    RemoveLineItemReceiptInputSchema,
    "global",
  );
