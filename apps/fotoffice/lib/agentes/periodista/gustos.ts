/**
 * Lo que el Periodista aprende de los gustos de Daniel: qué categorías de nota publica, cuáles
 * descarta (o pide "otra") y qué le pide al corregir. Con las últimas propuestas se arma un
 * resumen corto que va en el pedido a Claude y se muestra en /admin/agentes. Módulo PURO.
 */

/** Las categorías fijas de nota (Claude elige una por propuesta). */
export const CATEGORIAS_NOTA = [
  "concursos y premios",
  "muestras y exposiciones",
  "equipos y lanzamientos",
  "técnica y tutoriales",
  "industria y negocio",
  "fotógrafos y entrevistas",
  "historia",
  "tecnología e IA",
  "eventos",
] as const;

export type CategoriaNota = (typeof CATEGORIAS_NOTA)[number];

/** Cuántas propuestas recientes se miran para el resumen. */
export const PROPUESTAS_PARA_GUSTOS = 40;

/** Qué hizo Daniel con la propuesta. */
export type ResultadoPropuesta = "PUBLICADA" | "DESCARTADA" | "OTRA";

export type PropuestaParaGustos = {
  estado: string;
  categoria?: string | null;
  resultado?: ResultadoPropuesta | null;
  /** Los textos que mandó Daniel para corregir la nota. */
  correccionesPedidas?: string[] | null;
};

export type ResumenGustos = {
  /** Propuestas que Daniel ya resolvió (publicó, descartó o pidió otra). */
  resueltas: number;
  /** Líneas cortas para el prompt y la página. Vacío = todavía no hay de dónde aprender. */
  lineas: string[];
};

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** La categoría de la lista que corresponde a un texto (sin importar mayúsculas ni tildes), o null. */
export function categoriaValida(texto: unknown): CategoriaNota | null {
  if (typeof texto !== "string") return null;
  const t = sinTildes(texto);
  return CATEGORIAS_NOTA.find((c) => sinTildes(c) === t) ?? null;
}

/** El resultado de una propuesta: el guardado, o el que se deduce del estado (las viejas no lo tienen). */
export function resultadoDe(p: PropuestaParaGustos): ResultadoPropuesta | null {
  if (p.resultado) return p.resultado;
  if (p.estado === "PUBLICADA") return "PUBLICADA";
  if (p.estado === "DESCARTADA") return "DESCARTADA";
  return null;
}

/** Tendencias que se reconocen en los pedidos de corrección. */
const TENDENCIAS: Array<{ patron: RegExp; texto: string }> = [
  { patron: /\b(mas corto|mas corta|acorta|resumi|resumir|menos largo|mas breve|recorta)/, texto: "notas más cortas" },
  { patron: /\b(mas largo|mas larga|alarga|desarrolla|mas detalle|ampli)/, texto: "notas más largas o con más detalle" },
  { patron: /\b(nombra|menciona|nombrar|mencionar|cita a|incluir a|inclui a|agrega a)/, texto: "nombrar a personas o instituciones puntuales" },
  { patron: /\b(titulo)/, texto: "cambiar el título" },
  { patron: /\b(tono|formal|informal|cercano|tuteo|usted)/, texto: "ajustar el tono" },
  { patron: /\b(argentin|rosario|santa fe|local|latinoameric|region)/, texto: "darle un ángulo local o argentino" },
  { patron: /\b(dato|fecha|precio|corregi|error|equivoc|no es asi)/, texto: "corregir datos" },
];

const recortar = (texto: string, max: number) => (texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`);

function listaDeConteos(conteos: Map<string, number>): string {
  return [...conteos.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");
}

/**
 * El resumen de gustos a partir de las propuestas más recientes primero (se usan hasta
 * `PROPUESTAS_PARA_GUSTOS`). Las que fallaron o siguen pendientes no cuentan para categorías,
 * pero sus pedidos de corrección sí.
 */
export function resumenDeGustos(propuestas: PropuestaParaGustos[]): ResumenGustos {
  const recientes = propuestas.slice(0, PROPUESTAS_PARA_GUSTOS);
  const publicadas = new Map<string, number>();
  const descartadas = new Map<string, number>();
  let resueltas = 0;
  let nPublicadas = 0;
  let nDescartadas = 0;
  const pedidos: string[] = [];

  for (const p of recientes) {
    for (const c of p.correccionesPedidas ?? []) if (c.trim()) pedidos.push(c.trim().replace(/\s+/g, " "));
    const resultado = resultadoDe(p);
    if (!resultado) continue;
    resueltas++;
    // Las propuestas sin categoría (anteriores a que se guardara) cuentan en el total, no por categoría.
    const categoria = categoriaValida(p.categoria);
    if (resultado === "PUBLICADA") {
      nPublicadas++;
      if (categoria) publicadas.set(categoria, (publicadas.get(categoria) ?? 0) + 1);
    } else {
      nDescartadas++;
      if (categoria) descartadas.set(categoria, (descartadas.get(categoria) ?? 0) + 1);
    }
  }

  const lineas: string[] = [];
  if (resueltas > 0) lineas.push(`De las últimas ${resueltas} propuestas resueltas, publicó ${nPublicadas} y descartó o pidió otra en ${nDescartadas}.`);
  if (publicadas.size) lineas.push(`Publicó: ${listaDeConteos(publicadas)}.`);
  // Las que descarta más de lo que publica (y al menos 2 veces): señal de que no le interesan.
  const evita = new Map([...descartadas].filter(([c, n]) => n >= 2 && n > (publicadas.get(c) ?? 0)));
  if (evita.size) lineas.push(`Suele descartar: ${listaDeConteos(evita)}.`);
  else if (descartadas.size) lineas.push(`Descartó o pidió otra: ${listaDeConteos(descartadas)}.`);

  if (pedidos.length) {
    const tendencias = new Map<string, number>();
    for (const pedido of pedidos) {
      const t = sinTildes(pedido);
      for (const { patron, texto } of TENDENCIAS) if (patron.test(t)) tendencias.set(texto, (tendencias.get(texto) ?? 0) + 1);
    }
    if (tendencias.size) lineas.push(`Al corregir suele pedir: ${listaDeConteos(tendencias)}.`);
    lineas.push(`Últimos pedidos de corrección: ${pedidos.slice(0, 5).map((p) => `«${recortar(p, 120)}»`).join("; ")}.`);
  }
  return { resueltas, lineas };
}
