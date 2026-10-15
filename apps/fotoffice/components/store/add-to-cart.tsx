"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { lineKey } from "@/lib/store/cart";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { maxAddableQty, type StoreProductDetail } from "@/lib/store/storefront";
import { useCart } from "./cart-provider";
import { Price } from "./price";
import { SizeChartDialog } from "./size-chart-dialog";
import { VariantPicker } from "./variant-picker";

/**
 * La compra desde la ficha: talle (si tiene), cantidad y "Agregar al carrito".
 *
 * La cantidad se acota a lo que se puede agregar de verdad: lo disponible, el máximo por compra y
 * lo que ya está en el carrito. Es una ayuda, no la garantía: el carrito y el checkout revalidan
 * en el servidor.
 */
export function AddToCart({ product }: { product: StoreProductDetail }) {
  const cart = useCart();
  const tieneTalles = product.variants.length > 0;
  const disponibles = product.variants.filter((v) => v.available !== 0);
  const [variantId, setVariantId] = useState<string | null>(
    tieneTalles && disponibles.length === 1 ? disponibles[0].id : null,
  );
  const [qty, setQty] = useState(1);
  const [agregado, setAgregado] = useState(false);

  const talle = tieneTalles ? (product.variants.find((v) => v.id === variantId) ?? null) : null;
  const precio = talle ? talle.priceMinor : product.priceMinor;
  const available = tieneTalles ? (talle?.available ?? null) : product.available;

  const enCarritoLinea = cart.state.lines.find((l) => lineKey(l) === lineKey({ productId: product.productId, variantId }))?.qty ?? 0;
  const enCarritoProducto = cart.state.lines
    .filter((l) => l.kind === "product" && l.productId === product.productId)
    .reduce((s, l) => s + l.qty, 0);
  const maximo = maxAddableQty({
    available,
    maxPerOrder: product.maxPerOrder,
    inCartLine: enCarritoLinea,
    inCartProduct: enCarritoProducto,
  });
  const cantidad = Math.min(Math.max(1, qty), Math.max(1, maximo));

  const faltaTalle = tieneTalles && !talle;
  const puedeAgregar = cart.hydrated && !product.soldOut && !faltaTalle && maximo > 0;

  function agregar() {
    if (!puedeAgregar) return;
    cart.add({
      kind: "product",
      productId: product.productId,
      variantId: talle?.id ?? null,
      slug: product.slug,
      name: product.title,
      variantName: talle?.name ?? null,
      imageUrl: product.images[0]?.url ?? null,
      unitPriceMinor: precio,
      qty: cantidad,
    });
    setQty(1);
    setAgregado(true);
  }

  let aviso: string | null = null;
  if (product.soldOut) aviso = "Este producto está agotado.";
  else if (faltaTalle) aviso = "Elegí un talle.";
  else if (maximo === 0) {
    aviso =
      product.maxPerOrder !== null && enCarritoProducto >= product.maxPerOrder
        ? `Ya tenés en el carrito el máximo por compra (${product.maxPerOrder}).`
        : "Ya tenés en el carrito todas las unidades disponibles.";
  }

  return (
    <div className="space-y-5">
      <Price minor={precio} from={tieneTalles && !talle && new Set(product.variants.map((v) => v.priceMinor)).size > 1} className="block text-2xl font-semibold" />

      {tieneTalles ? (
        <div className="space-y-2">
          <VariantPicker
            variants={product.variants}
            value={variantId}
            onChange={(id) => {
              setVariantId(id);
              setQty(1);
              setAgregado(false);
            }}
          />
          {product.sizeChartImageUrl ? (
            <SizeChartDialog imageUrl={product.sizeChartImageUrl} productTitle={product.title} />
          ) : null}
        </div>
      ) : null}

      {available !== null && available > 0 && available <= 5 ? (
        <p className="text-sm text-[var(--fo-muted)]">
          {available === 1 ? "Queda 1 unidad." : `Quedan ${available} unidades.`}
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
      {product.maxPerOrder !== null && !aviso ? (
        <p className="text-xs text-[var(--fo-muted)]">Máximo {product.maxPerOrder} por compra.</p>
      ) : null}

      {agregado ? (
        <p className="text-sm" role="status">
          Listo, lo agregamos.{" "}
          <Link href={`/w/${cart.workspaceSlug}/${STORE_PUBLIC_SEGMENT}/carrito`} className="font-medium underline underline-offset-4">
            Ver el carrito
          </Link>
        </p>
      ) : null}
    </div>
  );
}
