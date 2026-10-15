import { redirect } from "next/navigation";
import { canAccessFotorankOrganizerDashboard, requireAuth } from "../lib/auth";

/**
 * Armazón del diseñador: la ventana entera y nada más. Sin el menú ni la cabecera del panel,
 * para que el pliego entre completo sin scrollear. La dirección sigue bajo `/dashboard`.
 */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!(await canAccessFotorankOrganizerDashboard(user))) redirect("/mi-actividad");
  return <div className="h-[100dvh] overflow-hidden bg-[#3a3833]">{children}</div>;
}
