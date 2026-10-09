"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { moduloDeRegistroEncendido } from "@/lib/campos/modulos";
import { MAX_ASUNTO, MAX_CUERPO, MAX_NOMBRE_PLANTILLA } from "@/lib/plantillas/constantes";
import {
  AUTOMATICOS,
  archivarPlantilla,
  borrarPlantilla,
  crearPlantilla,
  desarchivarPlantilla,
  duplicarPlantilla,
  editarPlantilla,
  esClaveAutomatico,
  guardarAutomatico,
  listarPlantillas,
  reordenarPlantillas,
  tipoDePlantilla,
} from "@/lib/plantillas/definiciones";

/** Error de una variable o bloque, junto al texto donde está y su posición (base 0). */
export type ErrorDeCampo = { posicion: number; mensaje: string; variable?: string; campo: "asunto" | "cuerpo" };

/** Estado de cada formulario de Configuración → Plantillas (`useActionState`). */
export type EstadoPlantillas = { error: string | null; ok?: string; errores?: ErrorDeCampo[] };

const RUTA = "/workspace/configuracion/plantillas";
const SIN_PERMISO: EstadoPlantillas = { error: "Sólo el dueño o un administrador pueden configurar las plantillas." };
const DATOS_INVALIDOS: EstadoPlantillas = { error: "Los datos no son válidos." };
const MODULO_APAGADO: EstadoPlantillas = { error: "Ese módulo no está activo." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada.
 */
async function contexto() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

function campo(fd: FormData, nombre: string, max = 100): string | null {
  const v = fd.get(nombre);
  if (typeof v !== "string" || v.length === 0 || v.length > max) return null;
  return v;
}

/** Texto libre: "" si no vino; el catálogo decide si es válido. Se corta apenas pasado el máximo. */
function texto(fd: FormData, nombre: string, max: number): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.slice(0, max + 1) : "";
}

/** Igual que `texto`, pero `undefined` si el formulario no lo trae (WhatsApp no tiene asunto). */
function textoOpcional(fd: FormData, nombre: string, max: number): string | undefined {
  return fd.has(nombre) ? texto(fd, nombre, max) : undefined;
}

function ids(fd: FormData, nombre: string, max = 500): string[] | null {
  const v = fd.getAll(nombre);
  if (v.length > max || v.some((x) => typeof x !== "string" || x.length === 0 || x.length > 100)) return null;
  return v as string[];
}

/**
 * Las plantillas de Cliente, Socio o Consulta sólo se escriben con su módulo encendido (Clientes,
 * Socios, Captación). GENERAL siempre; un tipo desconocido lo rechaza el catálogo.
 */
async function moduloApagado(workspaceId: string, tipo: string): Promise<boolean> {
  if (tipo !== "CLIENTE" && tipo !== "SOCIO" && tipo !== "CONSULTA") return false;
  return !(await moduloDeRegistroEncendido(workspaceId, tipo));
}

/** Mismo freno para una plantilla ya existente: se mira su tipo de ficha. Ajena o inexistente: lo dice el catálogo. */
async function apagadoPorPlantilla(workspaceId: string, id: string): Promise<boolean> {
  const tipo = await tipoDePlantilla(workspaceId, id);
  return tipo !== null && (await moduloApagado(workspaceId, tipo));
}

/**
 * Al reordenar se miran sólo las plantillas que cambian de lugar: una de un módulo apagado no se
 * mueve, pero no impide ordenar las demás. Un canal inválido lo rechaza el catálogo.
 */
async function apagadoAlReordenar(workspaceId: string, canal: string, orden: string[]): Promise<boolean> {
  if (canal !== "EMAIL" && canal !== "WHATSAPP") return false;
  const actuales = await listarPlantillas(workspaceId, { canal });
  const tipos = new Set(actuales.filter((p, i) => orden[i] !== p.id).map((p) => p.entityType));
  for (const tipo of tipos) if (await moduloApagado(workspaceId, tipo)) return true;
  return false;
}

function resultado(
  r: { ok: true } | { ok: false; error: string; errores?: ErrorDeCampo[] },
  ok: string,
): EstadoPlantillas {
  if (!r.ok) return r.errores ? { error: r.error, errores: r.errores } : { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok };
}

// ─── Plantillas ──────────────────────────────────────────────────────────────

export async function crearPlantillaAction(_prev: EstadoPlantillas | undefined, fd: FormData): Promise<EstadoPlantillas> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const canal = campo(fd, "canal", 20);
  const tipo = campo(fd, "tipo", 20);
  if (canal === null || tipo === null) return DATOS_INVALIDOS;
  if (await moduloApagado(ctx.workspaceId, tipo)) return MODULO_APAGADO;
  return resultado(
    await crearPlantilla(ctx, {
      canal,
      tipo,
      nombre: texto(fd, "nombre", MAX_NOMBRE_PLANTILLA * 2),
      asunto: textoOpcional(fd, "asunto", MAX_ASUNTO * 2),
      cuerpo: texto(fd, "cuerpo", MAX_CUERPO.EMAIL),
    }),
    "Plantilla agregada.",
  );
}

export async function editarPlantillaAction(_prev: EstadoPlantillas | undefined, fd: FormData): Promise<EstadoPlantillas> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  const tipo = campo(fd, "tipo", 20);
  if (id === null || tipo === null) return DATOS_INVALIDOS;
  // Ni la ficha nueva ni la que tenía pueden ser de un módulo apagado.
  if ((await moduloApagado(ctx.workspaceId, tipo)) || (await apagadoPorPlantilla(ctx.workspaceId, id))) return MODULO_APAGADO;
  return resultado(
    await editarPlantilla(ctx, id, {
      tipo,
      nombre: texto(fd, "nombre", MAX_NOMBRE_PLANTILLA * 2),
      asunto: textoOpcional(fd, "asunto", MAX_ASUNTO * 2),
      cuerpo: texto(fd, "cuerpo", MAX_CUERPO.EMAIL),
    }),
    "Cambios guardados.",
  );
}

export async function duplicarPlantillaAction(_prev: EstadoPlantillas | undefined, fd: FormData): Promise<EstadoPlantillas> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  if (await apagadoPorPlantilla(ctx.workspaceId, id)) return MODULO_APAGADO;
  return resultado(await duplicarPlantilla(ctx, id), "Plantilla duplicada: quedó al final de la lista.");
}

/** `orden` trae todas las plantillas activas del canal, en el orden nuevo. */
export async function reordenarPlantillasAction(_prev: EstadoPlantillas | undefined, fd: FormData): Promise<EstadoPlantillas> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const canal = campo(fd, "canal", 20);
  const orden = ids(fd, "orden");
  if (canal === null || orden === null) return DATOS_INVALIDOS;
  if (await apagadoAlReordenar(ctx.workspaceId, canal, orden)) return MODULO_APAGADO;
  return resultado(await reordenarPlantillas(ctx, canal, orden), "Orden guardado.");
}

export async function archivarPlantillaAction(_prev: EstadoPlantillas | undefined, fd: FormData): Promise<EstadoPlantillas> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  if (await apagadoPorPlantilla(ctx.workspaceId, id)) return MODULO_APAGADO;
  return resultado(await archivarPlantilla(ctx, id), "Plantilla archivada.");
}

export async function desarchivarPlantillaAction(_prev: EstadoPlantillas | undefined, fd: FormData): Promise<EstadoPlantillas> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  if (await apagadoPorPlantilla(ctx.workspaceId, id)) return MODULO_APAGADO;
  return resultado(await desarchivarPlantilla(ctx, id), "Plantilla desarchivada.");
}

export async function borrarPlantillaAction(_prev: EstadoPlantillas | undefined, fd: FormData): Promise<EstadoPlantillas> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const id = campo(fd, "id");
  if (id === null) return DATOS_INVALIDOS;
  if (await apagadoPorPlantilla(ctx.workspaceId, id)) return MODULO_APAGADO;
  return resultado(await borrarPlantilla(ctx, id), "Plantilla borrada.");
}

// ─── Automáticos ─────────────────────────────────────────────────────────────

/**
 * Interruptor, asunto y cuerpo. Encenderlo exige el módulo de su ficha (Captación para la
 * consulta); apagarlo se puede siempre, aunque el módulo esté apagado.
 */
export async function guardarAutomaticoAction(_prev: EstadoPlantillas | undefined, fd: FormData): Promise<EstadoPlantillas> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const clave = campo(fd, "clave", 50);
  if (clave === null || !esClaveAutomatico(clave)) return DATOS_INVALIDOS;
  const enabled = fd.get("enabled") === "1";
  if (enabled && (await moduloApagado(ctx.workspaceId, AUTOMATICOS[clave].tipo))) return MODULO_APAGADO;
  return resultado(
    await guardarAutomatico(ctx, clave, {
      enabled,
      subject: texto(fd, "asunto", MAX_ASUNTO * 2),
      body: texto(fd, "cuerpo", MAX_CUERPO.EMAIL),
    }),
    clave === "CONSULTA_AVISO_EQUIPO"
      ? enabled ? "Guardado: el aviso al equipo está encendido." : "Guardado: el aviso al equipo está apagado."
      : clave === "PRESUPUESTO_SEGUIMIENTO"
        ? enabled ? "Guardado: el texto del seguimiento está encendido." : "Guardado: el seguimiento está apagado."
        : clave === "RECIBO_DE_PAGO"
          ? enabled ? "Guardado: el recibo de pago está encendido." : "Guardado: el recibo de pago está apagado."
          : clave === "RECORDATORIO_CUOTA"
            ? enabled ? "Guardado: el texto del recordatorio de cuotas está encendido." : "Guardado: el recordatorio de cuotas está apagado."
            : clave === "RECORDATORIO_CITA"
              ? enabled ? "Guardado: el texto del recordatorio de citas está encendido." : "Guardado: el recordatorio de citas está apagado."
              : enabled ? "Guardado: la respuesta automática está encendida." : "Guardado: la respuesta automática está apagada.",
  );
}
