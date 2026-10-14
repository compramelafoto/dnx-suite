import { redirect } from "next/navigation";

/**
 * "Escolar → Revisiones" ya no existe en el menú: la revisión de los libritos escolares vive en
 * Pedidos escolares, en el paso "Revisar diseño". Esta ruta queda para los enlaces viejos.
 * (Los diseños que no son escolares se siguen revisando en Diseños → Para revisar.)
 */
export default function EscolarRevisionesRedirect() {
  redirect("/fotografo/escuelas/pedidos?paso=REVISAR_DISENO");
}
