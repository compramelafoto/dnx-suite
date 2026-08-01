/** Contratos de dominio — pedidos TIENDA (sin Prisma en UI). */

export type StoreOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "PAYMENT_FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "READY_FOR_PICKUP"
  | "SHIPPED"
  | "DELIVERED";

export type StoreOrderPaymentStatus =
  | "CREATED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED"
  | "CHARGED_BACK"
  | "UNKNOWN";

export type StoreDeliveryMethod = "PICKUP" | "SHIPPING";

export type StoreHoldStatus = "ACTIVE" | "CAPTURED" | "RELEASED" | "EXPIRED";

export type StorePickupDeliveryData = {
  kind: "PICKUP";
  pickupPointId: string;
  pickupPointLabel: string;
  instructions: string;
  scheduleNote: string;
  pickupPersonName: string;
};

export type StoreShippingDeliveryData = {
  kind: "SHIPPING";
  street: string;
  number: string;
  floor?: string;
  city: string;
  province: string;
  postalCode: string;
  reference?: string;
};

export type StoreDeliveryData = StorePickupDeliveryData | StoreShippingDeliveryData;

export type StoreOrderLineSnapshot = {
  productId: string;
  productVariantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string | null;
  unitPriceAmount: number;
  quantity: number;
  lineSubtotalAmount: number;
  currency: string;
  imageUrlSnapshot: string | null;
  storeSlugSnapshot: string | null;
};

export type PublicStoreOrderView = {
  publicId: string;
  createdAt: string;
  status: StoreOrderStatus;
  paymentStatus: StoreOrderPaymentStatus;
  currency: string;
  subtotalAmount: number;
  deliveryAmount: number;
  totalAmount: number;
  deliveryMethod: StoreDeliveryMethod;
  deliverySummary: string;
  customer: {
    firstName: string;
    lastName: string;
    emailMasked: string;
    phoneMasked: string;
  };
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitPriceAmount: number;
    lineSubtotalAmount: number;
    currency: string;
    imageUrl: string | null;
  }>;
  holdExpiresAt: string | null;
  canRetryPayment: boolean;
  operationalNotes: string[];
  legalVersion: string;
  commercialFingerprint: string;
};

export type CreateStoreOrderResult = {
  publicId: string;
  accessToken: string;
  status: StoreOrderStatus;
  paymentStatus: StoreOrderPaymentStatus;
  checkoutUrl: string | null;
  totalAmount: number;
  currency: string;
  holdExpiresAt: string;
  reused: boolean;
  commercialFingerprint: string;
};
