import { ArmazonProyectos } from "@/components/proyectos/armazon";
import { requireProyectos } from "@/lib/proyectos/pagina";
import { ImportarTrabajos } from "./importar-trabajos";

export const dynamic = "force-dynamic";

/** Traer los trabajos abiertos de las planillas de Google al tablero de Trabajos en curso. */
export default async function ImportarTrabajosPage() {
  await requireProyectos("operar");
  return (
    <ArmazonProyectos activa="en-curso">
      <ImportarTrabajos />
    </ArmazonProyectos>
  );
}
