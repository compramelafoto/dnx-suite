import { prisma } from "@repo/db";
import { formatPesos, sellerFirstName, type CatalogFilters } from "@/lib/catalogo/buscar";
import { sendPortalEmail } from "@/lib/correo";
import { EquipoError } from "@/lib/inventario/equipos";
import type { GearItemKind } from "@/lib/inventario/tipos";
import { urlBaseDeLaApp } from "@/lib/sesion";
import { blockedUserIds } from "@/lib/usuarios/bloqueo";

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
 * ANTES de mandar el correo (dos corridas en paralelo no repiten); si el correo no sale, borra
 * lo que registró esta corrida para esa persona y la próxima lo reintenta. Las publicaciones más
 * viejas van primero, así el tope de 10 por correo no posterga ninguna para siempre. Si falla
 * una persona, se registra y siguen las demás.
 */
export async function runSearchAlerts(now: Date = new Date()): Promise<{ emails: number }> {
  const bloqueados = await blockedUserIds();

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

  const porUsuario = new Map<number, AlertRow[]>();
  for (const a of alerts) porUsuario.set(a.userId, [...(porUsuario.get(a.userId) ?? []), a]);

  const base = urlBaseDeLaApp();
  let emails = 0;
  for (const [userId, suyas] of porUsuario) {
    try {
      if (await avisarAUnaPersona(suyas, bloqueados, now, base)) emails += 1;
    } catch (err) {
      console.error("[alertas] Falló el aviso de una persona", userId, err);
    }
  }
  return { emails };
}

/** Las alertas de UNA persona: a lo sumo un correo. Devuelve si el correo salió. */
async function avisarAUnaPersona(
  suyas: AlertRow[],
  bloqueados: number[],
  now: Date,
  base: string,
): Promise<boolean> {
  const user = suyas[0].user;
  // Los equipos a avisar (sin repetir) y a qué alertas corresponde cada uno.
  const equipos = new Map<number, Match>();
  const pares: Array<[number, number]> = [];

  for (const a of suyas) {
    const lugar = MAX_POR_CORREO - equipos.size;
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
      orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
      take: MAX_POR_CORREO,
      select: { id: true, make: true, model: true, priceArs: true, city: true, province: true },
    })) as Match[];

    let nuevos = 0;
    for (const l of found) {
      if (equipos.has(l.id)) {
        // Ya va en el correo por otra alerta: se marca también para ésta.
        pares.push([a.id, l.id]);
      } else if (nuevos < lugar) {
        equipos.set(l.id, l);
        pares.push([a.id, l.id]);
        nuevos += 1;
      }
    }
  }
  if (equipos.size === 0) return false;

  // Una corrida en paralelo pudo avisar alguno: sólo van los que esta corrida registró.
  const registrados = new Set<number>();
  const hitIds: number[] = [];
  for (const [alertId, listingId] of pares) {
    try {
      const hit = await prisma.gearSearchAlertHit.create({
        data: { alertId, listingId },
        select: { id: true },
      });
      hitIds.push(hit.id);
      registrados.add(listingId);
    } catch (err) {
      if ((err as { code?: string })?.code !== "P2002") throw err;
    }
  }
  const aAvisar = [...equipos.values()].filter((l) => registrados.has(l.id));
  if (aAvisar.length === 0) return false;

  const data: Record<string, string> = {
    nombre: user.name ? sellerFirstName(user.name) : "",
    cantidad: String(aAvisar.length),
    url: `${base}/alertas`,
  };
  aAvisar.forEach((l, i) => {
    const n = i + 1;
    data[`item${n}_titulo`] = `${l.make} ${l.model}`;
    data[`item${n}_precio`] = formatPesos(l.priceArs);
    data[`item${n}_zona`] = `${l.city}, ${l.province}`;
    data[`item${n}_url`] = `${base}/equipos/${l.id}`;
  });
  const r = await sendPortalEmail(user.email, "alerta_busqueda", data);
  if (!r.success) {
    // Sólo lo que registró esta corrida: lo de otra corrida ya salió y no se repite.
    await prisma.gearSearchAlertHit.deleteMany({ where: { id: { in: hitIds } } });
    return false;
  }
  return true;
}
