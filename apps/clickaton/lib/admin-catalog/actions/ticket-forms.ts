"use server";

import { redirect } from "next/navigation";
import { catalogAdminRoutes } from "../design/routes";
import type { CatalogActionState } from "./action-result";
import {
  addTicketProductAction,
  createTicketTypeAction,
  updateTicketProductAction,
  updateTicketTypeAction,
} from "./tickets";

export async function createTicketTypeFormAction(
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await createTicketTypeAction(prev, formData);
  if (result.ok && result.data && typeof result.data === "object" && "id" in result.data) {
    redirect(
      `${catalogAdminRoutes.ticketDetail(String(result.data.id))}?flash=ticket_created`,
    );
  }
  return result;
}

export async function updateTicketTypeFormAction(
  ticketTypeId: string,
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await updateTicketTypeAction(ticketTypeId, prev, formData);
  if (result.ok) {
    redirect(`${catalogAdminRoutes.ticketDetail(ticketTypeId)}?flash=ticket_updated`);
  }
  return result;
}

export async function addTicketProductFormAction(
  ticketTypeId: string,
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await addTicketProductAction(ticketTypeId, prev, formData);
  if (result.ok) {
    redirect(`${catalogAdminRoutes.ticketDetail(ticketTypeId)}?flash=ticket_item_added`);
  }
  return result;
}

export async function updateTicketProductFormAction(
  ticketTypeId: string,
  productId: string,
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await updateTicketProductAction(ticketTypeId, productId, prev, formData);
  if (result.ok) {
    redirect(`${catalogAdminRoutes.ticketDetail(ticketTypeId)}?flash=ticket_item_updated`);
  }
  return result;
}
