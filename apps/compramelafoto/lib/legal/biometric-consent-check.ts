/**
 * Consentimiento biométrico exigido antes de procesar la selfie del álbum con fotos ocultas
 * (dato biométrico, Ley 25.326). El cliente manda el campo `biometricConsent` con la versión
 * vigente del documento; el servidor rechaza con 400 si falta o no coincide, antes de
 * llamar a Rekognition. Puro, para poder probarlo.
 */
import { BIOMETRIC_CONSENT_VERSION } from "@/lib/legal/biometric-consent-content";

export const BIOMETRIC_CONSENT_FIELD = "biometricConsent";

export const BIOMETRIC_CONSENT_REQUIRED_MESSAGE =
  "Para buscar tus fotos con tu selfie tenés que aceptar el Consentimiento biométrico y la Política de privacidad escolar.";

export type BiometricConsentCheck =
  | { ok: true; version: string }
  | { ok: false; error: string };

export function validateBiometricConsentField(value: unknown): BiometricConsentCheck {
  const v = typeof value === "string" ? value.trim() : "";
  if (v === BIOMETRIC_CONSENT_VERSION) return { ok: true, version: BIOMETRIC_CONSENT_VERSION };
  return { ok: false, error: BIOMETRIC_CONSENT_REQUIRED_MESSAGE };
}

export { BIOMETRIC_CONSENT_VERSION };
