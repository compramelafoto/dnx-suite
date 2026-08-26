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
  opsDailyReport: {
    subject: (reportDate) => `Informe DNX — ${reportDate}`,
    subjectWithAlerts: (reportDate, criticalCount) =>
      `Informe DNX — ${reportDate} — ${criticalCount} ${
        criticalCount === 1 ? "alerta crítica" : "alertas críticas"
      }`,
    heading: "Informe diario de la suite",
    intro: (reportDate) =>
      `Resumen de la actividad del ${reportDate} en todas las plataformas.`,
    alertsTitle: "Requiere tu atención",
    summaryTitle: "Números del día",
    defaultCta: "Ver el informe completo",
    statusLabel: (status) => `Estado del informe: ${status}`,
  },
};
