import { requireServiceLeadsStaff } from "@/lib/service-leads/access";

/** Guarda de toda la sección: módulo encendido y rol que opera. Cada pantalla la vuelve a pedir. */
export default async function CaptacionLayout({ children }: { children: React.ReactNode }) {
  await requireServiceLeadsStaff();
  return <>{children}</>;
}
