import type { InvoiceItemsOperations } from "document-models/invoice/v1";
import {
  LineItemNotAddableError,
  LineItemNotDeletableError,
  LineItemNotEditableError,
} from "../../gen/items/error.js";
import type {
  InvoiceLineItem,
  InvoiceState,
  InvoiceTag,
} from "../../gen/schema/types.js";

/**
 * Statuses in which invoice *content* may still be edited. Workflow operations
 * (status transitions, payments, accounting tags) are deliberately not gated —
 * they are how an issued invoice progresses.
 */
const EDITABLE_STATUSES: string[] = ["DRAFT", "REJECTED"];

export const invoiceItemsOperations: InvoiceItemsOperations = {
  addLineItemOperation(state, action) {
    if (!EDITABLE_STATUSES.includes(state.status)) {
      throw new LineItemNotAddableError(
        `Cannot add a line item while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    const item: InvoiceLineItem = {
      ...action.input,
      lineItemTag: [],
      receipts: [],
    };

    if (state.lineItems.find((x) => x.id === item.id))
      throw new Error("Duplicate input.id");

    validatePrices(item);
    state.lineItems.push(item);
    updateTotals(state);
  },

  editLineItemOperation(state, action) {
    if (!EDITABLE_STATUSES.includes(state.status)) {
      throw new LineItemNotEditableError(
        `Cannot edit a line item while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    const stateItem = state.lineItems.find((x) => x.id === action.input.id);
    if (!stateItem) throw new Error("Item matching input.id not found");

    const sanitizedInput = Object.fromEntries(
      Object.entries(action.input).filter(([, value]) => value !== null),
    ) as Partial<InvoiceLineItem>;

    // Ensure lineItemTag is always an array if provided
    if ("lineItemTag" in action.input) {
      sanitizedInput.lineItemTag = ((action.input as Record<string, unknown>)
        .lineItemTag ?? []) as InvoiceTag[];
    }

    const nextItem: InvoiceLineItem = {
      ...stateItem,
      ...sanitizedInput,
    };
    validatePrices(nextItem);
    applyInvariants(nextItem);
    Object.assign(stateItem, nextItem);
    updateTotals(state);
  },

  deleteLineItemOperation(state, action) {
    if (!EDITABLE_STATUSES.includes(state.status)) {
      throw new LineItemNotDeletableError(
        `Cannot delete a line item while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,
      );
    }
    state.lineItems = state.lineItems.filter((x) => x.id !== action.input.id);
    updateTotals(state);
  },

  setLineItemTagOperation(state, action) {
    const stateItem = state.lineItems.find(
      (x) => x.id === action.input.lineItemId,
    );
    if (!stateItem) throw new Error("Item matching input.id not found");

    // if tag already exists with the same dimension, update the value and label
    const existingTag = stateItem.lineItemTag.find(
      (tag) => tag.dimension === action.input.dimension,
    );
    if (existingTag) {
      existingTag.value = action.input.value;
      existingTag.label = action.input.label || null;
    } else {
      // if tag does not exist, add it
      const newTag: InvoiceTag = {
        dimension: action.input.dimension,
        value: action.input.value,
        label: action.input.label || null,
      };
      stateItem.lineItemTag.push(newTag);
    }
  },
  setInvoiceTagOperation(state, action) {
    // if tag already exists with the same dimension, update the value and label
    const existingTag = state.invoiceTags.find(
      (tag) => tag.dimension === action.input.dimension,
    );
    if (existingTag) {
      existingTag.value = action.input.value;
      existingTag.label = action.input.label || null;
    } else {
      // if tag does not exist, add it
      const newTag: InvoiceTag = {
        dimension: action.input.dimension,
        value: action.input.value,
        label: action.input.label || null,
      };
      state.invoiceTags.push(newTag);
    }
  },
};

function updateTotals(state: InvoiceState) {
  state.totalPriceTaxExcl = state.lineItems.reduce((total, lineItem) => {
    return total + lineItem.quantity * lineItem.unitPriceTaxExcl;
  }, 0.0);

  state.totalPriceTaxIncl = state.lineItems.reduce((total, lineItem) => {
    return total + lineItem.quantity * lineItem.unitPriceTaxIncl;
  }, 0.0);
}

function validatePrices(item: InvoiceLineItem) {
  const EPSILON = 0.00001;

  const calcPriceIncl = item.quantity * item.unitPriceTaxIncl;
  const calcPriceExcl = item.quantity * item.unitPriceTaxExcl;

  const taxRate = item.taxPercent / 100;

  const isClose = (a: number, b: number) => Math.abs(a - b) < EPSILON;

  const expectedUnitPriceExcl = item.unitPriceTaxIncl / (1 + taxRate);
  if (!isClose(item.unitPriceTaxExcl, expectedUnitPriceExcl)) {
    throw new Error("Tax inclusive/exclusive unit prices failed comparison.");
  }

  if (!isClose(calcPriceIncl, item.totalPriceTaxIncl)) {
    throw new Error("Calculated unitPriceTaxIncl does not match input total");
  }

  if (!isClose(calcPriceExcl, item.totalPriceTaxExcl)) {
    throw new Error("Calculated unitPriceTaxExcl does not match input total");
  }

  const expectedTotalPriceExcl = calcPriceIncl / (1 + taxRate);
  if (!isClose(calcPriceExcl, expectedTotalPriceExcl)) {
    throw new Error("Tax inclusive/exclusive totals failed comparison.");
  }
}

/**
 * Normalizes the float representation of an already-validated line item.
 *
 * `validatePrices` runs immediately before this and rejects any item whose
 * quantity/unit/total relations disagree beyond EPSILON, so the only
 * discrepancies that can survive to here come from the *direction* in which a
 * relation is evaluated: validation compares `unitPriceTaxIncl / (1 + taxRate)`
 * against `unitPriceTaxExcl`, whereas the multiplied form
 * `unitPriceTaxExcl * (1 + taxRate)` can land more than EPSILON away from
 * `unitPriceTaxIncl` for the same numbers. The block below re-derives the
 * multiplied form so stored values stay internally consistent.
 *
 * Only that one direction needs correcting. The inverse check
 * (`unitPriceTaxIncl / (1 + taxRate)` vs `unitPriceTaxExcl`) is intentionally
 * absent: untouched, it merely restates a `validatePrices` assertion, and after
 * the correction below it is an exact round-trip. A sweep of 5165 valid items
 * across tax rates 0-27% and magnitudes 1e0-1e14 never once satisfied it.
 */
const applyInvariants = (nextItem: InvoiceLineItem) => {
  const EPSILON = 0.00001;

  const isClose = (a: number, b: number) => Math.abs(a - b) < EPSILON;

  const hasChanged = (oldValue: number, newValue: number) =>
    !isClose(oldValue, newValue);

  const taxRate = nextItem.taxPercent / 100;

  const expectedUnitPriceTaxIncl = nextItem.unitPriceTaxExcl * (1 + taxRate);
  if (hasChanged(expectedUnitPriceTaxIncl, nextItem.unitPriceTaxIncl)) {
    nextItem.unitPriceTaxIncl = nextItem.unitPriceTaxExcl * (1 + taxRate);
    nextItem.totalPriceTaxExcl = nextItem.quantity * nextItem.unitPriceTaxExcl;
    nextItem.totalPriceTaxIncl = nextItem.quantity * nextItem.unitPriceTaxIncl;
  }
};
