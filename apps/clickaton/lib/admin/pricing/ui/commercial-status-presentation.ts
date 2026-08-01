/**
 * Presentación comercial: fases, promociones y productos (Etapa 02 Imp. 07).
 * Solo deriva etiquetas; no recalcula precios ni vigencias.
 */
import type { PublicStatusTone } from "@/lib/public-ux/status-presentation";
import { displayRegistrationAmount } from "@/lib/admin-registration/ui/status-labels";

export type CommercialAttention = "ok" | "watch" | "action" | "blocked";

export type CommercialStatusPresentation = {
  key: string;
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: CommercialAttention;
  nextAction?: string;
  visible: boolean;
  vigente: boolean;
  editable: boolean;
  needsAttention: boolean;
};

export function commercialToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export function formatCommercialDateTime(
  value: Date | string | null | undefined,
  timezone = DEFAULT_TZ,
): string {
  if (value == null || value === "") return "Sin fecha";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function isWithinPhaseWindow(
  phase: { isActive: boolean; startsAt: Date; endsAt: Date },
  now: Date,
): boolean {
  if (!phase.isActive) return false;
  const t = now.getTime();
  return phase.startsAt.getTime() <= t && t <= phase.endsAt.getTime();
}

export function presentPricePhaseOperationalStatus(
  phase: { isActive: boolean; startsAt: Date; endsAt: Date },
  now: Date = new Date(),
): CommercialStatusPresentation {
  if (!phase.isActive) {
    return {
      key: "inactive",
      label: "Desactivada",
      description: "No puede utilizarse en nuevas inscripciones.",
      tone: "neutral",
      attention: "watch",
      nextAction: "Habilitá la fase cuando deba aplicarse.",
      visible: false,
      vigente: false,
      editable: true,
      needsAttention: false,
    };
  }
  if (isWithinPhaseWindow(phase, now)) {
    return {
      key: "active",
      label: "Vigente",
      description: "Es la configuración que se está aplicando actualmente.",
      tone: "success",
      attention: "ok",
      visible: true,
      vigente: true,
      editable: true,
      needsAttention: false,
    };
  }
  if (phase.startsAt.getTime() > now.getTime()) {
    return {
      key: "scheduled",
      label: "Programada",
      description: "Comenzará a aplicarse en la fecha indicada.",
      tone: "info",
      attention: "watch",
      nextAction: "Revisá el precio y los productos incluidos antes de la fecha.",
      visible: true,
      vigente: false,
      editable: true,
      needsAttention: false,
    };
  }
  return {
    key: "expired",
    label: "Finalizada",
    description: "El período de vigencia ya terminó.",
    tone: "neutral",
    attention: "ok",
    visible: false,
    vigente: false,
    editable: true,
    needsAttention: false,
  };
}

export type PriceComparePresentation = {
  currentLabel: string;
  currentAmountLabel: string;
  currentPhaseName: string | null;
  currentEndsLabel: string | null;
  nextAmountLabel: string | null;
  nextPhaseName: string | null;
  nextStartsLabel: string | null;
  showNextStruck: boolean;
  helper: string;
};

/**
 * Precio actual + próximo tachado cuando el siguiente es más caro
 * (lectura promocional: “ahora cuesta menos”).
 */
export function presentPriceCompare(input: {
  current: { name: string; amount: number; currency: string; endsAt: Date } | null;
  next: { name: string; amount: number; currency: string; startsAt: Date } | null;
  timezone?: string | null;
}): PriceComparePresentation {
  const tz = input.timezone ?? DEFAULT_TZ;
  if (!input.current) {
    return {
      currentLabel: "Sin precio vigente",
      currentAmountLabel: "—",
      currentPhaseName: null,
      currentEndsLabel: null,
      nextAmountLabel: input.next
        ? displayRegistrationAmount(input.next.amount, input.next.currency)
        : null,
      nextPhaseName: input.next?.name ?? null,
      nextStartsLabel: input.next
        ? formatCommercialDateTime(input.next.startsAt, tz)
        : null,
      showNextStruck: false,
      helper: "Todavía no hay una fase de precio vigente para nuevas inscripciones.",
    };
  }

  const showNextStruck = Boolean(
    input.next && input.next.amount > input.current.amount,
  );

  return {
    currentLabel: "Precio actual",
    currentAmountLabel: displayRegistrationAmount(
      input.current.amount,
      input.current.currency,
    ),
    currentPhaseName: input.current.name,
    currentEndsLabel: formatCommercialDateTime(input.current.endsAt, tz),
    nextAmountLabel: input.next
      ? displayRegistrationAmount(input.next.amount, input.next.currency)
      : null,
    nextPhaseName: input.next?.name ?? null,
    nextStartsLabel: input.next
      ? formatCommercialDateTime(input.next.startsAt, tz)
      : null,
    showNextStruck,
    helper: showNextStruck
      ? "El precio tachado es el de la próxima fase. Mientras esta fase esté vigente, la inscripción cuesta menos."
      : input.next
        ? "Hay una próxima fase programada. Revisá el importe y la fecha de inicio."
        : "No hay una próxima fase programada después de la actual.",
  };
}

export function presentPromotionDiscount(
  discountType: string,
  discountValue: number,
): { label: string; description: string } {
  if (discountType === "PERCENTAGE") {
    return {
      label: `${discountValue} % de descuento`,
      description: "Se descuenta un porcentaje del importe de la inscripción.",
    };
  }
  if (discountType === "FIXED_AMOUNT") {
    if (discountValue === 0) {
      return {
        label: "Sin descuento de importe",
        description: "El valor configurado es cero.",
      };
    }
    return {
      label: `${displayRegistrationAmount(discountValue, "ARS")} de descuento`,
      description: "Se descuenta un importe fijo. Pueden quedar otros cargos.",
    };
  }
  return {
    label: "Descuento configurado",
    description: "Revisá el tipo de descuento en información técnica.",
  };
}

export function presentPromotionOperationalStatus(input: {
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
  totalUsageLimit: number | null;
  activeUses: number;
  now?: Date;
}): CommercialStatusPresentation {
  const now = input.now ?? new Date();
  if (!input.isActive) {
    return {
      key: "promo_inactive",
      label: "Desactivada",
      description: "Los participantes no pueden utilizar este código en nuevas inscripciones.",
      tone: "neutral",
      attention: "watch",
      nextAction: "Volvé a habilitar el código si debe usarse.",
      visible: false,
      vigente: false,
      editable: true,
      needsAttention: false,
    };
  }
  if (
    input.totalUsageLimit != null &&
    input.activeUses >= input.totalUsageLimit
  ) {
    return {
      key: "promo_exhausted",
      label: "Agotada",
      description: "Este código alcanzó el límite de usos.",
      tone: "warning",
      attention: "action",
      visible: false,
      vigente: false,
      editable: true,
      needsAttention: true,
    };
  }
  if (input.startsAt.getTime() > now.getTime()) {
    return {
      key: "promo_scheduled",
      label: "Programada",
      description: "El código todavía no está dentro de su vigencia.",
      tone: "info",
      attention: "watch",
      visible: true,
      vigente: false,
      editable: true,
      needsAttention: false,
    };
  }
  if (input.endsAt.getTime() < now.getTime()) {
    return {
      key: "promo_expired",
      label: "Finalizada",
      description: "El período de vigencia del código ya terminó.",
      tone: "neutral",
      attention: "ok",
      visible: false,
      vigente: false,
      editable: true,
      needsAttention: false,
    };
  }
  return {
    key: "promo_available",
    label: "Disponible",
    description: "El código puede utilizarse en nuevas inscripciones según sus reglas.",
    tone: "success",
    attention: "ok",
    visible: true,
    vigente: true,
    editable: true,
    needsAttention: false,
  };
}

export function presentPromotionUsage(input: {
  activeUses: number;
  totalUses: number;
  totalUsageLimit: number | null;
}): { summary: string; remainingLabel: string } {
  if (input.totalUsageLimit == null) {
    return {
      summary: `${input.activeUses} uso${input.activeUses === 1 ? "" : "s"} activo${input.activeUses === 1 ? "" : "s"} · sin límite configurado`,
      remainingLabel: "Sin límite de usos configurado",
    };
  }
  const remaining = Math.max(0, input.totalUsageLimit - input.activeUses);
  return {
    summary: `${input.activeUses} de ${input.totalUsageLimit} usos utilizados`,
    remainingLabel:
      remaining === 0
        ? "Sin usos disponibles"
        : `Quedan ${remaining} uso${remaining === 1 ? "" : "s"} disponible${remaining === 1 ? "" : "s"}`,
  };
}

export function presentProductActiveStatus(isActive: boolean): CommercialStatusPresentation {
  if (isActive) {
    return {
      key: "product_active",
      label: "Activo",
      description: "El producto puede incluirse en fases y opciones de inscripción.",
      tone: "success",
      attention: "ok",
      visible: true,
      vigente: true,
      editable: true,
      needsAttention: false,
    };
  }
  return {
    key: "product_inactive",
    label: "Inactivo",
    description: "No debería ofrecerse en nuevas configuraciones hasta reactivarlo.",
    tone: "neutral",
    attention: "watch",
    nextAction: "Reactivá el producto si debe volver a usarse.",
    visible: false,
    vigente: false,
    editable: true,
    needsAttention: false,
  };
}

export function presentStoreStatus(status: string | null | undefined): CommercialStatusPresentation {
  switch (status) {
    case "DRAFT":
      return {
        key: "store_draft",
        label: "En preparación",
        description: "Todavía no está listo para una venta separada.",
        tone: "warning",
        attention: "watch",
        visible: false,
        vigente: false,
        editable: true,
        needsAttention: false,
      };
    case "ACTIVE":
      return {
        key: "store_active",
        label: "Disponible para venta separada",
        description: "Configurado para venta aparte, si esa función está habilitada.",
        tone: "success",
        attention: "ok",
        visible: true,
        vigente: true,
        editable: true,
        needsAttention: false,
      };
    case "OUT_OF_STOCK":
      return {
        key: "store_oos",
        label: "Sin stock",
        description: "No hay unidades disponibles para entregar o vender.",
        tone: "danger",
        attention: "action",
        visible: false,
        vigente: false,
        editable: true,
        needsAttention: true,
      };
    case "HIDDEN":
      return {
        key: "store_hidden",
        label: "Oculto",
        description: "No se muestra en superficies de venta.",
        tone: "neutral",
        attention: "watch",
        visible: false,
        vigente: false,
        editable: true,
        needsAttention: false,
      };
    case "ARCHIVED":
      return {
        key: "store_archived",
        label: "Archivado",
        description: "Quedó fuera del catálogo operativo.",
        tone: "neutral",
        attention: "ok",
        visible: false,
        vigente: false,
        editable: false,
        needsAttention: false,
      };
    default:
      return {
        key: "store_unknown",
        label: "Estado de tienda a revisar",
        description: "Hay un estado interno que conviene revisar en información técnica.",
        tone: "warning",
        attention: "action",
        visible: false,
        vigente: false,
        editable: true,
        needsAttention: true,
      };
  }
}

export function presentPromotionError(code: string | null | undefined): {
  title: string;
  description: string;
  nextStep: string;
} {
  switch (code) {
    case "NOT_FOUND":
    case "INVALID_CODE":
      return {
        title: "No encontramos ese código",
        description: "El código ingresado no existe o no está disponible.",
        nextStep: "Revisá que esté bien escrito e intentá nuevamente.",
      };
    case "EXPIRED":
    case "NOT_STARTED":
      return {
        title: "El código ya no está vigente",
        description: "Está fuera del período en el que puede utilizarse.",
        nextStep: "Usá otro código o continuá sin descuento.",
      };
    case "USAGE_LIMIT":
    case "EXHAUSTED":
      return {
        title: "Este código alcanzó el límite de usos",
        description: "Ya no quedan usos disponibles.",
        nextStep: "Continuá sin este descuento o pedí otro código a la organización.",
      };
    case "INACTIVE":
      return {
        title: "El código está desactivado",
        description: "La organización lo deshabilitó para nuevas inscripciones.",
        nextStep: "Continuá sin descuento o consultá a la organización.",
      };
    case "NOT_APPLICABLE":
    case "EDITION_MISMATCH":
      return {
        title: "El código no puede utilizarse en esta edición",
        description: "Las reglas del código no aplican a este evento.",
        nextStep: "Probá con otro código válido para esta edición.",
      };
    case "ALREADY_USED":
      return {
        title: "Ya utilizaste este código",
        description: "Alcanzaste el límite de usos por persona.",
        nextStep: "Continuá con el precio actual o usá otro código permitido.",
      };
    default:
      return {
        title: "No pudimos aplicar el código",
        description: "Revisá el código e intentá nuevamente.",
        nextStep: "Si el problema continúa, contactá a la organización.",
      };
  }
}

export const COMMERCIAL_REVIEW_NOTE =
  "Cambios en precios vigentes, beneficios incluidos o promociones pueden requerir revisión comercial antes de comunicarse.";
