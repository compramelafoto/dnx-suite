import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireEventos } from "@/lib/eventos/contexto";
import { ESTADOS_PAGO, ESTADO_PAGO_LABEL, ORIGEN_LABEL, esEstadoPago, type Origen } from "@/lib/eventos/constants";
import { DIPLOMA_PARA, DIPLOMA_PARA_LABEL, coincide, resumir, tieneDiploma } from "@/lib/eventos/reglas";
import { plantillasDeDiploma } from "@/lib/eventos/diploma";
import { DIPLOMAS_EDITOR_BASE_PATH, PLACA_EVENTO_TEMPLATE_KEY } from "@/lib/eventos/diploma-constantes";
import { presentarInterruptorDeAcreditacion } from "@/lib/eventos/acreditacion/ui/accreditation-switch";
import { armadorDeUrlsDeEntrada } from "@/lib/eventos/entrada";
import { FUENTE_ACREDITACION_LABEL } from "@/lib/eventos/constants";
import { BotonConfirmar } from "./boton-confirmar";
import { prisma } from "@repo/db";
import {
  formulariosDelSitio,
  listarInscriptos,
  obtenerEvento,
  productosParaEntradas,
  sincronizarInscriptos,
} from "@/lib/eventos/servidor";
import {
  acreditacionInterruptorAction,
  acreditarAction,
  agregarInscriptoAction,
  crearPlacaAction,
  enviarEnlacesAction,
  inscripcionConfigAction,
  crearDiplomaAction,
  diplomaConfigAction,
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

  const [todos, productos, formularios, diplomas, sitio, placas, urlDeEntrada] = await Promise.all([
    listarInscriptos(workspace.id, id),
    puedeEditar ? productosParaEntradas(workspace.id) : Promise.resolve([]),
    puedeEditar ? formulariosDelSitio(workspace.id) : Promise.resolve([]),
    plantillasDeDiploma(workspace.id),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: workspace.id },
      select: { publicSlug: true, workspace: { select: { fotofficeDomain: { select: { domain: true, status: true } } } } },
    }),
    plantillasDeDiploma(workspace.id, PLACA_EVENTO_TEMPLATE_KEY),
    armadorDeUrlsDeEntrada(workspace.id),
  ]);
  const placa = placas.find((p) => p.id === evento.placaTemplateId) ?? null;
  const diploma = diplomas.find((p) => p.id === evento.diplomaTemplateId) ?? null;
  const conDiploma = todos.filter((i) => tieneDiploma(i, evento.diplomaPara));
  const dominio = sitio?.workspace.fotofficeDomain;
  const baseSitio = dominio?.status === "CONNECTED" ? `https://${dominio.domain}` : `https://fotoffice.com/w/${sitio?.publicSlug ?? ""}`;
  const baseDiploma = `${baseSitio}/diploma`;
  const vigentes = todos.filter((i) => i.estadoPago !== "ANULADO");
  const completos = vigentes.filter((i) => i.datosCompletosAt != null).length;
  const conFoto = vigentes.filter((i) => i.fotoUrl != null).length;
  const sinEnlace = vigentes.filter((i) => i.email && !i.enlaceEnviadoAt).length;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const enCurso = evento.fechaInicio != null && aInput(evento.fechaInicio) <= hoy && hoy <= aInput(evento.fechaFin ?? evento.fechaInicio);
  const interruptor = presentarInterruptorDeAcreditacion({
    habilitado: evento.acreditacionHabilitada,
    ingresosRegistrados: vigentes.filter((i) => i.acreditadoAt != null).length,
    ventanaAbierta: enCurso,
  });
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

      <section className="fo-card space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Acreditación</h2>
            <p className="text-sm">
              <span
                className={`mr-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  interruptor.tono === "success"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : interruptor.tono === "danger"
                      ? "bg-red-500/15 text-red-700 dark:text-red-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }`}
              >
                {interruptor.estado}
              </span>
              <span className="text-[var(--fo-muted)]">{interruptor.explicacion}</span>
            </p>
          </div>
          {puedeEditar ? (
            <form action={acreditacionInterruptorAction}>
              <input type="hidden" name="eventoId" value={id} />
              <input type="hidden" name="encender" value={interruptor.accion === "ENCENDER" ? "1" : "0"} />
              <BotonConfirmar
                texto={interruptor.etiquetaDelBoton}
                confirmacion={interruptor.pideConfirmacion ? interruptor.textoDeConfirmacion : null}
                className={`fo-btn ${interruptor.accion === "ENCENDER" ? "fo-btn-primary" : "fo-btn-ghost"}`}
              />
            </form>
          ) : null}
        </div>

        <div className="grid gap-3 border-t border-[var(--fo-border)] pt-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-[var(--fo-muted)]">Completaron su inscripción</p>
            <p className="text-xl font-semibold">
              {completos} / {vigentes.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--fo-muted)]">Subieron su foto</p>
            <p className="text-xl font-semibold">
              {conFoto} / {vigentes.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--fo-muted)]">Sin el enlace por correo</p>
            <p className="text-xl font-semibold">{sinEnlace}</p>
          </div>
        </div>
        <p className="text-sm text-[var(--fo-muted)]">
          Cada inscripto tiene un enlace personal donde completa sus datos, sube su foto, ve el QR que se escanea en la puerta y baja
          su placa de bienvenida. A quien compra en la tienda le llega solo después del pago.
        </p>
        {puedeEditar ? (
          <div className="flex flex-wrap gap-2">
            {sinEnlace > 0 ? (
              <form action={enviarEnlacesAction}>
                <input type="hidden" name="eventoId" value={id} />
                <BotonConfirmar
                  texto={`Mandar el enlace a los que faltan (${sinEnlace})`}
                  confirmacion={`Se va a mandar un correo a ${sinEnlace} ${sinEnlace === 1 ? "persona" : "personas"} con el enlace a su entrada. ¿Seguimos?`}
                  className="fo-btn fo-btn-secondary"
                />
              </form>
            ) : null}
            {placa ? (
              <a href={`${DIPLOMAS_EDITOR_BASE_PATH}/${placa.id}/${placa.currentVersionId}`} className="fo-btn fo-btn-secondary">
                Editar diseño de la placa
              </a>
            ) : (
              <form action={crearPlacaAction}>
                <input type="hidden" name="eventoId" value={id} />
                <button className="fo-btn fo-btn-secondary">Personalizar la placa de bienvenida</button>
              </form>
            )}
          </div>
        ) : null}

        {puedeEditar ? (
          <form action={inscripcionConfigAction} className="grid gap-3 border-t border-[var(--fo-border)] pt-4 md:grid-cols-2">
            <input type="hidden" name="eventoId" value={id} />
            <label className="md:col-span-2">
              <span className="fo-label">Página pública de inscripción</span>
              <span className="flex items-center gap-1 text-sm">
                <span className="text-[var(--fo-muted)]">{baseSitio}/evento/</span>
                <input name="slug" defaultValue={evento.slug ?? ""} className="fo-input min-w-0 flex-1" placeholder="por ejemplo workshops-2026" />
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="inscripcionPublica" defaultChecked={evento.inscripcionPublica} /> Aceptar inscripciones desde esa
              página (quedan con el pago pendiente)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pideFoto" defaultChecked={evento.pideFoto} /> Pedir la foto al inscribirse (para la placa)
            </label>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button className="fo-btn fo-btn-secondary">Guardar</button>
              {evento.slug && evento.inscripcionPublica ? (
                <a href={`${baseSitio}/evento/${evento.slug}`} target="_blank" rel="noopener" className="text-sm underline">
                  Ver la página
                </a>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <section className="fo-card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Diplomas</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              {diploma
                ? `${conDiploma.length} ${conDiploma.length === 1 ? "persona tiene" : "personas tienen"} diploma (${DIPLOMA_PARA_LABEL[evento.diplomaPara as keyof typeof DIPLOMA_PARA_LABEL]?.toLowerCase() ?? evento.diplomaPara}).`
                : "Diseñá el diploma una vez y cada inscripto tiene el suyo, con su nombre."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {diploma && puedeEditar ? (
              <a href={`${DIPLOMAS_EDITOR_BASE_PATH}/${diploma.id}/${diploma.currentVersionId}`} className="fo-btn fo-btn-secondary">
                Editar diseño
              </a>
            ) : null}
            {diploma && conDiploma.length > 0 ? (
              <a href={`/eventos/${id}/diplomas`} className="fo-btn fo-btn-primary">
                Descargar todos ({Math.min(conDiploma.length, 60)})
              </a>
            ) : null}
            {!diploma && puedeEditar ? (
              <form action={crearDiplomaAction}>
                <input type="hidden" name="eventoId" value={id} />
                <button className="fo-btn fo-btn-primary">Diseñar el diploma</button>
              </form>
            ) : null}
          </div>
        </div>
        {conDiploma.length > 60 ? (
          <p className="text-sm text-[var(--fo-muted)]">El archivo trae los primeros 60 en orden alfabético; los demás se bajan uno por uno desde el listado.</p>
        ) : null}
        {puedeEditar ? (
          <form action={diplomaConfigAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="eventoId" value={id} />
            <label className="min-w-0 flex-1">
              <span className="fo-label">¿A quién?</span>
              <select name="diplomaPara" defaultValue={evento.diplomaPara} className="fo-input w-full">
                {DIPLOMA_PARA.map((p) => (
                  <option key={p} value={p}>
                    {DIPLOMA_PARA_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            {diplomas.length > 0 ? (
              <label className="min-w-0 flex-1">
                <span className="fo-label">Diseño</span>
                <select name="diplomaTemplateId" defaultValue={evento.diplomaTemplateId ?? ""} className="fo-input w-full">
                  <option value="">Sin diploma</option>
                  {diplomas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button className="fo-btn fo-btn-secondary">Guardar</button>
          </form>
        ) : null}
      </section>

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
                {i.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.fotoUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {i.nombre} <span className="ml-1 font-mono text-xs text-[var(--fo-muted)]">{i.codigo}</span>
                  </p>
                  <p className="text-sm text-[var(--fo-muted)]">
                    {[i.tipo, ORIGEN_LABEL[i.origen as Origen] ?? i.origen, pesos(i.montoArs), i.email, i.telefono, i.dni ? `DNI ${i.dni}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {i.notas ? <p className="text-sm">{i.notas}</p> : null}
                  <p className="text-xs text-[var(--fo-muted)]">
                    {[
                      i.datosCompletosAt ? "Completó su inscripción" : "Falta completar la inscripción",
                      i.instagram ? `@${i.instagram}` : null,
                      i.enlaceEnviadoAt ? `Enlace enviado ${hora(i.enlaceEnviadoAt)}` : null,
                      i.acreditadoFuente ? `Entró por: ${FUENTE_ACREDITACION_LABEL[i.acreditadoFuente] ?? i.acreditadoFuente}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {urlDeEntrada && i.estadoPago !== "ANULADO" ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--fo-muted)]">Enlace personal y placa</summary>
                      <p className="mt-1 select-all break-all">{urlDeEntrada(i)}</p>
                      <p className="mt-1 flex flex-wrap gap-3">
                        <a href={`/eventos/${id}/placa?inscripto=${i.id}`} target="_blank" rel="noopener" className="underline">
                          Ver la placa
                        </a>
                        <a href={`/eventos/${id}/placa?inscripto=${i.id}&descargar=1`} className="underline">
                          Descargar la placa
                        </a>
                      </p>
                    </details>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_ESTADO[i.estadoPago] ?? ""}`}>
                    {ESTADO_PAGO_LABEL[i.estadoPago as keyof typeof ESTADO_PAGO_LABEL] ?? i.estadoPago}
                  </span>
                  {i.acreditadoAt ? (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white">Acreditado {hora(i.acreditadoAt)}</span>
                  ) : null}
                  {diploma && tieneDiploma(i, evento.diplomaPara) ? (
                    <>
                      <a href={`/eventos/${id}/diplomas?inscripto=${i.id}&ver=1`} target="_blank" rel="noopener" className="text-xs underline">
                        Diploma
                      </a>
                      <span className="select-all text-xs text-[var(--fo-muted)]">{`${baseDiploma}/${i.codigo}`}</span>
                    </>
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
                  {i.email && i.estadoPago !== "ANULADO" ? (
                    <form action={enviarEnlacesAction}>
                      <input type="hidden" name="eventoId" value={id} />
                      <input type="hidden" name="inscriptoId" value={i.id} />
                      <input type="hidden" name="volver" value={volver} />
                      <button className="fo-btn fo-btn-ghost">{i.enlaceEnviadoAt ? "Reenviar enlace" : "Mandar enlace"}</button>
                    </form>
                  ) : null}
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
