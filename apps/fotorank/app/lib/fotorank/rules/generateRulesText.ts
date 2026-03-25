import type { RulesData } from "./types";

function section(title: string, content: string): string {
  if (!content?.trim()) return "";
  return `\n## ${title}\n\n${content.trim()}\n`;
}

function paragraph(text: string): string {
  if (!text?.trim()) return "";
  return `${text.trim()}\n`;
}

/**
 * Genera el texto completo de bases y condiciones a partir de rulesData.
 * Estructura clara y escalable para futura integración con IA.
 */
export function generateRulesText(data: RulesData): string {
  const parts: string[] = [];

  parts.push("# BASES Y CONDICIONES DEL CONCURSO\n");

  // Identidad
  const identidad = data.identidad;
  if (identidad.organizador || identidad.nombreConcurso || identidad.objeto) {
    let block = "";
    if (identidad.organizador) block += paragraph(identidad.organizador);
    if (identidad.nombreConcurso) block += paragraph(identidad.nombreConcurso);
    if (identidad.objeto) block += paragraph(identidad.objeto);
    if (block) parts.push(section("1. Identidad del concurso", block));
  }

  // Participación
  const participacion = data.participacion;
  if (
    participacion.requisitos ||
    participacion.exclusiones ||
    participacion.limiteParticipaciones ||
    participacion.fechaLimite
  ) {
    let block = "";
    if (participacion.requisitos) block += paragraph(participacion.requisitos);
    if (participacion.exclusiones) block += paragraph(participacion.exclusiones);
    if (participacion.limiteParticipaciones)
      block += paragraph(participacion.limiteParticipaciones);
    if (participacion.fechaLimite) block += paragraph(participacion.fechaLimite);
    if (block) parts.push(section("2. Participación", block));
  }

  // Obras
  const obras = data.obras;
  if (obras.tipoObras || obras.originalidad || obras.ineditas) {
    let block = "";
    if (obras.tipoObras) {
      const types = obras.tipoObras.split(",").map((s) => s.trim()).filter(Boolean);
      block += paragraph(
        types.length > 0
          ? `Tipos de obras aceptadas: ${types.join(", ")}.`
          : obras.tipoObras
      );
    }
    if (obras.originalidad) block += paragraph(obras.originalidad);
    if (obras.ineditas) block += paragraph(obras.ineditas);
    if (block) parts.push(section("3. Obras", block));
  }

  // Formato
  const formato = data.formato;
  if (
    formato.formatosAceptados ||
    formato.resolucionMinima ||
    formato.pesoMaximo ||
    formato.manipulacion
  ) {
    let block = "";
    if (formato.formatosAceptados) {
      const formats = formato.formatosAceptados.split(",").map((s) => s.trim()).filter(Boolean);
      block += paragraph(
        formats.length > 0
          ? `Formatos de imagen aceptados: ${formats.join(", ")}.`
          : formato.formatosAceptados
      );
    }
    if (formato.resolucionMinima) block += paragraph(`Resolución mínima: ${formato.resolucionMinima}.`);
    if (formato.pesoMaximo) block += paragraph(`Peso máximo por archivo: ${formato.pesoMaximo}.`);
    if (formato.manipulacion) block += paragraph(formato.manipulacion);
    if (block) parts.push(section("4. Formato técnico", block));
  }

  // Jurado
  const jurado = data.jurado;
  if (jurado.composicion || jurado.criterios || jurado.decision) {
    let block = "";
    if (jurado.composicion) block += paragraph(jurado.composicion);
    if (jurado.criterios) block += paragraph(jurado.criterios);
    if (jurado.decision) block += paragraph(jurado.decision);
    if (block) parts.push(section("5. Jurado", block));
  }

  // Premios
  const premios = data.premios;
  if (premios.premios || premios.entrega || premios.impuestos) {
    let block = "";
    if (premios.premios) block += paragraph(premios.premios);
    if (premios.entrega) block += paragraph(premios.entrega);
    if (premios.impuestos) block += paragraph(premios.impuestos);
    if (block) parts.push(section("6. Premios", block));
  }

  // Derechos
  const derechos = data.derechos;
  if (derechos.cesion || derechos.uso || derechos.creditos) {
    let block = "";
    if (derechos.cesion) block += paragraph(derechos.cesion);
    if (derechos.uso) block += paragraph(derechos.uso);
    if (derechos.creditos) block += paragraph(derechos.creditos);
    if (block) parts.push(section("7. Derechos de autor", block));
  }

  // Legal
  const legal = data.legal;
  if (legal.reclamaciones || legal.jurisdiccion) {
    let block = "";
    if (legal.reclamaciones) block += paragraph(legal.reclamaciones);
    if (legal.jurisdiccion) block += paragraph(legal.jurisdiccion);
    if (block) parts.push(section("8. Aspectos legales", block));
  }

  // Datos personales
  const datosPersonales = data.datosPersonales;
  if (
    datosPersonales.tratamiento ||
    datosPersonales.finalidad ||
    datosPersonales.cesionTerceros
  ) {
    let block = "";
    if (datosPersonales.tratamiento)
      block += paragraph(datosPersonales.tratamiento);
    if (datosPersonales.finalidad) block += paragraph(datosPersonales.finalidad);
    if (datosPersonales.cesionTerceros)
      block += paragraph(datosPersonales.cesionTerceros);
    if (block) parts.push(section("9. Datos personales", block));
  }

  // Disposiciones finales
  const disposiciones = data.disposicionesFinales;
  if (
    disposiciones.modificacion ||
    disposiciones.interpretacion ||
    disposiciones.aceptacion
  ) {
    let block = "";
    if (disposiciones.modificacion)
      block += paragraph(disposiciones.modificacion);
    if (disposiciones.interpretacion)
      block += paragraph(disposiciones.interpretacion);
    if (disposiciones.aceptacion)
      block += paragraph(disposiciones.aceptacion);
    if (block) parts.push(section("10. Disposiciones finales", block));
  }

  return parts.join("").trim() || "";
}
