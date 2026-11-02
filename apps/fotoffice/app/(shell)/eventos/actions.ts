"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contextoEventos } from "@/lib/eventos/contexto";
import { esEstadoPago } from "@/lib/eventos/constants";
import * as S from "@/lib/eventos/servidor";
import { getterDe, validarEvento, validarInscripto } from "@/lib/eventos/validar";
import { prisma } from "@repo/db";
import { crearPlantillaDiploma, plantillasDeDiploma } from "@/lib/eventos/diploma";
import { DIPLOMAS_EDITOR_BASE_PATH } from "@/lib/eventos/diploma-constantes";
import { esDiplomaPara } from "@/lib/eventos/reglas";

/**
 * Formularios del panel de Eventos. Sin permiso vuelve al tablero; con datos inválidos vuelve a
 * la misma pantalla con `?error=`, como en Equipo.
 */

async function ctxManage() {
  const ctx = await contextoEventos("MANAGE");
  if (!ctx) redirect("/dashboard");
  return ctx;
}

function volver(ruta: string, error?: string): never {
  revalidatePath("/eventos");
  revalidatePath(ruta);
  redirect(error ? `${ruta}${ruta.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : ruta);
}

/** La ruta de vuelta la manda el formulario; sólo se aceptan pantallas de este módulo. */
function rutaDe(fd: FormData, fallback: string): string {
  const r = fd.get("volver");
  return typeof r === "string" && /^\/eventos(\/[\w-]+)*(\?[\w=&%.+-]*)?$/.test(r) ? r : fallback;
}

export async function crearEventoAction(fd: FormData) {
  const ctx = await ctxManage();
  const d = validarEvento(getterDe(fd));
  if (!d) volver("/eventos", "Poné un nombre al evento.");
  const id = await S.crearEvento(ctx.workspaceId, d);
  volver(`/eventos/${id}`);
}

export async function editarEventoAction(fd: FormData) {
  const ctx = await ctxManage();
  const id = getterDe(fd)("eventoId");
  const d = validarEvento(getterDe(fd));
  if (!d) volver(`/eventos/${id}`, "Poné un nombre al evento.");
  await S.actualizarEvento(ctx.workspaceId, id, { ...d, archivado: fd.get("archivado") === "on" });
  volver(`/eventos/${id}`);
}

export async function vincularEntradaAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const ok = await S.vincularEntrada(ctx.workspaceId, g("eventoId"), g("productId"), g("tipo") || null);
  if (ok) await S.sincronizarInscriptos(ctx.workspaceId);
  volver(`/eventos/${g("eventoId")}`, ok ? undefined : "Elegí un producto.");
}

export async function desvincularEntradaAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  await S.desvincularEntrada(ctx.workspaceId, g("entradaId"));
  volver(`/eventos/${g("eventoId")}`);
}

export async function formulariosAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const claves = fd.getAll("clave").filter((c): c is string => typeof c === "string");
  await S.cambiarFormularios(ctx.workspaceId, g("eventoId"), claves);
  await S.sincronizarInscriptos(ctx.workspaceId);
  volver(`/eventos/${g("eventoId")}`);
}

export async function agregarInscriptoAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const d = validarInscripto(g);
  if (!d) volver(`/eventos/${g("eventoId")}`, "Revisá el nombre y el correo.");
  await S.agregarInscripto(ctx.workspaceId, g("eventoId"), d);
  volver(rutaDe(fd, `/eventos/${g("eventoId")}`));
}

export async function editarInscriptoAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const d = validarInscripto(g);
  const ruta = rutaDe(fd, `/eventos/${g("eventoId")}`);
  if (!d) volver(ruta, "Revisá el nombre y el correo.");
  await S.editarInscripto(ctx.workspaceId, g("inscriptoId"), d);
  volver(ruta);
}

export async function estadoPagoAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const estado = g("estadoPago");
  if (esEstadoPago(estado)) await S.cambiarEstadoPago(ctx.workspaceId, g("inscriptoId"), estado);
  volver(rutaDe(fd, `/eventos/${g("eventoId")}`));
}

export async function acreditarAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  await S.acreditar(ctx.workspaceId, g("inscriptoId"), ctx.userId, g("si") === "1");
  volver(rutaDe(fd, `/eventos/${g("eventoId")}`));
}

export async function eliminarInscriptoAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  await S.eliminarInscripto(ctx.workspaceId, g("inscriptoId"));
  volver(rutaDe(fd, `/eventos/${g("eventoId")}`));
}

export async function crearDiplomaAction(fd: FormData) {
  const ctx = await ctxManage();
  const eventoId = getterDe(fd)("eventoId");
  const r = await crearPlantillaDiploma(ctx.workspaceId, ctx.userId, eventoId);
  if (!r.ok) volver(`/eventos/${eventoId}`, r.error);
  revalidatePath(`/eventos/${eventoId}`);
  redirect(`${DIPLOMAS_EDITOR_BASE_PATH}/${r.templateId}/${r.versionId}`);
}

export async function diplomaConfigAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const eventoId = g("eventoId");
  const para = g("diplomaPara");
  const plantilla = g("diplomaTemplateId");
  const validas = new Set((await plantillasDeDiploma(ctx.workspaceId)).map((p) => p.id));
  await prisma.fotofficeEvento.updateMany({
    where: { id: eventoId, workspaceId: ctx.workspaceId },
    data: {
      ...(esDiplomaPara(para) ? { diplomaPara: para } : {}),
      ...(plantilla === "" ? { diplomaTemplateId: null } : validas.has(plantilla) ? { diplomaTemplateId: plantilla } : {}),
    },
  });
  volver(`/eventos/${eventoId}`);
}
