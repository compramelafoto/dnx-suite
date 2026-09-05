export type MpOrderAmountType = "fixed" | "percentage";

export type MpOrderStatus =
  | "open"
  | "processed"
  | "refunded"
  | "charged_back"
  | "failed"
  | "canceled"
  | string;

export interface MpOrderPayer {
  email?: string;
  first_name?: string;
  last_name?: string;
  entity_type?: string;
  identification?: { type: string; number: string };
  phone?: { area_code?: string; number?: string };
  address?: Record<string, string>;
}

export interface MpOrderSplit {
  receiver_id: string;
  receiver_type: "owner" | "partner";
  amount: string;
  description?: string;
}

export interface MpOrderPaymentMethod {
  id?: string;
  type?: string;
  token?: string;
  installments?: number;
  statement_descriptor?: string;
}

export interface MpOrderCreateRequest {
  type: "online";
  external_reference: string;
  total_amount: string;
  processing_mode?: string;
  payer?: MpOrderPayer;
  transactions?: {
    payments: Array<{
      amount: string;
      payment_method: MpOrderPaymentMethod;
    }>;
  };
  config: {
    split_rules: {
      amount_type: MpOrderAmountType;
    };
  };
  splits: MpOrderSplit[];
  items?: Array<{
    title?: string;
    description?: string;
    category_id?: string;
    external_code?: string;
    quantity?: number;
    unit_price?: string;
  }>;
  /**
   * Do NOT put catalog `items` under additional_info — sandbox MP rejects
   * `additional_info.items` (Imp 05). Use top-level `items` only.
   */
  additional_info?: Record<string, unknown>;
  shipment?: { address?: Record<string, string> };
}

export interface MpOrderPayment {
  id: string;
  status: string;
  status_detail?: string;
  amount?: string;
  paid_amount?: string;
  refunded_amount?: string;
}

export interface MpOrderResponse {
  id: string;
  status: MpOrderStatus;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  currency?: string;
  site_id?: string;
  config?: { split_rules?: { amount_type?: MpOrderAmountType } };
  splits?: MpOrderSplit[];
  transactions?: { payments?: MpOrderPayment[]; refunds?: unknown[]; chargebacks?: unknown[] };
  integration_data?: { features?: string[]; application_id?: string };
}

export type MpOrderCreateResponse = MpOrderResponse;
