import Papa from "papaparse";
import { periodoLegible } from "../charge-labels";
import { isHistoricalMethod, type HistoricalMethod } from "../payment-method";
import { parseAmountToMinor } from "./amount";
import { PAYMENT_IMPORT_MAX_ROWS, PAYMENT_IMPORT_REQUIRED_COLUMNS } from "./columns";

/**
 * Lee y valida la planilla de pagos históricos. **No escribe nada.**
 *
 * El estado real de la institución —qué números de socio existen, qué pagos ya se
 * importaron— lo pasa quien llama, que ya lo leyó de la base. Acá no hay consultas: así se
 * puede probar cada regla sin montar nada.
 *
 * La diferencia con la importación de socios es exactamente inversa: allá un número repetido
 * es un error porque crearía un duplicado; acá un número que **no** existe es el error,
 * porque el socio tiene que estar en el padrón. Nunca se da de alta a nadie desde este
 * camino.
 */

export type PaymentRowStatus = "VALID" | "WARNING" | "ERROR";

export type PaymentImportRow = {
  /** 1-based, sin contar el encabezado. */
  rowNumber: number;
  status: PaymentRowStatus;
  errors: string[];
  warnings: string[];
  memberNumber: string;
  /** Nombre del socio, para que quien revisa reconozca de quién es cada fila. */
  memberName: string;
  paidAtLabel: string;
  amountLabel: string;
  /** Sólo presente cuando `status !== "ERROR"`: listo para escribir. */
  resolved?: ResolvedPayment;
};

export type ResolvedPayment = {
  memberId: string;
  memberNumber: string;
  paidAt: Date;
  amountMinor: number;
  method: HistoricalMethod;
  /** Texto que se le muestra al socio junto al pago. Puede ser `null`. */
  referenceLabel: string | null;
  /** Clave natural del pago. Es lo que hace que reimportar el archivo no duplique nada. */
  dedupKey: string;
};

export type PaymentImportOutcome =
  | { ok: false; error: string }
  | {
      ok: true;
      rows: PaymentImportRow[];
      totalRows: number;
      validCount: number;
      warningCount: number;
      errorCount: number;
    };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-\d{2}$/;

function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // `2026-02-31` construye una fecha válida corrida al 3 de marzo. Se compara la vuelta
  // para no aceptar en silencio un día que no existe.
  return d.toISOString().slice(0, 10) === s ? d : null;
}

/**
 * Cómo se identifica un pago para no importarlo dos veces.
 *
 * Socio, día e importe. No es infalible —dos cobros iguales al mismo socio el mismo día
 * colisionan— y por eso el caller numera las repeticiones dentro del archivo en vez de
 * descartarlas.
 */
export function paymentDedupKey(input: {
  workspaceId: string;
  memberNumber: string;
  paidAt: Date;
  amountMinor: number;
  ordinal: number;
}): string {
  const dia = input.paidAt.toISOString().slice(0, 10);
  const sufijo = input.ordinal > 1 ? `#${input.ordinal}` : "";
  return `HIST:${input.workspaceId}:${input.memberNumber}:${dia}:${input.amountMinor}${sufijo}`;
}

export function parseAndValidatePaymentImport(params: {
  rawCsv: string;
  workspaceId: string;
  /** Número de socio → { id, nombre completo }, del padrón de ESTE workspace. */
  membersByNumber: Map<string, { id: string; fullName: string }>;
  /** Claves de pagos históricos ya importados. Ver `paymentDedupKey`. */
  existingDedupKeys: ReadonlySet<string>;
}): PaymentImportOutcome {
  const parsed = Papa.parse<Record<string, string>>(params.rawCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return {
      ok: false,
      error: `No pudimos leer el CSV (${first.message}, fila ${first.row ?? "?"}).`,
    };
  }

  const data = parsed.data;
  if (data.length === 0) return { ok: false, error: "No encontramos ninguna fila de datos." };
  if (data.length > PAYMENT_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `El archivo tiene ${data.length} filas. Por ahora el máximo por importación es ${PAYMENT_IMPORT_MAX_ROWS}.`,
    };
  }

  const headers = parsed.meta.fields ?? [];
  const faltantes = PAYMENT_IMPORT_REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (faltantes.length > 0) {
    return {
      ok: false,
      error: `Faltan columnas obligatorias en el encabezado: ${faltantes.join(", ")}.`,
    };
  }

  // Cuántas veces vimos la misma combinación socio+día+importe en ESTE archivo. Dos cobros
  // iguales el mismo día son raros pero posibles, así que se numeran en lugar de perderse.
  const repeticiones = new Map<string, number>();

  const rows: PaymentImportRow[] = data.map((raw, idx) => {
    const rowNumber = idx + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    const memberNumber = (raw.memberNumber ?? "").trim();
    const paidAtRaw = (raw.paidAt ?? "").trim();
    const amountRaw = (raw.amountArs ?? "").trim();
    const methodRaw = (raw.method ?? "").trim().toUpperCase();
    const periodRaw = (raw.period ?? "").trim();
    const referenceRaw = (raw.reference ?? "").trim();

    // El socio tiene que existir. Es la regla central de esta importación.
    const socio = memberNumber ? params.membersByNumber.get(memberNumber) : undefined;
    if (!memberNumber) {
      errors.push("Falta el número de socio.");
    } else if (!socio) {
      errors.push(
        `No hay ningún socio N° ${memberNumber} en esta institución. Esta importación no da de alta socios: revisá el número o cargalo primero en el padrón.`,
      );
    }

    const paidAt = parseDate(paidAtRaw);
    if (!paidAtRaw) errors.push("Falta la fecha de pago.");
    else if (!paidAt) errors.push(`Fecha de pago inválida: «${paidAtRaw}» (formato esperado: AAAA-MM-DD).`);

    const importe = parseAmountToMinor(amountRaw);
    if (!importe.ok) errors.push(importe.error);

    let method: HistoricalMethod = "OTRO";
    if (methodRaw === "") {
      warnings.push("Sin medio de pago: se registra como «otro medio».");
    } else if (isHistoricalMethod(methodRaw)) {
      method = methodRaw;
    } else {
      errors.push(`Medio de pago desconocido: «${methodRaw}». Usá EFECTIVO, TRANSFERENCIA, CHEQUE, MERCADO_PAGO u OTRO.`);
    }

    if (periodRaw && !PERIOD_RE.test(periodRaw)) {
      errors.push(`Período inválido: «${periodRaw}» (formato esperado: AAAA-MM).`);
    }

    let resolved: ResolvedPayment | undefined;
    if (errors.length === 0 && socio && paidAt && importe.ok) {
      const base = paymentDedupKey({
        workspaceId: params.workspaceId,
        memberNumber,
        paidAt,
        amountMinor: importe.minor,
        ordinal: 1,
      });
      const ordinal = (repeticiones.get(base) ?? 0) + 1;
      repeticiones.set(base, ordinal);
      const dedupKey = paymentDedupKey({
        workspaceId: params.workspaceId,
        memberNumber,
        paidAt,
        amountMinor: importe.minor,
        ordinal,
      });

      if (ordinal > 1) {
        warnings.push(
          "En el archivo hay otro pago de este socio por el mismo importe y el mismo día. Se importan los dos; si es el mismo cobro repetido, sacá una de las filas.",
        );
      }
      if (params.existingDedupKeys.has(dedupKey)) {
        warnings.push("Este pago ya se importó antes. Se va a omitir para no duplicarlo.");
      }

      resolved = {
        memberId: socio.id,
        memberNumber,
        paidAt,
        amountMinor: importe.minor,
        method,
        referenceLabel: composeReference(periodRaw, referenceRaw),
        dedupKey,
      };
    }

    return {
      rowNumber,
      status: errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "VALID",
      errors,
      warnings,
      memberNumber,
      memberName: socio?.fullName ?? "",
      paidAtLabel: paidAtRaw,
      amountLabel: amountRaw,
      resolved,
    };
  });

  return {
    ok: true,
    rows,
    totalRows: rows.length,
    validCount: rows.filter((r) => r.status === "VALID").length,
    warningCount: rows.filter((r) => r.status === "WARNING").length,
    errorCount: rows.filter((r) => r.status === "ERROR").length,
  };
}

/**
 * El texto que acompaña al pago en la pantalla del socio.
 *
 * El período va acá y no en un campo propio porque estos pagos **no se imputan a ninguna
 * cuota**: no hay un cargo al que apuntar. Es lo que la Secretaría anotó sobre qué cubría
 * ese cobro, tratado como lo que es —una nota— y no como un vínculo que no existe.
 */
export function composeReference(period: string, reference: string): string | null {
  const partes: string[] = [];
  if (period) partes.push(`Cuota de ${periodoLegible(period)}`);
  if (reference) partes.push(reference);
  return partes.length > 0 ? partes.join(" · ") : null;
}
