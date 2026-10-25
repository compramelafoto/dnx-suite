import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AccionesContrato } from "@/components/contratos/acciones-contrato";
import { BorradorContrato } from "@/components/contratos/borrador-contrato";
import { FirmantesContrato } from "@/components/contratos/firmantes-contrato";
import { VistaContrato } from "@/components/contratos/vista-contrato";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { puedeGestionarContratos } from "@/lib/contratos/acceso";
import { ETIQUETA_ESTADO_CONTRATO } from "@/lib/contratos/constantes";
import { claseDeEstadoContrato } from "@/lib/contratos/estado-vista";
import { cargarFichaContrato } from "@/lib/contratos/ficha";
import { aBloques } from "@/lib/contratos/formato";
import { requireContratos } from "@/lib/contratos/requerir";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { fechaHoraBA } from "@/lib/ficha/formato";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Ficha de un contrato. Primero la guarda (módulo encendido y "Ver"), después la lectura acotada al
 * workspace de la sesión: un contrato de otro workspace o inexistente cae en `notFound()`. Con
 * "Gestionar" se edita el borrador, se envía, se corrige, se anula y se marca firmado en papel; el
 * servidor lo vuelve a decidir en cada acción. El enlace de firma sólo se entrega con "Gestionar".
 */
export default async function FichaContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireContratos("ver");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();
  const ficha = await cargarFichaContrato(ctx, id);
  if (!ficha) notFound();

  const gestiona = puedeGestionarContratos(ctx);
  const vePedido = puedeEnContexto(ctx, "ver", ORDERS_MODULE_KEY);
  const veContactos = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
  const borrador = ficha.estado === "BORRADOR";
  const textoVigente = ficha.version?.texto ?? ficha.textoBorrador;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Contrato N° ${ficha.numero}`}
        description={ficha.nombre}
        actions={
          <>
            {/* "Descargar PDF" (Tarea 6): no se muestra hasta que el contrato firmado tiene su PDF. */}
            {ficha.tienePdf ? (
              <a href={`/contratos/${encodeURIComponent(ficha.id)}/pdf`} className="fo-btn fo-btn-secondary text-sm">
                Descargar PDF
              </a>
            ) : null}
            <Link href="/contratos" className="fo-btn fo-btn-secondary text-sm">
              Volver a Contratos
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4 self-start">
          <section aria-labelledby="datos-contrato-titulo" className="fo-card space-y-3 p-4">
            <h2 id="datos-contrato-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Datos
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Estado</dt>
                <dd>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstadoContrato(ficha.estado)}`}>{ETIQUETA_ESTADO_CONTRATO[ficha.estado]}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Contacto</dt>
                <dd>
                  {veContactos ? (
                    <Link href={`/clientes/${encodeURIComponent(ficha.contacto.id)}`} className="text-[var(--fo-text)] hover:underline">
                      {ficha.contacto.nombre}
                    </Link>
                  ) : (
                    ficha.contacto.nombre
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Pedido</dt>
                <dd>
                  {vePedido ? (
                    <Link href={`/pedidos/${encodeURIComponent(ficha.pedido.id)}`} className="text-[var(--fo-text)] hover:underline">
                      Pedido N° {ficha.pedido.numero}
                    </Link>
                  ) : (
                    `Pedido N° ${ficha.pedido.numero}`
                  )}
                </dd>
              </div>
              {ficha.plantilla ? (
                <div>
                  <dt className="text-xs text-[var(--fo-muted)]">Plantilla</dt>
                  <dd>{ficha.plantilla}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Creado</dt>
                <dd>{fechaHoraBA(ficha.creadoEn)}</dd>
              </div>
              {ficha.enviadoEn ? (
                <div>
                  <dt className="text-xs text-[var(--fo-muted)]">Enviado a firmar</dt>
                  <dd>{fechaHoraBA(ficha.enviadoEn)}</dd>
                </div>
              ) : null}
              {ficha.firmadoEn ? (
                <div>
                  <dt className="text-xs text-[var(--fo-muted)]">{ficha.firmadoEnPapelEn ? "Firmado en papel" : "Firmado"}</dt>
                  <dd>{fechaHoraBA(ficha.firmadoEn)}</dd>
                </div>
              ) : null}
              {ficha.rechazadoEn ? (
                <div>
                  <dt className="text-xs text-[var(--fo-muted)]">Rechazado</dt>
                  <dd>{fechaHoraBA(ficha.rechazadoEn)}</dd>
                </div>
              ) : null}
              {ficha.anuladoEn ? (
                <div>
                  <dt className="text-xs text-[var(--fo-muted)]">Anulado</dt>
                  <dd>
                    {fechaHoraBA(ficha.anuladoEn)}
                    {ficha.motivoAnulacion ? <span className="block text-[var(--fo-muted)]">Motivo: {ficha.motivoAnulacion}</span> : null}
                  </dd>
                </div>
              ) : null}
              {ficha.respaldoPapel ? (
                <div>
                  <dt className="text-xs text-[var(--fo-muted)]">Respaldo en papel</dt>
                  <dd>
                    {ficha.respaldoPapel.nombre}
                    {veContactos ? (
                      <>
                        {" · "}
                        <Link href={`/clientes/${encodeURIComponent(ficha.contacto.id)}`} className="hover:underline">
                          verlo en la ficha del contacto
                        </Link>
                      </>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {ficha.huellaPdf ? (
                <div>
                  <dt className="text-xs text-[var(--fo-muted)]">Huella del PDF (SHA-256)</dt>
                  <dd className="break-all font-mono text-xs">{ficha.huellaPdf}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {!borrador ? (
            <section aria-labelledby="firmantes-titulo" className="fo-card space-y-3 p-4">
              <h2 id="firmantes-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Firmantes
              </h2>
              <FirmantesContrato firmantes={ficha.firmantes} puedeGestionar={gestiona} />
            </section>
          ) : null}

          {gestiona ? (
            <section aria-labelledby="acciones-titulo" className="fo-card space-y-3 p-4">
              <h2 id="acciones-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Acciones
              </h2>
              <AccionesContrato
                key={`${ficha.estado}:${ficha.version?.id ?? ""}`}
                contratoId={ficha.id}
                clientId={ficha.contacto.id}
                estado={ficha.estado}
                textoVigente={textoVigente}
                adjuntosHabilitados={adjuntosR2Configurado()}
              />
              {ficha.estado === "FIRMADO" || ficha.estado === "ANULADO" ? <p className="text-sm text-[var(--fo-muted)]">Este contrato ya no admite cambios.</p> : null}
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="texto-titulo" className="fo-card space-y-3">
            <h2 id="texto-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              {borrador ? "Borrador del contrato" : ficha.version ? `Texto de la versión ${ficha.version.numero}` : "Texto del contrato"}
            </h2>
            {borrador ? (
              <BorradorContrato key={`${ficha.id}:${ficha.version?.id ?? "borrador"}`} contratoId={ficha.id} nombre={ficha.nombre} texto={ficha.textoBorrador} puedeEditar={gestiona} />
            ) : (
              <>
                {ficha.version ? (
                  <p className="text-xs text-[var(--fo-muted)]">
                    Enviada el {fechaHoraBA(ficha.version.enviadaEn)}
                    {ficha.versiones > 1 ? ` · ${ficha.versiones} versiones en total` : ""}
                    {ficha.version.revocada ? " · reemplazada: los enlaces ya no sirven" : ""}
                  </p>
                ) : null}
                <VistaContrato bloques={aBloques(textoVigente)} />
                {ficha.version ? (
                  <p className="break-all border-t border-[var(--fo-border)] pt-2 text-xs text-[var(--fo-muted)]">
                    Huella del texto (SHA-256): <span className="font-mono">{ficha.version.huella}</span>
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section aria-labelledby="historial-contrato-titulo" className="fo-card space-y-3">
            <h2 id="historial-contrato-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              Historial
            </h2>
            {ficha.eventos.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">Todavía no pasó nada con este contrato.</p>
            ) : (
              <ul className="space-y-4 text-sm">
                {[...ficha.eventos].reverse().map((e) => (
                  <li key={e.id} className="space-y-0.5">
                    <p className="text-xs text-[var(--fo-muted)]">
                      <time dateTime={e.fecha}>{fechaHoraBA(e.fecha)}</time>
                      {e.actor ? ` · ${e.actor}` : ""}
                    </p>
                    <p className="text-[var(--fo-text)]">
                      {e.etiqueta}
                      {e.firmante ? ` — ${e.firmante}` : ""}
                      {e.detalle ? <span className="text-[var(--fo-muted)]"> ({e.detalle})</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
