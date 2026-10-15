"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@repo/db";

import { getClickatonAuthUser } from "@/lib/admin/auth";

import { resolveLocationConsent } from "../domain/location-consent";

/**
 * El estado real de las tres casillas, tal como quedó en la base después de
 * aplicar `resolveLocationConsent`. El panel de Mi cuenta lo usa para
 * reflejar en pantalla lo que efectivamente se guardó, no lo que el
 * participante tildó: el dominio puede denegar en silencio (un menor nunca
 * queda con el mapa público activo, aunque lo haya pedido).
 */
export type LocationConsentActionValues = {
  personal: boolean;
  publicMap: boolean;
  interview: boolean;
};

export type UpdateLocationConsentResult = {
  ok: boolean;
  message?: string;
  /** Sólo presente cuando `ok` es true: el estado que quedó guardado. */
  values?: LocationConsentActionValues;
};

/** Un solo texto para "no existe" y para "no es tuya": no hay que darle a
 * quien no es dueño una forma de distinguir un id inválido de uno ajeno. */
const NO_ENCONTRADA_O_AJENA = "No encontramos esa inscripción.";

/**
 * Da o revoca los consentimientos de ubicación de una inscripción propia,
 * desde Mi cuenta. Pensada para recuperar a quienes se inscribieron antes de
 * que estas casillas existieran.
 *
 * La acción no reimplementa ninguna regla: lee el estado actual de la
 * inscripción, se lo pasa a `resolveLocationConsent` como `previous`, y
 * guarda exactamente lo que el dominio devuelve.
 *
 * Seguridad: conocer el `registrationId` no alcanza. La inscripción tiene
 * que pertenecer a la sesión. Por `userId` alcanza; por email sólo si ese
 * email está verificado en la sesión actual — la cuenta se puede crear y
 * abrir sesión sin verificar el email (`crear-cuenta/actions.ts`), y la
 * mayoría de las inscripciones públicas nacen con `userId` nulo, así que
 * aceptar un email sin verificar dejaría a cualquiera que conozca el email
 * de otra persona prender o apagar sus permisos de ubicación. La página de
 * sólo lectura (`app/(public)/mi-cuenta/inscripciones/[id]/page.tsx`) puede
 * seguir usando la regla más laxa: ahí sólo se lee, acá se escribe.
 */
export async function updateLocationConsentAction(
  formData: FormData,
): Promise<UpdateLocationConsentResult> {
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!registrationId) {
    return { ok: false, message: "Falta la inscripción." };
  }

  const user = await getClickatonAuthUser();
  if (!user) return { ok: false, message: "Iniciá sesión para cambiar esto." };

  const actual = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      userId: true,
      email: true,
      birthDate: true,
      locationConsentAt: true,
      locationPublicConsentAt: true,
      interviewConsentAt: true,
      locationConsentVersion: true,
      locationConsentDeclaredAdult: true,
      adultResponsibleName: true,
      adultResponsibleContact: true,
      adultAuthorizationAcceptedAt: true,
      accompanimentConfirmed: true,
      edition: { select: { startAt: true } },
    },
  });
  if (!actual) return { ok: false, message: NO_ENCONTRADA_O_AJENA };

  // Por userId alcanza. Por email, sólo si la sesión lo tiene verificado:
  // ver la nota de seguridad arriba.
  const owns =
    actual.userId === user.id ||
    (user.emailVerifiedAt !== null &&
      actual.email.toLowerCase() === user.email.toLowerCase());
  if (!owns) {
    return { ok: false, message: NO_ENCONTRADA_O_AJENA };
  }

  const requested = {
    personal: formData.get("locationConsent") === "true",
    publicMap: formData.get("locationPublicConsent") === "true",
    interview: formData.get("interviewConsent") === "true",
    declaredAdult: formData.get("locationDeclaredAdult") === "true",
  };

  const now = new Date();
  const previous = {
    locationConsentAt: actual.locationConsentAt,
    locationPublicConsentAt: actual.locationPublicConsentAt,
    interviewConsentAt: actual.interviewConsentAt,
    locationConsentVersion: actual.locationConsentVersion,
    locationConsentDeclaredAdult: actual.locationConsentDeclaredAdult,
  };
  const fields = resolveLocationConsent({
    choices: requested,
    birthDate: actual.birthDate,
    eventDate: actual.edition?.startAt ?? now,
    now,
    previous,
    adultResponsible: {
      name: actual.adultResponsibleName,
      contact: actual.adultResponsibleContact,
      authorizedAt: actual.adultAuthorizationAcceptedAt,
      accompanimentConfirmed: actual.accompanimentConfirmed,
    },
  });

  // Una fila por cambio, con el estado anterior y el nuevo — mismo patrón
  // que ya usan `confirm-free-registration.ts` y `accreditation/service.ts`
  // con `ClickatonRegistrationAudit`. Revocar deja los campos en null, así
  // que sin esta fila no quedaría rastro de que alguna vez hubo
  // consentimiento ni de cuándo se retractó.
  await prisma.$transaction([
    prisma.clickatonRegistration.update({
      where: { id: registrationId },
      data: fields,
    }),
    prisma.clickatonRegistrationAudit.create({
      data: {
        registrationId,
        actorUserId: user.id,
        action: "LOCATION_CONSENT_UPDATED",
        source: "mi_cuenta",
        metadata: {
          previous: {
            personal: previous.locationConsentAt?.toISOString() ?? null,
            publicMap: previous.locationPublicConsentAt?.toISOString() ?? null,
            interview: previous.interviewConsentAt?.toISOString() ?? null,
            version: previous.locationConsentVersion,
          },
          next: {
            personal: fields.locationConsentAt?.toISOString() ?? null,
            publicMap: fields.locationPublicConsentAt?.toISOString() ?? null,
            interview: fields.interviewConsentAt?.toISOString() ?? null,
            version: fields.locationConsentVersion,
          },
        },
      },
    }),
  ]);

  revalidatePath(`/mi-cuenta/inscripciones/${registrationId}`);

  // Lo que efectivamente quedó guardado, no lo que se pidió: el dominio
  // puede denegar en silencio (por ejemplo, el mapa público si sos menor).
  const values: LocationConsentActionValues = {
    personal: fields.locationConsentAt !== null,
    publicMap: fields.locationPublicConsentAt !== null,
    interview: fields.interviewConsentAt !== null,
  };

  // El único permiso que el dominio puede denegar aunque se lo pida es el
  // mapa público (exige mayoría de edad y no ser menor). Si eso pasó, que el
  // mensaje lo diga en vez de un "Guardado." que tape la diferencia.
  const publicMapDenied = requested.publicMap && !values.publicMap;

  return {
    ok: true,
    values,
    message: publicMapDenied
      ? "Guardado. El mapa público no quedó activo: hace falta declarar mayoría de edad y no figurar como menor."
      : undefined,
  };
}
