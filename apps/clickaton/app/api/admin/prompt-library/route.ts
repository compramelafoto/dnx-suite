import { NextRequest, NextResponse } from "next/server";
import {
  listItems,
  listThemes,
  type PhotoPromptDifficulty,
  type PhotoPromptInspirationType,
} from "@repo/photo-prompt-library";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/prompt-library — lista APPROVED para el picker de consignas.
 */
export async function GET(req: NextRequest) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!hasClickatonAdminAccess({ email: user.email, globalRole: user.globalRole })) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const text = sp.get("text")?.trim() || undefined;
  const themeId = sp.get("themeId")?.trim() || undefined;
  const difficulty = (sp.get("difficulty")?.trim() || undefined) as
    | PhotoPromptDifficulty
    | undefined;
  const inspirationType = (sp.get("inspirationType")?.trim() || undefined) as
    | PhotoPromptInspirationType
    | undefined;

  const [items, themes] = await Promise.all([
    listItems(
      {
        status: "APPROVED",
        text,
        themeId,
        difficulty,
        inspirationType,
        take: 200,
      },
      { prisma },
    ),
    listThemes({ prisma }),
  ]);

  return NextResponse.json({
    themes: themes.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      themeId: item.themeId,
      themeName: item.theme.name,
      subthemeName: item.subtheme?.name ?? null,
      difficulty: item.difficulty,
      inspirationType: item.inspirationType,
      inspirationLabel: item.inspirationLabel,
      inspirationNotes: item.inspirationNotes,
      usageCount: item.usageCount,
      lastUsedAt: item.lastUsedAt,
      version: item.version,
    })),
  });
}
