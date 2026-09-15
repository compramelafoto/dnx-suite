/**
 * Contraste entre dos colores, según la fórmula de WCAG.
 *
 * No es un lujo de accesibilidad: la pantalla del evento se mira desde el fondo del salón
 * y la del invitado con poca luz y el brillo bajo. Un tema con poco contraste no se ve mal,
 * directamente no se lee.
 */

function aLineal(canal: number): number {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const limpio = hex.replace("#", "");
  const completo =
    limpio.length === 3
      ? limpio.split("").map((c) => c + c).join("")
      : limpio;
  const r = parseInt(completo.slice(0, 2), 16);
  const g = parseInt(completo.slice(2, 4), 16);
  const b = parseInt(completo.slice(4, 6), 16);
  return 0.2126 * aLineal(r) + 0.7152 * aLineal(g) + 0.0722 * aLineal(b);
}

export function contraste(colorA: string, colorB: string): number {
  const a = luminancia(colorA);
  const b = luminancia(colorB);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * El color que **se ve** cuando un texto se dibuja con opacidad sobre un fondo.
 *
 * Existe porque `opacity: 0.7` no baja "un poquito" el contraste: mezcla el color con el
 * fondo, y un texto que pasaba WCAG con holgura puede quedar abajo del mínimo. El cálculo
 * de contraste hay que hacerlo sobre el color mezclado, no sobre el que dice el CSS.
 */
export function mezclar(frente: string, fondo: string, alfa: number): string {
  const canales = (hex: string) => {
    const limpio = hex.replace("#", "");
    const completo =
      limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
    return [
      parseInt(completo.slice(0, 2), 16),
      parseInt(completo.slice(2, 4), 16),
      parseInt(completo.slice(4, 6), 16),
    ];
  };

  const f = canales(frente);
  const b = canales(fondo);
  const mezcla = f.map((c, i) => Math.round(c * alfa + b[i]! * (1 - alfa)));

  return `#${mezcla.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
