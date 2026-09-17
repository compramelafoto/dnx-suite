import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Un botón sin variante queda invisible.
 *
 * `.fo-btn` define **solo la geometría** —alto, relleno, radio, tipografía—. El color, el
 * fondo y el borde los pone la variante. Un `className="fo-btn"` suelto se dibuja como
 * texto pelado sobre el fondo de la página: parece una etiqueta, no un botón, y quien lo
 * mira no sabe que puede hacer clic.
 *
 * Aparecieron 19 así, repartidos por toda la aplicación, y los encontró el titular mirando
 * una pantalla. Este test existe para que no vuelva a pasar sin que nadie se entere.
 */

const VARIANTES = ["primary", "secondary", "ghost", "danger-outline", "danger"];

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules" || entrada.startsWith(".")) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.tsx?$/.test(ruta)) salida.push(ruta);
  }
  return salida;
}

describe("los botones tienen variante", () => {
  it("ningún `fo-btn` se queda sin color", () => {
    const sinVariante: string[] = [];

    for (const ruta of [...archivos("app"), ...archivos("components")]) {
      const texto = readFileSync(ruta, "utf8");
      for (const [i, linea] of texto.split("\n").entries()) {
        for (const m of linea.matchAll(/className="([^"]*\bfo-btn\b[^"]*)"/g)) {
          const clases = m[1]!;
          if (!VARIANTES.some((v) => clases.includes(`fo-btn-${v}`))) {
            sinVariante.push(`${ruta}:${i + 1}`);
          }
        }
      }
    }

    expect(sinVariante).toEqual([]);
  });
});
