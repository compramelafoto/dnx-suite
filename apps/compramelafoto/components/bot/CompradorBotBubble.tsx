"use client";

import { usePathname } from "next/navigation";
import { DnxBotBubble } from "@repo/dnx-bot/ui";
import { contextoDePagina, margenBurbujaComprador } from "@/lib/bot/comprador/pagina";
import { RUTAS_PERMITIDAS_COMPRADOR } from "@/lib/bot/comprador/rutas";

/**
 * Burbuja de DNX Bot para compradores. Los layouts siguen montados al navegar dentro del mismo
 * segmento (por ejemplo de /a/12 a /a/12/comprar): la `key` por ruta la vuelve a montar para que
 * pregunte de nuevo a /estado por la página nueva. En las páginas sin bot (comprar, canje,
 * instructivo…) no se monta ni consulta nada; igual el servidor es quien decide si se muestra.
 * En la preventa y en la página del álbum sube por encima de las barras de pago fijas.
 */
export function CompradorBotBubble() {
  const pathname = usePathname() ?? "";
  if (!contextoDePagina(pathname)) return null;
  return (
    <DnxBotBubble
      key={pathname}
      basePath="/api/bot/comprador"
      mascotSrc="/dnx-bot/mascota.webp"
      bottomOffsetPx={margenBurbujaComprador(pathname)}
      audiencia="comprador"
      rutasPermitidas={RUTAS_PERMITIDAS_COMPRADOR}
    />
  );
}
