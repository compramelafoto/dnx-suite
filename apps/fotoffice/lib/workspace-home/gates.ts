import { hasLevel, type ModuleLevels } from "@/lib/permissions/levels";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";

export type HomeWidgetGates = {
  socios: boolean;
  cuotas: boolean;
  altas: boolean;
  caja: boolean;
  reservas: boolean;
  sorteos: boolean;
  coberturas: boolean;
  pedidos: boolean;
};

/**
 * Qué bloques del inicio se calculan para esta persona.
 *
 * Cada bloque, con el mismo nivel que exige la pantalla a la que lleva: un número que lleva a
 * un "no tenés permiso" es peor que ninguno. Los niveles ya vienen en NONE para un módulo
 * apagado (`getModuleLevels`), así que no hace falta mirar aparte qué está encendido.
 */
export function homeWidgetGates(levels: ModuleLevels): HomeWidgetGates {
  const al = (moduleKey: string, required: "VIEW" | "MANAGE") =>
    hasLevel(levels[moduleKey] ?? "NONE", required);
  return {
    socios: al(MEMBERS_MODULE_KEY, "VIEW"),
    // Deuda, cobrado del mes y últimos pagos: lo que gestiona Cuotas.
    cuotas: al(MEMBERSHIP_DUES_MODULE_KEY, "MANAGE"),
    // Las altas llevan a Solicitudes, que exige gestionar Socios.
    altas: al(MEMBERS_MODULE_KEY, "MANAGE"),
    caja: al(CASH_MODULE_KEY, "VIEW"),
    reservas: al(BOOKINGS_MODULE_KEY, "VIEW"),
    sorteos: al(RAFFLES_MODULE_KEY, "VIEW"),
    coberturas: al(COVERAGES_MODULE_KEY, "VIEW"),
    pedidos: al(SERVICE_LEADS_MODULE_KEY, "VIEW"),
  };
}
