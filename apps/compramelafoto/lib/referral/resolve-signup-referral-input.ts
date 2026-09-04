import {
  getReferralCodeFromRequest,
  getReferralMetaFromRequest,
} from "@/lib/referral-cookie-server";

export type SignupReferralInput = {
  refCode: string;
  sourceTypeRaw: string;
  sourceEntityRaw: unknown;
};

type SignupBody = {
  ref?: unknown;
  sourceType?: unknown;
  sourceEntityId?: unknown;
};

/**
 * Resuelve el referido de un alta: gana lo que mande el formulario y, si no
 * viene nada, se usa la cookie clf_ref que dejó el middleware al abrir el link.
 *
 * El fallback a cookie evita perder la atribución cuando el front no reenvía
 * el ref (pasó con el registro de fotógrafo por email).
 */
export function resolveSignupReferralInput(
  req: Request,
  body: SignupBody
): SignupReferralInput {
  const refFromBody = (body.ref ?? "").toString().trim();
  const refCode = refFromBody || getReferralCodeFromRequest(req) || "";

  const sourceTypeFromBody = (body.sourceType ?? "").toString().trim();
  const hasSourceFromBody = !!sourceTypeFromBody;
  const metaFromCookie = hasSourceFromBody ? null : getReferralMetaFromRequest(req);

  return {
    refCode,
    sourceTypeRaw: sourceTypeFromBody || metaFromCookie?.sourceType || "",
    sourceEntityRaw: hasSourceFromBody
      ? body.sourceEntityId
      : (metaFromCookie?.sourceEntityId ?? undefined),
  };
}
