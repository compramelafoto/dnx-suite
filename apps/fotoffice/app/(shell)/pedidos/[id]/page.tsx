import { prisma } from "@repo/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MensajeRegistrado } from "@/components/mensajes/mensaje-registrado";
import { AccionesPedido } from "@/components/pedidos/acciones-pedido";
import { ChecklistDelPedido } from "@/components/pedidos/checklist-del-pedido";
import { CobrosDelPedido, type CobroVista } from "@/components/pedidos/cobros-del-pedido";
import { CostosYPagos } from "@/components/pedidos/costos-y-pagos";
import { EditarPlan } from "@/components/pedidos/editar-plan";
import { EnviarPedido } from "@/components/pedidos/enviar-pedido";
import { ProyectosDelPedido } from "@/components/pedidos/proyectos-del-pedido";
import { ContratantesDelPedido } from "@/components/contratos/contratantes-del-pedido";
import { ContratosDelPedido } from "@/components/contratos/contratos-del-pedido";
import { aItemDePedido, ItemsPedido } from "@/components/pedidos/items-pedido";
import { RegistrarCobro } from "@/components/pedidos/registrar-cobro";
import { TarjetaCitas } from "@/components/agenda/tarjeta-citas";
import { puedeEnContexto } from "@/lib/access/policy";
import { citasDeOrigen } from "@/lib/agenda/de-origen";
import { puedeGestionarContratos, puedeVerContratos } from "@/lib/contratos/acceso";
import { contratosEncendidos } from "@/lib/contratos/contexto";
import { leerContratantes } from "@/lib/contratos/contratantes";
import { listarPlantillas } from "@/lib/contratos/plantillas";
import { contratosParaTarjeta } from "@/lib/contratos/tarjetas";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { claseDeColorEtiqueta, fechaHoraBA } from "@/lib/ficha/formato";
import { puedeGestionarPedidos } from "@/lib/pedidos/acceso";
import { leerChecklist } from "@/lib/pedidos/checklist";
import { costosYPagosDelPedido, proveedoresParaCuentas, puedeGestionarCuentas, rubrosDeCosto } from "@/lib/pedidos/cuentas-pagar";
import { ETIQUETA_ESTADO_CUOTA, ETIQUETA_ESTADO_PEDIDO, ETIQUETA_MEDIO_COBRO, esMedioCobro, type EstadoCuota } from "@/lib/pedidos/constantes";
import { opcionesDeEnvioPedido } from "@/lib/pedidos/envio";
import { estadosSiguientes } from "@/lib/pedidos/estado";
import { comprobantesDeCobros, costosDelPedido, mensajesDePedido, rubrosDeIngreso } from "@/lib/pedidos/ficha";
import { claseDeEstadoPedido } from "@/lib/pedidos/listado";
import { requirePedidos } from "@/lib/pedidos/pagina";
import { ajustePorFormaDePago, fechaCorta, pesosConSigno, pesosPedido } from "@/lib/pedidos/pantalla";
import { leerPedido } from "@/lib/pedidos/pedidos";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { puedeGestionarProyectos, puedeVerProyectos } from "@/lib/proyectos/acceso";
import { proyectosEncendidos } from "@/lib/proyectos/crear";
import { proyectosDeUnPedido } from "@/lib/proyectos/del-pedido";
import { opcionesDeRegla } from "@/lib/proyectos/reglas-catalogo";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

const COLOR_CUOTA: Record<EstadoCuota, string> = {
  PAGADA: "verde",
  PARCIAL: "violeta",
  VENCIDA: "rojo",
  PENDIENTE: "gris",
  CANCELADA: "gris",
};

type Hito = { clave: string; fecha: string; texto: string };

/**
 * Ficha del pedido (0.3): evento, ítems, plan de cuotas con su estado, cobros con su recibo e
 * historial (los mensajes registrados en el pedido y los cobros). Con "Gestionar": registrar y
 * anular cobros, editar el plan, cambiar el estado y el rubro, copiar el enlace del cliente y
 * enviarlo por correo o WhatsApp.
 *
 * Costos (Global Constraints): `leerPedido` ya saca el cálculo de los ítems sin permiso, y el costo
 * y el margen se leen sólo con `detalle.veCostos` (`configurar` o `verDinero`). Al navegador de
 * quien no lo tiene no le llega ningún costo. Lo mismo "Costos y pagos" (cuentas a pagar, margen
 * previsto y margen real, Entrega B1): sólo se lee y se monta con `detalle.veCostos`.
 */
export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace, ctx } = await requirePedidos("ver");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();
  const detalle = await leerPedido(ctx, id);
  if (!detalle) notFound();

  const gestiona = puedeGestionarPedidos(ctx);
  const cancelado = detalle.estado === "CANCELADO";
  const hoy = diaEnBuenosAires(new Date());
  const costos = detalle.veCostos ? await costosDelPedido(ctx, detalle) : null;
  const costosYPagos = detalle.veCostos
    ? await costosYPagosDelPedido(ctx, { id: detalle.id, total: detalle.plan.total, cobrado: detalle.plan.cobrado })
    : null;
  const gestionaCuentas = costosYPagos !== null && puedeGestionarCuentas(ctx);
  const [proveedores, rubrosCosto] = gestionaCuentas
    ? await Promise.all([
        proveedoresParaCuentas(workspace.id, costosYPagos.cuentas.flatMap((c) => (c.proveedorId ? [c.proveedorId] : []))),
        rubrosDeCosto(workspace.id, costosYPagos.cuentas.flatMap((c) => (c.rubroId ? [c.rubroId] : []))),
      ])
    : [[], []];
  const checklist = await leerChecklist(ctx, detalle.id);
  const idsHechas = [...new Set((checklist?.tareas ?? []).flatMap((t) => (t.hechaPorId !== null ? [t.hechaPorId] : [])))];
  const usuarios =
    idsHechas.length > 0 ? await prisma.user.findMany({ where: { id: { in: idsHechas } }, select: { id: true, name: true, email: true } }) : [];
  const nombreDe = new Map(usuarios.map((u) => [u.id, etiquetaDeUsuario(u)]));
  const tareasVista = (checklist?.tareas ?? []).map((t) => ({
    id: t.id,
    titulo: t.titulo,
    hecha: t.hecha,
    detalle: t.hechaEn ? [t.hechaPorId !== null ? nombreDe.get(t.hechaPorId) : null, fechaHoraBA(t.hechaEn)].filter(Boolean).join(" · ") : null,
  }));
  // Proyectos (Etapa 4): sólo con el módulo encendido y "Ver" en Proyectos.
  const verProyectos = puedeVerProyectos(ctx) && (await proyectosEncendidos(workspace.id));
  const gestionaProyectos = verProyectos && puedeGestionarProyectos(ctx) && !cancelado;
  const [proyectos, opcionesProyecto] = verProyectos
    ? await Promise.all([
        proyectosDeUnPedido(ctx, detalle.id),
        gestionaProyectos ? opcionesDeRegla(workspace.id) : Promise.resolve({ circuitos: [], equipo: [] }),
      ])
    : [[], { circuitos: [], equipo: [] }];
  // Tarjeta "Citas": sólo con el módulo Agenda encendido y "Ver" en Agenda.
  const citas = await citasDeOrigen(ctx, { pedidoId: detalle.id });
  // Contratantes (Etapa 5): sólo con el módulo Contratos encendido y "Ver" en Contratos.
  const verContratos = puedeVerContratos(ctx) && (await contratosEncendidos(workspace.id));
  const contratantes = verContratos ? await leerContratantes(ctx, detalle.id) : null;
  // Tarjeta "Contratos": los contratos del pedido y, con "Gestionar", el selector de plantilla para generar uno.
  const gestionaContratos = verContratos && puedeGestionarContratos(ctx) && !cancelado;
  const [contratosDelPedido, plantillasContrato] = verContratos
    ? await Promise.all([
        contratosParaTarjeta(ctx, { pedidoId: detalle.id }),
        gestionaContratos ? listarPlantillas(ctx) : Promise.resolve([]),
      ])
    : [null, []];
  const [mensajes, comprobantes, envio, rubros] = await Promise.all([
    mensajesDePedido(workspace.id, detalle.id),
    comprobantesDeCobros(workspace.id, detalle.cobros.map((c) => c.id)),
    gestiona ? opcionesDeEnvioPedido(ctx, detalle.id) : Promise.resolve(null),
    gestiona ? rubrosDeIngreso(workspace.id, detalle.incomeCategoryId) : Promise.resolve([]),
  ]);

  const plan = detalle.plan;
  // Descuento del contado o interés del plan, para que Total de los ítems + ajuste = Total.
  const totalItems = detalle.totals && typeof detalle.totals.total === "number" ? detalle.totals.total : null;
  const ajuste = totalItems !== null ? ajustePorFormaDePago(plan.total, totalItems) : null;
  const cuotasConSaldo = plan.cuotas
    .filter((c) => c.estado !== "PAGADA" && c.estado !== "CANCELADA" && c.saldo > 0)
    .map((c) => ({ id: c.id, position: c.position, dueDate: c.dueDate, amountArs: c.amountArs, saldo: c.saldo }));
  const cobros: CobroVista[] = detalle.cobros.map((c) => ({
    id: c.id,
    numero: c.receiptNumber,
    fecha: c.paidAt.toISOString(),
    medio: esMedioCobro(c.method) ? ETIQUETA_MEDIO_COBRO[c.method] : c.method,
    importe: c.amountArs,
    anulado: c.voidedAt !== null,
    motivo: c.voidReason,
    comprobante: comprobantes.get(c.id) ?? null,
  }));

  const hitos: Hito[] = [
    { clave: "alta", fecha: detalle.createdAt.toISOString(), texto: detalle.presupuestoId ? "Pedido confirmado desde el presupuesto." : "Pedido creado." },
    ...detalle.cobros.flatMap((c): Hito[] => [
      { clave: `cobro-${c.id}`, fecha: c.paidAt.toISOString(), texto: `Cobro de ${pesosPedido(c.amountArs)} · recibo N° ${c.receiptNumber}.` },
      ...(c.voidedAt ? [{ clave: `anulado-${c.id}`, fecha: c.voidedAt.toISOString(), texto: `Recibo N° ${c.receiptNumber} anulado.` }] : []),
    ]),
  ];
  type Entrada = { tipo: "hito"; hito: Hito; fecha: string } | { tipo: "mensaje"; mensaje: (typeof mensajes)[number]; fecha: string };
  const historial: Entrada[] = [
    ...hitos.map((h): Entrada => ({ tipo: "hito", hito: h, fecha: h.fecha })),
    ...mensajes.map((m): Entrada => ({ tipo: "mensaje", mensaje: m, fecha: m.fecha })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const veContacto = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
  const vePresupuesto = detalle.presupuestoId !== null && puedeEnContexto(ctx, "ver", QUOTES_MODULE_KEY);
  const veConsulta = detalle.consultaLeadId !== null && puedeEnContexto(ctx, "ver", SERVICE_LEADS_MODULE_KEY);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pedido N° ${detalle.numero}`}
        description={[detalle.contacto, detalle.eventLabel].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            {veContacto ? (
              <Link href={`/clientes/${encodeURIComponent(detalle.clientId)}`} className="fo-btn fo-btn-secondary text-sm">
                Ver el contacto
              </Link>
            ) : null}
            {vePresupuesto ? (
              <Link href={`/presupuestos/${encodeURIComponent(detalle.presupuestoId!)}`} className="fo-btn fo-btn-secondary text-sm">
                Ver el presupuesto
              </Link>
            ) : null}
            {veConsulta ? (
              <Link href={`/consultas/${encodeURIComponent(detalle.consultaLeadId!)}`} className="fo-btn fo-btn-secondary text-sm">
                Ver la consulta
              </Link>
            ) : null}
            <Link href="/pedidos" className="fo-btn fo-btn-secondary text-sm">
              Volver a Pedidos
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstadoPedido(detalle.estado)}`}>{ETIQUETA_ESTADO_PEDIDO[detalle.estado]}</span>
        {cancelado && detalle.cancelReason ? <span className="text-[var(--fo-muted)]">Motivo: {detalle.cancelReason}</span> : null}
        {plan.descuadrado ? (
          <span className="rounded-full bg-[var(--fo-warning-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fo-warning)]">Plan descuadrado</span>
        ) : null}
      </div>

      {gestiona ? (
        <div className="flex flex-wrap items-start gap-2">
          {/* Siempre montado (con Gestionar): si el cobro salda el pedido, la vista del recibo
              no desaparece al refrescar la ficha. El botón sólo sale sin cancelar y con saldo. */}
          <RegistrarCobro
            pedidoId={detalle.id}
            clientId={detalle.clientId}
            cuotas={cuotasConSaldo}
            saldoPedido={plan.saldo}
            hoy={hoy}
            puedeAdjuntar={puedeEnContexto(ctx, "operar", CLIENTS_MODULE_KEY)}
            envio={envio}
            puedeCobrar={!cancelado && plan.saldo > 0}
          />
          <AccionesPedido
            pedidoId={detalle.id}
            siguientes={estadosSiguientes(detalle.estado)}
            rubros={rubros}
            rubroActual={detalle.incomeCategoryId}
            cancelado={cancelado}
          />
        </div>
      ) : null}
      {envio ? <EnviarPedido pedidoId={detalle.id} opciones={envio} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4 self-start">
          <section aria-labelledby="evento-titulo" className="fo-card space-y-3">
            <h2 id="evento-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              Evento y pago
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Fecha del evento</dt>
                <dd>{fechaCorta(detalle.eventDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Evento</dt>
                <dd>{detalle.eventLabel || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Opción de pago</dt>
                <dd>
                  {detalle.paymentOption?.etiqueta ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Rubro de ingreso</dt>
                <dd>{detalle.rubro ?? "Sin rubro"}</dd>
              </div>
            </dl>
            <dl className="space-y-1 border-t border-[var(--fo-border)] pt-3 text-sm">
              {ajuste ? (
                <>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--fo-muted)]">Total de los ítems</dt>
                    <dd className="tabular-nums">{pesosPedido(totalItems ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--fo-muted)]">{ajuste.etiqueta}</dt>
                    <dd className="tabular-nums">{pesosConSigno(ajuste.importe)}</dd>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--fo-muted)]">Total</dt>
                <dd className="tabular-nums">{pesosPedido(plan.total)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--fo-muted)]">Cobrado</dt>
                <dd className="tabular-nums">{pesosPedido(plan.cobrado)}</dd>
              </div>
              <div className="flex justify-between gap-2 font-semibold">
                <dt>{cancelado ? "Saldo (cancelado)" : "Saldo"}</dt>
                <dd className="tabular-nums">{pesosPedido(plan.saldo)}</dd>
              </div>
              {plan.vencido > 0 ? (
                <div className="flex justify-between gap-2 text-[var(--fo-danger)]">
                  <dt>Vencido</dt>
                  <dd className="tabular-nums">{pesosPedido(plan.vencido)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section aria-labelledby="cobros-titulo" className="fo-card space-y-3">
            <h2 id="cobros-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              Cobros y recibos
            </h2>
            <CobrosDelPedido pedidoId={detalle.id} cobros={cobros} gestiona={gestiona} envio={envio} />
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="plan-titulo" className="fo-card space-y-3">
            <h2 id="plan-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              Plan de cuotas
            </h2>
            {plan.cuotas.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">El pedido no tiene cuotas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--fo-muted)]">
                      <th className="py-1 pr-2 font-medium">Cuota</th>
                      <th className="py-1 pr-2 font-medium">Vence</th>
                      <th className="py-1 pr-2 text-right font-medium">Importe</th>
                      <th className="py-1 pr-2 text-right font-medium">Cobrado</th>
                      <th className="py-1 pr-2 text-right font-medium">Saldo</th>
                      <th className="py-1 pr-2 font-medium">Estado</th>
                      <th className="py-1 font-medium">Medio sugerido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.cuotas.map((c) => (
                      <tr key={c.id} className="border-t border-[var(--fo-border)]">
                        <td className="py-2 pr-2 tabular-nums">{c.position}</td>
                        <td className="py-2 pr-2">{fechaCorta(c.dueDate)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{pesosPedido(c.amountArs)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{pesosPedido(c.imputado)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{pesosPedido(c.saldo)}</td>
                        <td className="py-2 pr-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeColorEtiqueta(COLOR_CUOTA[c.estado])}`}>
                            {ETIQUETA_ESTADO_CUOTA[c.estado]}
                          </span>
                        </td>
                        <td className="py-2 text-[var(--fo-muted)]">{c.suggestedMethod && esMedioCobro(c.suggestedMethod) ? ETIQUETA_MEDIO_COBRO[c.suggestedMethod] : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {gestiona && !cancelado ? (
              <EditarPlan
                pedidoId={detalle.id}
                total={plan.total}
                hoy={hoy}
                cuotas={plan.cuotas.map((c) => ({
                  id: c.id,
                  dueDate: c.dueDate,
                  amountArs: c.amountArs,
                  suggestedMethod: c.suggestedMethod && esMedioCobro(c.suggestedMethod) ? c.suggestedMethod : null,
                  imputado: c.imputado,
                }))}
              />
            ) : null}
          </section>

          {costosYPagos ? (
            <section id="costos" aria-labelledby="costos-pagos-titulo" className="fo-card space-y-3">
              <h2 id="costos-pagos-titulo" className="text-base font-semibold text-[var(--fo-text)]">
                Costos y pagos
              </h2>
              <CostosYPagos
                pedidoId={detalle.id}
                cuentas={costosYPagos.cuentas}
                margenes={costosYPagos.margenes}
                gestiona={gestionaCuentas}
                puedeAdjuntar={puedeEnContexto(ctx, "operar", CLIENTS_MODULE_KEY)}
                cancelado={cancelado}
                proveedores={proveedores}
                rubros={rubrosCosto}
                hoy={hoy}
              />
            </section>
          ) : null}

          <section id="checklist" aria-labelledby="checklist-titulo" className="fo-card space-y-3">
            <h2 id="checklist-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              Checklist
            </h2>
            <ChecklistDelPedido pedidoId={detalle.id} tareas={tareasVista} plantillas={checklist?.plantillas ?? []} puedeEditar={gestiona && !cancelado} />
          </section>

          {verProyectos ? (
            <section id="proyectos" aria-labelledby="proyectos-titulo" className="fo-card space-y-3">
              <h2 id="proyectos-titulo" className="text-base font-semibold text-[var(--fo-text)]">
                Proyectos
              </h2>
              <ProyectosDelPedido
                pedidoId={detalle.id}
                proyectos={proyectos}
                flujos={opcionesProyecto.circuitos}
                equipo={opcionesProyecto.equipo}
                puedeAgregar={gestionaProyectos}
              />
            </section>
          ) : null}

          {contratantes ? (
            <section id="contratantes" aria-labelledby="contratantes-titulo" className="fo-card space-y-3">
              <h2 id="contratantes-titulo" className="text-base font-semibold text-[var(--fo-text)]">
                Contratantes
              </h2>
              <ContratantesDelPedido
                pedidoId={detalle.id}
                contratantes={contratantes.map((c) => ({
                  orden: c.orden, clientId: c.clientId, nombre: c.nombre, email: c.email, telefono: c.telefono, porOmision: c.porOmision,
                }))}
                puedeEditar={puedeGestionarContratos(ctx)}
                puedeBuscar={puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)}
                puedeVerContactos={puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)}
              />
            </section>
          ) : null}

          {contratosDelPedido ? (
            <section id="contratos" aria-labelledby="contratos-titulo" className="fo-card space-y-3">
              <h2 id="contratos-titulo" className="text-base font-semibold text-[var(--fo-text)]">
                Contratos
              </h2>
              <ContratosDelPedido
                pedidoId={detalle.id}
                contratos={contratosDelPedido}
                plantillas={plantillasContrato.filter((p) => p.isActive).map((p) => ({ id: p.id, nombre: p.name }))}
                puedeGenerar={gestionaContratos}
              />
            </section>
          ) : null}

          {citas ? <TarjetaCitas citas={citas} nueva={`pedido=${encodeURIComponent(detalle.id)}`} vacio="Este pedido todavía no tiene citas." /> : null}

          <ItemsPedido items={detalle.items.map((i) => aItemDePedido(i))} totales={detalle.totals} costos={costos} />

          <section aria-labelledby="historial-titulo" className="fo-card space-y-3">
            <h2 id="historial-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              Historial
            </h2>
            <ul className="space-y-4 text-sm">
              {historial.map((e) =>
                e.tipo === "hito" ? (
                  <li key={e.hito.clave} className="space-y-0.5">
                    <p className="text-xs text-[var(--fo-muted)]">
                      <time dateTime={e.fecha}>{fechaHoraBA(e.fecha)}</time>
                    </p>
                    <p className="text-[var(--fo-text)]">{e.hito.texto}</p>
                  </li>
                ) : (
                  <li key={`m-${e.mensaje.id}`}>
                    <MensajeRegistrado mensaje={e.mensaje} conEncabezado />
                  </li>
                ),
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
