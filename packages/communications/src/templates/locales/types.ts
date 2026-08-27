export const SUPPORTED_LOCALES = ["es-AR"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Cómo agregar locales futuros:
 * 1. Crear `locales/es.ts` / `en.ts` / `pt-BR.ts` con los mismos keys.
 * 2. Añadir el código a SUPPORTED_LOCALES.
 * 3. Registrar el bundle en `localeBundles`.
 * 4. Cubrir con tests de subject/cuerpo.
 */
export type LocaleBundle = {
  locale: SupportedLocale;
  common: {
    preheaderFallback: string;
    supportLabel: string;
    websiteLabel: string;
    transactionalNotice: string;
    unsubscribeFutureNote: string;
  };
  systemTest: {
    subject: string;
    heading: string;
    intro: string;
    greeting: (name: string) => string;
    defaultCta: string;
  };
  userWelcome: {
    subject: (platformName: string) => string;
    heading: string;
    intro: (platformName: string) => string;
    greeting: (name: string) => string;
    defaultCta: string;
    supportCta: string;
  };
  opsDailyReport: {
    subject: (reportDate: string) => string;
    subjectWithAlerts: (reportDate: string, criticalCount: number) => string;
    heading: string;
    intro: (reportDate: string) => string;
    alertsTitle: string;
    summaryTitle: string;
    defaultCta: string;
    statusLabel: (status: string) => string;
  };
};
