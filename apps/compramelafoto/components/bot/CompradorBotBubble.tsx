"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DnxBotBubble } from "@repo/dnx-bot/ui";
import {
  ATRIBUTO_EVITAR,
  contextoDePagina,
  MARGEN_BURBUJA_NORMAL,
  margenSobreBotones,
} from "@/lib/bot/comprador/pagina";
import { RUTAS_PERMITIDAS_COMPRADOR } from "@/lib/bot/comprador/rutas";

/** Cada cuánto se vuelve a medir: los botones de pago aparecen y cambian de alto al elegir fotos. */
const MEDIR_CADA_MS = 400;

/**
 * Mide los botones y barras de pago fijos que están visibles (marcados con `data-dnxbot-evitar`)
 * y devuelve el margen para que la burbuja quede justo encima, sin taparlos ni flotar de más.
 */
function useMargenSobreBotones(): number {
  const [margen, setMargen] = useState(MARGEN_BURBUJA_NORMAL);
  useEffect(() => {
    const medir = () => {
      const tops: number[] = [];
      document.querySelectorAll<HTMLElement>(`[${ATRIBUTO_EVITAR}]`).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") tops.push(r.top);
      });
      const nuevo = margenSobreBotones(tops, window.innerHeight);
      setMargen((actual) => (actual === nuevo ? actual : nuevo));
    };
    medir();
    const intervalo = window.setInterval(medir, MEDIR_CADA_MS);
    window.addEventListener("resize", medir);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("resize", medir);
    };
  }, []);
  return margen;
}

/**
 * Burbuja de DNX Bot para compradores. Los layouts siguen montados al navegar dentro del mismo
 * segmento (por ejemplo de /a/12 a /a/12/comprar): la `key` por ruta la vuelve a montar para que
 * pregunte de nuevo a /estado por la página nueva. En las páginas sin bot (comprar, canje,
 * instructivo…) no se monta ni consulta nada; igual el servidor es quien decide si se muestra.
 * Se ubica justo encima de los botones o barras de pago fijos de la página.
 */
export function CompradorBotBubble() {
  const pathname = usePathname() ?? "";
  const pagina = contextoDePagina(pathname);
  if (!pagina) return null;
  // Link del mail de soporte: la ventana se abre sola con la historia del reclamo.
  return <BurbujaSobreBotones key={pathname} casoToken={pagina.tipo === "caso" ? pagina.token : undefined} />;
}

/** La burbuja con el margen medido en vivo (componente aparte para que los hooks no dependan de la ruta). */
export function BurbujaSobreBotones({ casoToken }: { casoToken?: string } = {}) {
  const margen = useMargenSobreBotones();
  return (
    <DnxBotBubble
      basePath="/api/bot/comprador"
      mascotSrc="/dnx-bot/mascota.webp" mascotSpriteSrc="/dnx-bot/mascota-foto.webp"
      bottomOffsetPx={margen}
      audiencia="comprador"
      rutasPermitidas={RUTAS_PERMITIDAS_COMPRADOR}
      casoToken={casoToken}
    />
  );
}
