import type { CommunicationChannel } from "../shared/channels";
import type { CommunicationMetadata } from "../shared/types";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type Campaign = {
  id: string;
  key: string;
  name: string;
  status: CampaignStatus;
  channel: CommunicationChannel;
  templateKey?: string;
  segmentId?: string;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: CommunicationMetadata;
};

/**
 * Puerto de campañas. Sin creación/ejecución real en etapa 01.
 */
export interface CampaignService {
  create(input: Omit<Campaign, "id" | "createdAt" | "updatedAt" | "status"> & {
    status?: CampaignStatus;
  }): Promise<Campaign>;
  get(id: string): Promise<Campaign | undefined>;
  list(): Promise<Campaign[]>;
}
