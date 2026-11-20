/**
 * Reglas puras (sin base) del aviso por curso en álbumes escolares con preventa.
 *
 * El fotógrafo sube las fotos curso por curso. Avisarle a todo el colegio con la primera tanda
 * hace entrar a familias cuyo curso todavía no está (álbum 1075, octubre de 2026). Por eso el
 * fotógrafo marca qué cursos ya subió y el aviso sale sólo a las familias de esos cursos.
 *
 * Módulo aparte y sin dependencias: lo usan el panel, el cron, el bot y la página del canje.
 */

/** Un pack de preventa pagado, con el curso que eligió la familia al comprar. */
export type PackConCurso = {
  orderId: number;
  schoolCourseId: number | null;
  canjeado: boolean;
  /** Fecha del último aviso «ya están las fotos» (de antes del aviso por curso, o del nuevo). */
  avisoAt: string | null;
  tieneEmail: boolean;
};

export type MarcaDeCurso = { schoolCourseId: number; marcadoAt: Date; avisoAt: Date | null };

export type EstadoCurso = "sin_marcar" | "esperando_proceso" | "avisado";

export type ResumenCurso = {
  schoolCourseId: number;
  nombre: string;
  packs: number;
  pendientes: number;
  pendientesConEmail: number;
  estado: EstadoCurso;
  marcadoAt: string | null;
  avisoAt: string | null;
};

/** `null` = fecha no válida. */
function iso(d: Date | null | undefined): string | null {
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

/**
 * Un curso cuenta como publicado si el fotógrafo lo marcó, o si alguna familia del curso ya
 * recibió el aviso de antes (álbumes que se avisaron antes de que existiera el aviso por curso).
 */
export function cursoEstaPublicado(
  schoolCourseId: number,
  marcas: ReadonlyMap<number, MarcaDeCurso>,
  packs: readonly PackConCurso[]
): boolean {
  if (marcas.has(schoolCourseId)) return true;
  return packs.some((p) => p.schoolCourseId === schoolCourseId && p.avisoAt != null);
}

/** Estado de cada curso para el panel, en el orden en que vienen los cursos de la escuela. */
export function resumirCursos(
  cursos: ReadonlyArray<{ id: number; nombre: string }>,
  packs: readonly PackConCurso[],
  marcas: ReadonlyMap<number, MarcaDeCurso>
): ResumenCurso[] {
  return cursos.map((c) => {
    const delCurso = packs.filter((p) => p.schoolCourseId === c.id);
    const pendientes = delCurso.filter((p) => !p.canjeado);
    const marca = marcas.get(c.id) ?? null;
    const avisoViejo = delCurso
      .map((p) => p.avisoAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;
    let estado: EstadoCurso = "sin_marcar";
    if (marca) estado = marca.avisoAt ? "avisado" : "esperando_proceso";
    else if (avisoViejo) estado = "avisado";
    return {
      schoolCourseId: c.id,
      nombre: c.nombre,
      packs: delCurso.length,
      pendientes: pendientes.length,
      pendientesConEmail: pendientes.filter((p) => p.tieneEmail).length,
      estado,
      marcadoAt: iso(marca?.marcadoAt),
      avisoAt: iso(marca?.avisoAt) ?? avisoViejo,
    };
  });
}

/** Packs sin canjear de esos cursos: a ellos va el aviso. */
export function packsAAvisar(packs: readonly PackConCurso[], cursoIds: ReadonlySet<number>): number[] {
  return packs
    .filter((p) => !p.canjeado && p.schoolCourseId != null && cursoIds.has(p.schoolCourseId))
    .map((p) => p.orderId);
}

/**
 * ¿Los anotados del álbum (los que dejaron el mail para enterarse) tienen que seguir esperando?
 * Su aviso dice «ya están las fotos» sin curso, así que en un álbum con preventa espera a que
 * estén todos los cursos que tienen packs. Si ningún pack tiene curso, alcanza con un aviso.
 */
export function anotadosEsperan(packs: readonly PackConCurso[], marcas: ReadonlyMap<number, MarcaDeCurso>): boolean {
  if (packs.length === 0) return false;
  const huboAviso = marcas.size > 0 || packs.some((p) => p.avisoAt != null);
  if (!huboAviso) return true;
  const cursos = new Set(packs.map((p) => p.schoolCourseId).filter((id): id is number => id != null));
  for (const id of cursos) {
    if (!cursoEstaPublicado(id, marcas, packs)) return true;
  }
  return false;
}

/**
 * ¿La página del canje le dice a la familia que su curso todavía no está? Sólo cuando el álbum
 * ya usa el aviso por curso (hay alguna marca) y el curso de este pack no está publicado.
 */
export function cursoDelPackTodaviaNoEsta(
  pack: Pick<PackConCurso, "schoolCourseId" | "avisoAt">,
  marcas: ReadonlyMap<number, MarcaDeCurso>
): boolean {
  if (marcas.size === 0 || pack.schoolCourseId == null || pack.avisoAt != null) return false;
  return !marcas.has(pack.schoolCourseId);
}

/** Ids de curso válidos que manda el panel: enteros positivos, sin repetir. */
export function parseCursoIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((n): n is number => Number.isInteger(n) && (n as number) > 0))];
}

function normalizarCurso(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[°º·•.,\-_/()]/g, " ")
    .replace(/\b(grado|ano|año|sala|curso)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cursos que nombró el fotógrafo (p. ej. por el bot: «3° A», «sala 5») contra los de la escuela.
 * Devuelve los encontrados y los nombres que no coinciden con ninguno.
 */
export function resolverCursosPorNombre(
  nombres: readonly string[],
  cursos: ReadonlyArray<{ schoolCourseId: number; nombre: string }>
): { ids: number[]; noEncontrados: string[] } {
  const ids = new Set<number>();
  const noEncontrados: string[] = [];
  for (const n of nombres) {
    const buscado = normalizarCurso(n);
    let hit = buscado ? cursos.find((c) => normalizarCurso(c.nombre) === buscado) : undefined;
    // «Sala 5» contra «Inicial · Sala 5»: vale si termina igual y hay uno solo así.
    if (!hit && buscado) {
      const finales = cursos.filter((c) => normalizarCurso(c.nombre).endsWith(` ${buscado}`));
      if (finales.length === 1) hit = finales[0];
    }
    if (hit) ids.add(hit.schoolCourseId);
    else noEncontrados.push(n);
  }
  return { ids: [...ids], noEncontrados };
}
