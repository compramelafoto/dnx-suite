import type { DnxAuthBrandConfig } from "../types";

export const infospotAuthBrand: DnxAuthBrandConfig = {
  applicationId: "infospot",
  productName: "InfoSpot",
  logo: {
    src: "/infospot-logo.svg",
    alt: "InfoSpot",
    height: "2.5rem",
    href: "/",
  },
  tokens: { brandKey: "infospot" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: true,
  allowEmailRegistration: false,
  allowGoogle: true,
  allowPasswordReset: true,
  invitationOnly: true,
  contextualCopy: {
    loginTitle: "Iniciar sesión",
    loginDescription: "Accedé a InfoSpot con tu Cuenta DNX.",
    invitationHint: "Acceder con una invitación",
  },
};
