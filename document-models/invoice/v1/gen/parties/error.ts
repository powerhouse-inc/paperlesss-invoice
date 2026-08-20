export type ErrorCode =
  | "IssuerBankNotEditableError"
  | "IssuerNotEditableError"
  | "IssuerWalletNotEditableError"
  | "PayerBankNotEditableError"
  | "PayerNotEditableError"
  | "PayerWalletNotEditableError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class IssuerBankNotEditableError extends Error implements ReducerError {
  errorCode = "IssuerBankNotEditableError" as ErrorCode;
  constructor(message = "IssuerBankNotEditableError") {
    super(message);
  }
}

export class IssuerNotEditableError extends Error implements ReducerError {
  errorCode = "IssuerNotEditableError" as ErrorCode;
  constructor(message = "IssuerNotEditableError") {
    super(message);
  }
}

export class IssuerWalletNotEditableError
  extends Error
  implements ReducerError
{
  errorCode = "IssuerWalletNotEditableError" as ErrorCode;
  constructor(message = "IssuerWalletNotEditableError") {
    super(message);
  }
}

export class PayerBankNotEditableError extends Error implements ReducerError {
  errorCode = "PayerBankNotEditableError" as ErrorCode;
  constructor(message = "PayerBankNotEditableError") {
    super(message);
  }
}

export class PayerNotEditableError extends Error implements ReducerError {
  errorCode = "PayerNotEditableError" as ErrorCode;
  constructor(message = "PayerNotEditableError") {
    super(message);
  }
}

export class PayerWalletNotEditableError extends Error implements ReducerError {
  errorCode = "PayerWalletNotEditableError" as ErrorCode;
  constructor(message = "PayerWalletNotEditableError") {
    super(message);
  }
}

export const errors = {
  EditIssuerBank: { IssuerBankNotEditableError },

  EditIssuer: { IssuerNotEditableError },

  EditIssuerWallet: { IssuerWalletNotEditableError },

  EditPayerBank: { PayerBankNotEditableError },

  EditPayer: { PayerNotEditableError },

  EditPayerWallet: { PayerWalletNotEditableError },
};
