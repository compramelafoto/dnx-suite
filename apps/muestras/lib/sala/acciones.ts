"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { puede, rolEnMuestra } from "@/lib/equipo/permisos";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";
import { rotarLlave } from "./llave";

export type ResultadoSala = { ok: true; aviso: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoSala => ({ ok: false, errores: [texto] });
const NO_EXISTE = error("No encontramos esa muestra entre las tuyas.");

/** Sesión, permiso `visibility` leído en la base y freno; o el error para devolver (spec D34). */
async function preparar(activityId: unknown): Promise<{ listo: true; id: string } | { listo: false; error: ResultadoSala }> {
  const usuario = await getUsuario();
  if (!usuario) return { listo: false, error: error("Tenés que ingresar.") };
  if (typeof activityId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(activityId)) return { listo: false, error: NO_EXISTE };
  const rol = await rolEnMuestra(activityId, usuario);
  if (!rol || !puede(usuario, "visibility", rol.role)) return { listo: false, error: NO_EXISTE };
  if (!frenarPorUsuario("guardarVisibilidad", usuario.id).allowed) return { listo: false, error: error("Hiciste muchos cambios seguidos. Esperá unos minutos.") };
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, type: true } });
  if (!a || a.type !== "MUESTRA") return { listo: false, error: NO_EXISTE };
  return { listo: true, id: a.id };
}

/** "Cortar los accesos de sala": llave nueva, los pases vigentes dejan de valer. Los QR siguen andando. */
export async function cortarAccesosDeSala(activityId: string): Promise<ResultadoSala> {
  const r = await preparar(activityId);
  if (!r.listo) return r.error;
  await rotarLlave(r.id);
  return { ok: true, aviso: "Los pases vigentes dejan de valer. Quien vuelva a escanear una ficha recibe uno nuevo." };
}

/** "Cambiar los códigos de sala": borra los códigos de esta muestra (y corta los pases). Hay que reimprimir. */
export async function cambiarCodigosDeSala(activityId: string): Promise<ResultadoSala> {
  const r = await preparar(activityId);
  if (!r.listo) return r.error;
  await prisma.culturalActivityRoomCode.deleteMany({ where: { activityId: r.id } });
  await rotarLlave(r.id);
  revalidatePath(`/panel/montaje/${r.id}`);
  return { ok: true, aviso: "Los QR impresos dejaron de dar acceso. Volvé a bajar e imprimir las fichas." };
}
