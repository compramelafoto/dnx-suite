/**
 * Resuelve qué le muestra la página pública de verificación
 * (`/diplomas/verificar/[token]`) a quien escanea el QR de un diploma
 * impreso: alguien de afuera de Clickatón, sin sesión.
 *
 * Tres estados, nada más:
 * - `VALID`: el diploma existe y sigue vigente (`revokedAt` nulo).
 * - `REVOKED`: existe, pero fue revocado — no confirma que sea válido.
 * - `NOT_FOUND`: no hay ningún diploma con ese token.
 *
 * Nunca expone datos de contacto (email, teléfono, documento, código de
 * inscripción interno): sólo lo necesario para confirmar de quién es el
 * diploma y que la emisión es genuina.
 */
import { prisma } from "@/lib/admin/db";
import { CLICKATON_DEFAULT_TIMEZONE, formatDateShort } from "@repo/template-engine";

export type DiplomaVerificationView =
  | {
      state: "VALID";
      participantName: string;
      editionName: string;
      eventDateLabel: string;
      issuedAtLabel: string;
      diplomaCode: string;
    }
  | { state: "REVOKED"; participantName: string; diplomaCode: string }
  | { state: "NOT_FOUND" };

/** Lo mínimo que necesita esta función; independiente de la forma exacta que devuelva Prisma. */
export type DiplomaVerificationIssue = {
  diplomaCode: string;
  issuedAt: Date;
  revokedAt: Date | null;
  registration: { firstName: string; lastName: string };
  edition: { name: string; startAt: Date | null };
};

export type DiplomaVerificationDeps = {
  loadIssue: (token: string) => Promise<DiplomaVerificationIssue | null>;
};

async function defaultLoadIssue(token: string): Promise<DiplomaVerificationIssue | null> {
  const issue = await prisma.clickatonDiplomaIssue.findUnique({
    where: { verificationToken: token },
    select: {
      diplomaCode: true,
      issuedAt: true,
      revokedAt: true,
      registration: { select: { firstName: true, lastName: true } },
      edition: { select: { name: true, startAt: true } },
    },
  });
  if (!issue) return null;
  return {
    diplomaCode: issue.diplomaCode,
    issuedAt: issue.issuedAt,
    revokedAt: issue.revokedAt,
    registration: issue.registration,
    edition: issue.edition,
  };
}

function buildParticipantName(registration: { firstName: string; lastName: string }): string {
  return [registration.firstName, registration.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

const DEFAULT_DEPS: DiplomaVerificationDeps = { loadIssue: defaultLoadIssue };

export async function resolveDiplomaVerification(
  token: string,
  deps: DiplomaVerificationDeps = DEFAULT_DEPS
): Promise<DiplomaVerificationView> {
  const trimmed = token?.trim();
  if (!trimmed) return { state: "NOT_FOUND" };

  const issue = await deps.loadIssue(trimmed);
  if (!issue) return { state: "NOT_FOUND" };

  const participantName = buildParticipantName(issue.registration);

  if (issue.revokedAt) {
    return { state: "REVOKED", participantName, diplomaCode: issue.diplomaCode };
  }

  return {
    state: "VALID",
    participantName,
    editionName: issue.edition.name,
    eventDateLabel: issue.edition.startAt
      ? formatDateShort(issue.edition.startAt, CLICKATON_DEFAULT_TIMEZONE)
      : "A confirmar",
    issuedAtLabel: formatDateShort(issue.issuedAt, CLICKATON_DEFAULT_TIMEZONE),
    diplomaCode: issue.diplomaCode,
  };
}
