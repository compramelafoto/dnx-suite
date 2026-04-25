import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getFotofficePostLoginPath, resolvePlatformRole } from "@/lib/fotoffice-roles";
import { LoginView } from "./login-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const user = await getAuthUser();
  if (user) {
    redirect(getFotofficePostLoginPath(resolvePlatformRole({ globalRole: user.globalRole, legacyRole: user.role })));
  }

  const sp = await searchParams;
  const initialAdminMode = sp.admin === "1" || sp.admin === "true";

  return <LoginView initialAdminMode={initialAdminMode} />;
}
