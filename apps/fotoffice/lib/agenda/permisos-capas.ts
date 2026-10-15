import { puedeEnContexto } from "@/lib/access/policy";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import type { TipoSujeto } from "@/lib/circuitos/constantes";
import { ORDERS_MODULE_KEY, veCostosDePedido } from "@/lib/pedidos/acceso";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { AGENDA_MODULE_KEY, puedeVerAgenda, type CtxAgenda } from "./acceso";
import type { ClaveCapa } from "./constantes";

/**
 * Qué capas de la agenda puede ver alguien (Etapa 4, Entrega B). Módulo PURO: recibe el contexto ya
 * resuelto y el conjunto de módulos encendidos, y decide. Cada capa exige su módulo encendido y "Ver"
 * en él; nada de lo que no se ve se lee ni se manda al navegador.
 *
 * - Citas: módulo Agenda y Ver en Agenda.
 * - Entregas: Proyectos (Ver).
 * - Tareas: las del motor, con la regla de "Mis tareas" por tipo de registro: "Gestionar" en
 *   Consultas (tareas de consultas) y/o en Proyectos (tareas de proyectos), con el módulo encendido.
 * - Cuotas: Pedidos (Ver) y además permiso de dinero (`veCostosDePedido`: dueño, administrador o
 *   quien ve Caja o Cuotas). Los importes y vencimientos de cobro son plata.
 * - Consultas (próxima acción): Consultas (Ver).
 * - Cumpleaños: Clientes (Ver), porque salen de la ficha del contacto.
 * - Reservas: Reservas (Ver).
 */
export function capasPermitidas(
  ctx: CtxAgenda,
  habilitados: ReadonlySet<string>,
): { capas: ClaveCapa[]; tiposDeTarea: TipoSujeto[] } {
  const ve = (modulo: string) => habilitados.has(modulo) && puedeEnContexto(ctx, "ver", modulo);
  const gestiona = (modulo: string) => habilitados.has(modulo) && puedeEnContexto(ctx, "operar", modulo);

  const tiposDeTarea: TipoSujeto[] = [];
  if (ctx.userId !== null && gestiona(SERVICE_LEADS_MODULE_KEY)) tiposDeTarea.push("CAPTACION");
  if (ctx.userId !== null && gestiona(PROJECTS_MODULE_KEY)) tiposDeTarea.push("PROYECTO");

  const capas: ClaveCapa[] = [];
  if (ctx.userId === null) return { capas, tiposDeTarea: [] };
  if (habilitados.has(AGENDA_MODULE_KEY) && puedeVerAgenda(ctx)) capas.push("CITAS");
  if (ve(PROJECTS_MODULE_KEY)) capas.push("ENTREGAS");
  if (tiposDeTarea.length > 0) capas.push("TAREAS");
  if (ve(ORDERS_MODULE_KEY) && veCostosDePedido(ctx)) capas.push("CUOTAS");
  if (ve(SERVICE_LEADS_MODULE_KEY)) capas.push("CONSULTAS");
  if (ve(CLIENTS_MODULE_KEY)) capas.push("CUMPLEANOS");
  if (ve(BOOKINGS_MODULE_KEY)) capas.push("RESERVAS");
  return { capas, tiposDeTarea };
}
