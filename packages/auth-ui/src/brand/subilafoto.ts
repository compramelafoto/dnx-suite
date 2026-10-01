import type { DnxAuthBrandConfig } from "../types";

/**
 * Subí la Foto.
 *
 * Única plataforma de la suite que entra **sólo con Google**: no hay ingreso
 * con contraseña ni registro propio. El profesional ya tiene su Cuenta DNX de
 * las otras aplicaciones, y el invitado de un evento nunca inicia sesión —
 * llega por el QR y sube sus fotos sin cuenta.
 *
 * Por eso `allowEmailLogin`, `allowEmailRegistration` y `allowPasswordReset`
 * están en falso: no es que falten, es que no existen en este producto.
 */
export const subilafotoAuthBrand: DnxAuthBrandConfig = {
  applicationId: "subilafoto",
  productName: "Subí la Foto",
  logo: {
    src: "/brand/subilafoto-logo-vertical-negativo.png",
    alt: "Subí la Foto",
    height: "7rem",
    href: "/",
  },
  tokens: { brandKey: "subilafoto", fontFamily: "var(--slf-font), system-ui, sans-serif" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: false,
  allowEmailRegistration: false,
  allowGoogle: true,
  allowPasswordReset: false,
  contextualCopy: {
    loginTitle: "Entrá a tu cuenta",
    loginDescription:
      "Es la misma cuenta que usás en las demás aplicaciones de DNX Suite.",
  },
};
