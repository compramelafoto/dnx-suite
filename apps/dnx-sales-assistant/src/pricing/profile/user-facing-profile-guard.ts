import type { PricingProfile } from "../models.js";

export const SYNTHETIC_PROFILE_ID = "TEST_ONLY_SYNTHETIC_PROFILE";

export type UserFacingProfileRejection = {
  ok: false;
  code:
    | "SYNTHETIC_ID"
    | "SYNTHETIC_NAME"
    | "TEST_PROFILE_VERSION"
    | "NOT_CONFIGURED_FLAG";
  message: string;
};

export type UserFacingProfileOk = { ok: true };

/**
 * Un perfil apto para Telegram / canales operativos.
 * Los fixtures de test deben fallar aquí.
 */
export function isUserFacingPricingProfile(
  profile: Pick<PricingProfile, "id" | "name" | "profileVersion" | "configured">,
): boolean {
  return assertProductionSafePricingProfile(profile).ok;
}

export function assertProductionSafePricingProfile(
  profile: Pick<PricingProfile, "id" | "name" | "profileVersion" | "configured">,
): UserFacingProfileOk | UserFacingProfileRejection {
  if (profile.id === SYNTHETIC_PROFILE_ID || profile.id === "synth-dnx") {
    return {
      ok: false,
      code: "SYNTHETIC_ID",
      message: "Perfil sintético de prueba bloqueado para uso operativo.",
    };
  }
  if (
    /TEST_ONLY_SYNTHETIC|sintético test|Estudio Sintético/i.test(profile.name)
  ) {
    return {
      ok: false,
      code: "SYNTHETIC_NAME",
      message: "Nombre de perfil de prueba bloqueado para uso operativo.",
    };
  }
  if (
    typeof profile.profileVersion === "string" &&
    profile.profileVersion.startsWith("test-")
  ) {
    return {
      ok: false,
      code: "TEST_PROFILE_VERSION",
      message: "profileVersion de test bloqueada para uso operativo.",
    };
  }
  if (!profile.configured) {
    return {
      ok: false,
      code: "NOT_CONFIGURED_FLAG",
      message: "Perfil marcado como no configurado.",
    };
  }
  return { ok: true };
}

/** Bloquea cargar .example.json como perfil real. */
export function isExamplePricingPath(filePath: string): boolean {
  return /\.example\.json$/i.test(filePath) || /\/examples?\//i.test(filePath);
}
