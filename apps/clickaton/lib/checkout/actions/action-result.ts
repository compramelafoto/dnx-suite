import { toSerializableCheckoutError } from "../domain/errors";

export type CheckoutActionState<T = unknown> = {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
};

export function checkoutSuccess<T>(data: T): CheckoutActionState<T> {
  return { ok: true, data };
}

export function checkoutFailure<T = unknown>(error: unknown): CheckoutActionState<T> {
  const s = toSerializableCheckoutError(error);
  return { ok: false, code: s.code, message: s.message };
}
