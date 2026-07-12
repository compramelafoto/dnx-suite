import type { StatusSnapshot } from "./release-types.js";

/**
 * Normaliza la respuesta de `vercel_status` al shape `StatusSnapshot`.
 * La API devuelve `projects[]` cuando se consulta un proyecto; el orquestador espera `project`.
 */
export function normalizeVercelStatusSnapshot(
  status: StatusSnapshot | Record<string, unknown>,
  vercelProject?: string,
): StatusSnapshot | Record<string, unknown> {
  if ((status as Record<string, unknown>).dryRun === true) {
    return status;
  }

  const raw = status as Record<string, unknown>;
  if (raw.project) {
    return status;
  }

  const projects = raw.projects as Array<Record<string, unknown>> | undefined;
  if (!projects?.length) {
    return status;
  }

  const matched =
    vercelProject !== undefined
      ? (projects.find((p) => p.name === vercelProject) ?? projects[0])
      : projects[0];

  return {
    ...raw,
    project: matched,
  };
}
