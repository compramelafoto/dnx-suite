import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
  destroyUserSessionByRawToken,
  getSessionIdentityByRawToken,
  getSessionUserByRawToken,
} from "@repo/auth";
import { isPrismaDbUnavailableError } from "@/lib/prisma-errors";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;
const APP_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";
const IS_SECURE_CONTEXT =
  process.env.VERCEL === "1" ||
  process.env.NODE_ENV === "production" ||
  APP_URL.startsWith("https://");

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_SECURE_CONTEXT,
  sameSite: "lax" as const,
  path: "/",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

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

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const sessionUser = await getSessionUserByRawToken(raw);
    if (!sessionUser) return null;
    const requestedWorkspaceId = cookieStore.get(FOTOFFICE_WORKSPACE_COOKIE)?.value ?? null;
    const identity = await getSessionIdentityByRawToken(raw, { currentWorkspaceId: requestedWorkspaceId });
    return {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role,
      globalRole: identity?.globalRole ?? (sessionUser.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"),
      currentWorkspaceId: identity?.currentWorkspaceId ?? requestedWorkspaceId,
      workspaceRole: identity?.workspaceRole ?? null,
      appAccess: identity?.appAccess ?? [],
    };
  } catch (e) {
    if (isPrismaDbUnavailableError(e)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[fotoffice] Base de datos no disponible; sesión no verificada (se muestra como no autenticado).",
        );
      }
      return null;
    }
    throw e;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

export function hasAppAccess(
  user: AuthUser | null,
  app: "FOTOFFICE" | "COMPRAMELAFOTO" | "FOTORANK",
): boolean {
  if (!user) return false;
  if (user.globalRole === "SUPER_ADMIN") return true;
  if (
    app === "FOTOFFICE" &&
    (user.workspaceRole === "WORKSPACE_OWNER" ||
      user.workspaceRole === "WORKSPACE_ADMIN" ||
      user.workspaceRole === "ADMIN")
  ) {
    return true;
  }
  if (user.appAccess.length > 0) {
    return user.appAccess.some((a) => a.app === app && a.enabled);
  }
  // Legacy fallback must be explicit and opt-in.
  if (process.env.DNX_LEGACY_APP_ACCESS_FALLBACK !== "1") return false;
  if (app === "FOTOFFICE" && (user.role === "SUPER_ADMIN" || user.role === "ADMIN")) {
    return true;
  }
  return false;
}

export async function createFotofficeSessionForUser(userId: number): Promise<void> {
  const session = await createUserSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
}

export async function destroyFotofficeSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (raw) await destroyUserSessionByRawToken(raw);
  cookieStore.set(DNX_SESSION_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
  cookieStore.set(FOTOFFICE_WORKSPACE_COOKIE, "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
