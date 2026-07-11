import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DNX_SESSION_COOKIE,
  getSessionIdentityByRawToken,
  getSessionUserByRawToken,
} from "@repo/auth";

export type AuthUser = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  globalRole: string;
  currentWorkspaceId: string | null;
  workspaceRole: string | null;
  appAccess: Array<{ app: string; enabled: boolean; appRole: string | null }>;
};

/**
 * Sesión DNX compartida (cookie `dnx_session`).
 * Emisión local: `/ingresar` → `createInfoSpotSession`.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const sessionUser = await getSessionUserByRawToken(raw);
  if (!sessionUser) return null;
  if (sessionUser.isBlocked) return null;

  const identity = await getSessionIdentityByRawToken(raw);
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    role: sessionUser.role,
    globalRole: identity?.globalRole ?? (sessionUser.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"),
    currentWorkspaceId: identity?.currentWorkspaceId ?? null,
    workspaceRole: identity?.workspaceRole ?? null,
    appAccess: identity?.appAccess ?? [],
  };
}

export async function requireAuth(options?: { redirectTo?: string }): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    redirect(options?.redirectTo ?? "/ingresar?forbidden=login");
  }
  return user;
}
