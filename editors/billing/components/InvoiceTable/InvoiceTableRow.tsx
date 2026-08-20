import { FileItem } from "@powerhousedao/design-system/connect";
import type { FileNode } from "@powerhousedao/shared/document-drive";

export interface InvoiceRowData {
  id: string;
  issuer?: string;
  status: string;
  invoiceNo?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  amount?: string;
  exported?: {
    timestamp?: string;
    exportedLineItems?: unknown[];
  };
}

interface InvoiceTableRowProps {
  files?: FileNode[];
  row: InvoiceRowData;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  showIssuerColumn?: boolean;
}

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

const formatAmount = (amount: string | number | undefined): string => {
  if (amount === undefined) return "0.00";
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "0.00";
  return numAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** Format a date string without timezone conversion */
const formatDateUTC = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { timeZone: "UTC" });
};

export const InvoiceTableRow = ({
  files,
  row,
  isSelected,
  onSelect,
  showIssuerColumn = true,
}: InvoiceTableRowProps) => {
  const invoiceFile = files?.find((file) => file.id === row.id);
  const hasExportedData =
    row.exported != null && Boolean(row.exported.timestamp?.trim());

  return (
    <tr className="hover:bg-accent transition-colors">
      {/* Checkbox */}
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
        />
      </td>

      {/* Invoice/Issuer Column.
          FileItem's own surface is `bg-muted`, and in dark mode the design system
          resolves --muted and --card to the same slate-700 - so the tile vanishes
          against the table's bg-card (it reads fine in light, where they differ).
          FileItem merges className through twMerge, so a background passed here
          wins. A --foreground overlay lifts the tile off the card in BOTH themes
          rather than needing a dark-only override. */}
      <td className="py-1 px-2">
        {showIssuerColumn ? (
          invoiceFile ? (
            <FileItem fileNode={invoiceFile} className="h-8 bg-foreground/10" />
          ) : (
            <span className="text-muted-foreground">
              {row.issuer || "Unknown"}
            </span>
          )
        ) : invoiceFile ? (
          <FileItem fileNode={invoiceFile} className="h-8 bg-foreground/10" />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Invoice No */}
      <td className="px-2 py-2 text-center text-xs text-foreground">
        {row.invoiceNo || "-"}
      </td>

      {/* Issue Date */}
      <td className="px-2 py-2 text-center text-xs text-foreground">
        {row.issueDate ? formatDateUTC(row.issueDate) : "-"}
      </td>

      {/* Due Date */}
      <td className="px-2 py-2 text-center text-xs text-foreground">
        {row.dueDate ? formatDateUTC(row.dueDate) : "-"}
      </td>

      {/* Currency */}
      <td className="px-2 py-2 text-center text-xs text-foreground">
        {row.currency || "-"}
      </td>

      {/* Amount */}
      <td className="px-2 py-2 text-center text-xs font-medium text-foreground">
        {formatAmount(row.amount)}
      </td>

      {/* Exported Status */}
      <td className="px-2 py-2 text-center">
        {hasExportedData ? (
          <div className="flex flex-col items-center">
            <span className="text-success text-xs font-medium">Yes</span>
            <span className="text-success text-xs">
              {formatTimestamp(row.exported!.timestamp!)}
            </span>
          </div>
        ) : (
          <span className="text-destructive text-xs">No</span>
        )}
      </td>
    </tr>
  );
};
