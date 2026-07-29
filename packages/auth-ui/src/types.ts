export type DnxAuthApplicationId =
  | "compramelafoto"
  | "clickaton"
  | "fotorank"
  | "infospot"
  | "fotoffice"
  | (string & {});

export type AuthLogoConfig = {
  src: string;
  alt: string;
  /** Altura CSS, p.ej. "3.5rem" */
  height?: string;
  href?: string;
};

export type AuthThemeTokens = {
  /** Valor de data-brand para tokens.css */
  brandKey: DnxAuthApplicationId;
  fontFamily?: string;
  className?: string;
};

export type AuthContextCopy = {
  loginTitle?: string;
  loginDescription?: string;
  registerTitle?: string;
  registerDescription?: string;
  forgotTitle?: string;
  forgotDescription?: string;
  resetTitle?: string;
  contextualNotice?: string;
  createAccountCta?: string;
  loginCta?: string;
  googleCta?: string;
  invitationHint?: string;
};

/**
 * Configuración de marca por plataforma.
 * No puede alterar el orden canónico — solo copy, tokens y flags de features.
 */
export type DnxAuthBrandConfig = {
  applicationId: DnxAuthApplicationId;
  productName: string;
  logo: AuthLogoConfig;
  tokens: AuthThemeTokens;
  supportUrl?: string;
  privacyUrl: string;
  termsUrl: string;
  allowEmailLogin: boolean;
  allowEmailRegistration: boolean;
  allowGoogle: boolean;
  allowPasswordReset: boolean;
  /** InfoSpot / roles internos */
  invitationOnly?: boolean;
  /**
   * Destaca visualmente Google (FotoOffice) sin cambiar el orden canónico
   * (Google sigue después del CTA email).
   */
  googleVisualEmphasis?: "secondary" | "emphasized";
  contextualCopy?: AuthContextCopy;
};

export type DnxAuthFieldError = {
  message: string;
  field?: "email" | "password" | "passwordConfirm" | "name" | "form";
};

export type DnxAuthLoadingState =
  | "idle"
  | "submitting"
  | "redirecting-google"
  | "sending-email"
  | "verifying"
  | "resetting";

/** IDs de slots del orden canónico de login (tests / CI). */
export const DNX_LOGIN_ORDER = [
  "identity",
  "title",
  "description",
  "email",
  "password",
  "aux-row",
  "primary-cta",
  "error",
  "divider",
  "google",
  "create-account",
  "help",
  "legal",
] as const;

export type DnxLoginOrderSlot = (typeof DNX_LOGIN_ORDER)[number];

export const DNX_REGISTER_ORDER = [
  "identity",
  "title",
  "firstName",
  "lastName",
  "email",
  "password",
  "passwordConfirm",
  "requirements",
  "consents",
  "primary-cta",
  "divider",
  "google",
  "have-account",
  "legal",
] as const;

export type DnxRegisterOrderSlot = (typeof DNX_REGISTER_ORDER)[number];

/** Copy canónico de CTAs (evitar Entrar / Acceder / Login). */
export const DNX_AUTH_CTA = {
  login: "Iniciar sesión",
  register: "Crear cuenta",
  forgot: "Enviar enlace",
  reset: "Guardar contraseña",
  google: "Continuar con Google",
  showPassword: "Mostrar contraseña",
  hidePassword: "Ocultar contraseña",
  myAccount: "Mi cuenta",
  logout: "Cerrar sesión",
  forgotLink: "¿Olvidaste tu contraseña?",
  haveAccount: "Ya tengo cuenta",
  createAccount: "Crear cuenta",
  sessionExpired: "Actualizamos el sistema de cuentas. Iniciá sesión nuevamente.",
} as const;
