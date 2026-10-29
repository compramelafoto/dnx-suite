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
 * Qué hace una tecla en la guía. El presentador inalámbrico manda Avance/Retroceso de página, y
 * Cmd/Ctrl + flecha abajo/arriba es el atajo del teclado; los dos valen aunque el cursor esté en un
 * campo (si no, después de escribir en un formulario la charla se traba). Alt+flechas solo fuera
 * de los campos: adentro mueven el cursor por palabras.
 */
export function accionDeTecla(
  e: { key: string; altKey: boolean; metaKey?: boolean; ctrlKey?: boolean },
  enCampo: boolean,
): "adelante" | "atras" | "cerrar" | null {
  const cmd = Boolean(e.metaKey || e.ctrlKey) && !e.altKey;
  if (e.key === "PageDown" || (cmd && e.key === "ArrowDown") || (!enCampo && e.altKey && e.key === "ArrowRight")) return "adelante";
  if (e.key === "PageUp" || (cmd && e.key === "ArrowUp") || (!enCampo && e.altKey && e.key === "ArrowLeft")) return "atras";
  if (!enCampo && (e.key === "Escape" || e.key === "Enter")) return "cerrar";
  return null;
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
