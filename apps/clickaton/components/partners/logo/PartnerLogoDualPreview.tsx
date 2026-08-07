"use client";

import { cn } from "@/lib/cn";
import type { PartnerLogoPreviewKind } from "./PartnerLogoVariantCard";

export type PartnerLogoPreviewTone = "light" | "dark";

type Props = {
  src?: string | null;
  alt?: string;
  transparencyHint?: boolean;
  className?: string;
  /**
   * Fondos a mostrar. Si no se pasa, se deduce de `previewKind`
   * (logo oscuro → solo claro; logo claro → solo oscuro; resto → ambos).
   */
  tones?: readonly PartnerLogoPreviewTone[];
  previewKind?: PartnerLogoPreviewKind;
};

/** Tonos de preview según variante de logo. */
export function tonesForPartnerLogoPreviewKind(
  kind: PartnerLogoPreviewKind | undefined,
): readonly PartnerLogoPreviewTone[] {
  if (kind === "light") return ["light"];
  if (kind === "dark") return ["dark"];
  return ["light", "dark"];
}

/**
 * Vista del logo sobre el/los fondos relevantes (object-contain).
 * Con transparencyHint, muestra damero sutil para sugerir transparencia.
 */
export function PartnerLogoDualPreview({
  src,
  alt = "Vista previa del logo",
  transparencyHint = false,
  className,
  tones,
  previewKind,
}: Props) {
  const panes = tones ?? tonesForPartnerLogoPreviewKind(previewKind);
  const multi = panes.length > 1;

  return (
    <div className={cn(multi ? "grid grid-cols-2 gap-3" : "grid grid-cols-1", className)}>
      {panes.map((tone) => (
        <PreviewPane
          key={tone}
          label={tone === "light" ? "Fondo claro" : "Fondo oscuro"}
          tone={tone}
          src={src}
          alt={`${alt} (${tone === "light" ? "fondo claro" : "fondo oscuro"})`}
          transparencyHint={transparencyHint}
        />
      ))}
    </div>
  );
}

function PreviewPane({
  label,
  tone,
  src,
  alt,
  transparencyHint,
}: {
  label: string;
  tone: PartnerLogoPreviewTone;
  src?: string | null;
  alt: string;
  transparencyHint: boolean;
}) {
  const isLight = tone === "light";
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-ck-text-muted">{label}</p>
      <div
        className={cn(
          "relative flex h-28 items-center justify-center overflow-hidden rounded-lg border border-ck-border p-3 sm:h-32",
          isLight ? "bg-white" : "bg-[#0a0a0a]",
          transparencyHint && "partner-logo-checkerboard",
        )}
        style={
          transparencyHint
            ? {
                backgroundImage: isLight
                  ? "linear-gradient(45deg, #e8e8e8 25%, transparent 25%), linear-gradient(-45deg, #e8e8e8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e8e8e8 75%), linear-gradient(-45deg, transparent 75%, #e8e8e8 75%)"
                  : "linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                backgroundColor: isLight ? "#ffffff" : "#0a0a0a",
              }
            : undefined
        }
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
        ) : (
          <span
            className={cn(
              "text-xs",
              isLight ? "text-neutral-400" : "text-ck-text-muted",
            )}
          >
            Sin archivo
          </span>
        )}
      </div>
    </div>
  );
}
