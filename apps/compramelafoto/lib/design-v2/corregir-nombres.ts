import {
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_OWNER_VARIABLE_KEY,
  COURSE_MOSAIC_VARIABLE_KEY,
  parseClassListGroups,
  parseCourseMosaic,
  parseCourseMosaicOwner,
  serializeClassListGroups,
  serializeCourseMosaic,
  serializeCourseMosaicOwner,
} from "@repo/template-engine";

/**
 * Corregir un nombre mal escrito en un librito: en el listado del curso, en el mosaico y, si es el
 * alumno del librito, en su nombre de la tapa. Lo usan el fotógrafo (en un librito o en todos los
 * del álbum) y la familia en el canje (sólo en el suyo).
 *
 * Puro (sin base): el navegador lo usa para la vista previa y el servidor para guardar.
 */

export type NombreDeAlumno = { firstName: string; lastName: string };
export type CambioDeNombre = { de: NombreDeAlumno; a: NombreDeAlumno };

export const MAX_CAMBIOS_DE_NOMBRE = 50;
const MAX_LARGO = 100;

function limpio(t: unknown): string {
  return typeof t === "string" ? t.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, MAX_LARGO) : "";
}

function clave(n: NombreDeAlumno): string {
  // Sin distinguir mayúsculas («LÓPEZ» y «López» son el mismo), pero sí tildes: corregir una
  // tilde es justamente uno de los errores que se arreglan acá.
  return `${limpio(n.firstName).toLocaleLowerCase("es")}|${limpio(n.lastName).toLocaleLowerCase("es")}`;
}

export function mismoNombre(a: NombreDeAlumno, b: NombreDeAlumno): boolean {
  return clave(a) === clave(b);
}

export function nombreCompleto(n: NombreDeAlumno): string {
  return [limpio(n.firstName), limpio(n.lastName)].filter(Boolean).join(" ");
}

/** Los cambios que mandó el navegador, limpios: sin vacíos, sin los que no cambian nada y sin repetidos. */
export function normalizarCambiosDeNombre(raw: unknown): CambioDeNombre[] {
  if (!Array.isArray(raw)) return [];
  const out: CambioDeNombre[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const de = r.de && typeof r.de === "object" ? (r.de as Record<string, unknown>) : null;
    const a = r.a && typeof r.a === "object" ? (r.a as Record<string, unknown>) : null;
    if (!de || !a) continue;
    const cambio: CambioDeNombre = {
      de: { firstName: limpio(de.firstName), lastName: limpio(de.lastName) },
      a: { firstName: limpio(a.firstName), lastName: limpio(a.lastName) },
    };
    if (!nombreCompleto(cambio.de) || !cambio.a.firstName || !cambio.a.lastName) continue;
    // Que no cambie nada, ni siquiera mayúsculas o espacios: no es un cambio.
    if (cambio.de.firstName === cambio.a.firstName && cambio.de.lastName === cambio.a.lastName) continue;
    if (out.some((c) => mismoNombre(c.de, cambio.de))) continue;
    out.push(cambio);
    if (out.length >= MAX_CAMBIOS_DE_NOMBRE) break;
  }
  return out;
}

function reemplazo(n: NombreDeAlumno, cambios: readonly CambioDeNombre[]): NombreDeAlumno | null {
  return cambios.find((c) => mismoNombre(c.de, n))?.a ?? null;
}

/**
 * Los textos del librito con los nombres corregidos. `cambiados` dice qué textos cambiaron (vacío:
 * ese nombre no está en este librito).
 */
export function corregirNombresEnValores(
  values: Record<string, string>,
  cambios: readonly CambioDeNombre[],
): { values: Record<string, string>; cambiados: string[] } {
  const next = { ...values };
  const cambiados: string[] = [];
  if (cambios.length === 0) return { values: next, cambiados };

  const listado = values[CLASS_LIST_VARIABLE_KEY];
  if (listado) {
    const grupos = parseClassListGroups(listado, values["course.displayName"]);
    let toco = false;
    const nuevos = grupos.map((g) => ({
      ...g,
      students: g.students.map((s) => {
        const a = reemplazo(s, cambios);
        if (!a) return s;
        toco = true;
        return { ...s, firstName: a.firstName, lastName: a.lastName };
      }),
    }));
    if (toco) {
      next[CLASS_LIST_VARIABLE_KEY] = serializeClassListGroups(nuevos);
      cambiados.push(CLASS_LIST_VARIABLE_KEY);
    }
  }

  const mosaico = values[COURSE_MOSAIC_VARIABLE_KEY];
  if (mosaico) {
    let toco = false;
    const chicos = parseCourseMosaic(mosaico).map((s) => {
      const a = reemplazo(s, cambios);
      if (!a) return s;
      toco = true;
      return { ...s, firstName: a.firstName, lastName: a.lastName };
    });
    if (toco) {
      next[COURSE_MOSAIC_VARIABLE_KEY] = serializeCourseMosaic(chicos);
      cambiados.push(COURSE_MOSAIC_VARIABLE_KEY);
    }
  }

  const dueno = parseCourseMosaicOwner(values[COURSE_MOSAIC_OWNER_VARIABLE_KEY]);
  const nuevoDueno = dueno ? reemplazo(dueno, cambios) : null;
  if (dueno && nuevoDueno) {
    next[COURSE_MOSAIC_OWNER_VARIABLE_KEY] = serializeCourseMosaicOwner({ ...dueno, ...nuevoDueno });
    cambiados.push(COURSE_MOSAIC_OWNER_VARIABLE_KEY);
  }

  // El alumno del librito: su nombre de la tapa, en todos los formatos.
  const alumno = { firstName: values["student.firstName"] ?? "", lastName: values["student.lastName"] ?? "" };
  const nuevoAlumno = alumno.firstName || alumno.lastName ? reemplazo(alumno, cambios) : null;
  if (nuevoAlumno) {
    next["student.firstName"] = nuevoAlumno.firstName;
    next["student.lastName"] = nuevoAlumno.lastName;
    next["student.fullName"] = nombreCompleto(nuevoAlumno);
    next["student.lastNameFirst"] = `${nuevoAlumno.lastName}, ${nuevoAlumno.firstName}`;
    cambiados.push("student.firstName", "student.lastName", "student.fullName", "student.lastNameFirst");
  }
  return { values: next, cambiados };
}

/** Los alumnos del listado del librito, por curso: lo que se muestra para corregir. */
export function alumnosParaCorregir(
  values: Record<string, string>,
): Array<{ title: string; students: Array<NombreDeAlumno & { isOwner: boolean }> }> {
  return parseClassListGroups(values[CLASS_LIST_VARIABLE_KEY], values["course.displayName"]).map((g) => ({
    title: g.title,
    students: g.students.map((s) => ({ firstName: s.firstName, lastName: s.lastName, isOwner: s.isOwner === true })),
  }));
}
