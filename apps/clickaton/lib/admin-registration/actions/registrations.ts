"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import type {
  AdminRegistrationAction,
  AdminRegistrationDetail,
  AdminRegistrationFilters,
  AdminRegistrationListItem,
} from "../domain/types";
import {
  formString,
  regFailure,
  regSuccess,
  type AdminRegistrationActionState,
} from "./action-result";
import { getAdminRegistrationService, resolveAdminRegistrationActor } from "./runtime";

function revalidateRegistrationPaths(registrationId?: string) {
  const paths = [
    adminRoutes.registrations,
    adminRoutes.catalog,
    catalogAdminRoutes.hub,
    catalogAdminRoutes.tickets,
    ...(registrationId ? [`${adminRoutes.registrations}/${registrationId}`] : []),
  ];
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // selfcheck / fuera de request Next
    }
  }
}

export async function listRegistrationsAction(
  filters: AdminRegistrationFilters,
): Promise<AdminRegistrationActionState<AdminRegistrationListItem[]>> {
  try {
    const actor = await resolveAdminRegistrationActor();
    const data = await getAdminRegistrationService().listRegistrations(actor, filters);
    return regSuccess(data);
  } catch (error) {
    return regFailure<AdminRegistrationListItem[]>(error);
  }
}

export async function getRegistrationAction(
  registrationId: string,
): Promise<AdminRegistrationActionState<AdminRegistrationDetail>> {
  try {
    const actor = await resolveAdminRegistrationActor();
    const data = await getAdminRegistrationService().getRegistration(actor, registrationId);
    return regSuccess(data);
  } catch (error) {
    return regFailure<AdminRegistrationDetail>(error);
  }
}

export async function setRegistrationStatusAction(
  registrationId: string,
  action: AdminRegistrationAction,
  reason: string,
): Promise<AdminRegistrationActionState<AdminRegistrationDetail>> {
  try {
    const actor = await resolveAdminRegistrationActor();
    const result = await getAdminRegistrationService().transitionRegistration(actor, {
      registrationId,
      action,
      reason,
    });
    revalidateRegistrationPaths(registrationId);
    return regSuccess(result.registration, "Estado actualizado.");
  } catch (error) {
    return regFailure<AdminRegistrationDetail>(error);
  }
}

export async function updateItemFulfillmentAction(
  registrationId: string,
  _prev: AdminRegistrationActionState | undefined,
  formData: FormData,
): Promise<AdminRegistrationActionState<AdminRegistrationDetail>> {
  const registrationItemId = formString(formData, "registrationItemId");
  const nextStatus = formString(formData, "nextStatus") as
    | "PENDING"
    | "READY"
    | "DELIVERED"
    | "CANCELLED";
  const reason = formString(formData, "reason");
  const values = { registrationItemId, nextStatus, reason };
  try {
    const actor = await resolveAdminRegistrationActor();
    const data = await getAdminRegistrationService().updateItemFulfillment(actor, {
      registrationId,
      registrationItemId,
      nextStatus,
      reason,
    });
    revalidateRegistrationPaths(registrationId);
    return regSuccess(data, "Entrega de artículo actualizada.");
  } catch (error) {
    return regFailure<AdminRegistrationDetail>(error, values);
  }
}

export async function updateRegistrationAssignmentAction(
  registrationId: string,
  _prev: AdminRegistrationActionState | undefined,
  formData: FormData,
): Promise<AdminRegistrationActionState<AdminRegistrationDetail>> {
  const venueIdRaw = formString(formData, "venueId");
  const ticketTypeId = formString(formData, "ticketTypeId");
  const reason = formString(formData, "reason");
  const values = { venueId: venueIdRaw, ticketTypeId, reason };
  try {
    const actor = await resolveAdminRegistrationActor();
    const data = await getAdminRegistrationService().updateAssignment(actor, {
      registrationId,
      venueId: venueIdRaw || null,
      ticketTypeId,
      reason,
    });
    revalidateRegistrationPaths(registrationId);
    return regSuccess(data, "Asignación actualizada.");
  } catch (error) {
    return regFailure<AdminRegistrationDetail>(error, values);
  }
}

export async function addInternalNoteAction(
  registrationId: string,
  _prev: AdminRegistrationActionState | undefined,
  formData: FormData,
): Promise<AdminRegistrationActionState<AdminRegistrationDetail>> {
  const note = formString(formData, "note");
  try {
    const actor = await resolveAdminRegistrationActor();
    const data = await getAdminRegistrationService().addInternalNote(actor, {
      registrationId,
      note,
    });
    revalidateRegistrationPaths(registrationId);
    return regSuccess(data, "Nota agregada.");
  } catch (error) {
    return regFailure<AdminRegistrationDetail>(error, { note });
  }
}
