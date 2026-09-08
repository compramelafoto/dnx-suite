"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";
import { parseSpaceForm } from "@/lib/bookings/space-form";
import { pairsForSpace } from "@/lib/bookings/conflicts";
import { cancelBooking, createBooking } from "@/lib/bookings/create";
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
