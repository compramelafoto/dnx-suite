import "server-only";
import type { Proveedor } from "../linea-de-tiempo";
import { proveedorAdjuntos } from "./adjuntos";
import { proveedorCaja } from "./caja";
import { proveedorCarnets } from "./carnets";
import { proveedorCuotas } from "./cuotas";
import { proveedorEventosPersona } from "./eventos-persona";
import { proveedorHistorialCliente } from "./historial-cliente";
import { proveedorHistorialSocio } from "./historial-socio";
import { proveedorNotas } from "./notas";

/** Todas las fuentes de la línea de tiempo de la ficha. */
export const PROVEEDORES_FICHA: Proveedor[] = [
  proveedorNotas,
  proveedorEventosPersona,
  proveedorHistorialCliente,
  proveedorHistorialSocio,
  proveedorCaja,
  proveedorCuotas,
  proveedorCarnets,
  proveedorAdjuntos,
];
