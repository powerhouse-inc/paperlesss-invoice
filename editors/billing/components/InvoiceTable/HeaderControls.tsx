import { useState } from "react";
import { Select } from "@powerhousedao/document-engineering/ui";
import type { FileNode } from "@powerhousedao/shared/document-drive";
import { cbToast } from "../cbToast.js";
import { ConfirmationModal } from "./ConfirmationModal.js";

export interface StatusOption {
  label: string;
  value: string;
}

// Re-export FileNode type for use in other components
export type { FileNode };

/**
 * Filter + batch-action controls above the invoice table.
 *
 * Ported from contributor-billing minus the Xero CSV export, expense-report
 * shortcut and billing-statement batch generation (and their currency
 * modals); "Delete Selected" is the remaining batch action. The search input
 * was dropped too -- it was never wired up in the source either.
 */
interface HeaderControlsProps {
  statusOptions?: StatusOption[];
  selectedStatuses?: string[];
  onStatusChange?: (value: string | string[]) => void;
  selected?: Record<string, boolean>;
  setSelected: (selected: Record<string, boolean>) => void;
  onDeleteSelected?: (ids: string[]) => Promise<void>;
}

export const HeaderControls = ({
  statusOptions = [],
  selectedStatuses = [],
  onStatusChange,
  selected = {},
  setSelected,
  onDeleteSelected,
}: HeaderControlsProps) => {
  const batchOptions = [{ label: "Delete Selected", value: "delete-selected" }];

  const [selectedBatchAction, setSelectedBatchAction] = useState<
    string | undefined
  >(undefined);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBatchAction = (action: string) => {
    if (action === "delete-selected") {
      const selectedIds = Object.keys(selected).filter((id) => selected[id]);

      if (selectedIds.length === 0) {
        cbToast("No documents selected", { type: "warning" });
        setTimeout(() => setSelectedBatchAction(undefined), 0);
        return;
      }

      setDeleteIds(selectedIds);
      setShowDeleteConfirmModal(true);
    }
  };

  return (
    <div className="contributor-billing-controls flex flex-col gap-4 mb-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        {/* Left side: Filters */}
        <div className="flex gap-2 items-center">
          <div className="w-[180px]">
            <Select
              className="h-8 text-xs"
              options={statusOptions}
              onChange={onStatusChange}
              placeholder="Status"
              selectionIcon="checkmark"
              multiple={true}
              value={selectedStatuses}
            />
          </div>
        </div>

        {/* Right side: Actions */}
        <div className="flex gap-2 items-center">
          <div className="w-[180px]">
            <Select
              className="h-8 text-xs"
              contentClassName="w-[240px]"
              options={batchOptions}
              value={selectedBatchAction}
              onChange={(value) => {
                setSelectedBatchAction(value as string);
                handleBatchAction(value as string);
              }}
              placeholder="Batch Action"
              disabled={isProcessing}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteConfirmModal}
        onCancel={() => {
          setShowDeleteConfirmModal(false);
          setDeleteIds([]);
          setTimeout(() => setSelectedBatchAction(undefined), 0);
        }}
        onContinue={() => {
          setShowDeleteConfirmModal(false);
          setIsProcessing(true);
          void (async () => {
            try {
              await onDeleteSelected?.(deleteIds);
              // Clear selection for deleted docs
              const updatedSelected = { ...selected };
              deleteIds.forEach((id) => {
                delete updatedSelected[id];
              });
              setSelected(updatedSelected);
            } finally {
              setDeleteIds([]);
              setIsProcessing(false);
              setTimeout(() => setSelectedBatchAction(undefined), 100);
            }
          })();
        }}
        header="Delete Selected Documents"
        continueLabel="Delete"
        cancelLabel="Cancel"
      >
        <p className="text-destructive text-sm mb-3 font-medium">
          This will permanently delete {deleteIds.length} selected document
          {deleteIds.length !== 1 ? "s" : ""} from the drive. This action cannot
          be undone.
        </p>
      </ConfirmationModal>
    </div>
  );
};
