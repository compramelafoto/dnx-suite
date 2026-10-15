"use server";

import { SponsorsError } from "@/lib/sponsors/repository";
import { submitSelfSignup } from "@/lib/sponsors/self-signup";

export type AutoaltaState = {
  error: string | null;
  ok: "saved" | "none" | "failed" | null;
  /** Lo que escribió, para devolvérselo si hubo un error: el formulario se reinicia al enviar. */
  valores?: Record<string, string>;
};

const CAMPOS = [
  "name",
  "websiteUrl",
  "instagram",
  "facebookUrl",
  "description",
  "benefitTitle",
  "benefitText",
  "contactName",
  "contactEmail",
  "contactPhone",
] as const;

/**
 * El sponsor manda sus datos desde el enlace que le pasó la institución.
 *
 * El token es la credencial: se vuelve a validar acá, sin confiar en que la página ya lo haya
 * hecho. No hay sesión ni cuenta.
 */
export async function enviarAutoaltaSponsorAction(
  token: string,
  _prev: AutoaltaState,
  formData: FormData,
): Promise<AutoaltaState> {
  const campo = (k: string) => formData.get(k)?.toString() ?? "";
  const logo = formData.get("logo");
  const valores = Object.fromEntries(CAMPOS.map((k) => [k, campo(k)]));
  try {
    const r = await submitSelfSignup(token, {
      name: campo("name"),
      websiteUrl: campo("websiteUrl"),
      instagram: campo("instagram"),
      facebookUrl: campo("facebookUrl"),
      description: campo("description"),
      benefitTitle: campo("benefitTitle"),
      benefitText: campo("benefitText"),
      contactName: campo("contactName"),
      contactEmail: campo("contactEmail"),
      contactPhone: campo("contactPhone"),
      logo: logo instanceof File && logo.size > 0 ? logo : null,
    });
    return { error: null, ok: r.logo };
  } catch (error) {
    if (error instanceof SponsorsError) return { error: error.message, ok: null, valores };
    console.error("[fotoffice][sponsors] autoalta: falló el envío", {
      detalle: error instanceof Error ? error.message : String(error),
    });
    return { error: "No pudimos guardar tus datos. Probá de nuevo en un rato.", ok: null, valores };
  }
}
