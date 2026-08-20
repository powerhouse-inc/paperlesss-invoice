import { type MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Trash2, X } from "lucide-react";

interface AttachmentViewerModalProps {
  open: boolean;
  /** Object URL of the attachment (from `useAttachmentViewer`). */
  url: string | null;
  /** MIME type — decides `<img>` (image/*) vs `<iframe>` (PDF/other). */
  mimeType: string | null;
  fileName: string;
  /** Optional secondary line under the title (e.g. the line item total). */
  subtitle?: string;
  /**
   * When provided, a destructive "Remove" button is shown in the header. The
   * caller deletes the attachment and closes the viewer.
   */
  onRemove?: () => void;
  onClose: () => void;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;
// Fit target: a bit smaller than the viewport so the modal never fills the screen.
const FIT_W = 0.86;
const FIT_H = 0.8;
// Vertical space the modal's own chrome occupies inside that budget: the header
// (title + subtitle + zoom controls, ~5.25rem) plus the image container's
// padding (2rem). The image must leave room for both — otherwise the card,
// which is `overflow-hidden`, clips its bottom padding and rounded corners.
const CHROME_H = 116;
// Never collapse the frame below this, however short the viewport.
const MIN_FIT_H = 160;

type Size = { w: number; h: number };

/** On-screen size of the image at zoom 1: fit to viewport, never upscaled. */
function computeFit(natural: Size): Size {
  const maxW = window.innerWidth * FIT_W;
  const maxH = Math.max(MIN_FIT_H, window.innerHeight * FIT_H - CHROME_H);
  const s = Math.min(maxW / natural.w, maxH / natural.h, 1);
  return { w: natural.w * s, h: natural.h * s };
}

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +z.toFixed(3)));
}

/**
 * Read-only preview for a stored attachment that may be an image OR a PDF.
 *
 * - **Images**: the modal shrink-wraps the picture (capped so the picture plus
 *   the header and padding stay inside ~86vw × 80vh, never upscaled past fit).
 *   The frame stays a fixed size; the image scales *inside* it via CSS
 *   transform. Zoom with the +/- buttons, the mouse wheel, or a trackpad pinch
 *   (cursor over the image), then grab-and-drag to pan.
 * - **PDFs**: a large frame with the browser's native PDF viewer inside.
 *
 * Rendered via a portal so it escapes any transformed/containing ancestor.
 */
export function AttachmentViewerModal({
  open,
  url,
  mimeType,
  fileName,
  subtitle,
  onRemove,
  onClose,
}: AttachmentViewerModalProps) {
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState<Size | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Latest-value refs so the native wheel listener isn't rebound every render.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const fitRef = useRef<Size | null>(null);

  // Reset zoom/pan/measured size whenever a different attachment opens.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNatural(null);
  }, [url]);

  const isImage = !!url && (mimeType ?? "").startsWith("image/");
  const fit = isImage && natural ? computeFit(natural) : null;
  zoomRef.current = zoom;
  panRef.current = pan;
  fitRef.current = fit;

  // Clamp a pan offset so the zoomed image can't be dragged past its own edges.
  const clampPan = (x: number, y: number, z: number, f: Size | null) => {
    if (!f) return { x: 0, y: 0 };
    const maxX = (f.w * (z - 1)) / 2;
    const maxY = (f.h * (z - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  // Wheel / pinch zoom, anchored on the cursor. Native + non-passive so we can
  // preventDefault (otherwise ctrl+wheel pinch zooms the whole browser page).
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = fitRef.current;
      if (!f) return;
      const z0 = zoomRef.current;
      const dy = Math.max(-120, Math.min(120, e.deltaY));
      const z1 = clampZoom(z0 * Math.exp(-dy * 0.0015));
      if (z1 === z0) return;
      // Keep the point under the cursor fixed while zooming.
      const rect = node.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      const p0 = panRef.current;
      const ratio = z1 / z0;
      const next =
        z1 <= 1
          ? { x: 0, y: 0 }
          : clampPan(cx - (cx - p0.x) * ratio, cy - (cy - p0.y) * ratio, z1, f);
      setZoom(z1);
      setPan(next);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
    // Re-bind when the frame (re)appears or resizes for a new image.
  }, [fit?.w, fit?.h]);

  if (!open || !url) return null;

  const applyZoom = (next: number) => {
    const z = clampZoom(next);
    setZoom(z);
    setPan((p) => (z <= 1 ? { x: 0, y: 0 } : clampPan(p.x, p.y, z, fit)));
  };

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const d = dragStart.current;
    if (!d) return;
    setPan(
      clampPan(d.panX + (e.clientX - d.x), d.panY + (e.clientY - d.y), zoom, fit),
    );
  };
  const endDrag = () => {
    dragStart.current = null;
    setDragging(false);
  };

  const cardClass = isImage
    ? "bg-card rounded-2xl shadow-lg max-w-[90vw] max-h-[90vh] flex flex-col overflow-hidden"
    : "bg-card rounded-2xl shadow-lg w-full max-w-5xl h-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        // Close when pressing directly on the backdrop; ignore drags that start
        // on the image/card (their target isn't the backdrop).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cardClass}>
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2
              className="text-xl font-semibold text-foreground truncate"
              title={fileName}
            >
              {fileName}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {subtitle ?? "Attached to this line item."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isImage && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => applyZoom(zoom - ZOOM_STEP)}
                  disabled={zoom <= ZOOM_MIN}
                  className="rounded border border-input p-1.5 text-foreground hover:bg-accent disabled:opacity-40"
                  aria-label="Zoom out"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => applyZoom(1)}
                  className="min-w-[3.5rem] rounded border border-input px-2 py-1 text-xs text-foreground hover:bg-accent"
                  title="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => applyZoom(zoom + ZOOM_STEP)}
                  disabled={zoom >= ZOOM_MAX}
                  className="rounded border border-input p-1.5 text-foreground hover:bg-accent disabled:opacity-40"
                  aria-label="Zoom in"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="text-destructive hover:text-destructive/80 transition-colors"
                aria-label="Remove receipt"
                title="Remove receipt"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {isImage ? (
          <div className="bg-background flex justify-center p-4">
            {fit ? (
              // Fixed viewport: the frame stays put while the image scales inside.
              <div
                ref={frameRef}
                className="relative overflow-hidden select-none touch-none"
                style={{
                  width: fit.w,
                  height: fit.h,
                  cursor:
                    zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
              >
                <img
                  src={url}
                  alt={fileName}
                  draggable={false}
                  className="block h-full w-full object-contain"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            ) : (
              // Pre-measure: load the image (capped) so we learn its dimensions.
              <img
                src={url}
                alt={fileName}
                onLoad={(e) =>
                  setNatural({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                className="object-contain max-w-[86vw] max-h-[calc(80vh-7.25rem)]"
              />
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-background">
            <iframe src={url} title={fileName} className="w-full h-full" />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
