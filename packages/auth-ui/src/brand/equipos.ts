import type { DnxAuthBrandConfig } from "../types";

/**
 * Portal de equipos fotográficos usados y verificados.
 * El nombre «Equipos verificados» es provisorio: la marca final todavía no está decidida.
 * Misma Cuenta DNX que el resto de la suite: ingreso con correo y contraseña. Todavía sin Google.
 */
export const equiposAuthBrand: DnxAuthBrandConfig = {
  applicationId: "equipos",
  productName: "Equipos verificados",
  logo: { src: "/brand/equipos-logo.svg", alt: "Equipos verificados", height: "3rem", href: "/" },
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
