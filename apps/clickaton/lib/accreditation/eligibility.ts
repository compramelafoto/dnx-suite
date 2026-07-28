/**
 * Gates de acreditación (Etapa 12).
 * PAID operativo = paymentStatus APPROVED | NOT_REQUIRED.
 */

export type ScanTone = "GREEN" | "YELLOW" | "RED" | "BLUE";

export type EligibilitySnapshot = {
  registrationStatus: string;
  paymentStatus: string;
  hasActiveCredential: boolean;
  alreadyCheckedIn: boolean;
  accreditationEnabled: boolean;
  withinAccreditationWindow: boolean | null;
  grantException: boolean;
};

export function isPaidForAccreditation(paymentStatus: string): boolean {
  return paymentStatus === "APPROVED" || paymentStatus === "NOT_REQUIRED";
}

export function evaluateAccreditationEligibility(input: EligibilitySnapshot): {
  ok: boolean;
  tone: ScanTone;
  reason: string;
  canCheckIn: boolean;
} {
  if (input.registrationStatus === "CANCELLED" || input.registrationStatus === "REFUNDED") {
    return { ok: false, tone: "RED", reason: "REGISTRATION_INACTIVE", canCheckIn: false };
  }
  if (input.registrationStatus === "DISQUALIFIED") {
    return { ok: false, tone: "RED", reason: "DISQUALIFIED", canCheckIn: false };
  }
  if (input.registrationStatus !== "CONFIRMED") {
    return { ok: false, tone: "YELLOW", reason: "NOT_CONFIRMED", canCheckIn: false };
  }
  if (!isPaidForAccreditation(input.paymentStatus)) {
    return {
      ok: false,
      tone: "YELLOW",
      reason: "PAYMENT_PENDING",
      canCheckIn: input.grantException,
    };
  }
  if (!input.hasActiveCredential) {
    return { ok: false, tone: "YELLOW", reason: "CREDENTIAL_MISSING", canCheckIn: false };
  }
  if (input.alreadyCheckedIn) {
    return { ok: true, tone: "BLUE", reason: "ALREADY_CHECKED_IN", canCheckIn: false };
  }
  if (!input.accreditationEnabled && !input.grantException) {
    return { ok: false, tone: "YELLOW", reason: "ACCREDITATION_DISABLED", canCheckIn: false };
  }
  if (input.withinAccreditationWindow === false && !input.grantException) {
    return { ok: false, tone: "YELLOW", reason: "WINDOW_CLOSED", canCheckIn: false };
  }
  return { ok: true, tone: "GREEN", reason: "READY", canCheckIn: true };
}

/** Geofence opcional — sin coordenadas inventadas. */
export function evaluateDeviceGeofence(input: {
  mode: "OFF" | "OPTIONAL" | "REQUIRED_FOR_DEVICE" | "MANUAL_REVIEW";
  lat: number | null;
  lng: number | null;
  centerLat: number | null;
  centerLng: number | null;
  radiusMeters: number | null;
  toleranceMeters: number;
}): { ok: boolean; status: string } {
  if (input.mode === "OFF") return { ok: true, status: "GEOFENCE_OFF" };
  if (input.lat == null || input.lng == null) {
    if (input.mode === "OPTIONAL") return { ok: true, status: "GPS_ABSENT_ALLOWED" };
    if (input.mode === "MANUAL_REVIEW") return { ok: true, status: "GPS_ABSENT_REVIEW" };
    return { ok: false, status: "GPS_ABSENT_REQUIRED" };
  }
  if (input.centerLat == null || input.centerLng == null || input.radiusMeters == null) {
    return { ok: true, status: "GEOFENCE_NOT_CONFIGURED" };
  }
  const dist = haversineMeters(input.lat, input.lng, input.centerLat, input.centerLng);
  const max = input.radiusMeters + Math.max(0, input.toleranceMeters);
  if (dist <= max) return { ok: true, status: "INSIDE" };
  if (input.mode === "OPTIONAL") return { ok: true, status: "OUTSIDE_OPTIONAL" };
  return { ok: false, status: "OUTSIDE" };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
