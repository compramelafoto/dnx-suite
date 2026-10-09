/**
 * Enganche con Google Calendar (Etapa 4, Entrega B). Cada cambio de una cita que tenga que llegar a
 * Google llama a `alCambiarCita` DESPUÉS de confirmar (con `after()` en las acciones). Por ahora no
 * hace nada: la Tarea 4 pone acá el empuje (insert, patch o delete del evento).
 */
export async function alCambiarCita(_workspaceId: string, _citaId: string): Promise<void> {
  // Sin integración todavía.
}
