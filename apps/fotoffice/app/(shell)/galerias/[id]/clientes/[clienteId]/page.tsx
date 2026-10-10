import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ExportarSeleccion } from "@/components/galerias/exportar-seleccion";
import { RevisionCliente } from "@/components/galerias/revision-cliente";
import { puedeGestionarGalerias } from "@/lib/galerias/acceso";
import { requireGalerias } from "@/lib/galerias/requerir";
import { cargarRevisionCliente } from "@/lib/galerias/revision";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Revisión de la selección de un cliente de la galería: lo que eligió, sus comentarios (con respuesta), la
 * exportación para Lightroom / Windows / Excel y finalizar o reactivar. Primero la guarda (módulo encendido y
 * "Ver"); la lectura está acotada al workspace de la sesión: un id ajeno o inexistente cae en `notFound()`.
 */
export default async function RevisionClientePage({ params }: { params: Promise<{ id: string; clienteId: string }> }) {
  const { ctx } = await requireGalerias("ver");
  const { id, clienteId } = await params;
  if (!ID_VALIDO.test(id) || !ID_VALIDO.test(clienteId)) notFound();
  const r = await cargarRevisionCliente(ctx, id, clienteId);
  if (!r) notFound();
  const gestiona = puedeGestionarGalerias(ctx);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selección de ${r.cliente.nombre}`}
        description={`Galería N° ${r.galeria.numero} · ${r.galeria.nombre}`}
        actions={
          <Link href={`/galerias/${encodeURIComponent(r.galeria.id)}?tab=clientes`} className="fo-btn fo-btn-secondary text-sm">
            Volver a la galería
          </Link>
        }
      />
      <RevisionCliente
        key={`${r.cliente.id}:${r.cliente.estado}:${r.cliente.anulado}`}
        puedeGestionar={gestiona}
        d={{
          galeriaId: r.galeria.id,
          clienteId: r.cliente.id,
          nombre: r.cliente.nombre,
          email: r.cliente.email,
          telefono: r.cliente.telefono,
          estado: r.cliente.estado,
          anulado: r.cliente.anulado,
          primeraVez: r.cliente.primeraVez,
          enviadoEn: r.cliente.enviadoEn,
          finalizadoEn: r.cliente.finalizadoEn,
          reactivadoEn: r.cliente.reactivadoEn,
          mensaje: r.cliente.mensaje,
          fotos: r.fotos,
        }}
      />
      <ExportarSeleccion galeriaId={r.galeria.id} clienteId={r.cliente.id} total={r.exportacion.total} lightroom={r.exportacion.lightroom} windows={r.exportacion.windows} />
    </div>
  );
}
