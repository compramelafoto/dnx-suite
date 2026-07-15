/**
 * Contrato público de GET /api/cuenta/password-status (sin hashes ni secretos).
 */

export type PasswordStatusInput = {
  password: string | null | undefined;
  googleId: string | null | undefined;
};

export type PasswordStatusResponse = {
  hasLocalPassword: boolean;
  linkedWithGoogle: boolean;
  canChangeLocalPassword: boolean;
  googleOnlyAccount: boolean;
};

export function buildPasswordStatus(user: PasswordStatusInput): PasswordStatusResponse {
  const hasLocalPassword = Boolean(user.password && user.password.length > 0);
  const linkedWithGoogle = Boolean(user.googleId);
  return {
    hasLocalPassword,
    linkedWithGoogle,
    canChangeLocalPassword: hasLocalPassword,
    googleOnlyAccount: linkedWithGoogle && !hasLocalPassword,
  };
}

export const PASSWORD_STATUS_PUBLIC_KEYS = [
  "hasLocalPassword",
  "linkedWithGoogle",
  "canChangeLocalPassword",
  "googleOnlyAccount",
] as const;

export const PASSWORD_STATUS_FORBIDDEN_KEYS = [
  "password",
  "googleId",
  "hash",
  "email",
] as const;
