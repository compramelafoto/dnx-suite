"use server";

import { prisma } from "@repo/db";
import { z } from "zod";
import { horasValidas } from "@/lib/presupuesto-automatico/por-horas-puro";
import { altaDeConsulta, altaDelSistema, MAX_MENSAJE_CONSULTA, MAX_TEXTO_CONSULTA, MENSAJES_ALTA, type DatosAlta } from "@/lib/consultas/alta";
import {
  camposPublicos, fechaOpcional, frenadoPorIp, MAX_CORTO, MENSAJE_FRENO, origenDelFormulario, recortar, vacioANull,
} from "@/lib/consultas/formulario-publico";
import { CAMPO_TRAMPA, cayoEnLaTrampa } from "@/lib/consultas/trampa";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { resolverCategoriaDelSitio } from "@/lib/website/inquiry";

/**
 * El formulario de presupuesto del sitio (bloque INQUIRY_FORM y página «Pedí tu presupuesto»).
 * Pública y sin sesión: trampa, freno por IP y topes de largo compartidos con el formulario
 * general (`lib/consultas/formulario-publico.ts`). Da de alta por el camino único
 * (`altaDeConsulta`, WEB): contacto, consulta, número, circuito, aviso al equipo y respuesta
 * automática. La categoría se resuelve sin perder nunca la consulta (`resolverCategoriaDelSitio`)
 * y el origen sólo vale si es un origen activo de este workspace.
 */
export type SiteInquiryState = { status: "idle" } | { status: "ok" } | { status: "error"; error: string };

const MENSAJE_COMUN = "No pudimos enviar tu consulta. Probá de nuevo en unos minutos.";
const MENSAJE_CONTACTO = "Dejanos un correo o un teléfono para poder responderte.";
const MENSAJE_NO_DISPONIBLE = "Este formulario no está disponible.";

const siteInquirySchema = z.object({
  ...camposPublicos,
  categoriaId: z.string().max(MAX_CORTO).optional().or(z.literal("")),
});

const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
};

function horasDelFormulario(v: string): Pick<DatosAlta, "metaJson"> {
  const horas = horasValidas(v);
  return horas === null ? {} : { metaJson: { porHoras: { horas } } };
}

export async function createSiteInquiry(_prev: SiteInquiryState, formData: FormData): Promise<SiteInquiryState> {
  // Un robot llenó el campo trampa: la misma respuesta que con éxito, sin crear nada.
  if (cayoEnLaTrampa(formData.get(CAMPO_TRAMPA))) {
    console.warn("[consultas] formulario del sitio descartado", { codigo: "CAMPO_TRAMPA" });
    return { status: "ok" };
  }
  try {
    const parsed = siteInquirySchema.safeParse({
      workspaceSlug: texto(formData, "workspaceSlug"),
      categoriaId: texto(formData, "categoriaId"),
      origenId: texto(formData, "origenId"),
      name: texto(formData, "name"),
      email: texto(formData, "email"),
      phone: texto(formData, "phone"),
      eventDate: texto(formData, "eventDate"),
      eventLocation: texto(formData, "eventLocation"),
      message: texto(formData, "message"),
    });
    if (!parsed.success) return { status: "error", error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const data = parsed.data;
    if (!data.email && !data.phone) return { status: "error", error: MENSAJE_CONTACTO };
    if (await frenadoPorIp()) return { status: "error", error: MENSAJE_FRENO };

    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { publicSlug: data.workspaceSlug },
      select: { workspaceId: true },
    });
    if (!branding) return { status: "error", error: MENSAJE_NO_DISPONIBLE };
    const { workspaceId } = branding;
    // La página y el bloque no se dibujan con Consultas apagado; esto frena una pestaña vieja.
    if (!(await getEnabledModuleKeysForWorkspace(workspaceId)).has(SERVICE_LEADS_MODULE_KEY)) {
      return { status: "error", error: MENSAJE_NO_DISPONIBLE };
    }

    const [categoria, origenId] = await Promise.all([
      resolverCategoriaDelSitio(prisma, workspaceId, vacioANull(data.categoriaId), null),
      origenDelFormulario(prisma, workspaceId, data.origenId),
    ]);

    const datos: DatosAlta = {
      contacto: { nombre: data.name, email: vacioANull(data.email), telefono: vacioANull(data.phone) },
      // Sin categoría (workspace sin ninguna activa) el alta usa su propia red de seguridad: siembra
      // los catálogos, toma una archivada o guarda sólo la consulta vieja. Nunca se pierde.
      categoriaId: categoria?.id ?? null,
      eventType: categoria?.legacyEventType ?? null,
      eventDate: fechaOpcional(data.eventDate),
      eventLocation: recortar(data.eventLocation, MAX_TEXTO_CONSULTA),
      message: recortar(data.message, MAX_MENSAJE_CONSULTA),
      formSlug: "sitio",
      origenId,
      // Presupuesto por horas (spec 2026-10-28): cuántas horas dura el evento, si lo dijo.
      ...horasDelFormulario(texto(formData, "horas")),
    };
    let intento = datos;
    let alta = await altaDeConsulta(altaDelSistema(workspaceId), intento, { origenDelAlta: "WEB" });
    // La categoría se archivó entre la elección y el alta: otra vez sin ella, por su tipo viejo.
    if (!alta.ok && alta.error === MENSAJES_ALTA.categoria && intento.categoriaId) {
      intento = { ...intento, categoriaId: null };
      alta = await altaDeConsulta(altaDelSistema(workspaceId), intento, { origenDelAlta: "WEB" });
    }
    // Lo mismo con el origen: si se archivó en el medio, la consulta entra igual, sin origen.
    if (!alta.ok && alta.error === MENSAJES_ALTA.origen && intento.origenId) {
      intento = { ...intento, origenId: null };
      alta = await altaDeConsulta(altaDelSistema(workspaceId), intento, { origenDelAlta: "WEB" });
    }
    if (!alta.ok) return { status: "error", error: alta.error === MENSAJES_ALTA.fallo ? MENSAJE_COMUN : alta.error };
    return { status: "ok" };
  } catch (error) {
    // Sólo el tipo y el código: el mensaje de Prisma puede repetir los datos de la persona.
    const e = error as { name?: string; code?: string } | null;
    console.error("[consultas] formulario del sitio falló", { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
    return { status: "error", error: MENSAJE_COMUN };
  }
}
