import { PAYMENT_IMPORT_COLUMNS, PAYMENT_IMPORT_HEADER_ROW } from "./columns";

/**
 * Genera el texto para pegar en ChatGPT junto al archivo de pagos desordenado.
 *
 * Se arma en cada pedido a partir de `PAYMENT_IMPORT_COLUMNS`, nunca como texto fijo: un
 * prompt escrito aparte se desincroniza de la validación y le hace producir a la IA un CSV
 * que después el sistema rechaza.
 *
 * A propósito NO incluye ningún dato del padrón: sólo el formato y el nombre de la
 * institución. La planilla se la pega el usuario; nosotros no le mandamos socios a un
 * servicio externo.
 */
export function buildPaymentImportPrompt(params: { workspaceName: string }): string {
  const columnas = PAYMENT_IMPORT_COLUMNS.map(
    (c) => `- ${c.key}${c.required ? " (obligatoria)" : " (opcional)"}: ${c.description}`,
  ).join("\n");

  return `Voy a pasarte el registro de pagos de socios de "${params.workspaceName}" anterior al sistema. Puede estar desordenado (Excel, un cuaderno tipeado, una lista, lo que sea).

Tu tarea es convertirlo al formato exacto que necesita FotoOffice: un CSV separado por comas, con esta primera fila de encabezados EXACTA:

${PAYMENT_IMPORT_HEADER_ROW}

Columnas:
${columnas}

Reglas:
1. Una fila por PAGO, no por socio. Si un socio pagó doce veces, son doce filas.
2. NO inventes ningún dato. Si un pago no tiene fecha o importe claros, preguntame.
3. NO agregues socios que no estén en el registro que te paso.
4. NO cambies los números de socio: copialos exactos, con los ceros a la izquierda si los tienen.
5. Normalizá las fechas al formato AAAA-MM-DD. Si una fecha está incompleta o es ambigua, preguntame en vez de completarla.
6. Los importes van sin símbolo de moneda.
7. Si el registro dice qué mes cubría el pago, poné ese mes en "period" con formato AAAA-MM.
8. Si un campo opcional no consta, dejalo vacío.
9. Al finalizar NO agregues explicaciones.
10. Respondé únicamente con el CSV solicitado, dentro de un bloque de código.`;
}
