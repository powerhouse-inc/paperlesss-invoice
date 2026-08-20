import { useMemo } from "react";
import {
  dispatchActions,
  useSelectedDrive,
  useDocumentsInSelectedDrive,
} from "@powerhousedao/reactor-browser";
import type { PHDocument, DocumentModelModule } from "document-model";
import {
  deleteNode,
  type FileNode,
} from "@powerhousedao/shared/document-drive";
import { cbToast } from "../cbToast.js";
import { EmptyState } from "../EmptyState.js";
import { HeaderControls } from "./HeaderControls.js";
import { InvoiceTableSection } from "./InvoiceTableSection.js";
import { InvoiceTableRow, type InvoiceRowData } from "./InvoiceTableRow.js";

/**
 * Invoice table for a month's Payments folder.
 *
 * Ported from contributor-billing minus billing-statement generation, the
 * Xero CSV / expense-report exports and the integrations shortcut -- those
 * depend on document models and scripts that are not part of this package.
 */

// Helper type for invoice document state access
interface InvoiceGlobalState {
  status?: string;
  issuer?: { name?: string };
  invoiceNo?: string;
  dateIssued?: string;
  dateDue?: string;
  currency?: string;
  totalPriceTaxIncl?: number;
  exported?: { timestamp?: string; exportedLineItems?: unknown[] };
  notes?: string;
}

// Status options for filter
export const statusOptions = [
  { label: "Draft", value: "DRAFT" },
  { label: "Issued", value: "ISSUED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Payment Scheduled", value: "PAYMENTSCHEDULED" },
  { label: "Payment Sent", value: "PAYMENTSENT" },
  { label: "Payment Issue", value: "PAYMENTISSUE" },
  { label: "Payment Closed", value: "PAYMENTCLOSED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Other", value: "OTHER" },
];

// Status color mappings
const statusColors: Record<string, string> = {
  DRAFT: "bg-info/20 text-info",
  ISSUED: "bg-info/20 text-info",
  ACCEPTED: "bg-success/20 text-success",
  PAYMENTSCHEDULED: "bg-success/20 text-success",
  PAYMENTSENT: "bg-success/20 text-success",
  PAYMENTISSUE: "bg-warning/15 text-warning",
  PAYMENTCLOSED: "bg-destructive/15 text-destructive",
  REJECTED: "bg-destructive/15 text-destructive",
  OTHER: "bg-info/20 text-info",
};

interface InvoiceTableProps {
  files: FileNode[];
  selected: Record<string, boolean>;
  setSelected: (
    selected:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  filteredDocumentModels: DocumentModelModule[];
  onSelectDocumentModel: (model: DocumentModelModule, name: string) => void;
  selectedStatuses: string[];
  onStatusChange: (value: string | string[]) => void;
  onRowSelection: (rowId: string, checked: boolean, rowStatus: string) => void;
}

// Table header component
const TableHeader = ({ showIssuer = true }: { showIssuer?: boolean }) => (
  <thead>
    <tr className="bg-muted font-medium text-muted-foreground text-xs">
      <th className="px-2 py-2 w-8 rounded-tl-sm" />
      <th className="px-2 py-2 text-center">
        {showIssuer ? "Issuer" : "Invoice"}
      </th>
      <th className="px-2 py-2 text-center">Invoice No.</th>
      <th className="px-2 py-2 text-center">Issue Date</th>
      <th className="px-2 py-2 text-center">Due Date</th>
      <th className="px-2 py-2 text-center">Currency</th>
      <th className="px-2 py-2 text-center">Amount</th>
      <th className="px-2 py-2 rounded-tr-sm text-center">Exported</th>
    </tr>
  </thead>
);

export const InvoiceTable = ({
  files,
  selected,
  setSelected,
  filteredDocumentModels,
  onSelectDocumentModel,
  selectedStatuses,
  onStatusChange,
  onRowSelection,
}: InvoiceTableProps) => {
  const [selectedDrive] = useSelectedDrive();

  // Get documents directly from the hook - this will automatically update
  // when documents change. No `|| []` fallback here: that would build a fresh
  // array every render and defeat every useMemo depending on it.
  const documentsInDrive = useDocumentsInSelectedDrive();

  // Build a set of file IDs from the files prop for quick lookup
  const fileIds = useMemo(() => {
    return new Set(files.map((f) => f.id));
  }, [files]);

  // Build a map of document IDs to documents for quick lookup
  const documentsById = useMemo(() => {
    const map = new Map<string, PHDocument>();
    for (const doc of documentsInDrive ?? []) {
      map.set(doc.header.id, doc);
    }
    return map;
  }, [documentsInDrive]);

  // Filter documents to only those in the current folder (matching the files prop)
  const allDocuments = useMemo(() => {
    return (documentsInDrive ?? []).filter((doc) => fileIds.has(doc.header.id));
  }, [documentsInDrive, fileIds]);

  // Find files that are in the folder but don't have document content loaded yet
  const loadingFileIds = useMemo(() => {
    return files
      .filter(
        (f) =>
          f.documentType === "powerhouse/invoice" && !documentsById.has(f.id),
      )
      .map((f) => f.id);
  }, [files, documentsById]);

  // Helper function to map invoice document to InvoiceRowData
  const mapInvoiceToRowData = (doc: PHDocument): InvoiceRowData => {
    const state = doc.state as unknown as { global: InvoiceGlobalState };
    return {
      id: doc.header.id,
      issuer: state.global?.issuer?.name || "Unknown",
      status: state.global?.status || "",
      invoiceNo: state.global?.invoiceNo || "",
      issueDate: state.global?.dateIssued || "",
      dueDate: state.global?.dateDue || "",
      currency: state.global?.currency || "",
      amount: state.global?.totalPriceTaxIncl?.toString() || "",
      exported: state.global?.exported,
    };
  };

  // Bucket invoices by status in one pass
  const buckets = useMemo(() => {
    const byStatus = (status: string) =>
      allDocuments
        .filter((doc) => {
          if (doc.header.documentType !== "powerhouse/invoice") return false;
          const state = doc.state as unknown as { global: InvoiceGlobalState };
          return state.global?.status === status;
        })
        .map(mapInvoiceToRowData);

    const knownStatuses = [
      "DRAFT",
      "ISSUED",
      "ACCEPTED",
      "PAYMENTSCHEDULED",
      "PAYMENTSENT",
      "PAYMENTISSUE",
      "PAYMENTCLOSED",
      "REJECTED",
    ];
    const other = allDocuments
      .filter((doc) => {
        if (doc.header.documentType !== "powerhouse/invoice") return false;
        const state = doc.state as unknown as { global: InvoiceGlobalState };
        return !knownStatuses.includes(state.global?.status || "");
      })
      .map((doc) => ({
        ...mapInvoiceToRowData(doc),
        status:
          (doc.state as unknown as { global: InvoiceGlobalState }).global
            ?.status || "OTHER",
      }));

    return {
      draft: byStatus("DRAFT"),
      issued: byStatus("ISSUED"),
      accepted: byStatus("ACCEPTED"),
      paymentScheduled: byStatus("PAYMENTSCHEDULED"),
      paymentSent: byStatus("PAYMENTSENT"),
      paymentIssue: byStatus("PAYMENTISSUE"),
      paymentClosed: byStatus("PAYMENTCLOSED"),
      rejected: byStatus("REJECTED"),
      other,
    };
  }, [allDocuments]);

  // Check if section should be shown based on filter
  const shouldShowSection = (status: string) =>
    selectedStatuses.length === 0 || selectedStatuses.includes(status);

  // Delete selected documents from the drive
  const handleDeleteSelected = async (ids: string[]) => {
    const driveId = selectedDrive?.header.id;
    if (!driveId) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        await dispatchActions(deleteNode({ id }), driveId);
        successCount++;
      } catch (error) {
        console.error(`Failed to delete document ${id}:`, error);
        failCount++;
      }
    }

    if (failCount === 0) {
      cbToast(
        `${successCount} document${successCount !== 1 ? "s" : ""} deleted`,
        { type: "success" },
      );
    } else if (successCount === 0) {
      cbToast(
        `Failed to delete ${failCount} document${failCount !== 1 ? "s" : ""}`,
        {
          type: "error",
        },
      );
    } else {
      cbToast(`${successCount} deleted, ${failCount} failed`, {
        type: "warning",
      });
    }
  };

  // Render section with table
  const renderSection = (
    status: string,
    title: string,
    data: InvoiceRowData[],
    options?: {
      showIssuer?: boolean;
      showCreateButton?: boolean;
    },
  ) => {
    if (!shouldShowSection(status)) return null;

    const { showIssuer = true, showCreateButton = false } = options || {};

    return (
      <InvoiceTableSection
        title={title}
        count={data.length}
        color={statusColors[status] || statusColors.OTHER}
        onSelectDocumentModel={
          showCreateButton ? onSelectDocumentModel : undefined
        }
        filteredDocumentModels={
          showCreateButton ? filteredDocumentModels : undefined
        }
      >
        <table className="w-full text-xs rounded-sm border-separate border-spacing-0 border border-border overflow-hidden">
          <TableHeader showIssuer={showIssuer} />
          <tbody>
            {data.map((row) => (
              <InvoiceTableRow
                key={row.id}
                files={files}
                row={row}
                isSelected={!!selected[row.id]}
                onSelect={(checked) =>
                  onRowSelection(row.id, checked, row.status)
                }
                showIssuerColumn={showIssuer}
              />
            ))}
          </tbody>
        </table>
      </InvoiceTableSection>
    );
  };

  return (
    <div className="contributor-billing-table w-full h-full bg-card rounded-lg p-4 border border-border shadow-sm mt-4 overflow-x-auto">
      <HeaderControls
        statusOptions={statusOptions}
        selectedStatuses={selectedStatuses}
        onStatusChange={onStatusChange}
        selected={selected}
        setSelected={setSelected}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Status Sections */}
      {renderSection("DRAFT", "Draft", buckets.draft, {
        showIssuer: false,
        showCreateButton: true,
      })}
      {renderSection("ISSUED", "Issued", buckets.issued)}
      {renderSection("ACCEPTED", "Accepted", buckets.accepted)}
      {renderSection(
        "PAYMENTSCHEDULED",
        "Payment Scheduled",
        buckets.paymentScheduled,
      )}
      {renderSection("PAYMENTSENT", "Payment Sent", buckets.paymentSent)}
      {renderSection("PAYMENTISSUE", "Payment Issue", buckets.paymentIssue)}
      {renderSection("PAYMENTCLOSED", "Payment Closed", buckets.paymentClosed)}
      {renderSection("REJECTED", "Rejected", buckets.rejected)}
      {renderSection("OTHER", "Other", buckets.other)}

      {files.length === 0 && loadingFileIds.length === 0 && (
        <EmptyState
          title="No invoices yet"
          description="Create a new invoice using the Draft section above, or drop an invoice file here"
        />
      )}

      {/* Loading section for files that haven't loaded yet */}
      {loadingFileIds.length > 0 && (
        <InvoiceTableSection
          title="Loading"
          count={loadingFileIds.length}
          color="bg-muted text-muted-foreground"
        >
          <table className="w-full text-xs rounded-sm border-separate border-spacing-0 border border-border overflow-hidden">
            <thead>
              <tr className="bg-muted font-medium text-muted-foreground text-xs">
                <th className="px-2 py-2 w-8 rounded-tl-sm" />
                <th className="px-2 py-2 text-center">Invoice</th>
                <th className="px-2 py-2 text-center">Invoice No.</th>
                <th className="px-2 py-2 text-center">Issue Date</th>
                <th className="px-2 py-2 text-center">Due Date</th>
                <th className="px-2 py-2 text-center">Currency</th>
                <th className="px-2 py-2 text-center">Amount</th>
                <th className="px-2 py-2 rounded-tr-sm text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingFileIds.map((id) => {
                const file = files.find((f) => f.id === id);
                return (
                  <tr key={id} className="border-t border-border animate-pulse">
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2 text-center text-muted-foreground">
                      {file?.name || "Loading..."}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="h-4 bg-muted rounded w-16 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="h-4 bg-muted rounded w-20 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="h-4 bg-muted rounded w-20 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="h-4 bg-muted rounded w-12 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="h-4 bg-muted rounded w-16 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-xs text-muted-foreground">
                        Loading...
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </InvoiceTableSection>
      )}
    </div>
  );
};
