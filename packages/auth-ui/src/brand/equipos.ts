import type { DnxAuthBrandConfig } from "../types";

/**
 * Portal de equipos fotográficos usados y verificados.
 * La plataforma se llama MercadoRaw (ver `MARCA` en apps/equipos/app/_ui/marca.ts).
 * Misma Cuenta DNX que el resto de la suite: ingreso con correo y contraseña. Todavía sin Google.
 */
export const equiposAuthBrand: DnxAuthBrandConfig = {
  applicationId: "equipos",
  productName: "MercadoRaw",
  logo: { src: "/brand/equipos-logo.svg", alt: "MercadoRaw", height: "3rem", href: "/" },
  tokens: { brandKey: "equipos" },
  privacyUrl: "/privacidad",
  termsUrl: "/terminos",
  allowEmailLogin: true,
  allowEmailRegistration: true,
  allowGoogle: false,
  allowPasswordReset: true,
  contextualCopy: {
    loginTitle: "Iniciar sesión",
    loginDescription: "Usá tu Cuenta DNX: es la misma que en ComprameLaFoto.",
    registerTitle: "Crear cuenta",
    registerDescription:
      "Creá tu Cuenta DNX para comprar y vender equipos fotográficos verificados.",
    forgotTitle: "¿Olvidaste tu contraseña?",
    forgotDescription:
      "Te enviaremos un enlace si existe una Cuenta DNX asociada. La nueva contraseña vale en todas las plataformas DNX.",
  },
};
