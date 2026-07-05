import { randomBytes } from "crypto";
import { SchoolOrganizerInvitationStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildSchoolOrganizerInviteEmail } from "@/emails/templates/auth";

export const SCHOOL_ORGANIZER_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function resolveAppUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  if (!raw) return "http://localhost:3000";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function createSchoolOrganizerInvitation(input: {
  schoolId: number;
  email: string;
  name: string;
  invitedByUserId: number;
  invitedByName?: string | null;
  schoolName: string;
}) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SCHOOL_ORGANIZER_INVITATION_TTL_MS);

  await prisma.schoolOrganizerInvitation.updateMany({
    where: {
      schoolId: input.schoolId,
      email: input.email,
      status: SchoolOrganizerInvitationStatus.PENDING,
    },
    data: {
      status: SchoolOrganizerInvitationStatus.CANCELLED,
    },
  });

  const invitation = await prisma.schoolOrganizerInvitation.create({
    data: {
      schoolId: input.schoolId,
      email: input.email,
      name: input.name,
      tokenHash,
      status: SchoolOrganizerInvitationStatus.PENDING,
      invitedByUserId: input.invitedByUserId,
      expiresAt,
    },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const inviteUrl = `${resolveAppUrl()}/escuela/activar?token=${encodeURIComponent(token)}`;
  const emailPayload = buildSchoolOrganizerInviteEmail({
    schoolName: input.schoolName,
    inviteUrl,
    invitedByName: input.invitedByName ?? undefined,
    recipientName: input.name,
  });

  const emailResult = await sendEmail({
    to: input.email,
    subject: emailPayload.subject,
    html: emailPayload.html,
    templateKey: "SCHOOL_ORGANIZER_INVITE",
    meta: { userId: input.invitedByUserId },
  });

  return {
    invitation,
    emailSent: emailResult.success,
    emailError: emailResult.success ? null : emailResult.error ?? "Error enviando email",
  };
}
