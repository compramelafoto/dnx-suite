import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { TOLERANCIA_POR_OMISION } from "./constantes";
import { medianocheArgentina, sumarDias } from "./fechas";
import { horarioDelDia, type CambioPuntual, type FichaHorario, type FranjaSemanal, type MotivoCambio, type TipoCambio } from "./horario";
import { calcularJornada, type CorreccionJornada, type Jornada, type TurnoParaJornada } from "./jornada";

/**
 * Las consultas de Equipo. Todas llevan `workspaceId`. La ficha no tiene clave foránea a la
 * membresía: acá se verifica siempre que la membresía siga existiendo.
 */

export type ValorJornada = { id: string; desde: string; valorMinor: number };
export type CambioConId = CambioPuntual & { id: string; nota: string | null };

export type FichaCompleta = {
  id: string;
  membershipId: string;
  userId: number;
  apodo: string | null;
  fechaNacimiento: string | null;
  jornadaMinutos: number;
  sabadosAlternados: boolean;
  sabadoReferencia: string | null;
  activa: boolean;
  franjas: FranjaSemanal[];
  valores: ValorJornada[];
  cambios: CambioConId[];
};

export type MiembroEquipo = {
  membershipId: string;
  userId: number;
  nombre: string;
  name: string | null;
  email: string;
  role: string;
  ficha: FichaCompleta | null;
};

const fichaInclude = {
  franjas: { orderBy: [{ diaSemana: "asc" as const }, { inicioMin: "asc" as const }] },
  valores: { orderBy: { desde: "desc" as const } },
  cambios: { orderBy: { fecha: "desc" as const } },
};

type FichaFila = Awaited<ReturnType<typeof leerFichaFila>>;
async function leerFichaFila(workspaceId: string, userId: number) {
  return prisma.fotofficeEquipoFicha.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: fichaInclude,
  });
}

function aFicha(f: NonNullable<FichaFila>): FichaCompleta {
  return {
    id: f.id,
    membershipId: f.membershipId,
    userId: f.userId,
    apodo: f.apodo,
    fechaNacimiento: f.fechaNacimiento,
    jornadaMinutos: f.jornadaMinutos,
    sabadosAlternados: f.sabadosAlternados,
    sabadoReferencia: f.sabadoReferencia,
    activa: f.activa,
    franjas: f.franjas.map((x) => ({ diaSemana: x.diaSemana, inicioMin: x.inicioMin, finMin: x.finMin })),
    valores: f.valores.map((v) => ({ id: v.id, desde: v.desde, valorMinor: decimalArsToMinor(v.valorArs) })),
    cambios: f.cambios.map((c) => ({
      id: c.id,
      fecha: c.fecha,
      tipo: c.tipo as TipoCambio,
      motivo: c.motivo as MotivoCambio,
      inicioMin: c.inicioMin,
      finMin: c.finMin,
      nota: c.nota,
    })),
  };
}

export function fichaHorario(f: Pick<FichaCompleta, "franjas" | "sabadosAlternados" | "sabadoReferencia">): FichaHorario {
  return { franjas: f.franjas, sabadosAlternados: f.sabadosAlternados, sabadoReferencia: f.sabadoReferencia };
}

/** Todas las personas con membresía en el espacio, con su ficha si la tienen. */
export async function listarMiembros(workspaceId: string): Promise<MiembroEquipo[]> {
  const [membresias, fichas] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { workspaceId },
      select: { id: true, userId: true, role: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.fotofficeEquipoFicha.findMany({ where: { workspaceId }, include: fichaInclude }),
  ]);
  const porUsuario = new Map(fichas.map((f) => [f.userId, aFicha(f)]));
  return membresias.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    nombre: m.user.name?.trim() || m.user.email,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    ficha: porUsuario.get(m.userId) ?? null,
  }));
}

/** Una persona del espacio con su ficha (o sin ella). Null si no es miembro. */
export async function miembroDe(workspaceId: string, userId: number): Promise<MiembroEquipo | null> {
  const m = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true, userId: true, role: true, user: { select: { name: true, email: true } } },
  });
  if (!m) return null;
  const f = await leerFichaFila(workspaceId, userId);
  return {
    membershipId: m.id,
    userId: m.userId,
    nombre: m.user.name?.trim() || m.user.email,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    ficha: f ? aFicha(f) : null,
  };
}

/** La ficha activa de una persona que sigue siendo miembro, o null. */
export async function fichaActivaDe(workspaceId: string, userId: number): Promise<{ ficha: FichaCompleta; name: string | null; email: string } | null> {
  const m = await miembroDe(workspaceId, userId);
  if (!m?.ficha || !m.ficha.activa) return null;
  return { ficha: m.ficha, name: m.name, email: m.email };
}

export async function leerTolerancia(workspaceId: string): Promise<number> {
  const a = await prisma.fotofficeEquipoAjustes.findUnique({ where: { workspaceId }, select: { toleranciaMinutos: true } });
  return a?.toleranciaMinutos ?? TOLERANCIA_POR_OMISION;
}

/** Las cuentas que llevan turno: efectivo de mostrador (no la caja fuerte). */
async function cuentasDeMostrador(workspaceId: string): Promise<string[]> {
  const rows = await prisma.cashAccount.findMany({
    where: { workspaceId, kind: "EFECTIVO", isVault: false },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export type DatosDeJornadas = {
  turnos: TurnoParaJornada[];
  actividades: Map<number, Date[]>;
  correcciones: Map<string, CorreccionJornada & { createdAt: Date; createdByUserId: number }>;
};

/** Los turnos, la actividad y las correcciones de un rango de días ("AAAA-MM-DD", ambos incluidos). */
export async function datosDeJornadas(workspaceId: string, userIds: readonly number[], desde: string, hasta: string): Promise<DatosDeJornadas> {
  const inicio = medianocheArgentina(desde);
  const fin = medianocheArgentina(sumarDias(hasta, 1));
  const cuentas = await cuentasDeMostrador(workspaceId);
  const ids = [...userIds];
  const [turnos, ventas, movimientos, correcciones] = await Promise.all([
    cuentas.length === 0
      ? Promise.resolve([])
      : prisma.cashShift.findMany({
          where: {
            workspaceId,
            accountId: { in: cuentas },
            OR: [{ openedAt: { gte: inicio, lt: fin } }, { closedAt: { gte: inicio, lt: fin } }],
          },
          select: { id: true, openedAt: true, openedByUserId: true, closedAt: true, closedByUserId: true },
        }),
    ids.length === 0
      ? Promise.resolve([])
      : prisma.sale.findMany({
          where: { workspaceId, createdByUserId: { in: ids }, createdAt: { gte: inicio, lt: fin } },
          select: { createdByUserId: true, createdAt: true },
        }),
    ids.length === 0
      ? Promise.resolve([])
      : prisma.cashMovement.findMany({
          where: { workspaceId, createdByUserId: { in: ids }, createdAt: { gte: inicio, lt: fin } },
          select: { createdByUserId: true, createdAt: true },
        }),
    ids.length === 0
      ? Promise.resolve([])
      : prisma.fotofficeEquipoCorreccion.findMany({
          where: { workspaceId, userId: { in: ids }, fecha: { gte: desde, lte: hasta } },
          orderBy: { createdAt: "asc" },
        }),
  ]);

  const actividades = new Map<number, Date[]>();
  for (const a of [...ventas, ...movimientos]) {
    if (a.createdByUserId === null) continue;
    const lista = actividades.get(a.createdByUserId) ?? [];
    lista.push(a.createdAt);
    actividades.set(a.createdByUserId, lista);
  }
  // Ordenadas por fecha de carga: la última corrección de cada día pisa a las anteriores.
  const porDia = new Map<string, CorreccionJornada & { createdAt: Date; createdByUserId: number }>();
  for (const c of correcciones) {
    porDia.set(`${c.userId}|${c.fecha}`, {
      entradaMin: c.entradaMin,
      salidaMin: c.salidaMin,
      nota: c.nota,
      createdAt: c.createdAt,
      createdByUserId: c.createdByUserId,
    });
  }
  return { turnos, actividades, correcciones: porDia };
}

/** La jornada de cada día del rango para una ficha. */
export function jornadasDeFicha(
  ficha: FichaCompleta,
  datos: DatosDeJornadas,
  fechas: readonly string[],
  toleranciaMin: number,
): Jornada[] {
  const horarioBase = fichaHorario(ficha);
  return fechas.map((fecha) =>
    calcularJornada({
      userId: ficha.userId,
      fecha,
      turnos: datos.turnos,
      actividades: datos.actividades.get(ficha.userId) ?? [],
      horario: horarioDelDia(horarioBase, ficha.cambios, fecha),
      toleranciaMin,
      correccion: datos.correcciones.get(`${ficha.userId}|${fecha}`) ?? null,
    }),
  );
}

/** Las ventas que cargó hoy (para "hoy cargaste 12 ventas"). */
export async function ventasDelDia(workspaceId: string, userId: number, fecha: string): Promise<number> {
  return prisma.sale.count({
    where: {
      workspaceId,
      createdByUserId: userId,
      status: "COMPLETADA",
      createdAt: { gte: medianocheArgentina(fecha), lt: medianocheArgentina(sumarDias(fecha, 1)) },
    },
  });
}

/** Días del rango, del más reciente al más viejo. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let d = hasta; d >= desde; d = sumarDias(d, -1)) dias.push(d);
  return dias;
}
