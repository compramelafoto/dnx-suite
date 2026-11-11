/**
 * Quién puede mirar un vivo o su grabación.
 *
 * - PUBLICA: cualquiera, sin sesión (sitio público del workspace).
 * - SOCIOS: sólo una persona socia ACTIVA de ese mismo workspace. Es el mismo criterio que usa
 *   el portal para dejar entrar (`lib/portal/access.ts`: ficha con `status = ACTIVE`).
 *
 * El equipo del panel (dueño o admin) siempre puede mirar lo suyo: necesita revisar antes de
 * publicar. Módulo PURO.
 */

export type Visibilidad = "PUBLICA" | "SOCIOS";

export type Espectador =
  | { tipo: "ANONIMO" }
  | { tipo: "SOCIA"; workspaceId: string; activa: boolean }
  | { tipo: "EQUIPO"; workspaceId: string };

export function puedeMirar(
  contenido: { visibility: Visibilidad; workspaceId: string },
  espectador: Espectador,
): boolean {
  if (contenido.visibility === "PUBLICA") return true;
  switch (espectador.tipo) {
    case "ANONIMO":
      return false;
    case "SOCIA":
      return espectador.activa && espectador.workspaceId === contenido.workspaceId;
    case "EQUIPO":
      return espectador.workspaceId === contenido.workspaceId;
  }
}

export const ETIQUETA_VISIBILIDAD: Record<Visibilidad, string> = {
  PUBLICA: "Pública (sitio y redes)",
  SOCIOS: "Sólo personas socias activas (portal)",
};
