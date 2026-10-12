import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ExportarSeleccion } from "@/components/galerias/exportar-seleccion";
import { ComprasCliente } from "@/components/galerias/compras-cliente";
import { RevisionAlbum } from "@/components/galerias/revision-album";
import { RevisionCliente } from "@/components/galerias/revision-cliente";
import { puedeGestionarGalerias } from "@/lib/galerias/acceso";
import { requireGalerias } from "@/lib/galerias/requerir";
import { cargarResumenVentaCliente } from "@/lib/galerias/compras";
import { cargarRevisionCliente } from "@/lib/galerias/revision";
import { cargarRevisionAlbum, esGaleriaAlbum } from "@/lib/galerias/revision-album";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Revisión de la selección de un cliente de la galería: lo que eligió, sus comentarios (con respuesta), la
 * exportación para Lightroom / Windows / Excel y finalizar o reactivar. Primero la guarda (módulo encendido y
 * "Ver"); la lectura está acotada al workspace de la sesión: un id ajeno o inexistente cae en `notFound()`.
 */
export default async function RevisionClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; clienteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx } = await requireGalerias("ver");
  const { id, clienteId } = await params;
  if (!ID_VALIDO.test(id) || !ID_VALIDO.test(clienteId)) notFound();
  if (await esGaleriaAlbum(ctx, id)) return <RevisionAlbumPage ctx={ctx} id={id} clienteId={clienteId} buscar={await searchParams} />;
  const r = await cargarRevisionCliente(ctx, id, clienteId);
  if (!r) notFound();
  const ventas = await cargarResumenVentaCliente(ctx, id, clienteId);
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
      {ventas ? <ComprasCliente galeriaId={r.galeria.id} clienteId={r.cliente.id} d={ventas} hoy={diaEnBuenosAires(new Date())} puedeGestionar={gestiona} /> : null}
      <ExportarSeleccion galeriaId={r.galeria.id} clienteId={r.cliente.id} total={r.exportacion.total} lightroom={r.exportacion.lightroom} windows={r.exportacion.windows} />
    </div>
  );
}

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** La prueba de álbum de un cliente, ronda por ronda. Misma guarda y mismo acotado al workspace de la sesión. */
async function RevisionAlbumPage({ ctx, id, clienteId, buscar }: { ctx: Awaited<ReturnType<typeof requireGalerias>>["ctx"]; id: string; clienteId: string; buscar: Record<string, string | string[] | undefined> }) {
  const ronda = primero(buscar.ronda);
  const lamina = primero(buscar.lamina);
  const r = await cargarRevisionAlbum(ctx, id, clienteId, ronda === undefined ? undefined : Number(ronda));
  if (!r) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Prueba de álbum de ${r.cliente.nombre}`}
        description={`Álbum N° ${r.galeria.numero} · ${r.galeria.nombre}`}
        actions={
          <Link href={`/galerias/${encodeURIComponent(r.galeria.id)}?tab=clientes`} className="fo-btn fo-btn-secondary text-sm">
            Volver a la galería
          </Link>
        }
      />
      <RevisionAlbum
        key={`${r.cliente.id}:${r.ronda.id}:${r.cliente.estado}:${r.cliente.anulado}:${r.decision?.decision ?? ""}`}
        puedeGestionar={puedeGestionarGalerias(ctx)}
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
          rondas: r.rondas,
          ronda: r.ronda,
          laminas: r.laminas,
          decision: r.decision,
          historial: r.historial,
          respuestasDelEstudio: r.respuestasDelEstudio,
          laminaInicial: lamina && ID_VALIDO.test(lamina) ? lamina : null,
        }}
      />
    </div>
  );
}
