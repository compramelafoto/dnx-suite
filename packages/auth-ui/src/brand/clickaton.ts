import type { DnxAuthBrandConfig } from "../types";

export const clickatonAuthBrand: DnxAuthBrandConfig = {
  applicationId: "clickaton",
  productName: "Clickatón",
  logo: {
    src: "/clickaton-logo.png",
    alt: "Clickatón",
    height: "3.5rem",
    href: "/",
  },
  tokens: { brandKey: "clickaton" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: true,
  allowEmailRegistration: true,
  allowGoogle: true,
  allowPasswordReset: true,
  contextualCopy: {
    loginTitle: "Iniciar sesión",
    loginDescription:
      "Accedé a tu Cuenta DNX para gestionar tu participación en Clickatón.",
    registerTitle: "Crear cuenta",
    registerDescription: "Una Cuenta DNX te sirve en Clickatón y en el resto de plataformas DNX.",
    createAccountCta: "Crear cuenta",
  },
};
