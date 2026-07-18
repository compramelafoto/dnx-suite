import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";

export type EnsuredWorkspace = {
  workspaceId: string;
  created: boolean;
  onboardingCompleted: boolean;
};

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function uniquePublicSlug(seed: string): Promise<string> {
  const base = slugify(seed) || "fotografo";
  for (let i = 0; i < 8; i++) {
    const suffix = i === 0 ? "" : `-${randomBytes(2).toString("hex")}`;
    const candidate = `${base}${suffix}`.slice(0, 56);
    const taken = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { publicSlug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `ws-${createHash("sha256").update(`${seed}-${Date.now()}`).digest("hex").slice(0, 12)}`;
}

/**
 * Garantiza un workspace Fotoffice para el usuario.
 * Idempotente: si ya hay membresía, reutiliza el primero (OWNER preferido).
 */
export async function ensureFotofficeWorkspaceForUser(params: {
  userId: number;
  email: string;
  name?: string | null;
}): Promise<EnsuredWorkspace> {
  const existing = await prisma.workspaceMembership.findMany({
    where: { userId: params.userId },
    select: {
      workspaceId: true,
      role: true,
      workspace: {
        select: {
          id: true,
          fotofficeBranding: { select: { onboardingCompletedAt: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing.length > 0) {
    const owner =
      existing.find((m) => m.role === "WORKSPACE_OWNER") ?? existing[0]!;
    const branding = owner.workspace.fotofficeBranding;
    if (!branding) {
      const commercialName =
        params.name?.trim() || params.email.split("@")[0] || "Mi estudio";
      const publicSlug = await uniquePublicSlug(commercialName);
      await prisma.fotofficeWorkspaceBranding.create({
        data: {
          workspaceId: owner.workspaceId,
          publicSlug,
          commercialName,
          contactEmail: params.email,
        },
      });
      return {
        workspaceId: owner.workspaceId,
        created: false,
        onboardingCompleted: false,
      };
    }
    return {
      workspaceId: owner.workspaceId,
      created: false,
      onboardingCompleted: branding.onboardingCompletedAt != null,
    };
  }

  // Fallback legacy Membership
  const legacy = await prisma.membership.findFirst({
    where: { userId: params.userId },
    select: { workspaceId: true },
    orderBy: { id: "asc" },
  });
  if (legacy) {
    await prisma.workspaceMembership.upsert({
      where: {
        userId_workspaceId: {
          userId: params.userId,
          workspaceId: legacy.workspaceId,
        },
      },
      update: {},
      create: {
        userId: params.userId,
        workspaceId: legacy.workspaceId,
        role: "WORKSPACE_OWNER",
      },
    });
    return ensureFotofficeWorkspaceForUser(params);
  }

  const commercialName =
    params.name?.trim() ||
    params.email.split("@")[0]?.replace(/[._]/g, " ") ||
    "Mi estudio";
  const publicSlug = await uniquePublicSlug(commercialName);

  const workspace = await prisma.workspace.create({
    data: {
      name: commercialName,
      workspaceMembershipsUnified: {
        create: {
          userId: params.userId,
          role: "WORKSPACE_OWNER",
        },
      },
      memberships: {
        create: {
          userId: params.userId,
          role: "ADMIN",
        },
      },
      fotofficeBranding: {
        create: {
          publicSlug,
          commercialName,
          contactEmail: params.email,
        },
      },
    },
    select: { id: true },
  });

  return {
    workspaceId: workspace.id,
    created: true,
    onboardingCompleted: false,
  };
}
