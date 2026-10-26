"use server";

import { revalidatePath } from "next/cache";
import { requireBlogEditor } from "@/lib/blog/access";
import {
  agregarFotos,
  borrarCategoria,
  borrarFoto,
  borrarTrabajo,
  crearCategoria,
  crearTrabajo,
  despublicarTrabajo,
  editarAltFoto,
  editarCategoria,
  editarTrabajo,
  elegirPortada,
  publicarTrabajo,
  reordenarCategorias,
  reordenarFotos,
  type DatosTrabajo,
  type Resultado,
} from "@/lib/trabajos/repositorio";
import { AVISO_TABLAS_FALTANTES, TRABAJOS_ADMIN_BASE, esTablaFaltante } from "@/lib/trabajos/reglas";
import { confirmarSubida, type MedidasFoto } from "@/lib/trabajos/subida";
import { toVideoEmbedUrl } from "@/lib/website/embed-hosts";

/**
 * Acciones del panel Sitio web → Trabajos.
 *
 * - **Quién**: mismo guardián que el blog (`requireBlogEditor`: quien edita el sitio). Corre antes
 *   de todo y, sin permiso, redirige.
 * - **Dónde**: la institución sale de la sesión; ningún parámetro nombra otra. El repositorio
 *   filtra todo por `workspaceId`, así que un id ajeno simplemente no existe.
 * - **Sin tablas** (el SQL se aplica a mano): se devuelve el aviso para el administrador, no un 500.
 */

export type AccionTrabajos<T = true> = { ok: true; valor: T } | { ok: false; error: string };

async function ejecutar<T>(que: string, fn: (workspaceId: string) => Promise<Resultado<T>>): Promise<AccionTrabajos<T>> {
  const { workspace } = await requireBlogEditor();
  try {
    const r = await fn(workspace.id);
    if (r.ok) revalidatePath(TRABAJOS_ADMIN_BASE, "layout");
    return r;
  } catch (err) {
    if (esTablaFaltante(err)) return { ok: false, error: AVISO_TABLAS_FALTANTES };
    console.error(`[fotoffice][trabajos] no se pudo ${que}:`, err);
    return { ok: false, error: "Algo falló al guardar. Probá de nuevo." };
  }
}

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const textoONulo = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** «2025-03-14» (lo que da `<input type="date">`) → medianoche UTC de ese día. Vacío → null. */
function fechaDelFormulario(v: unknown): Date | null | "invalida" {
  const s = texto(v).trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "invalida";
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? "invalida" : d;
}

// ── Trabajos ────────────────────────────────────────────────────────────────

export async function crearTrabajoAction(input: { titulo: string; categoriaId?: string | null }) {
  return ejecutar("crear el trabajo", async (ws) => {
    const r = await crearTrabajo(ws, { titulo: texto(input.titulo), categoriaId: textoONulo(input.categoriaId) });
    return r.ok ? { ok: true as const, valor: { id: r.valor.id } } : r;
  });
}

export type FormularioTrabajo = {
  titulo: string;
  slug: string;
  categoriaId: string;
  lugar: string;
  /** `YYYY-MM-DD` o vacío. */
  fecha: string;
  descripcionHtml: string;
  destacado: boolean;
  seoTitle: string;
  seoDescription: string;
};

export async function guardarTrabajoAction(id: string, input: FormularioTrabajo) {
  return ejecutar("guardar el trabajo", async (ws) => {
    const fecha = fechaDelFormulario(input.fecha);
    if (fecha === "invalida") return { ok: false as const, error: "La fecha no es válida" };
    const datos: Partial<DatosTrabajo> = {
      titulo: texto(input.titulo),
      slug: texto(input.slug),
      categoriaId: textoONulo(input.categoriaId),
      lugar: textoONulo(input.lugar),
      fecha,
      descripcionHtml: textoONulo(input.descripcionHtml),
      destacado: input.destacado === true,
      seoTitle: textoONulo(input.seoTitle)?.slice(0, 120) ?? null,
      seoDescription: textoONulo(input.seoDescription)?.slice(0, 320) ?? null,
    };
    const r = await editarTrabajo(ws, texto(id), datos);
    return r.ok ? { ok: true as const, valor: true as const } : r;
  });
}

export async function publicarTrabajoAction(id: string, publicar: boolean) {
  return ejecutar(publicar ? "publicar el trabajo" : "despublicar el trabajo", async (ws) => {
    const r = publicar ? await publicarTrabajo(ws, texto(id)) : await despublicarTrabajo(ws, texto(id));
    return r.ok ? { ok: true as const, valor: true as const } : r;
  });
}

export async function borrarTrabajoAction(id: string) {
  return ejecutar("borrar el trabajo", async (ws) => {
    const r = await borrarTrabajo(ws, texto(id));
    if (!r.ok) return r;
    // El trabajo ya no está; lo que no se pudo borrar de R2 queda registrado para limpiarlo a mano,
    // y el panel avisa cuántos quedaron.
    if (r.valor.huerfanas.length > 0) {
      console.error("[fotoffice][trabajos] archivos de R2 sin borrar al borrar el trabajo:", id, r.valor.huerfanas);
    }
    return { ok: true as const, valor: { huerfanas: r.valor.huerfanas.length } };
  });
}

// ── Fotos ───────────────────────────────────────────────────────────────────

export async function confirmarSubidaAction(id: string, keys: string[], medidas: Record<string, MedidasFoto> = {}) {
  return ejecutar("registrar las fotos", async (ws) => {
    const lista = Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string").slice(0, 50) : [];
    return confirmarSubida(ws, texto(id), lista, medidas && typeof medidas === "object" ? medidas : {});
  });
}

export async function agregarVideoAction(id: string, url: string) {
  return ejecutar("agregar el video", async (ws) => {
    const limpia = texto(url).trim();
    // Se guarda el enlace tal cual lo pegaron; el sitio lo pasa a reproductor con la misma función.
    if (!toVideoEmbedUrl(limpia)) {
      return { ok: false as const, error: "Pegá un enlace de YouTube o Vimeo (por ejemplo https://youtu.be/…)" };
    }
    const r = await agregarFotos(ws, texto(id), [{ tipo: "VIDEO_URL", url: limpia }]);
    return r.ok ? { ok: true as const, valor: true as const } : r;
  });
}

export async function reordenarFotosAction(id: string, ids: string[]) {
  return ejecutar("ordenar las fotos", (ws) =>
    reordenarFotos(ws, texto(id), Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []),
  );
}

export async function elegirPortadaAction(id: string, fotoId: string) {
  return ejecutar("elegir la portada", (ws) => elegirPortada(ws, texto(id), texto(fotoId)));
}

export async function editarAltFotoAction(id: string, fotoId: string, alt: string) {
  return ejecutar("guardar la descripción de la foto", (ws) => editarAltFoto(ws, texto(id), texto(fotoId), textoONulo(alt)));
}

export async function borrarFotoAction(id: string, fotoId: string) {
  return ejecutar("borrar la foto", async (ws) => {
    const r = await borrarFoto(ws, texto(id), texto(fotoId));
    if (!r.ok) return r;
    if (r.valor.huerfanas.length > 0) {
      console.error("[fotoffice][trabajos] archivo de R2 sin borrar al borrar la foto:", fotoId, r.valor.huerfanas);
    }
    return { ok: true as const, valor: true as const };
  });
}

// ── Categorías ──────────────────────────────────────────────────────────────

export async function crearCategoriaAction(nombre: string) {
  return ejecutar("crear la categoría", async (ws) => {
    const r = await crearCategoria(ws, { nombre: texto(nombre) });
    return r.ok ? { ok: true as const, valor: { id: r.valor.id } } : r;
  });
}

export async function editarCategoriaAction(id: string, datos: { nombre?: string; slug?: string; visible?: boolean }) {
  return ejecutar("guardar la categoría", async (ws) => {
    const r = await editarCategoria(ws, texto(id), {
      ...(typeof datos.nombre === "string" ? { nombre: datos.nombre } : {}),
      ...(typeof datos.slug === "string" ? { slug: datos.slug } : {}),
      ...(typeof datos.visible === "boolean" ? { visible: datos.visible } : {}),
    });
    return r.ok ? { ok: true as const, valor: true as const } : r;
  });
}

export async function reordenarCategoriasAction(ids: string[]) {
  return ejecutar("ordenar las categorías", (ws) =>
    reordenarCategorias(ws, Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []),
  );
}

export async function borrarCategoriaAction(id: string) {
  return ejecutar("borrar la categoría", (ws) => borrarCategoria(ws, texto(id)));
}
