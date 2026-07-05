export const CUANTO_COBRO_CONSULTA_NUMBER_PREFIX = "CCO";

export function formatConsultaNumber(year: number, sequence: number): string {
  return `${CUANTO_COBRO_CONSULTA_NUMBER_PREFIX}-${year}-${String(sequence).padStart(6, "0")}`;
}
