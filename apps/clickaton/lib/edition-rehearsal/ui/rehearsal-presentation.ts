/**
 * Traducción de los estados del ensayo a texto y color.
 *
 * Sin lógica de negocio y sin Prisma: sólo convierte lo que ya se decidió en
 * algo que se pueda leer en pantalla.
 */

import type { EstadoDePaso, Hallazgo, Rubro, Severidad } from "../domain/types";

/** Variantes que existen de verdad en `components/ui/Badge.tsx`. */
type VarianteDeBadge = "success" | "warning" | "danger" | "neutral";

export const RUBROS_EN_ORDEN: Rubro[] = [
  "PUBLICACION",
  "VENTA",
  "CRONOGRAMA",
  "CONSIGNAS",
  "ACREDITACION",
  "SUBIDA",
  "ADMISION",
];

const NOMBRE_DE_RUBRO: Record<Rubro, string> = {
  PUBLICACION: "Publicación",
  VENTA: "Venta e inscripción",
  CRONOGRAMA: "Cronograma",
  CONSIGNAS: "Consignas",
  ACREDITACION: "Acreditación",
  SUBIDA: "Subida de fotos",
  ADMISION: "Admisión técnica",
};

export function presentarRubro(rubro: Rubro): string {
  return NOMBRE_DE_RUBRO[rubro];
}

export function presentarSeveridad(severidad: Severidad): {
  etiqueta: string;
  variante: VarianteDeBadge;
} {
  switch (severidad) {
    case "BIEN":
      return { etiqueta: "Todo bien", variante: "success" };
    case "ATENCION":
      return { etiqueta: "Atención", variante: "warning" };
    case "BLOQUEANTE":
      return { etiqueta: "Bloqueante", variante: "danger" };
  }
}

export function presentarEstadoDePaso(estado: EstadoDePaso): {
  etiqueta: string;
  variante: VarianteDeBadge;
} {
  switch (estado) {
    case "PASO":
      return { etiqueta: "Funcionó", variante: "success" };
    case "FALLO":
      return { etiqueta: "Se cortó acá", variante: "danger" };
    case "NO_CORRESPONDE":
      return { etiqueta: "Todavía no", variante: "neutral" };
  }
}

export function resumirHallazgos(hallazgos: Hallazgo[]): {
  bien: number;
  atenciones: number;
  bloqueantes: number;
  veredicto: string;
} {
  const bien = hallazgos.filter((h) => h.severidad === "BIEN").length;
  const atenciones = hallazgos.filter((h) => h.severidad === "ATENCION").length;
  const bloqueantes = hallazgos.filter((h) => h.severidad === "BLOQUEANTE").length;

  let veredicto: string;
  if (bloqueantes > 0) {
    veredicto =
      bloqueantes === 1
        ? "La edición no está lista: hay 1 problema que corta el recorrido del participante."
        : `La edición no está lista: hay ${bloqueantes} problemas que cortan el recorrido del participante.`;
  } else if (atenciones > 0) {
    veredicto =
      atenciones === 1
        ? "No hay nada que corte el recorrido, pero queda 1 cosa para revisar."
        : `No hay nada que corte el recorrido, pero quedan ${atenciones} cosas para revisar.`;
  } else {
    veredicto = "La edición está lista: todos los controles dieron bien.";
  }

  return { bien, atenciones, bloqueantes, veredicto };
}

const PESO_DE_SEVERIDAD: Record<Severidad, number> = {
  BLOQUEANTE: 0,
  ATENCION: 1,
  BIEN: 2,
};

export function agruparPorRubro(
  hallazgos: Hallazgo[],
): Array<{ rubro: Rubro; hallazgos: Hallazgo[] }> {
  return RUBROS_EN_ORDEN.map((rubro) => ({
    rubro,
    hallazgos: hallazgos
      .filter((h) => h.rubro === rubro)
      .sort((a, b) => PESO_DE_SEVERIDAD[a.severidad] - PESO_DE_SEVERIDAD[b.severidad]),
  })).filter((grupo) => grupo.hallazgos.length > 0);
}

/** Ruta del panel donde se arregla el hallazgo, o `null` si no hay ninguna. */
export function enlaceDeHallazgo(hallazgo: Hallazgo, editionId: string): string | null {
  if (!hallazgo.enlace) return null;
  return `/admin/ediciones/${editionId}/${hallazgo.enlace}`;
}
