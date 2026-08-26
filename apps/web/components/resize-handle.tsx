"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * A panel width in px, persisted per viewer.
 *
 * AppShell.Sidebar and AppShell.Aside both expose a `width` prop, which is the
 * seam the shell gives us. Driving that is preferable to wrapping either part in
 * Resizable.Group: the shell owns a documented min-h-0/min-w-0 chain and renders
 * the sidebar twice (column + drawer) for its CSS-only responsive switch, and a
 * second width authority inside that would fight both.
 *
 * Reads storage in an effect rather than in the initial state so the server and
 * the first client frame agree.
 */
export function usePanelWidth(key: string, initial: number, min: number, max: number) {
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null && Number.isFinite(Number(stored))) {
        setWidth(clamp(Number(stored), min, max));
      }
    } catch {
      // private mode, blocked storage: the default is fine
    }
  }, [key, min, max]);

  const resize = useCallback(
    (next: number) => {
      const w = clamp(Math.round(next), min, max);
      setWidth(w);
      try {
        localStorage.setItem(key, String(w));
      } catch {
        // nothing to do; the width still applies for this session
      }
    },
    [key, min, max],
  );

  const reset = useCallback(() => resize(initial), [resize, initial]);

  return { width, resize, reset, min, max };
}

type Props = {
  label: string;
  width: number;
  min: number;
  max: number;
  /** Which side the panel being resized is on: dragging away from it grows it. */
  edge: "start" | "end";
  onResize: (next: number) => void;
  onReset: () => void;
  className?: string;
};

export function ResizeHandle({
  label,
  width,
  min,
  max,
  edge,
  onResize,
  onReset,
  className = "",
}: Props) {
  const dragging = useRef(false);
  const origin = useRef({ x: 0, width: 0 });
  const sign = edge === "start" ? 1 : -1;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label} — drag, arrow keys, or double-click to reset`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        origin.current = { x: e.clientX, width };
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        onResize(origin.current.width + sign * (e.clientX - origin.current.x));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // capture already lost; nothing to release
        }
      }}
      onLostPointerCapture={() => {
        dragging.current = false;
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 48 : 16;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onResize(width - sign * step);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onResize(width + sign * step);
        } else if (e.key === "Home") {
          e.preventDefault();
          onResize(min);
        } else if (e.key === "End") {
          e.preventDefault();
          onResize(max);
        }
      }}
      className={`group relative w-(--rgc-space-2) shrink-0 cursor-col-resize touch-none select-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:transition-colors hover:before:bg-accent focus-visible:before:bg-accent focus-visible:outline-none ${className}`}
    />
  );
}
