/** Lo que viaja entre el servidor y la pantalla al cambiar una plantilla con diseños. Puro. */

export type CategoriaDeCambio = "pendiente" | "aprobado" | "produccion" | "editado-a-mano" | "revision-manual";

export type DisenoAnteCambio = {
  id: number;
  quien: string;
  status: string;
  versionNumber: number | null;
  categoria: CategoriaDeCambio;
  /** Por qué no se puede pasar solo (revisión manual). */
  motivo: string | null;
  /** Huecos de foto nuevos que van a quedar vacíos si se pasa. */
  huecosNuevos: number;
};

export type ResumenDeCambio = {
  template: { id: string; name: string; versionId: string; versionNumber: number };
  disenos: DisenoAnteCambio[];
  totales: Record<CategoriaDeCambio, number>;
  /** Diseños armados con la versión vigente: si se guarda la plantilla, se crea otra versión. */
  enVersionVigente: number;
};

export type ResultadoDeCambio = {
  pasados: number[];
  volvieronARevision: number[];
  autorizacionesAnuladas: number[];
  omitidos: { id: number; motivo: string }[];
};

/** Qué se ofrece marcado de entrada: los pendientes sí, los aprobados no, el resto ni se ofrece. */
export function idsMarcadosDeEntrada(disenos: readonly DisenoAnteCambio[]): number[] {
  return disenos.filter((d) => d.categoria === "pendiente").map((d) => d.id);
}
