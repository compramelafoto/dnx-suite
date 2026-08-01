"use server";

import { redirect } from "next/navigation";
import type {
  CheckoutRedirectDto,
  CheckoutReturnDto,
  RegistrationPaymentStatusDto,
} from "../domain/types";
import { checkoutFailure, checkoutSuccess, type CheckoutActionState } from "./action-result";
import { getCheckoutServiceReady } from "./runtime";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createRegistrationCheckoutAction(
  _prev: CheckoutActionState<CheckoutRedirectDto> | undefined,
  formData: FormData,
): Promise<CheckoutActionState<CheckoutRedirectDto>> {
  try {
    const registrationId = formString(formData, "registrationId");
    const editionSlug = formString(formData, "editionSlug");
    const accessToken = formString(formData, "accessToken");
    const data = await (await getCheckoutServiceReady()).createCheckout({
      registrationId,
      editionSlug,
      accessToken,
    });
    return checkoutSuccess(data);
  } catch (error) {
    return checkoutFailure(error);
  }
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** CTA: crea/reutiliza orden y redirige al checkout URL del proveedor (vía DNX Payments). */
export async function startRegistrationCheckoutAction(formData: FormData): Promise<void> {
  const registrationId = formString(formData, "registrationId");
  const editionSlug = formString(formData, "editionSlug");
  const accessToken = formString(formData, "accessToken");
  try {
    const data = await (await getCheckoutServiceReady()).createCheckout({
      registrationId,
      editionSlug,
      accessToken,
    });
    redirect(data.checkoutUrl);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const fail = checkoutFailure(error);
    const q = new URLSearchParams({
      registrationId,
      t: accessToken,
      err: fail.code ?? "UNEXPECTED",
    });
    redirect(`/maratones/${editionSlug}/inscripcion/pago/error?${q.toString()}`);
  }
}

export async function getRegistrationPaymentStatusAction(
  registrationId: string,
  accessToken: string,
  editionSlug: string,
): Promise<CheckoutActionState<RegistrationPaymentStatusDto>> {
  try {
    const data = await (await getCheckoutServiceReady()).getPaymentStatus({
      registrationId,
      editionSlug,
      accessToken,
    });
    return checkoutSuccess(data);
  } catch (error) {
    return checkoutFailure(error);
  }
}

export async function refreshRegistrationPaymentStatusAction(
  registrationId: string,
  accessToken: string,
  editionSlug: string,
): Promise<CheckoutActionState<RegistrationPaymentStatusDto>> {
  try {
    const data = await (await getCheckoutServiceReady()).refreshPaymentStatus({
      registrationId,
      editionSlug,
      accessToken,
    });
    return checkoutSuccess(data);
  } catch (error) {
    return checkoutFailure(error);
  }
}

export async function getRegistrationCheckoutResultAction(
  registrationId: string,
  accessToken: string,
  editionSlug: string,
): Promise<CheckoutActionState<CheckoutReturnDto>> {
  try {
    const data = await (await getCheckoutServiceReady()).getCheckoutReturn({
      registrationId,
      editionSlug,
      accessToken,
    });
    return checkoutSuccess(data);
  } catch (error) {
    return checkoutFailure(error);
  }
}
