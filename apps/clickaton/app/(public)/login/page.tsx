import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { adminRoutes } from "@/config/admin/navigation";
import {
  getClickatonAuthUser,
  hasClickatonAdminAccess,
} from "@/lib/admin/auth";
import { friendlyGoogleLoginError } from "@/lib/auth/google-oauth";
import { resolveClickatonPostLoginPath } from "@/lib/auth/post-login";
import { sanitizeClickatonReturnPath } from "@/lib/auth/return-path";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function UnifiedLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = sanitizeClickatonReturnPath(sp.next);
  const oauthError = friendlyGoogleLoginError(sp.error);
  const user = await getClickatonAuthUser();

  if (user) {
    const destination = resolveClickatonPostLoginPath({
      email: user.email,
      globalRole: user.globalRole,
      next: nextPath,
    });
    if (
      nextPath.startsWith("/admin") &&
      !hasClickatonAdminAccess(user) &&
      destination.path === adminRoutes.forbidden
    ) {
      redirect(adminRoutes.forbidden);
    }
    redirect(destination.path);
  }

  return <LoginForm nextPath={nextPath} oauthError={oauthError} />;
}
