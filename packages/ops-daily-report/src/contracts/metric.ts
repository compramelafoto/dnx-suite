/** Cómo se muestra la métrica en el correo y en el panel. */
export type MetricFormat = "count" | "currencyArs" | "percent" | "duration";

export type ReportMetric = {
  key: string;
  label: string;
  value: number;
  format: MetricFormat;
  /** Mismo valor para el día anterior; null si no se pudo calcular. */
  previousValue: number | null;
  /** Promedio diario de los siete días previos; null si no se pudo calcular. */
  sevenDayAverage: number | null;
  /** Variación relativa contra el día anterior (0.2 = +20 %); null si no aplica. */
  changeRatio: number | null;
  /** Aclaración corta para el lector, opcional. */
  hint?: string;
};

export type BuildMetricInput = {
  key: string;
  label: string;
  value: number;
  format: MetricFormat;
  previousValue: number | null;
  sevenDayAverage: number | null;
  hint?: string;
};

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`La métrica recibió un valor no finito en "${field}".`);
  }
}

export function buildMetric(input: BuildMetricInput): ReportMetric {
  assertFinite(input.value, input.key);
  if (input.previousValue !== null) assertFinite(input.previousValue, `${input.key}.previousValue`);
  if (input.sevenDayAverage !== null) {
    assertFinite(input.sevenDayAverage, `${input.key}.sevenDayAverage`);
  }

  // Con base cero cualquier porcentaje es engañoso: se prefiere no mostrarlo.
  const changeRatio =
    input.previousValue === null || input.previousValue === 0
      ? null
      : (input.value - input.previousValue) / input.previousValue;

  return {
    key: input.key,
    label: input.label,
    value: input.value,
    format: input.format,
    previousValue: input.previousValue,
    sevenDayAverage: input.sevenDayAverage,
    changeRatio,
    ...(input.hint ? { hint: input.hint } : {}),
  };
}
