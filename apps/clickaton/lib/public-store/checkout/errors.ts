export type StoreCheckoutErrorCode =
  | "CHECKOUT_DISABLED"
  | "CART_EMPTY"
  | "CART_INVALID"
  | "STOCK_INSUFFICIENT"
  | "PRICE_CHANGED"
  | "VARIANT_INVALID"
  | "PRODUCT_HIDDEN"
  | "PAYLOAD_REJECTED"
  | "LEGAL_REQUIRED"
  | "DELIVERY_UNSUPPORTED"
  | "CUSTOMER_INVALID"
  | "IDEMPOTENCY_CONFLICT"
  | "RATE_LIMITED"
  | "COLLECTOR_UNAVAILABLE"
  | "PAYMENT_UNAVAILABLE"
  | "ORDER_NOT_FOUND"
  | "ACCESS_DENIED"
  | "HOLD_EXPIRED"
  | "ORDER_NOT_PAYABLE"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "INTERNAL";

export class StoreCheckoutError extends Error {
  readonly code: StoreCheckoutErrorCode;
  readonly httpStatus: number;

  constructor(code: StoreCheckoutErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = "StoreCheckoutError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function storeCheckoutPublicMessage(code: StoreCheckoutErrorCode): string {
  switch (code) {
    case "CHECKOUT_DISABLED":
      return "El checkout de la tienda no está habilitado en este momento.";
    case "CART_EMPTY":
      return "Tu carrito está vacío.";
    case "CART_INVALID":
      return "Hay productos en el carrito que deben corregirse antes de continuar.";
    case "STOCK_INSUFFICIENT":
      return "No hay stock suficiente para completar la compra.";
    case "PRICE_CHANGED":
      return "El precio de algún producto cambió. Revisá el carrito.";
    case "VARIANT_INVALID":
      return "Una variante seleccionada ya no está disponible.";
    case "PRODUCT_HIDDEN":
      return "Un producto del carrito ya no está a la venta.";
    case "PAYLOAD_REJECTED":
      return "Los datos enviados no son válidos.";
    case "LEGAL_REQUIRED":
      return "Debés aceptar los términos para continuar.";
    case "DELIVERY_UNSUPPORTED":
      return "La modalidad de entrega seleccionada no está disponible.";
    case "CUSTOMER_INVALID":
      return "Revisá tus datos de contacto.";
    case "IDEMPOTENCY_CONFLICT":
      return "Ya existe una orden con esos datos. Revisá tu pedido o reintentá.";
    case "RATE_LIMITED":
      return "Demasiados intentos. Esperá un momento y reintentá.";
    case "COLLECTOR_UNAVAILABLE":
      return "El cobro no está disponible temporalmente.";
    case "PAYMENT_UNAVAILABLE":
      return "No se pudo iniciar el pago. Reintentá en unos minutos.";
    case "ORDER_NOT_FOUND":
      return "No encontramos ese pedido.";
    case "ACCESS_DENIED":
      return "No tenés acceso a este pedido.";
    case "HOLD_EXPIRED":
      return "La reserva de stock venció. Volvé a confirmar la compra.";
    case "ORDER_NOT_PAYABLE":
      return "Este pedido no admite un nuevo intento de pago.";
    case "AMOUNT_MISMATCH":
      return "El importe no coincide. Contactá soporte si el cobro figura aprobado.";
    case "CURRENCY_MISMATCH":
      return "La moneda del pago no es válida.";
    default:
      return "No se pudo completar la operación. Reintentá más tarde.";
  }
}
