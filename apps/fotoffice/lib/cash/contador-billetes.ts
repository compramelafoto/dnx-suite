/**
 * El contador de billetes del cierre. Módulo PURO: todo en centavos enteros.
 *
 * Es la pestaña "contador de billetes" de la planilla, pasada a la caja: una fila por
 * denominación con su cantidad, la suma (CAJA), lo que queda de cambio en el mostrador
 * (CAMBIO) y lo que va a la caja fuerte (TOTAL = CAJA − CAMBIO). Lo nuevo respecto de la
 * planilla es que además compara contra lo que el sistema espera y dice si sobra o falta.
 *
 * El total NUNCA se toma de lo que manda la pantalla: el servidor vuelve a sumar las
 * cantidades con `sumarConteo`. La pantalla suma en vivo para que se vea, nada más.
 */

export type TipoDenominacion = "BILLETE" | "MONEDA";

export type Denominacion = { id: string; tipo: TipoDenominacion; pesos: number };

const BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10] as const;
const MONEDAS = [10, 5, 2, 1] as const;

/**
 * Los billetes argentinos vigentes y, aparte, las monedas.
 *
 * El id lleva el tipo porque existen a la vez el billete y la moneda de $10: con el valor
 * solo como clave, contar uno pisaría al otro.
 */
export const DENOMINACIONES: readonly Denominacion[] = [
  ...BILLETES.map((pesos) => ({ id: `b-${pesos}`, tipo: "BILLETE" as const, pesos })),
  ...MONEDAS.map((pesos) => ({ id: `m-${pesos}`, tipo: "MONEDA" as const, pesos })),
];

const POR_ID = new Map(DENOMINACIONES.map((d) => [d.id, d]));

/** Nadie cuenta cien mil billetes de una denominación: más que eso es un dedo apoyado. */
export const CANTIDAD_MAXIMA = 100_000;

export type Conteo = Record<string, number>;

function cantidadValida(valor: unknown): number {
  const n = typeof valor === "number" ? valor : typeof valor === "string" && /^\s*\d+\s*$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, CANTIDAD_MAXIMA);
}

/** Lo que se escribe en el casillero de una cantidad. Vacío o inválido cuenta como cero. */
export function leerCantidad(raw: string): number {
  return cantidadValida(raw);
}

export type LineaConteo = Denominacion & { cantidad: number; subtotalMinor: number };

export type TotalConteo = {
  lineas: LineaConteo[];
  billetesMinor: number;
  monedasMinor: number;
  totalMinor: number;
};

/** SUMA DE BILLETES (y de monedas). Sólo cuenta denominaciones conocidas y cantidades enteras. */
export function sumarConteo(conteo: Conteo): TotalConteo {
  const lineas: LineaConteo[] = [];
  let billetesMinor = 0;
  let monedasMinor = 0;
  for (const d of DENOMINACIONES) {
    const cantidad = cantidadValida(conteo[d.id]);
    if (cantidad === 0) continue;
    const subtotalMinor = cantidad * d.pesos * 100;
    lineas.push({ ...d, cantidad, subtotalMinor });
    if (d.tipo === "BILLETE") billetesMinor += subtotalMinor;
    else monedasMinor += subtotalMinor;
  }
  return { lineas, billetesMinor, monedasMinor, totalMinor: billetesMinor + monedasMinor };
}

/** El JSON de cantidades que viaja en el formulario. Lo que no se entiende, se descarta. */
export function leerConteo(raw: string): Conteo {
  let datos: unknown;
  try {
    datos = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return {};
  const conteo: Conteo = {};
  for (const [id, valor] of Object.entries(datos as Record<string, unknown>)) {
    if (!POR_ID.has(id)) continue;
    const cantidad = cantidadValida(valor);
    if (cantidad > 0) conteo[id] = cantidad;
  }
  return conteo;
}

export type EstadoArqueo = "CUADRA" | "SOBRANTE" | "FALTANTE" | "SIN_ESPERADO";

export type ResumenArqueo = {
  /** Contado − esperado. Null si no hay contra qué comparar. */
  diferenciaMinor: number | null;
  estado: EstadoArqueo;
  /** CAJA − CAMBIO, nunca negativo. */
  aCajaFuerteMinor: number;
  /** Cuánto falta para poder dejar el cambio pedido (0 si alcanza). */
  cambioFaltanteMinor: number;
};

export function resumenArqueo(input: {
  contadoMinor: number;
  esperadoMinor: number | null;
  cambioMinor: number;
}): ResumenArqueo {
  const diferenciaMinor = input.esperadoMinor === null ? null : input.contadoMinor - input.esperadoMinor;
  const estado: EstadoArqueo =
    diferenciaMinor === null
      ? "SIN_ESPERADO"
      : diferenciaMinor === 0
        ? "CUADRA"
        : diferenciaMinor > 0
          ? "SOBRANTE"
          : "FALTANTE";
  return {
    diferenciaMinor,
    estado,
    aCajaFuerteMinor: Math.max(0, input.contadoMinor - input.cambioMinor),
    cambioFaltanteMinor: Math.max(0, input.cambioMinor - input.contadoMinor),
  };
}

export type PlanCierre =
  | {
      ok: true;
      /** El asiento que deja el libro igual a lo contado. Null si no hay diferencia o no se pidió. */
      ajuste: { kind: "INGRESO" | "EGRESO"; amountMinor: number } | null;
      /** El pase a la caja fuerte. Null si no se pidió, no hay caja fuerte o da cero. */
      paseMinor: number | null;
    }
  | { ok: false; error: string };

/**
 * Qué escribir al confirmar el conteo. Todo se decide acá, antes de tocar la base: si algo
 * no cierra, no se escribe nada.
 *
 * Mismo criterio que `canCloseShift`: una diferencia sin explicar no se guarda. El ajuste es
 * opcional porque hay quien prefiere dejar la diferencia sólo en el arqueo; el pase usa el
 * saldo del libro DESPUÉS del ajuste, que es la plata que de verdad hay.
 */
export function planearCierreConContador(input: {
  contadoMinor: number;
  esperadoMinor: number | null;
  cambioMinor: number;
  nota: string | null;
  registrarAjuste: boolean;
  pasarACajaFuerte: boolean;
  hayCajaFuerte: boolean;
  saldoCuentaMinor: number;
}): PlanCierre {
  if (!Number.isInteger(input.cambioMinor) || input.cambioMinor < 0) {
    return { ok: false, error: "El cambio que queda en el mostrador no se entiende." };
  }
  const resumen = resumenArqueo(input);
  const diferencia = resumen.diferenciaMinor ?? 0;
  if (diferencia !== 0 && (input.nota ?? "").trim() === "") {
    return { ok: false, error: "La caja no cuadra. Explicá la diferencia antes de guardar." };
  }

  const ajuste =
    input.registrarAjuste && diferencia !== 0
      ? { kind: diferencia > 0 ? ("INGRESO" as const) : ("EGRESO" as const), amountMinor: Math.abs(diferencia) }
      : null;

  const paseMinor =
    input.pasarACajaFuerte && input.hayCajaFuerte && resumen.aCajaFuerteMinor > 0 ? resumen.aCajaFuerteMinor : null;

  if (paseMinor !== null) {
    const saldoDespues = input.saldoCuentaMinor + (ajuste ? (ajuste.kind === "INGRESO" ? 1 : -1) * ajuste.amountMinor : 0);
    if (paseMinor > saldoDespues) {
      return {
        ok: false,
        error:
          "El libro dice que en esta caja hay menos de lo que querés pasar a la caja fuerte. Registrá la diferencia como movimiento o pasá menos.",
      };
    }
  }

  return { ok: true, ajuste, paseMinor };
}
