import type { Visibility } from "@repo/muestras";

/** El ajuste sin la semilla del sorteo: lo que necesita el formulario del navegador. */
export function sinSemilla(v: Visibility) {
  const { exhibited, randomCount, rotation, artists } = v.online;
  return { preset: v.preset, online: { exhibited, randomCount, rotation, artists }, profile: v.profile, room: v.room, revealAfterClose: v.revealAfterClose };
}
export type AjusteSinSemilla = ReturnType<typeof sinSemilla>;
