"use server";

import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";
import {
  createEditionAction as createEdition,
  updateEditionAction as updateEdition,
} from "@/lib/admin/editions/mutations";

export async function createEditionFormAction(
  prev: Awaited<ReturnType<typeof createEdition>> | undefined,
  formData: FormData,
) {
  const result = await createEdition(prev, formData);
  if (result.ok) {
    redirect(`${adminRoutes.editions}?flash=edition_created`);
  }
  return result;
}

export async function updateEditionFormAction(
  editionId: string,
  prev: Awaited<ReturnType<typeof updateEdition>> | undefined,
  formData: FormData,
) {
  const result = await updateEdition(editionId, prev, formData);
  if (result.ok) {
    redirect(`${adminRoutes.editions}/${editionId}?flash=edition_updated`);
  }
  return result;
}
