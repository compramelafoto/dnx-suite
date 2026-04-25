import type { ContestPrizeItem, PrizeType, RewardType } from "../../../../../../lib/fotorank/prizesRewards";

export const PRIZE_TYPES: Array<{ value: PrizeType; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "TROPHY", label: "Trofeo" },
  { value: "DIPLOMA", label: "Diploma" },
  { value: "CERTIFICATE", label: "Certificado" },
  { value: "PHYSICAL_PRODUCT", label: "Producto físico" },
  { value: "DIGITAL_PRODUCT", label: "Producto digital" },
  { value: "SCHOLARSHIP", label: "Beca" },
  { value: "PROMOTION", label: "Difusión" },
  { value: "DISCOUNT", label: "Descuento" },
  { value: "SPONSOR_BENEFIT", label: "Beneficio sponsor" },
  { value: "OTHER", label: "Otro" },
];

export const REWARD_TYPES: Array<{ value: RewardType; label: string }> = [
  { value: "DISCOUNT", label: "Descuento" },
  { value: "COUPON", label: "Cupón" },
  { value: "COURSE_ACCESS", label: "Acceso a curso" },
  { value: "MEMBERSHIP", label: "Membresía" },
  { value: "GIFT_CARD", label: "Gift card" },
  { value: "FEATURED_PUBLICATION", label: "Publicación destacada" },
  { value: "SPONSOR_BENEFIT", label: "Beneficio sponsor" },
  { value: "OTHER", label: "Otro" },
];

export const SCOPE_LABEL: Record<ContestPrizeItem["scope"], string> = {
  GENERAL: "General",
  CATEGORY: "Por categoría",
  POSITION: "Por puesto",
  MENTION: "Mención",
};

export const RECIPIENT_LABEL: Record<import("../../../../../../lib/fotorank/prizesRewards").ContestRewardItem["recipients"], string> = {
  ALL: "Todos los participantes",
  FINALISTS: "Finalistas",
  WINNERS: "Ganadores",
  CATEGORY: "Categoría específica",
};

export const DELIVERY_LABEL: Record<NonNullable<ContestPrizeItem["deliveryStatus"]>, string> = {
  PENDING: "Pendiente",
  ANNOUNCED: "Anunciado",
  ASSIGNED: "Asignado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function prizeTypeLabel(v: PrizeType): string {
  return PRIZE_TYPES.find((x) => x.value === v)?.label ?? v;
}

export function rewardTypeLabel(v: RewardType): string {
  return REWARD_TYPES.find((x) => x.value === v)?.label ?? v;
}
