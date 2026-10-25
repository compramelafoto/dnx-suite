import type { Progreso } from "./catalogo";
import type { RepoCarga } from "./repositorio";
import type { Crudo, EntradaMapa } from "./tipos";

/** Ayudas para armar los contextos de las partes de la carga (sin `server-only`: reciben el repositorio). */

export function porAlboomId(filas: EntradaMapa[], entity: string): Map<string, EntradaMapa> {
  return new Map(filas.filter((f) => f.entity === entity).map((f) => [f.alboomId, f]));
}

/** Id de Alboom → id de FOTOFFICE de una entidad: el mapa y, en una simulación, lo simulado. */
export async function idsDe(repo: RepoCarga, ws: string, progreso: Progreso, entity: string, conPrefijo = false): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const f of await repo.leerMapa(ws, [entity])) m.set(conPrefijo ? `${entity}/${f.alboomId}` : f.alboomId, f.targetId);
  for (const [id, target] of Object.entries(progreso.simulados[entity] ?? {})) m.set(conPrefijo ? `${entity}/${id}` : id, target);
  return m;
}

/** Todos los crudos de una entidad (para armar índices del contexto). */
export async function todosLosCrudos(repo: RepoCarga, ws: string, entity: string): Promise<Crudo[]> {
  const out: Crudo[] = [];
  for (let cursor: string | null = null; ; ) {
    const lote = await repo.leerCrudos(ws, { entity }, cursor, 1000);
    if (lote.length === 0) break;
    out.push(...lote);
    cursor = lote[lote.length - 1]!.alboomId;
  }
  return out;
}
