/**
 * Packs del evento en el carrito de evento (fotos de varios fotógrafos mezcladas).
 *
 * Regla de Daniel (13/11/2026): rigen los packs digitales del álbum de quien organiza el evento,
 * se aplican solos (el carrito arma el precio más barato según la cantidad de fotos) y el total
 * se reparte entre los fotógrafos según cuántas fotos son de cada uno.
 *
 * Todo en pesos de precio base del fotógrafo (lo que valen `AlbumPack.price` y
 * `Album.digitalPhotoPriceCents`); el recargo de la plataforma lo suma después el motor de
 * precios, igual que con cualquier foto. Sin dependencias: lo usan las pruebas.
 */

export type PackDelEvento = { id: string; nombre: string; fotos: number; precio: number };

export type CombinacionPacks = {
  /** Precio base total de las fotos del carrito. */
  total: number;
  /** Packs usados (cada uno puede repetirse). */
  packs: Array<{ id: string; nombre: string; fotos: number; precio: number; veces: number }>;
  /** Fotos que quedan a precio suelto. */
  sueltas: number;
};

/** Packs válidos: con cantidad y precio enteros positivos. Si dos tienen la misma cantidad, el más barato. */
function packsValidos(packs: PackDelEvento[]): PackDelEvento[] {
  const porCantidad = new Map<number, PackDelEvento>();
  for (const p of packs) {
    if (!Number.isInteger(p.fotos) || p.fotos <= 0 || !Number.isFinite(p.precio) || p.precio <= 0) continue;
    const previo = porCantidad.get(p.fotos);
    if (!previo || p.precio < previo.precio) porCantidad.set(p.fotos, { ...p, precio: Math.round(p.precio) });
  }
  return [...porCantidad.values()].sort((a, b) => a.fotos - b.fotos);
}

/**
 * La combinación más barata de packs más fotos sueltas para exactamente `cantidad` fotos (un pack
 * no se puede usar con menos fotos que las que incluye). Si ningún pack mejora el precio suelto,
 * devuelve todo suelto. Programación dinámica: `cantidad` es chica (fotos de una compra).
 */
export function mejorPrecioConPacks(params: {
  cantidad: number;
  precioSuelto: number;
  packs: PackDelEvento[];
}): CombinacionPacks {
  const n = Math.max(0, Math.trunc(params.cantidad));
  const suelto = Math.max(0, Math.round(params.precioSuelto));
  const packs = packsValidos(params.packs);
  // costo[i]: mínimo para i fotos; elegido[i]: índice del pack usado al final (-1 = una suelta).
  const costo = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  const elegido = new Array<number>(n + 1).fill(-1);
  costo[0] = 0;
  for (let i = 1; i <= n; i++) {
    costo[i] = costo[i - 1] + suelto;
    elegido[i] = -1;
    packs.forEach((p, k) => {
      if (p.fotos <= i && costo[i - p.fotos] + p.precio < costo[i]) {
        costo[i] = costo[i - p.fotos] + p.precio;
        elegido[i] = k;
      }
    });
  }
  const veces = new Map<number, number>();
  let sueltas = 0;
  for (let i = n; i > 0; ) {
    const k = elegido[i];
    if (k < 0) {
      sueltas++;
      i -= 1;
    } else {
      veces.set(k, (veces.get(k) ?? 0) + 1);
      i -= packs[k].fotos;
    }
  }
  return {
    total: costo[n],
    packs: [...veces.entries()]
      .sort((a, b) => packs[b[0]].fotos - packs[a[0]].fotos)
      .map(([k, v]) => ({ ...packs[k], veces: v })),
    sueltas,
  };
}

/**
 * Reparte un total entero entre partes según su peso (cantidad de fotos), con el método del
 * resto mayor: la suma da exactamente el total y ninguna parte se aleja más de 1 peso de lo
 * proporcional. Empates: gana la parte que aparece primero.
 */
export function repartirProporcional<K>(total: number, partes: Array<{ clave: K; peso: number }>): Map<K, number> {
  const t = Math.max(0, Math.round(total));
  const pesoTotal = partes.reduce((s, p) => s + Math.max(0, p.peso), 0);
  const resultado = new Map<K, number>();
  if (pesoTotal <= 0) {
    for (const p of partes) resultado.set(p.clave, 0);
    return resultado;
  }
  const filas = partes.map((p, orden) => {
    const exacto = (t * Math.max(0, p.peso)) / pesoTotal;
    return { clave: p.clave, base: Math.floor(exacto), resto: exacto - Math.floor(exacto), orden };
  });
  let falta = t - filas.reduce((s, f) => s + f.base, 0);
  for (const f of [...filas].sort((a, b) => b.resto - a.resto || a.orden - b.orden)) {
    if (falta <= 0) break;
    f.base += 1;
    falta -= 1;
  }
  for (const f of filas) resultado.set(f.clave, f.base);
  return resultado;
}

export type PreciosDelCarrito = {
  combinacion: CombinacionPacks;
  /** Precio base por foto (pesos), para el motor de precios. La suma da `combinacion.total`. */
  basePorFoto: Map<number, number>;
  /** Precio base que le toca a cada álbum (suma de sus fotos). */
  basePorAlbum: Map<number, number>;
};

/**
 * Precios del carrito con los packs del evento, o null si no hay que tocar nada (sin packs, o
 * ningún pack mejora el precio suelto). El total se reparte por álbum según cuántas fotos tiene
 * cada uno, y dentro del álbum, foto por foto.
 */
export function preciosConPacksDelEvento(params: {
  albumes: Array<{ albumId: number; photoIds: number[] }>;
  precioSuelto: number;
  packs: PackDelEvento[];
}): PreciosDelCarrito | null {
  const cantidad = params.albumes.reduce((s, a) => s + a.photoIds.length, 0);
  if (cantidad === 0 || params.precioSuelto <= 0) return null;
  const combinacion = mejorPrecioConPacks({ cantidad, precioSuelto: params.precioSuelto, packs: params.packs });
  if (combinacion.packs.length === 0 || combinacion.total >= cantidad * Math.round(params.precioSuelto)) return null;

  const basePorAlbum = repartirProporcional(
    combinacion.total,
    params.albumes.map((a) => ({ clave: a.albumId, peso: a.photoIds.length })),
  );
  const basePorFoto = new Map<number, number>();
  for (const a of params.albumes) {
    const delAlbum = repartirProporcional(
      basePorAlbum.get(a.albumId) ?? 0,
      a.photoIds.map((id) => ({ clave: id, peso: 1 })),
    );
    for (const [id, pesos] of delAlbum) basePorFoto.set(id, pesos);
  }
  return { combinacion, basePorFoto, basePorAlbum };
}

/** «1 pack de 5 fotos + 2 sueltas», para mostrarle al comprador. */
export function describirCombinacion(c: CombinacionPacks): string {
  const partes = c.packs.map((p) => `${p.veces} × ${p.nombre}`);
  if (c.sueltas > 0) partes.push(c.sueltas === 1 ? "1 foto suelta" : `${c.sueltas} fotos sueltas`);
  return partes.join(" + ");
}
