import type { Visibility } from "@repo/muestras";

/** El ajuste sin la semilla del sorteo: lo que necesita el formulario del navegador. */
export function sinSemilla(v: Visibility) {
  const { exhibited, randomCount, rotation, artists } = v.online;
  return { preset: v.preset, online: { exhibited, randomCount, rotation, artists }, profile: v.profile, room: v.room, revealAfterClose: v.revealAfterClose };
}
export type AjusteSinSemilla = ReturnType<typeof sinSemilla>;

export const AVISO_YA_CIRCULARON = "Si antes estaba todo a la vista, las imágenes que ya circularon pueden seguir en buscadores o redes.";

/**
 * Los avisos de lo elegido (spec D22, D23), para mostrar antes de guardar. Con `antes` (el ajuste
 * guardado): si estaba todo a la vista y ahora se reserva algo, que lo publicado no se puede despublicar.
 */
export function avisosDeAjuste(a: AjusteSinSemilla, antes: AjusteSinSemilla | null = null): string[] {
  const avisos: string[] = [];
  if (antes?.online.exhibited === "ALL" && a.online.exhibited !== "ALL") avisos.push(AVISO_YA_CIRCULARON);
  if (a.online.exhibited !== "RANDOM") return avisos;
  if (a.online.rotation === "DAILY") avisos.push("Quien vuelve seguido termina viendo más obras.");
  if (a.online.rotation === "PER_VISIT") {
    avisos.push(
      `Cada visitante ve otras ${a.online.randomCount} obras. Quien entre varias veces (o use un programa) va a terminar viendo todas: si querés que la sala sea sorpresa, elegí 'Siempre las mismas' o 'Ninguna'.`,
    );
  }
  return avisos;
}
