"use server";

import { revalidatePath } from "next/cache";
import { requireBlogEditor } from "@/lib/blog/access";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { MAX_ASUNTO, MAX_CUERPO } from "@/lib/plantillas/constantes";
import { MENSAJES_ENVIO } from "@/lib/plantillas/envio";
import { contextoDelPanelMensaje } from "@/lib/plantillas/ficha";
import { guardarAjustesTestimonios, validarAjustes } from "@/lib/testimonios/ajustes";
import {
  AVISO_TABLAS_TESTIMONIOS,
  esEstadoTestimonio,
  esTablaFaltante,
  textoConsentimientoManual,
  validarTestimonio,
  type CampoTestimonio,
} from "@/lib/testimonios/dominio";
import { archivoDeFoto, borrarFotoAutor, revisarFotoAutor, subirFotoAutor } from "@/lib/testimonios/foto";
import { enviarPedidoTestimonio, prepararPedidoTestimonio, type PedidoPreparado } from "@/lib/testimonios/pedido";
import {
  borrarTestimonio,
  crearTestimonio,
  editarTestimonio,
  marcarDestacado,
  moderarTestimonio,
  reordenarTestimonios,
} from "@/lib/testimonios/repositorio";
import { RUTA_PANEL_TESTIMONIOS } from "@/lib/testimonios/rutas";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";

/**
 * Acciones de Testimonios.
 *
 * - **Moderación** (Sitio web → Testimonios): mismo guardián que el blog y los trabajos
 *   (`requireBlogEditor`: «Gestionar» en Sitio web). Corre antes de todo y, sin permiso, redirige.
 *   La institución sale de la sesión y el repositorio filtra todo por `workspaceId`.
 * - **«Pedir testimonio»** (ficha del cliente y del proyecto): la misma guarda que el botón «Mensaje»
 *   (`contextoDelPanelMensaje`), más el sitio web encendido. No hace falta poder editar el sitio para pedir un testimonio.
 */

export type AccionTestimonios<T = true> = { ok: true; valor: T } | { ok: false; error: string };

const PANEL = RUTA_PANEL_TESTIMONIOS;
const ERROR_GENERICO = "Algo falló al guardar. Probá de nuevo.";

async function ejecutar<T>(
  que: string,
  fn: (ctx: { workspaceId: string; userId: number; quien: string }) => Promise<AccionTestimonios<T>>,
): Promise<AccionTestimonios<T>> {
  const { user, workspace } = await requireBlogEditor();
  try {
    const r = await fn({ workspaceId: workspace.id, userId: user.id, quien: etiquetaDeUsuario(user) });
    if (r.ok) revalidatePath(PANEL, "layout");
    return r;
  } catch (err) {
    if (esTablaFaltante(err)) return { ok: false, error: AVISO_TABLAS_TESTIMONIOS };
    console.error(`[fotoffice][testimonios] no se pudo ${que}:`, { codigo: (err as { code?: unknown })?.code ?? "desconocido" });
    return { ok: false, error: ERROR_GENERICO };
  }
}

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const idValido = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;

// ── Moderación ──────────────────────────────────────────────────────────────

export async function moderarTestimonioAction(id: string, estado: string) {
  return ejecutar("moderar el testimonio", async ({ workspaceId, userId }) => {
    if (!idValido(id) || !esEstadoTestimonio(estado)) return { ok: false as const, error: "Los datos no son válidos." };
    const r = await moderarTestimonio(workspaceId, id, estado, userId);
    return r.ok ? { ok: true as const, valor: true as const } : r;
  });
}

export async function destacarTestimonioAction(id: string, destacado: boolean) {
  return ejecutar("destacar el testimonio", async ({ workspaceId }) => {
    if (!idValido(id)) return { ok: false as const, error: "Los datos no son válidos." };
    const hecho = await marcarDestacado(workspaceId, id, destacado === true);
    return hecho ? { ok: true as const, valor: true as const } : { ok: false as const, error: "No encontramos ese testimonio." };
  });
}

export async function editarTestimonioAction(id: string, input: { extracto: string; autorDetalle: string; permisoDelAutor?: boolean }) {
  return ejecutar("editar el testimonio", async ({ workspaceId, quien }) => {
    if (!idValido(id)) return { ok: false as const, error: "Los datos no son válidos." };
    const r = await editarTestimonio(
      workspaceId,
      id,
      { extracto: texto(input?.extracto), autorDetalle: texto(input?.autorDetalle) },
      input?.permisoDelAutor === true ? quien : null,
    );
    return r.ok ? { ok: true as const, valor: true as const } : r;
  });
}

export async function reordenarTestimoniosAction(ids: string[]) {
  return ejecutar("ordenar los testimonios", async ({ workspaceId }) => {
    if (!Array.isArray(ids)) return { ok: false as const, error: "Los datos no son válidos." };
    await reordenarTestimonios(workspaceId, ids.filter(idValido));
    return { ok: true as const, valor: true as const };
  });
}

export async function borrarTestimonioAction(id: string) {
  return ejecutar("borrar el testimonio", async ({ workspaceId }) => {
    if (!idValido(id)) return { ok: false as const, error: "Los datos no son válidos." };
    const r = await borrarTestimonio(workspaceId, id);
    if (!r.ok) return r;
    await borrarFotoAutor(r.fotoKey);
    return { ok: true as const, valor: true as const };
  });
}

export type ResultadoCargaManual =
  | { ok: true; publicado: boolean; aviso: string | null }
  | { ok: false; error: string; errores?: Partial<Record<CampoTestimonio, string>> };

/**
 * «Agregar testimonio»: carga manual (origen CARGA_MANUAL). Con «Tengo permiso del autor» queda el
 * permiso asentado con quién lo marcó, y puede publicarse en el acto; sin esa casilla entra
 * PENDIENTE y no se puede publicar. La foto (opcional, ya achicada por el navegador) la sube el
 * servidor, como en el formulario público.
 */
export async function agregarTestimonioAction(formData: FormData): Promise<ResultadoCargaManual> {
  let errores: Partial<Record<CampoTestimonio, string>> | undefined;
  const falla = (error: string, e?: Partial<Record<CampoTestimonio, string>>) => {
    errores = e;
    return { ok: false as const, error };
  };
  const r = await ejecutar<{ publicado: boolean; aviso: string | null }>("agregar el testimonio", async ({ workspaceId, userId, quien }) => {
    const v = validarTestimonio({
      texto: formData.get("texto"),
      extracto: formData.get("extracto"),
      autorNombre: formData.get("autorNombre"),
      autorDetalle: formData.get("autorDetalle"),
      autorEnlace: formData.get("autorEnlace"),
      autorEmail: formData.get("autorEmail"),
      calificacion: formData.get("calificacion"),
    });
    if (!v.ok) return falla(Object.values(v.errores)[0] ?? "Revisá los datos.", v.errores);
    const permiso = formData.get("permiso") === "on";
    const publicar = permiso && formData.get("publicar") === "on";

    const archivo = archivoDeFoto(formData.get("foto"));
    let foto: { key: string; url: string } | null = null;
    if (archivo) {
      const revisada = await revisarFotoAutor(archivo);
      if (!revisada.ok) return falla(revisada.error);
      const subida = await subirFotoAutor(workspaceId, revisada);
      if (!subida.ok) return falla(subida.error);
      foto = subida.valor;
    }

    const ahora = new Date();
    let creado: { id: string };
    try {
      creado = await crearTestimonio(
        workspaceId,
        v.datos,
        {
          origen: "CARGA_MANUAL",
          consentimiento: permiso,
          consentimientoTexto: permiso ? textoConsentimientoManual(quien, ahora) : null,
          autorFotoUrl: foto?.url ?? null,
          autorFotoKey: foto?.key ?? null,
        },
        ahora,
      );
    } catch (err) {
      // El testimonio no se creó: la foto de esta carga no queda en R2.
      await borrarFotoAutor(foto?.key ?? null);
      throw err;
    }
    if (!publicar) return { ok: true as const, valor: { publicado: false, aviso: null } };
    const m = await moderarTestimonio(workspaceId, creado.id, "PUBLICADO", userId);
    return { ok: true as const, valor: { publicado: m.ok, aviso: m.ok ? null : `Quedó pendiente: ${m.error}` } };
  });
  if (!r.ok) return { ok: false, error: r.error, ...(errores ? { errores } : {}) };
  return { ok: true, publicado: r.valor.publicado, aviso: r.valor.aviso };
}

export async function guardarAjustesTestimoniosAction(input: { automaticoEncendido: boolean; diasDespues: number | string; avisarAlEquipo: boolean }) {
  return ejecutar("guardar los ajustes de testimonios", async ({ workspaceId }) => {
    const v = validarAjustes(input ?? {});
    if (!v.ok) return v;
    const a = await guardarAjustesTestimonios(workspaceId, v.datos);
    return { ok: true as const, valor: { encendidoAt: a.encendidoAt?.toISOString() ?? null } };
  });
}

// ── «Pedir testimonio» desde la ficha ───────────────────────────────────────

type Falla = { ok: false; error: string };
const SIN_ACCESO: Falla = { ok: false, error: MENSAJES_ENVIO.sinPermiso };
const DATOS_INVALIDOS: Falla = { ok: false, error: MENSAJES_ENVIO.datosInvalidos };

/**
 * La guarda del botón «Mensaje» del cliente (`contextoDelPanelMensaje`: sesión, `operar` en Clientes,
 * módulo encendido y cliente del workspace; null ante cualquier falta, sin distinguir el motivo), más
 * el sitio web encendido.
 */
async function accesoPedido(clientId: string) {
  const ctx = await contextoDelPanelMensaje("CLIENTE", clientId);
  if (!ctx) return { ok: false as const, falla: SIN_ACCESO };
  if (!(await isModuleEnabledForWorkspace(ctx.workspaceId, WEBSITE_MODULE_KEY))) {
    return { ok: false as const, falla: { ok: false as const, error: "El sitio web no está activo: los testimonios se dejan ahí." } };
  }
  return { ok: true as const, ctx };
}

function revalidarFichas(clientId: string, proyectoId: string | null) {
  revalidatePath(`/clientes/${encodeURIComponent(clientId)}`);
  if (proyectoId) revalidatePath(`/proyectos/${encodeURIComponent(proyectoId)}`);
}

/** Crea la invitación y devuelve los textos para el compositor (correo y/o WhatsApp). */
export async function pedirTestimonioAction(datos: { clientId: string; proyectoId?: string | null }): Promise<PedidoPreparado | Falla> {
  if (!datos || !idValido(datos.clientId) || !(datos.proyectoId == null || datos.proyectoId === "" || idValido(datos.proyectoId))) {
    return DATOS_INVALIDOS;
  }
  const a = await accesoPedido(datos.clientId);
  if (!a.ok) return a.falla;
  return prepararPedidoTestimonio(a.ctx, { clientId: datos.clientId, proyectoId: datos.proyectoId || null });
}

export async function enviarPedidoTestimonioAction(datos: {
  clientId: string;
  proyectoId?: string | null;
  invitacionId: string;
  canal: string;
  templateId?: string | null;
  asunto?: string;
  cuerpo: string;
}): Promise<{ ok: true; url?: string } | Falla> {
  if (
    !datos || !idValido(datos.clientId) || !idValido(datos.invitacionId) || (datos.canal !== "EMAIL" && datos.canal !== "WHATSAPP")
    || typeof datos.cuerpo !== "string" || datos.cuerpo.length > MAX_CUERPO[datos.canal] + 1_000
    || (datos.asunto !== undefined && (typeof datos.asunto !== "string" || datos.asunto.length > MAX_ASUNTO + 1_000))
    || !(datos.templateId == null || datos.templateId === "" || idValido(datos.templateId))
    || !(datos.proyectoId == null || datos.proyectoId === "" || idValido(datos.proyectoId))
  ) {
    return DATOS_INVALIDOS;
  }
  const a = await accesoPedido(datos.clientId);
  if (!a.ok) return a.falla;
  const r = await enviarPedidoTestimonio(a.ctx, {
    clientId: datos.clientId,
    invitacionId: datos.invitacionId,
    canal: datos.canal,
    templateId: datos.templateId || null,
    asunto: datos.asunto,
    cuerpo: datos.cuerpo,
  });
  // Enviado, abierto en WhatsApp o fallido-y-registrado: el historial de la ficha cambió.
  if (r.ok || ("registrado" in r && r.registrado)) revalidarFichas(datos.clientId, datos.proyectoId || null);
  if (!r.ok) return { ok: false, error: r.error };
  return "url" in r ? { ok: true, url: r.url } : { ok: true };
}
