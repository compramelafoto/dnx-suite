import type { DnxAuthBrandConfig } from "../types";

export const fotorankAuthBrand: DnxAuthBrandConfig = {
  applicationId: "fotorank",
  productName: "FotoRank",
  logo: {
    src: "/fotorank-logo.png",
    alt: "FotoRank",
    height: "5.5rem",
    href: "/",
  },
  tokens: { brandKey: "fotorank" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: true,
  allowEmailRegistration: true,
  allowGoogle: true,
  allowPasswordReset: true,
  contextualCopy: {
    loginTitle: "Iniciar sesión",
    loginDescription: "Usá tu Cuenta DNX. Crear cuenta no otorga rol de organizador ni jurado.",
    registerTitle: "Crear cuenta",
    registerDescription:
      "Registrá tu Cuenta DNX. Los roles de organizador o jurado se asignan por invitación o configuración.",
    createAccountCta: "Crear cuenta",
    forgotTitle: "¿Olvidaste tu contraseña?",
    forgotDescription:
      "Te enviaremos un enlace si existe una Cuenta DNX asociada. La nueva contraseña vale en todas las plataformas DNX habilitadas.",
  },
};
