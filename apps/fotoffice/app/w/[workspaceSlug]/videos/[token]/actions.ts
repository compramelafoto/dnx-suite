"use server";

import { redirect } from "next/navigation";
import { pasaElFrenoDePagos } from "@/lib/pedidos/freno-publico";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import {
  MENSAJES_CARGOS, pedirDescargaExtra, pedirEnvioCassettes, pedirExtension, type ResultadoEnvioCassettes,
} from "@/lib/digitalizacion/servidor/cargos";

/**
 * Los cargos extra de la página pública de videos (spec 2026-10-22, E6, E7 y E9), sin sesión: el
 * token de la entrega es la llave y el workspace sale del slug. Se vuelve a validar todo acá: freno
 * por IP (el mismo cupo que pagar una cuota), slug y token (`pedir…` lo resuelve dentro del
 * workspace). Con el cargo hecho, se va a la página del pedido con la cuota preseleccionada; los
 * errores vuelven como un código corto (`?cargo=error&motivo=`), nunca como texto del servidor.
 */

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const LIMITE = "Hubo demasiados pedidos desde tu conexión. Esperá unos minutos y probá de nuevo.";

/** El código corto de cada mensaje conocido. */
function motivoDe(error: string): string {
  const par = Object.entries(MENSAJES_CARGOS).find(([, texto]) => texto === error);
  return par ? par[0] : "fallo";
}

function leer(formData: FormData): { slug: string; token: string; base: string } {
  const slug = formData.get("slug");
  const token = formData.get("token");
  if (typeof slug !== "string" || !SLUG.test(slug) || typeof token !== "string" || token.length > 200) redirect("/");
  return { slug, token, base: `/w/${encodeURIComponent(slug)}/videos/${encodeURIComponent(token)}` };
}

/** «Comprar otra descarga» de un video. */
export async function comprarDescargaAction(formData: FormData): Promise<void> {
  const { slug, token, base } = leer(formData);
  const volver = (motivo: string): never => redirect(`${base}?cargo=error&motivo=${motivo}`);
  if (!(await pasaElFrenoDePagos())) return volver("limite");
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return volver("noExiste");
  const r = await pedirDescargaExtra(workspaceId, token, formData.get("grabacionId"));
  if (!r.ok) return volver(motivoDe(r.error));
  // Fuera de cualquier try/catch: redirect() lanza.
  return redirect(r.urlPagar);
}

/** «Extender 30 días». */
export async function extenderAction(formData: FormData): Promise<void> {
  const { slug, token, base } = leer(formData);
  const volver = (motivo: string): never => redirect(`${base}?cargo=error&motivo=${motivo}`);
  if (!(await pasaElFrenoDePagos())) return volver("limite");
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return volver("noExiste");
  const r = await pedirExtension(workspaceId, token);
  if (!r.ok) return volver(motivoDe(r.error));
  return redirect(r.urlPagar);
}

/**
 * «Pedir envío de los cassettes»: lo llama el buscador de dirección (componente de cliente) y
 * devuelve el resultado; si hay que pagar, el navegador va a `urlPagar`.
 */
export async function pedirEnvioAction(slug: unknown, token: unknown, datos: unknown): Promise<ResultadoEnvioCassettes> {
  if (typeof slug !== "string" || !SLUG.test(slug) || typeof token !== "string" || token.length > 200) return { ok: false, error: MENSAJES_CARGOS.noExiste };
  if (!(await pasaElFrenoDePagos())) return { ok: false, error: LIMITE };
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: MENSAJES_CARGOS.noExiste };
  return pedirEnvioCassettes(workspaceId, token, datos);
}
