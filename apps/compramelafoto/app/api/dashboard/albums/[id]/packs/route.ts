import { NextRequest, NextResponse } from "next/server";
import {
  AlbumPackAvailabilityPhase,
  AlbumPackType,
  Role,
} from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  availabilityPhaseOptions,
  packTypeOptions,
} from "@/lib/album-packs/album-pack-options";
import { isTemplateV2AssignableToUserPack } from "@/lib/dashboard/template-v2-for-album-pack-picker";
import { legacyTemplateListWhereForRole } from "@/lib/dashboard/legacy-template-list-where";
import { resolveTemplateV2IdOwnedByAlbumPhotographer } from "@/lib/template-v2/resolve-template-v2-for-album-pack";
import {
  loadCollaborativeEventPricingSnapshot,
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING,
} from "@/lib/events/collaborative-event-pricing-lock";
import {
  AlbumPackComponentsValidationError,
  assertAlbumPackPrintProductsActive,
  parseAlbumPackComponentsInput,
  replaceAlbumPackComponents,
  validateAlbumPackComponentsComposition,
} from "@/lib/album-packs/album-pack-components-persistence";
import {
  albumPackDashboardInclude,
  deriveAlbumPackTypeFromComponents,
  serializeAlbumPackForDashboardApi,
} from "@/lib/album-packs/album-pack-dashboard-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AlbumParams = { id: string } | Promise<{ id: string }>;

async function resolveAlbumId(params: AlbumParams): Promise<number | null> {
  const parsed = await params;
  const albumId = Number.parseInt(parsed.id, 10);
  return Number.isInteger(albumId) ? albumId : null;
}

async function findAlbumForUser(albumId: number, userId: number, role: Role) {
  return prisma.album.findFirst({
    where: role === Role.ADMIN ? { id: albumId } : { id: albumId, userId },
    select: { id: true, userId: true, eventId: true },
  });
}

const availabilityPhaseValues = new Set<AlbumPackAvailabilityPhase>(
  availabilityPhaseOptions.map((option) => option.value as AlbumPackAvailabilityPhase)
);
const packTypeValues = new Set<AlbumPackType>(
  packTypeOptions.map((option) => option.value as AlbumPackType)
);

export async function GET(
  _req: NextRequest,
  { params }: { params: AlbumParams }
) {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.ADMIN,
    ]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = await resolveAlbumId(params);
    if (albumId == null) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await findAlbumForUser(albumId, user.id, user.role);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const packs = await prisma.albumPack.findMany({
      where: { albumId },
      include: albumPackDashboardInclude,
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json({
      packs: packs.map((pack) => serializeAlbumPackForDashboardApi(pack)),
    });
  } catch (error) {
    console.error("album packs GET error:", error);
    return NextResponse.json({ error: "Error al listar packs" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: AlbumParams }
) {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.ADMIN,
    ]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = await resolveAlbumId(params);
    if (albumId == null) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await findAlbumForUser(albumId, user.id, user.role);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const body = await req.json();

    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }

    const price = Number(body?.price);
    if (!Number.isInteger(price) || price < 0) {
      return NextResponse.json({ error: "price debe ser un entero >= 0" }, { status: 400 });
    }

    const availabilityPhaseRaw = String(body?.availabilityPhase ?? "").trim();
    if (!availabilityPhaseRaw) {
      return NextResponse.json({ error: "availabilityPhase es requerido" }, { status: 400 });
    }
    if (!availabilityPhaseValues.has(availabilityPhaseRaw as AlbumPackAvailabilityPhase)) {
      return NextResponse.json({ error: "availabilityPhase inválido" }, { status: 400 });
    }
    const availabilityPhase = availabilityPhaseRaw as AlbumPackAvailabilityPhase;

    const packTypeRaw = String(body?.packType ?? "").trim();
    if (!packTypeRaw) {
      return NextResponse.json({ error: "packType es requerido" }, { status: 400 });
    }
    if (!packTypeValues.has(packTypeRaw as AlbumPackType)) {
      return NextResponse.json({ error: "packType inválido" }, { status: 400 });
    }
    let packType = packTypeRaw as AlbumPackType;

    let componentsInput = null as ReturnType<typeof parseAlbumPackComponentsInput>;
    try {
      componentsInput = parseAlbumPackComponentsInput(body?.components);
    } catch (err) {
      if (err instanceof AlbumPackComponentsValidationError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
      }
      throw err;
    }
    if (componentsInput) {
      try {
        validateAlbumPackComponentsComposition(componentsInput);
        await assertAlbumPackPrintProductsActive(prisma, componentsInput, album.userId);
        packType = deriveAlbumPackTypeFromComponents(componentsInput);
      } catch (err) {
        if (err instanceof AlbumPackComponentsValidationError) {
          return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
        }
        throw err;
      }
    }

    const collaborativeEventPricing = await loadCollaborativeEventPricingSnapshot(album.eventId);
    if (
      collaborativeEventPricing?.locksPhotographerDigitalPricing &&
      packType === AlbumPackType.DIGITAL
    ) {
      return NextResponse.json(
        { error: MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING },
        { status: 403 }
      );
    }

    const requiresSelection = Boolean(body?.requiresSelection);
    const requiresDesign = Boolean(body?.requiresDesign);

    const description =
      body?.description === undefined || body?.description === null
        ? null
        : String(body.description).trim() || null;

    const includedPhotoCountRaw = body?.includedPhotoCount;
    const includedPhotoCount =
      includedPhotoCountRaw === undefined || includedPhotoCountRaw === null
        ? null
        : Number(includedPhotoCountRaw);
    if (
      includedPhotoCount !== null &&
      (!Number.isInteger(includedPhotoCount) || includedPhotoCount < 1)
    ) {
      return NextResponse.json(
        { error: "includedPhotoCount debe ser un entero >= 1 o null" },
        { status: 400 }
      );
    }
    if (requiresSelection && includedPhotoCount == null) {
      return NextResponse.json(
        { error: "includedPhotoCount es obligatorio cuando requiresSelection = true" },
        { status: 400 }
      );
    }
    if (requiresDesign && !requiresSelection) {
      return NextResponse.json(
        { error: "requiresDesign = true requiere requiresSelection = true" },
        { status: 400 }
      );
    }

    const templateIdRaw = body?.templateId;
    const templateId =
      templateIdRaw === undefined || templateIdRaw === null ? null : Number(templateIdRaw);
    if (templateId !== null && !Number.isInteger(templateId)) {
      return NextResponse.json({ error: "templateId inválido" }, { status: 400 });
    }

    const templateV2IdRaw = body?.templateV2Id;
    const templateV2IdTrimmed =
      templateV2IdRaw === undefined || templateV2IdRaw === null
        ? ""
        : String(templateV2IdRaw).trim();
    const templateV2Id = templateV2IdTrimmed === "" ? null : templateV2IdTrimmed;

    if (templateId !== null && templateV2Id) {
      return NextResponse.json(
        { error: "Usá solo plantilla clásica o solo plantilla del diseñador, no ambas." },
        { status: 400 }
      );
    }

    const albumOwnerUserId = album.userId;
    const assignableUserId = user.role === Role.ADMIN ? albumOwnerUserId : user.id;

    if (templateV2Id) {
      const ok = await isTemplateV2AssignableToUserPack({ templateV2Id, userId: assignableUserId });
      if (!ok) {
        return NextResponse.json({ error: "Plantilla no disponible o no autorizada." }, { status: 400 });
      }
    }

    let resolvedTemplateV2Id = templateV2Id;
    if (resolvedTemplateV2Id) {
      try {
        resolvedTemplateV2Id = await resolveTemplateV2IdOwnedByAlbumPhotographer({
          templateV2Id: resolvedTemplateV2Id,
          albumOwnerUserId,
        });
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "template_v2_fork_forbidden" || code === "template_v2_not_found") {
          return NextResponse.json({ error: "Plantilla no disponible o no autorizada." }, { status: 400 });
        }
        throw err;
      }
    }

    if (templateId !== null) {
      const templateVisibility = legacyTemplateListWhereForRole(user.role);
      const template = await prisma.template.findFirst({
        where: { id: templateId, albumId, ...(templateVisibility ?? {}) },
        select: { id: true },
      });
      if (!template) {
        return NextResponse.json(
          { error: "La plantilla no pertenece a este álbum" },
          { status: 400 }
        );
      }
    }
    if (requiresDesign && templateId == null && resolvedTemplateV2Id == null) {
      return NextResponse.json(
        { error: "Este pack requiere diseño: elegí una plantilla (clásica o del diseñador)." },
        { status: 400 }
      );
    }

    const pack = await prisma.$transaction(async (tx) => {
      const created = await tx.albumPack.create({
        data: {
          albumId,
          name,
          description,
          price,
          includedPhotoCount,
          requiresSelection,
          requiresDesign,
          templateId,
          templateV2Id: resolvedTemplateV2Id,
          availabilityPhase,
          packType,
          isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
        },
      });
      if (componentsInput) {
        await replaceAlbumPackComponents(tx, created.id, componentsInput);
      }
      const full = await tx.albumPack.findUniqueOrThrow({
        where: { id: created.id },
        include: albumPackDashboardInclude,
      });
      return full;
    });

    return NextResponse.json(
      { pack: serializeAlbumPackForDashboardApi(pack) },
      { status: 201 }
    );
  } catch (error) {
    console.error("album packs POST error:", error);
    return NextResponse.json({ error: "Error al crear pack" }, { status: 500 });
  }
}
