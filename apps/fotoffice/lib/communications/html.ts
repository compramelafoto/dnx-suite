/** Piezas de marcado compartidas por los correos de FotoOffice (paleta y escape). */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Paleta de FotoOffice, la misma de `app/globals.css`. */
export const C = {
  lienzo: "#f4f6f9",
  tarjeta: "#ffffff",
  borde: "#e2e8f0",
  tinta: "#0f172a",
  cuerpo: "#334155",
  apagado: "#64748b",
  tenue: "#94a3b8",
  acento: "#0ea5e9",
  acentoFuerte: "#0284c7",
  acentoSuave: "#e0f2fe",
} as const;

export const FUENTE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
