"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAuth } from "../lib/auth";
import {
  FOTORANK_ACTIVE_ORG_COOKIE,
  FOTORANK_ACTIVE_ORG_MAX_AGE,
} from "../lib/fotorank/dashboard-org-context";
import { getUserOrganizations } from "../lib/fotorank/organizations";

export async function setFotorankActiveOrganization(
  organizationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth();
  const id = organizationId.trim();
  if (!id) return { ok: false, error: "Organización inválida." };

  const orgs = await getUserOrganizations(user.id);
  const match = orgs.find((o) => o.id === id);
  if (!match) return { ok: false, error: "No tenés acceso a esa organización." };

  const store = await cookies();
  store.set(FOTORANK_ACTIVE_ORG_COOKIE, match.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: FOTORANK_ACTIVE_ORG_MAX_AGE,
    path: "/",
  });

  revalidatePath("/jurados", "layout");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
