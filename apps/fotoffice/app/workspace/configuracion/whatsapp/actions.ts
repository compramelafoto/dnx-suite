"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { resolverAcceso } from "@/lib/access/acceso";
import { puede } from "@/lib/access/policy";
import { BANDEJA_MODULE_KEY } from "@/lib/bandeja/constantes";
import { borrarTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import { guardarConexion, leerConexion, MENSAJES_CONEXION } from "@/lib/bandeja/conexion";
import { MENSAJES_SIMULADOR, simularEntrante } from "@/lib/bandeja/simulador";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";

/** Estado de los formularios de Configuración → WhatsApp (`useActionState`). */
export type EstadoWhatsappConfig = {
  error: string | null;
  ok?: string;
  chatId?: string;
  /** Lo que se escribió, para no perderlo si falla el guardado. NUNCA lleva el token. */
  valores?: { modo: string; phoneNumberId: string; wabaId: string; displayPhone: string; pausaBotHoras: string };
};

const RUTA = "/workspace/configuracion/whatsapp";

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin `configurar`
 * no se lee ni se escribe nada. Se puede configurar con el módulo apagado (dejarlo listo antes de
 * encenderlo); sólo el simulador pide el módulo, porque su resultado se ve en la Bandeja.
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

export async function guardarWhatsappAction(_prev: EstadoWhatsappConfig | undefined, fd: FormData): Promise<EstadoWhatsappConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_CONEXION.sinPermiso };
  const pausa = texto(fd, "pausaBotHoras");
  const r = await guardarConexion(ctx, {
    modo: texto(fd, "modo"),
    phoneNumberId: texto(fd, "phoneNumberId"),
    wabaId: texto(fd, "wabaId"),
    displayPhone: texto(fd, "displayPhone"),
    pausaBotHoras: pausa === undefined || pausa.trim() === "" ? undefined : Number(pausa),
    token: texto(fd, "token"),
  });
  if (!r.ok) {
    return {
      error: r.error,
      valores: {
        modo: texto(fd, "modo") ?? "", phoneNumberId: texto(fd, "phoneNumberId") ?? "", wabaId: texto(fd, "wabaId") ?? "",
        displayPhone: texto(fd, "displayPhone") ?? "", pausaBotHoras: pausa ?? "",
      },
    };
  }
  revalidatePath(RUTA);
  revalidatePath("/bandeja");
  return { error: null, ok: "Configuración guardada." };
}

export async function simularEntranteAction(_prev: EstadoWhatsappConfig | undefined, fd: FormData): Promise<EstadoWhatsappConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_SIMULADOR.sinPermiso };
  if (!(await isModuleEnabledForWorkspace(ctx.workspaceId, BANDEJA_MODULE_KEY))) {
    return { error: "Primero encendé la Bandeja de WhatsApp en Configuración → Módulos." };
  }
  const r = await simularEntrante(ctx, { telefono: texto(fd, "telefono"), nombre: texto(fd, "nombre"), texto: texto(fd, "texto") });
  if (!r.ok) return { error: r.error };
  revalidatePath("/bandeja");
  return { error: null, ok: "Mensaje simulado registrado.", chatId: r.chatId };
}

/** Borra el token guardado. Si la conexión estaba en real, vuelve a prueba: sin token no puede enviar. */
export async function borrarTokenAction(_prev: EstadoWhatsappConfig | undefined, _fd: FormData): Promise<EstadoWhatsappConfig> {
  const ctx = await contexto();
  if (!ctx) return { error: MENSAJES_CONEXION.sinPermiso };
  try {
    // Primero se baja a prueba y recién después se borra: un fallo nunca deja REAL sin token.
    if ((await leerConexion(ctx.workspaceId)).modo === "REAL") {
      const r = await guardarConexion(ctx, { modo: "SIMULADO" });
      if (!r.ok) return { error: r.error };
    }
    await borrarTokenWhatsapp(ctx.workspaceId);
  } catch {
    return { error: "No se pudo borrar el token." };
  }
  revalidatePath(RUTA);
  revalidatePath("/bandeja");
  return { error: null, ok: "Token borrado." };
}
