"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { PORTAL_HOME } from "@/lib/portal/destination";
import { clearProfileChoice, readProfileChoice, setProfileChoice } from "@/lib/portal/profile-choice";
import {
  counterpartProfile,
  entryProfileForInstitution,
  listUserProfiles,
  profileDestination,
  profileKey,
} from "@/lib/portal/profiles";
import { setActiveWorkspaceCookie } from "@/lib/workspace-cookie";

/**
 * Entra a una institución elegida en `/elegir-perfil` (una tarjeta por institución).
 *
 * El `workspaceId` no se cree: se rearma la lista real de perfiles y se buscan los de esa
 * institución. Ajena o vacía → vuelve al selector sin cambiar nada. Con perfiles ahí, entra a
 * la vista por defecto (`resolveEntryProfile` sobre los de esa institución; el recordado manda
 * si es de ella). Si va al panel, también fija la institución activa.
 */
export async function chooseInstitutionAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const workspaceId = formData.get("workspaceId")?.toString()?.trim() ?? "";

  const [profiles, remembered] = await Promise.all([listUserProfiles(user.id), readProfileChoice()]);
  const chosen = workspaceId ? entryProfileForInstitution(profiles, workspaceId, remembered) : null;
  if (!chosen) redirect("/elegir-perfil");

  await setProfileChoice(profileKey(chosen));
  if (chosen.kind === "TEAM") await setActiveWorkspaceCookie(chosen.workspaceId);
  redirect(profileDestination(chosen));
}

/** Vuelve al selector y olvida la preferencia, para poder elegir de nuevo. */
export async function switchProfileAction(): Promise<void> {
  await clearProfileChoice();
  redirect("/elegir-perfil");
}

/**
 * Del portal del socio al panel de Administración de la MISMA institución.
 *
 * El `workspaceId` del formulario no se cree: se rearma la lista real de perfiles y se busca
 * el de equipo de esa institución. Si no existe, vuelve al portal sin cambiar nada. Cambiar
 * no otorga permisos: el panel sigue exigiendo la membresía por su cuenta.
 */
export async function switchToAdminAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const workspaceId = formData.get("workspaceId")?.toString()?.trim() ?? "";

  const profiles = await listUserProfiles(user.id);
  const team = workspaceId
    ? counterpartProfile(profiles, { kind: "MEMBER", workspaceId })
    : null;
  if (!team) redirect(PORTAL_HOME);

  await setProfileChoice(profileKey(team));
  await setActiveWorkspaceCookie(team.workspaceId);
  redirect("/workspace");
}

/** Del panel de Administración al portal del socio de la MISMA institución. */
export async function switchToPortalAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const workspaceId = formData.get("workspaceId")?.toString()?.trim() ?? "";

  const profiles = await listUserProfiles(user.id);
  const member = workspaceId
    ? counterpartProfile(profiles, { kind: "TEAM", workspaceId })
    : null;
  if (!member) redirect("/workspace");

  await setProfileChoice(profileKey(member));
  redirect(PORTAL_HOME);
}

/**
 * Crea el workspace propio de un socio que quiere administrar SU negocio con FotoOffice.
 *
 * Es la contracara del guard que evita el "workspace fantasma": crear un negocio no puede
 * ocurrir por accidente al visitar una ruta, pero SÍ tiene que poder hacerse a propósito.
 * Acá la persona lo pide explícitamente, y recién entonces se crea.
 *
 * Usa `createFotofficeWorkspaceForUser`, que crea workspace, membresía de dueño y branding
 * inicial; después sigue por el onboarding que ya existe.
 *
 * **Este archivo es el único del panel autorizado a crear una institución**, y hay una barrera
 * que lo verifica sobre el código fuente: `lib/entrada/sin-institucion-fantasma.test.ts`.
 */
export async function createOwnBusinessAction(): Promise<void> {
  const user = await requireAuth();

  const profiles = await listUserProfiles(user.id);
  const already = profiles.find((p) => p.kind === "TEAM");
  if (already) {
    // Ya tiene negocio: un clic repetido no puede crearle un segundo.
    await setProfileChoice(profileKey(already));
    await setActiveWorkspaceCookie(already.workspaceId);
    redirect("/workspace");
  }

  const ensured = await createFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  await setProfileChoice(`TEAM:${ensured.workspaceId}`);
  redirect("/onboarding");
}
