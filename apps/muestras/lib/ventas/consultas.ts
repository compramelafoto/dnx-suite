import "server-only";
import { prisma } from "@repo/db";
import { activitySalesHref, type ActivityRole, type EditionRow } from "@repo/muestras";
import { conPermiso, puede, rolEnMuestra } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";
import { leerConfigDeVentas, type ConfigDeVentas } from "./config";
import { evaluarOferta, type DatosDeEvaluacion, type Evaluacion } from "./evaluar";

/**
 * Consultas de la venta (etapa 8) para el panel de la organización y del autor. Cada una recibe a
 * quien mira y lee el permiso en la base; nunca es una acción de servidor.
 */
type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

export type ObraVendible = {
  activityWorkId: string;
  title: string;
  imageUrl: string;
  authorUserId: number;
  authorName: string;
  origen: "EXPOSITOR" | "CONCURSO";
  /** El precio que cargó el expositor en la etapa 6: sugerencia para su primer formato. */
  precioSugerido: number | null;
};

/**
 * Obras de la muestra que se pueden vender (D8): de expositor aprobadas y marcadas "La quiero
 * vender", o de concurso con la venta aceptada por su autor. Con `authorUserId`, sólo las suyas.
 */
export async function obrasVendibles(activityId: string, authorUserId?: number): Promise<ObraVendible[]> {
  const [expositores, concurso] = await Promise.all([
    prisma.culturalExhibitorWork.findMany({
      where: {
        activityId, status: "APPROVED", forSale: true, activityWorkId: { not: null },
        exhibitor: { activityId, status: "ACTIVE", ...(authorUserId != null ? { userId: authorUserId } : {}) },
      },
      select: { activityWorkId: true, priceArs: true, exhibitor: { select: { userId: true } } },
    }),
    prisma.culturalContestWork.findMany({
      where: {
        activityId, forSale: true, saleConsent: "ACCEPTED", exhibitConsent: "ACCEPTED", activityWorkId: { not: null },
        authorUserId: authorUserId != null ? authorUserId : { not: null },
      },
      select: { activityWorkId: true, authorUserId: true },
    }),
  ]);
  const candidatas = new Map<string, { authorUserId: number; origen: ObraVendible["origen"]; precioSugerido: number | null }>();
  for (const w of expositores) if (w.activityWorkId) candidatas.set(w.activityWorkId, { authorUserId: w.exhibitor.userId, origen: "EXPOSITOR", precioSugerido: w.priceArs });
  for (const w of concurso) if (w.activityWorkId && w.authorUserId != null) candidatas.set(w.activityWorkId, { authorUserId: w.authorUserId, origen: "CONCURSO", precioSugerido: null });
  if (candidatas.size === 0) return [];
  // Sólo las que siguen en la muestra (el editor pudo quitarlas).
  const enLaMuestra = await prisma.culturalActivityWork.findMany({
    where: { activityId, id: { in: [...candidatas.keys()] } },
    select: { id: true, title: true, imageUrl: true, authorName: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  return enLaMuestra.map((w) => {
    const c = candidatas.get(w.id)!;
    return { activityWorkId: w.id, title: w.title, imageUrl: w.imageUrl, authorUserId: c.authorUserId, authorName: w.authorName, origen: c.origen, precioSugerido: c.precioSugerido };
  });
}

/** `isTest` de lo que se cuenta y se vende con esta configuración (D4). */
export const ventasDePrueba = (config: Pick<ConfigDeVentas, "ambienteCuenta">) => config.ambienteCuenta === "SANDBOX";

const OFERTA = {
  id: true, activityWorkId: true, authorUserId: true, format: true, editionKind: true, editionSize: true, proofCount: true,
  priceArs: true, approvedPriceArs: true, paper: true, widthCm: true, heightCm: true, status: true, reviewNote: true,
  firstSoldAt: true, sortOrder: true, proposedAt: true, updatedAt: true,
} as const;

/** Todo lo que hace falta para evaluar los formatos de una muestra, en una consulta por tabla. */
export async function datosDeVenta(activityId: string, config: ConfigDeVentas, ahora = new Date()) {
  const isTest = ventasDePrueba(config);
  const [actividad, setup, vendibles, ofertas] = await Promise.all([
    prisma.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, title: true, slug: true, reviewStatus: true, isCancelled: true, endsAt: true, proposedByUserId: true, type: true } }),
    prisma.culturalSaleSetup.findUnique({ where: { activityId } }),
    obrasVendibles(activityId),
    prisma.culturalWorkOffer.findMany({ where: { activityId }, select: OFERTA, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  if (!actividad) return null;
  const autores = [...new Set([...vendibles.map((v) => v.authorUserId), ...ofertas.map((o) => o.authorUserId)])];
  const personas = [...new Set([...autores, ...(setup ? [setup.organizerUserId] : [])])];
  const [terminos, cuentas, originales, firmas, copias] = await Promise.all([
    prisma.culturalSaleAuthorTerms.findMany({ where: { activityId }, select: { userId: true, splitVersion: true, acceptedAt: true } }),
    personas.length
      ? prisma.culturalPayoutAccount.findMany({ where: { userId: { in: personas }, environment: config.ambienteCuenta }, select: { userId: true, consentStatus: true, mpEmail: true } })
      : Promise.resolve([]),
    prisma.culturalSaleFile.findMany({ where: { activityId }, select: { activityWorkId: true, status: true, widthPx: true, heightPx: true, bytes: true, problem: true, authorUserId: true } }),
    autores.length ? prisma.culturalAuthorSignature.findMany({ where: { userId: { in: autores } }, select: { userId: true } }) : Promise.resolve([]),
    ofertas.length
      ? prisma.culturalEditionCopy.findMany({ where: { offerId: { in: ofertas.map((o) => o.id) }, isTest, kind: "COPY" }, select: { id: true, offerId: true, number: true, status: true, reservedUntil: true, kind: true, isTest: true } })
      : Promise.resolve([]),
  ]);
  const porOferta = new Map<string, EditionRow[]>();
  for (const c of copias) porOferta.set(c.offerId, [...(porOferta.get(c.offerId) ?? []), c]);
  const datos: DatosDeEvaluacion = {
    actividad,
    setup: setup ? { status: setup.status, splitVersion: setup.splitVersion, organizerUserId: setup.organizerUserId } : null,
    vendibles: new Map(vendibles.map((v) => [v.activityWorkId, { authorUserId: v.authorUserId, authorName: v.authorName }])),
    terminos: new Map(terminos.map((t) => [t.userId, t.splitVersion])),
    consentimientos: new Map(cuentas.map((c) => [c.userId, c.consentStatus])),
    originales: new Map(originales.map((f) => [f.activityWorkId, f.status])),
    firmas: new Set(firmas.map((f) => f.userId)),
    copias: porOferta,
    ahora,
  };
  return { actividad, setup, vendibles, ofertas, terminos, cuentas, originales, firmas: datos.firmas, datos, isTest };
}

/**
 * El panel de ventas de una muestra: quien tiene `sales` edita; `salesFulfill` (coorganización) lee.
 * Sin ninguna de las dos, `null` (la página responde 404).
 */
export async function panelDeVentas(activityId: string, usuario: Quien) {
  const rol = await rolEnMuestra(activityId, usuario);
  if (!rol) return null;
  const edita = puede(usuario, "sales", rol.role);
  if (!edita && !puede(usuario, "salesFulfill", rol.role)) return null;
  const config = leerConfigDeVentas();
  const d = await datosDeVenta(activityId, config);
  if (!d || d.actividad.type !== "MUESTRA") return null;
  const pedidos = await prisma.culturalSaleOrder.groupBy({
    by: ["status"],
    where: { activityId, isTest: d.isTest },
    _count: { _all: true },
    _sum: { totalCents: true },
  });
  const cuentaDe = (userId: number) => d.cuentas.find((c) => c.userId === userId) ?? null;
  const aceptoDe = (userId: number) => d.terminos.find((t) => t.userId === userId) ?? null;
  const autores = [...new Map(d.vendibles.map((v) => [v.authorUserId, v.authorName])).entries()].map(([userId, nombre]) => {
    const t = aceptoDe(userId);
    return {
      userId,
      nombre,
      aceptoVigente: d.setup != null && t?.splitVersion === d.setup.splitVersion,
      aceptoAlguna: t != null,
      cobro: cuentaDe(userId)?.consentStatus ?? "NONE",
      firma: d.firmas.has(userId),
    };
  });
  const obras = d.vendibles.map((v) => ({
    ...v,
    original: d.originales.find((f) => f.activityWorkId === v.activityWorkId) ?? null,
    ofertas: d.ofertas
      .filter((o) => o.activityWorkId === v.activityWorkId)
      .map((o) => ({ ...o, evaluacion: evaluarOferta(o, d.datos) as Evaluacion })),
  }));
  // Formatos de obras que dejaron de ser vendibles (o de otro autor): se muestran aparte.
  const sueltas = d.ofertas
    .filter((o) => !d.vendibles.some((v) => v.activityWorkId === o.activityWorkId && v.authorUserId === o.authorUserId))
    .filter((o) => o.status !== "WITHDRAWN");
  const esDueno = rol.ownerUserId === usuario.id || usuario.esSuperAdmin;
  // Para "Cambiar quién cobra": el dueño y la coorganización activa (sólo lo ve el dueño).
  let cobradores: { userId: number; nombre: string }[] = [];
  if (esDueno && edita) {
    const equipo = await prisma.culturalActivityMember.findMany({
      where: { activityId, status: "ACTIVE", role: "CO_ORGANIZER", userId: { not: null } },
      select: { userId: true },
    });
    const ids = [...new Set([rol.ownerUserId, ...equipo.map((m) => m.userId!).filter((x) => x != null)])];
    const personas = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
    cobradores = ids.map((id) => {
      const p = personas.find((x) => x.id === id);
      return { userId: id, nombre: `${p?.name?.trim() || p?.email || `Persona ${id}`}${id === rol.ownerUserId ? " (responsable)" : ""}` };
    });
  }
  return {
    actividad: d.actividad,
    rol: rol.role as ActivityRole | null,
    edita,
    esDueno,
    cobradores,
    esSuperAdmin: usuario.esSuperAdmin,
    soyQuienCobra: d.setup?.organizerUserId === usuario.id,
    setup: d.setup,
    modo: config.modo,
    motivo: config.motivo,
    ambiente: config.ambienteCuenta,
    cuentaOrganizacion: d.setup ? cuentaDe(d.setup.organizerUserId) : null,
    autores,
    obras,
    sueltas: sueltas.length,
    pedidos: pedidos.map((p) => ({ status: p.status, cantidad: p._count._all, totalCents: p._sum.totalCents ?? 0 })),
    paraRevisar: d.ofertas.filter((o) => o.status === "PROPOSED").length,
  };
}

export type PanelDeVentas = NonNullable<Awaited<ReturnType<typeof panelDeVentas>>>;

/** "Ventas" del menú: las muestras donde la persona enciende la venta o prepara los pedidos. */
export async function muestrasConVenta(usuario: Quien) {
  const filas = await prisma.culturalActivity.findMany({
    where: {
      AND: [
        { type: "MUESTRA", reviewStatus: { not: "REJECTED" } },
        { OR: [conPermiso({}, usuario, "sales", { listado: true }), conPermiso({}, usuario, "salesFulfill", { listado: true })] },
      ],
    },
    select: {
      id: true, title: true, startsAt: true, endsAt: true, reviewStatus: true, isCancelled: true,
      saleSetup: { select: { status: true } },
      _count: { select: { workOffers: { where: { status: "PROPOSED" } } } },
    },
    orderBy: { startsAt: "desc" },
  });
  return filas.map((f) => ({ ...f, href: activitySalesHref(f.id), paraRevisar: f._count.workOffers }));
}
