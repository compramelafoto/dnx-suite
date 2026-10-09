import type { DnxAuthBrandConfig } from "../types";

/**
 * Muestras Fotográficas. Entra sólo con Google, como SubiLaFoto: el socio de FOTOFFICE usa
 * el mismo Google y queda como el mismo usuario, porque la tabla `User` es la misma.
 */
export const muestrasAuthBrand: DnxAuthBrandConfig = {
  applicationId: "muestras",
  productName: "Muestras Fotográficas",
  logo: { src: "/brand/muestras-logo.webp", alt: "Muestras Fotográficas", height: "6rem", href: "/" },
  tokens: { brandKey: "muestras", fontFamily: "var(--mf-font), system-ui, sans-serif" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: false,
  allowEmailRegistration: false,
  allowGoogle: true,
  allowPasswordReset: false,
  contextualCopy: {
    loginTitle: "Entrá para proponer tu muestra",
    loginDescription: "Si sos socio de una institución en FOTOFFICE, usá el mismo Google.",
  },
};
