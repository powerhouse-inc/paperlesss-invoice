import {
  AlertTriangle,
  ChevronRight,
  CreditCard,
  FileText,
} from "lucide-react";
import { useBillingFolderStructure } from "../hooks/useBillingFolderStructure.js";
import {
  useDocumentsInSelectedDrive,
  useSelectedDrive,
  isFileNodeKind,
} from "@powerhousedao/reactor-browser";
import { useMemo, useEffect, useCallback } from "react";
import { BillingMonths } from "./BillingMonths.js";
import type { SelectedFolderInfo } from "./FolderTree.js";

interface BillingOverviewProps {
  onFolderSelect?: (folderInfo: SelectedFolderInfo | null) => void;
}

/**
 * Overview for the Billing folder showing payment stats and the month list.
 *
 * Ported from contributor-billing minus everything report-related: the
 * "Reports Complete" tile, the missing-report attention items and the
 * monthly-reports card (replaced by BillingMonths).
 */
export function BillingOverview({ onFolderSelect }: BillingOverviewProps) {
  const {
    billingFolder,
    monthFolders,
    createMonthFolder,
    createBillingFolder,
    paymentsFolderIds,
  } = useBillingFolderStructure();
  const documentsInDrive = useDocumentsInSelectedDrive();
  const [driveDocument] = useSelectedDrive();

  // Calculate payment stats across all months
  const paymentStats = useMemo(() => {
    if (!documentsInDrive || !driveDocument) {
      return {
        totalInvoices: 0,
        totalAmount: 0,
        pendingCount: 0,
        paidCount: 0,
      };
    }

    const nodes = driveDocument.state.global.nodes;

    // Get all invoice file IDs that are in any payments folder
    const invoiceIds = new Set(
      nodes
        .filter(
          (n) =>
            isFileNodeKind(n) &&
            paymentsFolderIds.has(n.parentFolder || "") &&
            n.documentType === "powerhouse/invoice",
        )
        .map((n) => n.id),
    );

    // Filter invoices in payments folders
    const invoices = documentsInDrive.filter(
      (doc) =>
        doc.header.documentType === "powerhouse/invoice" &&
        invoiceIds.has(doc.header.id),
    );

    let totalAmount = 0;
    let pendingCount = 0;
    let paidCount = 0;

    for (const invoice of invoices) {
      const state = invoice.state as {
        global?: { totalPriceTaxIncl?: number; status?: string };
      };
      totalAmount += state.global?.totalPriceTaxIncl || 0;

      const status = state.global?.status?.toUpperCase() || "DRAFT";
      if (
        status === "PAYMENTSENT" ||
        status === "PAYMENTRECEIVED" ||
        status === "PAYMENTCLOSED"
      ) {
        paidCount++;
      } else if (status !== "REJECTED" && status !== "CANCELLED") {
        pendingCount++;
      }
    }

    return {
      totalInvoices: invoices.length,
      totalAmount,
      pendingCount,
      paidCount,
    };
  }, [documentsInDrive, driveDocument, paymentsFolderIds]);

  // Months sorted most-recent first (used for attention-item navigation)
  const sortedMonthNames = useMemo(
    () =>
      Array.from(monthFolders.keys()).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime(),
      ),
    [monthFolders],
  );

  // Action items: pending invoices (the report items were stripped)
  const actionItems = useMemo(() => {
    const items: Array<{
      label: string;
      folderInfo?: SelectedFolderInfo;
    }> = [];

    if (paymentStats.pendingCount > 0) {
      // Navigate to the newest month's Payments folder
      const newestMonth = sortedMonthNames[0];
      const info = newestMonth ? monthFolders.get(newestMonth) : undefined;
      items.push({
        label: `${paymentStats.pendingCount} invoice${paymentStats.pendingCount === 1 ? "" : "s"} pending payment`,
        folderInfo: info?.paymentsFolder
          ? {
              folderId: info.paymentsFolder.id,
              folderType: "payments",
              monthName: newestMonth,
            }
          : undefined,
      });
    }

    return items;
  }, [monthFolders, sortedMonthNames, paymentStats.pendingCount]);

  // Auto-create billing folder if it doesn't exist
  const ensureBillingFolder = useCallback(async () => {
    if (!billingFolder) {
      await createBillingFolder();
    }
  }, [billingFolder, createBillingFolder]);

  // Create billing folder automatically when component mounts
  useEffect(() => {
    void ensureBillingFolder();
  }, [ensureBillingFolder]);

  // Show loading state while billing folder is being created
  if (!billingFolder) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-lg font-bold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Manage monthly billing and payments
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-muted rounded-full mx-auto mb-4" />
            <div className="h-5 bg-muted rounded w-32 mx-auto mb-2" />
            <div className="h-4 bg-muted rounded w-48 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Only tint the Pending / Paid tiles when they actually have something to
  // report — a zero count should read as neutral, not as a warning/success.
  const hasPending = paymentStats.pendingCount > 0;
  const hasPaid = paymentStats.paidCount > 0;

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage monthly billing and payments
        </p>
      </div>

      {/* Payment Stats */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/15 rounded-lg">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Payment Summary
            </h2>
            <p className="text-xs text-muted-foreground">
              Overview of all invoices across billing months
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Total Invoices
              </span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {paymentStats.totalInvoices}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Total Amount
              </span>
            </div>
            <p className="text-lg font-bold text-foreground">
              $
              {paymentStats.totalAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div
            className={`rounded-lg p-3 ${hasPending ? "bg-warning/15" : "bg-muted"}`}
          >
            <span
              className={`text-xs ${hasPending ? "text-warning" : "text-muted-foreground"}`}
            >
              Pending
            </span>
            <p
              className={`text-lg font-bold ${hasPending ? "text-warning" : "text-foreground"}`}
            >
              {paymentStats.pendingCount}
            </p>
          </div>
          <div
            className={`rounded-lg p-3 ${hasPaid ? "bg-success/20" : "bg-muted"}`}
          >
            <span
              className={`text-xs ${hasPaid ? "text-success" : "text-muted-foreground"}`}
            >
              Paid
            </span>
            <p
              className={`text-lg font-bold ${hasPaid ? "text-success" : "text-foreground"}`}
            >
              {paymentStats.paidCount}
            </p>
          </div>
        </div>
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="bg-warning/15 border border-warning/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-warning">
              Needs attention
            </span>
          </div>
          <ul className="space-y-1">
            {actionItems.map((item) => (
              <li key={item.label}>
                {item.folderInfo && onFolderSelect ? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-left text-sm text-foreground hover:bg-warning/25 rounded px-2 py-1.5 transition-colors"
                    onClick={() => onFolderSelect(item.folderInfo!)}
                  >
                    <span>• {item.label}</span>
                    <ChevronRight className="w-4 h-4 text-warning flex-shrink-0" />
                  </button>
                ) : (
                  <span className="text-sm text-foreground px-2 py-1.5 block">
                    • {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Billing Months */}
      <BillingMonths
        onFolderSelect={onFolderSelect}
        monthFolders={monthFolders}
        onCreateMonth={createMonthFolder}
      />
    </div>
  );
}
