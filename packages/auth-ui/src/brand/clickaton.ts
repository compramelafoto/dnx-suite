import type { DnxAuthBrandConfig } from "../types";

export const clickatonAuthBrand: DnxAuthBrandConfig = {
  applicationId: "clickaton",
  productName: "Clickatón",
  logo: {
    src: "/brand/downloads/logos/clickaton-principal-v3-color.png",
    alt: "Clickatón",
    height: "5rem",
    href: "/",
  },
  tokens: { brandKey: "clickaton" },
  privacyUrl: "/legal/privacidad",
  termsUrl: "/legal/terminos",
  allowEmailLogin: true,
  allowEmailRegistration: true,
  allowGoogle: true,
  allowPasswordReset: true,
  contextualCopy: {
    loginTitle: "Iniciar sesión",
    loginDescription:
      "Accedé a tu Cuenta DNX para gestionar tu participación en Clickatón. Crear cuenta no inscribe a una maratón.",
    registerTitle: "Crear cuenta",
    registerDescription:
      "Creá tu Cuenta DNX. No es una inscripción a Clickatón: las inscripciones se hacen por separado con INSCRIBIRME.",
    createAccountCta: "Crear cuenta",
    forgotTitle: "¿Olvidaste tu contraseña?",
    forgotDescription:
      "Te enviaremos un enlace si existe una Cuenta DNX asociada. La nueva contraseña vale en todas las plataformas DNX habilitadas.",
  },
};
