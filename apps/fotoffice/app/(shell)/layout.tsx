import { requireFotofficePanelUser } from "@/lib/shell/require-fotoffice-access";
import { AdminShell } from "@/components/shell/admin-shell";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireFotofficePanelUser();
  return <AdminShell user={user}>{children}</AdminShell>;
}
