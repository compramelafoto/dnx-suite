/**
 * Qué presupuestos tienen cambios sin guardar en el editor abierto (en esta pestaña). Lo marca el
 * editor y lo mira «Aprobar y enviar al cliente» antes de aprobar, para no mandar una versión vieja.
 */
const conCambios = new Set<string>();

export function marcarCambiosSinGuardar(presupuestoId: string, hay: boolean): void {
  if (hay) conCambios.add(presupuestoId);
  else conCambios.delete(presupuestoId);
}

export function hayCambiosSinGuardar(presupuestoId: string): boolean {
  return conCambios.has(presupuestoId);
}

export const AVISO_CAMBIOS_SIN_GUARDAR = "Tenés cambios sin guardar en la cotización: guardalos antes de aprobar, así le llega la versión corregida.";
