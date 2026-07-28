import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { isUserMercadoPagoConnected } from "@/lib/admin/mp-connection-status";

export default async function AdminPanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-clickaton-pathname") ?? "/admin";
  const user = await requireClickatonAdmin({ returnTo: pathname });
  const mpConnected = await isUserMercadoPagoConnected({ userId: user.id });

  return (
    <AdminShell
      userName={user.name}
      userEmail={user.email}
      mpConnected={mpConnected}
    >
      {children}
    </AdminShell>
  );
}
