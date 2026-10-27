"use server";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { altaDeConsulta, altaDelSistema, MAX_MENSAJE_CONSULTA, MENSAJES_ALTA, type DatosAlta } from "@/lib/consultas/alta";
import { origenDelFormulario } from "@/lib/consultas/formulario-publico";
import { CAMPO_TRAMPA, cayoEnLaTrampa } from "@/lib/consultas/trampa";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { parseWebsiteSections, type WebsiteSections } from "@/lib/website/blocks";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { paginasDelSitio } from "@/lib/website/dynamic-data";
import {
  buscarBloquePublicado,
  contenidoRevelado,
  emailValido,
  mensajeDeConsulta,
  normalizarEmail,
  paginaUrlDe,
  validarEnvio,
  type ContenidoRevelado,
} from "@/lib/website/formularios";
import { esTablaFaltante, guardarEnvio, huellaIp, suscribir, vincularConsulta } from "@/lib/website/formularios.server";
import { resolverCategoriaDelSitio } from "@/lib/website/inquiry";

/**
 * Envíos públicos de los formularios propios del sitio (bloque FORM) y del boletín (NEWSLETTER).
 * Sin sesión. Como el formulario de presupuesto: campo trampa, freno por IP y topes de largo.
 *
 * Nunca se confía en el navegador para la definición: con el slug y el id del bloque se busca el
 * bloque en la versión PUBLICADA del sitio y se valida contra sus campos. El contenido oculto se
 * devuelve recién acá, después de un envío válido. La IP no se guarda: sólo una huella (HMAC).
 */
export type SiteFormState =
  | { status: "idle" }
  | { status: "ok"; revelado: ContenidoRevelado | null }
  | { status: "error"; error: string };

export type NewsletterState = { status: "idle" } | { status: "ok" } | { status: "error"; error: string };

const MENSAJE_COMUN = "No pudimos enviar el formulario. Probá de nuevo en unos minutos.";
const MENSAJE_NO_DISPONIBLE = "Este formulario no está disponible.";
const MENSAJE_FRENO = "Recibimos muchos envíos seguidos desde tu conexión. Probá de nuevo en unos minutos.";
const FRENO = { limit: 10, windowMs: 10 * 60 * 1000 };

const texto = (fd: FormData, campo: string, max = 200): string => {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

async function ipDelPedido(): Promise<string | null> {
  try {
    const ip = clientIp(await headers());
    return ip === "desconocido" ? null : ip;
  } catch {
    return null; // Fuera de un pedido (pruebas): no hay IP.
  }
}

/** Sin IP conocida no se frena: agruparía a todos los visitantes juntos. */
function frenado(prefijo: string, ip: string | null): boolean {
  if (!ip) return false;
  return !checkRateLimit({ key: `${prefijo}:${ip}`, ...FRENO }).allowed;
}

type SitioPublicado = { workspaceId: string; workspaceSlug: string; sections: WebsiteSections; modulos: Set<string> };

/** El sitio PUBLICADO de un slug, sólo si el módulo Sitio web está encendido. */
async function sitioPublicado(workspaceSlug: string): Promise<SitioPublicado | null> {
  if (!workspaceSlug) return null;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: workspaceSlug }, select: { workspaceId: true } });
  if (!branding) return null;
  const [modulos, website] = await Promise.all([
    getEnabledModuleKeysForWorkspace(branding.workspaceId),
    prisma.fotofficeWorkspaceWebsite.findUnique({
      where: { workspaceId: branding.workspaceId },
      select: { publishedVersion: { select: { sectionsJson: true } } },
    }),
  ]);
  const json = website?.publishedVersion?.sectionsJson;
  if (!modulos.has(WEBSITE_MODULE_KEY) || json == null) return null;
  return { workspaceId: branding.workspaceId, workspaceSlug, sections: parseWebsiteSections(json), modulos: new Set(modulos) };
}

function registrarFallo(donde: string, error: unknown) {
  // Sólo el tipo y el código: el mensaje de Prisma puede repetir los datos de la persona.
  const e = error as { name?: string; code?: string } | null;
  console.error(`[sitio] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

export async function submitSiteForm(_prev: SiteFormState, formData: FormData): Promise<SiteFormState> {
  // Un robot llenó el campo trampa: la misma respuesta que con éxito, sin guardar ni revelar nada.
  if (cayoEnLaTrampa(formData.get(CAMPO_TRAMPA))) return { status: "ok", revelado: null };
  try {
    const ip = await ipDelPedido();
    if (frenado("sitio-formulario", ip)) return { status: "error", error: MENSAJE_FRENO };

    const sitio = await sitioPublicado(texto(formData, "workspaceSlug"));
    const blockId = texto(formData, "blockId");
    const hallado = sitio && blockId ? buscarBloquePublicado(sitio.sections, blockId, "FORM") : null;
    if (!sitio || !hallado) return { status: "error", error: MENSAJE_NO_DISPONIBLE };
    const config = hallado.block.config;

    const validado = validarEnvio(config, (nombre) => {
      const v = formData.get(nombre);
      return typeof v === "string" ? v : null;
    });
    if (!validado.ok) return { status: "error", error: validado.error };

    const titulo = config.title.trim() || "Formulario";
    const paginaUrl = paginaUrlDe(sitio.workspaceSlug, sitio.sections, hallado.pageKey);
    let envioId: string;
    try {
      envioId = await guardarEnvio({
        workspaceId: sitio.workspaceId,
        clave: hallado.block.id,
        nombreFormulario: titulo,
        pares: validado.pares,
        contacto: validado.contacto,
        paginaUrl,
        ipHash: huellaIp(ip, sitio.workspaceId),
      });
    } catch (err) {
      if (esTablaFaltante(err)) return { status: "error", error: MENSAJE_NO_DISPONIBLE };
      throw err;
    }

    // «Crear también una consulta»: sólo con Consultas encendido y con nombre + correo o teléfono.
    // Si falla, el envío ya quedó guardado en la bandeja: no se le muestra error a la persona.
    const { nombre, email, telefono } = validado.contacto;
    if (config.createInquiry && sitio.modulos.has(SERVICE_LEADS_MODULE_KEY) && nombre && (email || telefono)) {
      try {
        const [categoria, origenId] = await Promise.all([
          resolverCategoriaDelSitio(prisma, sitio.workspaceId, config.categoryId || null, null),
          origenDelFormulario(prisma, sitio.workspaceId, config.origenId),
        ]);
        let datos: DatosAlta = {
          contacto: { nombre, email, telefono },
          categoriaId: categoria?.id ?? null,
          eventType: categoria?.legacyEventType ?? null,
          message: mensajeDeConsulta(titulo, validado.pares, MAX_MENSAJE_CONSULTA),
          formSlug: "sitio-formulario",
          origenId,
        };
        let alta = await altaDeConsulta(altaDelSistema(sitio.workspaceId), datos, { origenDelAlta: "WEB" });
        if (!alta.ok && alta.error === MENSAJES_ALTA.categoria && datos.categoriaId) {
          datos = { ...datos, categoriaId: null };
          alta = await altaDeConsulta(altaDelSistema(sitio.workspaceId), datos, { origenDelAlta: "WEB" });
        }
        if (!alta.ok && alta.error === MENSAJES_ALTA.origen && datos.origenId) {
          datos = { ...datos, origenId: null };
          alta = await altaDeConsulta(altaDelSistema(sitio.workspaceId), datos, { origenDelAlta: "WEB" });
        }
        if (alta.ok && alta.consultaId) await vincularConsulta(sitio.workspaceId, envioId, alta.consultaId);
        else if (!alta.ok) console.warn("[sitio] el envío no pudo crear la consulta", { motivo: alta.error });
      } catch (err) {
        registrarFallo("crear la consulta del formulario", err);
      }
    }

    const revelado = contenidoRevelado(config, paginasDelSitio(`/w/${sitio.workspaceSlug}`, sitio.sections.pageMeta));
    return { status: "ok", revelado };
  } catch (error) {
    registrarFallo("el formulario del sitio", error);
    return { status: "error", error: MENSAJE_COMUN };
  }
}

export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  if (cayoEnLaTrampa(formData.get(CAMPO_TRAMPA))) return { status: "ok" };
  try {
    const email = normalizarEmail(texto(formData, "email", 300));
    if (!emailValido(email)) return { status: "error", error: "Revisá el correo." };

    const ip = await ipDelPedido();
    if (frenado("sitio-boletin", ip)) return { status: "error", error: MENSAJE_FRENO };

    const sitio = await sitioPublicado(texto(formData, "workspaceSlug"));
    const blockId = texto(formData, "blockId");
    const hallado = sitio && blockId ? buscarBloquePublicado(sitio.sections, blockId, "NEWSLETTER") : null;
    if (!sitio || !hallado) return { status: "error", error: MENSAJE_NO_DISPONIBLE };

    const nombre = hallado.block.config.askName ? texto(formData, "name", 120).replace(/\s+/g, " ") || null : null;
    if (hallado.block.config.askName && !nombre) return { status: "error", error: "Completá tu nombre." };

    try {
      await suscribir(sitio.workspaceId, email, nombre);
    } catch (err) {
      if (esTablaFaltante(err)) return { status: "error", error: MENSAJE_NO_DISPONIBLE };
      throw err;
    }
    return { status: "ok" };
  } catch (error) {
    registrarFallo("el boletín del sitio", error);
    return { status: "error", error: "No pudimos anotarte. Probá de nuevo en unos minutos." };
  }
}
