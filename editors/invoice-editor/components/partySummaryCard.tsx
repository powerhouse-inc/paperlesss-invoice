import { Pencil } from "lucide-react";
import type { LegalEntity } from "document-models/invoice";

interface PartySummaryCardProps {
  /** Section heading, e.g. "Issuer" or "Payer". */
  readonly title: string;
  readonly entity: LegalEntity | null | undefined;
  /** Opens the full form. */
  readonly onEdit: () => void;
  /**
   * Marks the card when one of the party's fields failed validation. The full
   * messages live on the fields themselves inside the modal; without this the
   * only symptom of bad data would be a blocked status change.
   */
  readonly needsAttention?: boolean;
  /** False while the invoice is locked, which turns "Edit" into "View". */
  readonly editable?: boolean;
}

/**
 * One label/value pair, label first on the same line.
 *
 * Laid out with flex rather than a two-column grid: Tailwind does not generate
 * arbitrary `grid-cols-[...]` utilities in this project (which is why
 * `editor.tsx` sets `gridTemplateColumns` through inline styles), so a grid
 * class here silently does nothing and the pairs stack.
 */
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 truncate text-foreground">
        {value?.trim() ? (
          value
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

/**
 * Condensed, read-only view of an invoice party. The editable form is a
 * modal opened from here, so this card is what the editor shows by default.
 */
export function PartySummaryCard({
  title,
  entity,
  onEdit,
  needsAttention = false,
  editable = true,
}: PartySummaryCardProps) {
  const taxId = entity?.id?.taxId ?? entity?.id?.corpRegId ?? "";
  const location = [
    entity?.address?.city,
    entity?.address?.country ?? entity?.country,
  ]
    .filter((part) => part?.trim())
    .join(", ");
  const email = entity?.contactInfo?.email ?? "";
  const name = entity?.name ?? "";
  const isEmpty = ![name, taxId, location, email].some((v) => v.trim());

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {needsAttention && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
              Needs attention
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded border border-input bg-background px-3.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
        >
          <Pencil className="h-3 w-3" aria-hidden />
          {editable ? "Edit" : "View"}
          <span className="sr-only"> {title} details</span>
        </button>
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          No {title.toLowerCase()} details yet.
        </p>
      ) : (
        <div>
          <p className="truncate text-lg font-medium text-foreground">
            {name.trim() ? (
              name
            ) : (
              <span className="text-muted-foreground">Unnamed</span>
            )}
          </p>
          <dl className="mt-2 flex flex-col gap-1.5">
            <Row label="Tax ID" value={taxId} />
            <Row label="Location" value={location} />
            <Row label="Email" value={email} />
          </dl>
        </div>
      )}
    </div>
  );
}
