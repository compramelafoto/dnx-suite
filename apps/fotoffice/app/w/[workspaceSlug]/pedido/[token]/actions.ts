"use server";

import { redirect } from "next/navigation";
import { pasaElFrenoDePagos } from "@/lib/pedidos/freno-publico";
import { idDeCuotaValido } from "@/lib/pedidos/mp-puro";
import { iniciarPagoCuota, MENSAJES_PAGO_CUOTA } from "@/lib/pedidos/mp";
import { resolverTokenPedido } from "@/lib/pedidos/enlace";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

/**
 * «Pagar con Mercado Pago» del enlace público del pedido (etapa 3, Entrega B2), sin sesión: el
 * token es la llave y el workspace sale del slug. Se vuelve a validar TODO acá (el formulario no
 * se cree): freno por IP, slug, token del pedido (de ESE workspace) y que la cuota sea de ESE
 * pedido (`iniciarPagoCuota` lo vuelve a comprobar). Los errores vuelven a la página como un código
 * corto (`?pago=error&motivo=`), nunca como texto del servidor ni de Mercado Pago.
 */

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/i;

/** El código corto de cada mensaje conocido de `iniciarPagoCuota`. */
function motivoDe(error: string): string {
  const par = Object.entries(MENSAJES_PAGO_CUOTA).find(([, texto]) => texto === error);
  return par ? par[0] : "fallo";
}

export async function pagarCuotaAction(formData: FormData): Promise<void> {
  const slug = formData.get("slug");
  const token = formData.get("token");
  const cuotaId = formData.get("cuotaId");
  // La vuelta se arma con el slug y el token del formulario: sólo con forma conocida y codificados.
  if (typeof slug !== "string" || !SLUG.test(slug) || typeof token !== "string" || token.length > 200) redirect("/");
  const volver = (motivo: string): never =>
    redirect(`/w/${encodeURIComponent(slug)}/pedido/${encodeURIComponent(token)}?pago=error&motivo=${motivo}`);

  if (!(await pasaElFrenoDePagos())) return volver("limite");
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return volver("enlace");
  const pedido = await resolverTokenPedido(workspaceId, token);
  if (!pedido) return volver("enlace");
  if (!idDeCuotaValido(cuotaId)) return volver("noExiste");

  const r = await iniciarPagoCuota({ workspaceId, pedidoId: pedido.pedidoId, cuotaId });
  if (!r.ok) return volver(motivoDe(r.error));
  // El checkout es de Mercado Pago (https): redirect() fuera de cualquier try/catch.
  return redirect(r.checkoutUrl);
}
