import { useEffect } from "react";
import {
  isFileNodeKind,
  useSelectedDrive,
  useDocumentsInSelectedDrive,
  dispatchActions,
} from "@powerhousedao/reactor-browser";
import { moveNode } from "@powerhousedao/shared/document-drive";
import type { FileNode } from "@powerhousedao/shared/document-drive";
import type { InvoiceDocument } from "document-models/invoice";
import { useBillingFolderStructure } from "./useBillingFolderStructure.js";
import { cbToast } from "../components/cbToast.js";

// Module-level tracking to prevent duplicate processing
const globalProcessingState = {
  processedDocs: new Map<string, Set<string>>(), // driveId -> Set of doc IDs processed
};

interface UseDocumentAutoPlacementResult {
  /** Whether auto-placement is active */
  isActive: boolean;
}

/**
 * Hook that auto-places uploaded invoices in the Billing drive.
 *
 * Ported from contributor-billing; the expense-report, snapshot-report and
 * billing-statement placement effects were stripped along with those models.
 * Invoices dropped anywhere in the drive are moved into
 * `Billing/<Month>/Payments` based on their dateIssued, creating the month
 * folder when needed.
 */
export function useDocumentAutoPlacement(): UseDocumentAutoPlacementResult {
  const [driveDocument] = useSelectedDrive();
  const documentsInDrive = useDocumentsInSelectedDrive();
  const { paymentsFolderIds, monthFolders, billingFolder, createMonthFolder } =
    useBillingFolderStructure();
  const driveId = driveDocument?.header.id;

  // Initialize module-level tracking for this drive
  if (driveId && !globalProcessingState.processedDocs.has(driveId)) {
    globalProcessingState.processedDocs.set(driveId, new Set());
  }

  // Helper function to get month name from periodStart date
  // Uses UTC to avoid timezone issues - extracts year and month directly from ISO string
  const getMonthNameFromPeriod = (
    periodStart: string | null | undefined,
  ): string | null => {
    if (!periodStart) return null;
    try {
      // Parse the ISO date string and extract UTC components
      // ISO format: "2025-07-01T00:00:00.000Z" or "2025-07-01"
      const date = new Date(periodStart);
      if (isNaN(date.getTime())) return null;

      // Use UTC methods to get year and month, avoiding timezone conversion
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth(); // 0-11

      // Format as "Month Year" (e.g., "July 2025")
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      return `${monthNames[month]} ${year}`;
    } catch {
      return null;
    }
  };

  // Auto-place invoices into appropriate Payments folders based on dateIssued
  useEffect(() => {
    if (!driveId || !driveDocument || !documentsInDrive) return;

    const allNodes = driveDocument.state.global.nodes;
    const processedDocs = globalProcessingState.processedDocs.get(driveId);
    if (!processedDocs) return;

    // Find invoice file nodes that are NOT already in a Payments folder
    const invoiceNodesToProcess = allNodes.filter(
      (node): node is FileNode =>
        isFileNodeKind(node) &&
        node.documentType === "powerhouse/invoice" &&
        !paymentsFolderIds.has(node.parentFolder || ""),
    );

    for (const fileNode of invoiceNodesToProcess) {
      if (processedDocs.has(fileNode.id)) continue;

      const doc = documentsInDrive.find(
        (d): d is InvoiceDocument =>
          d.header.documentType === "powerhouse/invoice" &&
          d.header.id === fileNode.id,
      );

      if (!doc) continue;

      const dateIssued = doc.state.global.dateIssued;
      const monthName = getMonthNameFromPeriod(
        dateIssued as string | null | undefined,
      );

      processedDocs.add(fileNode.id);

      if (monthName) {
        const monthInfo = monthFolders.get(monthName);
        const paymentsFolder = monthInfo?.paymentsFolder;

        if (paymentsFolder) {
          console.log(
            `[DocumentAutoPlacement] Moving invoice ${fileNode.id} ("${fileNode.name}") to Payments folder for ${monthName}`,
          );

          dispatchActions(
            moveNode({
              srcFolder: fileNode.id,
              targetParentFolder: paymentsFolder.id,
            }),
            driveId,
          )
            .then(() => {
              cbToast(
                `Invoice "${fileNode.name}" placed in ${monthName} > Payments`,
                { type: "success" },
              );
            })
            .catch((error: unknown) => {
              console.warn(
                `[DocumentAutoPlacement] Could not move invoice to folder:`,
                error instanceof Error ? error.message : error,
              );
            });
        } else if (billingFolder && driveId) {
          createMonthFolder(monthName)
            .then(() => {
              processedDocs.delete(fileNode.id);
            })
            .catch(() => {
              // Folder creation failed
            });
        }
      } else {
        console.warn(
          `[DocumentAutoPlacement] Invoice ${fileNode.id} ("${fileNode.name}") has no dateIssued, leaving at root`,
        );
        cbToast(
          `Invoice "${fileNode.name}" has no issue date — could not auto-categorize. It remains at the drive root.`,
          { type: "warning" },
        );
      }
    }
  }, [
    driveId,
    driveDocument,
    documentsInDrive,
    paymentsFolderIds,
    monthFolders,
    billingFolder,
    createMonthFolder,
  ]);

  return {
    isActive: !!driveId,
  };
}
