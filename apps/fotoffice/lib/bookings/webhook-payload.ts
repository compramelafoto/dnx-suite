/**
 * De dónde sale el identificador del pago en un aviso de Mercado Pago. PURO.
 *
 * Mercado Pago avisa de dos formas —cuerpo JSON o parámetros en la URL— y manda avisos de
 * cosas que no son pagos. Separarlo del `route.ts` permite probar los cuatro casos sin
 * levantar Next.
 */
export function extractPaymentId(body: unknown, url: URL): string | null {
  const cuerpo = (typeof body === "object" && body !== null ? body : {}) as {
    type?: unknown;
    data?: { id?: unknown };
  };

  const tipo =
    (typeof cuerpo.type === "string" ? cuerpo.type : null) ?? url.searchParams.get("type") ?? "";
  if (tipo && tipo !== "payment") return null;

  const crudo =
    cuerpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? null;
  if (crudo === null || crudo === undefined) return null;

  const id = String(crudo).trim();
  return id.length > 0 ? id : null;
}
