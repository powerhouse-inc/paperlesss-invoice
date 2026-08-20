export type ErrorCode =
  | "LineItemNotAddableError"
  | "LineItemNotDeletableError"
  | "LineItemNotEditableError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class LineItemNotAddableError extends Error implements ReducerError {
  errorCode = "LineItemNotAddableError" as ErrorCode;
  constructor(message = "LineItemNotAddableError") {
    super(message);
  }
}

export class LineItemNotDeletableError extends Error implements ReducerError {
  errorCode = "LineItemNotDeletableError" as ErrorCode;
  constructor(message = "LineItemNotDeletableError") {
    super(message);
  }
}

export class LineItemNotEditableError extends Error implements ReducerError {
  errorCode = "LineItemNotEditableError" as ErrorCode;
  constructor(message = "LineItemNotEditableError") {
    super(message);
  }
}

export const errors = {
  AddLineItem: { LineItemNotAddableError },

  DeleteLineItem: { LineItemNotDeletableError },

  EditLineItem: { LineItemNotEditableError },
};
