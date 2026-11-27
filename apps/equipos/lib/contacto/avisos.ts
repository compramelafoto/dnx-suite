import { avisoDeCodigo } from "@/lib/avisos";

/**
 * Códigos que viajan en `?error=` y su texto fijo. La página nunca muestra el valor de la URL:
 * cualquiera puede armar un enlace con un texto inventado.
 */
export type CodigoAviso = "PROPIA" | "NO_DISPONIBLE" | "LIMITE" | "SUSPENDIDA" | "ERROR";

const TEXTOS: Record<CodigoAviso, string> = {
  PROPIA: "Esta publicación es tuya.",
  NO_DISPONIBLE: "Esta publicación ya no está disponible.",
  LIMITE: "Llegaste al máximo de contactos por hoy. Probá mañana.",
  SUSPENDIDA: "Tu cuenta está suspendida.",
  ERROR: "No pudimos completar la operación. Probá de nuevo.",
};

/** Texto del aviso para un código conocido; cualquier otro valor no muestra nada. */
export function textoDeAviso(codigo: string | undefined): string | null {
  return avisoDeCodigo(TEXTOS, codigo);
}
