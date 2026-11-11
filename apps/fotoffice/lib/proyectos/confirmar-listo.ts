import { faseDeEtapa } from "./en-curso-puro";

/**
 * Pasar un trabajo a «Listo para retirar» le avisa al cliente por WhatsApp y correo en el momento.
 * Para que un arrastre equivocado no le mande un aviso falso, se pregunta antes. Módulo PURO.
 */
export function esEtapaDeListo(e: { name: string; color?: string | null }): boolean {
  return faseDeEtapa({ name: e.name, color: e.color ?? "", order: 0, esUltima: false }) === "LISTO";
}

export function textoConfirmarListo(cliente: string | null): string {
  return `¿El trabajo${cliente ? ` de ${cliente}` : ""} ya está listo para retirar?\n\nAl aceptar, al cliente le llega el aviso por WhatsApp y correo.`;
}

/** true = seguir con el movimiento. Fuera de «Listo» no pregunta. */
export function confirmarListo(
  etapa: { name: string; color?: string | null },
  cliente: string | null,
  preguntar: (texto: string) => boolean = (t) => window.confirm(t),
): boolean {
  return !esEtapaDeListo(etapa) || preguntar(textoConfirmarListo(cliente));
}
