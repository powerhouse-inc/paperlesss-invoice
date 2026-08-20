import { generateMock } from "document-model";
import {
  addLineItem,
  AddLineItemInputSchema,
  deleteLineItem,
  editLineItem,
  reducer,
  setInvoiceTag,
  setLineItemTag,
  utils,
} from "document-models/invoice/v1";
import type {
  AddLineItemInput,
  EditLineItemInput,
  InvoiceTag,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

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

/**
 * `EditLineItemInput` does not declare `lineItemTag` (it's not part of the
 * GraphQL input), but `createAction` never overwrites `action.input` with the
 * zod-parsed/stripped result -- it only calls `.parse()` to validate, then
 * passes the *original* object through. So an extra `lineItemTag` property
 * survives all the way to the reducer, which explicitly special-cases it via
 * `"lineItemTag" in action.input`. This type documents that (intentional)
 * extra field for the tests that exercise it.
 */
type EditLineItemInputWithTag = EditLineItemInput & {
  lineItemTag?: InvoiceTag[] | null;
};

describe("ItemsOperations", () => {
  describe("addLineItem", () => {
    it("adds a valid line item and recomputes totals", () => {
      const document = utils.createDocument();
      const item = validLineItem();

      const updated = reducer(document, addLineItem(item));

      expect(updated.state.global.lineItems).toHaveLength(1);
      expect(updated.state.global.lineItems[0]).toMatchObject({
        id: item.id,
        lineItemTag: [],
        receipts: [],
      });
      expect(updated.state.global.totalPriceTaxExcl).toBe(100);
      expect(updated.state.global.totalPriceTaxIncl).toBe(100);
      expect(updated.operations.global[0].error).toBeUndefined();
    });

    it("accumulates totals across multiple line items", () => {
      let document = utils.createDocument();
      const item1 = validLineItem();
      const item2 = validLineItem();

      document = reducer(document, addLineItem(item1));
      document = reducer(document, addLineItem(item2));

      expect(document.state.global.lineItems).toHaveLength(2);
      expect(document.state.global.totalPriceTaxExcl).toBe(200);
      expect(document.state.global.totalPriceTaxIncl).toBe(200);
    });

    it("errors when adding a line item with a duplicate id", () => {
      let document = utils.createDocument();
      const item = validLineItem();

      document = reducer(document, addLineItem(item));
      document = reducer(document, addLineItem(item));

      expect(document.state.global.lineItems).toHaveLength(1);
      expect(document.operations.global[1].error).toBe("Duplicate input.id");
    });

    it("throws when unitPriceTaxExcl does not match unitPriceTaxIncl/(1+taxRate)", () => {
      const document = utils.createDocument();
      const item: AddLineItemInput = {
        ...validLineItem(),
        taxPercent: 0,
        quantity: 2,
        unitPriceTaxExcl: 40,
        unitPriceTaxIncl: 50,
        totalPriceTaxExcl: 80,
        totalPriceTaxIncl: 100,
      };

      const updated = reducer(document, addLineItem(item));

      expect(updated.state.global.lineItems).toHaveLength(0);
      expect(updated.operations.global[0].error).toBe(
        "Tax inclusive/exclusive unit prices failed comparison.",
      );
    });

    it("throws when the calculated tax-inclusive total does not match the input total", () => {
      const document = utils.createDocument();
      const item: AddLineItemInput = {
        ...validLineItem(),
        taxPercent: 0,
        quantity: 2,
        unitPriceTaxExcl: 50,
        unitPriceTaxIncl: 50,
        totalPriceTaxExcl: 100,
        totalPriceTaxIncl: 999,
      };

      const updated = reducer(document, addLineItem(item));

      expect(updated.state.global.lineItems).toHaveLength(0);
      expect(updated.operations.global[0].error).toBe(
        "Calculated unitPriceTaxIncl does not match input total",
      );
    });

    it("throws when the calculated tax-exclusive total does not match the input total", () => {
      const document = utils.createDocument();
      const item: AddLineItemInput = {
        ...validLineItem(),
        taxPercent: 0,
        quantity: 2,
        unitPriceTaxExcl: 50,
        unitPriceTaxIncl: 50,
        totalPriceTaxExcl: 999,
        totalPriceTaxIncl: 100,
      };

      const updated = reducer(document, addLineItem(item));

      expect(updated.state.global.lineItems).toHaveLength(0);
      expect(updated.operations.global[0].error).toBe(
        "Calculated unitPriceTaxExcl does not match input total",
      );
    });

    it("throws when tax inclusive/exclusive totals fail comparison after quantity amplification", () => {
      // unitPriceTaxExcl is off from unitPriceTaxIncl by just under EPSILON
      // (9e-6 < 1e-5), so check 1 passes. A very large quantity amplifies
      // that sub-epsilon per-unit drift into a multi-unit gap that check 4
      // (comparing the two computed *totals*) can detect, even though the
      // per-unit prices individually look "close enough".
      const document = utils.createDocument();
      const quantity = 2_000_000;
      const unitPriceTaxIncl = 10;
      const unitPriceTaxExcl = 10.000009;
      const item: AddLineItemInput = {
        ...validLineItem(),
        taxPercent: 0,
        quantity,
        unitPriceTaxExcl,
        unitPriceTaxIncl,
        totalPriceTaxExcl: quantity * unitPriceTaxExcl,
        totalPriceTaxIncl: quantity * unitPriceTaxIncl,
      };

      const updated = reducer(document, addLineItem(item));

      expect(updated.state.global.lineItems).toHaveLength(0);
      expect(updated.operations.global[0].error).toBe(
        "Tax inclusive/exclusive totals failed comparison.",
      );
    });
  });

  describe("editLineItem", () => {
    it("errors when editing a line item that does not exist", () => {
      const document = utils.createDocument();

      const updated = reducer(document, editLineItem({ id: "missing-id" }));

      expect(updated.operations.global[0].error).toBe(
        "Item matching input.id not found",
      );
    });

    it("edits fields on an existing line item and recomputes totals", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));

      document = reducer(
        document,
        editLineItem({
          id: item.id,
          description: "Updated description",
          quantity: 4,
          unitPriceTaxExcl: 50,
          unitPriceTaxIncl: 50,
          totalPriceTaxExcl: 200,
          totalPriceTaxIncl: 200,
        }),
      );

      expect(document.state.global.lineItems[0].description).toBe(
        "Updated description",
      );
      expect(document.state.global.lineItems[0].quantity).toBe(4);
      expect(document.state.global.totalPriceTaxExcl).toBe(200);
      expect(document.state.global.totalPriceTaxIncl).toBe(200);
      expect(document.operations.global[1].error).toBeUndefined();
    });

    it("filters out explicit null fields, keeping the previous value", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));
      const originalDescription = item.description;

      document = reducer(
        document,
        editLineItem({
          id: item.id,
          description: null,
          currency: null,
        }),
      );

      expect(document.state.global.lineItems[0].description).toBe(
        originalDescription,
      );
      expect(document.state.global.lineItems[0].currency).toBe(item.currency);
      expect(document.operations.global[1].error).toBeUndefined();
    });

    it("sets lineItemTag from an extra input field when provided as an array", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));

      const input: EditLineItemInputWithTag = {
        id: item.id,
        lineItemTag: [{ dimension: "region", value: "us", label: "US" }],
      };
      document = reducer(document, editLineItem(input));

      expect(document.state.global.lineItems[0].lineItemTag).toEqual([
        { dimension: "region", value: "us", label: "US" },
      ]);
    });

    it("normalizes a null lineItemTag extra field to an empty array", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));

      // first give it a non-empty tag list
      document = reducer(
        document,
        editLineItem({
          id: item.id,
          lineItemTag: [{ dimension: "region", value: "us", label: null }],
        } as EditLineItemInputWithTag),
      );
      expect(document.state.global.lineItems[0].lineItemTag).toHaveLength(1);

      // then explicitly clear it via `lineItemTag: null`
      document = reducer(
        document,
        editLineItem({
          id: item.id,
          lineItemTag: null,
        } as EditLineItemInputWithTag),
      );

      expect(document.state.global.lineItems[0].lineItemTag).toEqual([]);
    });

    it("recomputes unitPriceTaxIncl (applyInvariants branch: multiplication-order mismatch) for a high tax rate near-epsilon input", () => {
      // Reaches the reachable "multiplication order" invariant branch:
      // unitPriceTaxExcl * (1 + taxRate) vs unitPriceTaxIncl. validatePrices
      // passes because the mismatch (9e-6) is under EPSILON at quantity 1,
      // but a large taxRate (1000%) amplifies it past EPSILON once
      // multiplied by (1 + taxRate) inside applyInvariants.
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));

      document = reducer(
        document,
        editLineItem({
          id: item.id,
          taxPercent: 1000,
          quantity: 1,
          unitPriceTaxExcl: 10.000009,
          unitPriceTaxIncl: 110,
          totalPriceTaxExcl: 10.000009,
          totalPriceTaxIncl: 110,
        }),
      );

      expect(document.operations.global[1].error).toBeUndefined();
      const editedItem = document.state.global.lineItems[0];
      // applyInvariants recomputed unitPriceTaxIncl from
      // unitPriceTaxExcl * (1 + taxRate) = 10.000009 * 11
      expect(editedItem.unitPriceTaxIncl).toBeCloseTo(110.000099, 6);
      expect(editedItem.totalPriceTaxIncl).toBeCloseTo(110.000099, 6);
      expect(editedItem.totalPriceTaxExcl).toBeCloseTo(10.000009, 6);
    });
  });

  describe("deleteLineItem", () => {
    it("removes a line item and recomputes totals", () => {
      let document = utils.createDocument();
      const item1 = validLineItem();
      const item2 = validLineItem();
      document = reducer(document, addLineItem(item1));
      document = reducer(document, addLineItem(item2));

      document = reducer(document, deleteLineItem({ id: item1.id }));

      expect(document.state.global.lineItems).toHaveLength(1);
      expect(document.state.global.lineItems[0].id).toBe(item2.id);
      expect(document.state.global.totalPriceTaxExcl).toBe(100);
      expect(document.state.global.totalPriceTaxIncl).toBe(100);
    });

    it("is a no-op (no error) when deleting an id that does not exist", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));

      document = reducer(document, deleteLineItem({ id: "missing-id" }));

      expect(document.state.global.lineItems).toHaveLength(1);
      expect(document.operations.global[1].error).toBeUndefined();
    });
  });

  describe("setLineItemTag", () => {
    it("errors when the target line item does not exist", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        setLineItemTag({
          lineItemId: "missing-id",
          dimension: "region",
          value: "us",
        }),
      );

      expect(updated.operations.global[0].error).toBe(
        "Item matching input.id not found",
      );
    });

    it("creates a new tag when no tag with that dimension exists yet, defaulting label to null", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));

      document = reducer(
        document,
        setLineItemTag({
          lineItemId: item.id,
          dimension: "region",
          value: "us",
        }),
      );

      expect(document.state.global.lineItems[0].lineItemTag).toEqual([
        { dimension: "region", value: "us", label: null },
      ]);
    });

    it("creates an additional tag alongside an existing one of a different dimension", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));
      document = reducer(
        document,
        setLineItemTag({
          lineItemId: item.id,
          dimension: "region",
          value: "us",
          label: "US",
        }),
      );

      document = reducer(
        document,
        setLineItemTag({
          lineItemId: item.id,
          dimension: "department",
          value: "sales",
          label: "Sales",
        }),
      );

      expect(document.state.global.lineItems[0].lineItemTag).toEqual([
        { dimension: "region", value: "us", label: "US" },
        { dimension: "department", value: "sales", label: "Sales" },
      ]);
    });

    it("updates value and label of an existing tag with the same dimension", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));
      document = reducer(
        document,
        setLineItemTag({
          lineItemId: item.id,
          dimension: "region",
          value: "us",
          label: "US",
        }),
      );

      document = reducer(
        document,
        setLineItemTag({
          lineItemId: item.id,
          dimension: "region",
          value: "eu",
          label: "Europe",
        }),
      );

      expect(document.state.global.lineItems[0].lineItemTag).toEqual([
        { dimension: "region", value: "eu", label: "Europe" },
      ]);
    });

    it("resets label to null on update when label is omitted", () => {
      let document = utils.createDocument();
      const item = validLineItem();
      document = reducer(document, addLineItem(item));
      document = reducer(
        document,
        setLineItemTag({
          lineItemId: item.id,
          dimension: "region",
          value: "us",
          label: "US",
        }),
      );

      document = reducer(
        document,
        setLineItemTag({
          lineItemId: item.id,
          dimension: "region",
          value: "eu",
        }),
      );

      expect(document.state.global.lineItems[0].lineItemTag).toEqual([
        { dimension: "region", value: "eu", label: null },
      ]);
    });
  });

  describe("setInvoiceTag", () => {
    it("creates a new invoice tag when no tag with that dimension exists yet", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        setInvoiceTag({ dimension: "project", value: "alpha", label: "Alpha" }),
      );

      expect(updated.state.global.invoiceTags).toEqual([
        { dimension: "project", value: "alpha", label: "Alpha" },
      ]);
    });

    it("defaults label to null when omitted on create", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        setInvoiceTag({ dimension: "project", value: "alpha" }),
      );

      expect(updated.state.global.invoiceTags).toEqual([
        { dimension: "project", value: "alpha", label: null },
      ]);
    });

    it("creates an additional tag alongside an existing one of a different dimension", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        setInvoiceTag({ dimension: "project", value: "alpha", label: "Alpha" }),
      );

      document = reducer(
        document,
        setInvoiceTag({ dimension: "client", value: "acme", label: "Acme" }),
      );

      expect(document.state.global.invoiceTags).toEqual([
        { dimension: "project", value: "alpha", label: "Alpha" },
        { dimension: "client", value: "acme", label: "Acme" },
      ]);
    });

    it("updates value and label of an existing invoice tag with the same dimension", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        setInvoiceTag({ dimension: "project", value: "alpha", label: "Alpha" }),
      );

      document = reducer(
        document,
        setInvoiceTag({ dimension: "project", value: "beta", label: "Beta" }),
      );

      expect(document.state.global.invoiceTags).toEqual([
        { dimension: "project", value: "beta", label: "Beta" },
      ]);
    });

    it("resets label to null on update when label is omitted", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        setInvoiceTag({ dimension: "project", value: "alpha", label: "Alpha" }),
      );

      document = reducer(
        document,
        setInvoiceTag({ dimension: "project", value: "beta" }),
      );

      expect(document.state.global.invoiceTags).toEqual([
        { dimension: "project", value: "beta", label: null },
      ]);
    });
  });
});
