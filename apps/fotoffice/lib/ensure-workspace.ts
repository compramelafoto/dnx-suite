import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { isSlugTaken } from "./entrada/institution-shortcut";

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
    const enUso = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { publicSlug: candidate },
      select: { id: true },
    });
    // Un nombre reservado cuenta como tomado: si no, una institución llamada "Portal" se
    // quedaría con `/portal` y taparía esa pantalla para todo el mundo (ver
    // `lib/entrada/institution-shortcut.ts`).
    if (!isSlugTaken({ slug: candidate, existsInDb: Boolean(enUso) })) return candidate;
  }
  return `ws-${createHash("sha256").update(`${seed}-${Date.now()}`).digest("hex").slice(0, 12)}`;
}

/**
 * El workspace que esta persona YA tiene, o `null`.
 *
 * **Nunca crea una institución**, y esa es toda su razón de existir. Antes esto y la creación
 * eran la misma función (`ensureFotofficeWorkspaceForUser`), así que ocho rutas que solo
 * querían saber "¿dónde entra esta persona?" terminaban fabricándole un negocio del que
 * quedaba dueña. En producción eso dejó dos instituciones fantasma, las dos de socios reales
 * de SFPR que habían entrado con un email distinto al que figura en el padrón.
 *
 * Sí repara lo que encuentra roto —completa el branding que falta, promueve una membresía
 * legacy— porque eso es terminar de armar algo que ya existe, no crear algo nuevo. La
 * diferencia se nota en el resultado: acá nunca aparece un `Workspace` que antes no estaba.
 */
export async function findFotofficeWorkspaceForUser(params: {
  userId: number;
  email: string;
  name?: string | null;
}): Promise<EnsuredWorkspace | null> {
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
    return findFotofficeWorkspaceForUser(params);
  }

  // Sin membresía unificada ni legacy, esta persona no tiene dónde entrar. Quien pregunta
  // decide qué hacer con eso; acá no se inventa una institución.
  return null;
}

/**
 * Crea la institución propia de alguien que la pidió.
 *
 * **Único lugar del código donde nace un `Workspace` de FotoOffice.** Es deliberadamente
 * incómoda de llamar: quien la usa tiene que haberla importado a propósito, y hay una barrera
 * (`lib/entrada/sin-institucion-fantasma.test.ts`) que falla si aparece en cualquier archivo
 * que no sea la acción explícita del selector de perfil.
 *
 * Idempotente igual: si la persona ya tiene workspace devuelve ese, para que un doble clic no
 * le deje dos negocios.
 */
export async function createFotofficeWorkspaceForUser(params: {
  userId: number;
  email: string;
  name?: string | null;
}): Promise<EnsuredWorkspace> {
  const existing = await findFotofficeWorkspaceForUser(params);
  if (existing) return existing;

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
