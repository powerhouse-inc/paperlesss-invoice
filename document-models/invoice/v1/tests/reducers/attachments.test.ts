import { generateMock } from "document-model";
import {
  addLineItem,
  AddLineItemInputSchema,
  addLineItemReceipt,
  reducer,
  removeLineItemReceipt,
  setBaseInvoice,
  SetBaseInvoiceInputSchema,
  setTimeTrackingReport,
  utils,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

/**
 * Synthetic attachment refs standing in for uploaded PDFs.
 *
 * A real ref is `attachment://v<version>:<content-hash>`, produced by the
 * attachment service (`preprocess` → `reserve` → `send`) when a file is
 * uploaded. The reducer never sees the file — it stores the ref as an opaque
 * string — so these sha256-shaped fixtures document the expected shape without
 * needing a real upload. (An end-to-end PDF round-trip belongs in an
 * attachment-client/editor integration test, not this pure-reducer suite.)
 */
const BASE_INVOICE_PDF =
  "attachment://v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;
const TIME_REPORT_PDF =
  "attachment://v1:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" as const;
const RECEIPT_1_PDF =
  "attachment://v1:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae" as const;
const RECEIPT_2_PDF =
  "attachment://v1:fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9" as const;

/**
 * A line item with tax-consistent prices so `addLineItem`'s `validatePrices`
 * passes (a bare `generateMock` produces random prices that fail validation and
 * throw, leaving `lineItems` empty).
 */
function validLineItem() {
  const item = generateMock(AddLineItemInputSchema());
  item.taxPercent = 0;
  item.quantity = 2;
  item.unitPriceTaxExcl = 50;
  item.unitPriceTaxIncl = 50;
  item.totalPriceTaxExcl = 100;
  item.totalPriceTaxIncl = 100;
  return item;
}

describe("AttachmentsOperations", () => {
  it("sets the time tracking report", () => {
    const document = utils.createDocument();

    const updated = reducer(
      document,
      setTimeTrackingReport({ timeTrackingReport: TIME_REPORT_PDF }),
    );

    expect(updated.state.global.timeTrackingReport).toBe(TIME_REPORT_PDF);
    expect(updated.operations.global[0].action.type).toBe(
      "SET_TIME_TRACKING_REPORT",
    );
    expect(updated.operations.global[0].error).toBeUndefined();
  });

  it("clears the time tracking report with null", () => {
    let document = utils.createDocument();
    document = reducer(
      document,
      setTimeTrackingReport({ timeTrackingReport: TIME_REPORT_PDF }),
    );

    document = reducer(
      document,
      setTimeTrackingReport({ timeTrackingReport: null }),
    );

    expect(document.state.global.timeTrackingReport).toBeNull();
  });

  it("sets the base invoice", () => {
    const document = utils.createDocument();

    const updated = reducer(
      document,
      setBaseInvoice({ baseInvoice: BASE_INVOICE_PDF }),
    );

    expect(updated.state.global.baseInvoice).toBe(BASE_INVOICE_PDF);
    expect(updated.operations.global[0].action.type).toBe("SET_BASE_INVOICE");
  });

  it("clears the base invoice with null", () => {
    let document = utils.createDocument();
    document = reducer(document, setBaseInvoice({ baseInvoice: BASE_INVOICE_PDF }));

    document = reducer(document, setBaseInvoice({ baseInvoice: null }));

    expect(document.state.global.baseInvoice).toBeNull();
  });

  it("adds receipts to a line item and ignores duplicates", () => {
    let document = utils.createDocument();
    const item = validLineItem();
    document = reducer(document, addLineItem(item));

    document = reducer(
      document,
      addLineItemReceipt({ lineItemId: item.id, receipt: RECEIPT_1_PDF }),
    );
    // duplicate is ignored
    document = reducer(
      document,
      addLineItemReceipt({ lineItemId: item.id, receipt: RECEIPT_1_PDF }),
    );
    document = reducer(
      document,
      addLineItemReceipt({ lineItemId: item.id, receipt: RECEIPT_2_PDF }),
    );

    expect(document.state.global.lineItems[0].receipts).toEqual([
      RECEIPT_1_PDF,
      RECEIPT_2_PDF,
    ]);
  });

  it("removes a specific receipt from a line item", () => {
    let document = utils.createDocument();
    const item = validLineItem();
    document = reducer(document, addLineItem(item));
    document = reducer(
      document,
      addLineItemReceipt({ lineItemId: item.id, receipt: RECEIPT_1_PDF }),
    );
    document = reducer(
      document,
      addLineItemReceipt({ lineItemId: item.id, receipt: RECEIPT_2_PDF }),
    );

    document = reducer(
      document,
      removeLineItemReceipt({ lineItemId: item.id, receipt: RECEIPT_1_PDF }),
    );

    expect(document.state.global.lineItems[0].receipts).toEqual([RECEIPT_2_PDF]);
  });

  it("errors when adding a receipt to a missing line item", () => {
    const document = utils.createDocument();

    const updated = reducer(
      document,
      addLineItemReceipt({ lineItemId: "missing-id", receipt: RECEIPT_1_PDF }),
    );

    expect(updated.operations.global[0].error).toBe(
      "Line item matching input.lineItemId not found",
    );
  });

  it("errors when removing a receipt from a missing line item", () => {
    const document = utils.createDocument();

    const updated = reducer(
      document,
      removeLineItemReceipt({ lineItemId: "missing-id", receipt: RECEIPT_1_PDF }),
    );

    expect(updated.operations.global[0].error).toBe(
      "Line item matching input.lineItemId not found",
    );
  });

  it("validates the AttachmentRef format via generated zod", () => {
    const baseSchema = SetBaseInvoiceInputSchema();
    // a well-formed ref and null (optional field) are accepted
    expect(baseSchema.safeParse({ baseInvoice: BASE_INVOICE_PDF }).success).toBe(
      true,
    );
    expect(baseSchema.safeParse({ baseInvoice: null }).success).toBe(true);
    // plain filenames / URLs are NOT valid attachment refs
    expect(baseSchema.safeParse({ baseInvoice: "invoice.pdf" }).success).toBe(
      false,
    );
    expect(
      baseSchema.safeParse({ baseInvoice: "https://x.com/a.pdf" }).success,
    ).toBe(false);
  });
});
