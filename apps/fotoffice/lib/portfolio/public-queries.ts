import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PORTFOLIO_MODULE_KEY } from "./constants";
import { portfolioVisibility } from "./visibility";

/**
 * Las dos lecturas públicas: el directorio y la ficha de una persona.
 *
 * ── La regla no se reescribe en SQL ──
 *
 * Sería más rápido filtrar las siete condiciones en el `where` de Prisma. No se hace: la regla
 * vive en `portfolioVisibility` y acá se la consulta. Escrita dos veces, un día dirían cosas
 * distintas, y el modo de falla es justo el que esta arquitectura existe para evitar — que el
 * directorio liste a alguien cuya ficha devuelve 404, o al revés.
 *
 * Lo que sí hace el `where` es reducir el universo a lo que podría llegar a mostrarse
 * (`memberPublished`), que no es la regla sino una forma de no traer el padrón entero.
 *
 * ── Qué se expone ──
 *
 * Sólo lo que la persona aceptó publicar: nombre, estudio, especialidades, presentación, enlaces y
 * sus fotos. Nunca el número de socio, el documento, el email ni el teléfono. El `select` es la
 * frontera: lo que no se nombra acá no puede filtrarse por descuido más adelante.
 */

export type DirectoryEntry = {
  publicSlug: string;
  displayName: string;
  businessName: string | null;
  specialties: string[];
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
};

export type PublicPortfolioPhoto = {
  id: string;
  url: string;
  width: number;
  height: number;
  title: string | null;
  year: number | null;
};

export type PublicPortfolio = {
  publicSlug: string;
  displayName: string;
  businessName: string | null;
  specialties: string[];
  bio: string | null;
  profilePhotoUrl: string | null;
  links: {
    website: string | null;
    instagram: string | null;
    tiktok: string | null;
    facebook: string | null;
    youtube: string | null;
    linkedin: string | null;
  };
  coverUrl: string | null;
  photos: PublicPortfolioPhoto[];
};

/** Lo único que se lee del socio. Todo lo demás queda del lado privado. */
const SELECT_MIEMBRO = {
  firstName: true,
  lastName: true,
  status: true,
  directoryOptIn: true,
  businessName: true,
  specialties: true,
  bio: true,
  website: true,
  instagram: true,
  tiktok: true,
  facebook: true,
  youtube: true,
  linkedin: true,
  profilePhotoUrl: true,
} as const;

const SELECT_FOTO = {
  id: true,
  url: true,
  width: true,
  height: true,
  order: true,
  title: true,
  year: true,
} as const;

type FilaMiembro = {
  firstName: string;
  lastName: string;
  status: string;
  directoryOptIn: boolean;
};

/**
 * Cuántos cargos vencidos impagos tiene cada persona del workspace, en UNA consulta.
 *
 * Una por socio sería correcta y lentísima: el directorio de una institución con 150 socios haría
 * 150 viajes a la base para pintar una grilla.
 */
async function cargosVencidosPorMiembro(
  workspaceId: string,
  ahora: Date,
): Promise<Map<string, number>> {
  const filas = await prisma.membershipCharge.groupBy({
    by: ["memberId"],
    where: { workspaceId, balanceArs: { gt: 0 }, dueDate: { lt: ahora } },
    _count: { _all: true },
  });
  return new Map(filas.map((f) => [f.memberId, f._count._all]));
}

function nombreVisible(member: FilaMiembro): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

function estaAlAire(input: {
  memberPublished: boolean;
  hiddenByAdminAt: Date | null;
  adminForcePublish: boolean;
  member: FilaMiembro;
  photoCount: number;
  overdueCount: number;
}): boolean {
  return portfolioVisibility({
    // Quien llama ya verificó el módulo; pasarlo en true acá evita una consulta por fila.
    moduleEnabled: true,
    hiddenByAdminAt: input.hiddenByAdminAt,
    memberStatus: input.member.status as "ACTIVE" | "SUSPENDED" | "INACTIVE",
    directoryOptIn: input.member.directoryOptIn,
    photoCount: input.photoCount,
    memberPublished: input.memberPublished,
    overdueCount: input.overdueCount,
    adminForcePublish: input.adminForcePublish,
  }).visible;
}

/** El directorio: quiénes están al aire, en orden alfabético por apellido. */
export async function loadPublicDirectory(workspaceId: string): Promise<DirectoryEntry[]> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, PORTFOLIO_MODULE_KEY))) return [];

  const ahora = new Date();
  const [filas, vencidos] = await Promise.all([
    prisma.fotofficeMemberPortfolio.findMany({
      where: { workspaceId, memberPublished: true },
      select: {
        publicSlug: true,
        memberId: true,
        memberPublished: true,
        hiddenByAdminAt: true,
        adminForcePublish: true,
        member: { select: SELECT_MIEMBRO },
        coverPhoto: { select: { url: true, width: true, height: true } },
        _count: { select: { photos: true } },
      },
    }),
    cargosVencidosPorMiembro(workspaceId, ahora),
  ]);

  return filas
    .filter((f) =>
      estaAlAire({
        memberPublished: f.memberPublished,
        hiddenByAdminAt: f.hiddenByAdminAt,
        adminForcePublish: f.adminForcePublish,
        member: f.member,
        photoCount: f._count.photos,
        overdueCount: vencidos.get(f.memberId) ?? 0,
      }),
    )
    .map((f) => ({
      publicSlug: f.publicSlug,
      displayName: nombreVisible(f.member),
      businessName: f.member.businessName,
      specialties: f.member.specialties,
      coverUrl: f.coverPhoto?.url ?? null,
      coverWidth: f.coverPhoto?.width ?? null,
      coverHeight: f.coverPhoto?.height ?? null,
    }))
    // Alfabético por apellido, con las reglas del español: "Álvarez" antes que "Benítez".
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" }));
}

/**
 * La ficha de una persona, o `null`.
 *
 * `null` tanto si el slug no existe como si existe y no está al aire, y es el mismo 404 a
 * propósito: quien prueba direcciones no tiene que poder distinguir "no existe" de "existe y no
 * está publicado".
 */
export async function loadPublicPortfolio(params: {
  workspaceId: string;
  publicSlug: string;
}): Promise<PublicPortfolio | null> {
  if (!(await isModuleEnabledForWorkspace(params.workspaceId, PORTFOLIO_MODULE_KEY))) return null;

  const fila = await prisma.fotofficeMemberPortfolio.findFirst({
    where: { workspaceId: params.workspaceId, publicSlug: params.publicSlug },
    select: {
      publicSlug: true,
      memberId: true,
      memberPublished: true,
      hiddenByAdminAt: true,
      adminForcePublish: true,
      coverPhotoId: true,
      member: { select: SELECT_MIEMBRO },
      coverPhoto: { select: { url: true, width: true, height: true } },
      photos: { select: SELECT_FOTO, orderBy: { order: "asc" } },
    },
  });
  if (!fila) return null;

  const vencidos = await cargosVencidosPorMiembro(params.workspaceId, new Date());

  const alAire = estaAlAire({
    memberPublished: fila.memberPublished,
    hiddenByAdminAt: fila.hiddenByAdminAt,
    adminForcePublish: fila.adminForcePublish,
    member: fila.member,
    photoCount: fila.photos.length,
    overdueCount: vencidos.get(fila.memberId) ?? 0,
  });
  if (!alAire) return null;

  return {
    publicSlug: fila.publicSlug,
    displayName: nombreVisible(fila.member),
    businessName: fila.member.businessName,
    specialties: fila.member.specialties,
    bio: fila.member.bio,
    profilePhotoUrl: fila.member.profilePhotoUrl,
    links: {
      website: fila.member.website,
      instagram: fila.member.instagram,
      tiktok: fila.member.tiktok,
      facebook: fila.member.facebook,
      youtube: fila.member.youtube,
      linkedin: fila.member.linkedin,
    },
    coverUrl: fila.coverPhoto?.url ?? null,
    photos: fila.photos.map((f) => ({
      id: f.id,
      url: f.url,
      width: f.width,
      height: f.height,
      title: f.title,
      year: f.year,
    })),
  };
}
