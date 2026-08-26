import { MEMBER_IMPORT_COLUMNS, MEMBER_IMPORT_HEADER_ROW } from "./columns";

/**
 * Genera el prompt para pegar en ChatGPT (u otra IA externa). Se arma en
 * cada request a partir de MEMBER_IMPORT_COLUMNS + las categorías reales del
 * workspace — nunca un texto fijo que pueda desincronizarse del schema.
 *
 * A propósito NO incluye ningún dato personal existente del padrón: solo
 * metadata del formato (columnas, categorías) y el nombre del workspace.
 */
export function buildMemberImportPrompt(params: {
  workspaceName: string;
  categoryNames: string[];
}): string {
  const columnsBlock = MEMBER_IMPORT_COLUMNS.map(
    (c) => `- ${c.key}${c.required ? " (obligatoria)" : " (opcional)"}: ${c.description}`,
  ).join("\n");

  const categoriesBlock =
    params.categoryNames.length > 0
      ? params.categoryNames.map((n) => `- ${n}`).join("\n")
      : "(Este workspace todavía no tiene categorías cargadas. No sigas adelante: avisame que necesito crear categorías antes de poder importar.)";

  return `Voy a pasarte información de socios de "${params.workspaceName}" que puede estar desordenada (Excel, Word, una lista, mensajes, lo que sea).

Tu tarea es convertirla al formato exacto que necesita FotoOffice: un CSV separado por comas, con esta primera fila de encabezados EXACTA:

${MEMBER_IMPORT_HEADER_ROW}

Columnas:
${columnsBlock}

Categorías permitidas en este workspace (usá el nombre EXACTO, tal cual, no inventes ni traduzcas otras):
${categoriesBlock}

ANTES de generar el resultado final:
1. Revisá todos los datos.
2. Si hay información ambigua o necesaria para importar correctamente, preguntame únicamente lo indispensable.
3. NO inventes ningún dato.
4. NO cambies números de socio existentes.
5. Si aparece un número que podría ser un número interno de socio y no está claro, preguntame.
6. Conservá nombres y apellidos correctamente separados.
7. Normalizá fechas al formato AAAA-MM-DD.
8. No inventes emails, teléfonos, DNI, fechas ni domicilios.
9. Si un campo no existe, dejalo vacío.
10. Usá solamente las categorías permitidas que te paso arriba.
11. Si una categoría no puede determinarse, preguntame o dejala vacía según corresponda — nunca inventes una categoría nueva.
12. Al finalizar NO agregues explicaciones.
13. Respondé únicamente con el CSV solicitado, dentro de un bloque de código.`;
}
