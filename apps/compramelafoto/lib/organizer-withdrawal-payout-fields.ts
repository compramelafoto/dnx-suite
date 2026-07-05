const MIN_LEN = 3;
const MAX_LEN = 120;

/** Alias / CBU / CVU: letras, números, puntos, guiones, espacios. */
const ALIAS_PATTERN = /^[a-zA-Z0-9.\-\s]+$/;

export type OrganizerPayoutSettingsInput = {
  payoutAlias: string;
  payoutBank: string;
  payoutAccountHolder: string;
};

/** @deprecated use OrganizerPayoutSettingsInput — alias para compatibilidad interna */
export type OrganizerWithdrawalPayoutInput = OrganizerPayoutSettingsInput;

export type PayoutFieldValidationResult =
  | { ok: true; data: OrganizerPayoutSettingsInput }
  | { ok: false; error: string };

function sanitizeRequiredString(
  value: unknown,
  label: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (value == null || typeof value !== "string") {
    return { ok: false, error: `${label} es requerido.` };
  }
  const trimmed = value.trim();
  if (trimmed.length < MIN_LEN) {
    return { ok: false, error: `${label} debe tener al menos ${MIN_LEN} caracteres.` };
  }
  if (trimmed.length > MAX_LEN) {
    return { ok: false, error: `${label} no puede superar ${MAX_LEN} caracteres.` };
  }
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    return { ok: false, error: `${label} contiene caracteres no válidos.` };
  }
  return { ok: true, value: trimmed };
}

function validateAliasField(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const base = sanitizeRequiredString(raw, "Alias / CBU / CVU");
  if (!base.ok) return base;
  if (!ALIAS_PATTERN.test(base.value)) {
    return {
      ok: false,
      error:
        "El alias / CBU / CVU solo puede contener letras, números, puntos, guiones y espacios.",
    };
  }
  return base;
}

/**
 * Valida datos de cuenta para guardar en perfil o snapshot (sin validación bancaria real).
 */
export function validateOrganizerPayoutSettingsInput(body: unknown): PayoutFieldValidationResult {
  if (body == null || typeof body !== "object") {
    return { ok: false, error: "Debés completar los datos de la cuenta." };
  }

  const raw = body as Record<string, unknown>;

  const aliasResult = validateAliasField(
    raw.payoutAlias ?? raw.payoutAccountAlias
  );
  if (!aliasResult.ok) return aliasResult;

  const bankResult = sanitizeRequiredString(
    raw.payoutBank ?? raw.payoutAccountBank,
    "Banco o billetera"
  );
  if (!bankResult.ok) return bankResult;

  const holderResult = sanitizeRequiredString(
    raw.payoutAccountHolder ?? raw.payoutAccountHolder,
    "Titular de la cuenta"
  );
  if (!holderResult.ok) return holderResult;

  return {
    ok: true,
    data: {
      payoutAlias: aliasResult.value,
      payoutBank: bankResult.value,
      payoutAccountHolder: holderResult.value,
    },
  };
}

/** @deprecated use validateOrganizerPayoutSettingsInput */
export const validateOrganizerWithdrawalPayoutInput = validateOrganizerPayoutSettingsInput;

export function isOrganizerPayoutSettingsComplete(settings: {
  payoutAlias: string | null | undefined;
  payoutBank: string | null | undefined;
  payoutAccountHolder: string | null | undefined;
}): boolean {
  return validateOrganizerPayoutSettingsInput({
    payoutAlias: settings.payoutAlias ?? "",
    payoutBank: settings.payoutBank ?? "",
    payoutAccountHolder: settings.payoutAccountHolder ?? "",
  }).ok;
}

/** Validación en cliente (misma regla; devuelve errores por campo). */
export function validateOrganizerPayoutSettingsFieldsClient(input: {
  payoutAlias: string;
  payoutBank: string;
  payoutAccountHolder: string;
}): { valid: boolean; errors: Partial<Record<keyof OrganizerPayoutSettingsInput, string>> } {
  const errors: Partial<Record<keyof OrganizerPayoutSettingsInput, string>> = {};

  const aliasResult = validateAliasField(input.payoutAlias);
  if (!aliasResult.ok) errors.payoutAlias = aliasResult.error;

  const bankResult = sanitizeRequiredString(input.payoutBank, "Banco o billetera");
  if (!bankResult.ok) errors.payoutBank = bankResult.error;

  const holderResult = sanitizeRequiredString(input.payoutAccountHolder, "Titular de la cuenta");
  if (!holderResult.ok) errors.payoutAccountHolder = holderResult.error;

  return { valid: Object.keys(errors).length === 0, errors };
}

/** @deprecated */
export const validateOrganizerWithdrawalPayoutFieldsClient = validateOrganizerPayoutSettingsFieldsClient;

export const ORGANIZER_PAYOUT_RECEIPT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

export const ORGANIZER_PAYOUT_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
