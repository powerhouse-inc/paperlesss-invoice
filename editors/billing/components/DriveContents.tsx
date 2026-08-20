import { Suspense } from "react";
import { HeaderStats } from "./InvoiceTable/HeaderStats.js";
import { InvoiceTableContainer } from "./InvoiceTable/InvoiceTableContainer.js";
import { BillingOverview } from "./BillingOverview.js";
import type { SelectedFolderInfo } from "./FolderTree.js";

interface DriveContentsProps {
  selectedFolder: SelectedFolderInfo | null;
  onFolderSelect?: (folderInfo: SelectedFolderInfo | null) => void;
}

/**
 * Shows the content based on the selected folder.
 *
 * Two routes remain from contributor-billing: a month's Payments folder shows
 * the invoice table; everything else (including no selection) shows the
 * billing overview.
 */
export function DriveContents({
  selectedFolder,
  onFolderSelect,
}: DriveContentsProps) {
  // Payments folder - show invoice table.
  // All content is inside InvoiceTableContainer so its drop zone covers the
  // entire view — drops on the header or stats area are handled by the same
  // folder-aware logic that moves invoices to the correct Payments folder.
  if (selectedFolder?.folderType === "payments") {
    return (
      <div
        key={selectedFolder.folderId}
        className="container mx-auto flex-1 p-4"
      >
        <Suspense>
          <InvoiceTableContainer folderId={selectedFolder.folderId}>
            <div className="mb-4">
              <h1 className="text-lg font-bold text-foreground">
                Payments - {selectedFolder.monthName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage invoices for {selectedFolder.monthName}
              </p>
            </div>
            <Suspense>
              <HeaderStats folderId={selectedFolder.folderId} />
            </Suspense>
          </InvoiceTableContainer>
        </Suspense>
      </div>
    );
  }

  // Default (no selection or the Billing root) - show the billing overview
  return (
    <div className="container mx-auto flex-1 p-4">
      <Suspense>
        <BillingOverview onFolderSelect={onFolderSelect} />
      </Suspense>
    </div>
  );
}
