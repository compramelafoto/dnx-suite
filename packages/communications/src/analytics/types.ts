import type { CommunicationChannel } from "../shared/channels";
import type { CommunicationMetadata } from "../shared/types";
import type { TrackingEventType } from "../tracking/types";

export type AnalyticsMetricName =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "failed";

export type AnalyticsDimension = {
  channel?: CommunicationChannel;
  providerName?: string;
  templateKey?: string;
  campaignId?: string;
  sourceApp?: string;
  locale?: string;
};

export type AnalyticsDatapoint = {
  metric: AnalyticsMetricName;
  value: number;
  at: Date;
  dimensions?: AnalyticsDimension;
  metadata?: CommunicationMetadata;
};

export type AnalyticsQuery = {
  from: Date;
  to: Date;
  metrics?: AnalyticsMetricName[];
  dimensions?: AnalyticsDimension;
};

export type AnalyticsQueryResult = {
  datapoints: AnalyticsDatapoint[];
};

/**
 * Puerto de analytics. Sin implementación de warehouse en etapa 01.
 */
export interface CommunicationAnalytics {
  track(datapoint: AnalyticsDatapoint): Promise<void>;
  query(query: AnalyticsQuery): Promise<AnalyticsQueryResult>;
  /** Puente opcional desde tracking events. */
  ingestTracking?(
    type: TrackingEventType,
    dimensions?: AnalyticsDimension,
  ): Promise<void>;
}
