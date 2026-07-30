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
    loginDescription:
      "Accedé a InfoSpot con tu Cuenta DNX. El acceso editorial (Director, Redactor o Colaborador) es por invitación.",
    invitationHint: "¿Recibiste una invitación?",
    contextualNotice:
      "Crear una Cuenta DNX no otorga rol editorial. Si te invitaron, abrí el enlace del email.",
  },
};
