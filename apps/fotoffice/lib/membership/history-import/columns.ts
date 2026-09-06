/**
 * Fuente única de verdad de las columnas de la importación de pagos históricos.
 * El prompt para ChatGPT y la validación del CSV se generan AMBOS a partir de esta lista,
 * igual que en la importación de socios: dos textos escritos por separado se desincronizan.
 *
 * ── Qué NO se importa acá ──
 *
 * **Socios.** El padrón ya está completo. Una fila cuyo número de socio no exista se rechaza;
 * la importación no da de alta a nadie, en ningún caso.
 *
 * **Deuda.** Estos pagos no se imputan a ninguna cuota ni bajan el saldo de apertura. Son
 * constancia de que ese cobro existió, nada más. El arrastre del sistema anterior no
 * reconcilia para buena parte del padrón, y aplicarle pagos con datos incompletos produciría
 * saldos peores que los de hoy.
 */

export type PaymentImportColumn = {
  key: string;
  required: boolean;
  description: string;
};

export const PAYMENT_IMPORT_COLUMNS: readonly PaymentImportColumn[] = [
  {
    key: "memberNumber",
    required: true,
    description:
      "Número de socio, EXACTO como figura en el padrón (incluidos ceros a la izquierda). El socio ya tiene que existir: esta importación no da de alta a nadie.",
  },
  {
    key: "paidAt",
    required: true,
    description: "Fecha en que se cobró, formato AAAA-MM-DD. No la inventes ni la aproximes.",
  },
  {
    key: "amountArs",
    required: true,
    description:
      "Importe en pesos. Podés escribirlo 15000, 15000.50 o 15.000,50. Sin símbolo de moneda.",
  },
  {
    key: "method",
    required: false,
    description:
      "Cómo se cobró: EFECTIVO, TRANSFERENCIA, CHEQUE, MERCADO_PAGO u OTRO. Si no consta, dejalo vacío.",
  },
  {
    key: "period",
    required: false,
    description:
      "Qué mes cubría ese pago, formato AAAA-MM. Es informativo: se muestra junto al pago y no modifica ninguna cuota.",
  },
  {
    key: "reference",
    required: false,
    description: "Número de recibo o comprobante, si figura en el registro.",
  },
] as const;

export const PAYMENT_IMPORT_HEADER_ROW = PAYMENT_IMPORT_COLUMNS.map((c) => c.key).join(",");

export const PAYMENT_IMPORT_REQUIRED_COLUMNS = PAYMENT_IMPORT_COLUMNS.filter(
  (c) => c.required,
).map((c) => c.key);

/**
 * Tope por importación. Más alto que el de socios porque acá una fila es un pago, no una
 * persona: con varios años de historia, 110 socios pasan holgadamente de 500 filas.
 */
export const PAYMENT_IMPORT_MAX_ROWS = 5000;
