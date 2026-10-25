import "server-only";
import { partnersReader, type PartnersDb } from "./clients";
import { logoDe } from "./repository";
import {
  DIRECTORY_PAGE_SIZE,
  directoryWhere,
  esTipoDeMarca,
  etiquetaTipo,
  normalizarFiltros,
  SIN_FILTROS,
  type DirectoryFilters,
} from "./directory-rules";

type PartnerWhere = NonNullable<NonNullable<Parameters<PartnersDb["dnxPartner"]["count"]>[0]>["where"]>;

function whereDe(workspaceId: string, filtros: DirectoryFilters): PartnerWhere {
  return directoryWhere(workspaceId, filtros) as PartnerWhere;
}

/**
 * El directorio público de la red DNX: las marcas que cualquier institución puede ver y sumar.
 *
 * Qué marcas entran y qué filtros valen está en `directory-rules.ts` (sin base, se prueba
 * solo). Acá se lee y se arma la tarjeta. La regla de privacidad es que el `select` pide
 * únicamente la ficha pública: nunca email, teléfono, dirección, CUIT, razón social, notas,
 * contactos, participaciones ajenas ni montos.
 */

export type DirectoryCard = {
  id: string;
  name: string;
  logoSrc: string | null;
  tipo: string;
  tipoLabel: string;
  city: string | null;
  province: string | null;
  description: string | null;
  websiteUrl: string | null;
  instagram: string | null;
  /** Ya es sponsor de esta institución. */
  linked: boolean;
};

export type DirectoryOption = { valor: string; etiqueta: string };

export type DirectoryPage = {
  items: DirectoryCard[];
  total: number;
  page: number;
  pageCount: number;
  filtros: DirectoryFilters;
  opciones: { tipos: DirectoryOption[]; provincias: DirectoryOption[]; ciudades: DirectoryOption[] };
};

/** La participación vigente de FOTOFFICE en esta institución: la misma regla que el repositorio. */
function vinculoCon(workspaceId: string) {
  return {
    application: "FOTO_OFFICE" as const,
    contextType: "ORGANIZATION" as const,
    contextId: workspaceId,
    archivedAt: null,
    status: { notIn: ["ARCHIVED" as const, "CANCELLED" as const] },
  };
}

/** Sólo campos de la ficha pública. Si alguien agrega un campo acá, que mire el test. */
export function selectFichaPublica(workspaceId: string) {
  return {
    id: true,
    name: true,
    description: true,
    type: true,
    city: true,
    provinceOrState: true,
    websiteUrl: true,
    instagram: true,
    logoUrl: true,
    brandAssets: {
      where: { archivedAt: null, status: "ACTIVE" as const, approvalStatus: "APPROVED" as const },
      orderBy: { createdAt: "desc" as const },
    },
    participations: { where: vinculoCon(workspaceId), select: { id: true }, take: 1 },
  } as const;
}

function recortar(texto: string | null, max: number): string | null {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function opcionesDe(valores: (string | null)[]): DirectoryOption[] {
  const unicos = new Map<string, string>();
  for (const v of valores) {
    const t = (v ?? "").trim();
    if (t && !unicos.has(t.toLocaleLowerCase("es"))) unicos.set(t.toLocaleLowerCase("es"), t);
  }
  return [...unicos.values()]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((v) => ({ valor: v, etiqueta: v }));
}

export async function searchDirectory(
  workspaceId: string,
  crudos: Record<string, string | string[] | undefined>,
  db?: PartnersDb,
): Promise<DirectoryPage> {
  const base = db ?? (await partnersReader());
  const filtros = normalizarFiltros(crudos);
  const where = whereDe(workspaceId, filtros);
  const todos = whereDe(workspaceId, SIN_FILTROS);

  const [total, facetas] = await Promise.all([
    base.dnxPartner.count({ where }),
    base.dnxPartner.findMany({ where: todos, select: { type: true, city: true, provinceOrState: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));
  const page = Math.min(filtros.page, pageCount);

  const filas = await base.dnxPartner.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * DIRECTORY_PAGE_SIZE,
    take: DIRECTORY_PAGE_SIZE,
    select: selectFichaPublica(workspaceId),
  });

  const items = filas.map((p) => ({
    id: p.id,
    name: p.name,
    logoSrc: logoDe(p),
    tipo: p.type,
    tipoLabel: etiquetaTipo(p.type),
    city: p.city?.trim() || null,
    province: p.provinceOrState?.trim() || null,
    description: recortar(p.description, 160),
    websiteUrl: p.websiteUrl,
    instagram: p.instagram,
    linked: p.participations.length > 0,
  }));

  const tipos = [...new Set(facetas.map((f) => f.type))]
    .filter(esTipoDeMarca)
    .map((t) => ({ valor: t, etiqueta: etiquetaTipo(t) }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  const facetasCiudad = filtros.provincia
    ? facetas.filter((f) => (f.provinceOrState ?? "").trim().toLocaleLowerCase("es") === filtros.provincia.toLocaleLowerCase("es"))
    : facetas;

  return {
    items,
    total,
    page,
    pageCount,
    filtros: { ...filtros, page },
    opciones: {
      tipos,
      provincias: opcionesDe(facetas.map((f) => f.provinceOrState)),
      ciudades: opcionesDe(facetasCiudad.map((f) => f.city)),
    },
  };
}

/** Si la marca está en el directorio público. Lo exige la acción antes de vincular. */
export async function estaEnDirectorio(workspaceId: string, partnerId: string, db?: PartnersDb): Promise<boolean> {
  const base = db ?? (await partnersReader());
  const where = whereDe(workspaceId, SIN_FILTROS);
  const fila = await base.dnxPartner.findFirst({ where: { AND: [where, { id: partnerId }] }, select: { id: true } });
  return Boolean(fila);
}
