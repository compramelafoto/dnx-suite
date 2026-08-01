import type { LocaleBundle } from "./types";

export const localeEsAR: LocaleBundle = {
  locale: "es-AR",
  common: {
    preheaderFallback: "Mensaje de DNX Communications",
    supportLabel: "Soporte",
    websiteLabel: "Sitio web",
    transactionalNotice:
      "Este mensaje forma parte de las comunicaciones del sistema. Los envíos comerciales y el centro de preferencias se habilitarán en etapas futuras.",
    unsubscribeFutureNote:
      "Las bajas y preferencias de marketing no están activas en esta etapa.",
  },
  systemTest: {
    subject: "Prueba técnica — DNX Communications",
    heading: "Prueba técnica del sistema",
    intro:
      "Este es un email de prueba técnica del sistema DNX Communications. No requiere ninguna acción. No es publicidad ni un mensaje comercial.",
    greeting: (name) => `Hola ${name},`,
    defaultCta: "Ver detalles",
  },
  userWelcome: {
    subject: (platformName) => `Bienvenido/a a ${platformName}`,
    heading: "Te damos la bienvenida",
    intro: (platformName) =>
      `Tu acceso a ${platformName} está listo. Este mensaje es genérico del sistema de comunicaciones y todavía no está ligado a un flujo de producto concreto.`,
    greeting: (name) => `Hola ${name},`,
    defaultCta: "Ingresar",
    supportCta: "Contactar soporte",
  },
};
