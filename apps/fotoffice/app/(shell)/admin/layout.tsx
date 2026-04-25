import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";

/**
 * Todas las rutas bajo `/admin/*` requieren SUPER_ADMIN global
 * (o fallback explícito por email en FOTOFFICE_PLATFORM_ADMIN_EMAILS).
 */
export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!(await isFotofficePlatformAdmin(user.id))) {
    redirect("/dashboard?forbidden=admin");
  }
  return <div className="space-y-10">{children}</div>;
}
