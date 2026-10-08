import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AccionesPresupuesto } from "@/components/presupuestos/acciones-presupuesto";
import { EditorPresupuesto } from "@/components/presupuestos/editor-presupuesto";
import { EnviarPresupuesto } from "@/components/presupuestos/enviar-presupuesto";
import { VistaPresupuesto } from "@/components/presupuestos/vista-presupuesto";
import { claseDeEstado } from "@/lib/presupuestos/listado";
import { puedeGestionarPresupuestos } from "@/lib/presupuestos/acceso";
import { ETIQUETA_ESTADO } from "@/lib/presupuestos/constantes";
import { armarDatosEditor } from "@/lib/presupuestos/editor";
import { catalogoParaEditor, costosCatalogoParaEditor, perfilDelWorkspace } from "@/lib/presupuestos/editor-datos";
import { requirePresupuestos } from "@/lib/presupuestos/pagina";
import { leerPresupuesto } from "@/lib/presupuestos/presupuestos";
import { opcionesDeEnvio } from "@/lib/presupuestos/envio";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const fecha = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "—");

/**
 * Ficha y editor de un presupuesto. Con un borrador (la V1 sin enviar o la versión siguiente) y
 * "Gestionar", el editor; si no, la versión vigente para leer.
 *
 * Costos (R4): `leerPresupuesto` ya saca la instantánea del cálculo y `costSnapshot` sin
 * `configurar`; los costos del catálogo y el perfil de ¿Cuánto Cobro? se leen sólo con
 * `veCostos`, y `armarDatosEditor` sólo arma `internos` con ese permiso. Al navegador de quien no
 * lo tiene no le llega ningún costo.
 */
export default async function PresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace, ctx } = await requirePresupuestos("ver");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();
  const detalle = await leerPresupuesto(ctx, id);
  if (!detalle) notFound();

  const gestiona = puedeGestionarPresupuestos(ctx);
  const borrador = detalle.borrador;
  const vigente = detalle.vigente;
  const editando = borrador !== null && gestiona;

  let editor: React.ReactNode = null;
  if (editando && borrador) {
    const catalogo = await catalogoParaEditor(workspace.id);
    const ids = [...new Set([...catalogo.map((p) => p.id), ...borrador.items.map((i) => i.productId).filter((x): x is string => !!x)])];
    const [costosCatalogo, perfil] = detalle.veCostos
      ? await Promise.all([costosCatalogoParaEditor(ctx, ids), perfilDelWorkspace(ctx)])
      : [undefined, null];
    const datos = armarDatosEditor({
      presupuestoId: detalle.id,
      borrador: { id: borrador.id, number: borrador.number, items: borrador.items, totals: borrador.totals, terms: borrador.terms, paymentProposal: borrador.paymentProposal },
      catalogo,
      veCostos: detalle.veCostos,
      costosCatalogo,
      perfil,
    });
    // La clave cambia con cada guardado: después de `router.refresh()` el editor se vuelve a montar
    // con lo que guardó el servidor (precios recalculados, ítems validados), no con su estado viejo.
    editor = <EditorPresupuesto key={`${borrador.id}:${detalle.updatedAt.getTime()}`} datos={datos} puedeGuardar />;
  }

  // Enviar / Reenviar / Copiar enlace: con "Gestionar" y mientras no esté aceptado (el enlace se
  // puede copiar igual de uno aceptado: el cliente ve su aceptación).
  const envio = gestiona ? await opcionesDeEnvio(ctx, detalle.id) : null;
  const enviadoVigente = vigente !== null && vigente.sentAt !== null;
  const titulo = detalle.numero ? `Presupuesto N° ${detalle.numero}` : "Presupuesto sin enviar";
  const ultima = detalle.versiones.at(-1)?.number ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={titulo}
        description={`${detalle.contacto} · vence el ${fecha(detalle.validUntil)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/consultas/${encodeURIComponent(detalle.consultaLeadId)}`} className="fo-btn fo-btn-secondary text-sm">
              Ver la consulta
            </Link>
            <Link href="/presupuestos" className="fo-btn fo-btn-secondary text-sm">
              Volver a Presupuestos
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstado(detalle.estado)}`}>{ETIQUETA_ESTADO[detalle.estado]}</span>
        <span className="text-[var(--fo-muted)]">
          {detalle.versiones.map((v) => `V${v.number}${v.sentAt ? "" : " (borrador)"}`).join(" · ")}
        </span>
        {detalle.pedidoPorConfirmar ? <span className="text-[var(--fo-muted)]">Pedido por confirmar</span> : null}
      </div>

      {gestiona ? (
        <AccionesPresupuesto
          presupuestoId={detalle.id}
          // Editar uno enviado: crea la versión siguiente (si ya hay un borrador, el editor ya está abierto).
          puedeVersionar={enviadoVigente && borrador === null && detalle.estado !== "ACEPTADO"}
          puedeRechazar={["ENVIADO", "VISTO", "VENCIDO"].includes(detalle.estado)}
          siguienteVersion={ultima + 1}
        />
      ) : null}

      {envio ? <EnviarPresupuesto presupuestoId={detalle.id} opciones={envio} /> : null}

      {editando && borrador && enviadoVigente && vigente && vigente.id !== borrador.id ? (
        <p className="fo-card text-sm text-[var(--fo-muted)]">
          Estás editando la V{borrador.number}. El enlace sigue mostrando la V{vigente.number} hasta que envíes esta.
        </p>
      ) : null}

      {editor ??
        (vigente ? (
          <VistaPresupuesto
            items={vigente.items}
            totales={vigente.totals}
            condiciones={vigente.terms}
            propuestaPago={vigente.paymentProposal}
            costos={detalle.veCostos ? vigente.costos : null}
          />
        ) : (
          <p className="fo-card text-sm text-[var(--fo-muted)]">Este presupuesto todavía no tiene una versión para mostrar.</p>
        ))}
    </div>
  );
}
