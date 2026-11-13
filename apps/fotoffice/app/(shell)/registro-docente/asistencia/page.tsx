import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { datosParaPasarLista } from "@/lib/registro-docente/servidor";
import { fechaArgentina } from "@/lib/registro-docente/asistencia";
import { PasarLista } from "./pasar-lista";

export const dynamic = "force-dynamic";

/** Días hacia atrás que se traen al celular, para poder corregir una lista vieja sin señal. */
const DIAS_ATRAS = 45;

function haceDias(n: number): string {
  return fechaArgentina(new Date(Date.now() - n * 86_400_000));
}

export default async function AsistenciaPage() {
  const { workspace } = await requireRegistro("MANAGE");
  const hoy = fechaArgentina();
  const desde = haceDias(DIAS_ATRAS);
  const cursos = await datosParaPasarLista(workspace.id, desde);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Pasar lista"
        description="Todos empiezan presentes: tocá sólo a quien falta o llega tarde. Abrí esta pantalla con señal antes de entrar al aula; si después se corta, seguí tomando lista: queda guardada en el celular y se manda sola cuando vuelve la conexión."
      />
      <PasarLista cursos={cursos} hoy={hoy} />
    </div>
  );
}
