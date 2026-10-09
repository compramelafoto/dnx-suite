/**
 * Enganche con Google Calendar (Etapa 4, Entrega B). Cada cambio de una cita que tenga que llegar a
 * Google llama a `alCambiarCita` DESPUÉS de confirmar (con `after()` en las acciones). La implementación
 * vive en `empuje.ts`; este archivo conserva el punto de entrada que ya usan las acciones y `crear.ts`.
 */
export { alCambiarCita } from "./empuje";
