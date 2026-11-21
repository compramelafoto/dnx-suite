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
      "Ingresá el email con el que creaste tu Cuenta DNX y te enviamos un enlace para elegir una contraseña nueva. Vale en todas las plataformas DNX habilitadas.",
  },
};
