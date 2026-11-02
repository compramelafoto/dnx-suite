import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEventos } from "@/lib/eventos/contexto";
import { resumir } from "@/lib/eventos/reglas";
import { listarInscriptos, obtenerEvento, sincronizarInscriptos } from "@/lib/eventos/servidor";
import { completarQrs } from "@/lib/eventos/acreditacion/servicio";
import { Escaner } from "./Escaner";

export const dynamic = "force-dynamic";

/**
 * La puerta: pensada para el celular de quien recibe. Es el escáner de acreditación de Clickatón
 * (QR con la cámara, código o nombre a mano, y cola sin conexión) sobre los inscriptos del evento.
 */
export default async function PuertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireEventos("MANAGE");
  const { id } = await params;
  await sincronizarInscriptos(workspace.id);
  const evento = await obtenerEvento(workspace.id, id);
  if (!evento) notFound();
  await completarQrs(workspace.id, id);
  const r = resumir(await listarInscriptos(workspace.id, id));

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--fo-muted)]">Acreditación</p>
          <h1 className="text-xl font-semibold">{evento.nombre}</h1>
        </div>
        <Link href={`/eventos/${id}`} className="fo-btn fo-btn-ghost">
          Listado
        </Link>
      </div>

      <p className="text-sm">
        <strong>{r.acreditados}</strong> de <strong>{r.total}</strong> acreditados
      </p>

      <Escaner eventoId={id} habilitada={evento.acreditacionHabilitada} />
    </div>
  );
}
