export interface MpRefundRequest {
  order_id: string;
  amount?: string;
  receiver_id?: string;
}

export interface MpRefundResponse {
  id: string;
  status: string;
  amount?: string;
}
