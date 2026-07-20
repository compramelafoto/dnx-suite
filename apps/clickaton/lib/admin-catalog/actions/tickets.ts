"use server";

import { revalidatePath } from "next/cache";
import { catalogAdminRoutes } from "../design/routes";
import type {
  AvailabilityRecord,
  TicketTypeFilters,
  TicketTypeItemInput,
  TicketTypeRecord,
} from "../domain/types";
import { CatalogValidationError } from "../domain/errors";
import { pesosInputToMinorUnits } from "../ui/money-ui";
import {
  catalogFailure,
  catalogSuccess,
  formString,
  type CatalogActionState,
} from "./action-result";
import { getCatalogService, resolveCatalogActor } from "./runtime";

function revalidateTicketPaths(ticketTypeId?: string, productIds: string[] = []) {
  const paths = [
    catalogAdminRoutes.hub,
    catalogAdminRoutes.tickets,
    catalogAdminRoutes.ticketNew,
    catalogAdminRoutes.products,
    ...(ticketTypeId ? [catalogAdminRoutes.ticketDetail(ticketTypeId)] : []),
    ...productIds.map((id) => catalogAdminRoutes.productDetail(id)),
  ];
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Fuera de request Next (selfcheck).
    }
  }
}

function parseUnlimitedCapacity(formData: FormData): unknown {
  if (formData.get("unlimitedCapacity") === "on" || formData.get("unlimitedCapacity") === "true") {
    return null;
  }
  return formString(formData, "capacity");
}

export async function listTicketTypesAction(
  filters: TicketTypeFilters,
): Promise<CatalogActionState<TicketTypeRecord[]>> {
  try {
    const actor = await resolveCatalogActor();
    const data = await getCatalogService().listTicketTypes(actor, filters);
    return catalogSuccess(data);
  } catch (error) {
    return catalogFailure<TicketTypeRecord[]>(error);
  }
}

export async function getTicketTypeAction(
  ticketTypeId: string,
): Promise<CatalogActionState<TicketTypeRecord>> {
  try {
    const actor = await resolveCatalogActor();
    const data = await getCatalogService().getTicketType(actor, ticketTypeId);
    return catalogSuccess(data);
  } catch (error) {
    return catalogFailure<TicketTypeRecord>(error);
  }
}

export async function getCatalogAvailabilityAction(
  editionId: string,
  ticketTypeIds?: string[],
): Promise<CatalogActionState<AvailabilityRecord[]>> {
  try {
    const actor = await resolveCatalogActor();
    const data = await getCatalogService().getCatalogAvailability(
      actor,
      editionId,
      ticketTypeIds,
    );
    return catalogSuccess(data);
  } catch (error) {
    return catalogFailure<AvailabilityRecord[]>(error);
  }
}

export async function createTicketTypeAction(
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState<TicketTypeRecord>> {
  const editionId = formString(formData, "editionId");
  const name = formString(formData, "name");
  const description = formString(formData, "description");
  const code = formString(formData, "code");
  const pricePesos = formString(formData, "pricePesos");
  const currency = formString(formData, "currency") || "ARS";
  const salesStartAt = formString(formData, "salesStartAt");
  const salesEndAt = formString(formData, "salesEndAt");
  const holdMinutes = formString(formData, "holdMinutes");
  const venueId = formString(formData, "venueId");
  const values = {
    editionId,
    name,
    description,
    code,
    pricePesos,
    currency,
    capacity: formString(formData, "capacity"),
    salesStartAt,
    salesEndAt,
    holdMinutes,
    venueId,
  };
  try {
    const actor = await resolveCatalogActor();
    const priceAmount = pesosInputToMinorUnits(pricePesos, "pricePesos");
    const created = await getCatalogService().createTicketType(actor, {
      editionId,
      venueId: venueId || null,
      name,
      description: description || null,
      code,
      priceAmount,
      currency,
      capacity: parseUnlimitedCapacity(formData),
      holdMinutes: holdMinutes || undefined,
      isActive: formData.has("isActive"),
      salesStartAt: salesStartAt || null,
      salesEndAt: salesEndAt || null,
      items: [],
    });
    revalidateTicketPaths(created.id);
    return catalogSuccess(created, "Entrada creada.");
  } catch (error) {
    return catalogFailure<TicketTypeRecord>(error, values);
  }
}

export async function updateTicketTypeAction(
  ticketTypeId: string,
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState<TicketTypeRecord>> {
  const name = formString(formData, "name");
  const description = formString(formData, "description");
  const code = formString(formData, "code");
  const pricePesos = formString(formData, "pricePesos");
  const currency = formString(formData, "currency") || "ARS";
  const salesStartAt = formString(formData, "salesStartAt");
  const salesEndAt = formString(formData, "salesEndAt");
  const holdMinutes = formString(formData, "holdMinutes");
  const venueId = formString(formData, "venueId");
  const values = {
    name,
    description,
    code,
    pricePesos,
    currency,
    capacity: formString(formData, "capacity"),
    salesStartAt,
    salesEndAt,
    holdMinutes,
    venueId,
  };
  try {
    const actor = await resolveCatalogActor();
    const priceAmount = pesosInputToMinorUnits(pricePesos, "pricePesos");
    const updated = await getCatalogService().updateTicketType(actor, ticketTypeId, {
      name,
      description: description || null,
      code,
      priceAmount,
      currency,
      capacity: parseUnlimitedCapacity(formData),
      holdMinutes: holdMinutes || 20,
      venueId: venueId || null,
      salesStartAt: salesStartAt || null,
      salesEndAt: salesEndAt || null,
    });
    revalidateTicketPaths(ticketTypeId);
    return catalogSuccess(updated, "Entrada actualizada.");
  } catch (error) {
    return catalogFailure<TicketTypeRecord>(error, values);
  }
}

export async function setTicketTypeActiveAction(
  ticketTypeId: string,
  isActive: boolean,
): Promise<CatalogActionState<TicketTypeRecord>> {
  try {
    const actor = await resolveCatalogActor();
    const updated = await getCatalogService().setTicketTypeActive(
      actor,
      ticketTypeId,
      isActive,
    );
    revalidateTicketPaths(ticketTypeId);
    return catalogSuccess(
      updated,
      isActive ? "Entrada reactivada." : "Entrada desactivada.",
    );
  } catch (error) {
    return catalogFailure<TicketTypeRecord>(error);
  }
}

function itemsToInput(ticket: TicketTypeRecord): TicketTypeItemInput[] {
  return ticket.items.map((i) => ({
    productId: i.productId,
    productVariantId: i.productVariantId ?? null,
    quantity: i.quantity,
    requiresVariantChoice: i.requiresVariantChoice,
  }));
}

/** Agrega un producto a la composición (replace-all interno). No toca stock. */
export async function addTicketProductAction(
  ticketTypeId: string,
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState<TicketTypeRecord>> {
  const productId = formString(formData, "productId");
  const productVariantId = formString(formData, "productVariantId");
  const quantityRaw = formString(formData, "quantity");
  const requiresVariantChoice = formData.has("requiresVariantChoice");
  const values = {
    productId,
    productVariantId,
    quantity: quantityRaw,
    requiresVariantChoice: requiresVariantChoice ? "on" : "",
  };
  try {
    const actor = await resolveCatalogActor();
    const svc = getCatalogService();
    const ticket = await svc.getTicketType(actor, ticketTypeId);
    if (ticket.items.some((i) => i.productId === productId)) {
      throw new CatalogValidationError({
        productId: "Ese producto ya está en la composición.",
      });
    }
    const quantity = Number.parseInt(quantityRaw || "1", 10);
    const next = [
      ...itemsToInput(ticket),
      {
        productId,
        productVariantId: requiresVariantChoice ? null : productVariantId || null,
        quantity,
        requiresVariantChoice,
      },
    ];
    const updated = await svc.replaceTicketTypeItems(actor, ticketTypeId, next);
    revalidateTicketPaths(ticketTypeId, [productId]);
    return catalogSuccess(updated, "Producto agregado al kit.");
  } catch (error) {
    return catalogFailure<TicketTypeRecord>(error, values);
  }
}

export async function updateTicketProductAction(
  ticketTypeId: string,
  productId: string,
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState<TicketTypeRecord>> {
  const quantityRaw = formString(formData, "quantity");
  const productVariantId = formString(formData, "productVariantId");
  const requiresVariantChoice = formData.has("requiresVariantChoice");
  const values = { quantity: quantityRaw, productVariantId };
  try {
    const actor = await resolveCatalogActor();
    const svc = getCatalogService();
    const ticket = await svc.getTicketType(actor, ticketTypeId);
    if (!ticket.items.some((i) => i.productId === productId)) {
      throw new CatalogValidationError({ productId: "Producto no está en la composición." });
    }
    const quantity = Number.parseInt(quantityRaw || "0", 10);
    const next = itemsToInput(ticket).map((i) =>
      i.productId === productId
        ? {
            ...i,
            quantity,
            productVariantId: requiresVariantChoice ? null : productVariantId || i.productVariantId,
            requiresVariantChoice,
          }
        : i,
    );
    const updated = await svc.replaceTicketTypeItems(actor, ticketTypeId, next);
    revalidateTicketPaths(ticketTypeId, [productId]);
    return catalogSuccess(updated, "Composición actualizada.");
  } catch (error) {
    return catalogFailure<TicketTypeRecord>(error, values);
  }
}

export async function removeTicketProductAction(
  ticketTypeId: string,
  productId: string,
): Promise<CatalogActionState<TicketTypeRecord>> {
  try {
    const actor = await resolveCatalogActor();
    const svc = getCatalogService();
    const ticket = await svc.getTicketType(actor, ticketTypeId);
    const next = itemsToInput(ticket).filter((i) => i.productId !== productId);
    const updated = await svc.replaceTicketTypeItems(actor, ticketTypeId, next);
    revalidateTicketPaths(ticketTypeId, [productId]);
    return catalogSuccess(updated, "Producto quitado de la composición.");
  } catch (error) {
    return catalogFailure<TicketTypeRecord>(error);
  }
}
