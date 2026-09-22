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
 * que pertenecer a la sesión (mismo `userId`, o mismo email normalizado),
 * con la misma regla de propiedad que ya aplica
 * `app/(public)/mi-cuenta/inscripciones/[id]/page.tsx`. Si no es dueño, la
 * acción devuelve error y no toca la base.
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
      edition: { select: { startAt: true } },
    },
  });
  if (!actual) return { ok: false, message: "No encontramos la inscripción." };

  // Misma regla de propiedad que la página de Mi cuenta: la sesión tiene que
  // ser la dueña. Conocer el id de otra inscripción no autoriza nada.
  const owns =
    actual.userId === user.id ||
    actual.email.toLowerCase() === user.email.toLowerCase();
  if (!owns) {
    return { ok: false, message: "No podés modificar esta inscripción." };
  }

  const requested = {
    personal: formData.get("locationConsent") === "true",
    publicMap: formData.get("locationPublicConsent") === "true",
    interview: formData.get("interviewConsent") === "true",
    declaredAdult: formData.get("locationDeclaredAdult") === "true",
  };

  const now = new Date();
  const fields = resolveLocationConsent({
    choices: requested,
    birthDate: actual.birthDate,
    eventDate: actual.edition?.startAt ?? now,
    now,
    previous: {
      locationConsentAt: actual.locationConsentAt,
      locationPublicConsentAt: actual.locationPublicConsentAt,
      interviewConsentAt: actual.interviewConsentAt,
      locationConsentVersion: actual.locationConsentVersion,
    },
  });

  await prisma.clickatonRegistration.update({
    where: { id: registrationId },
    data: {
      ...fields,
      locationConsentDeclaredAdult: requested.declaredAdult,
    },
  });

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
