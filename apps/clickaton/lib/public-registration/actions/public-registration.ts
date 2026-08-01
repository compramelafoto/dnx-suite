"use server";

import type {
  CreatePublicRegistrationInput,
  PublicRegistrationContextDto,
  PublicRegistrationOffer,
  PublicRegistrationSummaryDto,
} from "../domain/types";
import { formBool, formString, pubFailure, pubSuccess, type PublicRegistrationActionState } from "./action-result";
import { getPublicRegistrationService } from "./runtime";

export async function getPublicRegistrationOfferAction(
  slug: string,
): Promise<PublicRegistrationActionState<PublicRegistrationOffer>> {
  try {
    const data = await getPublicRegistrationService().getOffer(slug);
    return pubSuccess(data);
  } catch (error) {
    return pubFailure<PublicRegistrationOffer>(error);
  }
}

export async function getPublicRegistrationContextAction(
  slug: string,
): Promise<PublicRegistrationActionState<PublicRegistrationContextDto>> {
  try {
    const data = await getPublicRegistrationService().getContext(slug);
    return pubSuccess(data);
  } catch (error) {
    return pubFailure<PublicRegistrationContextDto>(error);
  }
}

export async function getPublicTicketAvailabilityAction(
  slug: string,
  ticketTypeId: string,
): Promise<
  PublicRegistrationActionState<{
    ticketTypeId: string;
    available: number | null;
    isSoldOut: boolean;
    salesStatus: string;
    priceAmount: number;
  }>
> {
  try {
    const ctx = await getPublicRegistrationService().getContext(slug);
    const ticket = ctx.tickets.find((t) => t.id === ticketTypeId);
    if (!ticket) {
      return {
        ok: false,
        code: "TICKET_NOT_AVAILABLE",
        message: "La entrada no está disponible.",
      };
    }
    return pubSuccess({
      ticketTypeId: ticket.id,
      available: ticket.available,
      isSoldOut: ticket.isSoldOut,
      salesStatus: ticket.salesStatus,
      priceAmount: ticket.priceAmount,
    });
  } catch (error) {
    return pubFailure(error);
  }
}

export async function createPublicRegistrationAction(
  _prev: PublicRegistrationActionState | undefined,
  formData: FormData,
): Promise<PublicRegistrationActionState<PublicRegistrationSummaryDto>> {
  const variantRaw = formString(formData, "variantChoices");
  let variantChoices: Array<{ productId: string; productVariantId: string }> = [];
  try {
    if (variantRaw) variantChoices = JSON.parse(variantRaw) as typeof variantChoices;
  } catch {
    variantChoices = [];
  }

  const input: CreatePublicRegistrationInput = {
    editionSlug: formString(formData, "editionSlug"),
    venueId: formString(formData, "venueId") || null,
    ticketTypeId: formString(formData, "ticketTypeId"),
    variantChoices,
    participant: {
      firstName: formString(formData, "firstName"),
      lastName: formString(formData, "lastName"),
      email: formString(formData, "email"),
      phone: formString(formData, "phone") || undefined,
      documentNumber: formString(formData, "documentNumber") || undefined,
      city: formString(formData, "city") || undefined,
      province: formString(formData, "province") || undefined,
      country: formString(formData, "country") || "AR",
      birthDate: formString(formData, "birthDate") || undefined,
      emergencyContactName: formString(formData, "emergencyContactName") || undefined,
      emergencyContactPhone: formString(formData, "emergencyContactPhone") || undefined,
    },
    acceptTerms: formBool(formData, "acceptTerms"),
    acceptPrivacy: formBool(formData, "acceptPrivacy"),
    acceptImage: formBool(formData, "acceptImage"),
    instagramHandle: formString(formData, "instagramHandle"),
    profilePhotoAssetId: formString(formData, "profilePhotoAssetId"),
    imageUsageConsent: formBool(formData, "imageUsageConsent"),
    socialPublicationConsent: formBool(formData, "socialPublicationConsent"),
    identifiablePersonsConsent: formBool(formData, "identifiablePersonsConsent"),
    promotionalLicenseConsent: formBool(formData, "promotionalLicenseConsent"),
    consentVersion: formString(formData, "consentVersion") || "2026-08-social-v1",
    termsVersion:
      formString(formData, "termsVersion") || "CLICKATON_TERMS_2026_09_19_v2",
    idempotencyKey: formString(formData, "idempotencyKey"),
    promoCode: formString(formData, "promoCode") || null,
    usePassCredit: formBool(formData, "usePassCredit"),
    passEntitlementId: formString(formData, "passEntitlementId") || null,
  };

  const values: Record<string, string> = {
    firstName: input.participant.firstName,
    lastName: input.participant.lastName,
    email: input.participant.email,
    phone: input.participant.phone ?? "",
    venueId: input.venueId ?? "",
    ticketTypeId: input.ticketTypeId,
    instagramHandle: input.instagramHandle ?? "",
  };

  try {
    const data = await getPublicRegistrationService().createRegistration(input);
    return pubSuccess(data, "Inscripción reservada.");
  } catch (error) {
    return pubFailure<PublicRegistrationSummaryDto>(error, values);
  }
}

export async function getPublicRegistrationSummaryAction(
  registrationId: string,
  accessToken: string,
  editionSlug: string,
): Promise<PublicRegistrationActionState<PublicRegistrationSummaryDto>> {
  try {
    const data = await getPublicRegistrationService().getSummary({
      registrationId,
      accessToken,
      editionSlug,
    });
    return pubSuccess(data);
  } catch (error) {
    return pubFailure<PublicRegistrationSummaryDto>(error);
  }
}

export async function getRegistrationCheckoutEligibilityAction(
  registrationId: string,
  accessToken: string,
  editionSlug: string,
): Promise<PublicRegistrationActionState<import("../domain/types").CheckoutEligibilityDto>> {
  try {
    const data = await getPublicRegistrationService().getRegistrationCheckoutEligibility({
      registrationId,
      accessToken,
      editionSlug,
    });
    return pubSuccess(data);
  } catch (error) {
    return pubFailure(error);
  }
}
