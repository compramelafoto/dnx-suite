/**
 * En qué punto está el pedido de un trabajo con su proveedor: faltan archivos, sale solo en unos
 * minutos, enviado, abierto o descargado. Lo muestran la ficha del pedido, el tablero «En curso» y
 * la ficha del trabajo. También decide si un trabajo está completo para mandarlo. Módulo PURO.
 */

export type ClaveEnvio = "FALTAN_ARCHIVOS" | "SALE_SOLO" | "POR_ENVIAR" | "ENVIADO" | "ABIERTO" | "DESCARGADO";
export type TonoEnvio = "peligro" | "aviso" | "info" | "exito";

export type DatosEnvio = {
  proveedor: string | null;
  /** El material es físico (un rollo): sale sin archivos. */
  envioSinArchivos: boolean;
  /** Fotolibro o trabajo de mostrador: los manda otro camino (a mano o el cron de impresiones). */
  otroCamino: boolean;
  archivosListos: number;
  enviadoAt: Date | string | null;
  abiertoAt: Date | string | null;
  descargadoAt: Date | string | null;
};

export type EstadoEnvio = { clave: ClaveEnvio; texto: string; tono: TonoEnvio };

function fechaHora(d: Date | string): string {
  const f = typeof d === "string" ? new Date(d) : d;
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(f);
  const v = (t: string) => (partes.find((p) => p.type === t)?.value ?? "").padStart(2, "0");
  return `${v("day")}/${v("month")} ${v("hour")}:${v("minute")}`;
}

/** ¿Le falta algo para poder mandarlo? Sólo los que necesitan archivos y no tienen ninguno listo. */
export function faltanArchivos(d: { envioSinArchivos: boolean; archivosListos: number }): boolean {
  return !d.envioSinArchivos && d.archivosListos === 0;
}

/** null = sin proveedor (se hace en el estudio): no hay nada que mostrar. */
export function estadoDeEnvio(d: DatosEnvio): EstadoEnvio | null {
  if (!d.proveedor) return null;
  const p = d.proveedor;
  if (d.descargadoAt) return { clave: "DESCARGADO", texto: `${p} descargó los archivos ${fechaHora(d.descargadoAt)}`, tono: "exito" };
  if (d.abiertoAt) return { clave: "ABIERTO", texto: `${p} abrió el pedido ${fechaHora(d.abiertoAt)}`, tono: "info" };
  if (d.enviadoAt) return { clave: "ENVIADO", texto: `Enviado a ${p} ${fechaHora(d.enviadoAt)}`, tono: "info" };
  if (faltanArchivos(d)) return { clave: "FALTAN_ARCHIVOS", texto: `Faltan los archivos para ${p}`, tono: "peligro" };
  if (!d.envioSinArchivos && !d.otroCamino) return { clave: "SALE_SOLO", texto: `Sale solo a ${p} en unos minutos`, tono: "aviso" };
  return { clave: "POR_ENVIAR", texto: `Por enviar a ${p}`, tono: "aviso" };
}

/** Minutos que se espera desde el último archivo subido antes de mandarlo solo (la cajera puede seguir subiendo). */
export const MINUTOS_DE_ESPERA = 5;

/**
 * ¿El cron lo manda ahora? Tiene archivos listos, ninguno a medio subir y el último lleva más de
 * MINUTOS_DE_ESPERA. Los de otro camino (fotolibro, mostrador) y los físicos no pasan por acá.
 */
export function listoParaSalirSolo(
  d: { envioSinArchivos: boolean; otroCamino: boolean; archivosListos: number; archivosSubiendo: number; ultimoArchivoAt: Date | null },
  ahora: Date,
): boolean {
  if (d.envioSinArchivos || d.otroCamino) return false;
  if (d.archivosListos === 0 || d.archivosSubiendo > 0 || !d.ultimoArchivoAt) return false;
  return ahora.getTime() - d.ultimoArchivoAt.getTime() >= MINUTOS_DE_ESPERA * 60_000;
}
