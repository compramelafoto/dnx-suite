/** Lo que se usa de la API interna de Alboom. Todo llega como texto, incluidos los números. */
export type AlboomLeadRow = {
  id: string;
  name: string;
  description: string | null;
  status_id: string;
  pipeline_id: string;
  stage_id: string;
  created: string;
  modified: string;
  event_date: string | null;
  place_event: string | null;
  city_event: string | null;
  guests: string | null;
  quote_sent_date: string | null;
  lead_origin: string | null;
  customer_name: string | null;
  customer_lastname: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_cellular: string | null;
  pipeline_name: string | null;
  stage_name: string | null;
  stages_count: string | null;
  [otro: string]: unknown;
};

export type AlboomActivity = { text: string; created: string };
export type AlboomMail = { subject: string | null; body: string | null; created: string; message_type?: string };

export type AlboomStagesList = {
  stage_list: { id: string; name: string }[];
  stages: Record<string, { id: string; stage: string; name: string }[]>;
};

export const ALBOOM_STATUS_ABIERTO = "421";
