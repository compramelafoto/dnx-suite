import { MODULE_REGISTRY, getModuleDefinition } from "./registry";

/** Dependencias faltantes para encender `clave`, transitivas, en orden de encendido (primero la base). */
export function alEncender(clave: string, encendidos: ReadonlySet<string>): string[] {
  const faltan: string[] = [];
  const visitar = (k: string, camino: Set<string>) => {
    for (const d of getModuleDefinition(k)?.dependsOn ?? []) {
      if (camino.has(d)) continue; // defensa contra ciclos
      visitar(d, new Set([...camino, d]));
      if (!encendidos.has(d) && !faltan.includes(d)) faltan.push(d);
    }
  };
  visitar(clave, new Set([clave]));
  return faltan;
}

/** Módulos encendidos que dejan de funcionar si se apaga `clave` (transitivo). */
export function alApagar(clave: string, encendidos: ReadonlySet<string>): string[] {
  const afectados: string[] = [];
  const pendientes = [clave];
  while (pendientes.length) {
    const actual = pendientes.shift()!;
    for (const m of MODULE_REGISTRY) {
      if (m.dependsOn?.includes(actual) && encendidos.has(m.key) && !afectados.includes(m.key)) {
        afectados.push(m.key);
        pendientes.push(m.key);
      }
    }
  }
  return afectados;
}
