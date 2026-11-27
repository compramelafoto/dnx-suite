"use server";

import { redirect } from "next/navigation";
import { MARCA } from "@/app/_ui/marca";
import { registerDnxAccount, sanitizeReturnTo } from "@repo/auth";
import { rolSegunRespuesta } from "@/lib/rol-al-registrarse";
import { abrirSesion, urlBaseDeLaApp } from "@/lib/sesion";

export type RegisterFormState = { error: string | null };

export async function registerAction(
  _prev: RegisterFormState | undefined,
  formData: FormData,
): Promise<RegisterFormState> {
  const rol = rolSegunRespuesta(formData.get("esFotografo")?.toString());
  if (!rol) return { error: "Contanos si sos fotógrafo o no." };

  const aceptado = formData.get("acceptedTerms") === "1";
  const returnTo = sanitizeReturnTo(formData.get("returnTo")?.toString(), {
    fallback: "/cuenta/verificacion",
  });

  const result = await registerDnxAccount({
    email: formData.get("email")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
    passwordConfirm: formData.get("passwordConfirm")?.toString() ?? "",
    firstName: formData.get("firstName")?.toString() ?? "",
    lastName: formData.get("lastName")?.toString() ?? "",
    sourceApplication: "equipos",
    appBaseUrl: urlBaseDeLaApp(),
    appLabel: MARCA,
    verifyPath: "/verificar-email",
    createRole: rol,
    acceptedTerms: aceptado,
    acceptedPrivacy: aceptado,
  });
  if (!result.ok) return { error: result.message };

  await abrirSesion(result.user.id);
  redirect(returnTo);
}
