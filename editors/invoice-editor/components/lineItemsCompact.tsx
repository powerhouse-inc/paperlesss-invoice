import { useCallback, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatNumber } from "../utils/utils.js";
import { LineItemMobileModal } from "./lineItemMobileModal.js";
import type {
  AddLineItemInput,
  DeleteLineItemInput,
  EditLineItemInput,
  InvoiceLineItem,
} from "document-models/invoice";

/**
 * Structural mirror of what `LineItemMobileModal` hands back. Its own input
 * type is module-private, so this restates the shape rather than importing it;
 * every field except `id` is optional there, hence the fallbacks below.
 */
type SavedLineItem = {
  id: string;
  currency?: string | null;
  description?: string | null;
  quantity?: number | null;
  taxPercent?: number | null;
  totalPriceTaxExcl?: number | null;
  totalPriceTaxIncl?: number | null;
  unitPriceTaxExcl?: number | null;
  unitPriceTaxIncl?: number | null;
};

function normalise(saved: SavedLineItem, currency: string): AddLineItemInput {
  return {
    id: saved.id,
    currency: saved.currency ?? currency,
    description: saved.description ?? "",
    quantity: saved.quantity ?? 0,
    taxPercent: saved.taxPercent ?? 0,
    totalPriceTaxExcl: saved.totalPriceTaxExcl ?? 0,
    totalPriceTaxIncl: saved.totalPriceTaxIncl ?? 0,
    unitPriceTaxExcl: saved.unitPriceTaxExcl ?? 0,
    unitPriceTaxIncl: saved.unitPriceTaxIncl ?? 0,
  };
}

interface LineItemsCompactProps {
  readonly lineItems: InvoiceLineItem[];
  readonly currency: string;
  readonly editable?: boolean;
  readonly onAddItem: (item: AddLineItemInput) => void;
  readonly onUpdateItem: (item: EditLineItemInput) => void;
  readonly onDeleteItem: (input: DeleteLineItemInput) => void;
}

type EditTarget = { item?: InvoiceLineItem; isNew: boolean };

/**
 * Line items as tight rows rather than a table.
 *
 * The full table has eight columns and only survives a half-width pane by
 * scrolling sideways, which is useless when the point is to read the invoice
 * against a PDF beside it. Each row here shows just the two things you scan
 * for — description and total — kept on one line so a long invoice stays
 * dense. Everything else (quantity, unit price, tax %, both totals) lives in
 * the edit form, which is the existing `LineItemMobileModal`.
 */
export function LineItemsCompact({
  lineItems,
  currency,
  editable = true,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: LineItemsCompactProps) {
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const closeEditor = useCallback(() => setEditTarget(null), []);

  const handleSave = useCallback(
    (saved: SavedLineItem) => {
      const full = normalise(saved, currency);
      if (editTarget?.isNew) onAddItem(full);
      else onUpdateItem(full);
      setEditTarget(null);
    },
    [currency, editTarget, onAddItem, onUpdateItem],
  );

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Line items{" "}
          <span className="font-normal text-muted-foreground">
            ({lineItems.length})
          </span>
        </h3>
        {editable && (
          <button
            type="button"
            onClick={() => setEditTarget({ isNew: true })}
            className="inline-flex h-7 items-center gap-1 rounded border border-input bg-background px-2 text-xs text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {/* `relative` gives the edit panel its containing block, so it lines up
          with this list and spans exactly its width. */}
      <div className="relative">
        {lineItems.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-3 py-4 text-center text-xs text-muted-foreground">
            No line items yet.
          </p>
        ) : (
          /* Capped with its own scroll so a few hundred rows cannot make the
             left pane absurdly long. Inline style because arbitrary Tailwind
             values are not reliably emitted for this file. */
          <div
            className="divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card"
            style={{ maxHeight: "45vh" }}
          >
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
              >
                <span
                  className="min-w-0 flex-1 truncate text-xs text-foreground"
                  title={item.description}
                >
                  {item.description || "Untitled item"}
                </span>

                <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                  {formatNumber(item.totalPriceTaxIncl)}
                </span>

                {/* Kept always visible rather than hover-only: hover-only
                    actions are unreachable on touch and easy to miss. */}
                <button
                  type="button"
                  onClick={() => setEditTarget({ item, isNew: false })}
                  aria-label={`Edit ${item.description || "line item"}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>

                {editable && (
                  <button
                    type="button"
                    onClick={() => onDeleteItem({ id: item.id })}
                    aria-label={`Delete ${item.description || "line item"}`}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {editTarget && (
          <div className="absolute inset-x-0 top-0 z-20">
            <LineItemMobileModal
              contained
              item={editTarget.item}
              currency={currency}
              isNew={editTarget.isNew}
              onSave={handleSave}
              onCancel={closeEditor}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default LineItemsCompact;
