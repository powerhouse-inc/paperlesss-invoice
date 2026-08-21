import { X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { generateId } from "document-model";
import { TextInput } from "@powerhousedao/document-engineering/ui";
import { focusNextOnEnter } from "../utils/inputHelpers.js";
import { NumberForm } from "./numberForm.js";

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

type EditLineItemInput = {
  id: string;
  currency?: string;
  description?: string;
  quantity?: number;
  taxPercent?: number;
  totalPriceTaxExcl?: number;
  totalPriceTaxIncl?: number;
  unitPriceTaxExcl?: number;
  unitPriceTaxIncl?: number;
};

type LineItemMobileModalProps = {
  item?: Partial<LineItem>;
  currency: string;
  onSave: (item: EditLineItemInput) => void;
  onCancel: () => void;
  isNew?: boolean;
  /**
   * Render as a panel filling the nearest positioned ancestor instead of a
   * full-screen sheet, so the editor reads as belonging to the list it was
   * opened from. The caller supplies the `relative` container.
   */
  contained?: boolean;
};

export function LineItemMobileModal({
  item,
  currency,
  onSave,
  onCancel,
  isNew = false,
  contained = false,
}: LineItemMobileModalProps) {
  const [description, setDescription] = useState(item?.description ?? "");
  const [quantity, setQuantity] = useState<number | string>(
    item?.quantity ?? 1,
  );
  const [unitPriceTaxExcl, setUnitPriceTaxExcl] = useState<number | string>(
    item?.unitPriceTaxExcl ?? 0,
  );
  const [taxPercent, setTaxPercent] = useState<number | string>(
    item?.taxPercent ?? 0,
  );

  // Update state when item changes
  useEffect(() => {
    setDescription(item?.description ?? "");
    setQuantity(item?.quantity ?? 1);
    setUnitPriceTaxExcl(item?.unitPriceTaxExcl ?? 0);
    setTaxPercent(item?.taxPercent ?? 0);
  }, [item]);

  // Calculate totals
  const calculatedValues = useMemo(() => {
    const qty =
      typeof quantity === "string" ? parseFloat(quantity) || 1 : quantity;
    const unitPrice =
      typeof unitPriceTaxExcl === "string"
        ? parseFloat(unitPriceTaxExcl) || 0
        : unitPriceTaxExcl;
    const tax =
      typeof taxPercent === "string" ? parseFloat(taxPercent) || 0 : taxPercent;

    const taxRate = tax / 100;
    const unitPriceTaxIncl = unitPrice * (1 + taxRate);
    const totalPriceTaxExcl = qty * unitPrice;
    const totalPriceTaxIncl = qty * unitPriceTaxIncl;

    return {
      quantity: qty,
      unitPriceTaxExcl: unitPrice,
      unitPriceTaxIncl,
      taxPercent: tax,
      totalPriceTaxExcl,
      totalPriceTaxIncl,
    };
  }, [quantity, unitPriceTaxExcl, taxPercent]);

  const handleSave = () => {
    // For edit: use existing ID (if valid), For new or empty ID: generate ID
    const needsNewId = isNew || !item?.id || item.id === "";
    const lineItem = {
      id: needsNewId ? generateId() : item.id,
      currency,
      description,
      quantity: calculatedValues.quantity,
      unitPriceTaxExcl: calculatedValues.unitPriceTaxExcl,
      unitPriceTaxIncl: calculatedValues.unitPriceTaxIncl,
      taxPercent: calculatedValues.taxPercent,
      totalPriceTaxExcl: calculatedValues.totalPriceTaxExcl,
      totalPriceTaxIncl: calculatedValues.totalPriceTaxIncl,
    };
    onSave(lineItem as EditLineItemInput);
  };

  // Prevent body scroll while the full-screen sheet is open. Skipped when
  // contained: the panel does not cover the page, so freezing it is hostile.
  useEffect(() => {
    if (contained) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [contained]);

  // The full-screen sheet is sized for touch. Inline, it sits beside 12px
  // table rows, so contained mode steps every dimension down a notch.
  const t = contained
    ? {
        pad: "p-3",
        title: "text-sm",
        label: "mb-1 block text-xs font-medium text-foreground",
        headBtn:
          "px-2.5 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-xs",
        closeBtn:
          "p-1 hover:bg-accent rounded-full transition-colors text-foreground",
        closeIcon: "w-4 h-4",
        body: "flex-1 overflow-y-auto p-3 space-y-3",
        grid: "grid grid-cols-2 gap-3",
        totalsBox: "bg-muted rounded-lg p-3 space-y-2",
        totalsTitle: "text-xs font-semibold text-foreground mb-1",
        totalsRow: "flex justify-between text-xs",
        footer: "border-t border-border p-3 bg-card flex gap-2",
        footerBtn:
          "flex-1 px-3 py-1.5 rounded-md transition-colors font-medium text-xs",
      }
    : {
        pad: "p-4",
        title: "text-lg",
        label: "block text-sm font-medium text-foreground mb-2",
        headBtn:
          "px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm",
        closeBtn:
          "p-2 hover:bg-accent rounded-full transition-colors text-foreground",
        closeIcon: "w-5 h-5",
        body: "flex-1 overflow-y-auto p-4 space-y-4",
        grid: "grid grid-cols-2 gap-4",
        totalsBox: "bg-muted rounded-lg p-4 space-y-3",
        totalsTitle: "text-sm font-semibold text-foreground mb-2",
        totalsRow: "flex justify-between text-sm",
        footer: "border-t border-border p-4 bg-card flex gap-3",
        footerBtn: "flex-1 px-4 py-3 rounded-md transition-colors font-medium",
      };

  const panel = (
    <div
      className={
        contained
          ? "flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
          : "fixed inset-0 z-50 bg-card flex flex-col"
      }
      // Inline rather than a `max-h-[...]` utility. This project's Tailwind
      // build does not reliably emit arbitrary values for these files, and a
      // silently-dropped class is exactly how this panel ended up crushed to
      // the height of a single row.
      style={contained ? { maxHeight: "32rem" } : undefined}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b border-border bg-card ${t.pad}`}
      >
        <button
          onClick={onCancel}
          className={t.closeBtn}
          aria-label="Cancel"
        >
          <X className={t.closeIcon} />
        </button>
        <h2 className={`font-semibold text-foreground ${t.title}`}>
          {isNew ? "Add Line Item" : "Edit Line Item"}
        </h2>
        <button
          onClick={handleSave}
          className={t.headBtn}
        >
          Save
        </button>
      </div>

      {/* Content */}
      <div className={t.body}>
        {/* Description */}
        <div>
          <label className={t.label}>
            Description *
          </label>
          <TextInput
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {}}
            placeholder="Enter item description"
            className="w-full"
            onKeyDown={focusNextOnEnter}
          />
        </div>

        {/* Quantity and Unit Price */}
        <div className={t.grid}>
          <div>
            <label className={t.label}>
              Quantity *
            </label>
            <NumberForm
              number={quantity}
              handleInputChange={(e) => setQuantity(e.target.value)}
              precision={0}
              className="w-full"
            />
          </div>
          <div>
            <label className={t.label}>
              Unit Price *
            </label>
            <NumberForm
              number={unitPriceTaxExcl}
              handleInputChange={(e) => setUnitPriceTaxExcl(e.target.value)}
              precision={2}
              className="w-full"
            />
          </div>
        </div>

        {/* Tax % */}
        <div>
          <label className={t.label}>
            Tax %
          </label>
          <NumberForm
            number={taxPercent}
            handleInputChange={(e) => setTaxPercent(e.target.value)}
            precision={2}
            className="w-full"
          />
        </div>

        {/* Calculated Totals - Read Only */}
        <div className={t.totalsBox}>
          <h3 className={t.totalsTitle}>
            Calculated Totals
          </h3>
          <div className={t.totalsRow}>
            <span className="text-muted-foreground">Total (excl. tax):</span>
            <span className="font-medium text-foreground">
              {currency}{" "}
              {calculatedValues.totalPriceTaxExcl.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className={t.totalsRow}>
            <span className="text-muted-foreground">Tax amount:</span>
            <span className="font-medium text-foreground">
              {currency}{" "}
              {(
                calculatedValues.totalPriceTaxIncl -
                calculatedValues.totalPriceTaxExcl
              ).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className={`${t.totalsRow} pt-2 border-t border-border`}>
            <span className="text-foreground font-semibold">
              Total (incl. tax):
            </span>
            <span className="font-bold text-foreground">
              {currency}{" "}
              {calculatedValues.totalPriceTaxIncl.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className={t.footer}>
        <button
          onClick={onCancel}
          className={`${t.footerBtn} border border-input hover:bg-accent text-foreground`}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className={`${t.footerBtn} bg-primary text-primary-foreground hover:bg-primary/90`}
        >
          Save Line Item
        </button>
      </div>
    </div>
  );

  // Contained mode returns a plain full-width card and lets the caller own
  // positioning, so the panel can float above the list rather than being boxed
  // inside it and squeezed by however many rows happen to be there.
  return panel;
}
