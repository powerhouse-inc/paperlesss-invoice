import { useState, useEffect, useCallback } from "react";

/**
 * Hook for a locally editable field that syncs from external value (e.g. document state)
 * and commits on blur/demand.
 *
 * Follows vercel-react-best-practices:
 * - Derived/sync logic isolated
 * - Reduces boilerplate effects + state in main component
 */
export function useSyncedField(
  externalValue: string | undefined | null,
  onCommit: (value: string) => void
) {
  const [localValue, setLocalValue] = useState(externalValue ?? "");

  // Sync from external when it changes (necessary for document-driven updates)
  useEffect(() => {
    if (externalValue !== undefined) {
      setLocalValue(externalValue || "");
    }
  }, [externalValue]);

  const commit = useCallback(() => {
    const current = localValue || "";
    if (externalValue !== current) {
      onCommit(current);
    }
  }, [localValue, externalValue, onCommit]);

  return {
    value: localValue,
    setValue: setLocalValue,
    commit,
  };
}
