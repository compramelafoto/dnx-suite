/**
 * Servicio de visibilidad y sanitización de pedidos por rol/estado.
 * Garantiza que fotógrafo y laboratorio no vean datos sensibles hasta pago aprobado.
 */

import { Role } from "@prisma/client";

export type OrderType = "PRINT_ORDER" | "ALBUM_ORDER";

export interface VisibilityUser {
  id: number;
  role: Role;
  labId?: number;
}

export interface VisibilityContext {
  canViewOrder: boolean;
  canViewCustomerData: boolean;
  canViewOrderItems: boolean;
  canViewFileKeys: boolean;
  canChangeStatus: boolean;
  isAdmin: boolean;
  isOwnOrder: boolean;
  paymentApproved: boolean;
}

/** Determina qué puede ver el usuario sobre el pedido */
export function getOrderVisibilityContext(
  user: VisibilityUser,
  order: {
    orderType: OrderType;
    paymentStatus?: string;
    status?: string;
    photographerId?: number | null;
    labId?: number | null;
    album?: { userId: number } | null;
  }
): VisibilityContext {
  const isAdmin = user.role === "ADMIN";
  const paymentApproved =
    order.paymentStatus === "PAID" || order.status === "PAID";

  // Admin ve todo siempre
  if (isAdmin) {
    return {
      canViewOrder: true,
      canViewCustomerData: true,
      canViewOrderItems: true,
      canViewFileKeys: true,
      canChangeStatus: true,
      isAdmin: true,
      isOwnOrder: true,
      paymentApproved,
    };
  }

  // Verificar si es pedido propio
  let isOwnOrder = false;
  if (order.orderType === "PRINT_ORDER") {
    isOwnOrder =
      order.photographerId === user.id ||
      (user.labId != null && order.labId === user.labId);
  } else {
    isOwnOrder = order.album?.userId === user.id;
  }

  if (!isOwnOrder) {
    return {
      canViewOrder: false,
      canViewCustomerData: false,
      canViewOrderItems: false,
      canViewFileKeys: false,
      canChangeStatus: false,
      isAdmin: false,
      isOwnOrder: false,
      paymentApproved,
    };
  }

  // Lab: solo ve pedidos pagados que le corresponden
  if (user.role === "LAB" || user.role === "LAB_PHOTOGRAPHER") {
    if (order.labId !== user.labId) {
      return {
        canViewOrder: false,
        canViewCustomerData: false,
        canViewOrderItems: false,
        canViewFileKeys: false,
        canChangeStatus: false,
        isAdmin: false,
        isOwnOrder: false,
        paymentApproved,
      };
    }
    return {
      canViewOrder: paymentApproved,
      canViewCustomerData: paymentApproved,
      canViewOrderItems: paymentApproved,
      canViewFileKeys: paymentApproved,
      canChangeStatus: paymentApproved,
      isAdmin: false,
      isOwnOrder: true,
      paymentApproved,
    };
  }

  // Fotógrafo: puede ver pedido propio pero datos sensibles solo si pagado
  return {
    canViewOrder: true,
    canViewCustomerData: paymentApproved,
    canViewOrderItems: paymentApproved,
    canViewFileKeys: paymentApproved,
    canChangeStatus: paymentApproved,
    isAdmin: false,
    isOwnOrder: true,
    paymentApproved,
  };
}

/** Indica si el usuario puede ver datos del cliente */
export function canViewCustomerData(
  user: VisibilityUser,
  order: {
    orderType: OrderType;
    paymentStatus?: string;
    status?: string;
    photographerId?: number | null;
    labId?: number | null;
    album?: { userId: number } | null;
  }
): boolean {
  return getOrderVisibilityContext(user, order).canViewCustomerData;
}

/** Indica si el usuario puede ver items/detalle del pedido */
export function canViewOrderItems(
  user: VisibilityUser,
  order: {
    orderType: OrderType;
    paymentStatus?: string;
    status?: string;
    photographerId?: number | null;
    labId?: number | null;
    album?: { userId: number } | null;
  }
): boolean {
  return getOrderVisibilityContext(user, order).canViewOrderItems;
}

/** Indica si el pedido debe liberarse al laboratorio (visible en su cola) */
export function shouldReleaseToLab(order: {
  paymentStatus?: string;
  labId?: number | null;
}): boolean {
  return order.paymentStatus === "PAID" && order.labId != null;
}

/** Campos sensibles que no deben exponerse antes del pago */
const SENSITIVE_CUSTOMER_FIELDS = [
  "customerName",
  "customerEmail",
  "customerPhone",
  "buyerEmail",
  "buyerUserId",
  "clientId",
] as const;

/** Campos de items sensibles (fileKey, etc.) */
const SENSITIVE_ITEM_FIELDS = ["fileKey", "originalName", "meta"] as const;

/** Sanitiza un pedido para el rol: oculta datos sensibles si no está pagado */
export function sanitizeOrderForRole<T extends Record<string, unknown>>(
  order: T,
  ctx: VisibilityContext,
  options?: { includeItems?: boolean }
): T {
  if (ctx.canViewCustomerData && ctx.canViewOrderItems) {
    return order;
  }

  const out = { ...order } as T;

  if (!ctx.canViewCustomerData) {
    for (const key of SENSITIVE_CUSTOMER_FIELDS) {
      if (key in out) {
        (out as Record<string, unknown>)[key] = "[Protegido hasta acreditación del pago]";
      }
    }
  }

  if (!ctx.canViewOrderItems && options?.includeItems !== false) {
    const items = (out as Record<string, unknown>).items;
    if (Array.isArray(items)) {
      (out as Record<string, unknown>).items = items.map((it: Record<string, unknown>) => {
        const sanitized = { ...it };
        for (const key of SENSITIVE_ITEM_FIELDS) {
          if (key in sanitized) {
            sanitized[key] = "[Protegido]";
          }
        }
        return sanitized;
      });
    }
  }

  if (!ctx.canViewFileKeys && Array.isArray((out as Record<string, unknown>).items)) {
    (out as Record<string, unknown>).items = (
      (out as Record<string, unknown>).items as Record<string, unknown>[]
    ).map((it) => {
      const s = { ...it };
      if ("fileKey" in s) s.fileKey = "[Protegido]";
      if ("originalName" in s) s.originalName = "[Protegido]";
      return s;
    });
  }

  return out;
}
