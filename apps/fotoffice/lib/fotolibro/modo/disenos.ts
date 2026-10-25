import { variantesDeAcomodo, type Caja } from "./maquetar";

/**
 * Las distribuciones de un pliego entero, como en los diseñadores de fotolibro profesionales.
 *
 * A diferencia de `maquetar.ts` (que nunca recorta y por eso deja aire), acá las fotos **llenan**
 * su hueco y se recortan al centro; cada una se puede reencuadrar después con doble clic. Así
 * aparecen los diseños que se esperan de un fotolibro:
 *
 * - una foto a todo el pliego, a sangre (full frame);
 * - una página entera a sangre y una grilla en la otra;
 * - foto grande con chicas al costado, arriba o abajo;
 * - grillas a sangre (sin margen, sólo la separación) y con margen;
 * - las dos páginas armadas por separado, o una página en blanco.
 *
 * Se generan todas y se ordenan por lo bien que le quedan a estas fotos (la forma de cada hueco
 * contra la de su foto): la primera es la que se usa al soltar; las demás se recorren con A/Q.
 */

export type Zonas = {
  /** El pliego entero sin márgenes (a sangre). */
  lienzo: Caja;
  /** Lo útil de cada página, con el margen (y lo que deja libre el estilo). */
  izq: Caja;
  der: Caja;
};

export const FOTOS_POR_PLIEGO_MAX = 12;
/** Cuántas distribuciones se ofrecen como mucho: más ya no se recorren con el teclado. */
const DISENOS_MAX = 80;

type Diseno = { marcos: Caja[]; castigo: number };

/** Particiones de `n` en grupos contiguos, con hasta `maxGrupos` grupos de hasta `maxPorGrupo`. */
function composiciones(n: number, maxGrupos: number, maxPorGrupo: number): number[][] {
  if (n === 0) return [[]];
  if (maxGrupos === 0) return [];
  const out: number[][] = [];
  for (let primero = 1; primero <= Math.min(n, maxPorGrupo); primero++) {
    for (const resto of composiciones(n - primero, maxGrupos - 1, maxPorGrupo)) out.push([primero, ...resto]);
  }
  return out;
}

/** Filas de igual alto; en cada fila, huecos de igual ancho. */
function enFilas(grupos: number[], z: Caja, sep: number): Caja[] {
  const filas = grupos.length;
  const h = (z.h - sep * (filas - 1)) / filas;
  const out: Caja[] = [];
  grupos.forEach((cant, r) => {
    const w = (z.w - sep * (cant - 1)) / cant;
    for (let c = 0; c < cant; c++) out.push({ x: z.x + c * (w + sep), y: z.y + r * (h + sep), w, h });
  });
  return out;
}

const transponer = (c: Caja): Caja => ({ x: c.y, y: c.x, w: c.h, h: c.w });

/** Grillas simples de `k` huecos en la zona: por filas y por columnas. */
function grillas(k: number, z: Caja, sep: number): Caja[][] {
  if (k === 0) return [[]];
  const out: Caja[][] = [];
  const maxGrupos = Math.min(4, k);
  for (const g of composiciones(k, maxGrupos, 4)) {
    out.push(enFilas(g, z, sep));
    if (k > 1) out.push(enFilas(g, transponer(z), sep).map(transponer));
  }
  return out;
}

/** Una foto grande de un lado y las demás en grilla en lo que queda. */
function conProtagonista(k: number, z: Caja, sep: number): Caja[][] {
  if (k < 2) return [];
  const out: Caja[][] = [];
  for (const f of [0.5, 0.62, 0.7]) {
    for (const lado of ["izq", "der", "arriba", "abajo"] as const) {
      const horizontal = lado === "izq" || lado === "der";
      const largo = horizontal ? z.w : z.h;
      const grande = (largo - sep) * f;
      const resto = largo - sep - grande;
      let heroe: Caja;
      let demas: Caja;
      if (lado === "izq") {
        heroe = { x: z.x, y: z.y, w: grande, h: z.h };
        demas = { x: z.x + grande + sep, y: z.y, w: resto, h: z.h };
      } else if (lado === "der") {
        demas = { x: z.x, y: z.y, w: resto, h: z.h };
        heroe = { x: z.x + resto + sep, y: z.y, w: grande, h: z.h };
      } else if (lado === "arriba") {
        heroe = { x: z.x, y: z.y, w: z.w, h: grande };
        demas = { x: z.x, y: z.y + grande + sep, w: z.w, h: resto };
      } else {
        demas = { x: z.x, y: z.y, w: z.w, h: resto };
        heroe = { x: z.x, y: z.y + resto + sep, w: z.w, h: grande };
      }
      // Lo que queda se arma en una tira o, si son muchas, en dos.
      for (const g of grillas(k - 1, demas, sep).slice(0, 6)) {
        out.push(lado === "izq" || lado === "arriba" ? [heroe, ...g] : [...g, heroe]);
      }
    }
  }
  return out;
}

function patrones(k: number, z: Caja, sep: number): Caja[][] {
  return [...grillas(k, z, sep), ...conProtagonista(k, z, sep)];
}

/** Qué tan distinta es la forma del hueco de la de su foto (0 = igual). */
function desajuste(aspectos: number[], marcos: Caja[]): number {
  let s = 0;
  marcos.forEach((m, i) => {
    s += Math.abs(Math.log(m.w / m.h / (aspectos[i] ?? 1)));
  });
  return s / Math.max(1, marcos.length);
}

const cobertura = (marcos: Caja[], lienzo: Caja) => marcos.reduce((s, m) => s + m.w * m.h, 0) / (lienzo.w * lienzo.h);

const firma = (marcos: Caja[]) =>
  marcos.map((m) => `${Math.round(m.x / 4)},${Math.round(m.y / 4)},${Math.round(m.w / 4)},${Math.round(m.h / 4)}`).join("|");

/** Las mejores formas de llenar una zona con estas fotos, para combinar páginas sin explotar. */
function mejores(aspectos: number[], z: Caja, sep: number, cuantas: number): Caja[][] {
  return patrones(aspectos.length, z, sep)
    .map((m) => ({ m, d: desajuste(aspectos, m) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, cuantas)
    .map((x) => x.m);
}

/**
 * Todas las distribuciones del pliego para estas fotos (por su proporción ancho ÷ alto), de la
 * que mejor les queda a la que peor. `resultado[v][i]` es el hueco de la foto `i` en la variante `v`.
 */
export function disenosDePliego(aspectos: number[], zonas: Zonas, sep: number): Caja[][] {
  const n = aspectos.length;
  if (n === 0) return [[]];
  if (n > FOTOS_POR_PLIEGO_MAX) throw new Error(`Hasta ${FOTOS_POR_PLIEGO_MAX} fotos por pliego.`);
  const { lienzo, izq, der } = zonas;
  const medio = lienzo.x + lienzo.w / 2;
  const pagIzq: Caja = { x: lienzo.x, y: lienzo.y, w: lienzo.w / 2, h: lienzo.h };
  const pagDer: Caja = { x: medio, y: lienzo.y, w: lienzo.w / 2, h: lienzo.h };
  const conMargen: Caja = { x: izq.x, y: Math.max(izq.y, der.y), w: der.x + der.w - izq.x, h: Math.min(izq.y + izq.h, der.y + der.h) - Math.max(izq.y, der.y) };
  const candidatos: Diseno[] = [];
  const sumar = (marcos: Caja[], castigo = 0) => {
    if (marcos.length === n && marcos.every((m) => m.w > 1 && m.h > 1)) candidatos.push({ marcos, castigo });
  };

  // Un hueco que cruza el lomo pierde lo del medio en el doblez: sólo vale si es bien ancho.
  const cruzaMal = (m: Caja) => m.x < medio - 2 && m.x + m.w > medio + 2 && m.w < lienzo.w * 0.6;

  // 1) El pliego como una sola superficie: a sangre y con margen.
  for (const [zona, castigo] of [
    [lienzo, 0],
    [conMargen, 0.02],
  ] as const) {
    for (const m of patrones(n, zona, sep)) if (!m.some(cruzaMal)) sumar(m, castigo);
  }

  // 2) Cada página por su lado: k fotos a la izquierda y el resto a la derecha.
  for (let k = 0; k <= n; k++) {
    const aIzq = aspectos.slice(0, k);
    const aDer = aspectos.slice(k);
    // Una página en blanco queda para el final: es un recurso, no lo que se espera de entrada.
    const blanco = k === 0 || k === n ? 0.35 : 0;
    const desequilibrio = Math.abs(k - (n - k)) * 0.03;
    const opciones: [Caja, Caja, number][] = [
      [izq, der, 0.02],
      [pagIzq, pagDer, 0],
      [pagIzq, der, 0.01],
      [izq, pagDer, 0.01],
    ];
    for (const [zi, zd, c] of opciones) {
      const li = k ? mejores(aIzq, zi, sep, 5) : [[]];
      const ld = n - k ? mejores(aDer, zd, sep, 5) : [[]];
      for (const a of li) for (const b of ld) sumar([...a, ...b], c + blanco + desequilibrio);
    }
  }

  // 3) Las de siempre, sin recortar: cada foto entera, con aire alrededor.
  const mitad = Math.ceil(n / 2);
  if (n > 1) {
    const ji = variantesDeAcomodo(aspectos.slice(0, mitad), izq, sep).slice(0, 3);
    const jd = variantesDeAcomodo(aspectos.slice(mitad), der, sep).slice(0, 3);
    for (const a of ji) for (const b of jd) sumar([...a, ...b], 0.2);
  } else {
    for (const z of [izq, der]) for (const m of variantesDeAcomodo(aspectos, z, sep).slice(0, 1)) sumar(m, 0.2);
  }

  const vistas = new Set<string>();
  const ordenados = candidatos
    // Además de la forma de cada hueco, cuenta cuánto del pliego queda con fotos: un pliego
    // lleno se ve más profesional que uno con mucho aire. Cruzar el lomo se paga un poco.
    .map((c) => ({
      ...c,
      puntaje: desajuste(aspectos, c.marcos) + c.castigo + (1 - cobertura(c.marcos, lienzo)) * 0.5 + (c.marcos.some((m) => m.x < medio - 2 && m.x + m.w > medio + 2) && n > 1 ? 0.05 : 0),
    }))
    .sort((a, b) => a.puntaje - b.puntaje)
    .filter((c) => {
      const f = firma(c.marcos);
      if (vistas.has(f)) return false;
      vistas.add(f);
      return true;
    });

  /*
   * Recorrer con A tiene que mostrar diseños distintos, no el mismo con la foto grande un poco
   * más ancha. Se agrupan los parecidos (misma estructura a ojo) y se va tomando el mejor de cada
   * grupo; los casi iguales quedan para después.
   */
  const grupos = new Map<string, typeof ordenados>();
  for (const c of ordenados) {
    const k = estructura(c.marcos, lienzo);
    const g = grupos.get(k);
    if (g) g.push(c);
    else grupos.set(k, [c]);
  }
  const listas = [...grupos.values()];
  const resultado: Caja[][] = [];
  for (let ronda = 0; resultado.length < DISENOS_MAX; ronda++) {
    let alguno = false;
    for (const g of listas) {
      const c = g[ronda];
      if (!c) continue;
      alguno = true;
      resultado.push(c.marcos);
      if (resultado.length >= DISENOS_MAX) break;
    }
    if (!alguno) break;
  }
  return resultado;
}

/** La forma del diseño a ojo: cada hueco redondeado a quintos del pliego. */
const estructura = (marcos: Caja[], l: Caja) =>
  marcos.map((m) => [m.x / l.w, m.y / l.h, m.w / l.w, m.h / l.h].map((v) => Math.round(v * 5)).join(",")).join("|");

const memoria = new Map<string, Caja[][]>();

/** Todas las variantes, recordadas: se piden en cada cambio del libro. */
function variantes(aspectos: number[], zonas: Zonas, sep: number): Caja[][] {
  const clave = JSON.stringify([aspectos.map((a) => a.toFixed(3)), zonas, Math.round(sep)]);
  let todas = memoria.get(clave);
  if (!todas) {
    todas = disenosDePliego(aspectos, zonas, sep);
    if (memoria.size > 300) memoria.clear();
    memoria.set(clave, todas);
  }
  return todas;
}

/** La variante pedida, dando la vuelta si el número se pasa. */
export function disenoDePliego(aspectos: number[], zonas: Zonas, sep: number, variante: number): Caja[] {
  const todas = variantes(aspectos, zonas, sep);
  const i = ((variante % todas.length) + todas.length) % todas.length;
  return todas[i] ?? [];
}

export function cantidadDeDisenos(aspectos: number[], zonas: Zonas, sep: number): number {
  return aspectos.length ? variantes(aspectos, zonas, sep).length : 0;
}
