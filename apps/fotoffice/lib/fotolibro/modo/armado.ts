import { FOTOS_POR_PLIEGO_MAX } from "./disenos";
import { pliegoVacio, usosPorFoto, type EstadoFotolibro, type FotoDelLibro } from "./estado";

/**
 * Armado automático del libro: de una pila de fotos a un libro entero, como hace SmartAlbums.
 *
 * 1. Las fotos se ordenan (por la hora en que se sacaron, de entrada).
 * 2. Se cortan en **momentos**: donde entre una foto y la siguiente pasa mucho más tiempo que lo
 *    normal en ese trabajo (la ceremonia, la fiesta, el vals…). Un pliego nunca mezcla dos momentos.
 * 3. Los pliegos se reparten entre los momentos según cuántas fotos tiene cada uno, y dentro de
 *    cada momento las fotos se reparten parejo.
 * 4. Cada pliego arranca con una distribución distinta a la del anterior, para que el libro no
 *    se vea todo igual. Después se retoca con A/Q como siempre.
 */

export type OrdenFotos = "fecha" | "nombre" | "subida";

export const ORDENES: { id: OrdenFotos; nombre: string }[] = [
  { id: "fecha", nombre: "Hora de toma" },
  { id: "nombre", nombre: "Nombre" },
  { id: "subida", nombre: "Orden de subida" },
];

const porNombre = (a: FotoDelLibro, b: FotoDelLibro) => a.nombre.localeCompare(b.nombre, "es", { numeric: true });

/** Las fotos en el orden pedido. Las que no tienen hora van al final, por nombre. */
export function ordenarFotos(fotos: readonly FotoDelLibro[], orden: OrdenFotos): FotoDelLibro[] {
  if (orden === "subida") return [...fotos];
  if (orden === "nombre") return [...fotos].sort(porNombre);
  return [...fotos].sort((a, b) => {
    if (a.tomada && b.tomada) return a.tomada < b.tomada ? -1 : a.tomada > b.tomada ? 1 : porNombre(a, b);
    if (a.tomada) return -1;
    if (b.tomada) return 1;
    return porNombre(a, b);
  });
}

const segundos = (iso: string) => Date.parse(`${iso}Z`) / 1000;

/**
 * Corta las fotos (ya ordenadas por hora) en momentos. Un corte es un salto de más de 20 minutos
 * y de más de 4 veces el salto típico del trabajo: en una boda donde se saca una foto por minuto,
 * media hora sin fotos es otro momento; en un viaje de días, hace falta más.
 */
export function momentos(fotos: readonly FotoDelLibro[]): FotoDelLibro[][] {
  if (fotos.length === 0) return [];
  const saltos: number[] = [];
  for (let i = 1; i < fotos.length; i++) {
    const a = fotos[i - 1]!.tomada;
    const b = fotos[i]!.tomada;
    saltos.push(a && b ? Math.max(0, segundos(b) - segundos(a)) : 0);
  }
  const ordenados = [...saltos].sort((x, y) => x - y);
  const mediana = ordenados[Math.floor(ordenados.length / 2)] ?? 0;
  const umbral = Math.max(20 * 60, mediana * 4);
  const out: FotoDelLibro[][] = [[fotos[0]!]];
  saltos.forEach((s, i) => {
    if (s > umbral) out.push([]);
    out[out.length - 1]!.push(fotos[i + 1]!);
  });
  return out;
}

/** Reparte `total` en partes proporcionales a `pesos` (enteros, que suman `total`), mínimo `min` cada una. */
function repartir(total: number, pesos: number[], min: number): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const base = Array(n).fill(min) as number[];
  let resto = total - min * n;
  if (resto <= 0) return base.map((b, i) => (i < total ? b : 0));
  const suma = pesos.reduce((a, b) => a + b, 0) || 1;
  const ideal = pesos.map((p) => (p / suma) * resto);
  const enteros = ideal.map(Math.floor);
  resto -= enteros.reduce((a, b) => a + b, 0);
  const porFraccion = ideal.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < resto; k++) enteros[porFraccion[k % n]![1]]! += 1;
  return base.map((b, i) => b + enteros[i]!);
}

/** Cuántos pliegos conviene para estas fotos: unas 4 por pliego, como un fotolibro típico. */
export const pliegosSugeridos = (fotos: number) => Math.max(1, Math.ceil(fotos / 4));

/**
 * El plan: qué fotos van en cada pliego. Con `porMomentos`, ningún pliego mezcla momentos (salvo
 * que haya más momentos que pliegos: ahí se juntan los más chicos con el vecino).
 */
export function planificar(fotos: readonly FotoDelLibro[], pliegos: number, porMomentos: boolean): string[][] {
  const n = fotos.length;
  if (n === 0 || pliegos <= 0) return Array.from({ length: Math.max(0, pliegos) }, () => []);
  // No pueden quedar pliegos vacíos en el medio ni pasarse del máximo por pliego.
  const usados = Math.min(pliegos, n);
  let grupos = porMomentos ? momentos(fotos) : [[...fotos]];
  while (grupos.length > usados) {
    // Se junta el momento más chico con su vecino más chico.
    let i = 0;
    grupos.forEach((g, k) => {
      if (g.length < grupos[i]!.length) i = k;
    });
    const j = i === 0 ? 1 : i === grupos.length - 1 ? i - 1 : grupos[i - 1]!.length <= grupos[i + 1]!.length ? i - 1 : i + 1;
    const [a, b] = [Math.min(i, j), Math.max(i, j)];
    grupos = [...grupos.slice(0, a), [...grupos[a]!, ...grupos[b]!], ...grupos.slice(b + 1)];
  }
  let pliegosPorGrupo = repartir(usados, grupos.map((g) => g.length), 1);
  // Si algún momento no entra en sus pliegos (más de 12 por pliego), separar por momentos haría
  // perder fotos: se arma todo seguido.
  if (grupos.some((g, i) => g.length > pliegosPorGrupo[i]! * FOTOS_POR_PLIEGO_MAX)) {
    grupos = [[...fotos]];
    pliegosPorGrupo = [usados];
  }
  const plan: string[][] = [];
  grupos.forEach((g, gi) => {
    const p = pliegosPorGrupo[gi]!;
    // Dentro del momento, parejo: las sobrantes van a los primeros pliegos.
    const cuantas = repartir(g.length, Array(p).fill(1), 0);
    let k = 0;
    for (const c of cuantas) {
      plan.push(g.slice(k, k + c).map((f) => f.id));
      k += c;
    }
  });
  while (plan.length < pliegos) plan.push([]);
  return plan.map((ids) => ids.slice(0, FOTOS_POR_PLIEGO_MAX));
}

export type OpcionesArmado = {
  /** Qué fotos entran, ya filtradas (todas, sin usar o las elegidas). */
  fotos: FotoDelLibro[];
  orden: OrdenFotos;
  pliegos: number;
  /** "todo" rearma el libro entero; "vacios" sólo llena los pliegos que no tienen fotos. */
  alcance: "todo" | "vacios";
  porMomentos: boolean;
};

export function armarLibro(e: EstadoFotolibro, o: OpcionesArmado): EstadoFotolibro {
  const ordenadas = ordenarFotos(o.fotos, o.orden);
  if (o.alcance === "vacios") {
    const vacios = e.pliegos.map((p, i) => (p.todo.fotos.length + p.izq.fotos.length + p.der.fotos.length === 0 ? i : -1)).filter((i) => i >= 0);
    const plan = planificar(ordenadas, vacios.length, o.porMomentos);
    const pliegos = e.pliegos.map((p) => p);
    vacios.forEach((i, k) => {
      pliegos[i] = { ...pliegoVacio("pliego"), todo: { fotos: plan[k] ?? [], variante: k % 3 } };
    });
    return { ...e, pliegos };
  }
  const plan = planificar(ordenadas, Math.max(1, o.pliegos), o.porMomentos);
  // Variante 0, 1, 2…: las primeras de la lista ya son de estructuras distintas (ver `disenos.ts`).
  const pliegos = plan.map((ids, i) => ({ ...pliegoVacio("pliego"), todo: { fotos: ids, variante: i % 3 } }));
  return { ...e, pliegos };
}

/** Las fotos que todavía no están en el libro. */
export const fotosSinUsar = (e: EstadoFotolibro) => {
  const usos = usosPorFoto(e);
  return e.fotos.filter((f) => !usos.has(f.id));
};
