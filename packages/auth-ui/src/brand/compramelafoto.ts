import type { DnxAuthBrandConfig } from "../types";

export const compramelafotoAuthBrand: DnxAuthBrandConfig = {
  applicationId: "compramelafoto",
  productName: "ComprameLaFoto",
  logo: {
    src: "/logo-compramelafoto.svg",
    alt: "ComprameLaFoto",
    height: "3rem",
    href: "/",
  },
  tokens: { brandKey: "compramelafoto" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: true,
  allowEmailRegistration: true,
  allowGoogle: true,
  allowPasswordReset: true,
  contextualCopy: {
    loginTitle: "Iniciar sesión",
    loginDescription: "Accedé con tu Cuenta DNX para comprar, vender o gestionar álbumes.",
    registerTitle: "Crear cuenta",
    registerDescription: "Creá tu Cuenta DNX. El perfil (cliente, fotógrafo, lab) se completa después.",
  },
};
