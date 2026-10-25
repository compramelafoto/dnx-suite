import { PestanasEquipo } from "@/components/equipo/pestanas";
import { requireEquipo } from "@/lib/equipo/acceso";

/** Guarda de toda la sección: módulo `equipo` encendido y dueño o administrador. Cada pantalla y acción lo vuelve a pedir. */
export default async function EquipoLayout({ children }: { children: React.ReactNode }) {
  await requireEquipo();
  return (
    <div className="space-y-6">
      <PestanasEquipo />
      {children}
    </div>
  );
}
