"use server";

import { Prisma, prisma } from "@repo/db";
import { z } from "zod";
import { notificarEvento } from "@/lib/circuitos/eventos";
import { responderConsultaNueva } from "@/lib/plantillas/automaticos";
import { numerarConsultaNueva } from "@/lib/service-leads/numero";

const serviceLeadSchema = z.object({
  workspaceSlug: z.string().min(1),
  formId: z.string().optional().or(z.literal("")),
  formSlug: z.string().optional().or(z.literal("")),
  name: z.string().min(1),
  email: z
    .string()
    .email("Email inválido.")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  eventType: z.string().min(1),
  eventSubtype: z.string().optional().or(z.literal("")),
  eventDate: z.string().optional().or(z.literal("")),
  eventLocation: z.string().optional().or(z.literal("")),
  message: z.string().optional().or(z.literal("")),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

type CreateServiceLeadInput = {
  workspaceSlug: string;
  formId?: string;
  formSlug?: string;
  name: string;
  email?: string;
  phone?: string;
  eventType: string;
  eventSubtype?: string;
  eventDate?: string;
  eventLocation?: string;
  message?: string;
  meta?: Record<string, unknown> | null;
};

type CreateServiceLeadResult = { success: true } | { success: false; error: string };

function emptyToNull(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDate(value?: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createServiceLead(
  input: CreateServiceLeadInput,
): Promise<CreateServiceLeadResult> {
  try {
    const parsed = serviceLeadSchema.safeParse({
      workspaceSlug: input.workspaceSlug?.trim() ?? "",
      formId: input.formId?.trim() ?? "",
      formSlug: input.formSlug?.trim() ?? "",
      name: input.name?.trim() ?? "",
      email: input.email?.trim() ?? "",
      phone: input.phone?.trim() ?? "",
      eventType: input.eventType?.trim() ?? "",
      eventSubtype: input.eventSubtype?.trim() ?? "",
      eventDate: input.eventDate?.trim() ?? "",
      eventLocation: input.eventLocation?.trim() ?? "",
      message: input.message?.trim() ?? "",
      meta: input.meta ?? null,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const data = parsed.data;

    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { publicSlug: data.workspaceSlug },
    });

    if (!branding) {
      return { success: false, error: "Workspace no encontrado." };
    }
    const budgetTypeFromMeta =
      data.meta && typeof data.meta.budgetType === "string"
        ? data.meta.budgetType.trim()
        : "";
    const resolvedEventSubtype = data.eventSubtype?.trim() || budgetTypeFromMeta || "";

    const creado = await prisma.serviceSalesLead.create({
      select: { id: true, createdAt: true },
      data: {
        workspaceId: branding.workspaceId,
        formId: emptyToNull(data.formId),
        formSlug: emptyToNull(data.formSlug),
        name: data.name,
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        eventType: data.eventType,
        eventSubtype: emptyToNull(resolvedEventSubtype),
        eventDate: parseOptionalDate(data.eventDate),
        eventLocation: emptyToNull(data.eventLocation),
        message: emptyToNull(data.message),
        metaJson: data.meta ? (data.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: "NEW",
      },
    });

    // La consulta ya quedó registrada: recibe su número en una transacción aparte, para que una
    // falla de la numeración nunca deshaga el alta (numerarConsultaNueva no lanza; si falla, la
    // numera el próximo enganche).
    await numerarConsultaNueva(branding.workspaceId, creado.id, creado.createdAt);

    // Respuesta automática por correo (0.6), sólo en este camino del formulario público: va después
    // del número para que [consulta_numero] ya exista. Nunca hace fallar el alta (no lanza; si el
    // correo falla, queda registrado como "Falló").
    try {
      await responderConsultaNueva(branding.workspaceId, creado.id);
    } catch {
      console.error("[plantillas] no se pudo enganchar la respuesta automática");
    }

    // El motor de etapas la pone en la primera etapa. Una falla
    // del motor nunca hace fallar el alta (notificarEvento no lanza; esto es por las dudas).
    try {
      await notificarEvento(branding.workspaceId, { tipo: "CAPTACION", id: creado.id }, "CONSULTA_RECIBIDA", creado.id);
    } catch {
      console.error("[captacion] no se pudo enganchar la consulta nueva al embudo");
    }

    return { success: true };
  } catch (error) {
    // Sólo el tipo y el código: el mensaje de Prisma puede repetir los datos de la persona.
    const e = error as { name?: string; code?: string } | null;
    console.error("Error al crear ServiceSalesLead:", { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
    return { success: false, error: "No se pudo registrar el lead." };
  }
}
