"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { hashPassword } from "@/lib/security/password";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";

export type SuperAdminActionState = { error: string | null; ok: string | null };

const initialError = "No se pudo completar la operación.";
type FotofficeGlobalRole = "SUPER_ADMIN" | "WORKSPACE_ADMIN" | "STAFF";

async function assertSuperAdmin(): Promise<number> {
  const user = await requireAuth();
  if (!(await isFotofficePlatformAdmin(user.id))) {
    throw new Error("FORBIDDEN_SUPER_ADMIN");
  }
  return user.id;
}

function ok(message: string): SuperAdminActionState {
  return { error: null, ok: message };
}

function fail(message: string): SuperAdminActionState {
  return { error: message, ok: null };
}

export async function createWorkspaceAction(
  _prev: SuperAdminActionState | undefined,
  formData: FormData,
): Promise<SuperAdminActionState> {
  try {
    await assertSuperAdmin();
    const name = formData.get("name")?.toString().trim() ?? "";
    if (!name) return fail("El nombre del workspace es obligatorio.");
    await prisma.workspace.create({ data: { name } });
    revalidatePath("/admin");
    revalidatePath("/admin/workspaces");
    return ok("Workspace creado.");
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN_SUPER_ADMIN") {
      return fail("No tenés permisos para crear workspaces.");
    }
    return fail(initialError);
  }
}

/**
 * Entidades que bloquean el hard-delete de un Workspace por razones de pagos,
 * personas reales o integridad referencial (auditado contra schema.prisma):
 * - CourseEnrollment: inscripciones con datos de pago (paymentStatus, montos).
 * - CourseSalesLead / ServiceSalesLead: leads comerciales.
 * - Member: socios/personas reales de una institución.
 * - ServiceLeadForm: sin `onDelete` en el schema (RESTRICT por default de
 *   Postgres) — Workspace.delete() fallaría en la DB si hay filas acá.
 * No se decide una política de soft-delete/archivado: se bloquea explícitamente
 * y se informa qué lo bloquea, para que la decisión de negocio quede en manos
 * de un humano.
 */
async function findWorkspaceDeletionBlockers(workspaceId: string): Promise<string[]> {
  const [enrollments, courseSalesLeads, serviceSalesLeads, members, serviceLeadForms] =
    await Promise.all([
      prisma.courseEnrollment.count({ where: { workspaceId } }),
      prisma.courseSalesLead.count({ where: { workspaceId } }),
      prisma.serviceSalesLead.count({ where: { workspaceId } }),
      prisma.member.count({ where: { workspaceId } }),
      prisma.serviceLeadForm.count({ where: { workspaceId } }),
    ]);
  const blockers: string[] = [];
  if (enrollments > 0) blockers.push(`${enrollments} inscripción(es) a cursos con datos de pago`);
  if (courseSalesLeads > 0) blockers.push(`${courseSalesLeads} lead(s) de venta de cursos`);
  if (serviceSalesLeads > 0) blockers.push(`${serviceSalesLeads} lead(s) de servicios`);
  if (members > 0) blockers.push(`${members} socio(s) registrado(s)`);
  if (serviceLeadForms > 0) blockers.push(`${serviceLeadForms} formulario(s) de captación`);
  return blockers;
}

export async function deleteWorkspaceAction(
  _prev: SuperAdminActionState | undefined,
  formData: FormData,
): Promise<SuperAdminActionState> {
  try {
    await assertSuperAdmin();
    const workspaceId = formData.get("workspaceId")?.toString().trim() ?? "";
    const confirmSlug = formData.get("confirmSlug")?.toString().trim().toLowerCase() ?? "";
    if (!workspaceId) return fail("Workspace inválido.");

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, fotofficeBranding: { select: { publicSlug: true } } },
    });
    if (!workspace) return fail("Ese workspace ya no existe.");

    const realSlug = workspace.fotofficeBranding?.publicSlug?.toLowerCase();
    if (!realSlug || confirmSlug !== realSlug) {
      return fail("El slug no coincide. No se eliminó nada.");
    }

    const blockers = await findWorkspaceDeletionBlockers(workspace.id);
    if (blockers.length > 0) {
      return fail(
        `No se puede eliminar: tiene ${blockers.join(", ")}. Esto requiere una decisión de negocio ` +
          `(archivar/exportar) antes de borrar, no se elimina automáticamente.`,
      );
    }

    await prisma.workspace.delete({ where: { id: workspace.id } });
    revalidatePath("/admin/workspaces");
    return ok(`Workspace "${workspace.name}" eliminado definitivamente.`);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN_SUPER_ADMIN") {
      return fail("No tenés permisos para eliminar workspaces.");
    }
    return fail(initialError);
  }
}

export async function createOwnerUserAction(
  _prev: SuperAdminActionState | undefined,
  formData: FormData,
): Promise<SuperAdminActionState> {
  try {
    await assertSuperAdmin();
    const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
    const password = formData.get("password")?.toString() ?? "";
    const name = formData.get("name")?.toString().trim() || null;
    if (!email) return fail("El email es obligatorio.");
    if (!password || password.length < 8) {
      return fail("La contraseña debe tener al menos 8 caracteres.");
    }
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) return fail("Ya existe un usuario con ese email.");

    await prisma.user.create({
      data: {
        email,
        name,
        password: hashPassword(password),
        role: "WORKSPACE_ADMIN",
      },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    return ok("Usuario owner creado con rol WORKSPACE_ADMIN.");
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN_SUPER_ADMIN") {
      return fail("No tenés permisos para crear usuarios owner.");
    }
    return fail(initialError);
  }
}

export async function assignOwnerToWorkspaceAction(
  _prev: SuperAdminActionState | undefined,
  formData: FormData,
): Promise<SuperAdminActionState> {
  try {
    await assertSuperAdmin();
    const userIdRaw = formData.get("userId")?.toString() ?? "";
    const workspaceId = formData.get("workspaceId")?.toString() ?? "";
    const userId = Number(userIdRaw);
    if (!Number.isInteger(userId) || userId <= 0) return fail("Usuario inválido.");
    if (!workspaceId) return fail("Workspace inválido.");

    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      update: { role: "ADMIN" },
      create: { userId, workspaceId, role: "ADMIN" },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/owners");
    revalidatePath("/admin/workspaces");
    return ok("Owner asignado al workspace.");
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN_SUPER_ADMIN") {
      return fail("No tenés permisos para asignar owners.");
    }
    return fail(initialError);
  }
}

export async function updateUserGlobalRoleAction(
  _prev: SuperAdminActionState | undefined,
  formData: FormData,
): Promise<SuperAdminActionState> {
  try {
    const actorId = await assertSuperAdmin();
    const userId = Number(formData.get("userId")?.toString() ?? "");
    const role = formData.get("role")?.toString() ?? "";
    if (!Number.isInteger(userId) || userId <= 0) return fail("Usuario inválido.");
    const allowedRoles: FotofficeGlobalRole[] = ["SUPER_ADMIN", "WORKSPACE_ADMIN", "STAFF"];
    if (!allowedRoles.includes(role as FotofficeGlobalRole)) {
      return fail("Rol inválido para Fotoffice.");
    }
    if (userId === actorId && role !== "SUPER_ADMIN") {
      return fail("No podés quitarte el rol SUPER_ADMIN a vos mismo.");
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { role: role as FotofficeGlobalRole } }),
      prisma.userSession.deleteMany({ where: { userId } }),
    ]);

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    return ok("Rol actualizado. Se invalidaron sesiones activas del usuario.");
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN_SUPER_ADMIN") {
      return fail("No tenés permisos para cambiar roles globales.");
    }
    return fail(initialError);
  }
}
