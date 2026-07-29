import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import {
  deletePackDefinition,
  updatePackDefinition,
  type UpdatePackDefinitionInput,
} from "@/lib/preventa-canjeable/pack-service";
import {
  findAlbumOwnedByUser,
  parseOptionalIsoDate,
} from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  PackActivationError,
  assertPackHasBenefitsForActivation,
} from "@/lib/preventa-canjeable/pack-activation";
import { parsePackAvailabilityPhaseFromRequest } from "@/lib/preventa-canjeable/pack-availability-phase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string; packId: string }>;
};

async function parseIds(params: RouteParams["params"]) {
  const p = await params;
  const albumId = parseInt(p.id, 10);
  const packId = parseInt(p.packId, 10);
  if (!Number.isInteger(albumId) || !Number.isInteger(packId)) {
    return { albumId: null as number | null, packId: null as number | null };
  }
  return { albumId, packId };
}

/**
 * PATCH /api/dashboard/albums/[id]/preventa-packs/[packId]
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId, packId } = await parseIds(params);
    if (albumId == null || packId == null) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const data: UpdatePackDefinitionInput = {};

    if ("name" in body) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ error: "name no puede estar vacío" }, { status: 400 });
      }
      data.name = name;
    }

    if ("description" in body) {
      data.description =
        body.description === null || body.description === undefined
          ? null
          : String(body.description).trim() || null;
    }

    if ("priceClientArs" in body) {
      const priceRaw = Number(body.priceClientArs);
      if (!Number.isFinite(priceRaw) || priceRaw < 0) {
        return NextResponse.json(
          { error: "priceClientArs debe ser un número >= 0" },
          { status: 400 }
        );
      }
      data.priceClientArs = priceRaw;
    }

    if ("isActive" in body) {
      const nextActive = Boolean(body.isActive);
      if (nextActive) {
        try {
          await assertPackHasBenefitsForActivation(packId);
        } catch (e) {
          if (e instanceof PackActivationError) {
            return NextResponse.json(
              { error: e.message, code: "pack_empty" },
              { status: 400 }
            );
          }
          throw e;
        }
      }
      data.isActive = nextActive;
    }

    if ("availabilityPhase" in body) {
      const phaseResult = parsePackAvailabilityPhaseFromRequest(
        body.availabilityPhase,
        album.mode
      );
      if ("error" in phaseResult) {
        return NextResponse.json({ error: phaseResult.error }, { status: 400 });
      }
      data.availabilityPhase = phaseResult.phase;
    }

    if ("displayOrder" in body) {
      const d = Number(body.displayOrder);
      if (!Number.isFinite(d)) {
        return NextResponse.json({ error: "displayOrder inválido" }, { status: 400 });
      }
      data.displayOrder = Math.trunc(d);
    }

    if ("currency" in body) {
      const c = String(body.currency ?? "").trim();
      if (!c) {
        return NextResponse.json({ error: "currency no puede estar vacío" }, { status: 400 });
      }
      data.currency = c.slice(0, 16);
    }

    try {
      if ("validFrom" in body) {
        data.validFrom = parseOptionalIsoDate(body.validFrom);
      }
      if ("validUntil" in body) {
        data.validUntil = parseOptionalIsoDate(body.validUntil);
      }
      if ("redemptionDeadlineAt" in body) {
        data.redemptionDeadlineAt = parseOptionalIsoDate(body.redemptionDeadlineAt);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fecha inválida";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if ("coverImageUrl" in body) {
      if (body.coverImageUrl !== null) {
        return NextResponse.json(
          { error: "Para agregar imagen usá la subida del formulario; solo se permite null para quitarla." },
          { status: 400 }
        );
      }
      data.coverImageUrl = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    try {
      const pack = await updatePackDefinition(packId, albumId, data);
      return NextResponse.json({ pack });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Pack no encontrado")) {
        return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
      }
      throw e;
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al actualizar";
    console.error("preventa-packs PATCH:", e);
    return NextResponse.json(
      { error: "Error al actualizar pack", detail: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/albums/[id]/preventa-packs/[packId]
 * Los BenefitDefinition se eliminan en cascada (onDelete: Cascade).
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId, packId } = await parseIds(params);
    if (albumId == null || packId == null) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    try {
      await deletePackDefinition(packId, albumId);
      return NextResponse.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Pack no encontrado")) {
        return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
      }
      throw e;
    }
  } catch (e) {
    console.error("preventa-packs DELETE:", e);
    return NextResponse.json({ error: "Error al eliminar pack" }, { status: 500 });
  }
}
