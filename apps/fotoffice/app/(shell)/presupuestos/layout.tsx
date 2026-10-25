import { requirePresupuestos } from "@/lib/presupuestos/pagina";

/** Guarda de toda la sección: módulo `quotes` encendido y "Ver". Cada pantalla la vuelve a pedir. */
export default async function PresupuestosLayout({ children }: { children: React.ReactNode }) {
  await requirePresupuestos("ver");
  return <>{children}</>;
}
