"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lineKey, type CartLine } from "@/lib/store/cart";
import type { CartProblem } from "@/lib/store/storefront";
import { validateCartAction } from "@/app/w/[workspaceSlug]/tienda/carrito/actions";
import { useCart } from "./cart-provider";

/** Todo lo que el servidor puede corregir de una línea. Si cambia, hay que volver a validar. */
function firma(lines: CartLine[]): string {
  return JSON.stringify(
    lines.map((l) => [lineKey(l), l.qty, l.unitPriceMinor, l.name, l.variantName, l.slug, l.imageUrl]),
  );
}

/**
 * Revalida el carrito en el servidor (`validateCartAction`) cada vez que cambia, y lo reemplaza
 * por las líneas comprables con precio y nombre actuales. La firma del último resultado evita
 * volver a validar lo que el propio servidor acaba de corregir. La usan el carrito y el checkout.
 *
 * `revalidate()` fuerza una vuelta aunque el carrito no haya cambiado (por ejemplo, cuando el
 * checkout se frenó porque algo se agotó mientras la persona completaba sus datos).
 */
export function useCartRevalidation(): {
  problems: CartProblem[];
  maxPorLinea: Record<string, number>;
  validando: boolean;
  error: string | null;
  revalidate: () => void;
} {
  const { workspaceSlug, state, hydrated, replaceLines } = useCart();
  const [problems, setProblems] = useState<CartProblem[]>([]);
  const [maxPorLinea, setMaxPorLinea] = useState<Record<string, number>>({});
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const ultimaFirma = useRef<string | null>(null);
  const pedido = useRef(0);

  const firmaActual = firma(state.lines);

  useEffect(() => {
    if (!hydrated || firmaActual === ultimaFirma.current) return;
    if (state.lines.length === 0) {
      ultimaFirma.current = firmaActual;
      setProblems([]);
      return;
    }
    const numero = ++pedido.current;
    setValidando(true);
    validateCartAction(
      workspaceSlug,
      state.lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        qty: l.qty,
        unitPriceMinor: l.unitPriceMinor,
        name: l.name,
      })),
    )
      .then((r) => {
        if (numero !== pedido.current) return; // Llegó una respuesta vieja: la descarta.
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setError(null);
        setProblems(r.problems);
        setMaxPorLinea(Object.fromEntries(r.lines.map((l) => [l.key, l.maxQty])));
        const corregidas: CartLine[] = r.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          slug: l.slug,
          name: l.name,
          variantName: l.variantName,
          imageUrl: l.imageUrl,
          unitPriceMinor: l.unitPriceMinor,
          qty: l.qty,
        }));
        const nueva = firma(corregidas);
        ultimaFirma.current = nueva;
        if (nueva !== firmaActual) replaceLines(corregidas);
      })
      .catch(() => {
        if (numero === pedido.current) setError("No pudimos revisar el carrito. Revisá tu conexión y recargá la página.");
      })
      .finally(() => {
        if (numero === pedido.current) setValidando(false);
      });
    // `state.lines` está representado por `firmaActual`; `vuelta` fuerza una revalidación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, firmaActual, workspaceSlug, replaceLines, vuelta]);

  const revalidate = useCallback(() => {
    ultimaFirma.current = null;
    setVuelta((n) => n + 1);
  }, []);

  return { problems, maxPorLinea, validando, error, revalidate };
}
