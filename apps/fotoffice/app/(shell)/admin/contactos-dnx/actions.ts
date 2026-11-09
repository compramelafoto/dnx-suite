"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { importarConocidos } from "@/lib/agentes/buscador/carga-inicial";
import { agregarNota, cambiarEstado, CAMPOS_DATO, editarDato, fusionar, type CampoDato } from "@/lib/agentes/buscador/contactos";
import { activarRegion } from "@/lib/agentes/buscador/consultas";
import { candidatosParaFusionar } from "@/lib/agentes/buscador/consultas-panel";
import { reordenarRegiones } from "@/lib/agentes/buscador/estado";
import { etiquetaRegion, etiquetaTipo } from "@/lib/agentes/buscador/etiquetas";
import { guardarAjustes, leerAjustes } from "@/lib/agentes/buscador/gasto";
import { correrBuscador } from "@/lib/agentes/buscador/motor";
import { ESTADOS_CONTACTO, REGIONES, type EstadoContacto, type Region } from "@/lib/agentes/buscador/tipos";

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

// ---------------------------------------------------------------------------------------------
// Agente Buscador (cabecera del panel). Cada acción vuelve a chequear SUPER_ADMIN: las acciones del
// servidor son direcciones públicas y no alcanza con que el layout esconda la pantalla.

/** Tope editable de cada fuente, en USD. */
const TOPE_MAXIMO_USD = 500;
/** Tiempo de búsqueda de «Correr ahora»: el mismo que el cron. */
const PRESUPUESTO_MANUAL_MS = 240_000;

const esRegion = (v: string): v is Region => (REGIONES as readonly string[]).includes(v);

/** «Pausar» y «Reanudar»: la pausa es general (el cron y «Correr ahora» no buscan nada mientras dure). */
export async function pausarBuscadorAction(pausado: boolean): Promise<EstadoAccionContactos> {
  if (!(await autorSuperAdmin())) return SIN_PERMISO;
  await guardarAjustes({ pausado: Boolean(pausado) });
  refrescar();
  return { ok: true, mensaje: pausado ? "Buscador en pausa." : "Buscador reanudado: sigue en la próxima corrida." };
}

/** Lee un monto escrito a mano ("6,10" o "6.10"). Devuelve null si no es un número entre 0 y el máximo. */
function leerTope(texto: string): number | null {
  const limpio = String(texto ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0 || n > TOPE_MAXIMO_USD) return null;
  return Math.round(n * 100) / 100;
}

export async function guardarTopesAction(topeGoogle: string, topeClaude: string): Promise<EstadoAccionContactos> {
  if (!(await autorSuperAdmin())) return SIN_PERMISO;
  const google = leerTope(topeGoogle);
  const claude = leerTope(topeClaude);
  if (google === null || claude === null) {
    const cual = google === null && claude === null ? "Los dos topes tienen" : google === null ? "El tope de Google tiene" : "El tope de Claude tiene";
    return { ok: false, mensaje: `${cual} que ser un número entre 0 y ${TOPE_MAXIMO_USD} (en dólares).` };
  }
  try {
    await guardarAjustes({ topeGoogleUsd: google, topeClaudeUsd: claude });
  } catch (e) {
    console.error("[contactos-dnx][buscador] guardar topes", e);
    return { ok: false, mensaje: "No se pudieron guardar los topes. Probá de nuevo." };
  }
  refrescar();
  return { ok: true, mensaje: "Topes guardados." };
}

/**
 * «Correr ahora»: corre el Buscador en segundo plano (`after`), igual que el Periodista, porque tarda
 * minutos. El resultado se ve al recargar la página.
 */
export async function correrBuscadorAction(): Promise<EstadoAccionContactos> {
  if (!(await autorSuperAdmin())) return SIN_PERMISO;
  const google = Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
  const claude = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (!google && !claude) {
    return { ok: false, mensaje: "No hay clave de Google ni de Claude: el Buscador no tiene con qué buscar. Cargalas en Vercel y volvé a desplegar." };
  }
  // El botón ya se deshabilita en pausa, pero se chequea acá también: la corrida en pausa no hace nada.
  if ((await leerAjustes()).pausado) return { ok: false, mensaje: "El Buscador está en pausa: reanudalo primero." };
  after(async () => {
    try {
      const r = await correrBuscador({ presupuestoMs: PRESUPUESTO_MANUAL_MS, motivo: "MANUAL" });
      console.info("[contactos-dnx][buscador] corrida manual", r);
    } catch (e) {
      console.error("[contactos-dnx][buscador] corrida manual", e);
    }
  });
  const avisos = [
    !google ? "Sin clave de Google: busca sólo en internet." : null,
    !claude ? "Sin clave de Claude: no busca en internet; de Google sólo guarda los lugares con web propia legible." : null,
  ].filter(Boolean);
  return {
    ok: true,
    mensaje: ["El Buscador arrancó. Trabaja hasta 4 minutos; recargá la página para ver el avance.", ...avisos].join(" "),
  };
}

/**
 * «Activar región» (y «Reabrir»). Una región en espera o en pausa se activa porque lo decidís vos; una
 * completa sólo con `reabrir` (la pantalla lo pide confirmado), y entonces sus búsquedas fallidas se
 * vuelven a intentar.
 */
export async function activarRegionAction(region: string, reabrir: boolean): Promise<EstadoAccionContactos> {
  if (!(await autorSuperAdmin())) return SIN_PERMISO;
  if (!esRegion(region)) return { ok: false, mensaje: "Esa región no existe." };
  try {
    // `activarRegion` se niega a reactivar una COMPLETA sin `reabrir`.
    const ok = await activarRegion(region, new Date(), { reabrir: Boolean(reabrir) });
    refrescar();
    if (!ok) return { ok: false, mensaje: `${etiquetaRegion(region)} ya está completa. Para recorrerla de nuevo, usá «Reabrir».` };
    return { ok: true, mensaje: `${etiquetaRegion(region)} quedó en curso: el Buscador sigue por ahí.` };
  } catch (e) {
    console.error("[contactos-dnx][buscador] activar región", e);
    return { ok: false, mensaje: "No se pudo activar la región. Probá de nuevo." };
  }
}

/** Nuevo orden de recorrido. Las regiones completas no se mueven. */
export async function reordenarRegionesAction(orden: string[]): Promise<EstadoAccionContactos> {
  if (!(await autorSuperAdmin())) return SIN_PERMISO;
  if (!Array.isArray(orden) || !orden.every((r) => typeof r === "string" && esRegion(r))) {
    return { ok: false, mensaje: "Ese orden tiene regiones que no existen." };
  }
  try {
    await reordenarRegiones(orden as Region[]);
  } catch (e) {
    return { ok: false, mensaje: textoError(e).replace(/^Buscador:\s*/, "") };
  }
  refrescar();
  return { ok: true, mensaje: "Orden guardado." };
}
