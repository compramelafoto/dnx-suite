import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";

export type FinancialProfileApiResponse = {
  profile: CuantoCobroProfileInput | null;
};

export type FinancialProfileSaveResponse = {
  ok: boolean;
  profile: CuantoCobroProfileInput;
};

/**
 * Cliente HTTP del perfil financiero (solo navegador autenticado vía cookies).
 * No acepta userId: el servidor resuelve el usuario de la sesión.
 */
export async function fetchFinancialProfileFromApi(): Promise<CuantoCobroProfileInput | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/cuantocobro/profile", {
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) return null;
    if (!res.ok) return null;

    const data = (await res.json()) as FinancialProfileApiResponse;
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export async function saveFinancialProfileToApi(
  profile: CuantoCobroProfileInput,
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const res = await fetch("/api/cuantocobro/profile", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });

    return res.ok;
  } catch {
    return false;
  }
}
