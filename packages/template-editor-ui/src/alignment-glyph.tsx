import type { CanvasQuickAlignment } from "@repo/template-editor-core";

/** Icono de alineación respecto del marco (zona segura / lienzo en otras pantallas). */
export function AlignmentGlyph({ kind, className }: { kind: CanvasQuickAlignment; className?: string }) {
  const frame = (
    <rect
      x="1"
      y="1"
      width="14"
      height="14"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      opacity={0.38}
    />
  );
  switch (kind) {
    case "left":
      return (
        <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          {frame}
          <rect x="2" y="4.5" width="5.5" height="7" rx="0.75" fill="currentColor" />
        </svg>
      );
    case "center-x":
      return (
        <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          {frame}
          <rect x="5.25" y="4.5" width="5.5" height="7" rx="0.75" fill="currentColor" />
        </svg>
      );
    case "right":
      return (
        <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          {frame}
          <rect x="8.5" y="4.5" width="5.5" height="7" rx="0.75" fill="currentColor" />
        </svg>
      );
    case "top":
      return (
        <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          {frame}
          <rect x="4.5" y="2" width="7" height="5.5" rx="0.75" fill="currentColor" />
        </svg>
      );
    case "center-y":
      return (
        <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          {frame}
          <rect x="4.5" y="5.25" width="7" height="5.5" rx="0.75" fill="currentColor" />
        </svg>
      );
    case "bottom":
      return (
        <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          {frame}
          <rect x="4.5" y="8.5" width="7" height="5.5" rx="0.75" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}
