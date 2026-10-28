import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { FOTOLIBROS_MODULE_KEY } from "@/lib/fotolibro/constantes";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";

/**
 * Los módulos con los que nace "Tu negocio": los del plan Base, el gratuito (diseño del
 * 28/10/2026, `docs/superpowers/specs/2026-10-28-plan-base-fotografos-design.md`). Es el
 * circuito completo de un freelancer: lo consultan, presupuesta, cobra y entrega.
 *
 * Lo que el plan Base deja con candado no nace encendido: mientras no existan los topes, encender
 * es regalar. Quedan afuera Foto carnet, Ventas, Equipo, WhatsApp, Tienda, Pedidos de impresión,
 * Facturación e Informes (planes pagos), Comunicación (sus placas necesitan un padrón de socios),
 * los que cobran comisión (se pide la activación) y los institucionales.
 */
const PLAN_BASE: readonly string[] = [
  CLIENTS_MODULE_KEY,
  "agenda",
  CASH_MODULE_KEY,
  WEBSITE_MODULE_KEY,
  SERVICE_LEADS_MODULE_KEY,
  "quotes",
  "orders",
  "projects",
  "gallery",
  "contracts",
  FOTOLIBROS_MODULE_KEY,
];

export function modulosInicialesDeNegocio(): string[] {
  return [...PLAN_BASE];
}
