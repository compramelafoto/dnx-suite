import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PORTFOLIO_MODULE_KEY } from "./constants";
import { portfolioVisibility } from "./visibility";
import { normalizeArgentineWhatsappNumber } from "./whatsapp";
import type { PortfolioVideo, VideoPlatform } from "./videos";
import type { StudioLocation } from "@/lib/membership/studio-location";

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
  /** Logo del estudio, al lado del nombre en la tarjeta. */
  businessLogoUrl: string | null;
  specialties: string[];
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  /** El `alt` de la destacada. El directorio es la página que Google más recorre. */
  coverAltText: string | null;
};

export type PublicPortfolioPhoto = {
  id: string;
  url: string;
  width: number;
  height: number;
  title: string | null;
  year: number | null;
  /** Lo que va en el `alt`: lo lee Google y lo escucha un lector de pantalla. */
  altText: string | null;
};

export type PublicPortfolioVideo = PortfolioVideo & {
  id: string;
  title: string | null;
};

export type PublicPortfolio = {
  publicSlug: string;
  displayName: string;
  businessName: string | null;
  /** Logo del estudio. Sólo en la ficha: el directorio muestra obra, no logos. */
  businessLogoUrl: string | null;
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
  /**
   * Dónde atiende. Es el domicilio del ESTUDIO, cargado a propósito para publicarse — nunca el
   * particular del socio, que vive en otros campos y no sale de acá.
   */
  studio: StudioLocation;
  /** Si tiene un teléfono que se pudo normalizar. El número NO viaja: ver `SELECT_MIEMBRO`. */
  canContactByWhatsapp: boolean;
  photos: PublicPortfolioPhoto[];
  /** Videos que el socio pegó, en su orden. */
  videos: PublicPortfolioVideo[];
  /** Posteos que el socio eligió mostrar. Vacío si apagó la franja o no cargó ninguno. */
  instagramPosts: string[];
};

/** Lo único que se lee del socio. Todo lo demás queda del lado privado. */
const SELECT_MIEMBRO = {
  firstName: true,
  lastName: true,
  studioStreet: true,
  studioCity: true,
  studioProvince: true,
  studioPostalCode: true,
  studioLat: true,
  studioLng: true,
  status: true,
  directoryOptIn: true,
  businessName: true,
  businessLogoUrl: true,
  specialties: true,
  bio: true,
  website: true,
  instagram: true,
  tiktok: true,
  facebook: true,
  youtube: true,
  linkedin: true,
  profilePhotoUrl: true,
  /*
   * Se lee para saber si se puede ofrecer WhatsApp, pero **nunca se devuelve en la ficha**: el
   * número no entra al HTML de la página pública. El botón apunta a una ruta nuestra que redirige,
   * así nadie puede cosechar los teléfonos de todo el padrón del código fuente del directorio.
   */
  phone: true,
} as const;

const SELECT_VIDEO = {
  id: true,
  platform: true,
  url: true,
  videoId: true,
  title: true,
} as const;

const SELECT_FOTO = {
  id: true,
  url: true,
  width: true,
  height: true,
  order: true,
  title: true,
  year: true,
  altText: true,
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
        coverPhoto: { select: { url: true, width: true, height: true, altText: true } },
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
      businessLogoUrl: f.member.businessLogoUrl,
      specialties: f.member.specialties,
      coverUrl: f.coverPhoto?.url ?? null,
      coverWidth: f.coverPhoto?.width ?? null,
      coverHeight: f.coverPhoto?.height ?? null,
      coverAltText: f.coverPhoto?.altText ?? null,
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
      instagramEnabled: true,
      instagramPostUrls: true,
      member: { select: SELECT_MIEMBRO },
      coverPhoto: { select: { url: true, width: true, height: true } },
      photos: { select: SELECT_FOTO, orderBy: { order: "asc" } },
      videos: { select: SELECT_VIDEO, orderBy: { order: "asc" } },
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

  return aPublicPortfolio(fila);
}

/** El armado de la ficha, en un solo lugar: lo comparten la página pública y la vista previa. */
type FilaDeFicha = {
  publicSlug: string;
  member: Record<string, unknown> & FilaMiembro;
  coverPhoto: { url: string } | null;
  instagramEnabled: boolean;
  instagramPostUrls: string[];
  photos: { id: string; url: string; width: number; height: number; title: string | null; year: number | null; altText: string | null }[];
  videos?: { id: string; platform: string; url: string; videoId: string | null; title: string | null }[];
};

function aPublicPortfolio(fila: FilaDeFicha): PublicPortfolio {
  const m = fila.member as FilaMiembro & {
    businessName: string | null;
    businessLogoUrl: string | null;
    specialties: string[];
    bio: string | null;
    profilePhotoUrl: string | null;
    website: string | null;
    instagram: string | null;
    tiktok: string | null;
    facebook: string | null;
    youtube: string | null;
    linkedin: string | null;
    phone: string | null;
    studioStreet: string | null;
    studioCity: string | null;
    studioProvince: string | null;
    studioPostalCode: string | null;
    studioLat: number | null;
    studioLng: number | null;
  };

  return {
    publicSlug: fila.publicSlug,
    displayName: nombreVisible(fila.member),
    businessName: m.businessName,
    businessLogoUrl: m.businessLogoUrl,
    specialties: m.specialties,
    bio: m.bio,
    profilePhotoUrl: m.profilePhotoUrl,
    links: {
      website: m.website,
      instagram: m.instagram,
      tiktok: m.tiktok,
      facebook: m.facebook,
      youtube: m.youtube,
      linkedin: m.linkedin,
    },
    coverUrl: fila.coverPhoto?.url ?? null,
    studio: {
      street: m.studioStreet,
      city: m.studioCity,
      province: m.studioProvince,
      postalCode: m.studioPostalCode,
      lat: m.studioLat,
      lng: m.studioLng,
    },
    canContactByWhatsapp: normalizeArgentineWhatsappNumber(m.phone) !== null,
    // El interruptor manda: apagarlo oculta la franja sin que el socio pierda los enlaces que cargó.
    instagramPosts: fila.instagramEnabled ? fila.instagramPostUrls : [],
    videos: (fila.videos ?? []).map((v) => ({
      id: v.id,
      // Lo guardado es texto; el tipo cerrado vive en `videos.ts`, no en la base.
      platform: v.platform as VideoPlatform,
      url: v.url,
      videoId: v.videoId,
      title: v.title,
    })),
    photos: fila.photos.map((f) => ({
      id: f.id,
      url: f.url,
      width: f.width,
      height: f.height,
      title: f.title,
      year: f.year,
      altText: f.altText,
    })),
  };
}


/**
 * La ficha de una persona **tal como se vería**, aunque todavía no esté públicada.
 *
 * La usa la vista previa del portal, y por eso **saltea las siete condiciones a propósito**: el
 * sentido de una vista previa es ver cómo queda antes de prender el interruptor.
 *
 * Es seguro porque quien llama ya resolvió de quién es la ficha desde la sesión: acá no hay ningún
 * parámetro con el que pedir la de otro. No tiene ruta pública y nada la expone.
 */
export async function loadPortfolioPreview(params: {
  workspaceId: string;
  memberId: string;
}): Promise<PublicPortfolio | null> {
  const fila = await prisma.fotofficeMemberPortfolio.findFirst({
    where: { workspaceId: params.workspaceId, memberId: params.memberId },
    select: {
      publicSlug: true,
      instagramEnabled: true,
      instagramPostUrls: true,
      member: { select: SELECT_MIEMBRO },
      coverPhoto: { select: { url: true } },
      photos: { select: SELECT_FOTO, orderBy: { order: "asc" } },
      videos: { select: SELECT_VIDEO, orderBy: { order: "asc" } },
    },
  });
  if (!fila) return null;

  return aPublicPortfolio(fila);
}


/**
 * Sólo el teléfono y el nombre de quien SÍ está al aire.
 *
 * Existe aparte de `loadPublicPortfolio` porque el teléfono no entra en la ficha: esto lo usa la
 * ruta de contacto, en el servidor, al momento del clic. Aplica las mismas siete condiciones.
 */
export async function loadPublicPortfolioContact(params: {
  workspaceId: string;
  publicSlug: string;
}): Promise<{ phone: string; displayName: string } | null> {
  if (!(await isModuleEnabledForWorkspace(params.workspaceId, PORTFOLIO_MODULE_KEY))) return null;

  const fila = await prisma.fotofficeMemberPortfolio.findFirst({
    where: { workspaceId: params.workspaceId, publicSlug: params.publicSlug },
    select: {
      memberId: true,
      memberPublished: true,
      hiddenByAdminAt: true,
      adminForcePublish: true,
      member: { select: SELECT_MIEMBRO },
      _count: { select: { photos: true } },
    },
  });
  if (!fila?.member.phone) return null;

  const vencidos = await cargosVencidosPorMiembro(params.workspaceId, new Date());
  const alAire = estaAlAire({
    memberPublished: fila.memberPublished,
    hiddenByAdminAt: fila.hiddenByAdminAt,
    adminForcePublish: fila.adminForcePublish,
    member: fila.member,
    photoCount: fila._count.photos,
    overdueCount: vencidos.get(fila.memberId) ?? 0,
  });
  if (!alAire) return null;

  return { phone: fila.member.phone, displayName: nombreVisible(fila.member) };
}
