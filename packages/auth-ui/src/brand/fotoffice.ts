import type { DnxAuthBrandConfig } from "../types";

export const fotofficeAuthBrand: DnxAuthBrandConfig = {
  applicationId: "fotoffice",
  productName: "FotoOffice",
  logo: {
    src: "/fotoffice-logo.jpg",
    alt: "FotoOffice",
    height: "3rem",
    href: "/",
  },
  tokens: { brandKey: "fotoffice" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: true,
  allowEmailRegistration: false,
  allowGoogle: true,
  allowPasswordReset: true,
  /** Énfasis visual en Google; el orden canónico sigue siendo email → CTA → divider → Google. */
  googleVisualEmphasis: "emphasized",
  contextualCopy: {
    loginTitle: "Iniciar sesión",
    loginDescription:
      "Administrá tu negocio fotográfico. Usá email/contraseña o Google — es la misma Cuenta DNX del ecosistema.",
    googleCta: "Continuar con Google",
  },
};
