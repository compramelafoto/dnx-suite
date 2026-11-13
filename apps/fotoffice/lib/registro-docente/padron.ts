/**
 * Lee el padrón que la docente pega desde Excel, Google Sheets o la planilla bajada de Mi Escuela.
 *
 * Acepta:
 * - columnas separadas por tabulación (lo que se copia de una planilla), punto y coma o «|»;
 * - con o sin encabezado («Apellido», «Nombre», «Apellido y nombre», «DNI», «Condición»);
 * - una sola columna «PÉREZ, Juan» o «PÉREZ Juan Ignacio» (apellido en mayúsculas);
 * - números de orden al principio, que se ignoran: vale el orden en que se pegó.
 *
 * Puro, sin base: se usa para la vista previa antes de guardar.
 */

export type FilaPadron = {
  apellido: string;
  nombre: string;
  dni: string | null;
  condicion: "R" | "NR";
  /** Renglón del texto pegado (1 = el primero), para los avisos. */
  renglon: number;
  /** El apellido y el nombre se separaron adivinando: conviene mirarlo. */
  revisar: boolean;
};

export type PadronLeido = { filas: FilaPadron[]; avisos: string[] };

export const TOPE_PADRON = 200;

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Columna = "apellido" | "nombre" | "apellidoNombre" | "dni" | "condicion" | "orden" | "otra";

function columnaDeEncabezado(celda: string): Columna | null {
  const c = sinTildes(celda).replace(/[^a-z ]/g, "").replace(/\s+/g, " ");
  if (!c) return null;
  if (/^(apellidos? y nombres?|apellidos? nombres?|nombre y apellido|nombre completo|estudiante|alumno|alumna)$/.test(c)) return "apellidoNombre";
  if (/^apellidos?$/.test(c)) return "apellido";
  if (/^nombres?$/.test(c)) return "nombre";
  if (/^(dni|documento|nro documento|n documento|numero de documento|doc)$/.test(c)) return "dni";
  if (/^(condicion|cond|situacion)$/.test(c)) return "condicion";
  if (/^(orden|n|nro|numero|no)$/.test(c)) return "orden";
  return null;
}

function separar(linea: string): string[] {
  if (linea.includes("\t")) return linea.split("\t");
  if (linea.includes(";")) return linea.split(";");
  if (linea.includes("|")) return linea.split("|");
  return [linea];
}

const limpiar = (s: string) => s.replace(/\s+/g, " ").trim();
const esDni = (s: string) => /^\d{1,2}\.?\d{3}\.?\d{3}$/.test(s.trim());
const esOrden = (s: string) => /^\d{1,3}[.)°º]?$/.test(s.trim());
const esCondicion = (s: string) => /^(r|nr|regular|no regular)$/i.test(s.trim());

function condicionDe(s: string | undefined): "R" | "NR" {
  if (!s) return "R";
  const c = sinTildes(s);
  return c === "nr" || c === "no regular" ? "NR" : "R";
}

/** «PÉREZ, Juan» · «PÉREZ GÓMEZ Juan Ignacio» · «Juan Pérez» (este último, a revisar). */
export function separarApellidoNombre(texto: string): { apellido: string; nombre: string; revisar: boolean } {
  const t = limpiar(texto);
  if (t.includes(",")) {
    const [ap, ...resto] = t.split(",");
    return { apellido: limpiar(ap), nombre: limpiar(resto.join(" ")), revisar: false };
  }
  const palabras = t.split(" ");
  if (palabras.length === 1) return { apellido: t, nombre: "", revisar: true };
  // Las palabras en mayúsculas del principio son el apellido (así lo muestra Mi Escuela).
  const esMayus = (p: string) => p.length > 1 && p === p.toLocaleUpperCase("es") && p !== p.toLocaleLowerCase("es");
  let i = 0;
  while (i < palabras.length && esMayus(palabras[i])) i++;
  if (i > 0 && i < palabras.length) {
    return { apellido: palabras.slice(0, i).join(" "), nombre: palabras.slice(i).join(" "), revisar: false };
  }
  // Sin pistas: la primera palabra es el apellido. Se avisa para que lo mire.
  return { apellido: palabras[0], nombre: palabras.slice(1).join(" "), revisar: true };
}

export function leerPadron(texto: string): PadronLeido {
  const avisos: string[] = [];
  const lineas = texto.replace(/\r\n?/g, "\n").split("\n");
  let columnas: Columna[] | null = null;
  const filas: FilaPadron[] = [];
  const vistos = new Map<string, number>();

  lineas.forEach((linea, idx) => {
    const renglon = idx + 1;
    if (!linea.trim()) return;
    const celdas = separar(linea).map(limpiar);

    if (columnas === null && filas.length === 0) {
      const enc = celdas.map(columnaDeEncabezado);
      if (enc.some((c) => c === "apellido" || c === "apellidoNombre" || c === "nombre")) {
        columnas = enc.map((c) => c ?? "otra");
        return;
      }
    }

    let apellido = "";
    let nombre = "";
    let dni: string | null = null;
    let condicion: "R" | "NR" = "R";
    let revisar = false;

    if (columnas) {
      const de = (col: Columna) => {
        const i = columnas!.indexOf(col);
        return i >= 0 ? (celdas[i] ?? "") : "";
      };
      if (columnas.includes("apellidoNombre")) {
        const s = separarApellidoNombre(de("apellidoNombre"));
        apellido = s.apellido;
        nombre = s.nombre;
        revisar = s.revisar;
      } else {
        apellido = de("apellido");
        nombre = de("nombre");
      }
      const d = de("dni");
      dni = d && esDni(d) ? d.replace(/\./g, "") : null;
      condicion = condicionDe(de("condicion"));
    } else {
      const textos: string[] = [];
      for (const [i, c] of celdas.entries()) {
        if (!c) continue;
        if (esDni(c)) dni = c.replace(/\./g, "");
        else if (esCondicion(c)) condicion = condicionDe(c);
        else if (i === 0 && esOrden(c)) continue;
        else textos.push(c);
      }
      if (textos.length >= 2) {
        apellido = textos[0].replace(/,$/, "");
        nombre = textos[1];
      } else if (textos.length === 1) {
        const s = separarApellidoNombre(textos[0].replace(/^\d{1,3}[.)°º-]?\s+/, ""));
        apellido = s.apellido;
        nombre = s.nombre;
        revisar = s.revisar;
      }
    }

    apellido = limpiar(apellido).slice(0, 80);
    nombre = limpiar(nombre).slice(0, 80);
    if (!apellido) {
      avisos.push(`Renglón ${renglon}: no se encontró el apellido; se salteó.`);
      return;
    }
    const clave = dni ?? sinTildes(`${apellido} ${nombre}`);
    const previo = vistos.get(clave);
    if (previo !== undefined) {
      avisos.push(`Renglón ${renglon}: repite al renglón ${previo}; se salteó.`);
      return;
    }
    vistos.set(clave, renglon);
    if (filas.length >= TOPE_PADRON) {
      if (filas.length === TOPE_PADRON) avisos.push(`Se leen hasta ${TOPE_PADRON} estudiantes por vez.`);
      return;
    }
    filas.push({ apellido, nombre, dni, condicion, renglon, revisar });
  });

  const aRevisar = filas.filter((f) => f.revisar).length;
  if (aRevisar) avisos.push(`${aRevisar} ${aRevisar === 1 ? "nombre se separó" : "nombres se separaron"} adivinando dónde termina el apellido: revisalos.`);
  return { filas, avisos };
}

/** Clave para no cargar dos veces a la misma persona en un curso. */
export function claveDeEstudiante(e: { apellido: string; nombre: string; dni: string | null }): string {
  return e.dni ? `dni:${e.dni}` : `nom:${sinTildes(`${e.apellido} ${e.nombre}`)}`;
}
