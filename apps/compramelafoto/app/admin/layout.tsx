import { Role } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { getAuthUser } from "@/lib/auth";
import { getPostLoginDestination } from "@/lib/auth/post-login-destination";

function resolveNonAdminRedirect(role: Role): string {
  return getPostLoginDestination(role);
}

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== Role.ADMIN && String(user.role) !== "SUPER_ADMIN") {
    redirect(resolveNonAdminRedirect(user.role));
  }

  return <AdminLayout>{children}</AdminLayout>;
}
