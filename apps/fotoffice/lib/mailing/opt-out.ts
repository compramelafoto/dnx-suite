import "server-only";
import { prisma } from "@repo/db";
import { MAILING_TOPICS, type MailingTopic } from "./constants";
import { normalizeEmail } from "./audience";
import { resolveUnsubscribeSecret, verifyUnsubscribeToken, type UnsubscribePayload } from "./unsubscribe-token";

export function parseTopic(value: string | null | undefined): MailingTopic {
  return (MAILING_TOPICS as readonly string[]).includes(value ?? "") ? (value as MailingTopic) : "all";
}

/** El token del enlace de baja, verificado. null si es inválido o falta la clave. */
export function readUnsubscribeToken(token: string | null | undefined): UnsubscribePayload | null {
  const secret = resolveUnsubscribeSecret();
  if (!secret) return null;
  const payload = verifyUnsubscribeToken(token, secret);
  if (!payload) return null;
  const email = normalizeEmail(payload.email);
  return email ? { workspaceId: payload.workspaceId, email } : null;
}

export async function listOptOutTopics(workspaceId: string, email: string): Promise<string[]> {
  const rows = await prisma.fotofficeEmailOptOut.findMany({ where: { workspaceId, email }, select: { topic: true } });
  return rows.map((r) => r.topic);
}

export async function addOptOut(workspaceId: string, email: string, topic: MailingTopic): Promise<void> {
  await prisma.fotofficeEmailOptOut.upsert({
    where: { workspaceId_email_topic: { workspaceId, email, topic } },
    create: { workspaceId, email, topic },
    update: {},
  });
}

/** Volver a recibir: se borra la baja del tema y, si vuelve a todo, también la total. */
export async function removeOptOut(workspaceId: string, email: string, topic: MailingTopic): Promise<void> {
  await prisma.fotofficeEmailOptOut.deleteMany({
    where: { workspaceId, email, topic: topic === "all" ? { in: [...MAILING_TOPICS] } : { in: [topic, "all"] } },
  });
}

export async function institutionName(workspaceId: string): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, fotofficeBranding: { select: { commercialName: true } } },
  });
  if (!ws) return null;
  return ws.fotofficeBranding?.commercialName?.trim() || ws.name;
}
