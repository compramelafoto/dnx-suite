import type { RulesData } from "./types";

type ContestForRules = {
  title: string;
  shortDescription: string | null;
  fullDescription: string | null;
  organization: { name: string };
  categories: { name: string; maxFiles: number; description: string | null }[];
  startAt: Date | null;
  submissionDeadline: Date | null;
  judgingStartAt: Date | null;
  judgingEndAt: Date | null;
  resultsAt: Date | null;
};

function section(title: string, content: string): string {
  if (!content?.trim()) return "";
  return `\n## ${title}\n\n${content.trim()}\n`;
}

function paragraph(text: string): string {
  if (!text?.trim()) return "";
  return `${text.trim()}\n`;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Genera rulesText combinando datos del concurso (sistema) + respuestas del asistente.
 * NO repite datos ya existentes. Solo usa lo que el asistente aporta para bloques no derivables.
 */
export function generateRulesFromContest(
  contest: ContestForRules,
  assistantData: Partial<RulesData>
): string {
  const parts: string[] = [];
  parts.push("# BASES Y CONDICIONES DEL CONCURSO\n");

  // 1. Identidad — desde el concurso
  const identidadBlock = [
    contest.organization.name && `Organizador: ${contest.organization.name}.`,
    contest.title && `Concurso: ${contest.title}.`,
    contest.shortDescription && paragraph(contest.shortDescription),
    contest.fullDescription && paragraph(contest.fullDescription),
  ]
    .filter(Boolean)
    .join("\n");
  if (identidadBlock) parts.push(section("1. Identidad del concurso", identidadBlock));

  // 2. Participación — fechas desde concurso
  const participacionBlock = [
    contest.startAt && `Fecha de inicio: ${formatDate(contest.startAt)}.`,
    contest.submissionDeadline && `Cierre de inscripciones: ${formatDate(contest.submissionDeadline)}.`,
    contest.judgingStartAt && `Inicio de evaluación: ${formatDate(contest.judgingStartAt)}.`,
    contest.judgingEndAt && `Fin de evaluación: ${formatDate(contest.judgingEndAt)}.`,
    contest.resultsAt && `Publicación de resultados: ${formatDate(contest.resultsAt)}.`,
    assistantData.participacion?.requisitos,
    assistantData.participacion?.exclusiones,
    assistantData.participacion?.limiteParticipaciones,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (participacionBlock) parts.push(section("2. Participación", participacionBlock));

  // 3. Obras — categorías desde concurso + asistente
  const obrasFromCategories = contest.categories.length
    ? `Categorías: ${contest.categories.map((c) => `${c.name} (máx. ${c.maxFiles} archivo${c.maxFiles > 1 ? "s" : ""})`).join("; ")}.`
    : "";
  const obrasBlock = [
    obrasFromCategories,
    assistantData.obras?.tipoObras,
    assistantData.obras?.originalidad,
    assistantData.obras?.ineditas,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (obrasBlock) parts.push(section("3. Obras", obrasBlock));

  // 4. Formato — solo si el asistente aportó
  const formato = assistantData.formato;
  if (formato?.formatosAceptados || formato?.resolucionMinima || formato?.pesoMaximo || formato?.manipulacion) {
    let block = "";
    if (formato.formatosAceptados) {
      const formats = formato.formatosAceptados.split(",").map((s) => s.trim()).filter(Boolean);
      if (formats.length) block += paragraph(`Formatos aceptados: ${formats.join(", ")}.`);
    }
    if (formato.resolucionMinima) block += paragraph(`Resolución mínima: ${formato.resolucionMinima}.`);
    if (formato.pesoMaximo) block += paragraph(`Peso máximo: ${formato.pesoMaximo}.`);
    if (formato.manipulacion) block += paragraph(formato.manipulacion);
    if (block) parts.push(section("4. Formato técnico", block));
  }

  // 5. Jurado — asistente
  const jurado = assistantData.jurado;
  if (jurado?.composicion || jurado?.criterios || jurado?.decision) {
    let block = "";
    if (jurado.composicion) block += paragraph(jurado.composicion);
    if (jurado.criterios) block += paragraph(jurado.criterios);
    if (jurado.decision) block += paragraph(jurado.decision);
    if (block) parts.push(section("5. Jurado", block));
  }

  // 6. Premios — asistente
  const premios = assistantData.premios;
  if (premios?.premios || premios?.entrega || premios?.impuestos) {
    let block = "";
    if (premios.premios) block += paragraph(premios.premios);
    if (premios.entrega) block += paragraph(premios.entrega);
    if (premios.impuestos) block += paragraph(premios.impuestos);
    if (block) parts.push(section("6. Premios", block));
  }

  // 7. Derechos — asistente (siempre preguntamos)
  const derechos = assistantData.derechos;
  if (derechos?.cesion || derechos?.uso || derechos?.creditos) {
    let block = "";
    if (derechos.cesion) block += paragraph(derechos.cesion);
    if (derechos.uso) block += paragraph(derechos.uso);
    if (derechos.creditos) block += paragraph(derechos.creditos);
    if (block) parts.push(section("7. Derechos de autor", block));
  }

  // 8. Legal — asistente
  const legal = assistantData.legal;
  if (legal?.reclamaciones || legal?.jurisdiccion) {
    let block = "";
    if (legal.reclamaciones) block += paragraph(legal.reclamaciones);
    if (legal.jurisdiccion) block += paragraph(legal.jurisdiccion);
    if (block) parts.push(section("8. Aspectos legales", block));
  }

  // 9. Datos personales — asistente
  const datosPersonales = assistantData.datosPersonales;
  if (datosPersonales?.tratamiento || datosPersonales?.finalidad || datosPersonales?.cesionTerceros) {
    let block = "";
    if (datosPersonales.tratamiento) block += paragraph(datosPersonales.tratamiento);
    if (datosPersonales.finalidad) block += paragraph(datosPersonales.finalidad);
    if (datosPersonales.cesionTerceros) block += paragraph(datosPersonales.cesionTerceros);
    if (block) parts.push(section("9. Datos personales", block));
  }

  // 10. Disposiciones finales — asistente
  const disposiciones = assistantData.disposicionesFinales;
  if (disposiciones?.modificacion || disposiciones?.interpretacion || disposiciones?.aceptacion) {
    let block = "";
    if (disposiciones.modificacion) block += paragraph(disposiciones.modificacion);
    if (disposiciones.interpretacion) block += paragraph(disposiciones.interpretacion);
    if (disposiciones.aceptacion) block += paragraph(disposiciones.aceptacion);
    if (block) parts.push(section("10. Disposiciones finales", block));
  }

  return parts.join("").trim() || "";
}
