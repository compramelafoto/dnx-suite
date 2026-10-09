import { requireContratos } from "@/lib/contratos/requerir";

/** Guarda de toda la sección: módulo `contracts` encendido y "Ver". Cada pantalla la vuelve a pedir. */
export default async function ContratosLayout({ children }: { children: React.ReactNode }) {
  await requireContratos("ver");
  return <>{children}</>;
}
