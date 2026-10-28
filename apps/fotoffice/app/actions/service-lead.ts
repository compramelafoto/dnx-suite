"use server";

import { type Prisma, prisma } from "@repo/db";
import { z } from "zod";
import { horasValidas } from "@/lib/presupuesto-automatico/por-horas-puro";
import {
  altaDeConsulta, altaDelSistema, MAX_MENSAJE_CONSULTA, MAX_TEXTO_CONSULTA, MENSAJES_ALTA, type DatosAlta,
} from "@/lib/consultas/alta";
import {
  camposPublicos, fechaOpcional, frenadoPorIp, MAX_CORTO, MENSAJE_FRENO, origenDelFormulario, recortar, vacioANull,
} from "@/lib/consultas/formulario-publico";
import { CAMPO_TRAMPA, cayoEnLaTrampa } from "@/lib/consultas/trampa";

/**
 * Los topes de largo, el freno por IP y los recortes son los mismos que en el formulario del
 * sitio (`createSiteInquiry`): viven en `lib/consultas/formulario-publico.ts`.
 */
const serviceLeadSchema = z.object({
  ...camposPublicos,
  formId: z.string().max(MAX_CORTO).optional().or(z.literal("")),
  formSlug: z.string().max(MAX_CORTO).optional().or(z.literal("")),
  eventType: z.string().min(1).max(MAX_CORTO),
  eventSubtype: z.string().max(MAX_CORTO).optional().or(z.literal("")),
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
  /** «¿Cómo nos conociste?»: un origen activo del workspace; cualquier otro valor se ignora. */
  origenId?: string;
  meta?: Record<string, unknown> | null;
  /** El campo trampa (`lib/consultas/trampa.ts`): una persona lo deja vacío. */
  [CAMPO_TRAMPA]?: string;
};

type CreateServiceLeadResult = { success: true } | { success: false; error: string };

/** Presupuesto por horas (spec 2026-10-28): un campo "horas" del formulario se copia a `porHoras.horas`. */
function conHoras(meta: Record<string, unknown>): Record<string, unknown> {
  const horas = horasValidas(meta.horas);
  return horas === null ? meta : { ...meta, porHoras: { horas } };
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
      origenId: input.origenId?.trim() ?? "",
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
    // Sólo se consulta si la persona eligió algo: el origen es opcional.
    const origenId = data.origenId ? await origenDelFormulario(prisma, branding.workspaceId, data.origenId) : null;

    // El alta única de la etapa 1, como formulario web: en una transacción el contacto (buscado
    // sólo por correo), la consulta y su ficha nueva con la categoría equivalente al tipo del
    // formulario; después, cada paso aislado y en orden: número, circuito, aviso al equipo y tarea,
    // y la respuesta automática (sólo en este camino). Una falla de esos pasos nunca deshace el alta.
    const datos: DatosAlta = {
      contacto: { nombre: data.name, email: vacioANull(data.email), telefono: vacioANull(data.phone) },
      eventType: recortar(data.eventType, MAX_TEXTO_CONSULTA),
      // El subtipo puede venir de `meta.budgetType`, que zod no limita: se recorta al tope del
      // alta en lugar de rechazar la consulta (lo mismo con los demás textos, por las dudas).
      eventSubtype: recortar(resolvedEventSubtype, MAX_TEXTO_CONSULTA),
      eventDate: fechaOpcional(data.eventDate),
      eventLocation: recortar(data.eventLocation, MAX_TEXTO_CONSULTA),
      message: recortar(data.message, MAX_MENSAJE_CONSULTA),
      metaJson: data.meta ? (conHoras(data.meta) as Prisma.InputJsonValue) : null,
      formId: vacioANull(data.formId),
      formSlug: recortar(data.formSlug, MAX_TEXTO_CONSULTA),
        ...(origenId ? { origenId } : {}),
    };
    let alta = await altaDeConsulta(altaDelSistema(branding.workspaceId), datos, { origenDelAlta: "WEB" });
    // El origen se archivó entre la elección y el alta: la consulta entra igual, sin origen.
    if (!alta.ok && alta.error === MENSAJES_ALTA.origen && datos.origenId) {
      alta = await altaDeConsulta(altaDelSistema(branding.workspaceId), { ...datos, origenId: null }, { origenDelAlta: "WEB" });
    }
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
