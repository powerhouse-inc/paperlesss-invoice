import { useState, useMemo, useEffect, useCallback } from "react";
import { generateId } from "document-model";
import {
  getCurrencyPrecision,
  type EditingItemOverlay,
} from "../utils/utils.js";

type LineItem = {
  currency: string;
  description: string;
  id: string;
  quantity: number;
  taxPercent: number;
  totalPriceTaxExcl: number;
  totalPriceTaxIncl: number;
  unitPriceTaxExcl: number;
  unitPriceTaxIncl: number;
  lineItemTag: any[];
};

type EditableLineItemData = {
  currency: string;
  description: string;
  id: string;
  quantity: number | string;
  taxPercent: number | string;
  totalPriceTaxExcl: number | string;
  totalPriceTaxIncl: number | string;
  unitPriceTaxExcl: number | string;
};

export interface UseEditableLineItemProps {
  item: Partial<LineItem>;
  currency: string;
  onSave: (item: LineItem) => void;
  onEditingItemChange?: (values: EditingItemOverlay | null) => void;
}

export interface UseEditableLineItemReturn {
  editedItem: Partial<EditableLineItemData>;
  calculatedValues: {
    quantity: number;
    taxPercent: number;
    totalPriceTaxExcl: number;
    totalPriceTaxIncl: number;
    unitPriceTaxExcl: number;
    unitPriceTaxIncl: number;
  };
  handleInputChange: (field: keyof EditableLineItemData) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSave: () => void;
  handleDescriptionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isNewItem: boolean;
}

/**
 * Custom hook encapsulating the complex editing logic for a single line item.
 *
 * Applies vercel-react-best-practices:
 * - Extract expensive/combined logic into focused hook (rerender-split-combined-hooks, rerender-memo)
 * - Derived calculations in useMemo
 * - Logic separated from presentation (makes EditableLineItem component thin)
 * - Functional updates where appropriate
 *
 * This makes the line item editing easier to read, test, and extend.
 */
export function useEditableLineItem({
  item,
  currency,
  onSave,
  onEditingItemChange,
}: UseEditableLineItemProps): UseEditableLineItemReturn {
  const [editedItem, setEditedItem] = useState<Partial<EditableLineItemData>>({
    ...item,
    currency,
    quantity: item.quantity ?? 1,
    taxPercent: item.taxPercent ?? "",
    unitPriceTaxExcl: item.unitPriceTaxExcl ?? "",
    totalPriceTaxExcl: item.totalPriceTaxExcl ?? "",
    totalPriceTaxIncl: item.totalPriceTaxIncl ?? "",
  });

  const isNewItem = !item.id;

  const calculatedValues = useMemo(() => {
    const quantity =
      typeof editedItem.quantity === "string"
        ? editedItem.quantity === ""
          ? 1
          : Number(editedItem.quantity) || 1
        : (editedItem.quantity ?? 1);

    const unitPriceTaxExcl =
      typeof editedItem.unitPriceTaxExcl === "string"
        ? editedItem.unitPriceTaxExcl === ""
          ? 0
          : Number(editedItem.unitPriceTaxExcl)
        : (editedItem.unitPriceTaxExcl ?? 0);

    const taxPercent =
      typeof editedItem.taxPercent === "string"
        ? editedItem.taxPercent === ""
          ? 0
          : Number(editedItem.taxPercent)
        : (editedItem.taxPercent ?? 0);

    const totalPriceTaxExcl =
      typeof editedItem.totalPriceTaxExcl === "string"
        ? editedItem.totalPriceTaxExcl === ""
          ? 0
          : Number(editedItem.totalPriceTaxExcl)
        : (editedItem.totalPriceTaxExcl ?? 0);

    const totalPriceTaxIncl =
      typeof editedItem.totalPriceTaxIncl === "string"
        ? editedItem.totalPriceTaxIncl === ""
          ? 0
          : Number(editedItem.totalPriceTaxIncl)
        : (editedItem.totalPriceTaxIncl ?? 0);

    const taxRate = taxPercent / 100;

    const userEditedQuantity =
      editedItem.quantity !== undefined &&
      editedItem.quantity !== item.quantity;
    const userEditedUnitPriceTaxExcl =
      editedItem.unitPriceTaxExcl !== undefined &&
      editedItem.unitPriceTaxExcl !== item.unitPriceTaxExcl;
    const userEditedTotalPriceTaxExcl =
      editedItem.totalPriceTaxExcl !== undefined &&
      editedItem.totalPriceTaxExcl !== item.totalPriceTaxExcl;
    const userEditedTotalPriceTaxIncl =
      editedItem.totalPriceTaxIncl !== undefined &&
      editedItem.totalPriceTaxIncl !== item.totalPriceTaxIncl;

    let finalUnitPriceTaxExcl = unitPriceTaxExcl;
    let finalUnitPriceTaxIncl = unitPriceTaxExcl * (1 + taxRate);
    let finalTotalPriceTaxExcl = quantity * unitPriceTaxExcl;
    let finalTotalPriceTaxIncl = quantity * finalUnitPriceTaxIncl;

    if (userEditedTotalPriceTaxExcl && totalPriceTaxExcl !== 0) {
      finalTotalPriceTaxExcl = totalPriceTaxExcl;
      finalUnitPriceTaxExcl = totalPriceTaxExcl / quantity;
      finalUnitPriceTaxIncl = finalUnitPriceTaxExcl * (1 + taxRate);
      finalTotalPriceTaxIncl = quantity * finalUnitPriceTaxIncl;
    } else if (userEditedTotalPriceTaxIncl && totalPriceTaxIncl !== 0) {
      finalTotalPriceTaxIncl = totalPriceTaxIncl;
      finalUnitPriceTaxIncl = totalPriceTaxIncl / quantity;
      finalUnitPriceTaxExcl = finalUnitPriceTaxIncl / (1 + taxRate);
      finalTotalPriceTaxExcl = quantity * finalUnitPriceTaxExcl;
    } else if (userEditedUnitPriceTaxExcl && unitPriceTaxExcl !== 0) {
      finalUnitPriceTaxExcl = unitPriceTaxExcl;
      finalUnitPriceTaxIncl = unitPriceTaxExcl * (1 + taxRate);
      finalTotalPriceTaxExcl = quantity * finalUnitPriceTaxExcl;
      finalTotalPriceTaxIncl = quantity * finalUnitPriceTaxIncl;
    } else if (userEditedQuantity) {
      finalTotalPriceTaxExcl = quantity * finalUnitPriceTaxExcl;
      finalTotalPriceTaxIncl = quantity * finalUnitPriceTaxIncl;
    }

    return {
      quantity: quantity,
      taxPercent: taxPercent,
      totalPriceTaxExcl: finalTotalPriceTaxExcl,
      totalPriceTaxIncl: finalTotalPriceTaxIncl,
      unitPriceTaxIncl: finalUnitPriceTaxIncl,
      unitPriceTaxExcl: finalUnitPriceTaxExcl,
    };
  }, [
    editedItem.quantity,
    editedItem.unitPriceTaxExcl,
    editedItem.taxPercent,
    editedItem.totalPriceTaxExcl,
    editedItem.totalPriceTaxIncl,
    item.quantity,
    item.unitPriceTaxExcl,
    item.totalPriceTaxExcl,
    item.totalPriceTaxIncl,
  ]);

  // Update parent for live totals - use functional updates where possible
  useEffect(() => {
    if (onEditingItemChange && item.id) {
      onEditingItemChange({
        id: item.id,
        quantity: calculatedValues.quantity,
        unitPriceTaxExcl: calculatedValues.unitPriceTaxExcl,
        unitPriceTaxIncl: calculatedValues.unitPriceTaxIncl,
      });
    }
  }, [
    calculatedValues.quantity,
    calculatedValues.unitPriceTaxExcl,
    calculatedValues.unitPriceTaxIncl,
    onEditingItemChange,
    item.id,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (onEditingItemChange && item.id) {
        onEditingItemChange(null);
      }
    };
  }, [onEditingItemChange, item.id]);

  function parseNumericInput(raw: string, precision: number): number {
    const cleaned = raw.replace(/,/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return NaN;
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  }

  const handleInputChange = useCallback(
    (field: keyof EditableLineItemData) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value;
        const value = raw.replace(/,/g, "");

        if (field === "description") {
          setEditedItem((prev) => ({ ...prev, [field]: value }));
          return;
        }

        if (field !== "quantity" && (value === "" || value === "0")) {
          setEditedItem((prev) => ({ ...prev, [field]: value }));
          return;
        }

        if (field === "quantity") {
          if (value === "" || value === "0") {
            setEditedItem((prev) => ({ ...prev, [field]: 1 }));
          } else {
            const num = parseNumericInput(value, 2);
            if (!isNaN(num)) {
              setEditedItem((prev) => ({ ...prev, [field]: num || 1 }));
            }
          }
        } else if (field === "taxPercent") {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
            setEditedItem((prev) => ({ ...prev, [field]: value }));
          }
        } else if (
          field === "unitPriceTaxExcl" ||
          field === "totalPriceTaxExcl" ||
          field === "totalPriceTaxIncl"
        ) {
          const maxDecimals = getCurrencyPrecision(currency);
          if (/^-?\d*\.?\d*$/.test(value)) {
            const num = parseNumericInput(value, maxDecimals);
            if (
              !isNaN(num) ||
              value === "" ||
              value === "-" ||
              value.endsWith(".")
            ) {
              const storeValue =
                value.endsWith(".") || value === "-" ? value : num;
              setEditedItem((prev) => ({
                ...prev,
                [field]:
                  field === "totalPriceTaxExcl"
                    ? Number(storeValue) || 0
                    : storeValue,
              }));
            }
          } else {
            const num = parseNumericInput(value, maxDecimals);
            if (!isNaN(num)) {
              setEditedItem((prev) => ({
                ...prev,
                [field]: field === "totalPriceTaxExcl" ? num : num,
              }));
            }
          }
        } else {
          const num = parseNumericInput(value, 2);
          if (
            !isNaN(num) ||
            value === "" ||
            value === "-" ||
            value.endsWith(".")
          ) {
            setEditedItem((prev) => ({
              ...prev,
              [field]: isNaN(num) ? value : value,
            }));
          }
        }
      },
    [currency]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditedItem((prev) => ({ ...prev, description: e.target.value }));
    },
    []
  );

  const handleSave = useCallback(() => {
    if (isNewItem) {
      onSave({
        id: editedItem.id ?? generateId(),
        currency,
        description: editedItem.description ?? "",
        quantity: calculatedValues.quantity,
        taxPercent: calculatedValues.taxPercent,
        unitPriceTaxExcl: calculatedValues.unitPriceTaxExcl,
        unitPriceTaxIncl: calculatedValues.unitPriceTaxIncl,
        totalPriceTaxExcl: calculatedValues.totalPriceTaxExcl,
        totalPriceTaxIncl: calculatedValues.totalPriceTaxIncl,
        lineItemTag: [],
      });
      return;
    }

    const isClose = (a: number, b: number) => Math.abs(a - b) < 0.00001;

    const updateInput: any = {
      id: editedItem.id,
      currency,
    };

    if (
      editedItem.description !== undefined &&
      editedItem.description !== item.description
    ) {
      updateInput.description = editedItem.description ?? "";
    }

    if (!isClose(calculatedValues.quantity, item.quantity ?? 0)) {
      updateInput.quantity = calculatedValues.quantity;
    }

    if (!isClose(calculatedValues.taxPercent, item.taxPercent ?? 0)) {
      updateInput.taxPercent = calculatedValues.taxPercent;
    }

    if (
      !isClose(calculatedValues.unitPriceTaxExcl, item.unitPriceTaxExcl ?? 0)
    ) {
      updateInput.unitPriceTaxExcl = calculatedValues.unitPriceTaxExcl;
    }

    if (
      !isClose(calculatedValues.unitPriceTaxIncl, item.unitPriceTaxIncl ?? 0)
    ) {
      updateInput.unitPriceTaxIncl = calculatedValues.unitPriceTaxIncl;
    }

    if (
      !isClose(calculatedValues.totalPriceTaxExcl, item.totalPriceTaxExcl ?? 0)
    ) {
      updateInput.totalPriceTaxExcl = calculatedValues.totalPriceTaxExcl;
    }

    if (
      !isClose(calculatedValues.totalPriceTaxIncl, item.totalPriceTaxIncl ?? 0)
    ) {
      updateInput.totalPriceTaxIncl = calculatedValues.totalPriceTaxIncl;
    }

    onSave(updateInput);
  }, [
    isNewItem,
    editedItem,
    item,
    currency,
    calculatedValues,
    onSave,
  ]);

  return {
    editedItem,
    calculatedValues,
    handleInputChange,
    handleSave,
    handleDescriptionChange,
    isNewItem,
  };
}
