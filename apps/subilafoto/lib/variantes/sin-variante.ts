import type { Prisma } from "@repo/db";

/**
 * Qué cuenta como "le falta la variante".
 *
 * **`kind: PHOTO` no es opcional.** Esta consulta es anterior a los saludos grabados y
 * daba por sentado que todo lo que tiene `originalKey` es una imagen. Desde que existen
 * los audios, el del 10/10/2026 entraba acá cada cinco minutos: se bajaba de R2 y se le
 * pedía a `sharp` que lo redimensionara. Un audio no tiene variante y nunca la va a
 * tener, así que fallaba siempre.
 *
 * Lo caro no era el gasto —cinco megas cada cinco minutos— sino que el contador de
 * fallas quedaba clavado en 1. **Un indicador que siempre está en rojo deja de avisar**:
 * la próxima variante que falle de verdad no la nota nadie.
 *
 * Exportada para poder probar la forma: lo que protege no falla ruidosamente, se nota
 * como un contador que nadie mira.
 */
export const SIN_VARIANTE: Prisma.SubilafotoMediaWhereInput = {
  kind: "PHOTO",
  // Una bloqueada no se muestra en ningún lado: no necesita variante.
  status: { in: ["APPROVED", "REVIEW_REQUIRED"] },
  variants: { none: {} },
  originalKey: { not: "" },
};
