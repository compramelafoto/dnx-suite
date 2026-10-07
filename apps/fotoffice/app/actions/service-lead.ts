"use server";

import { type Prisma, prisma } from "@repo/db";
import { headers } from "next/headers";
import { z } from "zod";
import {
  altaDeConsulta, altaDelSistema, MAX_MENSAJE_CONSULTA, MAX_TEXTO_CONSULTA, MENSAJES_ALTA,
} from "@/lib/consultas/alta";
import { CAMPO_TRAMPA, cayoEnLaTrampa } from "@/lib/consultas/trampa";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";

/**
 * Topes de largo del formulario público (es abierto: nadie tiene que iniciar sesión). Los mismos
 * números valen para la respuesta automática, que repite algunos de estos datos.
 */
const MAX_NOMBRE = 120;
const MAX_EMAIL = 254;
const MAX_TELEFONO = 40;
const MAX_MENSAJE = 4000;
const MAX_CORTO = 200;

const serviceLeadSchema = z.object({
  workspaceSlug: z.string().min(1).max(MAX_CORTO),
  formId: z.string().max(MAX_CORTO).optional().or(z.literal("")),
  formSlug: z.string().max(MAX_CORTO).optional().or(z.literal("")),
  name: z.string().min(1).max(MAX_NOMBRE, `El nombre puede tener hasta ${MAX_NOMBRE} caracteres.`),
  email: z
    .string()
    .max(MAX_EMAIL, "Email inválido.")
    .email("Email inválido.")
    .optional()
    .or(z.literal("")),
  phone: z.string().max(MAX_TELEFONO, `El teléfono puede tener hasta ${MAX_TELEFONO} caracteres.`).optional().or(z.literal("")),
  eventType: z.string().min(1).max(MAX_CORTO),
  eventSubtype: z.string().max(MAX_CORTO).optional().or(z.literal("")),
  eventDate: z.string().max(MAX_CORTO).optional().or(z.literal("")),
  eventLocation: z.string().max(MAX_CORTO, `El lugar puede tener hasta ${MAX_CORTO} caracteres.`).optional().or(z.literal("")),
  message: z.string().max(MAX_MENSAJE, `El mensaje puede tener hasta ${MAX_MENSAJE} caracteres.`).optional().or(z.literal("")),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

/**
 * Freno por IP del formulario público: el de memoria del proxy de geocodificación (cada instancia
 * de Vercel lleva su conteo, así que es "N por instancia"; no es un control de seguridad, sólo
 * evita un bucle o un raspador). Sin IP conocida no se frena: agruparía a todos juntos.
 */
const FRENO_CONSULTAS = { limit: 10, windowMs: 10 * 60 * 1000 };
const MENSAJE_FRENO = "Recibimos muchas consultas seguidas desde tu conexión. Probá de nuevo en unos minutos.";

async function frenadoPorIp(): Promise<boolean> {
  let ip: string;
  try {
    ip = clientIp(await headers());
  } catch {
    return false; // Fuera de un pedido (pruebas, scripts): no hay IP que contar.
  }
  if (ip === "desconocido") return false;
  return !checkRateLimit({ key: `service-lead:${ip}`, ...FRENO_CONSULTAS }).allowed;
}

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
  /** El campo trampa (`lib/consultas/trampa.ts`): una persona lo deja vacío. */
  [CAMPO_TRAMPA]?: string;
};

type CreateServiceLeadResult = { success: true } | { success: false; error: string };

function emptyToNull(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Vacío = null; si no, recortado al tope (nunca rechaza: es lo que escribió quien consulta). */
function recortar(value: string | undefined, max: number): string | null {
  return emptyToNull(value)?.slice(0, max).trim() || null;
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
  // Un robot llenó el campo trampa: la misma respuesta que con éxito, sin crear nada.
  if (cayoEnLaTrampa(input?.[CAMPO_TRAMPA])) {
    console.warn("[consultas] formulario público descartado", { codigo: "CAMPO_TRAMPA" });
    return { success: true };
  }
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
    if (await frenadoPorIp()) return { success: false, error: MENSAJE_FRENO };

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

    // El alta única de la etapa 1, como formulario web: en una transacción el contacto (buscado
    // sólo por correo), la consulta y su ficha nueva con la categoría equivalente al tipo del
    // formulario; después, cada paso aislado y en orden: número, circuito, aviso al equipo y tarea,
    // y la respuesta automática (sólo en este camino). Una falla de esos pasos nunca deshace el alta.
    const alta = await altaDeConsulta(
      altaDelSistema(branding.workspaceId),
      {
        contacto: { nombre: data.name, email: emptyToNull(data.email), telefono: emptyToNull(data.phone) },
        eventType: recortar(data.eventType, MAX_TEXTO_CONSULTA),
        // El subtipo puede venir de `meta.budgetType`, que zod no limita: se recorta al tope del
        // alta en lugar de rechazar la consulta (lo mismo con los demás textos, por las dudas).
        eventSubtype: recortar(resolvedEventSubtype, MAX_TEXTO_CONSULTA),
        eventDate: parseOptionalDate(data.eventDate),
        eventLocation: recortar(data.eventLocation, MAX_TEXTO_CONSULTA),
        message: recortar(data.message, MAX_MENSAJE_CONSULTA),
        metaJson: data.meta ? (data.meta as Prisma.InputJsonValue) : null,
        formId: emptyToNull(data.formId),
        formSlug: recortar(data.formSlug, MAX_TEXTO_CONSULTA),
      },
      { origenDelAlta: "WEB" },
    );
    if (!alta.ok) {
      return { success: false, error: alta.error === MENSAJES_ALTA.fallo ? "No se pudo registrar el lead." : alta.error };
    }

    return { success: true };
  } catch (error) {
    // Sólo el tipo y el código: el mensaje de Prisma puede repetir los datos de la persona.
    const e = error as { name?: string; code?: string } | null;
    console.error("Error al crear ServiceSalesLead:", { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
    return { success: false, error: "No se pudo registrar el lead." };
  }
}
