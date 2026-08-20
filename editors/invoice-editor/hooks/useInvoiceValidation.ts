import { useState, useCallback } from "react";
import type { ValidationResult } from "../validation/validationManager.js";
import validateStatusBeforeContinue from "../validation/validationHandler.js";
import type { Status } from "document-models/invoice";

export interface InvoiceValidations {
  invoice: ValidationResult | null;
  wallet: ValidationResult | null;
  currency: ValidationResult | null;
  iban: ValidationResult | null;
  bic: ValidationResult | null;
  bankName: ValidationResult | null;
  streetAddress: ValidationResult | null;
  city: ValidationResult | null;
  postalCode: ValidationResult | null;
  payerEmail: ValidationResult | null;
  lineItem: ValidationResult | null;
  mainCountry: ValidationResult | null;
  bankCountry: ValidationResult | null;
  routingNumber: ValidationResult | null;
  accountNumber: ValidationResult | null;
  chain: ValidationResult | null;
}

const initialValidations: InvoiceValidations = {
  invoice: null,
  wallet: null,
  currency: null,
  iban: null,
  bic: null,
  bankName: null,
  streetAddress: null,
  city: null,
  postalCode: null,
  payerEmail: null,
  lineItem: null,
  mainCountry: null,
  bankCountry: null,
  routingNumber: null,
  accountNumber: null,
  chain: null,
};

export function useInvoiceValidation(isFiatCurrency: (c: string) => boolean) {
  const [validations, setValidations] = useState<InvoiceValidations>(initialValidations);

  const setField = useCallback((field: keyof InvoiceValidations, value: ValidationResult | null) => {
    setValidations((prev) => ({ ...prev, [field]: value }));
  }, []);

  const validateForStatus = useCallback(
    (newStatus: Status, state: any, toast?: any) => {
      return validateStatusBeforeContinue(
        newStatus,
        state,
        (v) => setField("invoice", v),
        (v) => setField("wallet", v),
        (v) => setField("currency", v),
        (v) => setField("mainCountry", v),
        (v) => setField("bankCountry", v),
        (v) => setField("iban", v),
        (v) => setField("bic", v),
        (v) => setField("accountNumber", v),
        (v) => setField("bankName", v),
        (v) => setField("streetAddress", v),
        (v) => setField("city", v),
        (v) => setField("postalCode", v),
        (v) => setField("payerEmail", v),
        (v) => setField("lineItem", v),
        (v) => setField("routingNumber", v),
        isFiatCurrency,
        (v) => setField("chain", v),
        toast,
      );
    },
    [setField, isFiatCurrency],
  );

  const resetValidations = useCallback(() => {
    setValidations(initialValidations);
  }, []);

  return {
    validations,
    setField,
    validateForStatus,
    resetValidations,
  };
}

export type { ValidationResult };
