"use server";

import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { BOOKINGS_TIME_ZONE } from "@/lib/bookings/time";
import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { loadPortalOffer } from "@/lib/bookings/portal";
import { extrasTotalMinor } from "@/lib/bookings/extras";
import { quoteBooking } from "@/lib/bookings/pricing";
import { createBooking, type BookingExtraLineInput } from "@/lib/bookings/create";
import { startBookingCheckout } from "@/lib/bookings/checkout";

/**
 * La reserva de quien no es socio.
 *
 * Dos diferencias con el portal, las dos a propósito:
 *
 * - **Tarifa plena y cero horas bonificadas.** El beneficio lo da la cuota.
 * - **Solo Mercado Pago.** La transferencia exige a alguien que la concilie, y para un
 *   desconocido eso es un horario bloqueado sin ninguna garantía.
 */
export async function createPublicBookingAction(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const workspaceSlug = String(formData.get("workspaceSlug") ?? "").trim();
  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const base = `/w/${workspaceSlug}/reservas/${spaceId}`;
  const volver = (params: string) => redirect(`${base}?${params}`);

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) redirect("/");
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, BOOKINGS_MODULE_KEY))) redirect("/");

  const startAt = parseLocalDateTime(String(formData.get("startAt") ?? ""), BOOKINGS_TIME_ZONE);
  const endAt = parseLocalDateTime(String(formData.get("endAt") ?? ""), BOOKINGS_TIME_ZONE);
  const contactName = String(formData.get("contactName") ?? "").trim();
  const elegidos = formData.getAll("extraIds").map((v) => String(v));

  if (startAt === null || endAt === null) {
    volver(`error=${encodeURIComponent("Elegí un horario antes de reservar.")}`);
  }
  if (contactName.length < 2) {
    volver(`error=${encodeURIComponent("Poné tu nombre para la reserva.")}`);
  }

  const range = { startAt: startAt as Date, endAt: endAt as Date };

  const oferta = await loadPortalOffer({
    workspaceId: branding.workspaceId,
    memberId: null,
    spaceId,
    range,
    customerType: "NON_MEMBER",
  });
  if (!oferta) volver(`error=${encodeURIComponent("Ese espacio ya no está disponible.")}`);

  const { space, extras } = oferta as NonNullable<typeof oferta>;
  if (!space.allowsNonMembers) {
    volver(`error=${encodeURIComponent("Este espacio se alquila solo a socios.")}`);
  }

  const minutos = (range.endAt.getTime() - range.startAt.getTime()) / 60_000;
  const quote = quoteBooking({
    minutes: minutos,
    customerType: "NON_MEMBER",
    memberHourlyPriceMinor: space.memberHourlyPriceMinor,
    nonMemberHourlyPriceMinor: space.nonMemberHourlyPriceMinor,
    freeMinutesAvailable: 0,
  });

  const lineas: BookingExtraLineInput[] = extras
    .filter((o) => elegidos.includes(o.extra.id) && o.available)
    .map((o) => ({
      extraId: o.extra.id,
      nameSnapshot: o.extra.name,
      priceMode: o.extra.priceMode,
      unitPriceMinor: o.extra.nonMemberPriceMinor,
      unitsConsumed: o.extra.unitsConsumed,
      amountMinor: o.amountMinor,
      status: o.extra.requiresConfirmation ? "PENDING_CONFIRMATION" : "CONFIRMED",
    }));

  const r = await createBooking({
    workspaceId: branding.workspaceId,
    spaceId,
    range,
    customerType: "NON_MEMBER",
    memberId: null,
    userId: user.id,
    contactName,
    contactEmail: String(formData.get("contactEmail") ?? user.email ?? "").trim(),
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    freeMinutesAvailable: 0,
    paymentMethod: "MERCADO_PAGO",
    createdByUserId: null,
    extraLines: lineas,
  });

  if (!r.ok) volver(`error=${encodeURIComponent(r.error)}`);
  const creada = r as Extract<typeof r, { ok: true }>;

  if (creada.status === "PENDING_APPROVAL") {
    volver("enviada=1");
  }

  const totalMinor = quote.totalMinor + extrasTotalMinor(extras, elegidos);
  if (totalMinor === 0 || creada.status === "CONFIRMED") {
    volver("ok=1");
  }

  const checkout = await startBookingCheckout({
    workspaceId: branding.workspaceId,
    bookingId: creada.bookingId,
    payerEmail: user.email ?? "",
    returnPath: base,
  });
  if (!checkout.ok) volver(`error=${encodeURIComponent(checkout.error)}`);
  redirect((checkout as Extract<typeof checkout, { ok: true }>).checkoutUrl);
}
