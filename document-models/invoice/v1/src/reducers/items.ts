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
    // Normalise before storing, exactly as editLineItem does. validatePrices
    // now accepts cent-rounded input, so without this an added item could
    // persist values that disagree in the last decimal place.
    applyInvariants(item);
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

/**
 * Largest error a single money value can legitimately carry once it has been
 * rounded to cents, which is how invoices — and the humans and LLMs reading
 * them — state prices. Both sides of each comparison may be independently
 * rounded, so the budget is a full cent rather than half of one.
 */
const CENT = 0.01;

/**
 * Tolerance for comparing two money values.
 *
 * `units` is the quantity the per-unit rounding error is multiplied across: a
 * unit price rounded by up to a cent becomes a line total off by up to a cent
 * *per unit*, so the tolerance has to scale with quantity or high-quantity
 * lines fail for arithmetic that is in fact correct.
 */
const moneyTolerance = (units: number) => CENT * Math.max(1, Math.abs(units));

/**
 * Rejects a line item whose quantity/unit/total relations genuinely disagree.
 *
 * Tolerances are in cents, not floating-point epsilons. An earlier version
 * compared with EPSILON = 0.00001, which is six orders of magnitude tighter
 * than the rounding real invoices carry, so it rejected ordinary data: at 21%
 * tax a unit price of 19.99 has an inclusive price of 24.19, and 24.19 / 1.21
 * is 19.9917 — 8.3e-4 away from 19.99, i.e. 83x that tolerance. Only prices
 * whose inclusive value divided back exactly survived, which in practice meant
 * only zero-tax lines. Because the ingest path dispatches without inspecting
 * the result, those rejections were invisible: an extraction offering ten line
 * items would store two and report success.
 *
 * Being liberal here is safe because `applyInvariants` runs immediately after
 * and re-derives the stored values exactly, so accepted-but-rounded input is
 * normalised rather than persisted as-is.
 */
function validatePrices(item: InvoiceLineItem) {
  const taxRate = item.taxPercent / 100;

  const calcPriceIncl = item.quantity * item.unitPriceTaxIncl;
  const calcPriceExcl = item.quantity * item.unitPriceTaxExcl;

  const unitTolerance = moneyTolerance(1);
  const totalTolerance = moneyTolerance(item.quantity);

  const differs = (a: number, b: number, tolerance: number) =>
    Math.abs(a - b) > tolerance;

  if (
    differs(
      item.unitPriceTaxExcl,
      item.unitPriceTaxIncl / (1 + taxRate),
      unitTolerance,
    )
  ) {
    throw new Error("Tax inclusive/exclusive unit prices failed comparison.");
  }

  if (differs(calcPriceIncl, item.totalPriceTaxIncl, totalTolerance)) {
    throw new Error("Calculated unitPriceTaxIncl does not match input total");
  }

  if (differs(calcPriceExcl, item.totalPriceTaxExcl, totalTolerance)) {
    throw new Error("Calculated unitPriceTaxExcl does not match input total");
  }

  // There is deliberately no fourth check comparing the two *totals* against
  // each other. `qty * excl` vs `(qty * incl) / (1 + taxRate)` differs by
  // `qty * |excl - incl / (1 + taxRate)|`, and its tolerance is `CENT * qty`,
  // so it fails on exactly the same condition as the unit-price check above —
  // it can never fire once that has passed. The old code had one because a
  // fixed absolute epsilon made the multiplied form more sensitive than the
  // per-unit form; with a per-unit tolerance that asymmetry is gone.
}

/**
 * Normalises the float representation of an already-validated line item.
 *
 * `validatePrices` runs immediately before this and accepts money values that
 * have been rounded to cents, so the values arriving here may legitimately
 * disagree in the last decimal place. This re-derives the inclusive unit price
 * and both totals from `unitPriceTaxExcl` and `taxPercent`, which are the two
 * fields an invoice states most reliably, so what gets stored is internally
 * consistent regardless of how the input was rounded.
 *
 * Only that one direction is corrected. The inverse relation
 * (`unitPriceTaxIncl / (1 + taxRate)` vs `unitPriceTaxExcl`) needs no fixing:
 * after the re-derivation below it is an exact round-trip.
 *
 * Runs on both add and edit — an item that skipped normalisation on the way in
 * would carry the input's rounding into state and could then fail a later
 * comparison against its own stored values.
 */
const applyInvariants = (nextItem: InvoiceLineItem) => {
  // Unconditional rather than "only if it looks changed". A conditional guard
  // needs a threshold, and any threshold lets drift smaller than itself survive
  // into state — which is how a 9e-6 per-unit discrepancy could persist and
  // then show up as a multi-unit gap once multiplied by a large quantity.
  // Re-deriving every time means stored values are always exactly consistent
  // with `unitPriceTaxExcl` and `taxPercent`, whatever rounding the input had.
  const taxRate = nextItem.taxPercent / 100;

  nextItem.unitPriceTaxIncl = nextItem.unitPriceTaxExcl * (1 + taxRate);
  nextItem.totalPriceTaxExcl = nextItem.quantity * nextItem.unitPriceTaxExcl;
  nextItem.totalPriceTaxIncl = nextItem.quantity * nextItem.unitPriceTaxIncl;
};
