import { generateMock } from "document-model";
import {
  addLineItemReceipt,
  AddLineItemReceiptInputSchema,
  isInvoiceDocument,
  reducer,
  removeLineItemReceipt,
  RemoveLineItemReceiptInputSchema,
  setBaseInvoice,
  SetBaseInvoiceInputSchema,
  setTimeTrackingReport,
  SetTimeTrackingReportInputSchema,
  utils,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

describe("AttachmentsOperations", () => {
  it("should handle setTimeTrackingReport operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetTimeTrackingReportInputSchema(), {
      timeTrackingReport:
        "attachment://v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    const updatedDocument = reducer(document, setTimeTrackingReport(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_TIME_TRACKING_REPORT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setBaseInvoice operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetBaseInvoiceInputSchema(), {
      baseInvoice:
        "attachment://v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    const updatedDocument = reducer(document, setBaseInvoice(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_BASE_INVOICE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle addLineItemReceipt operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddLineItemReceiptInputSchema());

    const updatedDocument = reducer(document, addLineItemReceipt(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ADD_LINE_ITEM_RECEIPT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeLineItemReceipt operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveLineItemReceiptInputSchema());

    const updatedDocument = reducer(document, removeLineItemReceipt(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_LINE_ITEM_RECEIPT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
