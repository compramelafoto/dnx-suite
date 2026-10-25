import { FormularioActividad } from "@/components/formulario/formulario-actividad";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proponé tu muestra" };

export default async function Proponer() {
  await requireUsuario("/panel/proponer");
  return (
    <main className="max-w-3xl space-y-6">
      <h1 className="mf-titulo text-[2.45rem]">Proponé tu muestra o actividad</h1>
      <p className="text-[var(--mf-muted)]">Contanos dónde se puede visitar, cuándo y qué obras se cuelgan. Con eso la difundimos para que la gente vaya. Publicar es gratis.</p>
      <FormularioActividad />
    </main>
  );
}
