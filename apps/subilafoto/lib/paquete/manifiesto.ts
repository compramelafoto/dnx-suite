/**
 * El manifiesto que va dentro del paquete.
 *
 * El criterio del backlog pide un paquete **verificable**: que quien lo recibe pueda
 * comprobar que están todas las fotos y que ninguna llegó rota. Sin manifiesto, un ZIP al
 * que le faltan tres fotos se abre igual y nadie se entera.
 *
 * Se guarda como `manifiesto.json` dentro del ZIP y también en la base, para poder
 * responder qué se entregó sin volver a bajar el paquete.
 */

export type ArchivoDelManifiesto = {
  /** Cómo se llama dentro del ZIP. Numerado, no el nombre original. */
  archivo: string;
  bytes: number;
  /** SHA-256 del archivo, para poder comprobarlo. Nulo si no se pudo calcular. */
  checksum: string | null;
  /** Quién la subió, si dejó nombre. */
  autor: string | null;
  pie: string | null;
  subidaEl: string;
};

export type Manifiesto = {
  version: 1;
  evento: { nombre: string; codigo: string };
  parte: { numero: number; de: number };
  generadoEl: string;
  totales: { archivos: number; bytes: number };
  archivos: ArchivoDelManifiesto[];
};

/**
 * El nombre de una foto dentro del ZIP.
 *
 * Numerado y no el original: los nombres que ponen los teléfonos se repiten —hay un
 * `IMG_0001.jpg` en cada celular de la fiesta— y un ZIP con nombres repetidos pierde
 * archivos silenciosamente al descomprimirse.
 *
 * El número lleva ceros adelante para que el explorador los ordene como se subieron y no
 * ponga la 10 entre la 1 y la 2.
 */
export function nombreEnElPaquete(posicion: number, total: number, clave: string): string {
  const ancho = Math.max(3, String(total).length);
  const extension = clave.includes(".") ? clave.slice(clave.lastIndexOf(".")) : ".jpg";
  return `${String(posicion).padStart(ancho, "0")}${extension.toLowerCase()}`;
}

export function armarManifiesto(entrada: {
  evento: { nombre: string; codigo: string };
  parte: { numero: number; de: number };
  archivos: ArchivoDelManifiesto[];
  generadoEl: Date;
}): Manifiesto {
  return {
    version: 1,
    evento: entrada.evento,
    parte: entrada.parte,
    generadoEl: entrada.generadoEl.toISOString(),
    totales: {
      archivos: entrada.archivos.length,
      bytes: entrada.archivos.reduce((suma, a) => suma + a.bytes, 0),
    },
    archivos: entrada.archivos,
  };
}

/**
 * Comprueba un paquete contra su manifiesto.
 *
 * No se usa al generarlo sino al revisarlo: es la herramienta para contestar "¿está
 * completo lo que le entregamos a este cliente?" sin abrir el ZIP a ojo.
 */
export function verificarManifiesto(
  manifiesto: Manifiesto,
  presentes: readonly { archivo: string; bytes: number }[],
): { ok: boolean; faltan: string[]; sobran: string[]; pesanDistinto: string[] } {
  const esperados = new Map(manifiesto.archivos.map((a) => [a.archivo, a.bytes]));
  const hallados = new Map(presentes.map((p) => [p.archivo, p.bytes]));

  const faltan = [...esperados.keys()].filter((n) => !hallados.has(n));
  const sobran = [...hallados.keys()].filter((n) => !esperados.has(n));
  const pesanDistinto = [...esperados.entries()]
    .filter(([n, bytes]) => hallados.has(n) && hallados.get(n) !== bytes)
    .map(([n]) => n);

  return {
    ok: faltan.length === 0 && sobran.length === 0 && pesanDistinto.length === 0,
    faltan,
    sobran,
    pesanDistinto,
  };
}
