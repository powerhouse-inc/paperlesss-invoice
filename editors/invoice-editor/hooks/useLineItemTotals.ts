import { useMemo, useState, useCallback } from "react";
import type { InvoiceLineItem } from "document-models/invoice";
import {
  calculateLineItemsTotal,
  type EditingItemOverlay,
} from "../utils/utils.js";

/**
 * Custom hook to manage live line item totals with editing overlay support.
 * Extracted per React 2026 best practices + project streamlining goals.
 *
 * Returns:
 * - totals (excl/incl)
 * - onEditingItemChange callback for child components (LineItemsTable)
 */
export function useLineItemTotals(lineItems: InvoiceLineItem[] | undefined) {
  const [editingItemValues, setEditingItemValues] =
    useState<EditingItemOverlay | null>(null);

  const itemsTotalTaxExcl = useMemo(
    () => calculateLineItemsTotal(lineItems, editingItemValues, false),
    [lineItems, editingItemValues],
  );

  const itemsTotalTaxIncl = useMemo(
    () => calculateLineItemsTotal(lineItems, editingItemValues, true),
    [lineItems, editingItemValues],
  );

  const onEditingItemChange = useCallback(
    (values: EditingItemOverlay | null) => {
      setEditingItemValues(values);
    },
    [],
  );

  // Cleanup editing overlay when unmounting or when items change significantly
  // (the child component also cleans on unmount)
  const clearEditing = useCallback(() => {
    setEditingItemValues(null);
  }, []);

  return {
    itemsTotalTaxExcl,
    itemsTotalTaxIncl,
    onEditingItemChange,
    clearEditing,
  };
}

export type { EditingItemOverlay };
