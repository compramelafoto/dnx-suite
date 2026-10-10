"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { EXHIBITOR_TEXT_LIMITS, exhibitorJoinProblems, exhibitorLinkState } from "@repo/muestras";
import { esTokenConForma } from "@/lib/curaduria/token";
import { frenarPorUsuario } from "@/lib/limite";
import { crearOActualizarPerfil } from "@/lib/perfiles/crear";
import { LARGOS_PERFIL, perfilDesdeFormData, type PerfilForm } from "@/lib/perfiles/mapear";
import { getUsuario } from "@/lib/usuario";

export type ResultadoAlta = { ok: true; id: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoAlta => ({ ok: false, errores: [texto] });
const NO_EXISTE = error("Este enlace no existe.");
const esChoqueUnico = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";

/**
 * Sumarse a una muestra con el enlace de expositores (spec D3). Con sesión: firma, perfil de
 * fotógrafo (se crea si no hay; si hay, sólo se completa la biografía vacía) y aceptación de
 * derechos. Sumarse dos veces no duplica: devuelve la participación que ya existe.
 */
export async function sumarmeComoExpositor(fd: FormData): Promise<ResultadoAlta> {
  const usuario = await getUsuario();
  if (!usuario) return error("Tenés que ingresar.");
  const token = fd.get("token");
  // Lo que no tiene la forma de un token nuestro ni se busca en la base.
  if (!esTokenConForma(token)) return NO_EXISTE;
  if (!frenarPorUsuario("sumarseExpositor", usuario.id).allowed) {
    return error("Probaste muchas veces seguidas. Esperá un rato y volvé a intentar.");
  }

  const enlace = await prisma.culturalExhibitorLink.findUnique({
    where: { token },
    select: {
      id: true, status: true, closesAt: true, maxExhibitors: true,
      activity: { select: { id: true, slug: true, type: true, reviewStatus: true, isCancelled: true, startsAt: true, endsAt: true } },
    },
  });
  if (!enlace) return NO_EXISTE;
  const a = enlace.activity;

  const previa = await prisma.culturalExhibitor.findUnique({
    where: { activityId_userId: { activityId: a.id, userId: usuario.id } },
    select: { id: true, status: true },
  });
  if (previa?.status === "ACTIVE") return { ok: true, id: previa.id };
  if (previa) return error("Quien organiza te sacó de esta muestra. Escribile si fue un error.");

  const firma = String(fd.get("firma") ?? "").trim().slice(0, EXHIBITOR_TEXT_LIMITS.displayName).trim();
  const estado = exhibitorLinkState(enlace, a, new Date());
  const expositores = estado === "OPEN" && enlace.maxExhibitors != null
    ? await prisma.culturalExhibitor.count({ where: { activityId: a.id, status: "ACTIVE" } })
    : 0;
  const problemas = exhibitorJoinProblems({
    state: estado, exhibitors: expositores, maxExhibitors: enlace.maxExhibitors, displayName: firma,
    rightsAccepted: fd.get("derechos") === "1" || fd.get("derechos") === "on",
  });
  if (problemas.length) return { ok: false, errores: problemas };

  // Si ya tiene perfil, del formulario sólo cuenta la biografía (y sólo si la suya está vacía).
  const tienePerfil = await prisma.photographerProfile.findUnique({ where: { userId: usuario.id }, select: { id: true } });
  let datos: PerfilForm;
  if (tienePerfil) {
    const bio = String(fd.get("bio") ?? "").trim().slice(0, LARGOS_PERFIL.bio).trim();
    datos = { displayName: firma, slug: "", bio: bio || null, city: null, province: null, website: null, instagram: null, avatarUrl: null };
  } else {
    const paraPerfil = new FormData();
    for (const k of ["displayName", "bio", "city", "province", "instagram", "avatarUrl"]) {
      const v = fd.get(k);
      if (typeof v === "string") paraPerfil.set(k, v);
    }
    if (!String(paraPerfil.get("displayName") ?? "").trim()) paraPerfil.set("displayName", firma);
    const leido = perfilDesdeFormData(paraPerfil);
    if (!leido.ok) return leido;
    datos = leido.perfil;
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      const perfil = await crearOActualizarPerfil(tx, usuario.id, datos);
      const fila = await tx.culturalExhibitor.create({
        data: {
          activityId: a.id, userId: usuario.id, profileId: perfil.id, displayName: firma,
          status: "ACTIVE", rightsAcceptedAt: new Date(),
        },
        select: { id: true },
      });
      return fila.id;
    });
    revalidatePath("/panel", "layout");
    return { ok: true, id };
  } catch (err) {
    if (!esChoqueUnico(err)) throw err;
    // Dos pestañas a la vez (o el slug del perfil tomado en el medio): si la fila quedó, es esa.
    const ya = await prisma.culturalExhibitor.findUnique({
      where: { activityId_userId: { activityId: a.id, userId: usuario.id } },
      select: { id: true, status: true },
    });
    if (ya?.status === "ACTIVE") return { ok: true, id: ya.id };
    return error("No pudimos sumarte. Probá de nuevo.");
  }
}
