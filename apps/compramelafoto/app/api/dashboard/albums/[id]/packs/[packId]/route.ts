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

type RouteParams =
  | { id: string; packId: string }
  | Promise<{ id: string; packId: string }>;

async function parseIds(params: RouteParams): Promise<{ albumId: number | null; packId: string | null }> {
  const parsed = await params;
  const albumId = Number.parseInt(parsed.id, 10);
  const packId = String(parsed.packId ?? "").trim();
  return {
    albumId: Number.isInteger(albumId) ? albumId : null,
    packId: packId || null,
  };
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: RouteParams }
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

    const { albumId, packId } = await parseIds(params);
    if (albumId == null || !packId) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const album = await findAlbumForUser(albumId, user.id, user.role);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const albumOwnerUserId = album.userId;
    const assignableUserId = user.role === Role.ADMIN ? albumOwnerUserId : user.id;

    const existing = await prisma.albumPack.findFirst({
      where: { id: packId, albumId },
      select: {
        id: true,
        includedPhotoCount: true,
        requiresSelection: true,
        requiresDesign: true,
        templateId: true,
        templateV2Id: true,
        packType: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const templateLegacyVisibility = legacyTemplateListWhereForRole(user.role);

    const data: {
      name?: string;
      description?: string | null;
      coverImageUrl?: string | null;
      price?: number;
      includedPhotoCount?: number | null;
      requiresSelection?: boolean;
      requiresDesign?: boolean;
      templateId?: number | null;
      templateV2Id?: string | null;
      availabilityPhase?: AlbumPackAvailabilityPhase;
      packType?: AlbumPackType;
      isActive?: boolean;
    } = {};

    const touchTemplateLegacy = "templateId" in body;
    const touchTemplateV2 = "templateV2Id" in body;
    if (touchTemplateLegacy && touchTemplateV2) {
      const rawV2 =
        body.templateV2Id === undefined || body.templateV2Id === null
          ? ""
          : String(body.templateV2Id).trim();
      const legacyNum =
        body.templateId === undefined || body.templateId === null
          ? null
          : Number(body.templateId);
      const legacyOk = legacyNum !== null && Number.isInteger(legacyNum);
      if (legacyOk && rawV2 !== "") {
        return NextResponse.json(
          { error: "Usá solo plantilla clásica o solo plantilla del diseñador, no ambas." },
          { status: 400 }
        );
      }
    }

    if ("name" in body) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ error: "name no puede estar vacío" }, { status: 400 });
      }
      data.name = name;
    }

    if ("description" in body) {
      data.description =
        body.description === undefined || body.description === null
          ? null
          : String(body.description).trim() || null;
    }

    if ("coverImageUrl" in body) {
      if (body.coverImageUrl === null) {
        data.coverImageUrl = null;
      } else {
        const coverImageUrl = String(body.coverImageUrl ?? "").trim();
        data.coverImageUrl = coverImageUrl || null;
      }
    }

    if ("price" in body) {
      const price = Number(body.price);
      if (!Number.isInteger(price) || price < 0) {
        return NextResponse.json({ error: "price debe ser un entero >= 0" }, { status: 400 });
      }
      data.price = price;
    }

    if ("includedPhotoCount" in body) {
      if (body.includedPhotoCount === null) {
        data.includedPhotoCount = null;
      } else {
        const includedPhotoCount = Number(body.includedPhotoCount);
        if (!Number.isInteger(includedPhotoCount) || includedPhotoCount < 1) {
          return NextResponse.json(
            { error: "includedPhotoCount debe ser un entero >= 1 o null" },
            { status: 400 }
          );
        }
        data.includedPhotoCount = includedPhotoCount;
      }
    }

    if ("requiresSelection" in body) {
      data.requiresSelection = Boolean(body.requiresSelection);
    }

    if ("requiresDesign" in body) {
      data.requiresDesign = Boolean(body.requiresDesign);
    }

    if ("templateId" in body) {
      if (body.templateId === null) {
        data.templateId = null;
      } else {
        const templateId = Number(body.templateId);
        if (!Number.isInteger(templateId)) {
          return NextResponse.json({ error: "templateId inválido" }, { status: 400 });
        }
        const template = await prisma.template.findFirst({
          where: { id: templateId, albumId, ...(templateLegacyVisibility ?? {}) },
          select: { id: true },
        });
        if (!template) {
          return NextResponse.json(
            { error: "La plantilla no pertenece a este álbum" },
            { status: 400 }
          );
        }
        data.templateId = templateId;
        data.templateV2Id = null;
      }
    }

    if ("templateV2Id" in body) {
      if (body.templateV2Id === null || body.templateV2Id === undefined) {
        data.templateV2Id = null;
      } else {
        const trimmed = String(body.templateV2Id).trim();
        if (trimmed === "") {
          data.templateV2Id = null;
        } else {
          const ok = await isTemplateV2AssignableToUserPack({
            templateV2Id: trimmed,
            userId: assignableUserId,
          });
          if (!ok) {
            return NextResponse.json({ error: "Plantilla no disponible o no autorizada." }, { status: 400 });
          }
          let resolved = trimmed;
          try {
            resolved =
              (await resolveTemplateV2IdOwnedByAlbumPhotographer({
                templateV2Id: trimmed,
                albumOwnerUserId,
              })) ?? trimmed;
          } catch (err) {
            const code = err instanceof Error ? err.message : "";
            if (code === "template_v2_fork_forbidden" || code === "template_v2_not_found") {
              return NextResponse.json({ error: "Plantilla no disponible o no autorizada." }, { status: 400 });
            }
            throw err;
          }
          data.templateV2Id = resolved;
          data.templateId = null;
        }
      }
    }

    if ("availabilityPhase" in body) {
      const availabilityPhaseRaw = String(body.availabilityPhase ?? "").trim();
      if (!availabilityPhaseRaw) {
        return NextResponse.json(
          { error: "availabilityPhase no puede estar vacío" },
          { status: 400 }
        );
      }
      if (!availabilityPhaseValues.has(availabilityPhaseRaw as AlbumPackAvailabilityPhase)) {
        return NextResponse.json({ error: "availabilityPhase inválido" }, { status: 400 });
      }
      data.availabilityPhase = availabilityPhaseRaw as AlbumPackAvailabilityPhase;
    }

    if ("packType" in body) {
      const packTypeRaw = String(body.packType ?? "").trim();
      if (!packTypeRaw) {
        return NextResponse.json({ error: "packType no puede estar vacío" }, { status: 400 });
      }
      if (!packTypeValues.has(packTypeRaw as AlbumPackType)) {
        return NextResponse.json({ error: "packType inválido" }, { status: 400 });
      }
      data.packType = packTypeRaw as AlbumPackType;
    }

    if ("isActive" in body) {
      data.isActive = Boolean(body.isActive);
    }

    const collaborativeEventPricing = await loadCollaborativeEventPricingSnapshot(album.eventId);
    const touchesDigitalRule =
      existing.packType === AlbumPackType.DIGITAL ||
      (data.packType !== undefined && data.packType === AlbumPackType.DIGITAL);
    if (
      collaborativeEventPricing?.locksPhotographerDigitalPricing &&
      touchesDigitalRule
    ) {
      return NextResponse.json(
        { error: MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING },
        { status: 403 }
      );
    }

    let componentsInput: ReturnType<typeof parseAlbumPackComponentsInput> = null;
    if ("components" in body) {
      try {
        componentsInput = parseAlbumPackComponentsInput(body.components);
        if (componentsInput) {
          validateAlbumPackComponentsComposition(componentsInput);
          await assertAlbumPackPrintProductsActive(prisma, componentsInput, album.userId);
          data.packType = deriveAlbumPackTypeFromComponents(componentsInput);
        }
      } catch (err) {
        if (err instanceof AlbumPackComponentsValidationError) {
          return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
        }
        throw err;
      }
    }

    if (Object.keys(data).length === 0 && !("components" in body)) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const effectiveRequiresSelection = data.requiresSelection ?? existing.requiresSelection;
    const effectiveRequiresDesign = data.requiresDesign ?? existing.requiresDesign;
    const effectiveIncludedPhotoCount =
      data.includedPhotoCount !== undefined
        ? data.includedPhotoCount
        : existing.includedPhotoCount;
    const effectiveTemplateId =
      data.templateId !== undefined ? data.templateId : existing.templateId;
    const effectiveTemplateV2Id =
      data.templateV2Id !== undefined ? data.templateV2Id : existing.templateV2Id;

    if (effectiveRequiresSelection && effectiveIncludedPhotoCount == null) {
      return NextResponse.json(
        { error: "includedPhotoCount es obligatorio cuando requiresSelection = true" },
        { status: 400 }
      );
    }
    if (effectiveRequiresSelection && Number(effectiveIncludedPhotoCount) <= 0) {
      return NextResponse.json(
        { error: "includedPhotoCount debe ser > 0 cuando requiresSelection = true" },
        { status: 400 }
      );
    }
    if (effectiveRequiresDesign && !effectiveRequiresSelection) {
      return NextResponse.json(
        { error: "requiresDesign = true requiere requiresSelection = true" },
        { status: 400 }
      );
    }
    if (
      effectiveRequiresDesign &&
      effectiveTemplateId == null &&
      effectiveTemplateV2Id == null
    ) {
      return NextResponse.json(
        {
          error: "Este pack requiere diseño: elegí una plantilla (clásica o del diseñador).",
        },
        { status: 400 }
      );
    }
    if (effectiveTemplateId != null && effectiveTemplateV2Id) {
      return NextResponse.json(
        { error: "No podés asignar plantilla clásica y plantilla del diseñador a la vez." },
        { status: 400 }
      );
    }
    if (effectiveTemplateId != null) {
      const template = await prisma.template.findFirst({
        where: { id: effectiveTemplateId, albumId, ...(templateLegacyVisibility ?? {}) },
        select: { id: true },
      });
      if (!template) {
        return NextResponse.json(
          { error: "La plantilla no pertenece a este álbum" },
          { status: 400 }
        );
      }
    }
    if (effectiveTemplateV2Id) {
      const ok = await isTemplateV2AssignableToUserPack({
        templateV2Id: effectiveTemplateV2Id,
        userId: assignableUserId,
      });
      if (!ok) {
        return NextResponse.json({ error: "Plantilla no disponible o no autorizada." }, { status: 400 });
      }
    }

    const pack = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.albumPack.update({
          where: { id: packId },
          data,
        });
      }
      if ("components" in body && componentsInput) {
        await replaceAlbumPackComponents(tx, packId, componentsInput);
      }
      return tx.albumPack.findUniqueOrThrow({
        where: { id: packId },
        include: albumPackDashboardInclude,
      });
    });

    return NextResponse.json({ pack: serializeAlbumPackForDashboardApi(pack) });
  } catch (error) {
    console.error("album packs PATCH error:", error);
    return NextResponse.json({ error: "Error al actualizar pack" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: RouteParams }
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

    const { albumId, packId } = await parseIds(params);
    if (albumId == null || !packId) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const album = await findAlbumForUser(albumId, user.id, user.role);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const target = await prisma.albumPack.findFirst({
      where: { id: packId, albumId },
      select: { id: true, packType: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    }

    const collaborativeEventPricing = await loadCollaborativeEventPricingSnapshot(album.eventId);
    if (
      collaborativeEventPricing?.locksPhotographerDigitalPricing &&
      target.packType === AlbumPackType.DIGITAL
    ) {
      return NextResponse.json(
        { error: MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING },
        { status: 403 }
      );
    }

    await prisma.albumPack.delete({ where: { id: packId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("album packs DELETE error:", error);
    return NextResponse.json({ error: "Error al eliminar pack" }, { status: 500 });
  }
}
