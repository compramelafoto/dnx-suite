import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AccessResult =
  | {
      ok: true;
      user: { id: number; email: string; name: string | null; role: Role };
      school: { id: number; ownerId: number };
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function requireSchoolOrganizerManagementAccess(input: {
  schoolId: number;
}): Promise<AccessResult> {
  const { error, user } = await requireAuth();
  if (error || !user) {
    return {
      ok: false,
      status: error === "No autorizado" ? 403 : 401,
      error: error || "No autenticado",
    };
  }

  const school = await prisma.school.findUnique({
    where: { id: input.schoolId },
    select: { id: true, ownerId: true },
  });
  if (!school) {
    return {
      ok: false,
      status: 404,
      error: "Escuela no encontrada",
    };
  }

  if (user.role === Role.ADMIN) {
    return { ok: true, user, school };
  }

  if (user.role === Role.PHOTOGRAPHER || user.role === Role.LAB_PHOTOGRAPHER) {
    if (school.ownerId !== user.id) {
      return {
        ok: false,
        status: 403,
        error: "No tenés permisos para gestionar usuarios de esta escuela.",
      };
    }
    return { ok: true, user, school };
  }

  return {
    ok: false,
    status: 403,
    error: "No autorizado",
  };
}
