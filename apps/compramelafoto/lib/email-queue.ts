/**
 * Sistema de cola de emails con templates e idempotency
 */

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export type EmailTemplateKey =
  | "album_ready"
  | "album_reminder_3weeks"
  | "album_reminder_2weeks"
  | "album_reminder_1week"
  | "album_extension_reminder_15"
  | "album_extension_reminder_29"
  | "order_confirmed"
  | "order_ready"
  | "digital_download"
  | "email_verification"
  | "account_created"
  | "lab_recommendation"
  | "photographer_new_order"
  | "abandoned_order_reminder";

export interface EmailTemplateData {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Agrega un email a la cola
 */
export async function queueEmail(params: {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  templateId?: number;
  templateData?: EmailTemplateData;
  priority?: number; // 1-10, menor = mayor prioridad
  scheduledFor?: Date;
  idempotencyKey?: string; // Para evitar duplicados
}): Promise<{ id: number; queued: boolean }> {
  const {
    to,
    subject,
    body,
    htmlBody,
    templateId,
    templateData,
    priority = 5,
    scheduledFor = new Date(),
    idempotencyKey,
  } = params;

  // Generar idempotency key si no se proporciona
  const finalIdempotencyKey =
    idempotencyKey || `email_${Date.now()}_${randomBytes(8).toString("hex")}`;

  // Verificar si ya existe un email con esta key
  if (idempotencyKey) {
    const existing = await prisma.emailQueue.findUnique({
      where: { idempotencyKey: finalIdempotencyKey },
    });

    if (existing) {
      return { id: existing.id, queued: false };
    }
  }

  const email = await prisma.emailQueue.create({
    data: {
      to,
      subject,
      body,
      htmlBody,
      templateId,
      templateData: templateData ? (templateData as any) : null,
      priority,
      scheduledFor,
      idempotencyKey: finalIdempotencyKey,
      status: "PENDING",
    },
  });

  return { id: email.id, queued: true };
}

/**
 * Obtiene el siguiente email pendiente de la cola
 */
export async function getNextPendingEmail() {
  return prisma.emailQueue.findFirst({
    where: {
      status: "PENDING",
      scheduledFor: { lte: new Date() },
    },
    orderBy: [
      { priority: "asc" }, // Menor prioridad primero
      { createdAt: "asc" }, // Más antiguo primero
    ],
    include: {
      template: true,
    },
  });
}

/**
 * Marca un email como procesando
 */
export async function markEmailProcessing(id: number) {
  return prisma.emailQueue.update({
    where: { id },
    data: {
      status: "PROCESSING",
      lastAttemptAt: new Date(),
      attempts: { increment: 1 },
    },
  });
}

/**
 * Marca un email como enviado
 */
export async function markEmailSent(id: number) {
  return prisma.emailQueue.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
    },
  });
}

/**
 * Marca un email como fallido
 */
export async function markEmailFailed(
  id: number,
  errorMessage: string
) {
  const email = await prisma.emailQueue.findUnique({ where: { id } });
  if (!email) return null;

  const shouldMarkFailed = email.attempts >= email.maxAttempts;

  return prisma.emailQueue.update({
    where: { id },
    data: {
      status: shouldMarkFailed ? "FAILED" : "PENDING",
      errorMessage,
      lastAttemptAt: new Date(),
    },
  });
}

/**
 * Obtiene o crea un template de email
 */
export async function getOrCreateTemplate(
  key: EmailTemplateKey,
  defaults: {
    name: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    variables?: string[];
  }
) {
  let template = await prisma.emailTemplate.findUnique({
    where: { key },
  });

  if (!template) {
    template = await prisma.emailTemplate.create({
      data: {
        key,
        name: defaults.name,
        subject: defaults.subject,
        bodyText: defaults.bodyText,
        bodyHtml: defaults.bodyHtml,
        variables: defaults.variables || [],
        isActive: true,
      },
    });
  }

  return template;
}

/**
 * Reemplaza variables en un template
 */
export function replaceTemplateVariables(
  text: string,
  data: EmailTemplateData
): string {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(
      new RegExp(placeholder, "g"),
      String(value ?? "")
    );
  }
  return result;
}

/**
 * Renderiza un template con datos
 */
export async function renderTemplate(
  templateKey: EmailTemplateKey,
  data: EmailTemplateData
): Promise<{ subject: string; bodyText: string; bodyHtml?: string }> {
  const template = await prisma.emailTemplate.findUnique({
    where: { key: templateKey },
  });

  if (!template) {
    throw new Error(`Template "${templateKey}" no encontrado`);
  }

  const subject = replaceTemplateVariables(template.subject, data);
  const bodyText = replaceTemplateVariables(template.bodyText, data);
  const bodyHtml = template.bodyHtml
    ? replaceTemplateVariables(template.bodyHtml, data)
    : undefined;

  return { subject, bodyText, bodyHtml };
}
