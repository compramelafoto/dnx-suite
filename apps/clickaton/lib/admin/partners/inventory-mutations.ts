"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cancelInventoryBooking,
  confirmInventorySale,
  extendInventoryReservation,
  reserveInventorySlot,
} from "@repo/db/partners-inventory-bookings";
import {
  DNX_INVENTORY,
  type DnxPartnerAdPlacementKey,
} from "@repo/partners";
import { requireClickatonAdmin } from "@/lib/admin/auth";

/**
 * Tomar, confirmar, extender y liberar lugares del inventario publicitario.
 *
 * El permiso es el del panel: `requireClickatonAdmin` ya implica el bundle
 * completo de operaciones sobre partners —lo declara `toPartnerActor`—, así que
 * quien entra acá es quien gestiona participaciones.
 */

const RUTA = "/admin/sponsors/inventario";

/** Vuelve a la pantalla con un mensaje, sin perder el contexto de lo que pasó. */
function volver(mensaje: string, tipo: "ok" | "error"): never {
  redirect(`${RUTA}?${tipo}=${encodeURIComponent(mensaje)}`);
}

/** Lee una fecha `AAAA-MM-DD` del formulario. */
function leerFecha(valor: FormDataEntryValue | null): Date | null {
  const texto = String(valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function espacioDelCatalogo(placementKey: string) {
  return DNX_INVENTORY.find((e) => e.placementKey === placementKey) ?? null;
}

export async function reservarLugarAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();

  const partnerId = String(formData.get("partnerId") ?? "").trim();
  const placementKey = String(formData.get("placementKey") ?? "").trim();
  const contextId = String(formData.get("contextId") ?? "").trim() || null;
  const desde = leerFecha(formData.get("startsAt"));
  const hasta = leerFecha(formData.get("endsAt"));

  if (!partnerId) volver("Elegí la marca.", "error");

  const espacio = espacioDelCatalogo(placementKey);
  if (!espacio) volver("Ese espacio no está en el catálogo.", "error");

  if (!desde || !hasta) volver("Faltan las fechas de vigencia.", "error");
  if (hasta.getTime() <= desde.getTime()) {
    volver("La fecha de fin tiene que ser posterior a la de inicio.", "error");
  }

  // Un espacio de contexto sin contexto tomaría el lugar de todos los concursos.
  const necesitaContexto = espacio.contextType !== "GLOBAL";
  if (necesitaContexto && !contextId) {
    volver("Este espacio es de un concurso o evento: indicá cuál.", "error");
  }

  const resultado = await reserveInventorySlot({
    placementKey: placementKey as DnxPartnerAdPlacementKey,
    contextType: espacio.contextType,
    contextId,
    partnerId,
    range: { startsAt: desde, endsAt: hasta },
    now: new Date(),
    createdByUserId: user.id,
  });

  if (!resultado.ok) {
    const cuando = resultado.nextFreeAt
      ? ` Se libera el ${resultado.nextFreeAt.toLocaleDateString("es-AR")}.`
      : "";
    volver(`No queda lugar en ese espacio para ese período.${cuando}`, "error");
  }

  revalidatePath(RUTA);
  volver(
    `Lugar ${resultado.slotIndex + 1} reservado hasta el ${resultado.expiresAt.toLocaleDateString("es-AR")}.`,
    "ok",
  );
}

export async function confirmarVentaAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  if (!bookingId) volver("Falta la ocupación.", "error");

  const resultado = await confirmInventorySale({ bookingId, updatedByUserId: user.id });
  if (!resultado.ok) {
    const motivos = {
      not_found: "No se encontró esa ocupación.",
      not_reservable: "Esa ocupación ya no se puede confirmar.",
      slot_taken: "El lugar se ocupó mientras tanto. Volvé a reservar.",
    } as const;
    volver(motivos[resultado.reason], "error");
  }

  revalidatePath(RUTA);
  volver("Venta confirmada.", "ok");
}

export async function extenderReservaAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  if (!bookingId) volver("Falta la ocupación.", "error");

  const resultado = await extendInventoryReservation({
    bookingId,
    now: new Date(),
    extendedByUserId: user.id,
  });
  if (!resultado.ok) {
    volver(
      resultado.reason === "not_found"
        ? "No se encontró esa ocupación."
        : "Solo se extienden las reservas.",
      "error",
    );
  }

  revalidatePath(RUTA);
  volver(`Reserva extendida hasta el ${resultado.expiresAt.toLocaleDateString("es-AR")}.`, "ok");
}

export async function liberarLugarAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  if (!bookingId) volver("Falta la ocupación.", "error");

  const resultado = await cancelInventoryBooking({ bookingId, updatedByUserId: user.id });
  if (!resultado.ok) {
    volver(
      resultado.reason === "not_found"
        ? "No se encontró esa ocupación."
        : "Esa ocupación ya estaba cancelada.",
      "error",
    );
  }

  revalidatePath(RUTA);
  volver("Lugar liberado.", "ok");
}
