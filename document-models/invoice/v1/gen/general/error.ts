export type ErrorCode = "InvoiceNotEditableError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvoiceNotEditableError extends Error implements ReducerError {
  errorCode = "InvoiceNotEditableError" as ErrorCode;
  constructor(message = "InvoiceNotEditableError") {
    super(message);
  }
}

export const errors = {
  EditInvoice: { InvoiceNotEditableError },
};
