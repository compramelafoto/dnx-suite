/**
 * Informes de Pedidos (Entrega B1): "A cobrar", "Cobrado este mes" y "A pagar". Módulo PURO: recibe
 * datos ya leídos y el día de hoy en Argentina ("aaaa-mm-dd"); no toca la base ni el reloj.
 *
 * - Los importes entran en pesos y las cuentas van en centavos enteros.
 * - Semana = de lunes a domingo, la que contiene a hoy. "Esta semana" suma lo que vence entre hoy y
 *   el domingo (lo que ya venció cae en "Vencido": nunca se cuenta dos veces).
 * - Antigüedad de la deuda vencida, por días desde el vencimiento: 0–30, 31–60 y más de 60.
 * - Mes calendario de Argentina (UTC-3 fijo, sin horario de verano).
 */
import { ETIQUETA_MEDIO_COBRO, MEDIOS_COBRO, type MedioCobro } from "./constantes";
import { aCentavos, desdeCentavos } from "./plan-cuotas";

// --- Fechas -----------------------------------------------------------------------------------

const DIA_MS = 86_400_000;

function aUtc(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00.000Z`);
}

export function esDiaValido(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = aUtc(v);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}

export function sumarDias(ymd: string, dias: number): string {
  return new Date(aUtc(ymd) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Días de `hasta` menos `desde` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS);
}

/** Lunes y domingo de la semana que contiene a `hoy`. */
export function semanaDe(hoy: string): { lunes: string; domingo: string } {
  const dow = new Date(aUtc(hoy)).getUTCDay(); // 0 = domingo
  const desdeLunes = (dow + 6) % 7;
  const lunes = sumarDias(hoy, -desdeLunes);
  return { lunes, domingo: sumarDias(lunes, 6) };
}

export function esMesValido(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) && Number(v.slice(0, 4)) >= 2000;
}

/** El mes pedido en la dirección si es válido y no es futuro; si no, el mes de hoy. */
export function mesElegido(pedido: unknown, hoy: string): string {
  const actual = hoy.slice(0, 7);
  const v = Array.isArray(pedido) ? pedido[0] : pedido;
  return esMesValido(v) && v <= actual ? v : actual;
}

export function mesSiguiente(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** [desde, hasta) del mes calendario de Argentina, como instantes. */
export function rangoDelMes(mes: string): { desde: Date; hasta: Date } {
  return { desde: new Date(`${mes}-01T00:00:00.000-03:00`), hasta: new Date(`${mesSiguiente(mes)}-01T00:00:00.000-03:00`) };
}

// --- A cobrar ---------------------------------------------------------------------------------

/** Saldo de una cuota con saldo de un pedido sin cancelar (lo calcula el cargador con `resumenDePlan`). */
export type SaldoDeCuota = {
  pedidoId: string;
  pedidoNumero: string;
  clienteId: string;
  clienteNombre: string;
  dueDate: string;
  /** Pesos. */
  saldo: number;
};

export const TRAMOS = ["0-30", "31-60", "60+"] as const;
export type Tramo = (typeof TRAMOS)[number];
export const ETIQUETA_TRAMO: Record<Tramo, string> = { "0-30": "0 a 30 días", "31-60": "31 a 60 días", "60+": "Más de 60 días" };

export function tramoDe(diasVencida: number): Tramo {
  return diasVencida <= 30 ? "0-30" : diasVencida <= 60 ? "31-60" : "60+";
}

export type FilaCliente = {
  clienteId: string;
  clienteNombre: string;
  vencido: number;
  estaSemana: number;
  total: number;
  pedidos: number;
  porTramo: Record<Tramo, number>;
};

export type InformeACobrar = {
  semana: { lunes: string; domingo: string };
  vencido: number;
  estaSemana: number;
  total: number;
  antiguedad: Record<Tramo, number>;
  clientes: FilaCliente[];
};

export function informeACobrar(saldos: readonly SaldoDeCuota[], hoy: string): InformeACobrar {
  const semana = semanaDe(hoy);
  const t = { vencido: 0, estaSemana: 0, total: 0 };
  const antig: Record<Tramo, number> = { "0-30": 0, "31-60": 0, "60+": 0 };
  const porCliente = new Map<string, { f: FilaCliente; pedidos: Set<string>; v: number; s: number; t: number; tr: Record<Tramo, number> }>();
  for (const s of saldos) {
    const c = aCentavos(s.saldo);
    if (c <= 0) continue;
    let e = porCliente.get(s.clienteId);
    if (!e) {
      e = { f: { clienteId: s.clienteId, clienteNombre: s.clienteNombre, vencido: 0, estaSemana: 0, total: 0, pedidos: 0, porTramo: { "0-30": 0, "31-60": 0, "60+": 0 } }, pedidos: new Set(), v: 0, s: 0, t: 0, tr: { "0-30": 0, "31-60": 0, "60+": 0 } };
      porCliente.set(s.clienteId, e);
    }
    e.pedidos.add(s.pedidoId);
    t.total += c;
    e.t += c;
    if (s.dueDate < hoy) {
      const tramo = tramoDe(diasEntre(s.dueDate, hoy));
      t.vencido += c;
      antig[tramo] += c;
      e.v += c;
      e.tr[tramo] += c;
    } else if (s.dueDate <= semana.domingo) {
      t.estaSemana += c;
      e.s += c;
    }
  }
  const clientes = [...porCliente.values()].map((e) => ({
    ...e.f,
    vencido: desdeCentavos(e.v),
    estaSemana: desdeCentavos(e.s),
    total: desdeCentavos(e.t),
    pedidos: e.pedidos.size,
    porTramo: { "0-30": desdeCentavos(e.tr["0-30"]), "31-60": desdeCentavos(e.tr["31-60"]), "60+": desdeCentavos(e.tr["60+"]) },
  }));
  clientes.sort((a, b) => b.vencido - a.vencido || b.total - a.total || a.clienteNombre.localeCompare(b.clienteNombre, "es"));
  return {
    semana,
    vencido: desdeCentavos(t.vencido),
    estaSemana: desdeCentavos(t.estaSemana),
    total: desdeCentavos(t.total),
    antiguedad: { "0-30": desdeCentavos(antig["0-30"]), "31-60": desdeCentavos(antig["31-60"]), "60+": desdeCentavos(antig["60+"]) },
    clientes,
  };
}

// --- Cobrado del mes --------------------------------------------------------------------------

/** Un cobro vigente (sin anular). `paidAt` es un instante. */
export type CobroLeido = { paidAt: Date; method: string; amountArs: number };

export type InformeCobrado = {
  mes: string;
  total: number;
  cantidad: number;
  porMedio: { medio: MedioCobro; etiqueta: string; total: number; cantidad: number }[];
};

export function informeCobrado(cobros: readonly CobroLeido[], mes: string): InformeCobrado {
  const { desde, hasta } = rangoDelMes(mes);
  const por = new Map<MedioCobro, { c: number; n: number }>(MEDIOS_COBRO.map((m) => [m, { c: 0, n: 0 }]));
  let total = 0;
  let cantidad = 0;
  for (const x of cobros) {
    if (x.paidAt < desde || x.paidAt >= hasta) continue;
    const medio = (MEDIOS_COBRO as readonly string[]).includes(x.method) ? (x.method as MedioCobro) : "OTRO";
    const c = aCentavos(x.amountArs);
    const e = por.get(medio)!;
    e.c += c;
    e.n++;
    total += c;
    cantidad++;
  }
  return {
    mes,
    total: desdeCentavos(total),
    cantidad,
    porMedio: MEDIOS_COBRO.map((m) => ({ medio: m, etiqueta: ETIQUETA_MEDIO_COBRO[m], total: desdeCentavos(por.get(m)!.c), cantidad: por.get(m)!.n })),
  };
}

// --- A pagar ----------------------------------------------------------------------------------

export const DIAS_A_PAGAR = 30;

/** Una cuenta a pagar sin pago vigente. `dueDate` null = sin vencimiento. */
export type CuentaPendiente = { id: string; proveedorId: string | null; proveedorNombre: string; dueDate: string | null; importe: number };

export type FilaProveedor = { proveedorId: string | null; proveedorNombre: string; vencido: number; proximos: number; total: number; cuentas: number };

export type InformeAPagar = {
  hasta: string;
  vencido: number;
  proximos: number;
  total: number;
  proveedores: FilaProveedor[];
  sinVencimiento: { total: number; cuentas: number; proveedores: FilaProveedor[] };
};

export function informeAPagar(cuentas: readonly CuentaPendiente[], hoy: string): InformeAPagar {
  const hasta = sumarDias(hoy, DIAS_A_PAGAR);
  const t = { v: 0, p: 0 };
  const sin = { t: 0, n: 0 };
  type Acum = { id: string | null; nombre: string; v: number; p: number; n: number };
  const con = new Map<string, Acum>();
  const sinV = new Map<string, Acum>();
  const acumular = (m: Map<string, Acum>, c: CuentaPendiente, v: number, p: number) => {
    const k = c.proveedorId ?? "";
    const e = m.get(k) ?? { id: c.proveedorId, nombre: c.proveedorNombre, v: 0, p: 0, n: 0 };
    e.v += v;
    e.p += p;
    e.n++;
    m.set(k, e);
  };
  for (const c of cuentas) {
    const im = aCentavos(c.importe);
    if (im <= 0) continue;
    if (c.dueDate === null) {
      sin.t += im;
      sin.n++;
      acumular(sinV, c, 0, im);
    } else if (c.dueDate < hoy) {
      t.v += im;
      acumular(con, c, im, 0);
    } else if (c.dueDate <= hasta) {
      t.p += im;
      acumular(con, c, 0, im);
    }
  }
  const filas = (m: Map<string, Acum>): FilaProveedor[] =>
    [...m.values()]
      .map((e) => ({ proveedorId: e.id, proveedorNombre: e.nombre, vencido: desdeCentavos(e.v), proximos: desdeCentavos(e.p), total: desdeCentavos(e.v + e.p), cuentas: e.n }))
      .sort((a, b) => b.vencido - a.vencido || b.total - a.total || a.proveedorNombre.localeCompare(b.proveedorNombre, "es"));
  return {
    hasta,
    vencido: desdeCentavos(t.v),
    proximos: desdeCentavos(t.p),
    total: desdeCentavos(t.v + t.p),
    proveedores: filas(con),
    sinVencimiento: { total: desdeCentavos(sin.t), cuentas: sin.n, proveedores: filas(sinV) },
  };
}

// --- Mostrar ----------------------------------------------------------------------------------

/** Pesos es-AR sin decimales, salvo que haya centavos. */
export function pesosInforme(n: number): string {
  const centavos = aCentavos(n);
  const conDecimales = centavos % 100 !== 0;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: conDecimales ? 2 : 0, maximumFractionDigits: conDecimales ? 2 : 0 }).format(centavos / 100);
}
