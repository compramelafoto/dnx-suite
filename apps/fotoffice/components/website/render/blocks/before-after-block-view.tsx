"use client";

import { useState } from "react";
import type { BeforeAfterBlockConfig } from "@/lib/website/blocks";
import { isShowableImageUrl } from "@/lib/website/blocks-extra";
import { levelStyle } from "@/lib/website/typography";

/**
 * Antes/después: la foto «después» abajo y la «antes» encima, recortada hasta la barra. La barra
 * es un `<input type="range">` invisible que cubre toda la foto: se mueve con el mouse, con el dedo
 * (touch nativo del navegador) y con las flechas del teclado, y el lector de pantalla lo anuncia.
 * El render inicial es siempre al 50 %, igual en servidor y navegador. Sin las dos fotos, en el
 * sitio no se dibuja.
 */
export function BeforeAfterBlockView({ config, data }: { config: BeforeAfterBlockConfig; blockId?: string; data?: unknown }) {
  const [position, setPosition] = useState(50);
  const ready = isShowableImageUrl(config.beforeUrl) && isShowableImageUrl(config.afterUrl);
  if (!ready) {
    if (data !== undefined) return null;
    return (
      <section className="px-6 py-12">
        <p className="mx-auto max-w-3xl rounded-2xl border border-dashed p-8 text-center opacity-60" style={levelStyle("body", { color: true })}>
          Subí la foto de antes y la de después para ver el comparador.
        </p>
      </section>
    );
  }

  const before = config.beforeLabel.trim() || "Antes";
  const after = config.afterLabel.trim() || "Después";
  const alt = config.alt.trim();

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-4">
        {config.title.trim() ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        <div className="relative select-none overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.afterUrl} alt={alt ? `${alt} (${after})` : after} className="block h-auto w-full" draggable={false} />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={config.beforeUrl} alt={alt ? `${alt} (${before})` : before} className="h-full w-full object-cover" draggable={false} />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${position}%` }}>
            <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm text-black shadow">
              ⇔
            </span>
          </div>
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{before}</span>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{after}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            aria-label={`Comparar ${before.toLowerCase()} y ${after.toLowerCase()}`}
            aria-valuetext={`${position} % ${before.toLowerCase()}`}
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            style={{ touchAction: "pan-y" }}
          />
        </div>
      </div>
    </section>
  );
}
