import type { CommunicationChannel } from "../shared/channels";
import type { CommunicationEvent, CommunicationMetadata } from "../shared/types";
import type { CommunicationEventType } from "../events/catalog";

export type AutomationRuleStatus = "draft" | "active" | "paused" | "archived";

export type AutomationAction = {
  type: "send" | "schedule" | "enqueue";
  channel: CommunicationChannel;
  templateKey?: string;
  delaySeconds?: number;
  metadata?: CommunicationMetadata;
};

export type AutomationRule = {
  id: string;
  key: string;
  name: string;
  status: AutomationRuleStatus;
  triggerEvent: CommunicationEventType | string;
  actions: AutomationAction[];
  metadata?: CommunicationMetadata;
};

/**
 * Puerto de automatizaciones. Sin workers en etapa 01.
 */
export interface CommunicationAutomationEngine {
  registerRule(rule: AutomationRule): void;
  getRule(key: string): AutomationRule | undefined;
  listRules(): AutomationRule[];
  /**
   * Evalúa un evento y devuelve acciones planificadas (sin ejecutar envíos reales
   * hasta que la fachada / workers estén cableados).
   */
  evaluate(event: CommunicationEvent): Promise<AutomationAction[]>;
}
