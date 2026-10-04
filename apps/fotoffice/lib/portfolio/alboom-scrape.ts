/**
 * Leer un portfolio de la web vieja de SFPR, alojada en Alboom.
 *
 * ── El error que este archivo existe para que no vuelva a pasar ──
 *
 * La primera migración buscaba en el HTML de cada ficha **cualquier** dirección de Alboom. Parecía
 * razonable y estaba mal: al pie de cada ficha hay una tira de "otros asociados" con miniaturas de
 * otros fotógrafos. Resultado: a cada socio se le cargaron sus fotos **más tres de otro**, y la obra
 * de alguien apareció publicada como si fuera de otra persona. Eso no es un detalle de datos: es
 * atribuirle a un fotógrafo un trabajo que no hizo.
 *
 * No lo agarró ningún test porque la extracción vivía suelta dentro del guion de migración. Por eso
 * ahora vive acá, con tests.
 *
 * ── Qué separa lo propio de lo ajeno ──
 *
 * En Alboom cada álbum es de un solo fotógrafo, y **el número de álbum está en el slug de la
 * ficha**: `1583301-melisa-valeria-chiappero...` es el álbum `1583301`. Así que las fotos del socio
 * son exactamente las que cuelgan de `/albuns/<ese número>/`. No hace falta adivinar nada.
 */

/** El sitio de SFPR en Alboom. Las direcciones de fotos de otro sitio no son de este padrón. */
const SITIO_ALBOOM = "47869";

const DIRECCION = new RegExp(
  `storage\\.alboom\\.ninja/sites/${SITIO_ALBOOM}/albuns/(\\d+)/([^"'\\s?)]+)`,
  "g",
);

/**
 * El número de álbum que encabeza el slug de una ficha, o `null` si no empieza con uno.
 *
 * Devuelve `null` en lugar de adivinar: sin número de álbum no hay forma de saber qué fotos son de
 * quién, y en ese caso es mejor que la migración se niegue a cargar nada.
 */
export function albumIdDesdeSlug(slug: string): string | null {
  const m = /^(\d+)(?:-|$)/.exec(slug.trim());
  return m ? m[1] : null;
}

/**
 * Las fotos de un álbum dentro del HTML de una ficha, sin repetidas y en el orden en que aparecen.
 *
 * Filtra por álbum a propósito, no por posición en la página: cualquier regla del tipo "las
 * primeras N" o "descartar las últimas tres" depende de cómo esté armado el HTML hoy, y fue
 * exactamente lo que falló.
 */
export function fotosDeAlbum(html: string, albumId: string): string[] {
  const vistas = new Set<string>();
  const fotos: string[] = [];

  for (const m of html.matchAll(DIRECCION)) {
    if (m[1] !== albumId) continue;
    const url = `https://${m[0]}`;
    if (vistas.has(url)) continue;
    vistas.add(url);
    fotos.push(url);
  }
  return fotos;
}

/** Cuántas fotos de OTROS álbumes trae esta ficha. Sirve para avisar, no para decidir. */
export function fotosAjenas(html: string, albumId: string): number {
  const vistas = new Set<string>();
  for (const m of html.matchAll(DIRECCION)) {
    if (m[1] === albumId) continue;
    vistas.add(m[0]);
  }
  return vistas.size;
}
