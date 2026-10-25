/** Las tres vistas entre las que alterna el presentador durante una demo. */
export type VistaDemo = "fotografo" | "familia" | "colegio";

export const VISTAS_DEMO: ReadonlyArray<{ id: VistaDemo; etiqueta: string }> = [
  { id: "fotografo", etiqueta: "Fotógrafo" },
  { id: "familia", etiqueta: "Familia" },
  { id: "colegio", etiqueta: "Colegio" },
];

export function esVistaDemo(v: unknown): v is VistaDemo {
  return v === "fotografo" || v === "familia" || v === "colegio";
}

/**
 * Con qué usuario se ve cada vista. La familia usa la sesión del fotógrafo demo: un álbum de
 * prueba solo lo abre su dueño, y así no se abren los álbumes de prueba a cualquiera.
 */
export function usuarioParaVista(
  vista: VistaDemo,
  ids: { fotografoId: number; colegioUserId: number },
): number {
  return vista === "colegio" ? ids.colegioUserId : ids.fotografoId;
}
