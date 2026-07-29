import { revalidatePath, revalidateTag } from "next/cache";

/** Revalidación de rutas de eventos (no es Server Action). */
export function revalidateEventPaths(slug?: string, eventId?: string) {
  revalidatePath("/redaccion");
  revalidatePath("/redaccion/eventos");
  revalidatePath("/admin/eventos");
  revalidatePath("/");
  revalidatePath("/eventos");
  revalidatePath("/redaccion/distribucion");
  revalidateTag("infospot-home", "max");
  revalidateTag("infospot-home-core", "max");
  revalidateTag("infospot-home-calls", "max");
  revalidateTag("infospot-home-feed", "max");
  revalidateTag("infospot-public-content", "max");
  if (eventId) {
    revalidateTag(`infospot-feed-item:event:${eventId}`, "max");
  }
  if (slug) revalidatePath(`/eventos/${slug}`);
  if (eventId) {
    revalidatePath(`/redaccion/eventos/${eventId}/editar`);
    revalidatePath(`/admin/eventos/${eventId}`);
  }
}
