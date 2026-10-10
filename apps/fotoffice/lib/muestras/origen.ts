/**
 * Desde dónde se miden las "Muestras cerca tuyo" del portal.
 *
 * El socio no tiene coordenadas: sólo la ciudad y la provincia que escribió (o que vinieron en el
 * padrón). Se arman los textos a buscar en el mapa, del más preciso al más general, y el primero
 * que el buscador encuentra gana. Puro: la búsqueda en sí vive en `cerca.ts`.
 */

type Lugar = { city?: string | null; province?: string | null };

const limpio = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** `"Rosario, Santa Fe, Argentina"`. Sin ciudad (o con una sola letra) no hay lugar. */
export function textoDeLugar(city?: string | null, province?: string | null): string | null {
  const c = limpio(city);
  if (c.length < 2) return null;
  const p = limpio(province);
  return [c, p, "Argentina"].filter(Boolean).join(", ");
}

/** El nombre que se muestra en la tarjeta ("Cerca de Rosario"). */
export function nombreDeLugar(texto: string): string {
  return texto.split(",")[0]!.trim();
}

/**
 * Socio primero y su institución después. A un socio sin provincia se le presta la de su
 * institución (casi todos viven en la misma), y si así no se encuentra se prueba la ciudad sola.
 */
export function candidatosDeOrigen(socio: Lugar, institucion: Lugar | null): string[] {
  const candidatos: (string | null)[] = [];
  const provinciaSocio = limpio(socio.province);
  if (provinciaSocio) {
    candidatos.push(textoDeLugar(socio.city, provinciaSocio));
  } else {
    candidatos.push(textoDeLugar(socio.city, institucion?.province));
    candidatos.push(textoDeLugar(socio.city, null));
  }
  if (institucion) candidatos.push(textoDeLugar(institucion.city, institucion.province));

  const vistos = new Set<string>();
  return candidatos.filter((t): t is string => {
    if (!t) return false;
    const clave = t.toLowerCase();
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}
