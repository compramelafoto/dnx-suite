import type { PasoGuion } from "@/lib/demos/guiones/tipos";

export function siguientePaso(i: number, total: number): number {
  return Math.min(Math.max(i + 1, 0), Math.max(total - 1, 0));
}

export function pasoAnterior(i: number): number {
  return Math.max(i - 1, 0);
}

/** Índice guardado en el navegador, corregido si el guion cambió de largo. */
export function indiceValido(guardado: unknown, total: number): number {
  const n = Number(guardado);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, Math.max(total - 1, 0));
}

/**
 * La guía abierta en otra ventana (para leerla en una segunda pantalla) avisa que sigue viva cada
 * poco; si deja de avisar (la cerraron), el cuadro vuelve a la ventana principal.
 */
export const LATIDO_VENTANA_APARTE_MS = 1500;
export function ventanaAparteViva(ultimoLatido: number | null, ahora: number): boolean {
  return ultimoLatido != null && ahora - ultimoLatido < LATIDO_VENTANA_APARTE_MS * 3;
}

/**
 * La tarjeta para el público aparece al llegar a un paso avanzando, una sola vez: al volver atrás
 * o al repetir el paso no interrumpe al presentador.
 */
export function debeMostrarAclaracion(
  paso: Pick<PasoGuion, "id" | "aclaracion">,
  yaVistas: ReadonlySet<string>,
  direccion: "adelante" | "atras" | "salto",
): boolean {
  return Boolean(paso.aclaracion) && direccion === "adelante" && !yaVistas.has(paso.id);
}
