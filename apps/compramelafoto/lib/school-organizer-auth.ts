import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AccessResult =
  | {
      ok: true;
      user: { id: number; email: string; name: string | null; role: Role };
      membership: {
        id: string;
        schoolId: number;
        userId: number;
        status: "ACTIVE" | "DISABLED";
      };
    }
  | { ok: false; status: number; error: string };

export async function requireSchoolOrganizerAccess(input: {
  schoolId: number;
}): Promise<AccessResult> {
  const { error, user } = await requireAuth([Role.SCHOOL_ORGANIZER]);
  if (error || !user) {
    return {
      ok: false,
      status: error === "No autorizado" ? 403 : 401,
      error: error || "No autenticado",
    };
  }

  const membership = await prisma.schoolOrganizer.findFirst({
    where: {
      schoolId: input.schoolId,
      userId: user.id,
      status: "ACTIVE",
    },
    select: {
      id: true,
      schoolId: true,
      userId: true,
      status: true,
    },
  });

  if (!membership) {
    return {
      ok: false,
      status: 403,
      error: "No tenés acceso a esta escuela",
    };
  }

  return {
    ok: true,
    user,
    membership,
  };
}
