import { CommunicationError } from "../../shared/errors";
import { localeEsAR } from "./es-AR";
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type LocaleBundle,
  type SupportedLocale,
} from "./types";

const localeBundles: Record<SupportedLocale, LocaleBundle> = {
  "es-AR": localeEsAR,
};

export function resolveLocaleBundle(locale: string): LocaleBundle {
  if (!isSupportedLocale(locale)) {
    throw new CommunicationError(
      "LOCALE_NOT_SUPPORTED",
      `Locale no soportado: "${locale}". Soportados: ${SUPPORTED_LOCALES.join(", ")}.`,
      { locale },
    );
  }
  return localeBundles[locale];
}

export {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type LocaleBundle,
  type SupportedLocale,
} from "./types";
export { localeEsAR } from "./es-AR";
