import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadMemberBalance } from "@/lib/membership/balance";
import { PORTFOLIO_MODULE_KEY } from "./constants";
import { derivePortfolioSlug } from "./slug";
import { portfolioVisibility, type PortfolioVisibility } from "./visibility";

/**
 * Lo que el portal del socio sabe sobre su propio portfolio.
 *
 * Todo lo público sale de `public-queries.ts`. Acá vive solamente la mirada de la persona sobre lo
 * suyo, y ningún parámetro llega del navegador: el caller resuelve la ficha desde la sesión.
 */

export type PortfolioPhotoView = {
  id: string;
  url: string;
  width: number;
  height: number;
  order: number;
  title: string | null;
  year: number | null;
  altText: string | null;
  /** Calculado acá para que la pantalla no tenga que comparar contra `coverPhotoId`. */
  isCover: boolean;
};

export type PortfolioView = {
  /** `null` mientras la persona no haya entrado nunca a armarlo. */
  id: string | null;
  publicSlug: string | null;
  memberPublished: boolean;
  photos: PortfolioPhotoView[];
  visibility: PortfolioVisibility;
  /** Si la ficha muestra la franja de posteos de Instagram. */
  instagramEnabled: boolean;
  /** Los enlaces cargados. Se conservan aunque la franja esté apagada. */
  instagramPostUrls: string[];
  /** Las direcciones de los videos, en orden, como las pegó el socio. */
  videoUrls: string[];
};

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

/**
 * El portfolio de una persona, creándolo si es la primera vez que entra.
 *
 * No se le crea un portfolio vacío a todo el padrón por adelantado: la fila nace cuando alguien
 * abre la pantalla, y así "tener portfolio" significa algo.
 */
export async function ensurePortfolio(params: {
  workspaceId: string;
  memberId: string;
  firstName: string;
  lastName: string;
}): Promise<{ id: string; publicSlug: string }> {
  const existente = await prisma.fotofficeMemberPortfolio.findUnique({
    where: { memberId: params.memberId },
    select: { id: true, publicSlug: true },
  });
  if (existente) return existente;

  try {
    return await crearConSlugLibre(params);
  } catch (error) {
    /*
     * Dos pestañas de la misma persona pueden llegar acá a la vez, derivar el mismo slug y chocar
     * contra `@@unique([workspaceId, publicSlug])`. Un reintento alcanza: el segundo ya lee el
     * slug que escribió el primero y deriva el siguiente.
     */
    if (!esChoqueDeUnicidad(error)) throw error;
    return crearConSlugLibre(params);
  }
}

async function crearConSlugLibre(params: {
  workspaceId: string;
  memberId: string;
  firstName: string;
  lastName: string;
}): Promise<{ id: string; publicSlug: string }> {
  const tomados = await prisma.fotofficeMemberPortfolio.findMany({
    where: { workspaceId: params.workspaceId },
    select: { publicSlug: true },
  });

  const publicSlug = derivePortfolioSlug({
    firstName: params.firstName,
    lastName: params.lastName,
    taken: new Set(tomados.map((t) => t.publicSlug)),
  });

  return prisma.fotofficeMemberPortfolio.create({
    data: { workspaceId: params.workspaceId, memberId: params.memberId, publicSlug },
    select: { id: true, publicSlug: true },
  });
}

function esChoqueDeUnicidad(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * El portfolio de una persona con su estado de publicación ya resuelto.
 *
 * Junta los siete hechos y los pasa por `portfolioVisibility`, la misma función que usan las
 * páginas públicas. El portal no reimplementa la regla: la consulta.
 */
export async function loadPortfolioForMember(params: {
  workspaceId: string;
  memberId: string;
}): Promise<PortfolioView> {
  const [moduleEnabled, ficha, fila, balance] = await Promise.all([
    isModuleEnabledForWorkspace(params.workspaceId, PORTFOLIO_MODULE_KEY),
    // El workspace entra en el where aunque el id de socio ya sea único: una consulta que no
    // menciona el workspace es una consulta que un día lo cruza.
    prisma.member.findFirst({
      where: { id: params.memberId, workspaceId: params.workspaceId },
      select: { status: true, directoryOptIn: true },
    }),
    prisma.fotofficeMemberPortfolio.findUnique({
      where: { memberId: params.memberId },
      select: {
        id: true,
        publicSlug: true,
        memberPublished: true,
        coverPhotoId: true,
        hiddenByAdminAt: true,
        adminForcePublish: true,
        instagramEnabled: true,
        instagramPostUrls: true,
        photos: { select: SELECT_FOTO, orderBy: { order: "asc" } },
        videos: { select: { url: true }, orderBy: { order: "asc" } },
      },
    }),
    loadMemberBalance(params.memberId),
  ]);

  const photos: PortfolioPhotoView[] = (fila?.photos ?? []).map((f) => ({
    ...f,
    isCover: f.id === fila?.coverPhotoId,
  }));

  const visibility = portfolioVisibility({
    moduleEnabled,
    hiddenByAdminAt: fila?.hiddenByAdminAt ?? null,
    memberStatus: (ficha?.status ?? "INACTIVE") as "ACTIVE" | "SUSPENDED" | "INACTIVE",
    directoryOptIn: ficha?.directoryOptIn ?? false,
    photoCount: photos.length,
    memberPublished: fila?.memberPublished ?? false,
    overdueCount: balance.overdueCount,
    adminForcePublish: fila?.adminForcePublish ?? false,
  });

  return {
    id: fila?.id ?? null,
    publicSlug: fila?.publicSlug ?? null,
    memberPublished: fila?.memberPublished ?? false,
    photos,
    visibility,
    instagramEnabled: fila?.instagramEnabled ?? false,
    instagramPostUrls: fila?.instagramPostUrls ?? [],
    videoUrls: (fila?.videos ?? []).map((v) => v.url),
  };
}
