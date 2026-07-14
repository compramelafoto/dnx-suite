"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import {
  listActivePublicProfiles,
  isPublicProfileType,
  type PublicProfileType,
} from "@/lib/dnx-user-profiles";
import { HOME_EXPERIENCE_COOKIE } from "@/lib/home-experience";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 días

export async function setHomeExperienceModeAction(formData: FormData): Promise<void> {
  const raw = String(formData.get("mode") ?? "").trim().toUpperCase();
  if (!isPublicProfileType(raw)) return;

  const user = await getAuthUser();
  if (!user) return;

  const profiles = await listActivePublicProfiles(user.id);
  const active = profiles.map((p) => p.profileType);
  if (!active.includes(raw)) return;

  const cookieStore = await cookies();
  cookieStore.set(HOME_EXPERIENCE_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure:
      process.env.VERCEL === "1" ||
      process.env.NODE_ENV === "production",
  });

  revalidatePath("/");
}

export async function readPreferredHomeModeFromCookie(): Promise<PublicProfileType | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(HOME_EXPERIENCE_COOKIE)?.value;
  if (!raw) return null;
  const value = raw.trim().toUpperCase();
  return isPublicProfileType(value) ? value : null;
}
