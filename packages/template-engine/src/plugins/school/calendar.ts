/**
 * «Calendario»: un bloque que dibuja un mes, o los doce meses de un año, con los días donde
 * caen de verdad. El año lo elige el fotógrafo (se guarda en el bloque, `configJson.calendar.year`)
 * y la cuenta de días, bisiestos y primer día de cada mes sale de acá.
 *
 * Como el «Listado del curso», el bloque es un VARIABLE_TEXT que no se llena con un valor: se
 * reparte en textos sueltos (nombre del mes, días de la semana, números) con la misma cuenta en
 * el lienzo del editor y en la impresión.
 *
 * Puro: sin fechas del sistema salvo `defaultCalendarYear`, que recibe el «ahora».
 */

/** La clave del bloque «Calendario». */
export const CALENDAR_VARIABLE_KEY = "calendar.grid";
/** El año del calendario como texto, para títulos («Calendario 2027»). */
export const CALENDAR_YEAR_VARIABLE_KEY = "calendar.year";

export const CALENDAR_MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/** Días de la semana empezando por el domingo (como `Date.getUTCDay`). */
const WEEKDAY_SHORT = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"] as const;
const WEEKDAY_INITIAL = ["D", "L", "M", "M", "J", "V", "S"] as const;

export type CalendarWeekStart = "monday" | "sunday";

export type CalendarOptions = {
  /** El año que muestra. */
  year: number;
  /** 1–12: ese mes. 0: los doce meses en grilla. */
  month: number;
  /** Columnas de la grilla de meses (sólo con `month` 0): 1, 2, 3, 4 o 6. */
  columns: number;
  weekStart: CalendarWeekStart;
  /** «L M M J V S D» o «Lu Ma Mi…». */
  weekdayStyle: "initial" | "short";
  showMonthName: boolean;
  /** Agrega el año al nombre del mes («Marzo 2027»). Útil en las hojas de un mes. */
  showYearInTitle: boolean;
  showWeekdays: boolean;
  /** Colores propios (null = el color del texto del bloque). */
  monthNameColor: string | null;
  weekdayColor: string | null;
  sundayColor: string | null;
  /** El nombre del mes, en veces el cuerpo de los días. */
  monthNameScale: number;
};

export const CALENDAR_MONTH_NAME_SCALE_MIN = 0.8;
export const CALENDAR_MONTH_NAME_SCALE_MAX = 3;

export const DEFAULT_CALENDAR_OPTIONS: CalendarOptions = {
  year: 2027,
  month: 0,
  columns: 3,
  weekStart: "monday",
  weekdayStyle: "initial",
  showMonthName: true,
  showYearInTitle: false,
  showWeekdays: true,
  monthNameColor: null,
  weekdayColor: null,
  sundayColor: "#c0392b",
  monthNameScale: 1.3,
};

const COLUMNAS_VALIDAS = [1, 2, 3, 4, 6] as const;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Días de un mes (1–12) de ese año. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Qué día de la semana cae el 1 del mes (0 = domingo … 6 = sábado). */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/**
 * Las semanas del mes: cada fila tiene 7 lugares, con el número del día o `null` donde no hay.
 * Siempre 6 filas, así todos los meses de una grilla quedan del mismo alto.
 */
export function calendarMonthWeeks(year: number, month: number, weekStart: CalendarWeekStart): Array<Array<number | null>> {
  const corrimiento = (firstWeekdayOfMonth(year, month) - (weekStart === "monday" ? 1 : 0) + 7) % 7;
  const dias = daysInMonth(year, month);
  const filas: Array<Array<number | null>> = [];
  for (let f = 0; f < 6; f++) {
    const fila: Array<number | null> = [];
    for (let c = 0; c < 7; c++) {
      const d = f * 7 + c - corrimiento + 1;
      fila.push(d >= 1 && d <= dias ? d : null);
    }
    filas.push(fila);
  }
  return filas;
}

/** Los encabezados de los días, en el orden de la semana elegido. */
export function calendarWeekdayLabels(weekStart: CalendarWeekStart, style: CalendarOptions["weekdayStyle"]): string[] {
  const base = style === "short" ? WEEKDAY_SHORT : WEEKDAY_INITIAL;
  const orden = weekStart === "monday" ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  return orden.map((i) => base[i]!);
}

/** La columna (0–6) que ocupa el domingo. */
function columnaDelDomingo(weekStart: CalendarWeekStart): number {
  return weekStart === "monday" ? 6 : 0;
}

/**
 * El año que conviene ofrecer al crear un calendario: desde septiembre la gente arma el del año
 * que viene.
 */
export function defaultCalendarYear(now: Date): number {
  const enArgentina = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const anio = enArgentina.getUTCFullYear();
  return enArgentina.getUTCMonth() >= 8 ? anio + 1 : anio;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function color(v: unknown, porDefecto: string | null): string | null {
  if (v === null) return null;
  return typeof v === "string" && v.trim() ? v.trim() : porDefecto;
}

export function isCalendarConfig(config: unknown): boolean {
  return asRecord(config).variableKey === CALENDAR_VARIABLE_KEY;
}

/** El año escrito por el fotógrafo, si es un año razonable. */
export function parseCalendarYear(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n >= 1900 && n <= 2200 ? n : null;
}

/** Las opciones guardadas en `configJson.calendar`, con los valores por defecto donde falten. */
export function readCalendarOptions(config: unknown): CalendarOptions {
  const c = asRecord(asRecord(config).calendar);
  const d = DEFAULT_CALENDAR_OPTIONS;
  const mes = typeof c.month === "number" && Number.isInteger(c.month) && c.month >= 0 && c.month <= 12 ? c.month : d.month;
  const columnas = (COLUMNAS_VALIDAS as readonly number[]).includes(c.columns as number) ? (c.columns as number) : d.columns;
  const escala = typeof c.monthNameScale === "number" && Number.isFinite(c.monthNameScale) ? c.monthNameScale : d.monthNameScale;
  return {
    year: parseCalendarYear(c.year) ?? d.year,
    month: mes,
    columns: columnas,
    weekStart: c.weekStart === "sunday" ? "sunday" : "monday",
    weekdayStyle: c.weekdayStyle === "short" ? "short" : "initial",
    showMonthName: c.showMonthName !== false,
    showYearInTitle: c.showYearInTitle === true,
    showWeekdays: c.showWeekdays !== false,
    monthNameColor: color(c.monthNameColor, d.monthNameColor),
    weekdayColor: color(c.weekdayColor, d.weekdayColor),
    sundayColor: color(c.sundayColor, d.sundayColor),
    monthNameScale: Math.min(CALENDAR_MONTH_NAME_SCALE_MAX, Math.max(CALENDAR_MONTH_NAME_SCALE_MIN, escala)),
  };
}

export type CalendarCellKind = "month" | "weekday" | "day";

export type CalendarCell = {
  kind: CalendarCellKind;
  text: string;
  /** Posición dentro del bloque, en píxeles del lienzo. */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  /** El color propio de la celda; null = el del bloque. */
  color: string | null;
  bold: boolean;
};

export type CalendarLayout = {
  cells: CalendarCell[];
  /** El cuerpo de los días después de achicar para que entre. */
  fontSize: number;
  /** Un rectángulo por mes (para quien quiera dibujarle un fondo). */
  months: Array<{ month: number; x: number; y: number; width: number; height: number }>;
};

/** Separación entre meses de la grilla, en veces el cuerpo de los días. */
const SEPARACION_ENTRE_MESES = 1.2;
/** Ancho de un número de dos cifras, en veces el cuerpo (con aire a los costados). */
const ANCHO_DE_DIA = 1.45;

/**
 * Reparte el calendario en el bloque. El cuerpo `fontSize` es el de los días; si no entra, se
 * achica (nunca se agranda). El nombre del mes va con la alineación del bloque; los días y sus
 * encabezados, centrados en su columna (eso lo deciden quienes dibujan las celdas).
 */
export function layoutCalendar(input: {
  options: CalendarOptions;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
}): CalendarLayout {
  const o = input.options;
  const lh = Math.max(1, input.lineHeight || 1.2);
  const meses = o.month === 0 ? Array.from({ length: 12 }, (_, i) => i + 1) : [o.month];
  const cols = o.month === 0 ? o.columns : 1;
  const filasDeMeses = Math.ceil(meses.length / cols);
  const W = Math.max(1, input.width);
  const H = Math.max(1, input.height);

  /** Alto de un mes en veces el cuerpo de los días. */
  const altoMesEnCuerpos = (o.showMonthName ? o.monthNameScale * lh : 0) + (o.showWeekdays ? lh : 0) + 6 * lh;
  const separacion = meses.length > 1 ? SEPARACION_ENTRE_MESES : 0;
  // Cuerpo máximo que entra a lo alto y a lo ancho.
  const porAlto = H / (filasDeMeses * altoMesEnCuerpos + (filasDeMeses - 1) * separacion);
  const porAncho = W / (cols * 7 * ANCHO_DE_DIA + (cols - 1) * separacion);
  const fs = Math.max(1, Math.min(input.fontSize > 0 ? input.fontSize : 20, porAlto, porAncho));

  const gap = separacion * fs;
  const anchoMes = (W - (cols - 1) * gap) / cols;
  const altoMes = altoMesEnCuerpos * fs;
  // La grilla usa todo el alto: lo que sobra se reparte entre las filas de meses.
  const sobraVertical = H - (filasDeMeses * altoMes + (filasDeMeses - 1) * gap);
  const gapVertical = filasDeMeses > 1 ? gap + sobraVertical / (filasDeMeses - 1) : 0;

  const cells: CalendarCell[] = [];
  const rects: CalendarLayout["months"] = [];
  const encabezados = calendarWeekdayLabels(o.weekStart, o.weekdayStyle);
  const domingo = columnaDelDomingo(o.weekStart);

  meses.forEach((mes, i) => {
    const mx = (i % cols) * (anchoMes + gap);
    const my = Math.floor(i / cols) * (altoMes + gapVertical);
    // Un mes solo usa todo el alto del bloque: las filas se estiran.
    const estirar = meses.length === 1 ? H / altoMes : 1;
    rects.push({ month: mes, x: mx, y: my, width: anchoMes, height: altoMes * estirar });
    const colW = anchoMes / 7;
    let y = my;
    if (o.showMonthName) {
      const tam = fs * o.monthNameScale;
      const alto = tam * lh;
      cells.push({
        kind: "month",
        text: o.showYearInTitle ? `${CALENDAR_MONTH_NAMES[mes - 1]} ${o.year}` : CALENDAR_MONTH_NAMES[mes - 1]!,
        x: mx,
        y,
        width: anchoMes,
        height: alto,
        fontSize: tam,
        color: o.monthNameColor,
        bold: true,
      });
      y += alto * estirar;
    }
    const filaH = fs * lh;
    if (o.showWeekdays) {
      encabezados.forEach((t, c) => {
        cells.push({
          kind: "weekday",
          text: t,
          x: mx + c * colW,
          y,
          width: colW,
          height: filaH,
          fontSize: fs,
          color: c === domingo && o.sundayColor ? o.sundayColor : o.weekdayColor,
          bold: true,
        });
      });
      y += filaH * estirar;
    }
    calendarMonthWeeks(o.year, mes, o.weekStart).forEach((semana, f) => {
      semana.forEach((d, c) => {
        if (d == null) return;
        cells.push({
          kind: "day",
          text: String(d),
          x: mx + c * colW,
          y: y + f * filaH * estirar,
          width: colW,
          height: filaH,
          fontSize: fs,
          color: c === domingo ? o.sundayColor : null,
          bold: false,
        });
      });
    });
  });
  return { cells, fontSize: fs, months: rects };
}
