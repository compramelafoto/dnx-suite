"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { PORTAL_HOME } from "@/lib/portal/destination";
import { clearProfileChoice, setProfileChoice } from "@/lib/portal/profile-choice";
import {
  counterpartProfile,
  findProfileByKey,
  listUserProfiles,
  profileDestination,
  profileKey,
} from "@/lib/portal/profiles";
import { setActiveWorkspaceCookie } from "@/lib/workspace-cookie";

/**
 * Guarda con qué perfil eligió entrar la persona y la lleva ahí.
 *
 * La clave que manda el navegador NO se cree: se vuelve a armar la lista real de perfiles en
 * el servidor y se busca la clave dentro de ella. Una clave inventada, o de un perfil ajeno,
 * simplemente no aparece — y se vuelve a preguntar.
 *
 * Elegir no otorga permisos: cada ruta sigue autorizando por su cuenta.
 */
export async function chooseProfileAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const key = formData.get("profile")?.toString()?.trim() ?? "";

  const profiles = await listUserProfiles(user.id);
  const chosen = findProfileByKey(profiles, key);
  if (!chosen) redirect("/elegir-perfil");

  await setProfileChoice(profileKey(chosen));
  // La cookie de institución activa manda en el panel: sin esto, una vieja abriría otra.
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
