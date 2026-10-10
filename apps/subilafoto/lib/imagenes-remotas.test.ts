import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const APP = fileURLToPath(new URL("../app", import.meta.url));

function archivosJsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosJsx(ruta);
    return /\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

/** Cada `<Image ...>` con su atributo `src`, tal cual está escrito. */
function fuentesDeImage(codigo: string): string[] {
  return [...codigo.matchAll(/<Image\b[\s\S]{0,400}?\/>/g)]
    .map((m) => /src=(\{[^}]*\}|"[^"]*")/.exec(m[0])?.[1])
    .filter((s): s is string => Boolean(s));
}

describe("next/image sólo para imágenes nuestras, nunca para las firmadas", () => {
  /*
    El 10/10/2026 la portada del evento de Sofi se veía rota. El archivo estaba perfecto en
    el bucket —un PNG de 966x666, 1,3 MB— y el optimizador de Next contestaba
    `400 INVALID_IMAGE_OPTIMIZE_REQUEST`: el host de R2 no está en `images.remotePatterns`.

    Y aunque estuviera, seguiría siendo mala idea. Las direcciones de nuestro bucket van
    **firmadas y vencen**: el optimizador guarda el resultado con la dirección entera como
    clave, firma incluida, así que cada visita genera una clave nueva y vuelve a bajar y
    recomprimir la imagen. Se paga cada vez y se rompe cuando la firma vence.

    El resto de la aplicación ya lo sabe: el logo, el banner, la moderación y la ficha de
    venta usan `<img>` pelado y lo dicen en un comentario. La portada era la única que se
    lo había saltado, en las dos pantallas donde aparece.

    Para un archivo de `public/` —el isotipo de la marca— `next/image` está perfecto: no
    vence, no se firma y lo optimiza una sola vez.
  */
  test("todo src de <Image> es una ruta local escrita a mano", () => {
    const culpables: string[] = [];

    for (const ruta of archivosJsx(APP)) {
      const codigo = readFileSync(ruta, "utf8");
      if (!codigo.includes('from "next/image"')) continue;

      for (const src of fuentesDeImage(codigo)) {
        // `src="/brand/..."` está bien. `src={loQueSea}` no: viene de nuestro bucket.
        if (!/^"\//.test(src)) {
          culpables.push(`${ruta.replace(APP, "app")} → src=${src}`);
        }
      }
    }

    expect(culpables).toEqual([]);
  });
});
