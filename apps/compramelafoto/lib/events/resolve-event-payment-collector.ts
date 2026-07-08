/**
 * CLF-ORGANIZER-AS-COLLECTOR-100 — resuelve quién cobra en Mercado Pago para ventas de evento.
 */
export type PaymentCollectorType = "PHOTOGRAPHER" | "ORGANIZER";

export const ORGANIZER_FULL_COMMISSION_MP_REQUIRED_ERROR =
  "Para usar comisión del 100%, el organizador debe conectar su cuenta de Mercado Pago. Si no, usá una comisión menor o liquidación manual.";

const PHOTOGRAPHER_MP_REQUIRED_ERROR =
  "El dueño del álbum debe conectar Mercado Pago para recibir los pagos. Conectá Mercado Pago en Configuración / Datos para cobro.";

export type EventPaymentCollectorEventInput = {
  id: number;
  creatorId: number;
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: number | null;
} | null;

export type ResolvedEventPaymentCollector =
  | {
      ok: true;
      collectorType: PaymentCollectorType;
      collectorUserId: number;
      accessToken: string;
      mpUserId: string | null;
      organizerCommissionPercent: number | null;
      organizerAsCollector: boolean;
      /** Solo fee plataforma en marketplace_fee (sin retención organizador). */
      marketplaceFeePlatformOnlyMode: boolean;
    }
  | {
      ok: false;
      error: string;
      code: string;
      automaticCheckoutBlocked: boolean;
    };

export function isOrganizerFullCommissionEvent(event: {
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: number | null;
}): boolean {
  return (
    event.organizerCommissionEnabled &&
    event.organizerCommissionPercentage != null &&
    Number.isFinite(event.organizerCommissionPercentage) &&
    event.organizerCommissionPercentage === 100
  );
}

/** Resolución pura (tests y capa de dominio). */
export function resolveEventPaymentCollectorFromData(params: {
  event: EventPaymentCollectorEventInput;
  photographerUserId: number | null;
  photographerMpAccessToken: string | null | undefined;
  organizerMpAccessToken: string | null | undefined;
  organizerMpUserId?: string | null;
}): ResolvedEventPaymentCollector {
  const event = params.event;
  const organizerPct =
    event?.organizerCommissionEnabled && event.organizerCommissionPercentage != null
      ? Number(event.organizerCommissionPercentage)
      : null;

  if (event != null && isOrganizerFullCommissionEvent(event)) {
    const token = params.organizerMpAccessToken?.trim();
    if (!token) {
      return {
        ok: false,
        error: ORGANIZER_FULL_COMMISSION_MP_REQUIRED_ERROR,
        code: "ORGANIZER_MP_NOT_CONNECTED",
        automaticCheckoutBlocked: true,
      };
    }
    return {
      ok: true,
      collectorType: "ORGANIZER",
      collectorUserId: event.creatorId,
      accessToken: token,
      mpUserId: params.organizerMpUserId ?? null,
      organizerCommissionPercent: 100,
      organizerAsCollector: true,
      marketplaceFeePlatformOnlyMode: true,
    };
  }

  if (params.photographerUserId == null) {
    return {
      ok: false,
      error: PHOTOGRAPHER_MP_REQUIRED_ERROR,
      code: "MP_NOT_CONNECTED",
      automaticCheckoutBlocked: true,
    };
  }

  const photographerToken = params.photographerMpAccessToken?.trim();
  if (!photographerToken) {
    return {
      ok: false,
      error: PHOTOGRAPHER_MP_REQUIRED_ERROR,
      code: "MP_NOT_CONNECTED",
      automaticCheckoutBlocked: true,
    };
  }

  return {
    ok: true,
    collectorType: "PHOTOGRAPHER",
    collectorUserId: params.photographerUserId,
    accessToken: photographerToken,
    mpUserId: null,
    organizerCommissionPercent: organizerPct,
    organizerAsCollector: false,
    marketplaceFeePlatformOnlyMode: false,
  };
}
