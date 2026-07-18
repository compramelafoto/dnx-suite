import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { resolveFotofficePostLoginDestination } from "@/lib/post-login";
import { LoginView } from "./login-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string; error?: string; forbiddenApp?: string }>;
}) {
  const user = await getAuthUser();
  if (user) {
    const dest = await resolveFotofficePostLoginDestination({ userId: user.id });
    redirect(dest.path);
  }

  const sp = await searchParams;
  const initialAdminMode = sp.admin === "1" || sp.admin === "true";
  const errorMessage =
    sp.error?.trim() ||
    (sp.forbiddenApp
      ? "Tu cuenta no tiene acceso a FotOffice todavía. Ingresá con Google o contactá soporte."
      : null);

  return (
    <LoginView initialAdminMode={initialAdminMode} errorMessage={errorMessage} />
  );
}
