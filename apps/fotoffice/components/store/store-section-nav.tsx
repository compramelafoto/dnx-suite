"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";

/**
 * Lo que sigue a `/tienda` en la dirección del navegador. Se busca el segmento y no `base`
 * entero porque con dominio propio la dirección visible no lleva `/w/<slug>`.
 */
function restoDeLaTienda(ruta: string): string | null {
  const segmento = `/${STORE_PUBLIC_SEGMENT}`;
  const i = ruta.indexOf(segmento);
  if (i < 0) return null;
  const resto = ruta.slice(i + segmento.length);
  return resto === "" || resto.startsWith("/") ? resto : null;
}

/**
 * "Productos / Obras" en la barra de la tienda, con la sección actual marcada. Obras es
 * `/tienda/obras` y sus fichas; todo lo demás de la tienda (vitrina, fichas de producto) es
 * Productos, salvo el carrito y el checkout, que no son de ninguna.
 */
export function StoreSectionNav({ base }: { base: string }) {
  const ruta = usePathname() ?? "";
  const resto = restoDeLaTienda(ruta);
  const enObras = resto !== null && (resto === "/obras" || resto.startsWith("/obras/"));
  const fuera = resto === null || resto === "/carrito" || resto.startsWith("/checkout");
  const enProductos = !enObras && !fuera;

  const clase = (activo: boolean) =>
    `underline-offset-4 hover:underline ${activo ? "font-semibold text-[var(--fo-text)] underline" : "text-[var(--fo-text-secondary)]"}`;

  return (
    <nav aria-label="Secciones de la tienda" className="flex items-center gap-4 text-sm">
      <Link href={base} className={clase(enProductos)} aria-current={enProductos ? "page" : undefined}>
        Productos
      </Link>
      <Link href={`${base}/obras`} className={clase(enObras)} aria-current={enObras ? "page" : undefined}>
        Obras
      </Link>
    </nav>
  );
}
