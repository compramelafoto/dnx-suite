import {
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_VARIABLE_KEY,
  DEFAULT_CLASS_LIST_OPTIONS,
  formatClassList,
  type ClassListOptions,
} from "@repo/template-engine";
import { textVariableLabel } from "@/lib/design-v2/client-payload";
import {
  cursosDelListado,
  cursosParaSumar,
  valoresConCursos,
  type CursoDelAlbum,
} from "@/lib/design-v2/listado-cursos";
import {
  aplicarCorrecciones,
  FRASE_DE_AUTORIZACION,
  limpiarAvisos,
  type ListaAImprimir,
  type RevisionDelCliente,
  type TextoAImprimir,
} from "./autorizacion";

/**
 * La revisión del librito en el canje escolar: qué textos ve la familia, cuáles puede corregir,
 * qué cursos puede sumar, y cómo queda lo que se guarda al confirmar.
 *
 * Puro: el navegador lo usa para la vista previa y el servidor para armar el diseño de verdad
 * con los mismos datos (el servidor no confía en lo que arma el navegador: lo vuelve a calcular).
 */

/** Lo que manda el navegador al confirmar. */
export type RevisionPedida = {
  autorizado: true;
  /** Correcciones de la familia: variable → texto nuevo. Sólo se aplican las editables. */
  textos?: Record<string, string>;
  /** Claves de los cursos que sumó al listado. */
  cursos?: string[];
  /** Avisos de error en el listado, para el fotógrafo. */
  avisos?: string[];
};

/** La familia corrige sus datos (nombre del alumno, el suyo), no los del colegio ni los compañeros. */
export function esTextoEditablePorLaFamilia(key: string): boolean {
  return key.startsWith("student.") || key.startsWith("buyer.");
}

/** Los textos que se van a imprimir, en el orden de la plantilla, con lo que valen ahora. */
export function textosAImprimir(textVariables: readonly string[], values: Record<string, string>): TextoAImprimir[] {
  return textVariables
    .filter((k) => k !== CLASS_LIST_VARIABLE_KEY && k !== COURSE_MOSAIC_VARIABLE_KEY)
    .map((key) => ({
      key,
      label: textVariableLabel(key),
      value: values[key] ?? "",
      editable: esTextoEditablePorLaFamilia(key),
    }));
}

/** El listado tal como se imprime: un título y los nombres por curso, ordenados y escritos como en la plantilla. */
export function listasAImprimir(
  values: Record<string, string>,
  opciones: ClassListOptions = DEFAULT_CLASS_LIST_OPTIONS,
): ListaAImprimir[] {
  return cursosDelListado(values).map((g) => ({
    title: g.title,
    names: formatClassList(g.students, opciones).map((l) => l.text),
  }));
}

/**
 * Los textos del librito con lo que hizo la familia (correcciones y cursos sumados) y la
 * revisión que se guarda en el diseño, con la autorización.
 */
export function aplicarRevisionDelCanje(input: {
  values: Record<string, string>;
  /** Variables de texto de las plantillas del pack. */
  textVariables: readonly string[];
  /** Si alguna plantilla deja sumar cursos al listado. */
  permiteSumar: boolean;
  /** Cómo escribe y ordena los nombres el listado de la plantilla. */
  opcionesDelListado?: ClassListOptions;
  /** Los cursos del colegio (o del Excel) del álbum. */
  disponibles: readonly CursoDelAlbum[];
  revision: RevisionPedida;
  /** Qué se autoriza («Carpeta San Patricio»). */
  subject: string;
  by: { name: string | null; email: string | null };
  userAgent: string | null;
  now: Date;
}): { values: Record<string, string>; clientReview: RevisionDelCliente } {
  const editables = new Set(input.textVariables.filter(esTextoEditablePorLaFamilia));
  const corregido = aplicarCorrecciones(input.values, editables, input.revision.textos);
  const grupos = cursosDelListado(corregido.values);
  const posibles = new Set(cursosParaSumar(grupos, input.disponibles).map((c) => c.key));
  const cursos = input.permiteSumar
    ? [...new Set((input.revision.cursos ?? []).filter((k) => posibles.has(k)))]
    : [];
  const values = cursos.length ? valoresConCursos(corregido.values, input.disponibles, cursos) : corregido.values;
  return {
    values,
    clientReview: {
      authorization: {
        authorizedAt: input.now.toISOString(),
        statement: FRASE_DE_AUTORIZACION,
        subject: input.subject,
        by: input.by,
        texts: textosAImprimir(input.textVariables, values).map(({ key, label, value }) => ({ key, label, value })),
        lists: listasAImprimir(values, input.opcionesDelListado),
        edits: corregido.edits,
        digest: null,
        revisionId: null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
      reports: limpiarAvisos(input.revision.avisos, "listado", input.now),
      extraCourseKeys: cursos,
    },
  };
}
