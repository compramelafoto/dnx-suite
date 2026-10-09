/**
 * Qué foto le toca a la pantalla, en orden o al azar.
 *
 * El azar **no es sortear cada turno por separado**: así le tocaría tres veces la misma
 * foto mientras otras todavía no salieron, que es justo lo que nadie espera de un
 * "aleatorio". Se baraja la lista entera y se recorre; cuando se termina, se vuelve a
 * barajar con otro orden.
 *
 * Todo es **determinista a partir de la semilla**. La pantalla se vuelve a dibujar muchas
 * veces por minuto y un sorteo inestable cambiaría la foto en cada repintado.
 */

/**
 * Generador pseudoaleatorio chico y estable (mulberry32).
 *
 * `Math.random()` no sirve acá: hace falta que la misma entrada dé siempre la misma
 * salida. Y una librería sería una dependencia nueva en el monorepo —que es de todos—
 * para doce líneas.
 */
function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Los índices de 0 a `cantidad - 1`, mezclados. Fisher-Yates. */
function barajar(cantidad: number, semilla: number): number[] {
  const orden = Array.from({ length: cantidad }, (_, i) => i);
  const azar = generador(semilla);

  for (let i = cantidad - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [orden[i], orden[j]] = [orden[j]!, orden[i]!];
  }

  return orden;
}

export function indiceDeFoto({
  fotosMostradas,
  cantidad,
  aleatorio,
  semilla,
}: {
  /** Cuántas fotos se mostraron antes de ésta. Crece sin tope. */
  fotosMostradas: number;
  cantidad: number;
  aleatorio: boolean;
  /** Fija el sorteo. En la pantalla sale del código del evento. */
  semilla: number;
}): number {
  if (cantidad <= 0) return 0;

  const posicion = fotosMostradas % cantidad;
  if (!aleatorio) return posicion;

  // Una mezcla nueva por pasada: así el orden cambia pero nunca se repite una foto
  // antes de que hayan salido todas.
  const pasada = Math.floor(fotosMostradas / cantidad);
  return barajar(cantidad, semilla + pasada)[posicion]!;
}
