"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { parseVisibility, type Visibility, type VisibilityPreset } from "@repo/muestras";
import { puede, rolEnMuestra } from "@/lib/equipo/permisos";
import { datosDeCambio } from "@/lib/equipo/registro";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { modoDeGaleriaDe, visibilidadDesdeFormData } from "./mapear";

export type ResultadoVisibilidad = { ok: true; preset: VisibilityPreset } | { ok: false; errores: string[] };

const SIN_SESION: ResultadoVisibilidad = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoVisibilidad = { ok: false, errores: ["No encontramos esa muestra entre las tuyas."] };
const SIN_PERMISO: ResultadoVisibilidad = { ok: false, errores: ["No podés cambiar la visibilidad de esta muestra."] };
const SEMILLA_LEGADO = "legado";

const semillaNueva = () => randomBytes(12).toString("base64url");

type Preparado =
  | { listo: false; error: ResultadoVisibilidad }
  | { listo: true; usuario: Usuario; a: { id: string; slug: string; galleryMode: string; visibility: unknown } };

/** Sesión, permiso `visibility` leído en la base y la muestra; o el error para devolver. */
async function preparar(activityId: unknown): Promise<Preparado> {
  const usuario = await getUsuario();
  if (!usuario) return { listo: false, error: SIN_SESION };
  if (typeof activityId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(activityId)) return { listo: false, error: NO_EXISTE };
  const rol = await rolEnMuestra(activityId, usuario);
  if (!rol) return { listo: false, error: NO_EXISTE };
  if (!puede(usuario, "visibility", rol.role)) return { listo: false, error: rol.role ? SIN_PERMISO : NO_EXISTE };
  if (!frenarPorUsuario("guardarVisibilidad", usuario.id).allowed) {
    return { listo: false, error: { ok: false, errores: ["Guardaste muchas veces seguidas. Esperá unos minutos."] } };
  }
  const a = await prisma.culturalActivity.findUnique({
    where: { id: activityId },
    select: { id: true, slug: true, type: true, galleryMode: true, visibility: true },
  });
  if (!a || a.type !== "MUESTRA") return { listo: false, error: NO_EXISTE };
  return { listo: true, usuario, a };
}

function refrescar(a: { id: string; slug: string }) {
  // Galería, páginas de obra, perfiles de los artistas y portada leen el ajuste.
  revalidatePath(`/m/${a.slug}`, "layout");
  revalidatePath("/fotografos", "layout");
  revalidatePath("/");
  revalidatePath(`/panel/muestras/${a.id}`, "layout");
  revalidatePath("/panel/difusion", "layout");
}

async function escribir(a: { id: string; slug: string }, usuarioId: number, v: Visibility) {
  await prisma.culturalActivity.update({
    where: { id: a.id },
    data: { visibility: v as unknown as Prisma.InputJsonValue, galleryMode: modoDeGaleriaDe(v), ...datosDeCambio(usuarioId, "FICHA") },
  });
  refrescar(a);
}

/** Guarda la sorpresa de la muestra (spec D20–D24, D28). Dueño, coorganización o super admin. */
export async function guardarVisibilidad(fd: FormData): Promise<ResultadoVisibilidad> {
  const r = await preparar(fd.get("activityId"));
  if (!r.listo) return r.error;
  const actual = parseVisibility(r.a.visibility, r.a.galleryMode);
  // Una muestra sin ajuste (o con la semilla del legado) estrena una semilla propia: el sorteo de una
  // muestra no se puede deducir del de otra.
  const conSemilla = actual.online.seed === SEMILLA_LEGADO ? { ...actual, online: { ...actual.online, seed: semillaNueva() } } : actual;
  const v = visibilidadDesdeFormData(fd, conSemilla);
  await escribir(r.a, r.usuario.id, v);
  return { ok: true, preset: v.preset };
}

/** "Volver a sortear": semilla nueva y nada más (spec D22). */
export async function volverASortear(activityId: string): Promise<ResultadoVisibilidad> {
  const r = await preparar(activityId);
  if (!r.listo) return r.error;
  const actual = parseVisibility(r.a.visibility, r.a.galleryMode);
  if (actual.online.exhibited !== "RANDOM" || actual.online.rotation === "PER_VISIT") {
    return { ok: false, errores: ["Sólo se vuelve a sortear cuando online se ven obras al azar, siempre las mismas o cada día."] };
  }
  const v: Visibility = { ...actual, online: { ...actual.online, seed: semillaNueva() } };
  await escribir(r.a, r.usuario.id, v);
  return { ok: true, preset: v.preset };
}
