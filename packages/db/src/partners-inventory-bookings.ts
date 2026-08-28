/**
 * Repositorio de ocupación del inventario publicitario.
 *
 * La disponibilidad se calcula en `@repo/partners`, sin base de datos. Acá vive
 * lo que sí la necesita: leer las ocupaciones, tomar un lugar, confirmarlo y
 * vencer las reservas.
 *
 * La regla que gobierna todo esto: **nunca confiar en la disponibilidad que se
 * consultó antes**. Entre la consulta y la escritura pasa tiempo, y en ese rato
 * otro pudo tomar el último lugar. La verdad la dice la restricción de exclusión
 * de la base, no la lectura previa.
 */
import {
  resolveInventoryAvailability,
  reservationExpiryFrom,
  type DnxPartnerAdPlacementKey,
  type InventoryAvailability,
  type InventoryBooking,
  type InventoryRange,
  type ProposalSpaceAvailability,
} from "@repo/partners";
import { prisma } from "./client.js";

/** Postgres devuelve esto cuando la restricción de exclusión rechaza la fila. */
const EXCLUSION_VIOLATION = "23P01";

function isExclusionViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === EXCLUSION_VIOLATION) return true;
  // Prisma envuelve los errores crudos de Postgres en P2010.
  const meta = (err as { meta?: { code?: unknown } }).meta;
  return code === "P2010" && meta?.code === EXCLUSION_VIOLATION;
}

export type BookingContext = {
  placementKey: DnxPartnerAdPlacementKey;
  contextType?:
    | "GLOBAL"
    | "PLATFORM"
    | "ORGANIZATION"
    | "EVENT"
    | "EDITION"
    | "CONTEST"
    | "ALBUM"
    | "MEMBERSHIP";
  contextId?: string | null;
};

/** Las ocupaciones que pueden bloquear este espacio en este contexto. */
export async function listBookingsForAvailability(
  input: BookingContext & { range: InventoryRange },
): Promise<InventoryBooking[]> {
  const rows = await prisma.dnxPartnerInventoryBooking.findMany({
    where: {
      placementKey: input.placementKey,
      contextId: input.contextId ?? null,
      status: { in: ["RESERVED", "SOLD"] },
      startsAt: { lt: input.range.endsAt },
      endsAt: { gt: input.range.startsAt },
    },
    select: {
      placementKey: true,
      contextId: true,
      slotIndex: true,
      status: true,
      startsAt: true,
      endsAt: true,
      reservationExpiresAt: true,
    },
  });
  return rows as InventoryBooking[];
}

/** Qué lugar hay hoy para vender este espacio en este período. */
export async function getInventoryAvailability(
  input: BookingContext & { range: InventoryRange; now: Date; capacity?: number },
): Promise<InventoryAvailability> {
  const bookings = await listBookingsForAvailability(input);
  return resolveInventoryAvailability({
    placementKey: input.placementKey,
    contextId: input.contextId ?? null,
    range: input.range,
    bookings,
    now: input.now,
    capacity: input.capacity,
  });
}

export type ReserveSlotInput = BookingContext & {
  partnerId: string;
  range: InventoryRange;
  now: Date;
  capacity?: number;
  soldByOrganizationId?: string | null;
  createdByUserId?: number | null;
  notes?: string | null;
};

export type ReserveSlotResult =
  | { ok: true; bookingId: string; slotIndex: number; expiresAt: Date }
  | { ok: false; reason: "no_slot"; nextFreeAt: Date | null };

/**
 * Toma un lugar y lo deja reservado por diez días.
 *
 * Reintenta mientras la base rechace por superposición: eso significa que otro
 * tomó ese lugar entre la lectura y la escritura, y el siguiente intento vuelve
 * a mirar qué quedó libre. Se corta cuando no queda ningún lugar.
 *
 * El tope de intentos es el cupo: más que eso sería girar en falso.
 */
export async function reserveInventorySlot(
  input: ReserveSlotInput,
): Promise<ReserveSlotResult> {
  let ultimaDisponibilidad: InventoryAvailability | null = null;

  for (let intento = 0; intento < 32; intento += 1) {
    const disponibilidad = await getInventoryAvailability(input);
    ultimaDisponibilidad = disponibilidad;

    if (disponibilidad.slotIndex === null) {
      return { ok: false, reason: "no_slot", nextFreeAt: disponibilidad.nextFreeAt };
    }
    if (intento >= disponibilidad.capacity) break;

    const expiresAt = reservationExpiryFrom(input.now);
    try {
      const creada = await prisma.dnxPartnerInventoryBooking.create({
        data: {
          placementKey: input.placementKey,
          contextType: input.contextType ?? "GLOBAL",
          contextId: input.contextId ?? null,
          partnerId: input.partnerId,
          slotIndex: disponibilidad.slotIndex,
          status: "RESERVED",
          startsAt: input.range.startsAt,
          endsAt: input.range.endsAt,
          reservationExpiresAt: expiresAt,
          soldByOrganizationId: input.soldByOrganizationId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          notes: input.notes ?? null,
        },
        select: { id: true, slotIndex: true },
      });
      return {
        ok: true,
        bookingId: creada.id,
        slotIndex: creada.slotIndex,
        expiresAt,
      };
    } catch (err) {
      if (!isExclusionViolation(err)) throw err;
      // Otro tomó ese lugar en el medio. Volvemos a mirar.
    }
  }

  return {
    ok: false,
    reason: "no_slot",
    nextFreeAt: ultimaDisponibilidad?.nextFreeAt ?? null,
  };
}

export type ConfirmSaleResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_reservable" | "slot_taken" };

/**
 * Pasa una reserva a vendida.
 *
 * Revalida contra la base: si en el medio se venció y otro tomó el lugar, la
 * restricción rechaza el cambio de estado y esto devuelve `slot_taken` en vez de
 * prometer algo que ya no está.
 */
export async function confirmInventorySale(input: {
  bookingId: string;
  participationId?: string | null;
  updatedByUserId?: number | null;
}): Promise<ConfirmSaleResult> {
  const actual = await prisma.dnxPartnerInventoryBooking.findUnique({
    where: { id: input.bookingId },
    select: { status: true },
  });
  if (!actual) return { ok: false, reason: "not_found" };
  if (actual.status !== "RESERVED" && actual.status !== "DRAFT") {
    return { ok: false, reason: "not_reservable" };
  }

  try {
    await prisma.dnxPartnerInventoryBooking.update({
      where: { id: input.bookingId },
      data: {
        status: "SOLD",
        reservationExpiresAt: null,
        participationId: input.participationId ?? undefined,
        updatedByUserId: input.updatedByUserId ?? undefined,
      },
    });
    return { ok: true };
  } catch (err) {
    if (isExclusionViolation(err)) return { ok: false, reason: "slot_taken" };
    throw err;
  }
}

/** Extiende una reserva, dejando registro de quién y cuándo. */
export async function extendInventoryReservation(input: {
  bookingId: string;
  now: Date;
  days?: number;
  extendedByUserId: number;
}): Promise<{ ok: true; expiresAt: Date } | { ok: false; reason: "not_found" | "not_reserved" }> {
  const actual = await prisma.dnxPartnerInventoryBooking.findUnique({
    where: { id: input.bookingId },
    select: { status: true },
  });
  if (!actual) return { ok: false, reason: "not_found" };
  if (actual.status !== "RESERVED") return { ok: false, reason: "not_reserved" };

  const expiresAt = reservationExpiryFrom(input.now, input.days);
  await prisma.dnxPartnerInventoryBooking.update({
    where: { id: input.bookingId },
    data: {
      reservationExpiresAt: expiresAt,
      reservationExtendedAt: input.now,
      reservationExtendedByUserId: input.extendedByUserId,
      reservationExtensionCount: { increment: 1 },
    },
  });
  return { ok: true, expiresAt };
}

/**
 * Cancela las reservas vencidas y libera su lugar en la base.
 *
 * El dominio ya las ignora al calcular disponibilidad, así que esto no cambia lo
 * que ve el vendedor: lo que hace es liberar el lugar para la restricción, que
 * no sabe qué hora es. Sin esta tarea el sistema funciona, pero rechaza ventas
 * de lugares que en la pantalla figuran libres.
 */
export async function expireInventoryReservations(now: Date): Promise<number> {
  const { count } = await prisma.dnxPartnerInventoryBooking.updateMany({
    where: {
      status: "RESERVED",
      reservationExpiresAt: { not: null, lte: now },
    },
    data: { status: "CANCELLED" },
  });
  return count;
}

/**
 * La disponibilidad de varios espacios de una sola vez, con la forma que espera
 * `buildProposalPlan`.
 *
 * Es el puente entre la ocupación guardada y el generador de propuestas: con
 * esto, un espacio sin lugar deja de ofrecerse y la propuesta muestra desde
 * cuándo se libera.
 */
export async function getProposalSpacesAvailability(input: {
  placementKeys: readonly DnxPartnerAdPlacementKey[];
  contextId?: string | null;
  range: InventoryRange;
  now: Date;
  capacityByPlacement?: Partial<Record<DnxPartnerAdPlacementKey, number>>;
}): Promise<Partial<Record<DnxPartnerAdPlacementKey, ProposalSpaceAvailability>>> {
  const claves = [...new Set(input.placementKeys)];

  const rows = await prisma.dnxPartnerInventoryBooking.findMany({
    where: {
      placementKey: { in: claves },
      contextId: input.contextId ?? null,
      status: { in: ["RESERVED", "SOLD"] },
      startsAt: { lt: input.range.endsAt },
      endsAt: { gt: input.range.startsAt },
    },
    select: {
      placementKey: true,
      contextId: true,
      slotIndex: true,
      status: true,
      startsAt: true,
      endsAt: true,
      reservationExpiresAt: true,
    },
  });
  const bookings = rows as InventoryBooking[];

  const salida: Partial<Record<DnxPartnerAdPlacementKey, ProposalSpaceAvailability>> = {};
  for (const placementKey of claves) {
    const disponibilidad = resolveInventoryAvailability({
      placementKey,
      contextId: input.contextId ?? null,
      range: input.range,
      bookings,
      now: input.now,
      capacity: input.capacityByPlacement?.[placementKey],
    });
    salida[placementKey] = {
      available: disponibilidad.slotIndex !== null,
      nextFreeAt: disponibilidad.nextFreeAt,
    };
  }
  return salida;
}

/** Listado para el panel: las ocupaciones más próximas a vencer primero. */
export async function listInventoryBookings(input?: {
  status?: readonly ("DRAFT" | "RESERVED" | "SOLD" | "CANCELLED")[];
  placementKey?: string;
  limit?: number;
}) {
  return prisma.dnxPartnerInventoryBooking.findMany({
    where: {
      status: { in: [...(input?.status ?? (["RESERVED", "SOLD"] as const))] },
      ...(input?.placementKey ? { placementKey: input.placementKey } : {}),
    },
    orderBy: [{ endsAt: "asc" }, { placementKey: "asc" }, { slotIndex: "asc" }],
    take: input?.limit ?? 200,
    select: {
      id: true,
      placementKey: true,
      contextId: true,
      slotIndex: true,
      status: true,
      startsAt: true,
      endsAt: true,
      reservationExpiresAt: true,
      reservationExtensionCount: true,
      soldByOrganizationId: true,
      partner: { select: { id: true, name: true } },
    },
  });
}

export type InventoryBookingRow = Awaited<
  ReturnType<typeof listInventoryBookings>
>[number];
