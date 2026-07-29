import type { DnxAuthBrandConfig } from "../types";

export const fotofficeAuthBrand: DnxAuthBrandConfig = {
  applicationId: "fotoffice",
  productName: "FotoOffice",
  logo: {
    src: "/fotoffice-logo.svg",
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
  googleVisualEmphasis: "emphasized",
  contextualCopy: {
    loginTitle: "Iniciar sesión",
    loginDescription:
      "Administrá tu negocio fotográfico. Preferí Google si ya usás esa cuenta en el ecosistema DNX.",
  },
};
