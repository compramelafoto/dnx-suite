import { GiftRegistrationError } from "../application/create-gift-registration";
import { GiftRedeemError } from "../application/redeem-gift-voucher";

export type GiftActionState<T = unknown> = {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
  values?: Record<string, string>;
};

export function giftSuccess<T>(data?: T, message?: string): GiftActionState<T> {
  return { ok: true, data, message };
}

export function giftFailure<T = unknown>(
  error: unknown,
  values?: Record<string, string>,
): GiftActionState<T> {
  if (error instanceof GiftRegistrationError || error instanceof GiftRedeemError) {
    return { ok: false, code: error.code, message: error.message, values };
  }
  // Si no reconocimos el error, sin este log la causa real queda invisible.
  console.error("[clickaton] gift voucher UNEXPECTED:", error);
  return {
    ok: false,
    code: "UNEXPECTED",
    message: "No pudimos completar la operación. Probá de nuevo en un momento.",
    values,
  };
}

export function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export function formBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}
