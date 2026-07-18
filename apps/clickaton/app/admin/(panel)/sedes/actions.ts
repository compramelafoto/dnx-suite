"use server";

import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";
import {
  createVenueAction as createVenue,
  updateVenueAction as updateVenue,
} from "@/lib/admin/venues/mutations";

export async function createVenueFormAction(
  prev: Awaited<ReturnType<typeof createVenue>> | undefined,
  formData: FormData,
) {
  const result = await createVenue(prev, formData);
  if (result.ok) {
    const editionId = formData.get("editionId")?.toString();
    if (editionId) {
      redirect(`${adminRoutes.editions}/${editionId}?flash=venue_created`);
    }
    redirect(`${adminRoutes.venues}?flash=venue_created`);
  }
  return result;
}

export async function updateVenueFormAction(
  venueId: string,
  prev: Awaited<ReturnType<typeof updateVenue>> | undefined,
  formData: FormData,
) {
  const result = await updateVenue(venueId, prev, formData);
  if (result.ok) {
    redirect(`${adminRoutes.venues}/${venueId}?flash=venue_updated`);
  }
  return result;
}

export async function createVenueForEditionFormAction(
  editionId: string,
  prev: Awaited<ReturnType<typeof createVenue>> | undefined,
  formData: FormData,
) {
  formData.set("editionId", editionId);
  return createVenueFormAction(prev, formData);
}
