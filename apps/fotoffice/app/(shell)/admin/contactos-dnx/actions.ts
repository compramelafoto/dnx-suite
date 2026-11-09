"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { importarConocidos } from "@/lib/agentes/buscador/carga-inicial";
import { agregarNota, cambiarEstado, CAMPOS_DATO, editarDato, fusionar, type CampoDato } from "@/lib/agentes/buscador/contactos";
import { candidatosParaFusionar } from "@/lib/agentes/buscador/consultas-panel";
import { etiquetaTipo } from "@/lib/agentes/buscador/etiquetas";
import { ESTADOS_CONTACTO, type EstadoContacto } from "@/lib/agentes/buscador/tipos";

export type EstadoAccionContactos = { ok: boolean; mensaje: string } | null;

export type CandidatoFusion = { id: string; nombre: string; detalle: string };

const RUTA = "/admin/contactos-dnx";
const SIN_PERMISO = { ok: false, mensaje: "Sólo SUPER_ADMIN puede manejar Contactos DNX." };

/** El autor de lo que se hace desde el panel: el id del usuario (así `cambiarEstado` sabe que es una persona). */
async function autorSuperAdmin(): Promise<string | null> {
  const user = await requireAuth();
  if (!(await isFotofficePlatformAdmin(user.id))) return null;
  return String(user.id);
}

function refrescar(...ids: string[]) {
  revalidatePath(RUTA);
  for (const id of ids) revalidatePath(`${RUTA}/${id}`);
}

function textoError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/^Contactos DNX:\s*/, "");
}

/** Trae a la base los clientes de DNX Estudio con la etiqueta «Fotógrafo». Se puede repetir sin duplicar. */
export async function importarConocidosAction(): Promise<EstadoAccionContactos> {
  if (!(await autorSuperAdmin())) return SIN_PERMISO;
  try {
    const r = await importarConocidos();
    refrescar();
    if (r.importados === 0 && r.yaEstaban === 0) {
      return { ok: true, mensaje: "No encontré clientes de DNX Estudio con la etiqueta «Fotógrafo»." };
    }
    return {
      ok: true,
      mensaje: `Listo: ${r.importados} ${r.importados === 1 ? "contacto nuevo" : "contactos nuevos"} y ${r.yaEstaban} que ya estaban.`,
    };
  } catch (e) {
    console.error("[contactos-dnx] importar conocidos", e);
    return { ok: false, mensaje: "No se pudo importar. Probá de nuevo en un rato." };
  }
}

/** `forzar` sólo hace falta para sacar a alguien de «No contactar» (la pantalla lo pide confirmado). */
export async function cambiarEstadoAction(id: string, estado: string, forzar: boolean): Promise<EstadoAccionContactos> {
  const autor = await autorSuperAdmin();
  if (!autor) return SIN_PERMISO;
  if (!(ESTADOS_CONTACTO as readonly string[]).includes(estado)) return { ok: false, mensaje: "Ese estado no existe." };
  const r = await cambiarEstado(id, estado as EstadoContacto, autor, { forzar });
  refrescar(id);
  return r.ok ? { ok: true, mensaje: "Estado guardado." } : { ok: false, mensaje: r.motivo ?? "No se pudo cambiar el estado." };
}

export async function agregarNotaAction(id: string, texto: string): Promise<EstadoAccionContactos> {
  const autor = await autorSuperAdmin();
  if (!autor) return SIN_PERMISO;
  if (texto.trim() === "") return { ok: false, mensaje: "Escribí la nota antes de guardarla." };
  try {
    await agregarNota(id, texto, autor);
    refrescar(id);
    return { ok: true, mensaje: "Nota guardada." };
  } catch (e) {
    return { ok: false, mensaje: textoError(e) };
  }
}

/** Corrige un dato a mano. Vacío lo borra de la ficha (el historial de fuentes queda). */
export async function editarDatoAction(id: string, campo: string, valor: string): Promise<EstadoAccionContactos> {
  const autor = await autorSuperAdmin();
  if (!autor) return SIN_PERMISO;
  if (!(CAMPOS_DATO as readonly string[]).includes(campo)) return { ok: false, mensaje: "Ese dato no existe." };
  try {
    const limpio = valor.trim();
    await editarDato(id, campo as CampoDato, limpio === "" ? null : limpio, autor);
    refrescar(id);
    return { ok: true, mensaje: limpio === "" ? "Dato borrado." : "Dato guardado." };
  } catch (e) {
    return { ok: false, mensaje: textoError(e) };
  }
}

/** Para «Fusionar con…»: busca por id exacto o por nombre, ciudad, correo o Instagram. */
export async function buscarParaFusionarAction(id: string, busqueda: string): Promise<CandidatoFusion[]> {
  if (!(await autorSuperAdmin())) return [];
  const filas = await candidatosParaFusionar(id, busqueda);
  return filas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    detalle: [etiquetaTipo(c.tipo), [c.ciudad, c.provincia].filter(Boolean).join(", "), c.email ?? c.instagram ?? c.web]
      .filter(Boolean)
      .join(" · "),
  }));
}

/** El contacto elegido (`origenId`) se suma a esta ficha (`destinoId`) y deja de aparecer en la lista. */
export async function fusionarAction(destinoId: string, origenId: string): Promise<EstadoAccionContactos> {
  const autor = await autorSuperAdmin();
  if (!autor) return SIN_PERMISO;
  try {
    await fusionar(origenId, destinoId, autor);
    refrescar(destinoId, origenId);
    return { ok: true, mensaje: "Fusionados: los datos y la historia del otro contacto ahora están en esta ficha." };
  } catch (e) {
    return { ok: false, mensaje: textoError(e) };
  }
}
