/**
 * Qué obras van al ZIP para redes y con qué nombre.
 *
 * Es la parte pura de "Descargar para redes": filtra por consigna y por puesto,
 * deja afuera a quien no autorizó publicar su obra y arma los nombres de
 * carpetas y archivos para que Tammy los arrastre a Instagram en orden.
 */

export type FiltroDeResultados = {
  /** Ids de consigna; vacío = todas. */
  consignas: string[];
  desde: number | null;
  hasta: number | null;
};

export type ObraParaRedes = {
  snapshotId: string;
  submissionId: string | null;
  consignaId: string | null;
  puesto: number | null;
  nota: number | null;
  anonymousCode: string;
  nombre: string;
  numero: string | null;
  instagram: string | null;
  /** `socialPublicationConsent` de la inscripción. */
  autorizaRedes: boolean;
};

type Parametros = Record<string, string | string[] | undefined>;

function entero(valor: string | string[] | undefined): number | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto) return null;
  const n = Number.parseInt(texto, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Lee el filtro de la URL (`?consigna=a&consigna=b&desde=1&hasta=3`). */
export function leerFiltro(parametros: Parametros): FiltroDeResultados {
  const crudo = parametros.consigna;
  const consignas = (Array.isArray(crudo) ? crudo : crudo ? [crudo] : []).filter(Boolean);
  let desde = entero(parametros.desde);
  let hasta = entero(parametros.hasta);
  if (desde != null && hasta != null && desde > hasta) [desde, hasta] = [hasta, desde];
  return { consignas, desde, hasta };
}

export function filtroActivo(filtro: FiltroDeResultados): boolean {
  return filtro.consignas.length > 0 || filtro.desde != null || filtro.hasta != null;
}

export function filtroAQuery(filtro: FiltroDeResultados): string {
  const q = new URLSearchParams();
  for (const c of filtro.consignas) q.append("consigna", c);
  if (filtro.desde != null) q.set("desde", String(filtro.desde));
  if (filtro.hasta != null) q.set("hasta", String(filtro.hasta));
  return q.toString();
}

/**
 * Aplica el filtro a una fila de la tabla. Con rango de puestos pedido, una
 * obra sin puesto queda afuera: todavía no tiene lugar que mostrar. Los
 * empates entran todos, porque comparten el número.
 */
export function pasaElFiltro(
  fila: { promptExternalId: string | null; puesto: number | null },
  filtro: FiltroDeResultados,
): boolean {
  if (filtro.consignas.length > 0 && !filtro.consignas.includes(fila.promptExternalId ?? "")) {
    return false;
  }
  if (filtro.desde == null && filtro.hasta == null) return true;
  if (fila.puesto == null) return false;
  if (filtro.desde != null && fila.puesto < filtro.desde) return false;
  if (filtro.hasta != null && fila.puesto > filtro.hasta) return false;
  return true;
}

/** Separa lo publicable de lo que no puede ir a redes, y por qué. */
export function separarPublicables(obras: ObraParaRedes[]): {
  publicables: ObraParaRedes[];
  sinPermiso: ObraParaRedes[];
  sinFoto: ObraParaRedes[];
} {
  const publicables: ObraParaRedes[] = [];
  const sinPermiso: ObraParaRedes[] = [];
  const sinFoto: ObraParaRedes[] = [];
  for (const o of obras) {
    if (o.puesto == null) continue;
    if (!o.autorizaRedes) sinPermiso.push(o);
    else if (!o.submissionId) sinFoto.push(o);
    else publicables.push(o);
  }
  const orden = (a: ObraParaRedes, b: ObraParaRedes) =>
    (a.puesto ?? 0) - (b.puesto ?? 0) || a.nombre.localeCompare(b.nombre, "es");
  return {
    publicables: publicables.sort(orden),
    sinPermiso: sinPermiso.sort(orden),
    sinFoto: sinFoto.sort(orden),
  };
}

/** macOS, Windows y Drive rechazan estos caracteres en un nombre de archivo. */
export function limpiarParaArchivo(texto: string): string {
  return texto
    .replace(/[/\\:*?"<>|]/g, " ")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
}

export function instagramConArroba(instagram: string | null): string | null {
  const limpio = instagram?.trim().replace(/^@+/, "").replace(/\s+/g, "");
  return limpio ? `@${limpio}` : null;
}

export function nombreDeCarpeta(consigna: { sequence: number; titulo: string | null }): string {
  const titulo = consigna.titulo ? limpiarParaArchivo(consigna.titulo) : "";
  return titulo ? `Consigna ${consigna.sequence} - ${titulo}` : `Consigna ${consigna.sequence}`;
}

/**
 * "Movimiento - 1 - Leandro Bordon - @leotank.life - a foto.jpg"
 *
 * La "a" y la "b" del final ordenan cada obra como en el carrusel: primero la
 * foto, después su ficha. Si en la carpeta hay puestos de dos cifras, se
 * rellenan con cero para que el 10 no quede antes que el 2.
 */
export function nombreDeArchivo(input: {
  consigna: string;
  puesto: number;
  nombre: string;
  instagram: string | null;
  tipo: "foto" | "ficha";
  cifras: number;
}): string {
  const partes = [
    limpiarParaArchivo(input.consigna) || "Consigna",
    String(input.puesto).padStart(input.cifras, "0"),
    limpiarParaArchivo(input.nombre) || "Sin nombre",
    limpiarParaArchivo(instagramConArroba(input.instagram) ?? "sin instagram"),
    input.tipo === "foto" ? "a foto" : "b ficha",
  ];
  return `${partes.join(" - ")}.jpg`;
}
