import { PestanasInformes } from "@/components/informes/pestanas";
import { puedeConfigurarInformes, requireInformes } from "@/lib/informes/acceso";

/** Guarda de toda la sección: módulo `reports` encendido y permiso para ver dinero. Cada pantalla la vuelve a pedir. */
export default async function InformesLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await requireInformes();
  return (
    <div className="space-y-6">
      <PestanasInformes conAjustes={puedeConfigurarInformes(ctx)} />
      {children}
    </div>
  );
}
