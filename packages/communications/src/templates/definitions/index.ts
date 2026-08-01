export {
  COMMUNICATION_TEMPLATE_IDS,
  asRecord,
  optionalStringField,
  requireStringField,
  type AnyCommunicationTemplateDefinition,
  type CommunicationTemplateDefinition,
  type CommunicationTemplateId,
  type CommunicationTemplatePayloadMap,
  type RegisterTemplateOptions,
  type TemplatePayloadValidationResult,
  type TemplateRenderContext,
} from "./types";

export { systemTestTemplate } from "./system-test";
export { userWelcomeTemplate } from "./user-welcome";

import { systemTestTemplate } from "./system-test";
import { userWelcomeTemplate } from "./user-welcome";
import type { AnyCommunicationTemplateDefinition } from "./types";

export const DEFAULT_TEMPLATES: AnyCommunicationTemplateDefinition[] = [
  systemTestTemplate as unknown as AnyCommunicationTemplateDefinition,
  userWelcomeTemplate as unknown as AnyCommunicationTemplateDefinition,
];
