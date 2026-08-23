"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { clearProfileChoice, setProfileChoice } from "@/lib/portal/profile-choice";
import {
  findProfileByKey,
  listUserProfiles,
  profileDestination,
  profileKey,
} from "@/lib/portal/profiles";

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
  redirect(profileDestination(chosen));
}

/** Vuelve al selector y olvida la preferencia, para poder elegir de nuevo. */
export async function switchProfileAction(): Promise<void> {
  await clearProfileChoice();
  redirect("/elegir-perfil");
}

/**
 * Crea el workspace propio de un socio que quiere administrar SU negocio con FotoOffice.
 *
 * Es la contracara del guard que evita el "workspace fantasma": crear un negocio no puede
 * ocurrir por accidente al visitar una ruta, pero SÍ tiene que poder hacerse a propósito.
 * Acá la persona lo pide explícitamente, y recién entonces se crea.
 *
 * Reusa `ensureFotofficeWorkspaceForUser`, que ya crea workspace, membresía de dueño y
 * branding inicial; después sigue por el onboarding que ya existe.
 */
export async function createOwnBusinessAction(): Promise<void> {
  const user = await requireAuth();

  const profiles = await listUserProfiles(user.id);
  const already = profiles.find((p) => p.kind === "TEAM");
  if (already) {
    // Ya tiene negocio: un clic repetido no puede crearle un segundo.
    await setProfileChoice(profileKey(already));
    redirect("/workspace");
  }

  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  await setProfileChoice(`TEAM:${ensured.workspaceId}`);
  redirect("/onboarding");
}
