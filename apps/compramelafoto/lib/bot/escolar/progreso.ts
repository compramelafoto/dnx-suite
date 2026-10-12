/**
 * Progreso del armado escolar (11 pasos) para DNX Bot.
 *
 * Determinístico: sólo consultas acotadas a la base, sin IA. Todas las consultas filtran por
 * el fotógrafo (álbum por `userId` + `deletedAt` nulo, escuela por `ownerId`); un `albumId`
 * ajeno se ignora como si no existiera. Los álbumes de prueba (`isTest`) no cuentan como armado escolar.
 *
 * La lógica de armado de los pasos vive en `armarPasos` (pura) para poder probarla sin base.
 */

import type { AlbumMode, StudentIdentificationMode } from "@/lib/prisma";
import { Prisma, prisma } from "@/lib/prisma";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";

export type PasoEscolarId =
  | "escuela"
  | "cursos"
  | "admin_escuela"
  | "album_vinculado"
  | "identificacion"
  | "preventa"
  | "plantillas"
  | "comision"
  | "preventa_publicada"
  | "fotos_y_aviso"
  | "entrega";
export type EstadoPaso = "hecho" | "pendiente" | "no_aplica";
export type PasoEscolar = {
  n: number;
  id: PasoEscolarId;
  titulo: string;
  estado: EstadoPaso;
  opcional: boolean;
  /** Hay una herramienta del bot que hace este paso («Hacelo por mí»); si no, sólo se abre el enlace. */
  accion: boolean;
  enlace: string | null;
  detalle?: string;
};
export type ProgresoEscolar = {
  albumId: number | null;
  albumTitulo: string | null;
  schoolId: number | null;
  pasos: PasoEscolar[];
  hechos: number;
  total: 11;
  siguiente: PasoEscolar | null;
  aMedias: boolean;
};

export type AlbumEscolar = {
  id: number;
  title: string;
  mode: AlbumMode;
  schoolId: number | null;
  studentIdentificationMode: StudentIdentificationMode | null;
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: number | null;
};

/** Hechos ya leídos de la base; `armarPasos` los convierte en los 11 pasos. */
export type DatosEscolares = {
  escuela: { id: number; name: string } | null;
  tieneCursos: boolean;
  admin: "activo" | "invitacion" | null;
  album: AlbumEscolar | null;
  rosterActivos: number;
  /** Packs activos del álbum con al menos un beneficio. */
  packsConBeneficios: number;
  /** Beneficios físicos con plantilla obligatoria (en packs activos). */
  plantillasRequeridas: number;
  /** De esos, cuántos ya tienen plantilla (`templateV2Id ?? templateId`). */
  plantillasRequeridasCargadas: number;
  /** Packs que hoy ve una familia en el catálogo público. */
  packsPublicados: number;
  fotos: number;
  avisoEnviado: boolean;
  /** Ítems de preventa (pedidos no de prueba y no cancelados). */
  itemsPreventa: number;
  itemsSinEntregar: number;
};

const SELECT_ALBUM = {
  id: true,
  title: true,
  mode: true,
  schoolId: true,
  studentIdentificationMode: true,
  organizerCommissionEnabled: true,
  organizerCommissionPercentage: true,
} as const;

const AVISO_REF_KEY = "fotosListasAvisoAt";
/** Para el saludo: sólo cuenta un álbum escolar creado en los últimos 120 días. */
export const VENTANA_SALUDO_ESCOLAR_DIAS = 120;
const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_PACKS = 100;

function tabAlbum(albumId: number, tab: string): string {
  return `/dashboard/albums/${albumId}?tab=${tab}`;
}

function rosterRequerido(modo: StudentIdentificationMode | null): boolean {
  return modo === "ROSTER_OPTIONAL" || modo === "ROSTER_REQUIRED";
}

export function armarPasos(d: DatosEscolares): ProgresoEscolar {
  const esc = d.escuela;
  const al = d.album;
  const est = (ok: boolean): EstadoPaso => (ok ? "hecho" : "pendiente");
  const enlaceAlbum = (tab: string) => (al ? tabAlbum(al.id, tab) : null);

  const identificacionOk =
    !!al &&
    al.studentIdentificationMode != null &&
    (!rosterRequerido(al.studentIdentificationMode) || d.rosterActivos > 0);

  const albumVinculado = !!al && al.mode === "SCHOOL" && al.schoolId != null && esc != null && esc.id === al.schoolId;
  const preventaOk = !!al && d.packsConBeneficios > 0;
  const fotosYAvisoOk = !!al && d.fotos > 0 && d.avisoEnviado;

  // «No aplica» sólo cuando ya hay algo que mirar; en un álbum nuevo no infla `hechos`.
  let plantillas: EstadoPaso;
  let plantillasDetalle: string | undefined;
  if (!preventaOk) {
    plantillas = "pendiente";
    if (al) plantillasDetalle = "primero armá la preventa";
  } else if (d.plantillasRequeridas === 0) plantillas = "no_aplica";
  else plantillas = est(d.plantillasRequeridasCargadas >= d.plantillasRequeridas);

  let entrega: EstadoPaso;
  let entregaDetalle: string | undefined;
  if (!al) entrega = "pendiente";
  else if (d.itemsPreventa === 0) {
    if (fotosYAvisoOk) entrega = "no_aplica";
    else {
      entrega = "pendiente";
      entregaDetalle = "todavía sin pedidos";
    }
  } else if (d.itemsSinEntregar > 0) {
    entrega = "pendiente";
    entregaDetalle = `${d.itemsSinEntregar} por entregar`;
  } else entrega = "hecho";

  const pasos: PasoEscolar[] = [
    {
      n: 1,
      id: "escuela",
      titulo: "Crear la escuela",
      estado: est(!!esc),
      opcional: false,
      accion: true,
      enlace: esc ? `/fotografo/escuelas/${esc.id}` : "/fotografo/escuelas/nueva",
      ...(esc ? { detalle: esc.name } : {}),
    },
    {
      n: 2,
      id: "cursos",
      titulo: "Cargar cursos o alumnos",
      estado: est(!!esc && d.tieneCursos),
      opcional: false,
      accion: true,
      enlace: esc ? `/fotografo/escuelas/${esc.id}` : null,
    },
    {
      n: 3,
      id: "admin_escuela",
      titulo: "Invitar a alguien de la escuela",
      estado: est(!!esc && d.admin != null),
      opcional: true,
      accion: true,
      enlace: esc ? `/fotografo/escuelas/${esc.id}` : null,
      ...(esc && d.admin ? { detalle: d.admin === "activo" ? "activo" : "invitación enviada" } : {}),
    },
    {
      n: 4,
      id: "album_vinculado",
      titulo: "Crear el álbum escolar vinculado a la escuela",
      estado: est(albumVinculado),
      opcional: false,
      accion: true,
      enlace: al ? tabAlbum(al.id, "configuracion") : "/dashboard/albums/new",
    },
    {
      n: 5,
      id: "identificacion",
      titulo: "Definir cómo se identifica a cada alumno",
      estado: est(identificacionOk),
      opcional: false,
      accion: true,
      enlace: enlaceAlbum("escuela"),
    },
    {
      n: 6,
      id: "preventa",
      titulo: "Armar los packs de preventa",
      estado: est(preventaOk),
      opcional: false,
      accion: false,
      enlace: enlaceAlbum("preventa"),
    },
    {
      n: 7,
      id: "plantillas",
      titulo: "Elegir las plantillas de los productos impresos",
      estado: plantillas,
      opcional: false,
      accion: false,
      enlace: enlaceAlbum("preventa"),
      ...(plantillasDetalle ? { detalle: plantillasDetalle } : {}),
    },
    {
      n: 8,
      id: "comision",
      titulo: "Configurar la comisión para la escuela",
      estado: est(!!al && al.organizerCommissionEnabled && (al.organizerCommissionPercentage ?? 0) > 0),
      opcional: true,
      accion: true,
      enlace: enlaceAlbum("comision-escolar"),
    },
    {
      n: 9,
      id: "preventa_publicada",
      titulo: "Publicar la preventa para las familias",
      estado: est(!!al && d.packsPublicados > 0),
      opcional: false,
      accion: false,
      enlace: al ? `${tabAlbum(al.id, "publicacion")}&pub=compartir` : null,
    },
    {
      n: 10,
      id: "fotos_y_aviso",
      titulo: "Subir las fotos y avisar a las familias",
      estado: est(fotosYAvisoOk),
      opcional: false,
      accion: true,
      enlace: enlaceAlbum("fotos"),
      ...(al ? { detalle: `${d.fotos} fotos · aviso ${d.avisoEnviado ? "enviado" : "no enviado"}` } : {}),
    },
    {
      n: 11,
      id: "entrega",
      titulo: "Entregar los pedidos",
      estado: entrega,
      opcional: false,
      accion: false,
      enlace: "/fotografo/escuelas/pedidos",
      ...(entregaDetalle ? { detalle: entregaDetalle } : {}),
    },
  ];

  const hechos = pasos.filter((p) => p.estado !== "pendiente").length;
  const pendientes = pasos.filter((p) => p.estado === "pendiente");
  const siguiente = pendientes.find((p) => !p.opcional) ?? pendientes[0] ?? null;

  return {
    albumId: al?.id ?? null,
    albumTitulo: al?.title ?? null,
    schoolId: esc?.id ?? null,
    pasos,
    hechos,
    total: 11,
    siguiente,
    aMedias: !!al && al.mode === "SCHOOL" && al.schoolId == null,
  };
}

export type OpcionesProgreso = {
  /**
   * Sólo para el saludo: si no se pide un `albumId`, buscar el álbum escolar más reciente entre los
   * creados en los últimos 120 días (un álbum viejo sin terminar no debe insistir para siempre).
   */
  soloRecientes?: boolean;
};

async function buscarAlbum(
  userId: number,
  albumId: number | undefined,
  now: Date,
  opts: OpcionesProgreso
): Promise<AlbumEscolar | null> {
  if (albumId != null) {
    const propio = await prisma.album.findFirst({
      where: { id: albumId, userId, deletedAt: null, isTest: false },
      select: SELECT_ALBUM,
    });
    if (propio) return propio;
  }
  return prisma.album.findFirst({
    where: {
      userId,
      deletedAt: null,
      isTest: false,
      OR: [{ schoolId: { not: null } }, { mode: "SCHOOL" }],
      ...(opts.soloRecientes ? { createdAt: { gte: new Date(now.getTime() - VENTANA_SALUDO_ESCOLAR_DIAS * DIA_MS) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: SELECT_ALBUM,
  });
}

async function buscarEscuela(userId: number, schoolId: number | null) {
  const select = { id: true, name: true } as const;
  if (schoolId != null) {
    // Sólo si la escuela del álbum es del mismo fotógrafo.
    return prisma.school.findFirst({ where: { id: schoolId, ownerId: userId }, select });
  }
  return prisma.school.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: "desc" }, select });
}

async function datosDeEscuela(schoolId: number, now: Date) {
  const [cursos, inscripcion, invitacion, organizador] = await Promise.all([
    prisma.schoolCourse.count({ where: { schoolId } }),
    prisma.studentEnrollment.findFirst({ where: { schoolId }, select: { id: true } }),
    prisma.schoolOrganizerInvitation.findFirst({
      where: { schoolId, status: "PENDING", expiresAt: { gt: now } },
      select: { id: true },
    }),
    prisma.schoolOrganizer.findFirst({ where: { schoolId, status: "ACTIVE" }, select: { id: true } }),
  ]);
  const admin: DatosEscolares["admin"] = organizador ? "activo" : invitacion ? "invitacion" : null;
  return { tieneCursos: cursos > 0 || inscripcion != null, admin };
}

async function datosDeAlbum(album: AlbumEscolar, now: Date) {
  const albumId = album.id;
  const [rosterActivos, packs, fotos, aviso, items] = await Promise.all([
    rosterRequerido(album.studentIdentificationMode)
      ? prisma.albumStudentRosterEntry.count({ where: { albumId, isActive: true } })
      : Promise.resolve(0),
    prisma.packDefinition.findMany({
      where: { albumId, isActive: true },
      select: {
        id: true,
        benefits: { select: { kind: true, templatePolicy: true, templateV2Id: true, templateId: true } },
      },
      take: MAX_PACKS,
    }),
    prisma.photo.count({ where: { albumId, isRemoved: false } }),
    prisma.order.findFirst({
      where: {
        albumId,
        origin: "PREVENTA_PACK",
        status: "PAID",
        isTest: false,
        redemptionPaymentRefsJson: { path: [AVISO_REF_KEY], not: Prisma.AnyNull },
      },
      select: { id: true },
    }),
    prisma.preCompraOrderItem.groupBy({
      by: ["status"],
      where: { order: { albumId, isTest: false, status: { not: "CANCELED" } } },
      _count: { _all: true },
    }),
  ]);

  const packsPublicados = (await listActivePacksForPublicCatalog(albumId, now, { hasPhotos: fotos > 0 })).length;

  const requeridos = packs
    .flatMap((p) => p.benefits)
    .filter((b) => b.kind === "PHYSICAL" && b.templatePolicy === "REQUIRED");

  let itemsPreventa = 0;
  let itemsSinEntregar = 0;
  for (const g of items) {
    itemsPreventa += g._count._all;
    if (g.status !== "DELIVERED") itemsSinEntregar += g._count._all;
  }

  return {
    rosterActivos,
    packsConBeneficios: packs.filter((p) => p.benefits.length > 0).length,
    plantillasRequeridas: requeridos.length,
    plantillasRequeridasCargadas: requeridos.filter((b) => (b.templateV2Id ?? b.templateId) != null).length,
    packsPublicados,
    fotos,
    avisoEnviado: aviso != null,
    itemsPreventa,
    itemsSinEntregar,
  };
}

export async function computeSchoolSetupProgress(
  userId: number,
  albumId?: number,
  now: Date = new Date(),
  opts: OpcionesProgreso = {}
): Promise<ProgresoEscolar> {
  const album = await buscarAlbum(userId, albumId, now, opts);
  const escuela = await buscarEscuela(userId, album?.schoolId ?? null);

  const [deEscuela, deAlbum] = await Promise.all([
    escuela ? datosDeEscuela(escuela.id, now) : Promise.resolve(null),
    album ? datosDeAlbum(album, now) : Promise.resolve(null),
  ]);

  return armarPasos({
    escuela,
    album,
    tieneCursos: deEscuela?.tieneCursos ?? false,
    admin: deEscuela?.admin ?? null,
    rosterActivos: deAlbum?.rosterActivos ?? 0,
    packsConBeneficios: deAlbum?.packsConBeneficios ?? 0,
    plantillasRequeridas: deAlbum?.plantillasRequeridas ?? 0,
    plantillasRequeridasCargadas: deAlbum?.plantillasRequeridasCargadas ?? 0,
    packsPublicados: deAlbum?.packsPublicados ?? 0,
    fotos: deAlbum?.fotos ?? 0,
    avisoEnviado: deAlbum?.avisoEnviado ?? false,
    itemsPreventa: deAlbum?.itemsPreventa ?? 0,
    itemsSinEntregar: deAlbum?.itemsSinEntregar ?? 0,
  });
}
