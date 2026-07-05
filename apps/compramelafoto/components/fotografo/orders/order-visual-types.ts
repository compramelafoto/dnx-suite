import type { PhotographerOrderRow } from "./photographer-order-types";
import { getOrderTypeBadgeVariant } from "./photographer-order-types";

export type OrderVisualPlaceholderKind =
  | "protected"
  | "digital"
  | "print"
  | "mixed"
  | "preventa"
  | "video"
  | "generic";

export type OrderVisualData = {
  thumbUrl: string | null;
  galleryUrls: string[];
  placeholder: OrderVisualPlaceholderKind;
  initials: string;
  loading: boolean;
  loaded: boolean;
};

export function getOrderVisualInitials(order: PhotographerOrderRow): string {
  const name = order.customerName?.trim();
  if (!name || name.includes("Protegido")) return `#${order.id}`;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? `#${order.id}`).toUpperCase();
}

export function getOrderPlaceholderKind(order: PhotographerOrderRow): OrderVisualPlaceholderKind {
  if (order._dataProtected) return "protected";
  const variant = getOrderTypeBadgeVariant(order);
  if (variant === "PREVENTA") return "preventa";
  if (variant === "VIDEO") return "video";
  if (variant === "MIXED") return "mixed";
  if (variant === "PRINT") return "print";
  if (variant === "DIGITAL") return "digital";
  return "generic";
}

export const PLACEHOLDER_GRADIENTS: Record<OrderVisualPlaceholderKind, string> = {
  protected: "from-slate-200 via-slate-100 to-amber-50",
  digital: "from-sky-100 via-indigo-50 to-violet-100",
  print: "from-orange-100 via-amber-50 to-rose-50",
  mixed: "from-violet-100 via-fuchsia-50 to-orange-50",
  preventa: "from-emerald-100 via-teal-50 to-cyan-50",
  video: "from-purple-100 via-violet-50 to-indigo-100",
  generic: "from-gray-100 via-stone-50 to-gray-200",
};

export function createInitialVisual(order: PhotographerOrderRow): OrderVisualData {
  return {
    thumbUrl: null,
    galleryUrls: [],
    placeholder: getOrderPlaceholderKind(order),
    initials: getOrderVisualInitials(order),
    loading: true,
    loaded: false,
  };
}
