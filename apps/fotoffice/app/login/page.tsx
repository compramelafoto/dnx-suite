import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { resolveFotofficePostLoginDestination } from "@/lib/post-login";
import { LoginView } from "./login-view";

function safeNextPath(raw: string | null | undefined): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    admin?: string;
    error?: string;
    forbiddenApp?: string;
    next?: string;
  }>;
}) {
  const user = await getAuthUser();
  if (user) {
    const dest = await resolveFotofficePostLoginDestination({ userId: user.id });
    redirect(dest.path);
  }

  const sp = await searchParams;
  const initialAdminMode = sp.admin === "1" || sp.admin === "true";
  const nextPath = safeNextPath(sp.next);
  const errorMessage =
    sp.error?.trim() ||
    (sp.forbiddenApp
      ? "Tu cuenta DNX está autenticada, pero aún no tiene acceso a FotoOffice. Contactá soporte o un administrador."
      : null);

  return (
    <LoginView
      initialAdminMode={initialAdminMode}
      errorMessage={errorMessage}
      nextPath={nextPath}
    />
  );
}
