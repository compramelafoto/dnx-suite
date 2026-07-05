import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { slugifyTemplateName } from "@/lib/catalog-templates/slugify-template";

export { slugifyTemplateName };

export async function requireAdminCatalogTemplateApi() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return {
      error: NextResponse.json({ error: error || "No autorizado." }, { status: 401 }),
      user: null as null,
    };
  }
  return { error: null as null, user };
}

export async function ensureUniqueTemplateSlug(base: string, excludeId?: number): Promise<string> {
  const { prisma } = await import("@/lib/prisma");
  let slug = base || "template";
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await prisma.systemCatalogTemplate.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    n++;
  }
}
