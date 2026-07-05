/**
 * Logs estructurados de HDRI — solo development.
 */

export type HdriDevEvent =
  | "select"
  | "missing"
  | "loading"
  | "pmrem-ready"
  | "applied"
  | "load-error";

export function logHdriDev(
  event: HdriDevEvent,
  payload: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== "development") return;
  const prefix = "[Cam Of Duty · HDRI]";
  switch (event) {
    case "select":
      console.info(`${prefix} Seleccionado`, payload);
      break;
    case "missing":
      console.info(`${prefix} Archivo no encontrado — fallback neutro`, payload);
      break;
    case "loading":
      console.info(`${prefix} Cargando…`, payload);
      break;
    case "pmrem-ready":
      console.info(`${prefix} PMREM generado`, payload);
      break;
    case "applied":
      console.info(`${prefix} Environment aplicado`, payload);
      break;
    case "load-error":
      console.warn(`${prefix} Error de carga`, payload);
      break;
  }
}
