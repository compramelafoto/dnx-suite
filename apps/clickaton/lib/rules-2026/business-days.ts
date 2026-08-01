/**
 * Días hábiles (lun–vie). No considera feriados nacionales (política producto 10F.0).
 * availableAt = 15 días hábiles posteriores a la venta.
 */

export function addBusinessDays(from: Date, businessDays: number): Date {
  if (!Number.isInteger(businessDays) || businessDays < 0) {
    throw new Error("business_days_must_be_non_negative_integer");
  }
  const d = new Date(from.getTime());
  let remaining = businessDays;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay(); // 0 Sun … 6 Sat
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}

/** AR calendar-day helper using local civil date in fixed −03 offset when needed. */
export function addBusinessDaysFromInstant(
  from: Date,
  businessDays: number,
): Date {
  return addBusinessDays(from, businessDays);
}
