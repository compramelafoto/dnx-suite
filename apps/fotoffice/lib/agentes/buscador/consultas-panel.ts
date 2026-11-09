/**
 * Lecturas del panel «Contactos DNX» (/admin/contactos-dnx): la lista con filtros, la ficha y el
 * CSV. Sólo lee; las escrituras van por `contactos.ts`. Los contactos fusionados en otro no se listan.
 */
import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { diaArgentino } from "@/lib/agentes/periodista/horario";
import { ESTADOS_CONTACTO, NICHOS, REGIONES, TIPOS_CONTACTO } from "./tipos";
import {
  etiquetaEstado, etiquetaNicho, etiquetaRegion, etiquetaTipo, etiquetaVinculo, VINCULOS_FILTRO, type VinculoFiltro,
} from "./etiquetas";

export const POR_PAGINA = 50;

// `@repo/db` no reexporta los tipos de cada modelo: se toman de Prisma.
export type DnxContacto = Prisma.DnxContactoGetPayload<Record<string, never>>;
export type DnxContactoDato = Prisma.DnxContactoDatoGetPayload<Record<string, never>>;
export type DnxContactoEvento = Prisma.DnxContactoEventoGetPayload<Record<string, never>>;

export type FiltrosContactos = {
  tipo?: string;
  nicho?: string;
  region?: string;
  provincia?: string;
  estado?: string;
  vinculo?: VinculoFiltro;
  conEmail?: boolean;
  texto?: string;
  pagina?: number;
};

const SELECT_FILA = {
  id: true, nombre: true, tipo: true, nichos: true, ciudad: true, provincia: true, region: true, web: true,
  instagram: true, facebook: true, email: true, telefono: true, whatsapp: true, estado: true, vinculo: true,
  compradorClf: true, creadoEn: true,
} as const;

export type FilaContacto = Prisma.DnxContactoGetPayload<{ select: typeof SELECT_FILA }>;

const incluye = (lista: readonly string[], v: string | undefined) => (v && lista.includes(v) ? v : undefined);

/**
 * Los filtros a partir del querystring (de la página o de la ruta del CSV). Descarta lo que no
 * es un valor conocido, así una URL vieja o tocada a mano no rompe nada.
 */
export function filtrosDesdeQuery(leer: (clave: string) => string | undefined): FiltrosContactos {
  const f: FiltrosContactos = {};
  const tipo = incluye(TIPOS_CONTACTO, leer("tipo"));
  if (tipo) f.tipo = tipo;
  const nicho = incluye(NICHOS, leer("nicho"));
  if (nicho) f.nicho = nicho;
  const region = incluye(REGIONES, leer("region"));
  if (region) f.region = region;
  const provincia = leer("provincia")?.trim();
  if (provincia) f.provincia = provincia;
  const estado = incluye(ESTADOS_CONTACTO, leer("estado"));
  if (estado) f.estado = estado;
  const vinculo = incluye(VINCULOS_FILTRO, leer("vinculo"));
  if (vinculo) f.vinculo = vinculo as VinculoFiltro;
  if (leer("conEmail") === "1") f.conEmail = true;
  const texto = leer("texto")?.trim();
  if (texto) f.texto = texto;
  const pagina = Number(leer("pagina"));
  if (Number.isInteger(pagina) && pagina > 1) f.pagina = pagina;
  return f;
}

function donde(f: FiltrosContactos) {
  const texto = f.texto?.trim();
  return {
    fusionadoEnId: null,
    ...(f.tipo ? { tipo: f.tipo } : {}),
    ...(f.nicho ? { nichos: { has: f.nicho } } : {}),
    ...(f.region ? { region: f.region } : {}),
    ...(f.provincia ? { provincia: { equals: f.provincia, mode: "insensitive" as const } } : {}),
    ...(f.estado ? { estado: f.estado } : {}),
    ...(f.vinculo ? { vinculo: f.vinculo === "NINGUNO" ? null : f.vinculo } : {}),
    ...(f.conEmail ? { email: { not: null } } : {}),
    ...(texto
      ? {
          OR: (["nombre", "ciudad", "email", "instagram"] as const).map((col) => ({
            [col]: { contains: texto, mode: "insensitive" as const },
          })),
        }
      : {}),
  };
}

/** Una página (50) de contactos, los más nuevos primero, y el total con esos filtros. */
export async function listarContactos(f: FiltrosContactos): Promise<{ filas: FilaContacto[]; total: number }> {
  const where = donde(f);
  const pagina = f.pagina && f.pagina > 1 ? f.pagina : 1;
  const [filas, total] = await Promise.all([
    prisma.dnxContacto.findMany({
      where,
      select: SELECT_FILA,
      orderBy: { creadoEn: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.dnxContacto.count({ where }),
  ]);
  return { filas, total };
}

/** La ficha: el contacto, cada dato visto con su fuente y la línea de tiempo (lo último primero). */
export async function fichaContacto(
  id: string,
): Promise<{ contacto: DnxContacto; datos: DnxContactoDato[]; eventos: DnxContactoEvento[] } | null> {
  const contacto = await prisma.dnxContacto.findUnique({ where: { id } });
  if (!contacto) return null;
  const [datos, eventos] = await Promise.all([
    prisma.dnxContactoDato.findMany({ where: { contactoId: id }, orderBy: { vistoEn: "desc" } }),
    prisma.dnxContactoEvento.findMany({ where: { contactoId: id }, orderBy: { creadoEn: "desc" } }),
  ]);
  return { contacto, datos, eventos };
}

/** Candidatos para «Fusionar con…»: por id exacto o por texto, sin el propio contacto. */
export async function candidatosParaFusionar(propioId: string, busqueda: string): Promise<FilaContacto[]> {
  const q = busqueda.trim();
  if (q === "") return [];
  const porId = await prisma.dnxContacto.findFirst({ where: { id: q, fusionadoEnId: null }, select: SELECT_FILA });
  if (porId) return porId.id === propioId ? [] : [porId];
  const { filas } = await listarContactos({ texto: q });
  return filas.filter((c) => c.id !== propioId).slice(0, 10);
}

// ---------------------------------------------------------------------------------------------
// CSV

/** Entre comillas si trae `;`, comillas o saltos de línea; las comillas de adentro se duplican. */
function celda(v: string | null | undefined): string {
  const s = v ?? "";
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNAS_CSV = [
  "Nombre", "Tipo", "Nichos", "Ciudad", "Provincia", "Región", "Web", "Instagram", "Facebook", "Correo",
  "Teléfono", "WhatsApp", "Estado", "Vínculo", "Compró en CLF", "Alta",
];

/**
 * Todos los contactos con esos filtros (sin paginar), con las columnas de la lista y los datos
 * completos. Separador `;` y BOM UTF-8, para que Excel en castellano lo abra bien.
 */
export async function csvContactos(f: FiltrosContactos): Promise<string> {
  const filas: FilaContacto[] = await prisma.dnxContacto.findMany({
    where: donde(f),
    select: SELECT_FILA,
    orderBy: { creadoEn: "desc" },
  });
  const lineas = [COLUMNAS_CSV.map(celda).join(";")];
  for (const c of filas) {
    lineas.push(
      [
        c.nombre, etiquetaTipo(c.tipo), (c.nichos ?? []).map(etiquetaNicho).join(", "), c.ciudad, c.provincia,
        etiquetaRegion(c.region), c.web, c.instagram, c.facebook, c.email, c.telefono, c.whatsapp,
        etiquetaEstado(c.estado), etiquetaVinculo(c.vinculo), c.compradorClf ? "Sí" : "No", diaArgentino(c.creadoEn),
      ]
        .map(celda)
        .join(";"),
    );
  }
  return `﻿${lineas.join("\r\n")}\r\n`;
}
