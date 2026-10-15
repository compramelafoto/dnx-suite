/**
 * Lo que ve el alumno al entrar: sus clases, cuáles vio y cuánto le falta. Puro.
 *
 * Sólo cuentan las clases con el video listo: una clase procesándose no se puede ver, y
 * contarla dejaría al alumno sin poder llegar nunca al 100%.
 */

export type ClaseDelAula = {
  id: string;
  title: string;
  durationSeconds: number | null;
  completada: boolean;
  retomarDesde: number;
};

/** Si quedó en los últimos segundos, retomar ahí sería mostrarle los créditos. */
export function posicionParaRetomar(posicion: number, duracion: number | null): number {
  if (!duracion || posicion <= 0) return 0;
  return posicion >= duracion - 10 ? 0 : Math.floor(posicion);
}

export function armarAula(
  lecciones: Array<{
    id: string;
    title: string;
    durationSeconds: number | null;
    videoStatus: string;
    sortOrder: number;
  }>,
  avances: Array<{ lessonId: string; completedAt: Date | null; lastPositionSeconds: number }>,
): { clases: ClaseDelAula[]; porcentaje: number } {
  const porClase = new Map(avances.map((a) => [a.lessonId, a]));
  const clases = lecciones
    .filter((l) => l.videoStatus === "READY")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => {
      const avance = porClase.get(l.id);
      return {
        id: l.id,
        title: l.title,
        durationSeconds: l.durationSeconds,
        completada: Boolean(avance?.completedAt),
        retomarDesde: posicionParaRetomar(avance?.lastPositionSeconds ?? 0, l.durationSeconds),
      };
    });
  const completas = clases.filter((c) => c.completada).length;
  const porcentaje = clases.length === 0 ? 0 : Math.floor((completas * 100) / clases.length);
  return { clases, porcentaje };
}

export function duracionLegible(segundos: number | null): string {
  if (!segundos || segundos <= 0) return "";
  const minutos = Math.max(1, Math.round(segundos / 60));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas} h ${String(minutos % 60).padStart(2, "0")} min`;
}
