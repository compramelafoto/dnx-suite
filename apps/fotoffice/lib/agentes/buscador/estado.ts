import "server-only";
import { prisma } from "@repo/db";
import { etiquetaRegion } from "./etiquetas";
import { gastoDelMes, leerAjustes, type AjustesBuscador } from "./gasto";
import { REGIONES, type Region } from "./tipos";

/**
 * Lo que muestra la cabecera del panel de Contactos DNX sobre el agente Buscador: el avance por región,
 * la región en curso, los ajustes (topes y pausa), el gasto del mes y si hay clave de Google.
 * Nunca devuelve el valor de una clave: sólo si existe.
 */

export type EstadoRegion = "EN_ESPERA" | "EN_CURSO" | "COMPLETA" | "PAUSADA";

export type AvanceRegion = {
  region: Region;
  nombre: string;
  orden: number;
  estado: EstadoRegion;
  /** Tareas terminadas: hechas o salteadas. */
  hechas: number;
  total: number;
  fallidas: number;
};

export type EstadoBuscador = {
  regiones: AvanceRegion[];
  actual: Region | null;
  ajustes: AjustesBuscador;
  gasto: { googleUsd: number; claudeUsd: number };
  tieneClaveGoogle: boolean;
  tieneClaveClaude: boolean;
};

const ESTADOS_HECHOS = new Set(["HECHA", "SALTEADA"]);

const tiene = (v: string | undefined) => Boolean(v?.trim());

function esRegion(v: string): v is Region {
  return (REGIONES as readonly string[]).includes(v);
}

/** Las 6 regiones en su orden; si falta alguna fila (no debería: el SQL las crea), se completa en espera. */
async function filasRegiones(): Promise<Array<{ region: Region; orden: number; estado: EstadoRegion }>> {
  const filas = await prisma.dnxBuscadorRegion.findMany({ select: { region: true, orden: true, estado: true } });
  const porRegion = new Map(filas.map((f) => [f.region, f]));
  return REGIONES.map((region, i) => {
    const f = porRegion.get(region);
    return { region, orden: f?.orden ?? REGIONES.length + i + 1, estado: (f?.estado ?? "EN_ESPERA") as EstadoRegion };
  }).sort((a, b) => a.orden - b.orden || REGIONES.indexOf(a.region) - REGIONES.indexOf(b.region));
}

export async function estadoBuscador(ahora: Date): Promise<EstadoBuscador> {
  const [regiones, grupos, ajustes, gasto] = await Promise.all([
    filasRegiones(),
    prisma.dnxBuscadorTarea.groupBy({ by: ["region", "estado"], _count: { _all: true } }),
    leerAjustes(),
    gastoDelMes(ahora),
  ]);
  const cuenta = new Map<string, { hechas: number; total: number; fallidas: number }>();
  for (const g of grupos) {
    const c = cuenta.get(g.region) ?? { hechas: 0, total: 0, fallidas: 0 };
    const n = g._count._all;
    c.total += n;
    if (ESTADOS_HECHOS.has(g.estado)) c.hechas += n;
    if (g.estado === "FALLO") c.fallidas += n;
    cuenta.set(g.region, c);
  }
  return {
    regiones: regiones.map((r) => ({
      ...r,
      nombre: etiquetaRegion(r.region),
      ...(cuenta.get(r.region) ?? { hechas: 0, total: 0, fallidas: 0 }),
    })),
    actual: regiones.find((r) => r.estado === "EN_CURSO")?.region ?? null,
    ajustes,
    gasto: { googleUsd: gasto.googleUsd, claudeUsd: gasto.claudeUsd },
    tieneClaveGoogle: tiene(process.env.GOOGLE_PLACES_API_KEY),
    tieneClaveClaude: tiene(process.env.ANTHROPIC_API_KEY),
  };
}

/**
 * Cambia el orden en que el Buscador recorre las regiones. Las `COMPLETA` no se mueven: conservan su
 * número y las demás se reparten los números restantes en el orden pedido. Las que no vienen en el
 * pedido quedan al final, en su orden de antes. Lanza si hay regiones inexistentes o repetidas.
 */
export async function reordenarRegiones(orden: Region[]): Promise<void> {
  if (orden.some((r) => !esRegion(r))) throw new Error("Buscador: región inexistente en el orden pedido.");
  if (new Set(orden).size !== orden.length) throw new Error("Buscador: hay regiones repetidas en el orden pedido.");

  const actuales = await filasRegiones();
  const movibles = actuales.filter((r) => r.estado !== "COMPLETA");
  const lugares = movibles.map((r) => r.orden); // ya ordenados de menor a mayor
  const pedidas = orden.filter((r) => movibles.some((m) => m.region === r));
  const resto = movibles.map((m) => m.region).filter((r) => !pedidas.includes(r));
  const nuevo = [...pedidas, ...resto];

  for (const [i, region] of nuevo.entries()) {
    const previa = movibles.find((m) => m.region === region);
    if (previa?.orden === lugares[i]) continue;
    await prisma.dnxBuscadorRegion.upsert({
      where: { region },
      create: { region, orden: lugares[i], estado: "EN_ESPERA" },
      update: { orden: lugares[i] },
    });
  }
}
