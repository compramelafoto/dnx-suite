"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { activityRole, canEditTexts, type ReviewStatus } from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { conPermiso } from "@/lib/equipo/permisos";
import { datosDeCambio } from "@/lib/equipo/registro";
import { copiarTextosAExpositores } from "@/lib/expositores/copiar";
import { frenarPorUsuario } from "@/lib/limite";
import type { ResultadoAccion } from "./acciones";
import { Choque, PAGINA_VIEJA, mensajeDeChoque } from "./choque";
import { LARGOS, leerObrasDeTextos, opt } from "./mapear";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La muestra no existe."] };
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const SIN_PERMISO: ResultadoAccion = { ok: false, errores: ["No podés editar los textos ahora."] };
class SinPermiso extends Error {}

/**
 * Textos de la muestra (etapa 5, D9): texto curatorial, créditos y título/año/técnica de cada
 * obra. No reescribe la galería (el editor completo borra y vuelve a crear las obras): actualiza
 * por id y sólo esos campos, así el id de cada obra (y el QR impreso) no cambia. Mismos estados
 * que la ficha; publicada, no vuelve a revisión.
 */
export async function guardarTextos(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const id = String(fd.get("id") ?? "");
  const crudo = String(fd.get("editVersion") ?? "");
  const version = /^\d{1,9}$/.test(crudo) ? Number(crudo) : null;
  if (!ID.test(id)) return NO_EXISTE;
  if (version == null) return { ok: false, errores: [PAGINA_VIEJA] };
  if (!frenarPorUsuario("guardarTextos", usuario.id).allowed) return { ok: false, errores: ["Guardaste muchas veces seguidas. Esperá unos minutos."] };
  const a = await prisma.culturalActivity.findUnique({
    where: { id },
    select: {
      id: true, slug: true, type: true, reviewStatus: true, proposedByUserId: true, workspaceId: true, isCancelled: true,
      members: { where: { userId: usuario.id, status: "ACTIVE" }, select: { userId: true, role: true, status: true } },
      works: { select: { id: true } },
    },
  });
  if (!a || a.type !== "MUESTRA") return NO_EXISTE;
  // El rol se lee en la base en cada guardado: sacar a alguien del equipo corta en el próximo pedido.
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: activityRole(a, usuario.id) };
  if (!canEditTexts({ ...a, reviewStatus: a.reviewStatus as ReviewStatus }, actor)) return SIN_PERMISO;
  const propias = new Set(a.works.map((w) => w.id));
  // Sólo obras de esta muestra: un id ajeno se ignora (además, el `where` lleva el activityId).
  const obras = leerObrasDeTextos(String(fd.get("obras") ?? "[]")).filter((o) => propias.has(o.id));
  if (obras.some((o) => !o.title)) return { ok: false, errores: ["Cada obra necesita un título."] };
  try {
    await prisma.$transaction(async (tx) => {
      const [fila] = await tx.$queryRaw<{ editVersion: number; lastEditedByUserId: number | null; lastEditedPart: string | null }[]>`
        SELECT "editVersion", "lastEditedByUserId", "lastEditedPart" FROM "CulturalActivity" WHERE id = ${id} FOR UPDATE`;
      // El permiso se vuelve a leer con la fila bloqueada (sacar a alguien del equipo corta acá también).
      if (fila && (await tx.culturalActivity.count({ where: conPermiso({ id }, usuario, "editTexts") })) === 0) throw new SinPermiso();
      if (!fila || Number(fila.editVersion) !== version) throw new Choque(id, fila ?? null);
      await tx.culturalActivity.update({
        where: { id },
        data: {
          curatorialText: opt(fd, "curatorialText", LARGOS.curatorialText),
          curatorCredits: opt(fd, "curatorCredits", LARGOS.curatorCredits),
          editVersion: { increment: 1 },
          ...datosDeCambio(usuario.id, "TEXTOS"),
        },
      });
      // Los textos de antes, para copiar a quien expone sólo lo que cambió (D9).
      const antes = obras.length
        ? await tx.culturalActivityWork.findMany({ where: { activityId: id, id: { in: obras.map((o) => o.id) } }, select: { id: true, title: true, year: true, technique: true } })
        : [];
      for (const o of obras) {
        await tx.culturalActivityWork.updateMany({ where: { id: o.id, activityId: id }, data: { title: o.title, year: o.year, technique: o.technique } });
      }
      // Las que cargó un expositor: quien expone ve el mismo título que se imprime (etapa 6, D9).
      if (obras.length) {
        const expositoras = await tx.culturalExhibitorWork.findMany({
          where: { activityId: id, activityWorkId: { in: obras.map((o) => o.id) } },
          select: { id: true, activityWorkId: true },
        });
        const deExpositor = new Map(expositoras.flatMap((e) => (e.activityWorkId ? [[e.activityWorkId, e.id] as const] : [])));
        await copiarTextosAExpositores(tx, id, obras, deExpositor, new Map(antes.map((w) => [w.id, w])));
      }
    }, { timeout: 30_000, maxWait: 10_000 });
  } catch (err) {
    if (err instanceof SinPermiso) return SIN_PERMISO;
    if (err instanceof Choque) return { ok: false, errores: [await mensajeDeChoque(err)] };
    throw err;
  }
  revalidatePath(`/m/${a.slug}`, "layout");
  revalidatePath(`/panel/muestras/${id}`);
  return { ok: true, id };
}
