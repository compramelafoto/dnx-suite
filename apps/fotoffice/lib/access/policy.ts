import { normalizarRol, type RolCanonico } from "./roles";

/**
 * Única fuente de verdad de permisos de FOTOFFICE (spec 0.1 §3.3).
 * Equipo opera todo; sólo Configuración, Módulos y Equipo son de Dueño/Administrador.
 */
export type Capacidad =
  | "operar"
  | "verDinero"
  | "configurar"
  | "gestionarEquipo"
  | "transferirPropiedad"
  | "verSoloAsignado";

const MATRIZ: Record<RolCanonico, ReadonlySet<Capacidad>> = {
  OWNER: new Set(["operar", "verDinero", "configurar", "gestionarEquipo", "transferirPropiedad"]),
  ADMIN: new Set(["operar", "verDinero", "configurar", "gestionarEquipo"]),
  EQUIPO: new Set(["operar", "verDinero"]),
  COLABORADOR: new Set(["verSoloAsignado"]),
};

export function puede(role: string | null | undefined, capacidad: Capacidad): boolean {
  const r = normalizarRol(role);
  return r ? MATRIZ[r].has(capacidad) : false;
}
