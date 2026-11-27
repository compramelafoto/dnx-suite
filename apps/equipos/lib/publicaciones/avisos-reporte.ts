import { avisoDeCodigo } from "@/lib/avisos";

/**
 * Códigos que viajan en `?error=` al reportar una publicación y su texto fijo. La página nunca
 * muestra el valor de la URL: cualquiera puede armar un enlace con un texto inventado.
 */
export type CodigoAvisoReporte = "MOTIVO" | "PROPIA" | "NO_DISPONIBLE" | "ERROR";

const TEXTOS: Record<CodigoAvisoReporte, string> = {
  MOTIVO: "Contanos el motivo en 10 a 500 caracteres.",
  PROPIA: "No podés reportar tu propia publicación.",
  NO_DISPONIBLE: "Esta publicación ya no está disponible.",
  ERROR: "No pudimos enviar el reporte. Probá de nuevo.",
};

export function textoDeAvisoReporte(codigo: string | undefined): string | null {
  return avisoDeCodigo(TEXTOS, codigo);
}
