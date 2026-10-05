"use client";

import { useMemo, type ReactNode } from "react";

/**
 * Shows assessment text with the deterrents from PRD section 27: no selection, copy, cut,
 * drag or context menu, a session watermark, blurring when the person looks away, and no
 * printing. A browser cannot stop a photo of the screen, so this deters and the server detects.
 * The answer boxes are NOT inside this component and stay fully editable.
 */
export function ProtectedContent({
  watermark,
  away,
  children,
}: {
  watermark: string;
  away: boolean;
  children: ReactNode;
}) {
  const pattern = useMemo(() => {
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='150'>` +
      `<text x='20' y='90' transform='rotate(-20 140 75)' font-family='sans-serif' font-size='15' font-weight='600' ` +
      `fill='#17334B' fill-opacity='0.07'>${watermark}</text></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [watermark]);

  const stop = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className="protected-content relative overflow-hidden rounded-lg border border-border bg-white p-6 sm:p-8"
      onContextMenu={stop}
      onCopy={stop}
      onCut={stop}
      onDragStart={stop}
    >
      <div className={away ? "pointer-events-none blur-md transition" : "transition"} aria-hidden={away || undefined}>
        {children}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: pattern }} />
      {away && (
        <div role="status" className="absolute inset-0 grid place-items-center bg-white/60 text-center font-semibold text-nile">
          Return to this tab to continue.
        </div>
      )}
      <p className="mt-5 text-xs text-text-muted">Baytul Wisaal • Assessment Session • {watermark}</p>
    </div>
  );
}
