"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { resolverAcceso } from "@/lib/access/acceso";
import { puede } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { editarPortfolio, guardarAcuse, guardarAprobacionTelegram, MENSAJES_AJUSTES_AUTO } from "@/lib/presupuesto-automatico/ajustes";
import type { CambioPortfolio } from "@/lib/presupuesto-automatico/portfolio-items";
import { aprobarYEnviar } from "@/lib/presupuesto-automatico/flujo";
import { guardarAjustesPorHoras } from "@/lib/presupuesto-automatico/por-horas";
import { subirFotoAlPortfolio } from "@/lib/presupuesto-automatico/portfolio";
import { avisarPorTelegram, conectarTelegram, desconectarTelegram, MENSAJES_TELEGRAM, nuevoCodigoTelegram } from "@/lib/telegram/conexion";

/** Estado de los formularios de Configuración → Telegram (`useActionState`). Nunca lleva el token. */
export type EstadoTelegramConfig = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/telegram";

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin `configurar`
 * no se lee ni se escribe nada.
 */
async function contexto(): Promise<CtxConsultas | null> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role, acceso };
}

function texto(fd: FormData, nombre: string): string | undefined {
  const v = fd.get(nombre);
  return typeof v === "string" ? v : undefined;
}

export async function conectarTelegramAction(_prev: EstadoTelegramConfig | undefined, fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_TELEGRAM.sinPermiso };
  const r = await conectarTelegram(ctx, texto(fd, "token"));
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "¡Bot conectado! Ahora seguí con el paso 3: vincular tu chat." };
}

export async function nuevoCodigoAction(_prev: EstadoTelegramConfig | undefined, _fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_TELEGRAM.sinPermiso };
  const r = await nuevoCodigoTelegram(ctx);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Listo: hay un enlace nuevo, vale por 30 minutos." };
}

export async function desconectarTelegramAction(_prev: EstadoTelegramConfig | undefined, _fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_TELEGRAM.sinPermiso };
  const r = await desconectarTelegram(ctx);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Telegram desconectado. Ya no llegan avisos." };
}

/** Un mensaje de prueba al chat vinculado (lo aprieta Daniel para ver que le llega). */
export async function probarTelegramAction(_prev: EstadoTelegramConfig | undefined, _fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_TELEGRAM.sinPermiso };
  const r = await avisarPorTelegram(ctx.workspaceId, "👋 <b>Prueba de FOTOFFICE.</b> Si ves esto, los avisos de presupuestos te van a llegar acá.", null);
  return r.ok ? { error: null, ok: "Mensaje de prueba enviado: fijate en Telegram." } : { error: `No se pudo mandar el mensaje de prueba (código ${r.codigo}).` };
}

export async function cambiarCategoriaAction(_prev: EstadoTelegramConfig | undefined, fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_AJUSTES_AUTO.sinPermiso };
  const encendido = texto(fd, "encendido") === "1";
  const r = await guardarAprobacionTelegram(ctx, texto(fd, "categoriaId"), encendido);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: encendido ? "Encendido: las consultas de esta categoría te llegan por Telegram para aprobar." : "Apagado para esta categoría." };
}

export async function guardarAcuseAction(_prev: EstadoTelegramConfig | undefined, fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_AJUSTES_AUTO.sinPermiso };
  const r = await guardarAcuse(ctx, texto(fd, "acuseEncendido") === "1", texto(fd, "acuseTexto") ?? null);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Acuse guardado." };
}

/** "Aprobar y enviar" desde FOTOFFICE (lo mismo que el botón de Telegram, igual de idempotente). */
export async function aprobarDesdePanelAction(_prev: EstadoTelegramConfig | undefined, fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx || ctx.userId === null) return { error: MENSAJES_AJUSTES_AUTO.sinPermiso };
  const id = texto(fd, "aprobacionId");
  if (!id || id.length > 64) return { error: MENSAJES_AJUSTES_AUTO.datosInvalidos };
  const r = await aprobarYEnviar(ctx.workspaceId, id, { tipo: "PANEL", userId: ctx.userId });
  revalidatePath(RUTA);
  return r.ok ? { error: null, ok: r.texto } : { error: r.texto };
}

// --- Portfolio de una categoría -------------------------------------------------------------------

function rutaPortfolio(categoriaId: string): string {
  return `${RUTA}/portfolio/${encodeURIComponent(categoriaId)}`;
}

/** Agregar una galería o una foto, quitar o mover un elemento del portfolio de una categoría. */
export async function editarPortfolioAction(_prev: EstadoTelegramConfig | undefined, fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_AJUSTES_AUTO.sinPermiso };
  const categoriaId = texto(fd, "categoriaId") ?? "";
  const accion = texto(fd, "accion");
  const indice = Number(texto(fd, "indice"));
  let cambio: CambioPortfolio;
  if (accion === "galeria") cambio = { tipo: "AGREGAR", item: { tipo: "GALERIA", galeriaId: texto(fd, "galeriaId"), cantidad: Number(texto(fd, "cantidad")) } };
  else if (accion === "foto") cambio = { tipo: "AGREGAR", item: { tipo: "FOTO", galeriaId: texto(fd, "galeriaId"), fotoId: texto(fd, "fotoId") } };
  else if (accion === "quitar") cambio = { tipo: "QUITAR", indice };
  else if (accion === "subir" || accion === "bajar") cambio = { tipo: "MOVER", indice, hacia: accion === "subir" ? -1 : 1 };
  else return { error: MENSAJES_AJUSTES_AUTO.datosInvalidos };
  const r = await editarPortfolio(ctx, categoriaId, cambio);
  if (!r.ok) return { error: r.error };
  revalidatePath(rutaPortfolio(categoriaId));
  return { error: null, ok: "Portfolio guardado." };
}

export async function subirFotoPortfolioAction(_prev: EstadoTelegramConfig | undefined, fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_AJUSTES_AUTO.sinPermiso };
  const categoriaId = texto(fd, "categoriaId") ?? "";
  const r = await subirFotoAlPortfolio(ctx, categoriaId, fd.get("foto"));
  if (!r.ok) return { error: r.error };
  revalidatePath(rutaPortfolio(categoriaId));
  return { error: null, ok: "Foto subida y agregada al portfolio." };
}

/** Presupuesto por horas (spec 2026-10-28): las reglas del estudio para armar eventos sin propuesta modelo. */
export async function guardarPorHorasAction(_prev: EstadoTelegramConfig | undefined, fd: FormData): Promise<EstadoTelegramConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_AJUSTES_AUTO.sinPermiso };
  const r = await guardarAjustesPorHoras(ctx, {
    encendido: texto(fd, "porHorasEncendido") === "1",
    edicionPorHora: texto(fd, "edicionPorHora"),
    disparosPorHora: texto(fd, "disparosPorHora"),
    minimoFotosEvento: texto(fd, "minimoFotosEvento"),
    minimoFotosSesion: texto(fd, "minimoFotosSesion"),
    pesosPorKm: texto(fd, "pesosPorKm"),
    partida: { direccion: texto(fd, "partida") },
    segundoFotografoPct: texto(fd, "segundoFotografoPct"),
    invitadosSegundoFotografo: texto(fd, "invitadosSegundoFotografo"),
    categoriasSesion: fd.getAll("categoriasSesion").filter((v): v is string => typeof v === "string"),
    categoriasExcluidas: fd.getAll("categoriasExcluidas").filter((v): v is string => typeof v === "string"),
    incluye: texto(fd, "incluye"),
    opcionalesTexto: texto(fd, "opcionalesTexto"),
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Guardado." };
}
