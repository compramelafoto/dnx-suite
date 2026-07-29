import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Ruta legacy: /admin/login ya no tiene UI propia, se usa el login unificado. */
export default async function AdminLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await Promise.resolve(searchParams);
  const redirectParam = params?.redirect || "";
  const safeRedirect = redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : "";

  redirect(safeRedirect ? `/login?redirect=${encodeURIComponent(safeRedirect)}` : "/login");
}
