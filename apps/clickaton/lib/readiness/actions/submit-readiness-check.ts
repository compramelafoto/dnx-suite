"use server";

import { prisma, withClickatonDb } from "@/lib/admin/db";
import { verifyRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";
import { readinessCopy } from "@/lib/readiness/content/readiness-copy";
import { evaluateReadiness, type ReadinessVerdict } from "@/lib/readiness/domain/readiness";

/**
 * Sobre la confianza en estos cuatro datos (`hasGps`, `captureAtMs`, `width`,
 * `height`): los manda el navegador y se podrían falsear. Es una decisión
 * tomada, no un descuido: acá no hay adversario, el participante quiere
 * saber la verdad sobre su propio teléfono, nada depende del resultado y no
 * hay premio ni elegibilidad en juego. Por eso esta acción NUNCA pide la
 * foto en sí — ni bytes, ni miniatura, ni un `File` dentro del `FormData` —
 * para "verificar" estos números: eso sería justo el diseño que se quiso
 * evitar. Lo único que sí se valida, porque protege datos de otra persona,
 * es el token de acceso.
 */

export type SubmitReadinessCheckResult =
  | { ok: true; verdict: ReadinessVerdict }
  | { ok: false; message: string };

function requiredString(raw: FormDataEntryValue | null): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Números que vienen del navegador: nunca `Number(x)` a ciegas. Lo que no se
 * puede leer como número finito (vacío, ausente, "NaN", texto suelto) vuelve
 * `null` en vez de colarse como 0 o como `NaN` silencioso.
 */
function parseFiniteNumber(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function submitReadinessCheckAction(
  formData: FormData,
): Promise<SubmitReadinessCheckResult> {
  const registrationId = requiredString(formData.get("registrationId"));
  const editionSlug = requiredString(formData.get("editionSlug"));
  const token = requiredString(formData.get("token"));
  if (!registrationId || !editionSlug || !token) {
    return { ok: false, message: readinessCopy.check.missingDataMessage };
  }

  const hasGps = formData.get("hasGps") === "true";
  const captureAtMs = parseFiniteNumber(formData.get("captureAtMs"));
  // Ancho y alto son obligatorios para `evaluateReadiness`: si no se pudieron
  // leer, quedan en `NaN` — el propio dominio los traduce en el veredicto
  // FAILED ("no pudimos leer la foto"), en vez de que esta acción los
  // rechace por su cuenta con una regla distinta.
  const width = parseFiniteNumber(formData.get("width")) ?? NaN;
  const height = parseFiniteNumber(formData.get("height")) ?? NaN;

  // El propósito viaja explícito acá: por default, `verifyRegistrationAccessToken`
  // verifica el propósito "summary" (compatibilidad con enlaces viejos). Sin
  // este `purpose: "readiness"`, un token filtrado de la pantalla de resumen
  // de la inscripción abriría este chequeo y escribiría filas a nombre de
  // esa inscripción — exactamente lo que la tarea 3 separó para evitar.
  const verification = verifyRegistrationAccessToken({
    registrationId,
    editionSlug,
    token,
    purpose: "readiness",
  });
  if (!verification.ok) {
    return { ok: false, message: readinessCopy.check.invalidTokenMessage };
  }

  // Las dos migraciones de esta etapa todavía no están aplicadas en ninguna
  // base, y el mail ya reparte este enlace: sin `withClickatonDb`, un P2021
  // (tabla ausente) o un P2022 (columna ausente) se escapa hasta el catch del
  // componente, que lo anuncia como "no pudimos leer esa foto" — un
  // diagnóstico falso sobre el teléfono del participante.
  const consulta = await withClickatonDb(() =>
    prisma.clickatonRegistration.findUnique({
      where: { id: registrationId },
      select: {
        editionId: true,
        edition: {
          select: {
            slug: true,
            uploadConfig: {
              select: {
                captureClockToleranceMinutes: true,
                minWidth: true,
                minHeight: true,
              },
            },
          },
        },
      },
    }),
  );
  if (!consulta.ok) {
    return { ok: false, message: readinessCopy.check.unavailableMessage };
  }

  const registration = consulta.data;
  if (!registration || registration.edition.slug !== editionSlug) {
    return { ok: false, message: readinessCopy.check.registrationNotFoundMessage };
  }

  const limits = {
    toleranceMinutes:
      registration.edition.uploadConfig?.captureClockToleranceMinutes ?? 5,
    minWidth: registration.edition.uploadConfig?.minWidth ?? 800,
    minHeight: registration.edition.uploadConfig?.minHeight ?? 600,
  };

  const verdict = evaluateReadiness({
    measurements: { hasGps, captureAtMs, width, height },
    limits,
    serverNowMs: Date.now(),
  });

  // Nunca se crea/reemplaza `ClickatonPhotoSubmission`: esto es sólo un
  // chequeo, no un envío de concurso.
  const guardado = await withClickatonDb(() =>
    prisma.clickatonReadinessCheck.create({
      data: {
        editionId: registration.editionId,
        registrationId,
        hasGps,
        clockDeltaMinutes: verdict.clockDeltaMinutes,
        imageWidth: Number.isFinite(width) ? Math.round(width) : null,
        imageHeight: Number.isFinite(height) ? Math.round(height) : null,
        result: verdict.result,
        detail: { problems: verdict.problems },
      },
    }),
  );
  if (!guardado.ok) {
    return { ok: false, message: readinessCopy.check.unavailableMessage };
  }

  return { ok: true, verdict };
}
