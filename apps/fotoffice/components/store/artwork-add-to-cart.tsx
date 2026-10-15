"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { CART_MAX_ARTWORK_QTY, lineKey } from "@/lib/store/cart";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { printFormatLabel, printFormatSize } from "@/lib/store/artworks/format-label";
import type { PublicArtworkDetail } from "@/lib/store/artworks/storefront";
import { useCart } from "./cart-provider";
import { Price } from "./price";

/**
 * La compra desde la ficha de una obra: formato (los que su resolución alcanza, con precio y
 * medidas), cantidad y "Agregar al carrito". Si el formato no tiene la proporción de la foto, se
 * avisa que se imprime completa, con bordes. El precio que se muestra es una ayuda: el carrito y
 * el checkout lo revalidan en el servidor.
 */
export function ArtworkAddToCart({ artwork }: { artwork: PublicArtworkDetail }) {
  const cart = useCart();
  const [formatId, setFormatId] = useState<string | null>(artwork.formats.length === 1 ? artwork.formats[0].id : null);
  const [qty, setQty] = useState(1);
  const [agregado, setAgregado] = useState(false);

  const formato = artwork.formats.find((f) => f.id === formatId) ?? null;
  const enCarrito = formato
    ? (cart.state.lines.find(
        (l) => lineKey(l) === lineKey({ kind: "artwork", artworkListingId: artwork.listingId, printFormatId: formato.id }),
      )?.qty ?? 0)
    : 0;
  const maximo = Math.max(0, CART_MAX_ARTWORK_QTY - enCarrito);
  const cantidad = Math.min(Math.max(1, qty), Math.max(1, maximo));
  const puedeAgregar = cart.hydrated && formato !== null && maximo > 0;
  const variosPrecios = new Set(artwork.formats.map((f) => f.priceMinor)).size > 1;

  function agregar() {
    if (!puedeAgregar || !formato) return;
    cart.add({
      kind: "artwork",
      artworkListingId: artwork.listingId,
      printFormatId: formato.id,
      slug: artwork.slug,
      title: artwork.title,
      formatName: printFormatLabel(formato),
      imageUrl: artwork.imageUrl,
      unitPriceMinor: formato.priceMinor,
      qty: cantidad,
    });
    setQty(1);
    setAgregado(true);
  }

  let aviso: string | null = null;
  if (!formato) aviso = "Elegí un formato.";
  else if (maximo === 0) aviso = `Ya tenés en el carrito el máximo de ${CART_MAX_ARTWORK_QTY} copias en este formato.`;

  return (
    <div className="space-y-5">
      <Price
        minor={formato ? formato.priceMinor : artwork.fromPriceMinor}
        from={!formato && variosPrecios}
        className="block text-2xl font-semibold"
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Formato</legend>
        <div className="grid gap-2" role="radiogroup">
          {artwork.formats.map((f) => {
            const elegido = f.id === formatId;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={elegido}
                onClick={() => {
                  setFormatId(f.id);
                  setQty(1);
                  setAgregado(false);
                }}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--fo-radius-sm)] border px-4 py-2 text-left text-sm transition-colors ${
                  elegido
                    ? "border-[var(--fo-accent)] ring-1 ring-[var(--fo-accent)]"
                    : "border-[var(--fo-border-strong)] bg-[var(--fo-surface)] hover:border-[var(--fo-text)]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-medium break-words">{f.name}</span>
                  <span className="block text-xs text-[var(--fo-muted)]">{printFormatSize(f)}</span>
                </span>
                <Price minor={f.priceMinor} className="shrink-0 font-semibold" />
              </button>
            );
          })}
        </div>
      </fieldset>

      {formato?.needsBorders ? (
        <p className="fo-card p-3 text-sm text-[var(--fo-text-secondary)]">
          La foto no tiene la misma proporción que este formato: se imprime completa, sin recortar, con bordes blancos.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-[var(--fo-radius-sm)] border border-[var(--fo-border-strong)]" role="group" aria-label="Cantidad">
          <button
            type="button"
            onClick={() => setQty(cantidad - 1)}
            disabled={!puedeAgregar || cantidad <= 1}
            aria-label="Una menos"
            className="inline-flex h-11 w-11 items-center justify-center disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
            {cantidad}
          </span>
          <button
            type="button"
            onClick={() => setQty(cantidad + 1)}
            disabled={!puedeAgregar || cantidad >= maximo}
            aria-label="Una más"
            className="inline-flex h-11 w-11 items-center justify-center disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <button type="button" onClick={agregar} disabled={!puedeAgregar} className="fo-btn fo-btn-primary flex-1 sm:flex-none">
          Agregar al carrito
        </button>
      </div>

      {aviso ? <p className="text-sm text-[var(--fo-muted)]">{aviso}</p> : null}

      {agregado ? (
        <p className="text-sm" role="status">
          Listo, la agregamos.{" "}
          <Link href={`/w/${cart.workspaceSlug}/${STORE_PUBLIC_SEGMENT}/carrito`} className="font-medium underline underline-offset-4">
            Ver el carrito
          </Link>
        </p>
      ) : null}
    </div>
  );
}
