/**
 * Invitar a un administrador de escuela (usuario SCHOOL_ORGANIZER).
 *
 * Es el mismo código que tenía el POST de
 * `app/api/admin/schools/[schoolId]/organizers/invite/route.ts`, movido sin cambios:
 * mismos textos de error, mismos códigos y mismo orden de validación. La ruta lo sigue
 * usando (después de su control de acceso) y DNX Bot también, vía
 * `inviteSchoolOrganizerForOwner`, que exige que la escuela sea del fotógrafo.
 *
 * Manda un mail a un tercero: no se puede deshacer.
 */
import { esCorreoDePrueba } from "@/lib/demos/identidad";
import { esEscuelaDemo } from "@/lib/demos/visibilidad";
import { Role, SchoolOrganizerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createSchoolOrganizerInvitation,
  isValidEmail,
  normalizeEmail,
} from "@/lib/school-organizer-invitations";
import { findOwnedSchool } from "@/lib/schools/school-setup";

type Invitation = Awaited<ReturnType<typeof createSchoolOrganizerInvitation>>;

export type InviteSchoolOrganizerResult =
  | ({ ok: true } & Invitation)
  | { ok: false; status: 400 | 404 | 409; error: string };

/**
 * Invita a `email` como administrador de la escuela. No controla permisos: quien llama
 * ya verificó que `inviter` puede gestionar esa escuela.
 */
export async function inviteSchoolOrganizer(p: {
  schoolId: number;
  inviter: { id: number; name: string | null };
  name: unknown;
  email: unknown;
}): Promise<InviteSchoolOrganizerResult> {
  const { schoolId } = p;
  const name = String(p.name ?? "").trim();
  const email = normalizeEmail(String(p.email ?? ""));

  if (!name) {
    return { ok: false, status: 400, error: "El nombre es obligatorio." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, status: 400, error: "Email inválido." };
  }
  // Escuela de una demo grabable: nunca se invita (ni se le escribe) a un correo real.
  if (!esCorreoDePrueba(email) && (await esEscuelaDemo(p.schoolId))) {
    return { ok: false, status: 400, error: "Esto es una demo: usá un correo @demo.compramelafoto.test." };
  }

  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (targetUser && targetUser.role !== Role.SCHOOL_ORGANIZER) {
    return { ok: false, status: 409, error: "Ya existe un usuario con ese email y no es usuario de escuela." };
  }

  if (targetUser && targetUser.role === Role.SCHOOL_ORGANIZER) {
    const existingMembership = await prisma.schoolOrganizer.findUnique({
      where: {
        schoolId_userId: {
          schoolId,
          userId: targetUser.id,
        },
      },
      select: { id: true, status: true },
    });

    if (!existingMembership) {
      await prisma.schoolOrganizer.create({
        data: {
          schoolId,
          userId: targetUser.id,
          status: SchoolOrganizerStatus.ACTIVE,
        },
      });
    } else if (existingMembership.status !== SchoolOrganizerStatus.ACTIVE) {
      await prisma.schoolOrganizer.update({
        where: { id: existingMembership.id },
        data: { status: SchoolOrganizerStatus.ACTIVE },
      });
    }
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true },
  });
  if (!school) {
    return { ok: false, status: 404, error: "Escuela no encontrada." };
  }

  const result = await createSchoolOrganizerInvitation({
    schoolId,
    email,
    name,
    invitedByUserId: p.inviter.id,
    invitedByName: p.inviter.name,
    schoolName: school.name,
  });
  return { ok: true, ...result };
}

/**
 * Igual que `inviteSchoolOrganizer`, pero sólo si la escuela es del fotógrafo. Una
 * escuela ajena responde igual que una inexistente (404), sin revelar que existe.
 */
export async function inviteSchoolOrganizerForOwner(p: {
  owner: { id: number; name: string | null };
  schoolId: number;
  name: unknown;
  email: unknown;
}): Promise<InviteSchoolOrganizerResult> {
  const owned = await findOwnedSchool(p.owner.id, p.schoolId);
  if (!owned) return { ok: false, status: 404, error: "Escuela no encontrada." };
  return inviteSchoolOrganizer({ schoolId: p.schoolId, inviter: p.owner, name: p.name, email: p.email });
}
