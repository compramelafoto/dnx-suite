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
