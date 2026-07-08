import type { IdentityAppAccess } from "@repo/auth";

export const DNX_SESSION_COOKIE = "dnx_session";

export declare function getSessionUserByRawToken(rawToken: string): Promise<{
  id: number;
  name: string | null;
  email: string;
  role: string;
} | null>;

export declare function getSessionIdentityByRawToken(
  rawToken: string,
  params?: { currentWorkspaceId?: string | null },
): Promise<{
  globalRole: string;
  currentWorkspaceId: string | null;
  workspaceRole: string | null;
  appAccess: IdentityAppAccess[];
} | null>;

export type { IdentityAppAccess };
