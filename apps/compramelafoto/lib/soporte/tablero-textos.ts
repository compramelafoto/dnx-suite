/** Textos de las fichas del tablero. Puro: lo usan también los componentes del navegador. */

const MAX_TITULO = 90;

/** Primera frase útil de la descripción: sin la etiqueta "[Comprador · …]" ni "Pedido #…" / "Motivo: …". */
export function tituloDe(descripcion: string): string {
  let t = descripcion.replace(/\s+/g, " ").trim().replace(/^\[[^\]]*\]\s*/, "");
  for (;;) {
    const sin = t.replace(/^(Pedido( declarado)? #?\S+( \(sin verificar\))?\.|Motivo: [^.]*\.)\s*/i, "");
    if (sin === t) break;
    t = sin;
  }
  return t.length > MAX_TITULO ? `${t.slice(0, MAX_TITULO - 1)}…` : t;
}

export function rolDe(requesterRole: string | null): "Comprador" | "Fotógrafo" | "Otro" {
  if (requesterRole === "PHOTOGRAPHER" || requesterRole === "LAB_PHOTOGRAPHER") return "Fotógrafo";
  if (requesterRole === "CUSTOMER" || requesterRole === "CLIENT" || requesterRole === "BUYER") return "Comprador";
  return "Otro";
}
