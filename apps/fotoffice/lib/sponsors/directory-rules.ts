/**
 * Las reglas del directorio público de la red DNX, sin base de datos (se prueban solas).
 *
 * Qué marca aparece: no hay en DNX Partners un interruptor "mostrarme en el directorio", así
 * que el criterio es conservador y no necesita migración — una marca entra sólo si YA se
 * muestra en algún sitio público de DNX:
 *   - la ficha no está archivada ni marcada INACTIVE/ARCHIVED, y
 *   - tiene al menos una participación vigente (CONFIRMED o ACTIVE, sin archivar) con
 *     `publicVisibility = PUBLIC`.
 * Así quedan afuera los prospectos de venta de DNX y las marcas que una plataforma tiene
 * ocultas: esos nombres no son de nadie más.
 */

export const DIRECTORY_PAGE_SIZE = 24;

const TIPOS = {
  BRAND: "Marca",
  COMPANY: "Empresa",
  BUSINESS: "Comercio",
  INSTITUTION: "Institución",
  ORGANIZATION: "Organización",
  PERSON: "Persona",
  GOVERNMENT: "Organismo público",
  OTHER: "Otro",
} as const;

export type TipoDeMarca = keyof typeof TIPOS;

export function esTipoDeMarca(valor: string): valor is TipoDeMarca {
  return Object.prototype.hasOwnProperty.call(TIPOS, valor);
}

export function etiquetaTipo(valor: string): string {
  return esTipoDeMarca(valor) ? TIPOS[valor] : "Otro";
}

export type DirectoryFilters = {
  q: string;
  tipo: TipoDeMarca | "";
  provincia: string;
  ciudad: string;
  ocultarVinculados: boolean;
  page: number;
};

export const SIN_FILTROS: DirectoryFilters = {
  q: "",
  tipo: "",
  provincia: "",
  ciudad: "",
  ocultarVinculados: false,
  page: 1,
};

function uno(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor ?? "").trim();
}

/** Lo que llega por la dirección, saneado: nada de lo que escriba el usuario llega crudo a la base. */
export function normalizarFiltros(crudos: Record<string, string | string[] | undefined>): DirectoryFilters {
  const tipo = uno(crudos.tipo).toUpperCase();
  const pagina = Number.parseInt(uno(crudos.pagina), 10);
  return {
    q: uno(crudos.q).slice(0, 80),
    tipo: esTipoDeMarca(tipo) ? tipo : "",
    provincia: uno(crudos.provincia).slice(0, 80),
    ciudad: uno(crudos.ciudad).slice(0, 80),
    ocultarVinculados: uno(crudos.ocultar) === "1",
    page: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 1000) : 1,
  };
}

/** Las participaciones que hacen pública a una marca. */
export const PARTICIPACION_PUBLICA = {
  archivedAt: null,
  publicVisibility: "PUBLIC" as const,
  status: { in: ["CONFIRMED" as const, "ACTIVE" as const] },
};

/** El `where` de Prisma sobre `DnxPartner`. */
export function directoryWhere(workspaceId: string, f: DirectoryFilters) {
  const and: Record<string, unknown>[] = [
    { archivedAt: null },
    { status: { notIn: ["INACTIVE", "ARCHIVED"] } },
    { participations: { some: PARTICIPACION_PUBLICA } },
  ];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
        { city: { contains: f.q, mode: "insensitive" } },
      ],
    });
  }
  if (f.tipo) and.push({ type: f.tipo });
  if (f.provincia) and.push({ provinceOrState: { equals: f.provincia, mode: "insensitive" } });
  if (f.ciudad) and.push({ city: { equals: f.ciudad, mode: "insensitive" } });
  if (f.ocultarVinculados) {
    and.push({
      participations: {
        none: {
          application: "FOTO_OFFICE",
          contextType: "ORGANIZATION",
          contextId: workspaceId,
          archivedAt: null,
          status: { notIn: ["ARCHIVED", "CANCELLED"] },
        },
      },
    });
  }
  return { AND: and };
}

/** La dirección de una página del directorio con los filtros dados (los vacíos no viajan). */
export function directoryHref(f: DirectoryFilters, cambios: Partial<DirectoryFilters> = {}): string {
  const g = { ...f, ...cambios };
  const p = new URLSearchParams();
  if (g.q) p.set("q", g.q);
  if (g.tipo) p.set("tipo", g.tipo);
  if (g.provincia) p.set("provincia", g.provincia);
  if (g.ciudad) p.set("ciudad", g.ciudad);
  if (g.ocultarVinculados) p.set("ocultar", "1");
  if (g.page > 1) p.set("pagina", String(g.page));
  const qs = p.toString();
  return qs ? `/sponsors/red?${qs}` : "/sponsors/red";
}
