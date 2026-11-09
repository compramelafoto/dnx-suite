import "server-only";
import { prisma } from "@repo/db";
import { CIUDADES } from "./ciudades";
import {
  NICHOS, NICHOS_PRIORITARIOS, REGIONES, TIPOS_CONTACTO,
  type Nicho, type Region, type TipoContacto,
} from "./tipos";

/**
 * Frases de búsqueda (plantillas con `{ciudad}`) por tipo de contacto. Cada tipo puede tener varias,
 * pero hoy se usa sólo la PRIMERA por ciudad (para cuidar el gasto en Google Places); las demás quedan
 * para sumar variedad más adelante. Los fotógrafos se buscan por nicho (`FRASES_NICHO`).
 */
export const FRASES: Record<TipoContacto, string[]> = {
  FOTOGRAFO: ["fotógrafo en {ciudad}", "estudio fotográfico en {ciudad}"],
  ESCUELA: ["colegio en {ciudad}", "escuela primaria en {ciudad}", "jardín de infantes en {ciudad}"],
  CLUB: ["club deportivo en {ciudad}", "club de fútbol en {ciudad}"],
  ORGANIZADOR_EVENTOS: ["organizador de eventos en {ciudad}", "salón de fiestas en {ciudad}"],
  ASOCIACION_FOTOGRAFOS: ["asociación de fotógrafos en {ciudad}", "círculo de fotógrafos en {ciudad}"],
  ORGANIZADOR_MUESTRAS: ["muestra de fotografía en {ciudad}", "galería de arte fotografía en {ciudad}"],
  EMPRESA_TURISMO: ["agencia de turismo en {ciudad}", "empresa de excursiones en {ciudad}"],
  NEGOCIO_FOTOGRAFIA: ["casa de fotografía en {ciudad}", "venta de cámaras fotográficas en {ciudad}"],
  OTRO: [],
};

export const FRASES_NICHO: Record<Nicho, string[]> = {
  ESCOLAR: ["fotógrafo escolar en {ciudad}", "fotografía escolar en {ciudad}"],
  DEPORTIVA: ["fotógrafo deportivo en {ciudad}"],
  TURISTICA: ["fotógrafo turístico en {ciudad}"],
  SOCIAL: ["fotógrafo de casamientos y 15 años en {ciudad}"],
  EVENTOS: ["fotógrafo de eventos en {ciudad}"],
  FOTO_CARNET: ["fotos carnet en {ciudad}"],
  CORPORATIVA: ["fotógrafo corporativo en {ciudad}"],
  MASCOTAS_NEWBORN_FAMILIA: ["fotógrafo newborn y familia en {ciudad}"],
} as Record<Nicho, string[]>;

/** Los tipos que, además de Places por ciudad, se buscan con web por provincia. */
export const TIPOS_WEB: TipoContacto[] = [
  "FOTOGRAFO", "ASOCIACION_FOTOGRAFOS", "ORGANIZADOR_MUESTRAS", "ORGANIZADOR_EVENTOS", "CLUB",
];

const TEXTO_NICHO: Record<string, string> = {
  ESCOLAR: "escolares", DEPORTIVA: "deportivos", TURISTICA: "turísticos", SOCIAL: "de casamientos y 15 años",
  EVENTOS: "de eventos", FOTO_CARNET: "de fotos carnet", CORPORATIVA: "corporativos",
  MASCOTAS_NEWBORN_FAMILIA: "de newborn, mascotas y familia",
};
const TEXTO_TIPO_WEB: Partial<Record<TipoContacto, string>> = {
  ASOCIACION_FOTOGRAFOS: "asociaciones de fotógrafos",
  ORGANIZADOR_MUESTRAS: "organizadores de muestras fotográficas",
  ORGANIZADOR_EVENTOS: "organizadores de eventos",
  CLUB: "clubes deportivos",
};

/** Prioridad 1: los tres nichos prioritarios y sus contrapartes (escuelas, turismo, clubes). */
const TIPOS_PRIORITARIOS: TipoContacto[] = ["ESCUELA", "EMPRESA_TURISMO", "CLUB"];

function prioridadDe(tipo: TipoContacto, nicho: Nicho | null): number {
  if (nicho) return (NICHOS_PRIORITARIOS as readonly string[]).includes(nicho) ? 1 : 2;
  return TIPOS_PRIORITARIOS.includes(tipo) ? 1 : 2;
}

type TareaNueva = {
  region: Region; provincia: string; ciudad: string | null; tipo: TipoContacto; nicho: Nicho | null;
  fuente: "GOOGLE_PLACES" | "WEB_SEARCH"; consulta: string; paginas: number; prioridad: number;
};

/** "Rosario, Santa Fe"; si ciudad y provincia se llaman igual (Córdoba, CABA) no se repite. */
function lugar(ciudad: string, provincia: string): string {
  return ciudad === provincia ? ciudad : `${ciudad}, ${provincia}`;
}

/** Las combinaciones (tipo, nicho) que se buscan: un fotógrafo por nicho; el resto por tipo (sin `OTRO`). */
function combinaciones(): Array<{ tipo: TipoContacto; nicho: Nicho | null; frase: string }> {
  const out: Array<{ tipo: TipoContacto; nicho: Nicho | null; frase: string }> = [];
  for (const tipo of TIPOS_CONTACTO) {
    if (tipo === "FOTOGRAFO") {
      for (const nicho of NICHOS) {
        const frase = FRASES_NICHO[nicho]?.[0];
        if (frase) out.push({ tipo, nicho, frase });
      }
    } else {
      const frase = FRASES[tipo][0];
      if (frase) out.push({ tipo, nicho: null, frase });
    }
  }
  return out;
}

/**
 * Crea la cola de trabajo de una región: Places por ciudad × (tipo | nicho) con la primera frase, y web
 * por provincia × tipo de `TIPOS_WEB` (× nicho si es fotógrafo). Repetirlo no duplica: el único de la base
 * (con NULLS NOT DISTINCT) hace que `skipDuplicates` saltee lo que ya existe.
 */
export async function generarTareas(region: Region): Promise<{ creadas: number }> {
  const filas: TareaNueva[] = [];
  const combos = combinaciones();
  for (const { provincia, ciudades } of CIUDADES[region]) {
    for (const ciudad of ciudades) {
      for (const { tipo, nicho, frase } of combos) {
        filas.push({
          region, provincia, ciudad: ciudad.nombre, tipo, nicho, fuente: "GOOGLE_PLACES",
          consulta: frase.replace("{ciudad}", lugar(ciudad.nombre, provincia)),
          paginas: ciudad.grande ? 3 : 1, prioridad: prioridadDe(tipo, nicho),
        });
      }
    }
    for (const { tipo, nicho } of combos.filter((x) => TIPOS_WEB.includes(x.tipo))) {
      const que = tipo === "FOTOGRAFO" ? `fotógrafos ${TEXTO_NICHO[nicho as string] ?? String(nicho)}` : TEXTO_TIPO_WEB[tipo];
      filas.push({
        region, provincia, ciudad: null, tipo, nicho, fuente: "WEB_SEARCH",
        consulta: `${que} en la provincia de ${provincia}`, paginas: 1, prioridad: prioridadDe(tipo, nicho),
      });
    }
  }
  const { count } = await prisma.dnxBuscadorTarea.createMany({ data: filas, skipDuplicates: true });
  return { creadas: count };
}

/**
 * Pone la región en curso (las demás en curso vuelven a espera) y genera sus tareas. Una región
 * `COMPLETA` no se reactiva salvo con `reabrir`: entonces se borra su cierre y las tareas en `FALLO`
 * vuelven a `PENDIENTE` (con los intentos en cero). Devuelve si la región quedó en curso.
 * Elegir cuál activar (la primera `EN_ESPERA`, nunca una `PAUSADA`) es cosa de quien llama.
 */
export async function activarRegion(region: Region, ahora: Date, opciones: { reabrir?: boolean } = {}): Promise<boolean> {
  const actual = await prisma.dnxBuscadorRegion.findFirst({ where: { region } });
  const reabre = actual?.estado === "COMPLETA";
  if (reabre && !opciones.reabrir) return false;
  await prisma.dnxBuscadorRegion.updateMany({
    where: { estado: "EN_CURSO", NOT: { region } },
    data: { estado: "EN_ESPERA" },
  });
  await prisma.dnxBuscadorRegion.upsert({
    where: { region },
    create: { region, orden: REGIONES.indexOf(region) + 1, estado: "EN_CURSO", iniciadaEn: ahora },
    update: {
      estado: "EN_CURSO",
      ...(actual?.estado === "EN_CURSO" ? {} : { iniciadaEn: ahora }),
      ...(reabre ? { completadaEn: null, resumenEnviadoEn: null } : {}),
    },
  });
  if (reabre) {
    await prisma.dnxBuscadorTarea.updateMany({ where: { region, estado: "FALLO" }, data: { estado: "PENDIENTE", intentos: 0 } });
  }
  await generarTareas(region);
  return true;
}

/** La región que el Buscador está recorriendo ahora, si hay. */
export async function regionActual(): Promise<Region | null> {
  const r = await prisma.dnxBuscadorRegion.findFirst({ where: { estado: "EN_CURSO" } });
  return (r?.region as Region | undefined) ?? null;
}
