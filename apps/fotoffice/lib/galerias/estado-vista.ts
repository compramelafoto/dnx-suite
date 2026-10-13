import type { EstadoGaleria } from "./constantes";

/** Clases de la etiqueta de estado de una galería (módulo PURO). */
export function claseDeEstadoGaleria(e: EstadoGaleria): string {
  switch (e) {
    case "PUBLICADA": return "bg-green-100 text-green-800";
    case "ARCHIVADA": return "bg-gray-100 text-gray-700";
    default: return "bg-amber-100 text-amber-800";
  }
}
