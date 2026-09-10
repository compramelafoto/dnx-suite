"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";
import { parseSpaceForm } from "@/lib/bookings/space-form";
import { parseExtraForm } from "@/lib/bookings/extra-form";
import { getGoogleAccessToken } from "@/lib/integrations/access-token";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { createCalendarClient, isCalendarPermissionError } from "@/lib/bookings/calendar/client";
import { pairsForSpace } from "@/lib/bookings/conflicts";
import { cancelBooking, createBooking } from "@/lib/bookings/create";
import { approveBooking, confirmTransferPayment } from "@/lib/bookings/lifecycle";
import { requireBookingsAdmin, requireBookingsStaff } from "@/lib/bookings/access";
import { slugify } from "@/lib/slug";
import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { BOOKINGS_TIME_ZONE } from "@/lib/bookings/time";

const AGENDA = "/reservas";
const ESPACIOS = "/reservas/espacios";

/**
 * Alta y edición de un espacio, con sus horarios y sus convivencias.
 *
 * Los horarios y las compatibilidades se reemplazan enteros en cada guardado: son listas
 * chicas, y un borrar-e-insertar dentro de una transacción es más fácil de razonar —y de
 * verificar— que un diff. Si algo falla, no queda un espacio a medio configurar.
 */
export async function saveSpaceAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();

  const spaceId = String(formData.get("spaceId") ?? "").trim() || null;
  const destinoError = spaceId ? `${ESPACIOS}/${spaceId}` : `${ESPACIOS}/nuevo`;

  const parsed = parseSpaceForm(formData);
  if (!parsed.ok) redirect(`${destinoError}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  // Se verifica la pertenencia antes de escribir: `where` de un update tiene que ser
  // único, así que el workspace no puede viajar ahí y hay que comprobarlo aparte.
  if (spaceId) {
    const propio = await prisma.bookingSpace.count({
      where: { id: spaceId, workspaceId: workspace.id },
    });
    if (propio === 0) redirect(`${ESPACIOS}?error=${encodeURIComponent("Ese espacio no existe.")}`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const datos = {
        name: v.name,
        description: v.description,
        slotMinutes: v.slotMinutes,
        minBookingMinutes: v.minBookingMinutes,
        maxBookingMinutes: v.maxBookingMinutes,
        bufferMinutes: v.bufferMinutes,
        minAdvanceHours: v.minAdvanceHours,
        maxAdvanceDays: v.maxAdvanceDays,
        requiresApproval: v.requiresApproval,
        memberHourlyPriceArs: minorToDecimalString(v.memberHourlyPriceMinor),
        nonMemberHourlyPriceArs: minorToDecimalString(v.nonMemberHourlyPriceMinor),
        memberFreeHoursPerMonth: v.memberFreeHoursPerMonth,
        allowsNonMembers: v.allowsNonMembers,
      };

      const espacio = spaceId
        ? await tx.bookingSpace.update({ where: { id: spaceId }, data: datos, select: { id: true } })
        : await tx.bookingSpace.create({
            data: {
              ...datos,
              workspaceId: workspace.id,
              slug: `${slugify(v.name)}-${Date.now().toString(36)}`,
            },
            select: { id: true },
          });

      await tx.bookingSpaceHours.deleteMany({ where: { spaceId: espacio.id } });
      await tx.bookingSpaceHours.createMany({
        data: v.weeklyHours.map((h) => ({ ...h, spaceId: espacio.id })),
      });

      // Las compatibilidades son simétricas: se borran las de los dos lados antes de escribir.
      await tx.bookingSpaceCompatibility.deleteMany({
        where: { OR: [{ spaceAId: espacio.id }, { spaceBId: espacio.id }] },
      });
      const pares = pairsForSpace(espacio.id, v.compatibleWith);
      if (pares.length > 0) await tx.bookingSpaceCompatibility.createMany({ data: pares });
    });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo guardar el espacio", {
      workspaceId: workspace.id,
      detalle: sanitizeError(error),
    });
    redirect(`${destinoError}?error=${encodeURIComponent("No pudimos guardar el espacio.")}`);
  }

  revalidatePath(ESPACIOS);
  revalidatePath(AGENDA);
  redirect(`${ESPACIOS}?ok=guardado`);
}

/**
 * Un espacio se desactiva, no se borra: borrarlo dejaría reservas huérfanas y le sacaría a
 * la institución el registro de lo que alquiló.
 */
export async function toggleSpaceActiveAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const activar = formData.get("active") === "on";

  await prisma.bookingSpace.updateMany({
    where: { id: spaceId, workspaceId: workspace.id },
    data: { active: activar },
  });

  revalidatePath(ESPACIOS);
  revalidatePath(AGENDA);
  redirect(`${ESPACIOS}?ok=${activar ? "activado" : "desactivado"}`);
}

/**
 * Carga una reserva a mano, para quien llamó por teléfono o vino al mostrador.
 *
 * Pasa por el mismo `createBooking` que usará el portal: mismas verificaciones, mismos
 * choques, mismo precio. La única diferencia es el medio de pago `PRESENCIAL`, que confirma
 * en el acto porque el dinero ya lo tiene la institución.
 */
export async function createManualBookingAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireBookingsStaff();
  const NUEVA = "/reservas/nueva";

  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const startAt = parseLocalDateTime(String(formData.get("startAt") ?? ""), BOOKINGS_TIME_ZONE);
  const endAt = parseLocalDateTime(String(formData.get("endAt") ?? ""), BOOKINGS_TIME_ZONE);
  const contactName = String(formData.get("contactName") ?? "").trim();

  if (!spaceId || startAt === null || endAt === null) {
    redirect(`${NUEVA}?error=${encodeURIComponent("Faltan datos de la reserva.")}`);
  }
  if (contactName.length < 2) {
    redirect(`${NUEVA}?error=${encodeURIComponent("Poné a nombre de quién va la reserva.")}`);
  }

  const r = await createBooking({
    workspaceId: workspace.id,
    spaceId,
    range: { startAt, endAt },
    customerType: formData.get("customerType") === "MEMBER" ? "MEMBER" : "NON_MEMBER",
    memberId: String(formData.get("memberId") ?? "").trim() || null,
    userId: null,
    contactName,
    contactEmail: String(formData.get("contactEmail") ?? "").trim(),
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    // La bolsa mensual del socio se resuelve en la etapa del portal. Acá el equipo cobra o
    // no cobra a mano, y aplicar un beneficio que todavía no se calcula sería inventarlo.
    freeMinutesAvailable: 0,
    paymentMethod: "PRESENCIAL",
    notes: String(formData.get("notes") ?? "").trim() || null,
    createdByUserId: user.id,
  });

  revalidatePath(AGENDA);
  redirect(r.ok ? `${AGENDA}?ok=creada` : `${NUEVA}?error=${encodeURIComponent(r.error)}`);
}

/** Cancelar desde la agenda del equipo. */
export async function cancelBookingAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireBookingsStaff();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelada por la institución";

  const r = await cancelBooking({
    workspaceId: workspace.id,
    bookingId,
    byUserId: user.id,
    reason,
  });

  revalidatePath(AGENDA);
  redirect(r.ok ? `${AGENDA}?ok=cancelada` : `${AGENDA}?error=${encodeURIComponent(r.error ?? "")}`);
}

const CONFIGURACION = "/reservas/configuracion";
const EXTRAS = "/reservas/extras";

/** Plazos de la institución: cuánto vive un bloqueo y hasta cuándo se puede cancelar. */
export async function saveBookingSettingsAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const holdHours = Math.max(1, Number(formData.get("holdHours") ?? 24) || 24);
  const cancelWindowHours = Math.max(0, Number(formData.get("cancelWindowHours") ?? 24) || 0);

  await prisma.bookingSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, holdHours, cancelWindowHours },
    update: { holdHours, cancelWindowHours },
  });

  revalidatePath(CONFIGURACION);
  redirect(`${CONFIGURACION}?ok=guardado`);
}

/** Feriados, vacaciones, mantenimiento. Sin espacio = toda la institución. */
export async function addClosureAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const startAt = parseLocalDateTime(String(formData.get("startAt") ?? ""), BOOKINGS_TIME_ZONE);
  const endAt = parseLocalDateTime(String(formData.get("endAt") ?? ""), BOOKINGS_TIME_ZONE);
  const reason = String(formData.get("reason") ?? "").trim();

  if (startAt === null || endAt === null || endAt <= startAt) {
    redirect(`${CONFIGURACION}?error=${encodeURIComponent("Revisá las fechas del cierre.")}`);
  }
  if (reason.length < 2) {
    redirect(`${CONFIGURACION}?error=${encodeURIComponent("Escribí el motivo del cierre.")}`);
  }

  await prisma.bookingClosure.create({
    data: {
      workspaceId: workspace.id,
      spaceId: String(formData.get("spaceId") ?? "").trim() || null,
      startAt,
      endAt,
      reason,
    },
  });

  revalidatePath(CONFIGURACION);
  revalidatePath(AGENDA);
  redirect(`${CONFIGURACION}?ok=cierre`);
}

export async function deleteClosureAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  await prisma.bookingClosure.deleteMany({
    where: { id: String(formData.get("closureId") ?? "").trim(), workspaceId: workspace.id },
  });
  revalidatePath(CONFIGURACION);
  revalidatePath(AGENDA);
  redirect(`${CONFIGURACION}?ok=cierre_borrado`);
}

/** El inventario: qué hay y cuántos. */
export async function saveResourceAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const quantity = Math.max(0, Number(formData.get("quantity") ?? 0) || 0);
  const resourceId = String(formData.get("resourceId") ?? "").trim() || null;

  if (name.length < 2) {
    redirect(`${EXTRAS}?error=${encodeURIComponent("Poné un nombre para el recurso.")}`);
  }

  if (resourceId) {
    await prisma.bookingResource.updateMany({
      where: { id: resourceId, workspaceId: workspace.id },
      data: { name, quantity },
    });
  } else {
    await prisma.bookingResource.create({ data: { workspaceId: workspace.id, name, quantity } });
  }

  revalidatePath(EXTRAS);
  redirect(`${EXTRAS}?ok=recurso`);
}

/**
 * Borrar un recurso deja sin control a los extras que lo usaban, no los rompe: el campo
 * queda en null y esos extras pasan a ofrecerse siempre. Es una consecuencia real, así que
 * la pantalla lo avisa antes.
 */
export async function deleteResourceAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  await prisma.bookingResource.deleteMany({
    where: { id: String(formData.get("resourceId") ?? "").trim(), workspaceId: workspace.id },
  });
  revalidatePath(EXTRAS);
  redirect(`${EXTRAS}?ok=recurso_borrado`);
}

export async function saveExtraAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const extraId = String(formData.get("extraId") ?? "").trim() || null;

  const parsed = parseExtraForm(formData);
  if (!parsed.ok) redirect(`${EXTRAS}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  if (extraId) {
    const propio = await prisma.bookingExtra.count({
      where: { id: extraId, workspaceId: workspace.id },
    });
    if (propio === 0) redirect(`${EXTRAS}?error=${encodeURIComponent("Ese extra no existe.")}`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const datos = {
        name: v.name,
        description: v.description,
        priceMode: v.priceMode,
        memberPriceArs: minorToDecimalString(v.memberPriceMinor),
        nonMemberPriceArs: minorToDecimalString(v.nonMemberPriceMinor),
        resourceId: v.resourceId,
        unitsConsumed: v.unitsConsumed,
        requiresConfirmation: v.requiresConfirmation,
      };

      const extra = extraId
        ? await tx.bookingExtra.update({ where: { id: extraId }, data: datos, select: { id: true } })
        : await tx.bookingExtra.create({
            data: { ...datos, workspaceId: workspace.id },
            select: { id: true },
          });

      // Los espacios se reemplazan enteros: lista chica, más fácil de razonar que un diff.
      await tx.bookingExtraSpace.deleteMany({ where: { extraId: extra.id } });
      await tx.bookingExtraSpace.createMany({
        data: v.spaceIds.map((spaceId) => ({ extraId: extra.id, spaceId })),
      });
    });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo guardar el extra", {
      workspaceId: workspace.id,
      detalle: sanitizeError(error),
    });
    redirect(`${EXTRAS}?error=${encodeURIComponent("No pudimos guardar el extra.")}`);
  }

  revalidatePath(EXTRAS);
  redirect(`${EXTRAS}?ok=extra`);
}

/** Un extra se desactiva, no se borra: hay reservas que lo contrataron. */
export async function toggleExtraActiveAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  await prisma.bookingExtra.updateMany({
    where: { id: String(formData.get("extraId") ?? "").trim(), workspaceId: workspace.id },
    data: { active: formData.get("active") === "on" },
  });
  revalidatePath(EXTRAS);
  redirect(`${EXTRAS}?ok=extra`);
}

/** La Secretaría confirma que la transferencia llegó. */
export async function confirmTransferAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireBookingsStaff();
  const bookingId = String(formData.get("bookingId") ?? "").trim();

  const r = await confirmTransferPayment({
    workspaceId: workspace.id,
    bookingId,
    byUserId: user.id,
  });

  revalidatePath(AGENDA);
  redirect(r.ok ? `${AGENDA}?ok=confirmada` : `${AGENDA}?error=${encodeURIComponent(r.error ?? "")}`);
}

/**
 * La institución aprueba una reserva que estaba a la espera.
 *
 * Las casillas marcadas son los extras que NO se pudieron conseguir: se quitan y el total
 * baja antes de que salga el enlace de pago.
 */
export async function approveBookingAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireBookingsStaff();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const removeExtraLineIds = formData.getAll("removeExtraLineIds").map((v) => String(v));

  const r = await approveBooking({
    workspaceId: workspace.id,
    bookingId,
    byUserId: user.id,
    removeExtraLineIds,
  });

  revalidatePath(AGENDA);
  redirect(r.ok ? `${AGENDA}?ok=aprobada` : `${AGENDA}?error=${encodeURIComponent(r.error ?? "")}`);
}

/** Rechazar es cancelar con un motivo. Reutiliza el mismo camino. */
export async function rejectBookingAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireBookingsStaff();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || "Rechazada por la institución";

  const r = await cancelBooking({
    workspaceId: workspace.id,
    bookingId,
    byUserId: user.id,
    reason,
  });

  revalidatePath(AGENDA);
  redirect(r.ok ? `${AGENDA}?ok=rechazada` : `${AGENDA}?error=${encodeURIComponent(r.error ?? "")}`);
}

/**
 * Elige qué calendario de Google espeja un espacio, o crea uno nuevo para él.
 *
 * Crear uno propio es la opción recomendada: meter las reservas del estudio en el
 * calendario personal de alguien es un desorden que después nadie limpia.
 *
 * Al cambiar de calendario se borra el `syncToken` y los bloqueos del anterior: son de otro
 * calendario y dejarían tapando horarios que ya no ocupa nadie.
 */
export async function setSpaceCalendarAction(formData: FormData): Promise<void> {
  const { workspace } = await requireBookingsAdmin();
  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const elegido = String(formData.get("calendarId") ?? "").trim();

  const espacio = await prisma.bookingSpace.findFirst({
    where: { id: spaceId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!espacio) redirect(`${ESPACIOS}?error=${encodeURIComponent("Ese espacio no existe.")}`);

  const token = await getGoogleAccessToken(workspace.id, GOOGLE_CALENDAR_INTEGRATION_KEY);
  if (!token.ok && elegido === "__nuevo__") {
    redirect(
      `${ESPACIOS}?error=${encodeURIComponent("Conectá la cuenta de Google antes de crear un calendario.")}`,
    );
  }

  let calendarId: string | null = elegido === "" ? null : elegido;

  if (elegido === "__nuevo__" && token.ok) {
    try {
      const client = createCalendarClient(token.accessToken);
      calendarId = await client.createCalendar(`${espacio.name} — reservas`);
    } catch (error) {
      console.error("[fotoffice][calendar] no se pudo crear el calendario", {
        spaceId,
        detalle: sanitizeError(error),
      });
      // Un 403 no se arregla esperando: es un permiso que la cuenta no otorgó. Pasa con
      // las cuentas conectadas antes de que se pidiera `calendar.app.created`.
      const mensaje = isCalendarPermissionError(error)
        ? "La cuenta de Google conectada no tiene permiso para crear calendarios. Volvé a conectarla en Integraciones, o creá el calendario en Google y elegilo de la lista."
        : "No pudimos crear el calendario. Probá de nuevo en un rato.";
      redirect(`${ESPACIOS}?error=${encodeURIComponent(mensaje)}`);
    }
  }

  await prisma.$transaction([
    prisma.bookingCalendarBlock.deleteMany({ where: { spaceId } }),
    prisma.bookingSpace.update({
      where: { id: spaceId },
      data: { googleCalendarId: calendarId, calendarSyncToken: null },
    }),
  ]);

  revalidatePath(ESPACIOS);
  redirect(`${ESPACIOS}?ok=calendario`);
}
