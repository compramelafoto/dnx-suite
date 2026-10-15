/**
 * Períodos de los informes (etapa 6). Módulo PURO.
 *
 * Los "meses" son textos "AAAA-MM" en hora de Buenos Aires. Argentina no usa horario de verano:
 * el offset es fijo (-03:00).
 */
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { MAX_MESES_RESULTADOS } from "./constantes";

const OFFSET = "-03:00";
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const ATAJOS_INFORME = ["este-mes", "mes-pasado", "ultimos-3", "ultimos-6", "este-anio", "anio-pasado"] as const;
export type AtajoInforme = (typeof ATAJOS_INFORME)[number];

export const ETIQUETAS_ATAJO_INFORME: Record<AtajoInforme, string> = {
  "este-mes": "Este mes",
  "mes-pasado": "Mes pasado",
  "ultimos-3": "Últimos 3 meses",
  "ultimos-6": "Últimos 6 meses",
  "este-anio": "Este año",
  "anio-pasado": "Año pasado",
};

export const PERIODO_INFORME_POR_OMISION: AtajoInforme = "este-mes";

export function esMesValido(v: string): boolean {
  return MES.test(v);
}

/** "AAAA-MM" del instante, en Buenos Aires. */
export function mesDeInstante(d: Date): string {
  return hoyEnBuenosAires(d).slice(0, 7);
}

/** "AAAA-MM" de un día "AAAA-MM-DD". */
export function mesDeDia(dia: string): string {
  return dia.slice(0, 7);
}

function indice(mes: string): number {
  const m = MES.exec(mes);
  if (!m) throw new Error(`Mes inválido: ${mes}`);
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

function desdeIndice(i: number): string {
  const anio = Math.floor(i / 12);
  return `${String(anio).padStart(4, "0")}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export function sumarMeses(mes: string, n: number): string {
  return desdeIndice(indice(mes) + n);
}

/** Todos los meses de `desde` a `hasta`, ambos incluidos. Vacío si `hasta` es anterior. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const a = indice(desde);
  const b = indice(hasta);
  const r: string[] = [];
  for (let i = a; i <= b; i++) r.push(desdeIndice(i));
  return r;
}

/** "2026-03" → "03/2026". */
export function etiquetaMes(mes: string): string {
  return `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;
}

/** Primer instante del mes en Buenos Aires. */
export function inicioDeMes(mes: string): Date {
  return new Date(`${mes}-01T00:00:00.000${OFFSET}`);
}

/** Primer instante del mes siguiente (límite superior exclusivo del mes). */
export function inicioDelMesSiguiente(mes: string): Date {
  return inicioDeMes(sumarMeses(mes, 1));
}

export type PeriodoInforme = {
  /** Valor normalizado, apto para volver a un formulario: un atajo o "AAAA-MM..AAAA-MM". */
  valor: string;
  desde: string;
  hasta: string;
  meses: string[];
  etiqueta: string;
  /** Texto para mostrar si el pedido era inválido y se usó el período por omisión. */
  aviso: string | null;
};

export type ParametrosPeriodo = { periodo?: string | null; hoy?: string };

function deAtajo(atajo: AtajoInforme, hoy: string): { desde: string; hasta: string } {
  const actual = mesDeDia(hoy);
  const anio = Number(actual.slice(0, 4));
  switch (atajo) {
    case "este-mes":
      return { desde: actual, hasta: actual };
    case "mes-pasado":
      return { desde: sumarMeses(actual, -1), hasta: sumarMeses(actual, -1) };
    case "ultimos-3":
      return { desde: sumarMeses(actual, -2), hasta: actual };
    case "ultimos-6":
      return { desde: sumarMeses(actual, -5), hasta: actual };
    case "este-anio":
      return { desde: `${anio}-01`, hasta: `${anio}-12` };
    case "anio-pasado":
      return { desde: `${anio - 1}-01`, hasta: `${anio - 1}-12` };
  }
}

function armar(valor: string, rango: { desde: string; hasta: string }, etiqueta: string, aviso: string | null): PeriodoInforme {
  return { valor, desde: rango.desde, hasta: rango.hasta, meses: mesesEntre(rango.desde, rango.hasta), etiqueta, aviso };
}

/**
 * Período de un informe a partir del parámetro `periodo` de la URL. Atajos: este-mes, mes-pasado,
 * ultimos-3, ultimos-6, este-anio, anio-pasado; o un rango `AAAA-MM..AAAA-MM` (máximo 24 meses).
 * Sin parámetro: este mes. Si es inválido: este mes, con aviso.
 */
export function periodoInforme(params: ParametrosPeriodo = {}): PeriodoInforme {
  const hoy = params.hoy ?? hoyEnBuenosAires();
  const crudo = params.periodo?.trim();
  const porOmision = (aviso: string | null) =>
    armar(PERIODO_INFORME_POR_OMISION, deAtajo(PERIODO_INFORME_POR_OMISION, hoy), ETIQUETAS_ATAJO_INFORME[PERIODO_INFORME_POR_OMISION], aviso);

  if (!crudo) return porOmision(null);

  if ((ATAJOS_INFORME as readonly string[]).includes(crudo)) {
    const a = crudo as AtajoInforme;
    return armar(a, deAtajo(a, hoy), ETIQUETAS_ATAJO_INFORME[a], null);
  }

  const partes = crudo.split("..");
  if (partes.length === 2 && esMesValido(partes[0]) && esMesValido(partes[1])) {
    const [desde, hasta] = partes;
    if (desde > hasta) return porOmision("El rango elegido es al revés: mostramos este mes.");
    const cantidad = indice(hasta) - indice(desde) + 1;
    if (cantidad > MAX_MESES_RESULTADOS) {
      return porOmision(`El rango admite hasta ${MAX_MESES_RESULTADOS} meses: mostramos este mes.`);
    }
    return armar(`${desde}..${hasta}`, { desde, hasta }, desde === hasta ? etiquetaMes(desde) : `${etiquetaMes(desde)} a ${etiquetaMes(hasta)}`, null);
  }

  return porOmision("No entendimos el período elegido: mostramos este mes.");
}
