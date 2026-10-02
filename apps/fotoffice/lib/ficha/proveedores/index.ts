import "server-only";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import type { Proveedor } from "../linea-de-tiempo";
import { proveedorAdjuntos } from "./adjuntos";
import { proveedorCaja } from "./caja";
import { proveedorCampos } from "./campos";
import { proveedorCarnets } from "./carnets";
import { proveedorCuotas } from "./cuotas";
import { proveedorEventosPersona } from "./eventos-persona";
import { proveedorHistorialCliente } from "./historial-cliente";
import { proveedorHistorialSocio } from "./historial-socio";
import { proveedorMensajes } from "./mensajes";
import { proveedorNotas } from "./notas";

/** Todas las fuentes de la línea de tiempo de la ficha. */
export const PROVEEDORES_FICHA: Proveedor[] = [
  proveedorNotas,
  proveedorEventosPersona,
  proveedorHistorialCliente,
  proveedorHistorialSocio,
  proveedorCampos,
  proveedorMensajes,
  proveedorCaja,
  proveedorCuotas,
  proveedorCarnets,
  proveedorAdjuntos,
];

/** Fuentes que dependen de un módulo: si el módulo está apagado en el workspace, no se leen. */
const MODULO_DE_PROVEEDOR: Partial<Record<string, string>> = {
  [proveedorCaja.clave]: CASH_MODULE_KEY,
  [proveedorCuotas.clave]: MEMBERS_MODULE_KEY,
  [proveedorCarnets.clave]: MEMBERS_MODULE_KEY,
};

/**
 * Las fuentes de la línea de tiempo para un workspace: todas, menos las de módulos apagados
 * (Caja sin `cash`; cuotas y carnets sin `members`). La usan la ficha y "Ver más", para que
 * la primera página y las siguientes salgan de las mismas fuentes.
 */
export async function proveedoresParaWorkspace(workspaceId: string): Promise<Proveedor[]> {
  const modulos = [...new Set(Object.values(MODULO_DE_PROVEEDOR))] as string[];
  const encendidos = new Map(
    await Promise.all(modulos.map(async (m) => [m, await isModuleEnabledForWorkspace(workspaceId, m)] as const)),
  );
  return PROVEEDORES_FICHA.filter((p) => {
    const modulo = MODULO_DE_PROVEEDOR[p.clave];
    return !modulo || encendidos.get(modulo) === true;
  });
}
