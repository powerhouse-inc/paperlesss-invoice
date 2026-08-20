export type ErrorCode =
  | "TimeTrackingReportNotEditableError"
  | "BaseInvoiceNotEditableError"
  | "ReceiptNotAddableError"
  | "ReceiptNotRemovableError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class TimeTrackingReportNotEditableError
  extends Error
  implements ReducerError
{
  errorCode = "TimeTrackingReportNotEditableError" as ErrorCode;
  constructor(message = "TimeTrackingReportNotEditableError") {
    super(message);
  }
}

export class BaseInvoiceNotEditableError extends Error implements ReducerError {
  errorCode = "BaseInvoiceNotEditableError" as ErrorCode;
  constructor(message = "BaseInvoiceNotEditableError") {
    super(message);
  }
}

export class ReceiptNotAddableError extends Error implements ReducerError {
  errorCode = "ReceiptNotAddableError" as ErrorCode;
  constructor(message = "ReceiptNotAddableError") {
    super(message);
  }
}

export class ReceiptNotRemovableError extends Error implements ReducerError {
  errorCode = "ReceiptNotRemovableError" as ErrorCode;
  constructor(message = "ReceiptNotRemovableError") {
    super(message);
  }
}

export const errors = {
  SetTimeTrackingReport: { TimeTrackingReportNotEditableError },

  SetBaseInvoice: { BaseInvoiceNotEditableError },

  AddLineItemReceipt: { ReceiptNotAddableError },

  RemoveLineItemReceipt: { ReceiptNotRemovableError },
};
