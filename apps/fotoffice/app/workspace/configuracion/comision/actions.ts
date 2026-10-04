"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { findLinkableUserByEmail } from "@repo/db/fotoffice-user-lookup";
import { requireCommissionAdmin } from "@/lib/commission/access";
import { buildAddedToCommissionEmail } from "@/lib/commission/emails";
import { listEditableModuleKeys } from "@/lib/commission/modules";
import {
  archivedName,
  isCurrentOrUpcoming,
  isUniqueViolation,
  nextCopyName,
  personLabel,
  reorderOffices,
} from "@/lib/commission/rules";
import {
  releaseStaffMembershipIfNoRoles,
  syncStaffMembershipWithRoles,
} from "@/lib/commission/team-membership";
import {
  parseOfficeForm,
  parsePermissionGrid,
  parseRoleForm,
  parseTermDates,
} from "@/lib/commission/validation";
import { appUrl } from "@/lib/app-url";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";

/**
 * Acciones de la Comisión directiva: roles con su grilla de permisos, cargos e integrantes.
 *
 * Todas empiezan por `requireCommissionAdmin()` (dueño o admin; si no, redirect) y todas buscan
 * y escriben filtrando por el workspace propio: un id de otra institución da "No encontrado.",
 * nunca un dato ajeno. Las reglas puras viven en `lib/commission/` y acá sólo se orquesta.
 */

export type CommissionActionState = { error: string | null; ok?: boolean; message?: string };

const COMMISSION_PATH = "/workspace/configuracion/comision";
const NOT_FOUND = "No encontrado.";
const ROLE_NAME_TAKEN = "Ya existe un rol con ese nombre.";
const OFFICE_NAME_TAKEN = "Ya existe un cargo con ese nombre.";
const VOTING_OFFICE_NEEDS_ROLE =
  "Un cargo que vota necesita al menos un rol, para que la persona pueda entrar al panel.";
const NO_ACCOUNT =
  "No encontramos una cuenta con ese correo. Pedile que se registre en FOTOFFICE y volvé a intentar.";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function ids(fd: FormData, key: string): string[] {
  const out = fd
    .getAll(key)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return Array.from(new Set(out));
}

function done(message?: string): CommissionActionState {
  revalidatePath(COMMISSION_PATH, "layout");
  return message ? { error: null, ok: true, message } : { error: null, ok: true };
}

/** Vigente o futuro: sin fin, o con fin todavía por llegar. */
const stillInForce = (now: Date) => ({ OR: [{ endsAt: null }, { endsAt: { gt: now } }] });

const insensitive = (name: string) => ({ equals: name, mode: "insensitive" as const });

// ─────────────────────────────── Roles ───────────────────────────────

export async function createRoleAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const parsed = parseRoleForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const taken = await prisma.workspaceCustomRole.findFirst({
    where: { workspaceId, archivedAt: null, name: insensitive(parsed.name) },
    select: { id: true },
  });
  if (taken) return { error: ROLE_NAME_TAKEN };

  const editable = await listEditableModuleKeys(workspaceId);
  const grid = parsePermissionGrid(formData, editable).filter((p) => p.level !== "NONE");
  try {
    await prisma.workspaceCustomRole.create({
      data: {
        workspaceId,
        name: parsed.name,
        description: parsed.description,
        permissions: { create: grid },
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: ROLE_NAME_TAKEN };
    throw e;
  }
  return done();
}

/** Reemplaza la grilla sólo de los módulos editables: lo guardado en planificados o apagados queda. */
export async function updateRoleAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const roleId = str(formData, "roleId");
  const role = await prisma.workspaceCustomRole.findFirst({
    where: { id: roleId, workspaceId, archivedAt: null },
    select: { id: true },
  });
  if (!role) return { error: NOT_FOUND };

  const parsed = parseRoleForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const taken = await prisma.workspaceCustomRole.findFirst({
    where: { workspaceId, archivedAt: null, name: insensitive(parsed.name), id: { not: role.id } },
    select: { id: true },
  });
  if (taken) return { error: ROLE_NAME_TAKEN };

  const editable = await listEditableModuleKeys(workspaceId);
  const grid = parsePermissionGrid(formData, editable).filter((p) => p.level !== "NONE");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.workspaceCustomRole.update({
        where: { id: role.id, workspaceId },
        data: { name: parsed.name, description: parsed.description },
      });
      await tx.workspaceRolePermission.deleteMany({
        where: { roleId: role.id, moduleKey: { in: editable } },
      });
      if (grid.length > 0) {
        await tx.workspaceRolePermission.createMany({
          data: grid.map((p) => ({ roleId: role.id, ...p })),
        });
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: ROLE_NAME_TAKEN };
    throw e;
  }
  return done();
}

export async function duplicateRoleAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const role = await prisma.workspaceCustomRole.findFirst({
    where: { id: str(formData, "roleId"), workspaceId, archivedAt: null },
    select: {
      name: true,
      description: true,
      permissions: { select: { moduleKey: true, level: true, actions: true } },
    },
  });
  if (!role) return { error: NOT_FOUND };

  const existing = await prisma.workspaceCustomRole.findMany({
    where: { workspaceId },
    select: { name: true },
  });
  const name = nextCopyName(
    role.name,
    existing.map((r) => r.name),
  );
  try {
    await prisma.workspaceCustomRole.create({
      data: {
        workspaceId,
        name,
        description: role.description,
        permissions: {
          create: role.permissions.map((p) => ({ moduleKey: p.moduleKey, level: p.level, actions: [...p.actions] })),
        },
      },
    });
  } catch (e) {
    // Otra pestaña duplicó el mismo rol entre la lectura de nombres y esta escritura.
    if (isUniqueViolation(e)) return { error: ROLE_NAME_TAKEN };
    throw e;
  }
  return done();
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Archivar no borra: pone `archivedAt`, revoca las asignaciones y renombra el rol para liberar el
 * nombre. Si alguien lo tiene, exige `confirm=yes`. Al final, quien se quedó sin roles vigentes
 * pierde la membresía de equipo (dueño y admin nunca).
 */
export async function archiveRoleAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const role = await prisma.workspaceCustomRole.findFirst({
    where: { id: str(formData, "roleId"), workspaceId, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!role) return { error: NOT_FOUND };

  const now = new Date();
  const open = await prisma.workspaceRoleAssignment.findMany({
    where: { workspaceId, roleId: role.id, revokedAt: null },
    select: {
      id: true,
      memberId: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      revokedAt: true,
      member: { select: { userId: true } },
    },
  });
  const people = new Set(
    open.filter((a) => isCurrentOrUpcoming(a, now)).map((a) => personLabel(a.memberId, a.userId)),
  );
  if (people.size > 0 && str(formData, "confirm") !== "yes") {
    return {
      error: `Este rol lo ${people.size === 1 ? "tiene" : "tienen"} ${plural(people.size, "persona", "personas")}. Confirmá para archivarlo: se les va a quitar.`,
    };
  }

  const names = await prisma.workspaceCustomRole.findMany({ where: { workspaceId }, select: { name: true } });
  await prisma.$transaction(async (tx) => {
    await tx.workspaceCustomRole.update({
      where: { id: role.id, workspaceId },
      data: { archivedAt: now, name: archivedName(role.name, now, names.map((r) => r.name)) },
    });
    // Sólo lo vigente o futuro: lo ya vencido conserva su fecha real de fin en el historial.
    await tx.workspaceRoleAssignment.updateMany({
      where: { workspaceId, roleId: role.id, revokedAt: null, ...stillInForce(now) },
      data: { revokedAt: now },
    });
  });

  const userIds = new Set<number>();
  for (const a of open) {
    const uid = a.userId ?? a.member?.userId ?? null;
    if (uid !== null) userIds.add(uid);
  }
  // Todas estas personas tenían este rol: perderlo puede dejarlas sin ninguno.
  for (const uid of userIds) await syncMembershipSafely(workspaceId, uid, "release");
  return done();
}

// ─────────────────────────────── Cargos ───────────────────────────────

export async function createOfficeAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const parsed = parseOfficeForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const taken = await prisma.workspaceOffice.findFirst({
    where: { workspaceId, archivedAt: null, name: insensitive(parsed.name) },
    select: { id: true },
  });
  if (taken) return { error: OFFICE_NAME_TAKEN };

  const current = await prisma.workspaceOffice.findMany({
    where: { workspaceId, archivedAt: null },
    select: { order: true },
  });
  const order = current.reduce((max, o) => Math.max(max, o.order + 1), 0);
  try {
    await prisma.workspaceOffice.create({
      data: { workspaceId, name: parsed.name, votes: parsed.votes, order },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: OFFICE_NAME_TAKEN };
    throw e;
  }
  return done();
}

export async function updateOfficeAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const office = await prisma.workspaceOffice.findFirst({
    where: { id: str(formData, "officeId"), workspaceId, archivedAt: null },
    select: { id: true },
  });
  if (!office) return { error: NOT_FOUND };

  const parsed = parseOfficeForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const taken = await prisma.workspaceOffice.findFirst({
    where: { workspaceId, archivedAt: null, name: insensitive(parsed.name), id: { not: office.id } },
    select: { id: true },
  });
  if (taken) return { error: OFFICE_NAME_TAKEN };

  try {
    await prisma.workspaceOffice.update({
      where: { id: office.id, workspaceId },
      data: { name: parsed.name, votes: parsed.votes },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: OFFICE_NAME_TAKEN };
    throw e;
  }
  return done();
}

/** Igual que los roles: archiva, revoca los mandatos y libera el nombre. Con mandatos, pide `confirm=yes`. */
export async function archiveOfficeAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const office = await prisma.workspaceOffice.findFirst({
    where: { id: str(formData, "officeId"), workspaceId, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!office) return { error: NOT_FOUND };

  const now = new Date();
  const open = await prisma.workspaceOfficeTerm.findMany({
    where: { workspaceId, officeId: office.id, revokedAt: null },
    select: { id: true, memberId: true, userId: true, startsAt: true, endsAt: true, revokedAt: true },
  });
  const people = new Set(
    open.filter((t) => isCurrentOrUpcoming(t, now)).map((t) => personLabel(t.memberId, t.userId) || t.id),
  );
  if (people.size > 0 && str(formData, "confirm") !== "yes") {
    return {
      error: `Este cargo lo ${people.size === 1 ? "ocupa" : "ocupan"} ${plural(people.size, "persona", "personas")}. Confirmá para archivarlo: se les va a terminar el mandato.`,
    };
  }

  const names = await prisma.workspaceOffice.findMany({ where: { workspaceId }, select: { name: true } });
  await prisma.$transaction(async (tx) => {
    await tx.workspaceOffice.update({
      where: { id: office.id, workspaceId },
      data: { archivedAt: now, name: archivedName(office.name, now, names.map((o) => o.name)) },
    });
    await tx.workspaceOfficeTerm.updateMany({
      where: { workspaceId, officeId: office.id, revokedAt: null, ...stillInForce(now) },
      data: { revokedAt: now },
    });
  });
  return done();
}

export async function moveOfficeAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const direction = str(formData, "direction");
  if (direction !== "up" && direction !== "down") return { error: "Movimiento no válido." };
  const officeId = str(formData, "officeId");

  const offices = await prisma.workspaceOffice.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, order: true },
  });
  if (!offices.some((o) => o.id === officeId)) return { error: NOT_FOUND };

  const next = reorderOffices(offices, officeId, direction);
  if (!next) return done(); // ya estaba en el borde: nada que mover.
  const before = new Map(offices.map((o) => [o.id, o.order]));
  const changed = next.filter((o) => before.get(o.id) !== o.order);
  await prisma.$transaction(async (tx) => {
    for (const o of changed) {
      await tx.workspaceOffice.update({ where: { id: o.id, workspaceId }, data: { order: o.order } });
    }
  });
  return done();
}

// ─────────────────────────────── Integrantes ───────────────────────────────

/**
 * La persona de la comisión. Si es socia, todo se ancla a la ficha (`memberId`) y la cuenta se
 * resuelve a través de ella; si no, a la cuenta (`userId`).
 */
type Person = { memberId: string | null; userId: number | null; name: string; email: string | null };

/** Filtro de "cosas de esta persona" para mandatos y asignaciones, dentro del workspace. */
function personWhere(p: Person, workspaceId: string) {
  if (p.memberId) {
    return { OR: [{ memberId: p.memberId }, ...(p.userId !== null ? [{ userId: p.userId }] : [])] };
  }
  return { OR: [{ userId: p.userId }, { member: { userId: p.userId, workspaceId } }] };
}

const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  userId: true,
  user: { select: { email: true } },
} as const;

type MemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  userId: number | null;
  user: { email: string } | null;
};

function fromMember(m: MemberRow): Person {
  return {
    memberId: m.id,
    userId: m.userId,
    name: `${m.firstName} ${m.lastName}`.trim(),
    email: m.email ?? m.user?.email ?? null,
  };
}

/** Para editar y quitar: `memberId` (ficha del workspace) o `userId` (cuenta con algo en la comisión). */
async function findExistingPerson(fd: FormData, workspaceId: string): Promise<Person | null> {
  const memberId = str(fd, "memberId");
  if (memberId) {
    const m = await prisma.member.findFirst({ where: { id: memberId, workspaceId }, select: MEMBER_SELECT });
    return m ? fromMember(m) : null;
  }
  const userId = Number(str(fd, "userId"));
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const m = await prisma.member.findFirst({ where: { workspaceId, userId }, select: MEMBER_SELECT });
  if (m) return fromMember(m);
  const person: Person = { memberId: null, userId, name: "", email: null };
  const where = { workspaceId, ...personWhere(person, workspaceId) };
  const [terms, assignments] = await Promise.all([
    prisma.workspaceOfficeTerm.findMany({ where, select: { id: true }, take: 1 }),
    prisma.workspaceRoleAssignment.findMany({ where, select: { id: true }, take: 1 }),
  ]);
  return terms.length > 0 || assignments.length > 0 ? person : null;
}

async function loadRoles(workspaceId: string, roleIds: string[]) {
  if (roleIds.length === 0) return [];
  const rows = await prisma.workspaceCustomRole.findMany({
    where: { id: { in: roleIds }, workspaceId, archivedAt: null },
    select: { id: true, name: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (roleIds.some((id) => !byId.has(id))) return null;
  return roleIds.map((id) => byId.get(id) as { id: string; name: string });
}

/**
 * `"roles"`: la persona tiene o tuvo roles; la membresía queda acorde a HOY (con alguno vigente se
 * asegura; si todos empiezan más adelante o ya terminaron, no se crea y se libera).
 * `"release"`: se le quitó algo; se libera sólo si no le queda ningún rol vigente.
 */
async function syncMembershipSafely(
  workspaceId: string,
  userId: number,
  mode: "roles" | "release",
): Promise<void> {
  try {
    if (mode === "roles") await syncStaffMembershipWithRoles(workspaceId, userId);
    else await releaseStaffMembershipIfNoRoles(workspaceId, userId);
  } catch (e) {
    // Los mandatos y roles ya quedaron guardados; la membresía se vuelve a sincronizar al iniciar sesión.
    console.error("[fotoffice][comision] no se pudo sincronizar la membresía de equipo", {
      workspaceId,
      userId,
      detalle: e instanceof Error ? e.message : "error desconocido",
    });
  }
}

/**
 * Suma a una persona a la comisión: mandato (si eligió cargo) y roles, con las mismas fechas.
 * Lo que ya tenía vigente no se duplica y se avisa en el mensaje. Todo en una transacción; el
 * correo va después y nunca hace fallar la acción.
 */
export async function addCommissionMemberAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { user, workspaceId } = await requireCommissionAdmin();

  const dates = parseTermDates(formData);
  if (!dates.ok) return { error: dates.error };
  const officeId = str(formData, "officeId");
  const roleIds = ids(formData, "roleIds");

  // ¿Quién?
  let person: Person;
  const memberId = str(formData, "memberId");
  const email = str(formData, "email");
  if (memberId) {
    const m = await prisma.member.findFirst({ where: { id: memberId, workspaceId }, select: MEMBER_SELECT });
    if (!m) return { error: NOT_FOUND };
    person = fromMember(m);
  } else if (email) {
    const account = await findLinkableUserByEmail(email);
    if (!account) return { error: NO_ACCOUNT };
    const m = await prisma.member.findFirst({ where: { workspaceId, userId: account.id }, select: MEMBER_SELECT });
    person = m
      ? fromMember(m)
      : { memberId: null, userId: account.id, name: account.name?.trim() || account.email, email: account.email };
  } else {
    return { error: "Elegí a la persona." };
  }

  if (!officeId && roleIds.length === 0) return { error: "Elegí un cargo o al menos un rol." };

  const office = officeId
    ? await prisma.workspaceOffice.findFirst({
        where: { id: officeId, workspaceId, archivedAt: null },
        select: { id: true, name: true, votes: true },
      })
    : null;
  if (officeId && !office) return { error: NOT_FOUND };
  // Sin rol, quien vota no podría entrar al panel a ver lo que vota.
  if (office?.votes && roleIds.length === 0) return { error: VOTING_OFFICE_NEEDS_ROLE };
  const roles = await loadRoles(workspaceId, roleIds);
  if (!roles) return { error: NOT_FOUND };

  // Los mandatos y asignaciones se anclan a la ficha si es socia; si no, a la cuenta.
  const anchor = person.memberId ? { memberId: person.memberId, userId: null } : { memberId: null, userId: person.userId };
  const now = new Date();
  const who = personWhere(person, workspaceId);

  const result = await prisma.$transaction(async (tx) => {
    let officeCreated = false;
    if (office) {
      const terms = await tx.workspaceOfficeTerm.findMany({
        where: { workspaceId, officeId: office.id, revokedAt: null, ...who },
        select: { id: true, startsAt: true, endsAt: true, revokedAt: true },
      });
      if (!terms.some((t) => isCurrentOrUpcoming(t, now))) {
        await tx.workspaceOfficeTerm.create({
          data: {
            workspaceId,
            officeId: office.id,
            ...anchor,
            startsAt: dates.startsAt,
            endsAt: dates.endsAt,
            assignedById: user.id,
          },
        });
        officeCreated = true;
      }
    }

    let newRoles = roles;
    if (roles.length > 0) {
      const existing = await tx.workspaceRoleAssignment.findMany({
        where: { workspaceId, roleId: { in: roles.map((r) => r.id) }, revokedAt: null, ...who },
        select: { id: true, roleId: true, startsAt: true, endsAt: true, revokedAt: true },
      });
      const had = new Set(existing.filter((a) => isCurrentOrUpcoming(a, now)).map((a) => a.roleId));
      newRoles = roles.filter((r) => !had.has(r.id));
      if (newRoles.length > 0) {
        await tx.workspaceRoleAssignment.createMany({
          data: newRoles.map((r) => ({
            workspaceId,
            roleId: r.id,
            ...anchor,
            startsAt: dates.startsAt,
            endsAt: dates.endsAt,
            assignedById: user.id,
          })),
        });
      }
    }
    return { officeCreated, newRoles };
  });

  // Sólo da membresía un rol vigente HOY: uno que empieza más adelante la recibe al iniciar sesión
  // cuando empiece, y uno con la fecha de fin ya pasada no la da.
  if (person.userId !== null && roles.length > 0) {
    await syncMembershipSafely(workspaceId, person.userId, "roles");
  }

  const skipped: string[] = [];
  if (office && !result.officeCreated) skipped.push(`Ya tenía el cargo ${office.name} vigente; no se duplicó.`);
  const skippedRoles = roles.filter((r) => !result.newRoles.includes(r));
  if (skippedRoles.length > 0) {
    skipped.push(
      `Ya tenía ${skippedRoles.length === 1 ? "el rol" : "los roles"} ${skippedRoles.map((r) => r.name).join(", ")}; no se ${skippedRoles.length === 1 ? "duplicó" : "duplicaron"}.`,
    );
  }

  const grantedSomething = result.officeCreated || result.newRoles.length > 0;
  if (grantedSomething && person.email) {
    await sendAddedEmail({
      workspaceId,
      person,
      officeName: result.officeCreated && office ? office.name : null,
      roleNames: result.newRoles.map((r) => r.name),
      endsAt: dates.endsAt,
    });
  }

  return done(skipped.length > 0 ? skipped.join(" ") : undefined);
}

async function sendAddedEmail(input: {
  workspaceId: string;
  person: Person;
  officeName: string | null;
  roleNames: string[];
  endsAt: Date | null;
}): Promise<void> {
  const to = input.person.email;
  if (!to) return;
  try {
    const base = appUrl();
    if (!base) {
      console.error("[fotoffice][comision] sin URL pública: no se manda el aviso de alta");
      return;
    }
    const { organizationName } = await loadWorkspaceEmailContext(input.workspaceId);
    const body = buildAddedToCommissionEmail({
      institution: organizationName,
      personName: input.person.name || to,
      officeName: input.officeName,
      roleNames: input.roleNames,
      hasAccount: input.person.userId !== null,
      panelUrl: `${base}/workspace`,
      endsAt: input.endsAt,
    });
    const outcome = await sendAndLogEmail({
      to,
      templateKey: "commission-added",
      body,
      userId: input.person.userId,
    });
    if (outcome.status !== "SENT") {
      console.error("[fotoffice][comision] el aviso de alta no salió", { status: outcome.status });
    }
  } catch (e) {
    console.error("[fotoffice][comision] falló el aviso de alta", {
      detalle: e instanceof Error ? e.message : "error desconocido",
    });
  }
}

/**
 * Cambia las fechas de los mandatos vigentes de la persona y deja exactamente los roles elegidos:
 * revoca los que ya no están, actualiza las fechas de los que siguen y crea los nuevos.
 */
export async function updateCommissionMemberAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { user, workspaceId } = await requireCommissionAdmin();
  const person = await findExistingPerson(formData, workspaceId);
  if (!person) return { error: NOT_FOUND };

  const dates = parseTermDates(formData);
  if (!dates.ok) return { error: dates.error };
  const roles = await loadRoles(workspaceId, ids(formData, "roleIds"));
  if (!roles) return { error: NOT_FOUND };

  const desired = new Set(roles.map((r) => r.id));
  const anchor = person.memberId ? { memberId: person.memberId, userId: null } : { memberId: null, userId: person.userId };
  const now = new Date();
  const who = personWhere(person, workspaceId);

  const revokedRoles = await prisma.$transaction(async (tx) => {
    const terms = await tx.workspaceOfficeTerm.findMany({
      where: { workspaceId, revokedAt: null, ...who },
      select: { id: true, startsAt: true, endsAt: true, revokedAt: true },
    });
    const currentTerms = terms.filter((t) => isCurrentOrUpcoming(t, now)).map((t) => t.id);
    if (currentTerms.length > 0) {
      await tx.workspaceOfficeTerm.updateMany({
        where: { workspaceId, id: { in: currentTerms } },
        data: { startsAt: dates.startsAt, endsAt: dates.endsAt },
      });
    }

    const assignments = await tx.workspaceRoleAssignment.findMany({
      where: { workspaceId, revokedAt: null, ...who },
      select: { id: true, roleId: true, startsAt: true, endsAt: true, revokedAt: true },
    });
    const current = assignments.filter((a) => isCurrentOrUpcoming(a, now));
    const toRevoke = current.filter((a) => !desired.has(a.roleId)).map((a) => a.id);
    const toKeep = current.filter((a) => desired.has(a.roleId));
    const kept = new Set(toKeep.map((a) => a.roleId));
    const toCreate = roles.filter((r) => !kept.has(r.id));

    if (toRevoke.length > 0) {
      await tx.workspaceRoleAssignment.updateMany({
        where: { workspaceId, id: { in: toRevoke } },
        data: { revokedAt: now },
      });
    }
    if (toKeep.length > 0) {
      await tx.workspaceRoleAssignment.updateMany({
        where: { workspaceId, id: { in: toKeep.map((a) => a.id) } },
        data: { startsAt: dates.startsAt, endsAt: dates.endsAt },
      });
    }
    if (toCreate.length > 0) {
      await tx.workspaceRoleAssignment.createMany({
        data: toCreate.map((r) => ({
          workspaceId,
          roleId: r.id,
          ...anchor,
          startsAt: dates.startsAt,
          endsAt: dates.endsAt,
          assignedById: user.id,
        })),
      });
    }
    return toRevoke.length;
  });

  // Con roles: la membresía queda acorde a las fechas (sólo un rol vigente hoy la da). Sin roles:
  // liberarla sólo si esta edición le sacó alguno. Quien nunca tuvo roles (p. ej. personal con
  // sólo un cargo) conserva la membresía que ya tenía.
  if (person.userId !== null && (roles.length > 0 || revokedRoles > 0)) {
    await syncMembershipSafely(workspaceId, person.userId, roles.length > 0 ? "roles" : "release");
  }
  return done();
}

/** Revoca todos los mandatos y asignaciones de la persona y, si tiene cuenta, libera la membresía. */
export async function removeCommissionMemberAction(
  _prev: CommissionActionState | undefined,
  formData: FormData,
): Promise<CommissionActionState> {
  const { workspaceId } = await requireCommissionAdmin();
  const person = await findExistingPerson(formData, workspaceId);
  if (!person) return { error: NOT_FOUND };

  const now = new Date();
  // Sólo lo vigente o futuro, igual que al archivar: lo ya vencido conserva su fecha real de fin.
  const where = {
    workspaceId,
    revokedAt: null,
    AND: [personWhere(person, workspaceId), stillInForce(now)],
  };
  const revokedRoles = await prisma.$transaction(async (tx) => {
    await tx.workspaceOfficeTerm.updateMany({ where, data: { revokedAt: now } });
    const { count } = await tx.workspaceRoleAssignment.updateMany({ where, data: { revokedAt: now } });
    return count;
  });

  // Sólo si se le quitó algún rol: a quien sólo tenía un cargo no se le toca la membresía. Si
  // todos sus roles ya estaban vencidos, la membresía la libera el inicio de sesión.
  if (person.userId !== null && revokedRoles > 0) {
    await syncMembershipSafely(workspaceId, person.userId, "release");
  }
  return done();
}
