import { AdminShell } from "@/components/admin/AdminShell";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminPanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireClickatonAdmin();

  return (
    <AdminShell userName={user.name} userEmail={user.email}>
      {children}
    </AdminShell>
  );
}
