import { FormularioActividad } from "@/components/formulario/formulario-actividad";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proponé tu muestra" };

export default async function Proponer() {
  await requireUsuario("/proponer");
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <h1 className="mf-titulo text-[2.45rem]">Proponé tu muestra o actividad</h1>
      <p className="text-[var(--mf-muted)]">La revisamos antes de publicarla en el mapa. Te avisamos por mail.</p>
      <FormularioActividad />
    </main>
  );
}
