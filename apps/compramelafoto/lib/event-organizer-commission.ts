/** Porcentaje máximo de comisión del organizador sobre el precio base del fotógrafo (evita margen nulo). */
export const MAX_EVENT_ORGANIZER_COMMISSION_PERCENT = 90;

export type ResolvedEventOrganizerCommission = {
  enabled: boolean;
  percentage: number | null;
};

function parsePercentageInput(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Alta de evento: define comisión desde el body completo. */
export function resolveEventOrganizerCommissionForCreate(body: {
  organizerCommissionEnabled?: unknown;
  organizerCommissionPercentage?: unknown;
}): { ok: true; value: ResolvedEventOrganizerCommission } | { ok: false; error: string } {
  const enabled = body.organizerCommissionEnabled === true;
  const pct = parsePercentageInput(body.organizerCommissionPercentage);
  if (!enabled) {
    return { ok: true, value: { enabled: false, percentage: null } };
  }
  if (pct === null || pct <= 0 || pct > MAX_EVENT_ORGANIZER_COMMISSION_PERCENT) {
    return {
      ok: false,
      error: `Si activás la comisión, indicá un porcentaje mayor que 0 y hasta ${MAX_EVENT_ORGANIZER_COMMISSION_PERCENT}%.`,
    };
  }
  return { ok: true, value: { enabled: true, percentage: pct } };
}

export function commissionFieldsTouched(body: {
  organizerCommissionEnabled?: unknown;
  organizerCommissionPercentage?: unknown;
}): boolean {
  return (
    body.organizerCommissionEnabled !== undefined ||
    body.organizerCommissionPercentage !== undefined
  );
}

/** PATCH: combina body con valores actuales del evento. */
export function resolveEventOrganizerCommissionForPatch(
  current: { organizerCommissionEnabled: boolean; organizerCommissionPercentage: number | null },
  body: { organizerCommissionEnabled?: unknown; organizerCommissionPercentage?: unknown }
):
  | { ok: false; error: string }
  | { ok: true; skip: true }
  | { ok: true; value: ResolvedEventOrganizerCommission } {
  if (!commissionFieldsTouched(body)) {
    return { ok: true, skip: true };
  }

  const nextEnabled =
    body.organizerCommissionEnabled !== undefined
      ? body.organizerCommissionEnabled === true
      : current.organizerCommissionEnabled;

  let nextPct: number | null;
  if (body.organizerCommissionPercentage !== undefined) {
    nextPct = parsePercentageInput(body.organizerCommissionPercentage);
  } else {
    nextPct =
      current.organizerCommissionPercentage != null
        ? Number(current.organizerCommissionPercentage)
        : null;
  }

  if (!nextEnabled) {
    return { ok: true, value: { enabled: false, percentage: null } };
  }

  if (nextPct === null || nextPct <= 0 || nextPct > MAX_EVENT_ORGANIZER_COMMISSION_PERCENT) {
    return {
      ok: false,
      error: `Si activás la comisión, indicá un porcentaje mayor que 0 y hasta ${MAX_EVENT_ORGANIZER_COMMISSION_PERCENT}%.`,
    };
  }

  return { ok: true, value: { enabled: true, percentage: nextPct } };
}
