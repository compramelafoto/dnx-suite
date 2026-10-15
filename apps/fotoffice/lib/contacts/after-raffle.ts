import "server-only";
import { sanitizeError } from "@/lib/payments/connect/log";
import { listWorkspacesWithContactSync } from "./settings";
import { syncWorkspaceContacts } from "./sync";

/**
 * Sincroniza la agenda de Google de las instituciones que acaban de cerrar el padrón de un
 * sorteo.
 *
 * La corrida de todos los días ya mantiene la agenda al día. Esta es una pasada extra en el
 * momento en que la institución mira quién participa —el cierre del padrón—, para que ese
 * día la agenda coincida exactamente con los socios activos.
 *
 * **Nunca lanza.** Viaja dentro de la tarea de sorteos, y un problema con Google no puede
 * impedir que el sorteo se resuelva ni que salgan los avisos.
 */
export async function syncContactsAfterRosterClose(
  workspaceIds: string[],
): Promise<{ workspaceId: string; ok: boolean }[]> {
  if (workspaceIds.length === 0) return [];
  try {
    const conContactos = new Set(await listWorkspacesWithContactSync());
    const resultados: { workspaceId: string; ok: boolean }[] = [];
    for (const workspaceId of workspaceIds.filter((w) => conContactos.has(w))) {
      try {
        const r = await syncWorkspaceContacts(workspaceId);
        resultados.push({ workspaceId, ok: !r.motivo });
      } catch (error) {
        console.error("[fotoffice][contactos] falló la sincronización tras el sorteo", {
          workspaceId,
          detalle: sanitizeError(error),
        });
        resultados.push({ workspaceId, ok: false });
      }
    }
    return resultados;
  } catch (error) {
    console.error("[fotoffice][contactos] no se pudo preparar la sincronización tras el sorteo", {
      detalle: sanitizeError(error),
    });
    return [];
  }
}
