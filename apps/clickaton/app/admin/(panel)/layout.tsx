import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminPanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-clickaton-pathname") ?? "/admin";
  const user = await requireClickatonAdmin({ returnTo: pathname });

  return (
    <AdminShell userName={user.name} userEmail={user.email}>
      {children}
    </AdminShell>
  );
}
