/**
 * Lo que ve el colegio con su enlace del «Mosaico del curso»: sólo el título, la lista del curso
 * (nombre y si ya tiene retrato), los retratos sin identificar y la maestra/directivos.
 * Nada de compras, familias ni URLs de R2: las fotos se piden por la ruta con token.
 *
 * Archivo puro (sin base ni `server-only`) para poder probarlo con `node:test`.
 */

/** Lo mínimo de `ResumenDelCurso` (lib/mosaico/curso.ts) que hace falta acá. */
export type ResumenDeEntrada = {
  titulo: string;
  alumnos: Array<{ rosterEntryId: number; nombre: string; apellido: string; retrato: unknown | null }>;
  integrantes: Array<{ role: string; name: string; photoId: number | null }>;
  sinIdentificar: Array<{ photoId: number }>;
};

export type AlumnoParaElColegio = { rosterEntryId: number; nombre: string; apellido: string; tieneRetrato: boolean };
export type IntegranteParaElColegio = { role: string; name: string; tieneFoto: boolean; photoId: number | null };

export type ResumenParaElColegio = {
  titulo: string;
  alumnos: AlumnoParaElColegio[];
  sinIdentificar: Array<{ photoId: number }>;
  integrantes: IntegranteParaElColegio[];
};

export function resumenParaElColegio(r: ResumenDeEntrada): ResumenParaElColegio {
  return {
    titulo: r.titulo,
    alumnos: r.alumnos.map((a) => ({
      rosterEntryId: a.rosterEntryId,
      nombre: a.nombre,
      apellido: a.apellido,
      tieneRetrato: a.retrato != null,
    })),
    sinIdentificar: r.sinIdentificar.map((s) => ({ photoId: s.photoId })),
    integrantes: r.integrantes.map((i) => ({
      role: i.role,
      name: i.name,
      tieneFoto: i.photoId != null,
      photoId: i.photoId,
    })),
  };
}

/** Las acciones que acepta el POST del colegio. Cualquier otra cosa → null. */
export type AccionDelColegio =
  | { accion: "asignar"; photoId: number; rosterEntryId: number }
  | { accion: "integrantes"; integrantes: Array<{ role: string; name: string }> };

function idPositivo(x: unknown): number | null {
  return typeof x === "number" && Number.isInteger(x) && x > 0 && x <= 2_147_483_647 ? x : null;
}

export function leerAccionDelColegio(body: unknown): AccionDelColegio | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.accion === "asignar") {
    const photoId = idPositivo(b.photoId);
    const rosterEntryId = idPositivo(b.rosterEntryId);
    return photoId && rosterEntryId ? { accion: "asignar", photoId, rosterEntryId } : null;
  }
  if (b.accion === "integrantes") {
    if (!Array.isArray(b.integrantes) || b.integrantes.length > 20) return null;
    const integrantes = b.integrantes.map((x) => {
      const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      return {
        role: typeof r.role === "string" ? r.role.trim().slice(0, 60) : "",
        name: typeof r.name === "string" ? r.name.trim().slice(0, 120) : "",
      };
    });
    return { accion: "integrantes", integrantes };
  }
  return null;
}
