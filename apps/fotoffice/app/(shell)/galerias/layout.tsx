import { requireGalerias } from "@/lib/galerias/requerir";

/** Guarda de toda la sección: módulo `gallery` encendido y "Ver". Cada pantalla la vuelve a pedir. */
export default async function GaleriasLayout({ children }: { children: React.ReactNode }) {
  await requireGalerias("ver");
  return <>{children}</>;
}
