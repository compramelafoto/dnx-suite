"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { conectarCanalAgentes, nuevoCodigoAgentes } from "@/lib/agentes/canal";
import { correrPeriodista } from "@/lib/agentes/periodista/flujo";

export type EstadoAccionAgentes = { ok: boolean; mensaje: string } | null;

async function soloSuperAdmin(): Promise<boolean> {
  const user = await requireAuth();
  return isFotofficePlatformAdmin(user.id);
}

const SIN_PERMISO = { ok: false, mensaje: "Sólo SUPER_ADMIN puede manejar los agentes." };

/** Conecta el bot (registra el webhook con un secreto nuevo) y deja un enlace de vínculo de 30 min. */
export async function conectarAgentesAction(): Promise<EstadoAccionAgentes> {
  if (!(await soloSuperAdmin())) return SIN_PERMISO;
  const r = await conectarCanalAgentes();
  revalidatePath("/admin/agentes");
  return r;
}

export async function nuevoEnlaceAgentesAction(): Promise<EstadoAccionAgentes> {
  if (!(await soloSuperAdmin())) return SIN_PERMISO;
  const r = await nuevoCodigoAgentes();
  revalidatePath("/admin/agentes");
  return r;
}

/**
 * "Correr Periodista ahora" (para la prueba): corre en segundo plano (`after`) porque la búsqueda
 * tarda minutos. Saltea el "ya hay una de hoy" pero respeta el tope de 3 por día.
 */
export async function correrPeriodistaAction(): Promise<EstadoAccionAgentes> {
  if (!(await soloSuperAdmin())) return SIN_PERMISO;
  after(async () => {
    const r = await correrPeriodista({ motivo: "MANUAL", forzar: true });
    if (r.estado !== "CREADA") console.warn("[agentes][periodista] corrida manual", { estado: r.estado });
  });
  return { ok: true, mensaje: "El Periodista arrancó. En un par de minutos te llega la propuesta por Telegram (recargá para ver la lista)." };
}
