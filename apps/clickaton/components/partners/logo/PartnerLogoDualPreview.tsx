"use client";

import { cn } from "@/lib/cn";

type Props = {
  src?: string | null;
  alt?: string;
  transparencyHint?: boolean;
  className?: string;
};

/**
 * Vista dual del logo sobre fondo claro y oscuro (object-contain).
 * Con transparencyHint, muestra damero sutil para sugerir transparencia.
 */
export function PartnerLogoDualPreview({
  src,
  alt = "Vista previa del logo",
  transparencyHint = false,
  className,
}: Props) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <PreviewPane
        label="Fondo claro"
        tone="light"
        src={src}
        alt={`${alt} (fondo claro)`}
        transparencyHint={transparencyHint}
      />
      <PreviewPane
        label="Fondo oscuro"
        tone="dark"
        src={src}
        alt={`${alt} (fondo oscuro)`}
        transparencyHint={transparencyHint}
      />
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
  tone: "light" | "dark";
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
