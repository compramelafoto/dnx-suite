import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { EntryError, listContestEntriesForOrganizer } from "../../../../../../../lib/fotorank/entries";
import { getContestEntryStorage } from "../../../../../../../lib/fotorank/storage/private-local-storage";
import { prisma } from "@repo/db";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

/**
 * Preview controlado (thumbnail o jury preview). Nunca el ORIGINAL.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;

  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: entryId, contestId },
    include: {
      assets: {
        where: { isActive: true, kind: { in: ["THUMBNAIL", "JURY_PREVIEW"] } },
      },
    },
  });
  if (!entry) {
    return NextResponse.json({ error: { code: "ENTRY_NOT_FOUND", message: "Obra no encontrada." } }, { status: 404 });
  }

  const isOwner = entry.authorUserId === user.id;
  if (!isOwner) {
    try {
      await listContestEntriesForOrganizer({ contestId, organizerUserId: user.id });
    } catch (err) {
      if (err instanceof EntryError) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
      }
      throw err;
    }
  }

  const thumb = entry.assets.find((a) => a.kind === "THUMBNAIL") ?? entry.assets.find((a) => a.kind === "JURY_PREVIEW");
  if (!thumb) {
    return NextResponse.json({ error: { code: "PREVIEW_MISSING", message: "Sin preview disponible." } }, { status: 404 });
  }

  const storage = getContestEntryStorage();
  const url = await storage.getSignedUrl(thumb.storageKey, "read", 600);

  return NextResponse.json({
    ok: true,
    entryId: entry.id,
    kind: thumb.kind,
    previewUrl: url,
    // Jurado futuro: solo código anónimo + categoría; aquí no se expone identidad del autor.
    entryNumber: entry.entryNumber,
    omitIdentity: true,
  });
}
