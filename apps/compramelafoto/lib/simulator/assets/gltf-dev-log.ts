/**
 * Logs estructurados de glTF — solo development.
 */

export type GltfDevEvent =
  | "found"
  | "missing"
  | "loading"
  | "loaded"
  | "load-error";

export function logGltfDev(
  event: GltfDevEvent,
  payload: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== "development") return;
  const prefix = "[Cam Of Duty · glTF]";
  switch (event) {
    case "found":
      console.info(`${prefix} Asset encontrado`, payload);
      break;
    case "missing":
      console.info(`${prefix} Asset no encontrado — slot vacío`, payload);
      break;
    case "loading":
      console.info(`${prefix} Cargando…`, payload);
      break;
    case "loaded":
      console.info(`${prefix} Asset cargado`, payload);
      break;
    case "load-error":
      console.warn(`${prefix} Error de carga`, payload);
      break;
  }
}
