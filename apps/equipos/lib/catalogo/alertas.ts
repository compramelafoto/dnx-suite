import { prisma } from "@repo/db";
import { formatPesos, sellerFirstName, type CatalogFilters } from "@/lib/catalogo/buscar";
import { sendPortalEmail } from "@/lib/correo";
import { EquipoError } from "@/lib/inventario/equipos";
import type { GearItemKind } from "@/lib/inventario/tipos";
import { urlBaseDeLaApp } from "@/lib/sesion";

/**
 * Alertas de búsqueda: la persona guarda los filtros del catálogo y el cron diario le avisa por
 * correo cuando se publica un equipo que coincide. Cada publicación se avisa una sola vez por
 * alerta (`GearSearchAlertHit`) y cada persona recibe, como mucho, un correo por corrida.
 */

export const MAX_ALERTS = 10;
/** Tope de equipos por correo: el resto sale en la corrida siguiente. */
const MAX_POR_CORREO = 10;

export const MENSAJE_ALERTA_SIN_FILTROS = "Elegí al menos un filtro para crear la alerta.";
export const MENSAJE_MAXIMO_ALERTAS = `Llegaste al máximo de ${MAX_ALERTS} alertas activas.`;

export type AlertFilters = Omit<CatalogFilters, "page" | "minPrice">;

export type SearchAlert = {
  id: number;
  kind: GearItemKind | null;
  make: string | null;
  mount: string | null;
  maxPriceArs: number | null;
  province: string | null;
  createdAt: Date;
};

/** Los filtros que guarda una alerta (el precio mínimo y la página no cuentan). */
export function alertFiltersOf(f: CatalogFilters): AlertFilters {
  const a: AlertFilters = {};
  if (f.kind) a.kind = f.kind;
  if (f.make) a.make = f.make;
  if (f.mount) a.mount = f.mount;
  if (f.maxPrice !== undefined) a.maxPrice = f.maxPrice;
  if (f.province) a.province = f.province;
  return a;
}

export function hasAlertFilters(f: AlertFilters): boolean {
  return Boolean(f.kind || f.make || f.mount || f.province || f.maxPrice !== undefined);
}

export async function createAlert(userId: number, f: AlertFilters): Promise<{ alertId: number }> {
  if (!hasAlertFilters(f)) throw new EquipoError("DATO_INVALIDO", MENSAJE_ALERTA_SIN_FILTROS);
  const activas = await prisma.gearSearchAlert.count({ where: { userId, active: true } });
  if (activas >= MAX_ALERTS) throw new EquipoError("DATO_INVALIDO", MENSAJE_MAXIMO_ALERTAS);
  const alert = await prisma.gearSearchAlert.create({
    data: {
      userId,
      kind: f.kind ?? null,
      make: f.make?.trim() || null,
      mount: f.mount ?? null,
      maxPriceArs: f.maxPrice ?? null,
      province: f.province ?? null,
    },
    select: { id: true },
  });
  return { alertId: alert.id };
}

/** Borra una alerta propia; la de otra persona (o una que no existe) da «no encontrado». */
export async function deleteAlert(userId: number, alertId: number): Promise<void> {
  const valido = Number.isInteger(alertId) && alertId > 0;
  const r = valido
    ? await prisma.gearSearchAlert.deleteMany({ where: { id: alertId, userId } })
    : { count: 0 };
  if (r.count === 0) throw new EquipoError("NO_ENCONTRADO", "No encontramos esa alerta.");
}

export async function listAlerts(userId: number): Promise<SearchAlert[]> {
  return (await prisma.gearSearchAlert.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      make: true,
      mount: true,
      maxPriceArs: true,
      province: true,
      createdAt: true,
    },
  })) as SearchAlert[];
}

const KIND_PLURAL: Record<GearItemKind, string> = {
  BODY: "Cuerpos de cámara",
  LENS: "Lentes",
  FLASH: "Flashes",
  TRIPOD: "Trípodes",
  BAG: "Bolsos o mochilas",
  FILTER: "Filtros",
  DRONE: "Drones",
  OTHER: "Otros equipos",
};

const MILES = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** «Lentes Sony, montura Sony E, hasta $900.000, en Córdoba». */
export function describeAlert(
  a: Pick<SearchAlert, "kind" | "make" | "mount" | "maxPriceArs" | "province">,
): string {
  const cabeza = [a.kind ? KIND_PLURAL[a.kind] : "Equipos", a.make].filter(Boolean).join(" ");
  const partes = [cabeza];
  if (a.mount) partes.push(`montura ${a.mount}`);
  if (a.maxPriceArs != null) partes.push(`hasta $${MILES.format(a.maxPriceArs)}`);
  if (a.province) partes.push(`en ${a.province}`);
  return partes.join(", ");
}

/** Sólo vendedores con la identidad aprobada HOY (el mismo criterio del catálogo). */
const VENDEDOR_VERIFICADO = { identityVerification: { is: { status: "APPROVED" } } } as const;

type AlertRow = SearchAlert & { userId: number; user: { email: string; name: string | null } };
type Match = { id: number; make: string; model: string; priceArs: number; city: string; province: string };

/**
 * Corre todas las alertas activas: busca lo publicado desde que se creó cada alerta que cumple
 * sus filtros y todavía no se avisó, sin las publicaciones del dueño de la alerta ni las de
 * cuentas bloqueadas (las alertas de una cuenta bloqueada tampoco corren). Registra el aviso
 * ANTES de mandar el correo: si el correo falla no se reintenta (mejor uno de menos que repetir).
 */
export async function runSearchAlerts(now: Date = new Date()): Promise<{ emails: number }> {
  const bloqueados = (
    await prisma.portalAccountBlock.findMany({ where: { liftedAt: null }, select: { userId: true } })
  ).map((b) => b.userId);

  const alerts = (await prisma.gearSearchAlert.findMany({
    where: { active: true, userId: { notIn: bloqueados } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      userId: true,
      kind: true,
      make: true,
      mount: true,
      maxPriceArs: true,
      province: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  })) as AlertRow[];

  // Por persona: los equipos a avisar (sin repetir) y a qué alertas corresponde cada uno.
  type Grupo = { user: AlertRow["user"]; equipos: Map<number, Match>; pares: Array<[number, number]> };
  const porUsuario = new Map<number, Grupo>();

  for (const a of alerts) {
    const grupo: Grupo = porUsuario.get(a.userId) ?? { user: a.user, equipos: new Map(), pares: [] };
    porUsuario.set(a.userId, grupo);
    const lugar = MAX_POR_CORREO - grupo.equipos.size;
    const where: Record<string, unknown> = {
      status: "PUBLISHED",
      seller: VENDEDOR_VERIFICADO,
      sellerId: { notIn: [a.userId, ...bloqueados] },
      publishedAt: { gte: a.createdAt, lte: now },
      alertHits: { none: { alertId: a.id } },
    };
    if (a.kind) where.kind = a.kind;
    if (a.make) where.make = { contains: a.make, mode: "insensitive" };
    if (a.mount) where.mount = a.mount;
    if (a.province) where.province = a.province;
    if (a.maxPriceArs != null) where.priceArs = { lte: a.maxPriceArs };

    const found = (await prisma.gearListing.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: MAX_POR_CORREO,
      select: { id: true, make: true, model: true, priceArs: true, city: true, province: true },
    })) as Match[];

    let nuevos = 0;
    for (const l of found) {
      if (grupo.equipos.has(l.id)) {
        // Ya va en el correo por otra alerta: se marca también para ésta.
        grupo.pares.push([a.id, l.id]);
      } else if (nuevos < lugar) {
        grupo.equipos.set(l.id, l);
        grupo.pares.push([a.id, l.id]);
        nuevos += 1;
      }
    }
  }

  const base = urlBaseDeLaApp();
  let emails = 0;
  for (const grupo of porUsuario.values()) {
    if (grupo.equipos.size === 0) continue;
    // Una corrida en paralelo pudo avisar alguno: sólo van los que esta corrida registró.
    const registrados = new Set<number>();
    for (const [alertId, listingId] of grupo.pares) {
      try {
        await prisma.gearSearchAlertHit.create({ data: { alertId, listingId }, select: { id: true } });
        registrados.add(listingId);
      } catch (err) {
        if ((err as { code?: string })?.code !== "P2002") throw err;
      }
    }
    const equipos = [...grupo.equipos.values()].filter((l) => registrados.has(l.id));
    if (equipos.length === 0) continue;

    const data: Record<string, string> = {
      nombre: grupo.user.name ? sellerFirstName(grupo.user.name) : "",
      cantidad: String(equipos.length),
      url: `${base}/alertas`,
    };
    equipos.forEach((l, i) => {
      const n = i + 1;
      data[`item${n}_titulo`] = `${l.make} ${l.model}`;
      data[`item${n}_precio`] = formatPesos(l.priceArs);
      data[`item${n}_zona`] = `${l.city}, ${l.province}`;
      data[`item${n}_url`] = `${base}/equipos/${l.id}`;
    });
    const r = await sendPortalEmail(grupo.user.email, "alerta_busqueda", data);
    if (r.success) emails += 1;
  }
  return { emails };
}
