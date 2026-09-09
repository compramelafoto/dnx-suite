import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { ACTIVE_BOOKING_STATUSES } from "./constants";
import { blockingSpaceIds, type CompatibilityPair } from "./conflicts";
import type { AvailabilityInput, SpaceRules, WeeklyHour } from "./availability";
import type { Commitment, ExtraDefinition } from "./extras";
import { BOOKINGS_TIME_ZONE, type Interval } from "./time";

/**
 * Única puerta a las tablas de reservas.
 *
 * Su trabajo es juntar lo que el motor puro necesita y pasárselo resuelto: horarios,
 * cierres y la ocupación de TODOS los espacios que bloquean a este. El motor no sabe de
 * incompatibilidades — las resuelve esta capa, y por eso el motor puede probarse sin base.
 *
 * Toda consulta lleva `workspaceId`.
 */

export type SpaceRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  order: number;
  rules: SpaceRules;
  requiresApproval: boolean;
  memberHourlyPriceMinor: number;
  nonMemberHourlyPriceMinor: number;
  memberFreeHoursPerMonth: number;
  allowsNonMembers: boolean;
  googleCalendarId: string | null;
  weeklyHours: WeeklyHour[];
};

type FilaEspacio = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  order: number;
  slotMinutes: number;
  minBookingMinutes: number;
  maxBookingMinutes: number | null;
  bufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  requiresApproval: boolean;
  memberHourlyPriceArs: { toString(): string };
  nonMemberHourlyPriceArs: { toString(): string };
  memberFreeHoursPerMonth: number;
  allowsNonMembers: boolean;
  googleCalendarId: string | null;
  hours: { weekday: number; startMinute: number; endMinute: number }[];
};

const INCLUIR_HORARIOS = {
  hours: { orderBy: [{ weekday: "asc" as const }, { startMinute: "asc" as const }] },
};

function toRecord(fila: FilaEspacio): SpaceRecord {
  return {
    id: fila.id,
    name: fila.name,
    slug: fila.slug,
    description: fila.description,
    imageUrl: fila.imageUrl,
    active: fila.active,
    order: fila.order,
    rules: {
      slotMinutes: fila.slotMinutes,
      minBookingMinutes: fila.minBookingMinutes,
      maxBookingMinutes: fila.maxBookingMinutes,
      bufferMinutes: fila.bufferMinutes,
      minAdvanceHours: fila.minAdvanceHours,
      maxAdvanceDays: fila.maxAdvanceDays,
    },
    requiresApproval: fila.requiresApproval,
    // A centavos apenas sale de la base: adentro del módulo el dinero no vuelve a ser decimal.
    memberHourlyPriceMinor: decimalArsToMinor(fila.memberHourlyPriceArs),
    nonMemberHourlyPriceMinor: decimalArsToMinor(fila.nonMemberHourlyPriceArs),
    memberFreeHoursPerMonth: fila.memberFreeHoursPerMonth,
    allowsNonMembers: fila.allowsNonMembers,
    googleCalendarId: fila.googleCalendarId,
    weeklyHours: fila.hours,
  };
}

export async function listSpaces(
  workspaceId: string,
  options?: { includeInactive?: boolean },
): Promise<SpaceRecord[]> {
  const filas = (await prisma.bookingSpace.findMany({
    where: { workspaceId, ...(options?.includeInactive ? {} : { active: true }) },
    include: INCLUIR_HORARIOS,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })) as unknown as FilaEspacio[];
  return filas.map(toRecord);
}

export async function getSpace(workspaceId: string, spaceId: string): Promise<SpaceRecord | null> {
  const filas = (await prisma.bookingSpace.findMany({
    where: { workspaceId, id: spaceId },
    include: INCLUIR_HORARIOS,
    take: 1,
  })) as unknown as FilaEspacio[];
  return filas[0] ? toRecord(filas[0]) : null;
}

export async function listCompatibilities(workspaceId: string): Promise<CompatibilityPair[]> {
  const espacios = await prisma.bookingSpace.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const ids = espacios.map((e) => e.id);
  if (ids.length === 0) return [];
  return prisma.bookingSpaceCompatibility.findMany({
    where: { spaceAId: { in: ids } },
    select: { spaceAId: true, spaceBId: true },
  });
}

/**
 * Todo lo que el motor necesita para responder sobre un espacio, menos la ventana.
 *
 * Devuelve `null` si el espacio no existe en ese workspace — nunca lanza por eso: pedir un
 * espacio inexistente es algo que puede pasar con una URL vieja, no una falla del sistema.
 */
export async function loadAvailabilityContext(
  workspaceId: string,
  spaceId: string,
  range: Interval,
  now: Date = new Date(),
): Promise<Omit<AvailabilityInput, "range"> | null> {
  const [espacios, compatibilidades] = await Promise.all([
    listSpaces(workspaceId, { includeInactive: true }),
    listCompatibilities(workspaceId),
  ]);

  const espacio = espacios.find((e) => e.id === spaceId);
  if (!espacio) return null;

  const bloquean = blockingSpaceIds(
    spaceId,
    espacios.map((e) => e.id),
    compatibilidades,
  ).sort();

  const [ocupacion, cierresFilas, bloqueosDeCalendario] = await Promise.all([
    prisma.booking.findMany({
      where: {
        workspaceId,
        spaceId: { in: bloquean },
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        // Una reserva que empieza antes de la ventana pero termina adentro también tapa.
        startAt: { lt: range.endAt },
        endAt: { gt: range.startAt },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.bookingClosure.findMany({
      where: {
        workspaceId,
        OR: [{ spaceId: null }, { spaceId }],
        startAt: { lt: range.endAt },
        endAt: { gt: range.startAt },
      },
      select: { startAt: true, endAt: true },
    }),
    // Lo que se cargó a mano en Google Calendar ocupa igual que una reserva, y ocupa
    // también para los espacios que no conviven con éste: si la Comisión anota "Muestra
    // anual" en el calendario del salón, el estudio tampoco se puede alquilar.
    prisma.bookingCalendarBlock.findMany({
      where: {
        spaceId: { in: bloquean },
        startAt: { lt: range.endAt },
        endAt: { gt: range.startAt },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  return {
    space: espacio.rules,
    weeklyHours: espacio.weeklyHours,
    closures: cierresFilas.map((c) => ({ startAt: c.startAt, endAt: c.endAt })),
    // El motor recibe toda la ocupación junta y no distingue de dónde viene: una reserva,
    // un espacio incompatible o un evento del calendario tapan igual.
    busy: [...ocupacion, ...bloqueosDeCalendario].map((b) => ({
      startAt: b.startAt,
      endAt: b.endAt,
    })),
    now,
    timeZone: BOOKINGS_TIME_ZONE,
  };
}

export type BookingRow = {
  id: string;
  spaceId: string;
  startAt: Date;
  endAt: Date;
  status: string;
  contactName: string;
  customerType: string;
  paymentMethod: string;
  paymentStatus: string;
  totalArs: { toString(): string };
  holdExpiresAt: Date | null;
  extraLines: {
    id: string;
    nameSnapshot: string;
    amountArs: { toString(): string };
    status: string;
  }[];
};

/** Lo que muestra la agenda del equipo. Incluye canceladas para poder explicarlas. */
export async function listBookingsInRange(
  workspaceId: string,
  range: Interval,
): Promise<BookingRow[]> {
  return (await prisma.booking.findMany({
    where: { workspaceId, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } },
    orderBy: [{ startAt: "asc" }],
    select: {
      id: true,
      spaceId: true,
      startAt: true,
      endAt: true,
      status: true,
      contactName: true,
      customerType: true,
      paymentMethod: true,
      paymentStatus: true,
      totalArs: true,
      holdExpiresAt: true,
      extraLines: {
        where: { status: { not: "REMOVED" } },
        select: { id: true, nameSnapshot: true, amountArs: true, status: true },
      },
    },
  })) as unknown as BookingRow[];
}

/** Sin fila configurada rigen los valores por defecto. No se crea nada al leer. */
export async function getBookingSettings(
  workspaceId: string,
): Promise<{ holdHours: number; cancelWindowHours: number }> {
  const fila = await prisma.bookingSettings.findUnique({
    where: { workspaceId },
    select: { holdHours: true, cancelWindowHours: true },
  });
  return { holdHours: fila?.holdHours ?? 24, cancelWindowHours: fila?.cancelWindowHours ?? 24 };
}

export type ExtraRecord = ExtraDefinition & {
  description: string | null;
  active: boolean;
  resourceName: string | null;
  spaceIds: string[];
};

export async function listResources(
  workspaceId: string,
): Promise<{ id: string; name: string; quantity: number }[]> {
  return prisma.bookingResource.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, quantity: true },
  });
}

/** Los extras del workspace. Con `spaceId`, solo los que se ofrecen en ese espacio. */
export async function listExtras(
  workspaceId: string,
  options?: { spaceId?: string; onlyActive?: boolean },
): Promise<ExtraRecord[]> {
  const filas = await prisma.bookingExtra.findMany({
    where: {
      workspaceId,
      ...(options?.onlyActive ? { active: true } : {}),
      ...(options?.spaceId ? { spaces: { some: { spaceId: options.spaceId } } } : {}),
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { resource: { select: { name: true } }, spaces: { select: { spaceId: true } } },
  });

  return filas.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    active: f.active,
    priceMode: f.priceMode === "PER_HOUR" ? "PER_HOUR" : "PER_BOOKING",
    memberPriceMinor: decimalArsToMinor(f.memberPriceArs),
    nonMemberPriceMinor: decimalArsToMinor(f.nonMemberPriceArs),
    resourceId: f.resourceId,
    resourceName: f.resource?.name ?? null,
    unitsConsumed: f.unitsConsumed,
    requiresConfirmation: f.requiresConfirmation,
    spaceIds: f.spaces.map((s) => s.spaceId),
  }));
}

/**
 * Lo que ya está apartado del inventario en una ventana.
 *
 * Solo cuentan las líneas que comprometen: una en `REMOVED` no aparta nada, y una en
 * `PENDING_CONFIRMATION` **sí** — mientras la Secretaría decide, ese flash está reservado.
 */
export async function listResourceCommitments(
  workspaceId: string,
  range: Interval,
): Promise<Commitment[]> {
  const lineas = await prisma.bookingExtraLine.findMany({
    where: {
      status: { in: ["PENDING_CONFIRMATION", "CONFIRMED"] },
      booking: {
        workspaceId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        startAt: { lt: range.endAt },
        endAt: { gt: range.startAt },
      },
      extra: { resourceId: { not: null } },
    },
    select: {
      unitsConsumed: true,
      extra: { select: { resourceId: true } },
      booking: { select: { startAt: true, endAt: true } },
    },
  });

  return lineas
    .filter((l) => l.extra.resourceId !== null)
    .map((l) => ({
      resourceId: l.extra.resourceId as string,
      units: l.unitsConsumed,
      range: { startAt: l.booking.startAt, endAt: l.booking.endAt },
    }));
}
