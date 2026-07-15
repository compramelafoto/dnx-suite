export interface MpOrdersWebhookEnvelope {
  id?: number | string;
  live_mode?: boolean;
  type: string;
  date_created?: string;
  application_id?: number;
  user_id?: string;
  version?: number;
  api_version?: string;
  action?: string;
  data: {
    id: string;
  };
}

export type MpOrdersWebhookType = "order" | "payment" | string;
