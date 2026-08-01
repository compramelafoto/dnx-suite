import type { CommunicationChannel } from "../shared/channels";
import type { CommunicationMetadata } from "../shared/types";

export type PreferenceTopic =
  | "transactional"
  | "marketing"
  | "product_updates"
  | "contest"
  | "billing"
  | "security";

export type ChannelPreference = {
  channel: CommunicationChannel;
  enabled: boolean;
  topics?: Partial<Record<PreferenceTopic, boolean>>;
};

export type CommunicationPreferences = {
  subjectId: string;
  locale?: string;
  channels: ChannelPreference[];
  updatedAt: Date;
  metadata?: CommunicationMetadata;
};

/**
 * Puerto de preferencias / consentimiento.
 * Implementación y UI en etapas posteriores.
 */
export interface CommunicationPreferencesStore {
  get(subjectId: string): Promise<CommunicationPreferences | undefined>;
  upsert(preferences: CommunicationPreferences): Promise<CommunicationPreferences>;
  isAllowed(input: {
    subjectId: string;
    channel: CommunicationChannel;
    topic?: PreferenceTopic;
  }): Promise<boolean>;
}
