import { useCallback, useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import type { MonthFolderInfo } from "../hooks/useBillingFolderStructure.js";
import {
  useSelectedDrive,
  useDocumentsInSelectedDrive,
  dispatchActions,
  isFileNodeKind,
} from "@powerhousedao/reactor-browser";
import { deleteNode } from "@powerhousedao/shared/document-drive";
import type { SelectedFolderInfo } from "./FolderTree.js";

interface BillingMonthsProps {
  onFolderSelect?: (folderInfo: SelectedFolderInfo | null) => void;
  monthFolders?: Map<string, MonthFolderInfo>;
  onCreateMonth?: (monthName: string) => Promise<void>;
}

/** Format a date to month name like "January 2026" */
function formatMonthName(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface MonthRowStats {
  totalInvoices: number;
  pendingCount: number;
  paidCount: number;
}

/**
 * Month list for the billing page: one row per month, clicking a row opens
 * that month's Payments invoice table.
 *
 * This replaces contributor-billing's MonthlyReportsOverview. The Add Month
 * dropdown, month deletion and per-month payment stats are carried over; the
 * expense/snapshot report cards were stripped along with their document
 * models, so each row navigates directly instead of expanding.
 */
export function BillingMonths({
  onFolderSelect,
  monthFolders,
  onCreateMonth,
}: BillingMonthsProps) {
  const [selectedDrive] = useSelectedDrive();
  const documentsInDrive = useDocumentsInSelectedDrive();
  const [isAddingMonth, setIsAddingMonth] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const driveId = selectedDrive?.header.id;

  // Months sorted most-recent first
  const sortedMonths = useMemo(
    () =>
      Array.from(
        (monthFolders ?? new Map<string, MonthFolderInfo>()).entries(),
      ).sort(
        ([nameA], [nameB]) =>
          new Date(nameB).getTime() - new Date(nameA).getTime(),
      ),
    [monthFolders],
  );

  // Per-month payment stats for the row summary
  const monthStatsMap = useMemo(() => {
    const map = new Map<string, MonthRowStats>();
    if (!selectedDrive || !documentsInDrive || !monthFolders) return map;

    const nodes = selectedDrive.state.global.nodes;

    for (const [monthName, folderInfo] of monthFolders.entries()) {
      const paymentsFolderId = folderInfo.paymentsFolder?.id;
      if (!paymentsFolderId) continue;

      const invoiceIds = new Set(
        nodes
          .filter(
            (n) =>
              isFileNodeKind(n) &&
              n.parentFolder === paymentsFolderId &&
              n.documentType === "powerhouse/invoice",
          )
          .map((n) => n.id),
      );

      const invoices = documentsInDrive.filter(
        (doc) =>
          doc.header.documentType === "powerhouse/invoice" &&
          invoiceIds.has(doc.header.id),
      );

      let pendingCount = 0;
      let paidCount = 0;
      for (const invoice of invoices) {
        const status = (
          (invoice.state as { global?: { status?: string } }).global?.status ??
          ""
        ).toUpperCase();
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

      map.set(monthName, {
        totalInvoices: invoices.length,
        pendingCount,
        paidCount,
      });
    }

    return map;
  }, [selectedDrive, documentsInDrive, monthFolders]);

  const handleViewPayments = useCallback(
    (monthName: string) => {
      if (!onFolderSelect || !monthFolders) return;
      const info = monthFolders.get(monthName);
      if (!info?.paymentsFolder) return;
      onFolderSelect({
        folderId: info.paymentsFolder.id,
        folderType: "payments",
        monthName,
      });
    },
    [onFolderSelect, monthFolders],
  );

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Update dropdown position when opening
  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - 224, // 224px = w-56 (14rem)
      });
    }
  }, [isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get all months from January 2024 to next month, with exists flag
  const allMonths = useMemo(() => {
    const months: Array<{ name: string; exists: boolean }> = [];
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const startDate = new Date(2024, 0, 1);

    const currentDate = new Date(endDate);
    while (currentDate >= startDate) {
      const monthName = formatMonthName(currentDate);
      months.push({
        name: monthName,
        exists: monthFolders?.has(monthName) ?? false,
      });
      currentDate.setMonth(currentDate.getMonth() - 1);
    }
    return months;
  }, [monthFolders]);

  const handleCreateMonth = useCallback(
    async (monthName: string) => {
      if (!onCreateMonth || isAddingMonth) return;
      setIsAddingMonth(true);
      try {
        await onCreateMonth(monthName);
        setIsDropdownOpen(false);
      } finally {
        setIsAddingMonth(false);
      }
    },
    [onCreateMonth, isAddingMonth],
  );

  const handleDeleteMonth = useCallback(
    async (monthName: string) => {
      if (!driveId || !monthFolders) return;
      const info = monthFolders.get(monthName);
      if (!info) return;

      try {
        // Delete child nodes first (files in the subfolders, then the
        // subfolders, then the month folder). Reporting folders from drives
        // created by the old app are cleaned up too.
        const allNodes = selectedDrive?.state.global.nodes || [];
        const childNodeIds: string[] = [];

        for (const node of allNodes) {
          if (
            node.parentFolder === info.reportingFolder?.id ||
            node.parentFolder === info.paymentsFolder?.id
          ) {
            childNodeIds.push(node.id);
          }
        }

        for (const nodeId of childNodeIds) {
          await dispatchActions(deleteNode({ id: nodeId }), driveId);
        }

        if (info.reportingFolder) {
          await dispatchActions(
            deleteNode({ id: info.reportingFolder.id }),
            driveId,
          );
        }
        if (info.paymentsFolder) {
          await dispatchActions(
            deleteNode({ id: info.paymentsFolder.id }),
            driveId,
          );
        }

        await dispatchActions(deleteNode({ id: info.folder.id }), driveId);
      } catch (error) {
        console.error(`Failed to delete month folder ${monthName}:`, error);
      } finally {
        setPendingDelete(null);
      }
    },
    [driveId, monthFolders, selectedDrive],
  );

  // Add Month button (reused across states)
  const addMonthButton = onCreateMonth && (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isAddingMonth}
        className="flex items-center gap-1.5 h-8 px-3 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        {isAddingMonth ? "Adding..." : "Add Month"}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isDropdownOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-56 bg-popover rounded-lg shadow-lg border border-border py-1 z-[9999]"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
              Select a month to add
            </div>
            <div className="max-h-72 overflow-y-auto">
              {allMonths.map(({ name, exists }) => (
                <button
                  key={name}
                  onClick={() => void handleCreateMonth(name)}
                  disabled={isAddingMonth || exists}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    exists
                      ? "text-muted-foreground cursor-not-allowed"
                      : "text-foreground hover:bg-accent"
                  } disabled:cursor-not-allowed`}
                >
                  {name}
                  {exists && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (exists)
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );

  return (
    <div className="bg-card rounded-xl border border-border p-6 overflow-visible">
      {/* Header with Add Month button */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/15 rounded-lg">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Billing Months
            </h2>
            <p className="text-xs text-muted-foreground">
              Quick access to each month's payments
            </p>
          </div>
        </div>
        {addMonthButton}
      </div>

      {sortedMonths.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">
          No months configured yet. Click "Add Month" to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {sortedMonths.map(([monthName]) => {
            const stats = monthStatsMap.get(monthName);
            const isConfirmingDelete = pendingDelete === monthName;
            return (
              <div
                key={monthName}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2"
              >
                <button
                  type="button"
                  onClick={() => handleViewPayments(monthName)}
                  className="flex flex-1 min-w-0 items-center gap-3 text-left hover:opacity-80 transition-opacity"
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate text-sm font-medium text-foreground">
                    {monthName}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                    {stats?.totalInvoices ?? 0} invoice
                    {(stats?.totalInvoices ?? 0) === 1 ? "" : "s"}
                    {stats && stats.pendingCount > 0 && (
                      <span className="text-warning">
                        {" "}
                        · {stats.pendingCount} pending
                      </span>
                    )}
                  </span>
                </button>
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleDeleteMonth(monthName)}
                      className="text-xs font-medium text-destructive-foreground bg-destructive rounded px-2 py-1 hover:bg-destructive/90"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="text-xs font-medium text-foreground bg-muted rounded px-2 py-1 hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(monthName)}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                    aria-label={`Delete ${monthName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
