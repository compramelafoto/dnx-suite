"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { BOOKINGS_TIME_ZONE } from "@/lib/bookings/time";
import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { loadPortalOffer, totalForBooking } from "@/lib/bookings/portal";
import { anyRequiresConfirmation, extrasTotalMinor } from "@/lib/bookings/extras";
import { quoteBooking } from "@/lib/bookings/pricing";
import { createBooking, type BookingExtraLineInput } from "@/lib/bookings/create";
import { startBookingCheckout } from "@/lib/bookings/checkout";
import { cancelBooking } from "@/lib/bookings/create";
import { canCancelByCustomer } from "@/lib/bookings/lifecycle";
import { getBookingSettings } from "@/lib/bookings/repository";
import { prisma } from "@repo/db";

const PORTAL = "/portal/reservas";

/**
 * El socio reserva.
 *
 * **Todo se vuelve a calcular acá con los datos de este instante.** Lo que tenía la
 * pantalla puede estar viejo: otro socio pudo tomar el horario, o el último flash. El
 * formulario propone; el servidor decide.
 */
export async function createPortalBookingAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");

  if (!(await isModuleEnabledForWorkspace(context.workspace.id, BOOKINGS_MODULE_KEY))) {
    redirect("/portal");
  }

  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const startAt = parseLocalDateTime(String(formData.get("startAt") ?? ""), BOOKINGS_TIME_ZONE);
  const endAt = parseLocalDateTime(String(formData.get("endAt") ?? ""), BOOKINGS_TIME_ZONE);
  const elegidos = formData.getAll("extraIds").map((v) => String(v));

  const volver = (params: string) => redirect(`${PORTAL}?espacio=${spaceId}&${params}`);

  if (!spaceId || startAt === null || endAt === null) {
    volver(`error=${encodeURIComponent("Elegí un horario antes de reservar.")}`);
  }

  const range = { startAt: startAt as Date, endAt: endAt as Date };

  const oferta = await loadPortalOffer({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
    spaceId,
    range,
    customerType: "MEMBER",
  });
  if (!oferta) volver(`error=${encodeURIComponent("Ese espacio ya no está disponible.")}`);

  const { space, freeHours, extras } = oferta as NonNullable<typeof oferta>;

  const minutos = (range.endAt.getTime() - range.startAt.getTime()) / 60_000;
  const quote = quoteBooking({
    minutes: minutos,
    customerType: "MEMBER",
    memberHourlyPriceMinor: space.memberHourlyPriceMinor,
    nonMemberHourlyPriceMinor: space.nonMemberHourlyPriceMinor,
    freeMinutesAvailable: freeHours.availableMinutes,
  });

  // Solo los elegidos que además están disponibles. Un agotado se descarta en silencio: la
  // pantalla ya lo mostraba agotado, y fallar entera por eso sería peor que reservar sin él.
  const lineas: BookingExtraLineInput[] = extras
    .filter((o) => elegidos.includes(o.extra.id) && o.available)
    .map((o) => ({
      extraId: o.extra.id,
      nameSnapshot: o.extra.name,
      priceMode: o.extra.priceMode,
      // El precio unitario del socio. Qué se hace con él —una vez o por hora— lo decide
      // `priceMode`, y `amountMinor` ya viene con esa cuenta hecha por `offerExtras`.
      unitPriceMinor: o.extra.memberPriceMinor,
      unitsConsumed: o.extra.unitsConsumed,
      amountMinor: o.amountMinor,
      status: o.extra.requiresConfirmation ? "PENDING_CONFIRMATION" : "CONFIRMED",
    }));

  const extrasMinor = extrasTotalMinor(extras, elegidos);
  const total = totalForBooking({ quote, extrasMinor });
  const aConfirmar = anyRequiresConfirmation(extras, elegidos);

  const r = await createBooking({
    workspaceId: context.workspace.id,
    spaceId,
    range,
    customerType: "MEMBER",
    memberId: context.member.id,
    userId: user.id,
    contactName: `${context.member.firstName} ${context.member.lastName}`.trim(),
    contactEmail: user.email ?? "",
    contactPhone: null,
    freeMinutesAvailable: freeHours.availableMinutes,
    paymentMethod: String(formData.get("paymentMethod") ?? "MERCADO_PAGO"),
    createdByUserId: null,
    extraLines: lineas,
  });

  if (!r.ok) volver(`error=${encodeURIComponent(r.error)}`);
  const creada = r as Extract<typeof r, { ok: true }>;

  revalidatePath(PORTAL);

  // Lo que hay que coordinar NO se cobra todavía: la Secretaría confirma o quita el extra,
  // y recién ahí sale el enlace de pago con el total definitivo.
  if (aConfirmar || creada.status === "PENDING_APPROVAL") {
    redirect(`${PORTAL}?enviada=1`);
  }
  if (total === 0 || creada.status === "CONFIRMED") {
    redirect(`${PORTAL}?ok=1`);
  }

  const checkout = await startBookingCheckout({
    workspaceId: context.workspace.id,
    bookingId: creada.bookingId,
    payerEmail: user.email ?? "",
    returnPath: PORTAL,
  });
  if (!checkout.ok) volver(`error=${encodeURIComponent(checkout.error)}`);
  redirect((checkout as Extract<typeof checkout, { ok: true }>).checkoutUrl);
}

/**
 * El socio cancela una reserva suya.
 *
 * **No devuelve dinero.** Si estaba paga, la devolución la resuelve la institución por
 * fuera. La pantalla se lo dice antes de que confirme.
 */
export async function cancelPortalBookingAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");

  const bookingId = String(formData.get("bookingId") ?? "").trim();

  const reserva = await prisma.booking.findFirst({
    where: { id: bookingId, workspaceId: context.workspace.id, memberId: context.member.id },
    select: { id: true, startAt: true, status: true },
  });
  if (!reserva) redirect(`${PORTAL}?error=${encodeURIComponent("No encontramos esa reserva.")}`);

  const settings = await getBookingSettings(context.workspace.id);
  const puede = canCancelByCustomer({
    startAt: reserva.startAt,
    status: reserva.status,
    cancelWindowHours: settings.cancelWindowHours,
    now: new Date(),
  });
  if (!puede.ok) redirect(`${PORTAL}?error=${encodeURIComponent(puede.motivo)}`);

  const r = await cancelBooking({
    workspaceId: context.workspace.id,
    bookingId: reserva.id,
    byUserId: user.id,
    reason: "Cancelada por el socio",
  });

  revalidatePath(PORTAL);
  redirect(r.ok ? `${PORTAL}?ok=cancelada` : `${PORTAL}?error=${encodeURIComponent(r.error ?? "")}`);
}
