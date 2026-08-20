import {
  addLineItem,
  addLineItemReceipt,
  addPayment,
  deleteLineItem,
  editInvoice,
  editIssuer,
  editIssuerBank,
  editIssuerWallet,
  editLineItem,
  editPayer,
  editPayerBank,
  editPayerWallet,
  editPaymentData,
  editStatus,
  reducer,
  removeLineItemReceipt,
  setBaseInvoice,
  setInvoiceTag,
  setLineItemTag,
  setTimeTrackingReport,
  utils,
} from "document-models/invoice/v1";
import type {
  InvoiceAction,
  InvoiceDocument,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

/**
 * Invoice *content* may only be edited while the invoice is DRAFT or REJECTED.
 * Every other status freezes it. Workflow operations — status transitions,
 * payments, and accounting tags — are deliberately exempt, because they are how
 * an already-issued invoice progresses toward being paid.
 *
 * These reducer-level guards are the real enforcement; the editor's disabled
 * inputs are only a convenience, and an MCP or GraphQL caller bypasses them.
 */

const RECEIPT =
  "attachment://v1:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae" as const;
const BASE_INVOICE =
  "attachment://v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;
const TIME_REPORT =
  "attachment://v1:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" as const;

/** Internally consistent line item: 2 x 100 @ 10% tax. */
const LINE_ITEM = {
  id: "line-1",
  description: "Consulting",
  currency: "USD",
  quantity: 2,
  taxPercent: 10,
  unitPriceTaxExcl: 100,
  unitPriceTaxIncl: 110,
  totalPriceTaxExcl: 200,
  totalPriceTaxIncl: 220,
};

/**
 * Error recorded by the most recent operation. A throwing reducer still appends
 * its operation, with the message on `.error` and the state left untouched —
 * reading the last entry avoids brittle index arithmetic as scenarios grow.
 */
function lastError(document: InvoiceDocument): string | undefined {
  const ops = document.operations.global;
  return ops[ops.length - 1]?.error;
}

/** A document parked in a status that forbids content edits. */
function frozenDocument(): InvoiceDocument {
  // DRAFT -> CANCELLED is the one exit that needs no issuer wallet configured.
  return reducer(utils.createDocument(), editStatus({ status: "CANCELLED" }));
}

describe("content edits are frozen outside DRAFT / REJECTED", () => {
  const cases: Array<{
    name: string;
    action: InvoiceAction;
    expected: string;
  }> = [
    {
      name: "EDIT_INVOICE",
      action: editInvoice({ invoiceNo: "INV-2" }),
      expected: "Cannot edit invoice details",
    },
    {
      name: "EDIT_ISSUER",
      action: editIssuer({ name: "New Issuer" }),
      expected: "Cannot edit the issuer",
    },
    {
      name: "EDIT_ISSUER_BANK",
      action: editIssuerBank({ name: "Bank", accountNum: "1" }),
      expected: "Cannot edit the issuer bank details",
    },
    {
      name: "EDIT_ISSUER_WALLET",
      action: editIssuerWallet({ address: "0xabc", chainName: "eth" }),
      expected: "Cannot edit the issuer wallet",
    },
    {
      name: "EDIT_PAYER",
      action: editPayer({ name: "New Payer" }),
      expected: "Cannot edit the payer",
    },
    {
      name: "EDIT_PAYER_BANK",
      action: editPayerBank({ name: "Bank", accountNum: "1" }),
      expected: "Cannot edit the payer bank details",
    },
    {
      name: "EDIT_PAYER_WALLET",
      action: editPayerWallet({ address: "0xdef", chainName: "eth" }),
      expected: "Cannot edit the payer wallet",
    },
    {
      name: "ADD_LINE_ITEM",
      action: addLineItem(LINE_ITEM),
      expected: "Cannot add a line item",
    },
    {
      name: "EDIT_LINE_ITEM",
      action: editLineItem({ id: LINE_ITEM.id, description: "Changed" }),
      expected: "Cannot edit a line item",
    },
    {
      name: "DELETE_LINE_ITEM",
      action: deleteLineItem({ id: LINE_ITEM.id }),
      expected: "Cannot delete a line item",
    },
    {
      name: "SET_BASE_INVOICE",
      action: setBaseInvoice({ baseInvoice: BASE_INVOICE }),
      expected: "Cannot change the base invoice",
    },
    {
      name: "SET_TIME_TRACKING_REPORT",
      action: setTimeTrackingReport({ timeTrackingReport: TIME_REPORT }),
      expected: "Cannot change the time tracking report",
    },
    {
      name: "ADD_LINE_ITEM_RECEIPT",
      action: addLineItemReceipt({
        lineItemId: LINE_ITEM.id,
        receipt: RECEIPT,
      }),
      expected: "Cannot attach a receipt",
    },
    {
      name: "REMOVE_LINE_ITEM_RECEIPT",
      action: removeLineItemReceipt({
        lineItemId: LINE_ITEM.id,
        receipt: RECEIPT,
      }),
      expected: "Cannot remove a receipt",
    },
  ];

  it.each(cases)("rejects $name while CANCELLED", ({ action, expected }) => {
    const frozen = frozenDocument();
    const before = JSON.stringify(frozen.state.global);

    const after = reducer(frozen, action);

    expect(lastError(after)).toContain(expected);
    expect(lastError(after)).toContain("only DRAFT and REJECTED");
    // A rejected operation must leave the state exactly as it was.
    expect(JSON.stringify(after.state.global)).toBe(before);
  });

  it("names the offending status in the message", () => {
    const after = reducer(frozenDocument(), editInvoice({ invoiceNo: "X" }));
    expect(lastError(after)).toContain("CANCELLED");
  });
});

describe("content edits are permitted in the editable statuses", () => {
  it("allows edits while DRAFT", () => {
    let document = utils.createDocument();
    document = reducer(document, editInvoice({ invoiceNo: "INV-1" }));
    document = reducer(document, addLineItem(LINE_ITEM));
    document = reducer(document, setBaseInvoice({ baseInvoice: BASE_INVOICE }));

    expect(lastError(document)).toBeUndefined();
    expect(document.state.global.invoiceNo).toBe("INV-1");
    expect(document.state.global.lineItems).toHaveLength(1);
    expect(document.state.global.baseInvoice).toBe(BASE_INVOICE);
  });

  it("allows edits while REJECTED, so a rejected invoice can be corrected", () => {
    let document = utils.createDocument();
    // Leaving DRAFT for anything but CANCELLED requires a configured issuer
    // wallet (see editStatusOperation), so set one up first.
    document = reducer(
      document,
      editIssuerWallet({ address: "0xabc", chainName: "eth" }),
    );
    document = reducer(document, editStatus({ status: "REJECTED" }));
    expect(document.state.global.status).toBe("REJECTED");

    document = reducer(document, addLineItem(LINE_ITEM));
    document = reducer(
      document,
      addLineItemReceipt({ lineItemId: LINE_ITEM.id, receipt: RECEIPT }),
    );
    document = reducer(document, editInvoice({ invoiceNo: "INV-FIXED" }));

    expect(lastError(document)).toBeUndefined();
    expect(document.state.global.status).toBe("REJECTED");
    expect(document.state.global.invoiceNo).toBe("INV-FIXED");
    expect(document.state.global.lineItems[0].receipts).toEqual([RECEIPT]);
  });
});

describe("workflow operations stay available in a frozen status", () => {
  /**
   * Guarding these would strand an issued invoice: it could never be paid,
   * reconciled, or tagged for accounting. This test is the tripwire against
   * widening the content gate onto them.
   */
  it("still accepts payments, status changes and accounting tags", () => {
    // Seed a line item while still editable, then freeze the invoice.
    let document = reducer(utils.createDocument(), addLineItem(LINE_ITEM));
    document = reducer(document, editStatus({ status: "CANCELLED" }));

    document = reducer(document, addPayment({ id: "pay-1", confirmed: false }));
    expect(lastError(document)).toBeUndefined();

    document = reducer(
      document,
      editPaymentData({ id: "pay-1", confirmed: true }),
    );
    expect(lastError(document)).toBeUndefined();

    document = reducer(
      document,
      setInvoiceTag({ dimension: "expense-account", value: "6000" }),
    );
    expect(lastError(document)).toBeUndefined();

    document = reducer(
      document,
      setLineItemTag({
        lineItemId: LINE_ITEM.id,
        dimension: "expense-account",
        value: "6000",
      }),
    );
    expect(lastError(document)).toBeUndefined();

    expect(document.state.global.payments).toHaveLength(1);
    expect(document.state.global.payments[0].confirmed).toBe(true);
    expect(document.state.global.invoiceTags).toHaveLength(1);
    expect(document.state.global.lineItems[0].lineItemTag).toHaveLength(1);
  });
});
