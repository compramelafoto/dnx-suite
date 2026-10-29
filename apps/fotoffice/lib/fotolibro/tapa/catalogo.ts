import { medidaPorId, normalizarNombreProveedor, type MedidaPliego } from "../medidas-pliego";

/**
 * Las tapas de fotolibro que se pueden armar, según cada laboratorio.
 *
 * Hay tres clases, y cambian qué se imprime:
 * - **frente**: sólo se imprime la tapa; el lomo y la contratapa son de otro material (cuero,
 *   tela). Una pieza fija, con demasía para doblar sobre el cartón. No depende de las hojas.
 * - **completa**: contratapa + lomo + tapa en una sola pieza; el lomo crece con las hojas.
 * - **flexible**: la misma medida que el pliego, pero al revés: contratapa a la izquierda y tapa
 *   a la derecha. Sin lomo ni demasía.
 *
 * Las medidas salen de las plantillas PSD de cada laboratorio (tamaño, 300 ppp y sus guías).
 */

export type TipoTapa = "frente" | "completa" | "flexible";

/** Lo que se dobla hacia adentro en cada borde, en mm. "Interior" es el lado del lomo. */
export type Demasia = { arriba: number; abajo: number; exterior: number; interior: number };

export type ModeloTapa = {
  /** Estable: queda guardado en el libro. */
  id: string;
  laboratorio: string;
  modelo: string;
  tipo: TipoTapa;
  /** Medidas de libro (ids de `MEDIDAS_PLIEGO`) a las que corresponde. */
  medidas: string[];
  /** Tamaño de la pieza que se manda, en mm (para "frente"; en "completa", sin el lomo). */
  pieza: { ancho: number; alto: number };
  demasia: Demasia;
  /** Sólo "completa": lomo = base + hojas × porHoja, en mm. */
  lomo?: { baseMm: number; porHojaMm: number };
  descripcion: string;
  /** Medidas estándar, no las de una plantilla del laboratorio: hay que confirmarlas antes de imprimir. */
  estimada?: boolean;
};

export const MODELOS_TAPA: readonly ModeloTapa[] = [
  {
    // PSD de Román "plantilla tapa gold premiun 30x60 frente": 3602 × 4075 px a 300 ppp.
    // Guías: arriba 20 mm, abajo 325,1 mm, doblez exterior 284,8 mm y, a la izquierda, 19,9 mm
    // que quedan debajo del lomo de cuero.
    id: "roman-gold-premium-30x60",
    laboratorio: "Román",
    modelo: "Gold Premium",
    tipo: "frente",
    medidas: ["rigido-30x60"],
    pieza: { ancho: 305, alto: 345 },
    demasia: { arriba: 20, abajo: 19.9, exterior: 20.2, interior: 19.9 },
    descripcion: "Tapa laminada con lomo y contratapa de ecocuero: se imprime sólo el frente.",
  },
];

/** La tapa flexible de una medida: el pliego mismo, con la contratapa a la izquierda. */
export function tapaFlexible(medida: MedidaPliego): ModeloTapa {
  return {
    id: `flexible-${medida.id}`,
    laboratorio: "",
    modelo: "Tapa flexible",
    tipo: "flexible",
    medidas: [medida.id],
    pieza: { ancho: medida.anchoMm, alto: medida.altoMm },
    demasia: { arriba: 0, abajo: 0, exterior: 0, interior: 0 },
    descripcion: "Misma medida que el pliego: contratapa a la izquierda y tapa a la derecha.",
  };
}

/**
 * La tapa genérica de un libro rígido: una pieza completa (contratapa + lomo + tapa) con las
 * medidas habituales de una tapa dura, para poder diseñar la portada aunque todavía no esté la
 * plantilla del laboratorio. Cada cara es la página más 3 mm de cartón por lado; se dobla 18 mm
 * sobre el cartón y el lomo mide 1 mm por hoja, que es lo que ensancha en la práctica.
 */
export function tapaGenerica(medida: MedidaPliego): ModeloTapa {
  const cara = medida.anchoMm / 2 + 3;
  return {
    id: `generica-${medida.id}`,
    laboratorio: "",
    modelo: "Tapa dura genérica",
    tipo: "completa",
    medidas: [medida.id],
    pieza: { ancho: cara, alto: medida.altoMm + 6 },
    demasia: { arriba: 18, abajo: 18, exterior: 18, interior: 0 },
    // Regla de los laboratorios: el lomo ensancha cerca de 1 mm por hoja.
    lomo: { baseMm: 0, porHojaMm: 1 },
    descripcion: "Contratapa, lomo y tapa con medidas estándar. Confirmá las medidas con tu laboratorio antes de imprimir.",
    estimada: true,
  };
}

/**
 * Las tapas posibles para un libro: las del laboratorio elegido para esa medida (o las de todos,
 * si no hay laboratorio), más la flexible si la medida es de tapa flexible.
 */
export function modelosParaLibro(medidaId: string, laboratorio?: string | null): ModeloTapa[] {
  const medida = medidaPorId(medidaId);
  if (!medida) return [];
  if (medida.linea === "FLEXIBLE") return [tapaFlexible(medida)];
  const lab = laboratorio ? normalizarNombreProveedor(laboratorio) : null;
  // Primero las plantillas del laboratorio; la genérica siempre, para no quedarse sin tapa.
  return [
    ...MODELOS_TAPA.filter((m) => m.medidas.includes(medidaId) && (!lab || normalizarNombreProveedor(m.laboratorio) === lab)),
    tapaGenerica(medida),
  ];
}

export function modeloTapaPorId(id: string | null | undefined): ModeloTapa | null {
  if (!id) return null;
  if (id.startsWith("generica-")) {
    const medida = medidaPorId(id.slice("generica-".length));
    return medida ? tapaGenerica(medida) : null;
  }
  if (id.startsWith("flexible-")) {
    const medida = medidaPorId(id.slice("flexible-".length));
    return medida ? tapaFlexible(medida) : null;
  }
  return MODELOS_TAPA.find((m) => m.id === id) ?? null;
}
