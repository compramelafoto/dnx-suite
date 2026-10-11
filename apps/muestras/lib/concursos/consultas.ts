import "server-only";
import { prisma } from "@repo/db";
import {
  activityRole, authorCredit, authorPendingCount, canEdit, contestShareMessage, parseContestTiers, temporalStatus, type ReviewStatus,
} from "@repo/muestras";
import { APP_URL } from "@/lib/correos/enviar";
import { conPermiso, dondePuede, puede } from "@/lib/equipo/permisos";
import { esUrlWeb } from "@/lib/url";
import type { Usuario } from "@/lib/usuario";
import { loteVigente } from "./fotorank";

/**
 * Lecturas del panel para el concurso de FotoRank en la muestra (etapa 7). El permiso va siempre en
 * el `where` (`dondePuede`/`conPermiso`): nunca "leer y después mirar".
 */
type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/**
 * Las muestras propias a las que se pueden sumar obras de un concurso (D8): tipo muestra, editables
 * (borrador, rechazada o publicada; no en revisión ni despublicada) y sin obras de ningún concurso.
 * El super admin ve sólo las suyas, como en los listados del panel.
 */
export async function muestrasParaSumar(usuario: Quien) {
  return prisma.culturalActivity.findMany({
    where: conPermiso(
      { type: "MUESTRA", reviewStatus: { in: ["DRAFT", "REJECTED", "APPROVED"] }, isCancelled: false, contestImport: { is: null } },
      usuario,
      "contest",
      { listado: true },
    ),
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, reviewStatus: true },
  });
}

/** Las muestras que ya salieron de este concurso y esta persona puede ver. */
export async function muestrasDeEsteConcurso(usuario: Quien, contestId: string) {
  const filas = await prisma.culturalContestImport.findMany({
    where: { contestId, activity: dondePuede(usuario, "view") },
    orderBy: { createdAt: "desc" },
    select: { activity: { select: { id: true, title: true, reviewStatus: true } } },
  });
  return filas.map((f) => f.activity);
}

/** Cuántas obras de concursos esperan una respuesta del autor, por muestra (para los enlaces del panel). */
export async function pendientesDelConcurso(activityIds: readonly string[]): Promise<Map<string, number>> {
  if (activityIds.length === 0) return new Map();
  const filas = await prisma.culturalContestWork.groupBy({
    by: ["activityId"],
    where: { activityId: { in: [...activityIds] }, include: true, OR: [{ exhibitConsent: "PENDING" }, { saleConsent: "PENDING" }] },
    _count: { _all: true },
  });
  return new Map(filas.map((f) => [f.activityId, f._count._all]));
}

/** La fila del equipo de quien mira (sólo la suya y activa): alcanza para `activityRole`. */
const filaPropia = (userId: number) => ({ where: { userId, status: "ACTIVE" }, select: { userId: true, role: true, status: true } }) as const;

/**
 * El panel "Del concurso" (D11, D13, D21, D22, D28). Lo ve quien tiene `view` en la muestra; cambia
 * cosas sólo quien tiene `contest` (el dueño) y con la muestra editable. `null` si no lo puede ver o
 * la muestra no salió de un concurso.
 */
export async function panelDelConcurso(activityId: string, usuario: Usuario) {
  if (typeof activityId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(activityId)) return null;
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id: activityId }, usuario, "view"),
    select: {
      id: true, title: true, slug: true, type: true, reviewStatus: true, proposedByUserId: true, workspaceId: true, isCancelled: true,
      startsAt: true, endsAt: true, members: filaPropia(usuario.id),
      contestImport: {
        select: {
          id: true, contestId: true, contestTitle: true, contestSlug: true, organizationName: true, tiers: true,
          resultBatchId: true, sourceVersion: true, syncedAt: true,
        },
      },
    },
  });
  if (!a?.contestImport) return null;
  const imp = a.contestImport;
  const rol = activityRole(a, usuario.id);
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: rol };
  const puedeCambiar = puede(usuario, "contest", rol);
  const editable = puedeCambiar && canEdit({ ...a, reviewStatus: a.reviewStatus as ReviewStatus }, actor);

  const [obras, autores, lote] = await Promise.all([
    prisma.culturalContestWork.findMany({
      where: { activityId: a.id },
      orderBy: [{ rank: "asc" }, { id: "asc" }],
      select: {
        id: true, entryId: true, authorUserId: true, authorName: true, title: true, tier: true, distinction: true, sourceStatus: true,
        imageStatus: true, imageUrl: true, imageError: true, include: true, toPrint: true, forSale: true, exhibitBasis: true,
        attributionRequired: true, exhibitConsent: true, consentBy: true, saleConsent: true, activityWorkId: true,
      },
    }),
    prisma.culturalContestAuthor.findMany({
      where: { activityId: a.id },
      orderBy: { authorName: "asc" },
      select: { id: true, userId: true, authorName: true, displayName: true, notifiedAt: true, respondedAt: true },
    }),
    // El aviso de "cambió" sólo le sirve a quien puede actualizar.
    puedeCambiar ? loteVigente(imp.contestId) : Promise.resolve(undefined),
  ]);
  const firmaDe = new Map(autores.flatMap((x) => (x.userId != null ? [[x.userId, x.displayName] as const] : [])));

  const filas = obras.map((o) => {
    const credito = authorCredit({
      attributionRequired: o.attributionRequired, exhibitConsent: o.exhibitConsent, consentBy: o.consentBy,
      signedName: o.authorUserId != null ? (firmaDe.get(o.authorUserId) ?? null) : null, defaultName: o.authorName,
    });
    // Campo por campo: al navegador no van la cuenta del autor (`authorUserId`) ni su inscripción
    // en FotoRank (`entryId`), que tampoco debe ver la coorganización.
    return {
      id: o.id, title: o.title, tier: o.tier, distinction: o.distinction, sourceStatus: o.sourceStatus,
      imageStatus: o.imageStatus, imageError: o.imageError, include: o.include, toPrint: o.toPrint, forSale: o.forSale,
      exhibitBasis: o.exhibitBasis, attributionRequired: o.attributionRequired, exhibitConsent: o.exhibitConsent,
      consentBy: o.consentBy, saleConsent: o.saleConsent, activityWorkId: o.activityWorkId,
      // La coorganización (sólo lectura) ve el crédito público: con "Autoría reservada", no el nombre real.
      authorName: puedeCambiar ? o.authorName : credito.name,
      imageUrl: esUrlWeb(o.imageUrl) ? o.imageUrl : null,
      enLaMuestra: o.activityWorkId != null,
      seVeSuNombre: credito.show,
      sinCuenta: o.authorUserId == null,
    };
  });

  const cerrada = temporalStatus(a, new Date()) === "CLOSED";
  const contest = imp.contestTitle;
  // Los enlaces para mandar (con el nombre de cada autor) son de quien maneja la muestra.
  const conCuenta = autores.filter((x) => puedeCambiar && x.userId != null).map((x) => {
    const suyas = obras.filter((o) => o.authorUserId === x.userId);
    const url = `${APP_URL}/panel/expositor/concurso/${x.id}`;
    const nombre = x.displayName?.trim() || x.authorName;
    return {
      id: x.id, nombre, obras: suyas.length, pendientes: authorPendingCount(suyas), notifiedAt: x.notifiedAt, respondedAt: x.respondedAt,
      url, mensaje: contestShareMessage({ name: nombre, organization: imp.organizationName, contest, url }),
    };
  });

  return {
    muestra: { id: a.id, title: a.title, slug: a.slug, reviewStatus: a.reviewStatus, cerrada },
    concurso: {
      id: imp.contestId, title: imp.contestTitle, slug: imp.contestSlug, organizationName: imp.organizationName,
      tiers: parseContestTiers(imp.tiers), syncedAt: imp.syncedAt,
      // `undefined`: no se pudo leer FotoRank (no se avisa). `null`: ya no hay lote cerrado.
      cambio: lote === undefined ? false : lote === null || lote.id !== imp.resultBatchId || lote.version.getTime() !== imp.sourceVersion.getTime(),
      sinLote: lote === null,
    },
    puedeCambiar,
    editable,
    enRevision: a.reviewStatus === "IN_REVIEW",
    obras: filas,
    autores: conCuenta,
    resumen: {
      total: obras.length,
      enLaMuestra: filas.filter((o) => o.enLaMuestra).length,
      esperanAlAutor: filas.filter((o) => o.include && o.exhibitConsent === "PENDING").length,
      sacadas: filas.filter((o) => !o.include || o.exhibitConsent === "DECLINED" || o.exhibitConsent === "WITHDRAWN").length,
      faltanImagenes: filas.filter((o) => o.include && o.exhibitConsent === "ACCEPTED" && o.imageStatus === "PENDING").length,
      fallaron: filas.filter((o) => o.include && o.imageStatus === "FAILED").length,
    },
  };
}

export type PanelDelConcurso = NonNullable<Awaited<ReturnType<typeof panelDelConcurso>>>;

// ── El autor ("Dónde expongo", D18 a D20) ──────────────────────────────────

/**
 * "Tus obras de concursos": una fila por muestra donde hay obras de esta cuenta traídas de un
 * concurso. Siempre por la cuenta (`userId` = la sesión). El enlace público de la muestra sólo si
 * está publicada.
 */
export async function misObrasDeConcursos(usuario: Quien) {
  const filas = await prisma.culturalContestAuthor.findMany({
    where: { userId: usuario.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, activityId: true,
      import: { select: { contestTitle: true, organizationName: true } },
      activity: {
        select: { title: true, slug: true, reviewStatus: true, startsAt: true, endsAt: true, venueName: true, city: true, isVirtualOnly: true, isCancelled: true },
      },
    },
  });
  if (filas.length === 0) return [];
  const obras = await prisma.culturalContestWork.findMany({
    where: { authorUserId: usuario.id, activityId: { in: filas.map((f) => f.activityId) } },
    select: { activityId: true, include: true, exhibitConsent: true, saleConsent: true },
  });
  return filas.map((f) => {
    const suyas = obras.filter((o) => o.activityId === f.activityId);
    const { slug, reviewStatus, ...muestra } = f.activity;
    return {
      id: f.id,
      concurso: f.import.contestTitle,
      organizacion: f.import.organizationName,
      muestra: { ...muestra, slug: reviewStatus === "APPROVED" ? slug : null },
      obras: suyas.filter((o) => o.include).length,
      pendientes: authorPendingCount(suyas),
    };
  });
}

/**
 * La página del autor (`/panel/expositor/concurso/<id>`, D19, D20). `null` si la fila no es de esta
 * cuenta: la página dice que el enlace es para otra cuenta, sin mostrar ningún dato de las obras.
 * Sólo trae las obras que siguen en la muestra; la imagen es la copia de nuestro bucket.
 */
export async function miAutoriaEnMuestra(id: string, usuario: Quien) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const autor = await prisma.culturalContestAuthor.findFirst({
    where: { id, userId: usuario.id },
    select: {
      id: true, activityId: true, authorName: true, displayName: true, respondedAt: true,
      import: { select: { contestTitle: true, organizationName: true } },
      activity: {
        select: {
          title: true, slug: true, reviewStatus: true, organizersText: true, startsAt: true, endsAt: true, venueName: true, city: true,
          isVirtualOnly: true, isCancelled: true,
        },
      },
    },
  });
  if (!autor) return null;
  const [obras, perfil] = await Promise.all([
    prisma.culturalContestWork.findMany({
      where: { activityId: autor.activityId, authorUserId: usuario.id, include: true },
      orderBy: [{ rank: "asc" }, { id: "asc" }],
      select: {
        id: true, title: true, distinction: true, imageStatus: true, imageUrl: true, forSale: true, exhibitBasis: true, attributionRequired: true,
        exhibitConsent: true, consentBy: true, saleConsent: true, activityWorkId: true,
      },
    }),
    prisma.photographerProfile.findUnique({ where: { userId: usuario.id }, select: { displayName: true, bio: true } }),
  ]);
  const { slug, reviewStatus, ...muestra } = autor.activity;
  return {
    id: autor.id,
    concurso: autor.import.contestTitle,
    organizacion: autor.import.organizationName,
    nombre: autor.authorName,
    firma: autor.displayName,
    perfil: perfil ? { displayName: perfil.displayName, tieneBio: !!perfil.bio?.trim() } : null,
    muestra: { ...muestra, slug: reviewStatus === "APPROVED" ? slug : null },
    cerrada: temporalStatus(autor.activity, new Date()) === "CLOSED",
    obras: obras.map((o) => ({
      ...o,
      imageUrl: o.imageStatus === "COPIED" && esUrlWeb(o.imageUrl) ? o.imageUrl : null,
      enLaMuestra: o.activityWorkId != null,
      seVeSuNombre: authorCredit({
        attributionRequired: o.attributionRequired, exhibitConsent: o.exhibitConsent, consentBy: o.consentBy,
        signedName: autor.displayName, defaultName: autor.authorName,
      }).show,
    })),
  };
}

export type MiAutoriaEnMuestra = NonNullable<Awaited<ReturnType<typeof miAutoriaEnMuestra>>>;
