/**
 * Tipo de cuenta elegido en /registro y a qué endpoint corresponde.
 *
 * El panel DNX unificado creaba siempre CUSTOMER, así que los fotógrafos que se
 * anotaban por email quedaban con el rol equivocado y sin atribución de referido.
 */

export type RegisterAccountType = "PHOTOGRAPHER" | "CUSTOMER";

export type RegisterAccountTypeOption = {
  value: RegisterAccountType;
  label: string;
  hint: string;
};

export const ACCOUNT_TYPE_OPTIONS: RegisterAccountTypeOption[] = [
  {
    value: "PHOTOGRAPHER",
    label: "Soy fotógrafo/a",
    hint: "Quiero publicar y vender mis fotos.",
  },
  {
    value: "CUSTOMER",
    label: "Quiero comprar fotos",
    hint: "Me pasaron un link para ver y comprar mis fotos.",
  },
];

export function parseAccountType(raw: string | null | undefined): RegisterAccountType {
  return raw?.trim().toUpperCase() === "CUSTOMER" ? "CUSTOMER" : "PHOTOGRAPHER";
}

/** El rol que se manda a Google OAuth. Nunca "AUTO": con AUTO el callback rechaza altas nuevas. */
export function googleRoleForAccountType(accountType: RegisterAccountType): string {
  return accountType;
}

export type TrainingMeta = { sourceType: string; sourceEntityId: number } | null;

export type RegisterAccountRequest = {
  endpoint: string;
  body: Record<string, unknown>;
};

export function buildRegisterAccountRequest(input: {
  name: string;
  email: string;
  password: string;
  accountType: RegisterAccountType;
  refCode: string | null;
  trainingMeta: TrainingMeta;
}): RegisterAccountRequest {
  const { name, email, password, accountType, trainingMeta } = input;
  const refCode = input.refCode?.trim() || null;

  if (accountType === "CUSTOMER") {
    return {
      endpoint: "/api/auth/register",
      body: { name, email, password },
    };
  }

  return {
    endpoint: "/api/auth/register-photographer",
    body: {
      name,
      email,
      password,
      marketingOptIn: true,
      ...(refCode ? { ref: refCode } : {}),
      ...(trainingMeta
        ? {
            sourceType: trainingMeta.sourceType,
            sourceEntityId: trainingMeta.sourceEntityId,
          }
        : {}),
    },
  };
}
