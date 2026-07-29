/**
 * Mensajes de error seguros unificados — no revelar enumeración ni detalles internos.
 */

export const DNX_AUTH_MESSAGES = {
  loginInvalid: "Email o contraseña incorrectos.",
  sessionExpired: "Tu sesión venció. Iniciá sesión nuevamente.",
  accountBlocked: "Esta cuenta está bloqueada. Contactá soporte.",
  noPasswordUseGoogle:
    "Esta cuenta no tiene contraseña configurada. Usá Continuar con Google o recuperá el acceso.",
  registerExists: "Ya existe una cuenta con ese email. Iniciá sesión o recuperá tu contraseña.",
  registerSuccess:
    "Cuenta DNX creada. Revisá tu email para verificarla. Esta misma cuenta sirve en las plataformas DNX habilitadas.",
  resetNeutral: "Si existe una cuenta asociada, vas a recibir un correo.",
  resetInvalidToken: "El enlace de recuperación es inválido o venció.",
  verifyInvalidToken: "El enlace de verificación es inválido o venció.",
  verifySuccess: "Email verificado correctamente.",
  googleConflict:
    "Ya existe una cuenta con ese email. Iniciá sesión y vinculá Google desde tu perfil, o recuperá tu contraseña.",
  passwordChanged: "Contraseña actualizada.",
  genericError: "No se pudo completar la operación. Intentá de nuevo.",
} as const;

export type DnxAuthMessageKey = keyof typeof DNX_AUTH_MESSAGES;
