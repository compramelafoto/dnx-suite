export {
  createEmailTemplateEngine,
  createStubTemplateEngine,
  EmailTemplateEngine,
  StubTemplateEngine,
  type EmailTemplateEngineOptions,
  type TemplateEngine,
} from "./engine";

export type {
  EmailTemplateRenderInput,
  TemplateBranding,
  TemplateComponent,
  TemplateHelper,
  TemplateLayout,
  TemplateRenderContext,
  TemplateRenderResult,
} from "./types";

export {
  CommunicationTemplateRegistry,
  createTemplateRegistry,
} from "./registry";

export {
  COMMUNICATION_BRAND_IDS,
  CLICKATON_BRAND,
  COMPRAMELAFOTO_BRAND,
  CommunicationBrandRegistry,
  createBrandRegistry,
  DEFAULT_BRANDS,
  DNX_BRAND,
  type CommunicationBrand,
  type CommunicationBrandId,
  type RegisterBrandOptions,
} from "./branding/index";

export {
  COMMUNICATION_TEMPLATE_IDS,
  DEFAULT_TEMPLATES,
  systemTestTemplate,
  userWelcomeTemplate,
  type AnyCommunicationTemplateDefinition,
  type CommunicationTemplateDefinition,
  type CommunicationTemplateId,
  type CommunicationTemplatePayloadMap,
  type RegisterTemplateOptions,
  type TemplatePayloadValidationResult,
  type TemplateRenderContext as TypedTemplateRenderContext,
} from "./definitions/index";

export {
  isSupportedLocale,
  localeEsAR,
  resolveLocaleBundle,
  SUPPORTED_LOCALES,
  type LocaleBundle,
  type SupportedLocale,
} from "./locales/index";

export {
  EmailButton,
  EmailDivider,
  EmailFooter,
  EmailHeader,
  EmailHeading,
  EmailInfoBox,
  EmailLayout,
  EmailParagraph,
  EmailPreheader,
} from "./components/index";

export { escapeHtml, escapeHtmlAttribute, toPlainText } from "./security/escape";
export { assertSafeUrl, trySafeUrl, type SafeUrlOptions } from "./security/urls";
