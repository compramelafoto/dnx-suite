import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireEventos } from "@/lib/eventos/contexto";
import { ESTADOS_PAGO, ESTADO_PAGO_LABEL, ORIGEN_LABEL, esEstadoPago, type Origen } from "@/lib/eventos/constants";
import { coincide, resumir } from "@/lib/eventos/reglas";
import {
  formulariosDelSitio,
  listarInscriptos,
  obtenerEvento,
  productosParaEntradas,
  sincronizarInscriptos,
} from "@/lib/eventos/servidor";
import {
  acreditarAction,
  agregarInscriptoAction,
  desvincularEntradaAction,
  editarEventoAction,
  editarInscriptoAction,
  eliminarInscriptoAction,
  estadoPagoAction,
  formulariosAction,
  vincularEntradaAction,
} from "../actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; estado?: string; error?: string }>;
};

const aInput = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) : "");
const hora = (d: Date) =>
  d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pesos = (v: { toString(): string } | null) =>
  v === null ? null : `$ ${Number(v.toString()).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

const COLOR_ESTADO: Record<string, string> = {
  PAGADO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  PENDIENTE: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  CORTESIA: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ANULADO: "bg-zinc-500/15 text-zinc-500",
};

export default async function EventoPage({ params, searchParams }: Props) {
  const { workspace, puedeEditar } = await requireEventos("VIEW");
  const { id } = await params;
  const { q = "", estado = "", error } = await searchParams;
  await sincronizarInscriptos(workspace.id);
  const evento = await obtenerEvento(workspace.id, id);
  if (!evento) notFound();

  const [todos, productos, formularios] = await Promise.all([
    listarInscriptos(workspace.id, id),
    puedeEditar ? productosParaEntradas(workspace.id) : Promise.resolve([]),
    puedeEditar ? formulariosDelSitio(workspace.id) : Promise.resolve([]),
  ]);
  const r = resumir(todos);
  const filtro = esEstadoPago(estado) ? estado : null;
  const lista = todos.filter((i) => (!filtro || i.estadoPago === filtro) && coincide(i, q));
  const consulta = new URLSearchParams({ ...(q ? { q } : {}), ...(filtro ? { estado: filtro } : {}) }).toString();
  const volver = consulta ? "/eventos/" + id + "?" + consulta : "/eventos/" + id;
  const nombreProducto = new Map(productos.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={evento.nombre}
        description={[evento.fechaInicio ? aInput(evento.fechaInicio).split("-").reverse().join("/") : null, evento.lugar].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Link href="/eventos" className="fo-btn fo-btn-ghost">
              Todos los eventos
            </Link>
            {puedeEditar ? (
              <Link href={`/eventos/${id}/puerta`} className="fo-btn fo-btn-primary">
                Acreditar en la puerta
              </Link>
            ) : null}
            <a href={`/eventos/${id}/planilla`} className="fo-btn fo-btn-secondary">
              Descargar planilla
            </a>
          </>
        }
      />
      {error ? <p className="fo-alert-warning">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Inscriptos", evento.cupo ? `${r.total} / ${evento.cupo}` : String(r.total)],
          ["Pagados", String(r.pagados)],
          ["Pago pendiente", String(r.pendientes)],
          ["Cortesías", String(r.cortesias)],
          ["Acreditados", String(r.acreditados)],
        ].map(([t, v]) => (
          <div key={t} className="fo-card p-4">
            <p className="text-xs text-[var(--fo-muted)]">{t}</p>
            <p className="text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre, correo, teléfono, DNI o código" className="fo-input min-w-0 flex-1" />
        <select name="estado" defaultValue={filtro ?? ""} className="fo-input w-auto">
          <option value="">Todos</option>
          {ESTADOS_PAGO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_PAGO_LABEL[e]}
            </option>
          ))}
        </select>
        <button className="fo-btn fo-btn-secondary">Buscar</button>
      </form>

      {lista.length === 0 ? (
        <div className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          {todos.length === 0
            ? "Todavía no hay inscriptos. Vinculá las entradas de la tienda y los formularios del sitio (abajo) o cargalos a mano."
            : "Nadie coincide con la búsqueda."}
        </div>
      ) : (
        <ul className="divide-y rounded border border-[var(--fo-border)]">
          {lista.map((i) => (
            <li key={i.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {i.nombre} <span className="ml-1 font-mono text-xs text-[var(--fo-muted)]">{i.codigo}</span>
                  </p>
                  <p className="text-sm text-[var(--fo-muted)]">
                    {[i.tipo, ORIGEN_LABEL[i.origen as Origen] ?? i.origen, pesos(i.montoArs), i.email, i.telefono, i.dni ? `DNI ${i.dni}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {i.notas ? <p className="text-sm">{i.notas}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_ESTADO[i.estadoPago] ?? ""}`}>
                    {ESTADO_PAGO_LABEL[i.estadoPago as keyof typeof ESTADO_PAGO_LABEL] ?? i.estadoPago}
                  </span>
                  {i.acreditadoAt ? (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white">Acreditado {hora(i.acreditadoAt)}</span>
                  ) : null}
                </div>
              </div>

              {puedeEditar ? (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={acreditarAction}>
                    <input type="hidden" name="eventoId" value={id} />
                    <input type="hidden" name="inscriptoId" value={i.id} />
                    <input type="hidden" name="volver" value={volver} />
                    <input type="hidden" name="si" value={i.acreditadoAt ? "0" : "1"} />
                    <button className={`fo-btn ${i.acreditadoAt ? "fo-btn-ghost" : "fo-btn-secondary"}`}>
                      {i.acreditadoAt ? "Deshacer acreditación" : "Acreditar"}
                    </button>
                  </form>
                  <form action={estadoPagoAction} className="flex items-center gap-1">
                    <input type="hidden" name="eventoId" value={id} />
                    <input type="hidden" name="inscriptoId" value={i.id} />
                    <input type="hidden" name="volver" value={volver} />
                    <select name="estadoPago" defaultValue={i.estadoPago} className="fo-input w-auto">
                      {ESTADOS_PAGO.map((e) => (
                        <option key={e} value={e}>
                          {ESTADO_PAGO_LABEL[e]}
                        </option>
                      ))}
                    </select>
                    <button className="fo-btn fo-btn-ghost">Cambiar pago</button>
                  </form>
                  <details className="w-full">
                    <summary className="cursor-pointer text-sm text-[var(--fo-muted)]">Editar datos</summary>
                    <form action={editarInscriptoAction} className="mt-2 grid gap-2 md:grid-cols-3">
                      <input type="hidden" name="eventoId" value={id} />
                      <input type="hidden" name="inscriptoId" value={i.id} />
                      <input type="hidden" name="volver" value={volver} />
                      <input name="nombre" defaultValue={i.nombre} required className="fo-input" placeholder="Nombre y apellido" />
                      <input name="email" defaultValue={i.email ?? ""} className="fo-input" placeholder="Correo" />
                      <input name="telefono" defaultValue={i.telefono ?? ""} className="fo-input" placeholder="Teléfono" />
                      <input name="dni" defaultValue={i.dni ?? ""} className="fo-input" placeholder="DNI" />
                      <input name="tipo" defaultValue={i.tipo ?? ""} className="fo-input" placeholder="Entrada" />
                      <input name="montoArs" defaultValue={i.montoArs?.toString() ?? ""} className="fo-input" placeholder="Monto" />
                      <input name="notas" defaultValue={i.notas ?? ""} className="fo-input md:col-span-3" placeholder="Notas" />
                      <div className="flex gap-2 md:col-span-3">
                        <button className="fo-btn fo-btn-primary">Guardar</button>
                      </div>
                    </form>
                    {i.origen !== "TIENDA" ? (
                      <form action={eliminarInscriptoAction} className="mt-2">
                        <input type="hidden" name="eventoId" value={id} />
                        <input type="hidden" name="inscriptoId" value={i.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <button className="fo-btn fo-btn-ghost text-red-600">Quitar del listado</button>
                      </form>
                    ) : null}
                  </details>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar ? (
        <>
          <details className="fo-card p-6" open={todos.length === 0}>
            <summary className="cursor-pointer text-lg font-semibold">Cargar un inscripto a mano</summary>
            <form action={agregarInscriptoAction} className="mt-4 grid gap-3 md:grid-cols-3">
              <input type="hidden" name="eventoId" value={id} />
              <input type="hidden" name="volver" value={volver} />
              <input name="nombre" required className="fo-input" placeholder="Nombre y apellido" />
              <input name="email" type="email" className="fo-input" placeholder="Correo" />
              <input name="telefono" className="fo-input" placeholder="Teléfono" />
              <input name="dni" className="fo-input" placeholder="DNI" />
              <input name="tipo" className="fo-input" placeholder="Entrada (General, Preventa…)" />
              <input name="montoArs" className="fo-input" placeholder="Monto (ej. 110000)" />
              <select name="estadoPago" defaultValue="PAGADO" className="fo-input">
                <option value="PAGADO">Pagado (transferencia, efectivo)</option>
                <option value="PENDIENTE">Pago pendiente</option>
                <option value="CORTESIA">Cortesía</option>
              </select>
              <input name="notas" className="fo-input md:col-span-2" placeholder="Notas (ej. pagó por transferencia el 30/10)" />
              <div className="md:col-span-3">
                <button className="fo-btn fo-btn-primary">Agregar</button>
              </div>
            </form>
          </details>

          <details className="fo-card p-6" open={evento.entradas.length === 0 && evento.formularioClaves.length === 0}>
            <summary className="cursor-pointer text-lg font-semibold">De dónde llegan los inscriptos</summary>
            <div className="mt-4 space-y-6">
              <section className="space-y-3">
                <h3 className="font-semibold">Entradas de la tienda</h3>
                <p className="text-sm text-[var(--fo-muted)]">
                  Cada unidad pagada de estos productos suma un inscripto pagado, a nombre de quien compró.
                </p>
                {evento.entradas.length > 0 ? (
                  <ul className="divide-y rounded border border-[var(--fo-border)]">
                    {evento.entradas.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <span>
                          {nombreProducto.get(e.productId) ?? "Producto dado de baja"}
                          {e.tipo ? <span className="text-[var(--fo-muted)]"> · figura como “{e.tipo}”</span> : null}
                        </span>
                        <form action={desvincularEntradaAction}>
                          <input type="hidden" name="eventoId" value={id} />
                          <input type="hidden" name="entradaId" value={e.id} />
                          <button className="fo-btn fo-btn-ghost">Quitar</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <form action={vincularEntradaAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="eventoId" value={id} />
                  <select name="productId" required className="fo-input min-w-0 flex-1" defaultValue="">
                    <option value="" disabled>
                      Elegí un producto…
                    </option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {pesos(p.priceArs)}
                      </option>
                    ))}
                  </select>
                  <input name="tipo" className="fo-input w-48" placeholder="Cómo figura (opcional)" />
                  <button className="fo-btn fo-btn-secondary">Vincular</button>
                </form>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Formularios del sitio</h3>
                <p className="text-sm text-[var(--fo-muted)]">
                  Cada envío de estos formularios suma un inscripto con el pago pendiente (también los que ya llegaron).
                </p>
                {formularios.length === 0 ? (
                  <p className="text-sm text-[var(--fo-muted)]">Los formularios aparecen acá cuando reciben su primer envío.</p>
                ) : (
                  <form action={formulariosAction} className="space-y-2">
                    <input type="hidden" name="eventoId" value={id} />
                    {formularios.map((f) => (
                      <label key={f.clave} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="clave" value={f.clave} defaultChecked={evento.formularioClaves.includes(f.clave)} />
                        {f.nombre} <span className="text-[var(--fo-muted)]">({f._count.envios} envíos)</span>
                      </label>
                    ))}
                    <button className="fo-btn fo-btn-secondary">Guardar formularios</button>
                  </form>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Datos del evento</h3>
                <form action={editarEventoAction} className="grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="eventoId" value={id} />
                  <input name="nombre" defaultValue={evento.nombre} required className="fo-input md:col-span-2" />
                  <label>
                    <span className="fo-label">Empieza</span>
                    <input type="date" name="fechaInicio" defaultValue={aInput(evento.fechaInicio)} className="fo-input w-full" />
                  </label>
                  <label>
                    <span className="fo-label">Termina</span>
                    <input type="date" name="fechaFin" defaultValue={aInput(evento.fechaFin)} className="fo-input w-full" />
                  </label>
                  <input name="lugar" defaultValue={evento.lugar ?? ""} className="fo-input" placeholder="Lugar" />
                  <input name="cupo" defaultValue={evento.cupo ?? ""} className="fo-input" placeholder="Cupo" inputMode="numeric" />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="archivado" defaultChecked={evento.archivado} /> Archivado
                  </label>
                  <div className="md:col-span-2">
                    <button className="fo-btn fo-btn-secondary">Guardar datos</button>
                  </div>
                </form>
              </section>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
