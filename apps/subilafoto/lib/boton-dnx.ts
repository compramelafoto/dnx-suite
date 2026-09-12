import { radius, spacing } from "@repo/design-system/tokens";
import { themeSubiLaFoto } from "@repo/design-system/themes";

/**
 * El botón de DNX, con los colores de Subí la Foto.
 *
 * La geometría —radio, relleno, peso, tamaño de letra— sale de los mismos
 * tokens que usa el `Button` de `@repo/design-system`, así que un botón de esta
 * portada y uno del panel se ven iguales. Lo único propio es el color, que
 * viene del tema `themeSubiLaFoto` registrado en ese mismo paquete.
 *
 * Existe como función y no como componente porque la portada es estática y no
 * debe cargar JavaScript: el `Button` del design system es cliente y necesita
 * su proveedor de tema. Acá alcanza con el estilo.
 */

export type VarianteBoton = "primario" | "secundario";

/**
 * Color del texto sobre un fondo de marca.
 *
 * Misma regla que `Button` del design system: si el fondo es claro va tinta
 * oscura, si no va tinta clara. Se repite acá y se verifica en el test para
 * que un botón amarillo de la portada nunca quede con otro color de texto que
 * el mismo botón dibujado por el design system.
 */
export function tintaSobre(fondoHex: string): string {
  const n = parseInt(fondoHex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#050505" : "#fafafa";
}

export function estiloBotonDnx(variante: VarianteBoton = "primario") {
  const base = {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: spacing[2],
    borderRadius: radius.button,
    padding: `${spacing[3]} ${spacing[6]}`,
    fontSize: "0.9375rem",
    fontWeight: 600,
    lineHeight: 1.25,
    /*
     * El tamaño mediano del design system da 42,75 px de alto y el mínimo
     * cómodo para el dedo es 44. No se toca el paquete compartido —lo usan
     * cinco aplicaciones— pero acá se garantiza el piso: este botón se toca en
     * un salón, de noche y con el celular en una mano.
     */
    minHeight: "44px",
    textDecoration: "none" as const,
    transition: "background 0.15s ease, border-color 0.15s ease",
  };

  if (variante === "primario") {
    return {
      ...base,
      background: themeSubiLaFoto.brand.primary,
      color: tintaSobre(themeSubiLaFoto.brand.primary),
      border: "none",
    };
  }

  return {
    ...base,
    background: "transparent",
    color: themeSubiLaFoto.text,
    border: `1px solid ${themeSubiLaFoto.borderStrong}`,
  };
}
