import { clavesDe, tipoPorId } from "@/lib/landing/tipos";
import { alEncender } from "./dependencies";
import { getModuleDefinition, type ModuleFamily } from "./registry";

const TODAS: ModuleFamily[] = ["base", "negocio", "institucion", "coberturas", "formacion", "espacios"];

const PRIMERO: Record<string, ModuleFamily[]> = {
  freelance: ["negocio", "base"],
  estudio: ["negocio", "base", "espacios", "formacion"],
  local: ["base", "negocio", "espacios"],
  escuela: ["formacion", "base"],
  sociedad: ["institucion", "espacios", "formacion", "base"],
  agrupacion: ["institucion", "base"],
  ong: ["coberturas", "institucion", "base"],
  espacio: ["espacios", "base"],
};

export function ordenDeFamilias(tipoId: string | null): ModuleFamily[] {
  const primero = (tipoId && PRIMERO[tipoId]) || [];
  return [...primero, ...TODAS.filter((f) => !primero.includes(f))];
}

export function paqueteSugerido(tipoId: string): string[] {
  const tipo = tipoPorId(tipoId);
  if (!tipo) return [];
  const elegidos: string[] = [];
  for (const clave of clavesDe(tipo)) {
    const m = getModuleDefinition(clave);
    if (!m || m.status !== "AVAILABLE" || m.platformFee) continue;
    for (const dep of [...alEncender(clave, new Set(elegidos)), clave]) {
      const d = getModuleDefinition(dep);
      if (d && d.status === "AVAILABLE" && !d.platformFee && !elegidos.includes(dep)) elegidos.push(dep);
    }
  }
  return elegidos;
}
