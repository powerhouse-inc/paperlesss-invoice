import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const MIN_PCT = 30;
const MAX_PCT = 70;
const DEFAULT_PCT = 50;

const clampPct = (pct: number) => Math.min(MAX_PCT, Math.max(MIN_PCT, pct));

function readStored(key: string | undefined): number {
  if (!key || typeof window === "undefined") return DEFAULT_PCT;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return DEFAULT_PCT;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? clampPct(parsed) : DEFAULT_PCT;
}

interface SplitPaneProps {
  readonly left: ReactNode;
  readonly right: ReactNode;
  /** When set, the divider position survives reloads. */
  readonly storageKey?: string;
  /**
   * Size the pane to the remaining viewport height instead of to its content.
   * This is what makes each side scroll internally rather than stretching the
   * page: without it, a long document in either pane grows the whole editor.
   */
  readonly fillViewport?: boolean;
}

/**
 * Two panes with a divider the user can drag.
 *
 * The divider is a `separator` with keyboard support, not just a mousedown
 * target — a drag-only handle would be unreachable without a pointer. Width is
 * held as a percentage so the split survives window resizes, and clamped so
 * neither pane can be collapsed to nothing (a pane dragged to zero looks
 * identical to a bug).
 */
export function SplitPane({
  left,
  right,
  storageKey,
  fillViewport = false,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftPct, setLeftPct] = useState(() => readStored(storageKey));
  const [isDragging, setIsDragging] = useState(false);
  const [fillHeight, setFillHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!fillViewport) return;
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const { top } = el.getBoundingClientRect();
      // Small gutter so the box never sits flush against the window edge, and
      // a floor so it stays usable if something reports a silly offset.
      setFillHeight(Math.max(320, window.innerHeight - top - 8));
    };
    // Defer the first read to after layout, otherwise `top` is measured before
    // the navbar above us has settled.
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [fillViewport]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, String(leftPct));
  }, [storageKey, leftPct]);

  const applyClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    setLeftPct(clampPct(((clientX - rect.left) / rect.width) * 100));
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    // Capture on the divider itself so the drag keeps tracking even when the
    // pointer crosses the PDF canvas, which would otherwise swallow the moves.
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isDragging) return;
      applyClientX(event.clientX);
    },
    [isDragging, applyClientX],
  );

  const endDrag = useCallback((event: React.PointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  }, []);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setLeftPct((p) => clampPct(p - 2));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setLeftPct((p) => clampPct(p + 2));
    } else if (event.key === "Home") {
      event.preventDefault();
      setLeftPct(DEFAULT_PCT);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 overflow-hidden"
      style={fillHeight === null ? undefined : { height: fillHeight }}
    >
      <div className="min-w-0 overflow-auto" style={{ width: `${leftPct}%` }}>
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftPct)}
        aria-valuemin={MIN_PCT}
        aria-valuemax={MAX_PCT}
        aria-label="Resize invoice and PDF panes"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        // A 1px border is the visual; the hit area is deliberately wider than
        // the line so the handle is grabbable without pixel-hunting.
        className={`group relative w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/60 focus:bg-primary focus:outline-none ${
          isDragging ? "bg-primary" : ""
        }`}
      >
        <span className="absolute inset-y-0 -left-1 -right-1 block" />
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">{right}</div>

      {/* While dragging, a full-surface overlay stops the pointer selecting
          text or landing on the canvas mid-drag. */}
      {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  );
}

export default SplitPane;
