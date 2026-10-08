import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { formatearNumero, validarConfigSecuencia, type ConfigSecuencia } from "./formato";

/**
 * Configuración → Numeración. Una secuencia por clave y workspace; se crean con sus valores
 * iniciales la primera vez que se necesitan (idempotente). Configurar exige `configurar`, no deja
 * bajar el próximo número por debajo del último usado y deja cada cambio en el historial.
 * La asignación de números está en `./asignar`.
 */

type Cliente = Prisma.TransactionClient | typeof prisma;

export const CLAVES_SECUENCIA = ["CONSULTA", "PRESUPUESTO", "PEDIDO", "CONTRATO", "PROYECTO", "RECIBO"] as const;
export type ClaveSecuencia = (typeof CLAVES_SECUENCIA)[number];

/** Todas con año y 4 dígitos ("2026-0001"): cada 1° de enero (hora de Argentina) vuelven a 0001. */
const CON_ANIO: ConfigSecuencia = { prefix: "", withYear: true, digits: 4, nextValue: 1 };
export const SECUENCIAS_INICIALES: Record<ClaveSecuencia, ConfigSecuencia> = {
  CONSULTA: CON_ANIO,
  PRESUPUESTO: CON_ANIO,
  PEDIDO: CON_ANIO,
  CONTRATO: CON_ANIO,
  PROYECTO: CON_ANIO,
  /** Recibos X internos de los cobros de pedidos (etapa 3). */
  RECIBO: CON_ANIO,
};

export const MENSAJES_NUMERACION = {
  sinPermiso: "Sólo un administrador puede configurar la numeración.",
  noEncontrada: "No encontramos esa numeración.",
} as const;

export type CtxNumeracion = { workspaceId: string; userId: number; userLabel: string; role: string | null };
export type ConfigConAnio = ConfigSecuencia & { currentYear: number | null };
export type SecuenciaLeida = ConfigConAnio & {
  key: ClaveSecuencia;
  /** El número que va a salir ahora (si la secuencia lleva año y el año cambió: último usado de este año + 1). */
  proximo: number;
  /** Menor "próximo número" que se puede configurar: último usado + 1. */
  minimoProximo: number;
  vistaPrevia: string;
};
export type ResultadoNumeracion = { ok: true } | { ok: false; error: string };

export function esClaveSecuencia(v: unknown): v is ClaveSecuencia {
  return typeof v === "string" && (CLAVES_SECUENCIA as readonly string[]).includes(v);
}

/** Año calendario de `fecha` en Buenos Aires (el 31/12 a las 22 h de Argentina sigue siendo ese año). */
export function anioEnBuenosAires(fecha: Date): number {
  return Number(hoyEnBuenosAires(fecha).slice(0, 4));
}

/** Crea las secuencias que falten con sus valores iniciales. Seguro dentro de una transacción. */
export async function asegurarSecuencias(workspaceId: string, cliente: Cliente = prisma): Promise<void> {
  // skipDuplicates = ON CONFLICT DO NOTHING: si otra corrida la creó primero no aborta la transacción.
  await cliente.fotofficeSequence.createMany({
    data: CLAVES_SECUENCIA.map((key) => ({ workspaceId, key, ...SECUENCIAS_INICIALES[key] })),
    skipDuplicates: true,
  });
}

/**
 * Último número usado de la secuencia: del año `anio` si `conAnio`, de todos si no. 0 si no hay.
 */
async function ultimoUsado(cliente: Cliente, workspaceId: string, key: ClaveSecuencia, conAnio: boolean, anio: number): Promise<number> {
  const fila = await cliente.fotofficeRecordNumber.findFirst({
    where: { workspaceId, sequenceKey: key, ...(conAnio ? { year: anio } : {}) },
    orderBy: { value: "desc" },
    select: { value: true },
  });
  return fila?.value ?? 0;
}

/**
 * Número que va a salir ahora, igual que lo calcula `asignarNumero`: si la secuencia lleva año y
 * el año guardado (`currentYear`) no es `anio` —también si es `null`: nunca numeró con año—,
 * arranca después del último usado de `anio` (`ultimoUsado`, 0 si no hay); si no, `nextValue`.
 * Con `currentYear` sin pasar (formulario sin fila guardada) devuelve `nextValue`.
 */
function proximoNumero(config: ConfigSecuencia & { currentYear?: number | null }, anio: number, ultimoUsado = 0): number {
  const reinicia = config.withYear && config.currentYear !== undefined && config.currentYear !== anio;
  return reinicia ? ultimoUsado + 1 : config.nextValue;
}

/**
 * Texto del próximo número para `config` en el día `hoy` (hora de Buenos Aires). `ultimoUsado` es
 * el último número usado del año de `hoy`: si el año cambió, el próximo es ése + 1 (como en la
 * asignación), no siempre 1.
 */
export function vistaPrevia(config: ConfigSecuencia & { currentYear?: number | null }, hoy: Date, ultimoUsado = 0): string {
  const anio = anioEnBuenosAires(hoy);
  return formatearNumero(config, config.withYear ? anio : null, proximoNumero(config, anio, ultimoUsado));
}

const SELECT_SECUENCIA = { key: true, prefix: true, withYear: true, digits: true, nextValue: true, currentYear: true } as const;

/** Las secuencias del workspace, en orden fijo, con el próximo número y su vista previa. */
export async function leerSecuencias(workspaceId: string, hoy: Date = new Date()): Promise<SecuenciaLeida[]> {
  await asegurarSecuencias(workspaceId);
  const filas = await prisma.fotofficeSequence.findMany({ where: { workspaceId }, select: SELECT_SECUENCIA });
  const anio = anioEnBuenosAires(hoy);
  const out: SecuenciaLeida[] = [];
  for (const key of CLAVES_SECUENCIA) {
    const f = filas.find((x) => x.key === key);
    if (!f) continue;
    const ultimo = await ultimoUsado(prisma, workspaceId, key, f.withYear, anio);
    const config = { prefix: f.prefix, withYear: f.withYear, digits: f.digits, nextValue: f.nextValue, currentYear: f.currentYear };
    const proximo = proximoNumero(config, anio, ultimo);
    out.push({
      ...config,
      nextValue: proximo,
      key,
      proximo,
      minimoProximo: ultimo + 1,
      vistaPrevia: vistaPrevia(config, hoy, ultimo),
    });
  }
  return out;
}

/**
 * Cambia el formato o el próximo número de una secuencia. El próximo número no puede quedar en
 * uno ya usado (del año corriente si lleva año; de todos si no). Si lleva año, el próximo número
 * vale para el año corriente de Buenos Aires.
 */
export async function configurarSecuencia(
  ctx: CtxNumeracion,
  key: unknown,
  raw: { prefix: unknown; withYear: unknown; digits: unknown; nextValue: unknown },
  hoy: Date = new Date(),
): Promise<ResultadoNumeracion> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: MENSAJES_NUMERACION.sinPermiso };
  if (!esClaveSecuencia(key) || !raw || typeof raw !== "object") return { ok: false, error: MENSAJES_NUMERACION.noEncontrada };
  const anio = anioEnBuenosAires(hoy);
  await asegurarSecuencias(ctx.workspaceId);

  return prisma.$transaction(async (tx) => {
    const where = { workspaceId: ctx.workspaceId, key };
    // Toma el candado de la fila (UPDATE sin cambio real) ANTES de leerla y de mirar el último
    // usado: una asignación concurrente espera a que esta transacción termine, y lo que ya se
    // confirmó se ve en las lecturas siguientes (el historial y la comparación usan datos frescos).
    const tomado = await tx.fotofficeSequence.updateMany({ where, data: { key } });
    if (tomado.count === 0) return { ok: false as const, error: MENSAJES_NUMERACION.noEncontrada };
    const antes = await tx.fotofficeSequence.findFirst({ where, select: SELECT_SECUENCIA });
    if (!antes) return { ok: false as const, error: MENSAJES_NUMERACION.noEncontrada };

    const ultimo = await ultimoUsado(tx, ctx.workspaceId, key, raw.withYear === true, anio);
    const v = validarConfigSecuencia(raw, ultimo + 1);
    if (!v.ok) return v;

    const despues = { ...v.config, currentYear: v.config.withYear ? anio : null };
    const igual = (Object.keys(despues) as (keyof typeof despues)[]).every((k) => despues[k] === antes[k]);
    if (igual) return { ok: true as const };

    await tx.fotofficeSequence.updateMany({ where, data: despues });
    const before = { prefix: antes.prefix, withYear: antes.withYear, digits: antes.digits, nextValue: antes.nextValue, currentYear: antes.currentYear };
    await tx.fotofficeSequenceChange.create({
      data: {
        workspaceId: ctx.workspaceId, key, before, after: despues,
        actorUserId: ctx.userId, actorLabel: ctx.userLabel,
      },
      select: { id: true },
    });
    return { ok: true as const };
  });
}

/** Historial de configuración de una secuencia, del más nuevo al más viejo. */
export async function historialSecuencia(workspaceId: string, key: ClaveSecuencia, limite = 50) {
  return prisma.fotofficeSequenceChange.findMany({
    where: { workspaceId, key },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: { id: true, before: true, after: true, actorUserId: true, actorLabel: true, createdAt: true },
  });
}
