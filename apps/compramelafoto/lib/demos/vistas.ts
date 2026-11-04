/** Las vistas entre las que alterna el presentador durante una demo. */
export type VistaDemo = "fotografo" | "familia" | "colegio" | "organizador";

export const VISTAS_DEMO: ReadonlyArray<{ id: VistaDemo; etiqueta: string }> = [
  { id: "fotografo", etiqueta: "Fotógrafo" },
  { id: "familia", etiqueta: "Familia" },
  { id: "colegio", etiqueta: "Colegio" },
  { id: "organizador", etiqueta: "Empresa de turismo" },
];

export function esVistaDemo(v: unknown): v is VistaDemo {
  return v === "fotografo" || v === "familia" || v === "colegio" || v === "organizador";
}

/**
 * Con qué usuario se ve cada vista. La familia usa la sesión del fotógrafo demo: un álbum de
 * prueba solo lo abre su dueño, y así no se abren los álbumes de prueba a cualquiera.
 * `null` si la vista necesita un usuario que todavía no existe (el organizador antes de «Preparar»).
 */
export function usuarioParaVista(
  vista: VistaDemo,
  ids: { fotografoId: number; colegioUserId: number; organizadorUserId?: number | null },
): number | null {
  if (vista === "colegio") return ids.colegioUserId;
  if (vista === "organizador") return ids.organizadorUserId ?? null;
  return ids.fotografoId;
}

/** Qué sesión necesita cada vista (la familia comparte la del fotógrafo). */
export type SesionDemo = "fotografo" | "colegio" | "organizador";

export function sesionParaVista(vista: VistaDemo): SesionDemo {
  return vista === "colegio" ? "colegio" : vista === "organizador" ? "organizador" : "fotografo";
}

/** A qué sesión corresponde el rol del usuario conectado. */
export function sesionDeRol(role: string): SesionDemo {
  return role === "SCHOOL_ORGANIZER" ? "colegio" : role === "ORGANIZER" ? "organizador" : "fotografo";
}

/** Pantalla a la que lleva cada vista. */
export function destinoDeVista(vista: VistaDemo, ctx: { schoolId: number; handler: string }): string {
  if (vista === "colegio") return `/escuela/${ctx.schoolId}`;
  if (vista === "familia") return `/${ctx.handler}/escolar`;
  if (vista === "organizador") return "/organizador/dashboard";
  return "/fotografo/escuelas";
}
