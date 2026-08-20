import { usePHToast } from "@powerhousedao/reactor-browser";
import {
  type DeleteLineItemInput,
  type EditInvoiceInput,
  type InvoiceTag,
  useSelectedInvoiceDocument,
} from "document-models/invoice";
import { forwardRef, useState, useRef, type Dispatch } from "react";
import { Tag } from "lucide-react";
import { NumberForm } from "./components/numberForm.js";
import { TextInput } from "@powerhousedao/document-engineering/ui";
import { focusNextOnEnter } from "./utils/inputHelpers.js";
import { LineItemTagsTable } from "./lineItemTags/lineItemTags.js";
import { LineItemsEmptyState } from "./components/lineItemsEmptyState.js";
import { TimeTrackingReportButton } from "./components/timeTrackingReportButton.js";
import { LineItemReceiptButton } from "./components/lineItemReceiptButton.js";
import { canEditInvoice } from "./utils/invoicePermissions.js";
import { formatNumber, type EditingItemOverlay } from "./utils/utils.js";
import { useEditableLineItem } from "./hooks/useEditableLineItem.js";

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
  lineItemTag: InvoiceTag[];
};

type EditableLineItemProps = {
  readonly item: Partial<LineItem>;
  readonly onSave: (item: LineItem) => void;
  readonly onCancel: () => void;
  readonly currency: string;
  readonly onEditingItemChange?: (values: EditingItemOverlay | null) => void;
};

const EditableLineItem = forwardRef(function EditableLineItem(
  props: EditableLineItemProps,
  ref: React.Ref<HTMLTableRowElement>,
) {
  const { item, onSave, onCancel, currency, onEditingItemChange } = props;

  const {
    editedItem,
    calculatedValues,
    handleInputChange,
    handleSave,
    handleDescriptionChange,
  } = useEditableLineItem({
    item,
    currency,
    onSave,
    onEditingItemChange,
  });

  return (
    <tr ref={ref} className="hover:bg-accent table-row text-foreground">
      <td className="border border-border p-3 table-cell">
        <TextInput
          onBlur={() => {}}
          onChange={handleDescriptionChange}
          value={editedItem.description ?? ""}
          placeholder="Description"
          className="border-border"
          onKeyDown={focusNextOnEnter}
        />
      </td>
      <td className="border border-border p-3 table-cell">
        <NumberForm
          number={calculatedValues.quantity || 1}
          precision={2}
          handleInputChange={handleInputChange("quantity")}
          placeholder="Quantity"
          className="border-border"
        />
      </td>
      <td className="border border-border p-3 table-cell">
        <NumberForm
          number={
            calculatedValues.unitPriceTaxExcl % 1 === 0
              ? calculatedValues.unitPriceTaxExcl.toString()
              : calculatedValues.unitPriceTaxExcl.toFixed(2)
          }
          precision={2}
          handleInputChange={handleInputChange("unitPriceTaxExcl")}
          pattern="^-?\d*\.?\d*$"
          placeholder="Unit Price (excl. tax)"
          className="border-border"
        />
      </td>
      <td className="border border-border p-3 text-right font-medium table-cell">
        <NumberForm
          number={calculatedValues.taxPercent}
          precision={0}
          pattern="^(100|[1-9]?[0-9])$"
          handleInputChange={handleInputChange("taxPercent")}
          placeholder="Tax %"
          className="border-border"
        />
      </td>
      <td className="border border-border p-3 text-right font-medium table-cell">
        <NumberForm
          number={
            calculatedValues.totalPriceTaxExcl % 1 === 0
              ? calculatedValues.totalPriceTaxExcl.toString()
              : calculatedValues.totalPriceTaxExcl.toFixed(2)
          }
          precision={2}
          handleInputChange={handleInputChange("totalPriceTaxExcl")}
          pattern="^-?\d*\.?\d*$"
          placeholder="Total (excl. tax)"
          className="border-border"
        />
      </td>
      <td className="border border-border p-3 text-right font-medium table-cell">
        <NumberForm
          number={
            calculatedValues.totalPriceTaxIncl % 1 === 0
              ? calculatedValues.totalPriceTaxIncl.toString()
              : calculatedValues.totalPriceTaxIncl.toFixed(2)
          }
          precision={2}
          handleInputChange={handleInputChange("totalPriceTaxIncl")}
          pattern="^-?\d*\.?\d*$"
          placeholder="Total (incl. tax)"
          className="border-border"
        />
      </td>
      <td className="border border-border p-3 table-cell">
        <div className="flex items-center justify-center space-x-2">
          {item.id ? (
            <LineItemReceiptButton lineItemId={item.id} allowAttach={false} />
          ) : null}
          <button
            className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:bg-primary/90"
            onClick={handleSave}
          >
            Save
          </button>
          <button
            className="rounded bg-muted px-2 py-0.5 text-xs text-foreground hover:bg-accent"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
});

type LineItemsTableProps = {
  readonly lineItems: LineItem[];
  readonly currency: string;
  readonly onAddItem: (item: LineItem) => void;
  readonly onUpdateItem: (item: LineItem) => void;
  readonly onDeleteItem: (input: DeleteLineItemInput) => void;
  readonly onUpdateCurrency: (input: EditInvoiceInput) => void;
  readonly onEditingItemChange?: (values: EditingItemOverlay | null) => void;
  readonly dispatch: Dispatch<any>;
  readonly paymentAccounts: InvoiceTag[];
};

export function LineItemsTable({
  lineItems,
  currency,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onEditingItemChange,
  dispatch,
  paymentAccounts,
}: LineItemsTableProps) {
  const toast = usePHToast();
  // Line items are invoice content: add/edit/delete freeze outside
  // DRAFT/REJECTED. "Manage Tags" and the receipt viewer stay available.
  const [invoiceDocument] = useSelectedInvoiceDocument();
  const canEdit = canEditInvoice(invoiceDocument.state.global.status);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showTagTable, setShowTagTable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  function handleAddClick() {
    setIsAddingNew(true);
  }

  function handleSaveNewItem(item: LineItem) {
    try {
      onAddItem(item);
    } catch (error: any) {
      if (error?.message?.includes("Invalid action input:")) {
        try {
          const errorPart = error.message.split("Invalid action input: ")[1];
          const zodError = JSON.parse(errorPart);
          if (Array.isArray(zodError) && zodError.length > 0) {
            const firstError = zodError[0];
            const errorJSX = (
              <div>
                <p className="font-semibold">Failed to add line item</p>
                <p>{firstError.message}: </p>
                {zodError.map((err: any, index: number) => (
                  <ul key={index}>
                    <li className="text-destructive font-semibold">
                      - {err.path.join(".")}
                    </li>
                  </ul>
                ))}
              </div>
            );

            toast?.(errorJSX, {
              type: "error",
            });
            return;
          }
        } catch (parseError) {
          console.error("Failed to parse Zod error:", parseError);
          toast?.("Invalid input data", {
            type: "error",
          });
          return;
        }
      } else if (error?.message) {
        toast?.(error.message, {
          type: "error",
        });
        return;
      }

      toast?.("Failed to add line item", {
        type: "error",
      });
    }
    setIsAddingNew(false);
  }

  function handleCancelNewItem() {
    setIsAddingNew(false);
  }

  // Transform line items to TagAssignmentRow format for the tag table
  const tagAssignmentRows = lineItems.map((item) => ({
    id: item.id,
    item: item.description,
    period: "", // Default value
    expenseAccount: "", // Default value
    total: `${currency} ${formatNumber(item.totalPriceTaxIncl)}`,
    lineItemTag: item.lineItemTag,
  }));

  if (showTagTable) {
    return (
      <LineItemTagsTable
        lineItems={tagAssignmentRows}
        onClose={() => setShowTagTable(false)}
        dispatch={dispatch}
        paymentAccounts={paymentAccounts}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Line Items Section */}
      <div className="mt-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-base font-semibold text-foreground">
            Line Items
          </h4>
          <div className="flex items-center gap-3">
            <TimeTrackingReportButton />
            <button
              onClick={() => setShowTagTable(true)}
              className="flex items-center gap-2 h-8 px-3 border border-input rounded-md hover:bg-accent transition-colors text-xs font-medium text-foreground"
              title="Manage Tags for All Line Items"
            >
              <Tag className="w-4 h-4" />
              <span>Manage Tags</span>
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={isAddingNew}
                onClick={handleAddClick}
                className="inline-flex items-center h-8 px-3 rounded text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Line Item
              </button>
            )}
          </div>
        </div>

        {/* Empty State */}
        {lineItems.length === 0 && !isAddingNew && (
          <LineItemsEmptyState onAddItem={handleAddClick} />
        )}

        {/* Table View */}
        {(lineItems.length > 0 || isAddingNew) && (
          <div
            ref={tableContainerRef}
            className="overflow-x-auto rounded-lg border border-border shadow-sm"
          >
            <table
              ref={tableRef}
              className="w-full table-fixed border-collapse bg-card text-sm text-foreground"
            >
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "8%" }} />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr className="bg-muted text-foreground">
                  <th className="border-b border-border p-3 text-left text-foreground">
                    Description
                  </th>
                  <th className="border-b border-border p-3 text-right text-foreground">
                    Quantity
                  </th>
                  <th className="border-b border-border p-3 text-right text-foreground">
                    Unit Price (excl. tax)
                  </th>
                  <th className="border-b border-border p-3 text-right text-foreground">
                    Tax %
                  </th>
                  <th className="border-b border-border p-3 text-right text-foreground">
                    Total (excl. tax)
                  </th>
                  <th className="border-b border-border p-3 text-right text-foreground">
                    Total (incl. tax)
                  </th>
                  <th className="border-b border-border p-3 text-center text-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) =>
                  editingId === item.id ? (
                    <EditableLineItem
                      currency={currency}
                      item={item}
                      key={item.id}
                      onCancel={() => setEditingId(null)}
                      onSave={(updatedItem) => {
                        try {
                          onUpdateItem(updatedItem);
                          setEditingId(null);
                        } catch (error: any) {
                          console.error(error);

                          if (
                            error?.message?.includes("Invalid action input:")
                          ) {
                            try {
                              const zodError = JSON.parse(
                                error.message.split(
                                  "Invalid action input: ",
                                )[1],
                              );
                              if (
                                Array.isArray(zodError) &&
                                zodError.length > 0
                              ) {
                                const firstError = zodError[0];
                                const errorJSX = (
                                  <div>
                                    <p className="font-semibold">
                                      Failed to update line item
                                    </p>
                                    <p>{firstError.message}: </p>
                                    {zodError.map((err: any, index: number) => (
                                      <ul key={index}>
                                        <li className="text-destructive font-semibold">
                                          - {err.path.join(".")}
                                        </li>
                                      </ul>
                                    ))}
                                  </div>
                                );

                                toast?.(errorJSX, {
                                  type: "error",
                                });
                                return;
                              }
                            } catch (parseError) {
                              console.error(
                                "Failed to parse Zod error:",
                                parseError,
                              );
                              toast?.("Invalid input data", {
                                type: "error",
                              });
                              return;
                            }
                          } else if (error?.message) {
                            toast?.(error.message, {
                              type: "error",
                            });
                            return;
                          }

                          toast?.("Failed to update line item", {
                            type: "error",
                          });
                        }
                      }}
                      onEditingItemChange={onEditingItemChange}
                    />
                  ) : (
                    <tr
                      key={item.id}
                      className="hover:bg-accent table-row text-foreground"
                    >
                      <td className="border-b border-border p-3 table-cell">
                        {item.description}
                      </td>
                      <td className="border-b border-border p-3 text-right table-cell">
                        {item.quantity % 1 === 0
                          ? item.quantity.toString()
                          : item.quantity.toFixed(2)}
                      </td>
                      <td className="border-b border-border p-3 text-right table-cell">
                        {formatNumber(item.unitPriceTaxExcl)}
                      </td>
                      <td className="border-b border-border p-3 text-right table-cell">
                        {typeof item.taxPercent === "number"
                          ? Math.round(item.taxPercent)
                          : 0}
                        %
                      </td>
                      <td className="border-b border-border p-3 text-right font-medium table-cell">
                        {formatNumber(item.totalPriceTaxExcl)}
                      </td>
                      <td className="border-b border-border p-3 text-right font-medium table-cell">
                        {formatNumber(item.totalPriceTaxIncl)}
                      </td>
                      <td className="border-b border-border p-3 table-cell">
                        <div className="flex items-center justify-center space-x-2">
                          <LineItemReceiptButton lineItemId={item.id} />
                          {/* Hidden outright rather than shown disabled:
                              there is no path to editing a line item in a
                              locked status, so an inert button is just noise. */}
                          {canEdit && (
                            <>
                              <button
                                className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:bg-primary/90"
                                onClick={() => setEditingId(item.id)}
                              >
                                Edit
                              </button>
                              <button
                                className="rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => onDeleteItem({ id: item.id })}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                {isAddingNew ? (
                  <EditableLineItem
                    currency={currency}
                    item={{}}
                    onCancel={handleCancelNewItem}
                    onSave={handleSaveNewItem}
                    onEditingItemChange={onEditingItemChange}
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
