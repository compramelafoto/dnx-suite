import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlarmClock, ArrowLeft, CircleX, MessageCircle, Quote, Trophy } from "lucide-react";
import { IconoEntidad } from "@/components/entidades/entidad";
import { PuntoSemaforo } from "@/components/consultas/punto-semaforo";
import { semaforosDeConsultas } from "@/lib/consultas/semaforo";
import { MasDatos } from "@/components/campos/mas-datos";
import { Mensaje } from "@/components/mensajes/mensaje";
import { Historial } from "@/components/circuitos/historial";
import { Proyeccion } from "@/components/circuitos/proyeccion";
import { Recorrido } from "@/components/circuitos/recorrido";
import { Tareas } from "@/components/circuitos/tareas";
import { AvisosConsulta } from "@/components/consultas/avisos-consulta";
import { TarjetaCliente } from "@/components/consultas/tarjeta-cliente";
import { DatosConsulta } from "@/components/consultas/datos-consulta";
import { Participantes } from "@/components/consultas/participantes";
import { aTarjeta, TarjetaPresupuestos } from "@/components/presupuestos/tarjeta-presupuestos";
import { aTarjetaPedido, TarjetaPedidos } from "@/components/pedidos/tarjeta-pedidos";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { listarPedidos } from "@/lib/pedidos/pedidos";
import { TarjetaProyectos } from "@/components/proyectos/tarjeta-proyectos";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { proyectosEncendidos } from "@/lib/proyectos/crear";
import { proyectosParaTarjeta } from "@/lib/proyectos/tarjetas";
import { TarjetaCitas } from "@/components/agenda/tarjeta-citas";
import { puede } from "@/lib/access/policy";
import { citasDeOrigen } from "@/lib/agenda/de-origen";
import { resolverAcceso } from "@/lib/access/acceso";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { cargarDatosConsulta, opcionesDeConsulta, responsablesDeConsultas, sinDatosDeOtrosContactos } from "@/lib/consultas/ficha";
import { resumenDelContacto } from "@/lib/consultas/resumen-contacto";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { cambiosDeConsulta } from "@/lib/campos/ficha";
import { cargarFicha } from "@/lib/circuitos/ficha";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";
import { claveDeRecorrido } from "@/lib/circuitos/ficha-vista";
import { fechaDeEvento, fechaHoraBA } from "@/lib/ficha/formato";
import { numeroDe } from "@/lib/numeracion/asignar";
import { mensajesDeConsulta } from "@/lib/plantillas/registro";
import { TIPO_CONSULTA } from "@/lib/service-leads/numero";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { botEnPanel } from "@/lib/dnx-bot/panel";
import { PreguntaleAlBot } from "@/components/dnx-bot/preguntale-al-bot";
import { listarPresupuestos } from "@/lib/presupuestos/presupuestos";
import { eventosDePresupuestos } from "@/lib/presupuestos/historial";
import { esVistaFicha } from "@/lib/ficha/detalle-en-ficha";
import { Desplegable } from "@/components/ficha/desplegable";

export const dynamic = "force-dynamic";

/** Los ids que llegan de la dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Ficha de una consulta (módulo Consultas). Primero la guarda (módulo encendido y rol que opera),
 * después la lectura acotada al workspace de la sesión: una consulta de otro workspace o
 * inexistente cae en `notFound()`.
 */
/** Las respuestas del formulario que la consulta guardó (horas, segundo fotógrafo, distancia); sólo las que hay. */
function respuestasComoDatos(r: { horas: number | null; km: number | null; segundoFotografo: boolean }): { termino: string; valor: React.ReactNode }[] {
  const out: { termino: string; valor: React.ReactNode }[] = [];
  if (r.horas !== null && r.horas > 0) out.push({ termino: "Horas de cobertura", valor: `${String(r.horas).replace(".", ",")} h` });
  if (r.segundoFotografo) out.push({ termino: "Segundo fotógrafo", valor: "Sí, lo pidió" });
  if (r.km !== null && r.km > 0) out.push({ termino: "Distancia desde el estudio", valor: `${Math.round(r.km)} km` });
  return out;
}

export default async function FichaConsultaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ vista?: string | string[] }>;
}) {
  const { user, workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const { id } = await params;
  // Adentro de la ficha del cliente (`?vista=ficha`): sin «Volver a Consultas» ni la tarjeta del
  // contacto (ya estamos en su ficha), y el título como `h2`.
  const incrustada = esVistaFicha(await searchParams);
  if (!ID_VALIDO.test(id)) notFound();

  const [ficha, role, bot] = await Promise.all([cargarFicha(workspace.id, id, new Date()), resolveWorkspaceRole(user.id, workspace.id), botEnPanel()]);
  if (!ficha) notFound();
  // Recién con la consulta verificada en el workspace de la sesión: sus cambios de "Más datos", sus
  // mensajes y su número.
  const [cambios, mensajes, numeros, datosCompletos, acceso] = await Promise.all([
    cambiosDeConsulta(workspace.id, id),
    mensajesDeConsulta(workspace.id, id),
    numeroDe(workspace.id, TIPO_CONSULTA, [id]),
    cargarDatosConsulta(workspace.id, id),
    resolverAcceso(user.id, workspace.id),
  ]);
  // Editar los datos y los participantes: "Gestionar" en Consultas. Las notas, etiquetas y
  // adjuntos del contacto son datos de Clientes: se muestran (sólo para leer) con "Ver" ahí.
  const puedeEditar = puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY);
  const veContacto = puede(acceso, "ver", CLIENTS_MODULE_KEY);
  // Sin "Ver" en Clientes (R10), los datos de otros contactos no salen del servidor: sólo si hay
  // un posible duplicado (para el aviso), sin nombres.
  const hayPosibleDuplicado = (datosCompletos?.posiblesDuplicados.length ?? 0) > 0;
  const datosConsulta = datosCompletos && !veContacto ? sinDatosDeOtrosContactos(datosCompletos) : datosCompletos;
  const [opciones, responsablesConsultas, resumenContacto] = datosConsulta
    ? await Promise.all([
        opcionesDeConsulta(workspace.id),
        puedeEditar ? responsablesDeConsultas(workspace.id) : Promise.resolve([]),
        veContacto
          ? resumenDelContacto(
              { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role },
              datosConsulta.contacto.id,
            )
          : Promise.resolve(null),
      ])
    : [null, [], null];

  // Tarjeta "Presupuestos": con "Ver" en Presupuestos (el nivel ya incluye el módulo encendido).
  // "Nuevo presupuesto" con "Gestionar". La tarjeta nunca lleva costos (`aTarjeta`).
  const vePresupuestos = puede(acceso, "ver", QUOTES_MODULE_KEY);
  const ctxPresupuestos = { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
  const presupuestos = vePresupuestos ? (await listarPresupuestos(ctxPresupuestos, { consultaLeadId: id })).map(aTarjeta) : null;
  // Envíos, vistas y aceptaciones de sus presupuestos, para el historial (sin costos ni IP).
  const eventosPresupuestos = vePresupuestos ? await eventosDePresupuestos(ctxPresupuestos, id) : [];
  // Tarjeta "Pedidos": con "Ver" en Pedidos. Sin "Nuevo pedido" (se confirma desde el presupuesto
  // aceptado). La tarjeta nunca lleva costos (`aTarjetaPedido`).
  const vePedidos = puede(acceso, "ver", ORDERS_MODULE_KEY);
  const pedidos = vePedidos ? (await listarPedidos(ctxPresupuestos, { consultaLeadId: id })).map(aTarjetaPedido) : null;

  // Tarjeta "Proyectos": los de los pedidos que salieron de esta consulta, con el módulo encendido y
  // "Ver" en Proyectos.
  const proyectos =
    puede(acceso, "ver", PROJECTS_MODULE_KEY) && (await proyectosEncendidos(workspace.id))
      ? await proyectosParaTarjeta(ctxPresupuestos, { consultaLeadId: id })
      : null;

  // Tarjeta "Citas": sólo con el módulo Agenda encendido y "Ver" en Agenda.
  const citas = await citasDeOrigen(ctxPresupuestos, { consultaLeadId: id });

  const { consulta, recorrido } = ficha;
  // Semáforo de la fecha: sólo mientras la consulta está abierta y tiene fecha.
  const semaforo =
    recorrido?.abierto === true && consulta.fechaEvento
      ? ((await semaforosDeConsultas(workspace.id, [{ leadId: id, fecha: new Date(consulta.fechaEvento) }]).catch(() => new Map())).get(id) ?? null)
      : null;
  const evento = [consulta.tipo, consulta.subtipo].filter(Boolean).join(" · ");
  const recorridoAbierto = recorrido?.abierto === true ? recorrido : null;
  const responsableId = recorridoAbierto?.responsableId ?? null;
  // Con los datos de la etapa 1, el evento (tipo, día y lugar) se muestra en la columna nueva.
  const yaEnConsulta = new Set(datosConsulta ? ["Evento", "Fecha del evento", "Lugar"] : []);
  const datos: { termino: string; valor: React.ReactNode }[] = [
    {
      termino: "Correo",
      valor: consulta.email ? (
        <a href={`mailto:${consulta.email}`} className="text-[var(--fo-accent)] hover:underline">
          {consulta.email}
        </a>
      ) : null,
    },
    {
      termino: "Teléfono",
      valor: consulta.telefono ? (
        <>
          {consulta.telefono}
          {consulta.whatsapp ? (
            <>
              {" · "}
              <a href={consulta.whatsapp} target="_blank" rel="noopener noreferrer" className="text-[var(--fo-accent)] hover:underline">
                WhatsApp
              </a>
            </>
          ) : null}
        </>
      ) : null,
    },
    { termino: "Evento", valor: evento },
    { termino: "Fecha del evento", valor: consulta.fechaEvento ? fechaDeEvento(consulta.fechaEvento) : null },
    { termino: "Lugar", valor: consulta.lugar },
    { termino: "Formulario de origen", valor: consulta.formulario },
    ...respuestasComoDatos(consulta.respuestas),
    { termino: "Alta", valor: fechaHoraBA(consulta.alta) },
  ].filter((d) => !yaEnConsulta.has(d.termino));

  const relacionados = [presupuestos?.length ?? 0, pedidos?.length ?? 0, proyectos?.length ?? 0, citas ? citas.proximas.length + citas.recientes.length : 0].reduce((a, b) => a + b, 0);

  // Encabezado: el número y el estado arriba en chico; el nombre como título; qué evento y cuándo.
  const numero = numeros.get(id) ?? null;
  const Titulo = incrustada ? "h2" : "h1";
  const cerrada = recorrido !== null && !recorrido.abierto;
  const ganada = cerrada && recorrido?.outcome === recorrido?.salidas.exito;
  const subtitulo = [datosConsulta ? datosConsulta.categoria.nombre : evento, consulta.fechaEvento ? fechaDeEvento(consulta.fechaEvento) : null].filter(Boolean);
  // La tarjeta del cliente va al costado; adentro de la ficha del cliente no hace falta (ya estamos ahí).
  const conCliente = !incrustada && datosConsulta !== null;
  // Con "Gestionar" en Clientes se editan los datos del cliente y se escriben notas.
  const gestionaCliente = puede(acceso, "operar", CLIENTS_MODULE_KEY);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        {incrustada ? null : (
          <Link href="/consultas" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--fo-muted)] hover:text-[var(--fo-text)]">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Consultas
          </Link>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {numero ? <span className="tabular-nums font-medium text-[var(--fo-muted)]">Consulta N° {numero}</span> : <span className="font-medium text-[var(--fo-muted)]">Consulta</span>}
              {recorridoAbierto?.vencida ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fo-danger-soft)] px-2 py-0.5 font-medium text-[var(--fo-danger)]">
                  <AlarmClock className="size-3" aria-hidden="true" /> Vencida
                </span>
              ) : null}
              {cerrada && recorrido?.outcome ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                    ganada ? "bg-[var(--fo-success-soft)] text-[var(--fo-success)]" : "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]"
                  }`}
                >
                  {ganada ? <Trophy className="size-3" aria-hidden="true" /> : <CircleX className="size-3" aria-hidden="true" />}
                  {ETIQUETA_SALIDA[recorrido.outcome] ?? recorrido.outcome}
                </span>
              ) : null}
            </div>
            <Titulo className={`flex items-center gap-3 font-semibold tracking-tight text-[var(--fo-text)] ${incrustada ? "text-xl" : "text-2xl"}`}>
              <IconoEntidad entidad="consulta" tamano="lg" />
              <span className="min-w-0 break-words">{consulta.nombre}</span>
            </Titulo>
            {subtitulo.length > 0 ? <p className="text-sm text-[var(--fo-muted)]">{subtitulo.join(" · ")}</p> : null}
            {semaforo ? (
              <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
                <PuntoSemaforo semaforo={semaforo} conTexto />
                <span className="text-[var(--fo-muted)]">{semaforo.texto}</span>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {consulta.whatsapp ? (
              <a href={consulta.whatsapp} target="_blank" rel="noopener noreferrer" className="fo-btn fo-btn-secondary min-h-10! text-sm">
                <MessageCircle className="size-4 text-[var(--fo-success)]" aria-hidden="true" /> WhatsApp
              </a>
            ) : null}
            {/* DNX Bot (etapa 3): sólo si está encendido para el workspace. */}
            {bot?.capacidades.verConsultas ? (
              <PreguntaleAlBot
                etiqueta="Preguntale al bot"
                mensaje="Ayudame a responder esta consulta."
                contexto={{ pantalla: "consulta", consultaLeadId: id }}
              />
            ) : null}
          </div>
        </div>
      </header>

      {datosConsulta ? (
        <AvisosConsulta
          avisos={
            // Los datos del otro contacto, sólo con "Ver" en Clientes (R10); si no, el aviso solo.
            veContacto
              ? { fechaSuperpuesta: datosConsulta.superpuestas, duplicados: datosConsulta.posiblesDuplicados }
              : { fechaSuperpuesta: datosConsulta.superpuestas, posibleDuplicado: hayPosibleDuplicado }
          }
        />
      ) : null}

      {/* Lo de todos los días, a la vista: en qué paso está, quién la lleva y cerrarla (Ganada / Perdida). */}
      {recorrido ? (
        <Recorrido
          key={claveDeRecorrido(recorrido)}
          recorrido={recorrido}
          titulo={consulta.nombre}
          motivos={ficha.motivos}
          responsables={ficha.responsables}
          puedePasarIgual={puede(role, "configurar")}
        />
      ) : (
        <p className="fo-card text-sm text-[var(--fo-muted)]">
          Esta consulta todavía no está en ningún circuito. Se ordena sola al abrir el tablero de Consultas.
        </p>
      )}

      <div className={conCliente ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : "space-y-5"}>
        {conCliente && datosConsulta ? (
          // Primero en el celular (es a quien hay que contactar); al costado y fija en pantallas grandes.
          <aside className="min-w-0 lg:sticky lg:top-4 lg:order-2">
            <TarjetaCliente
              cliente={{ id: datosConsulta.contacto.id, nombre: datosConsulta.contacto.nombre, telefono: datosConsulta.contacto.telefono, email: datosConsulta.contacto.email }}
              whatsapp={consulta.whatsapp}
              resumen={veContacto ? resumenContacto : null}
              puedeGestionar={gestionaCliente}
            />
          </aside>
        ) : null}

        <div className="min-w-0 space-y-4 lg:order-1">
          {consulta.mensaje ? (
            <section aria-labelledby="mensaje-cliente-titulo" className="fo-card space-y-2">
              <h2 id="mensaje-cliente-titulo" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
                <Quote className="size-3.5" aria-hidden="true" /> Lo que escribió
              </h2>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[var(--fo-text)]">{consulta.mensaje}</p>
            </section>
          ) : null}

          {datosConsulta && opciones ? (
            <DatosConsulta
              key={`${datosConsulta.consultaId}:${recorridoAbierto?.stageDueAt ?? ""}:${responsableId ?? ""}`}
              leadId={id}
              datos={datosConsulta}
              categorias={opciones.categorias}
              origenes={opciones.origenes}
              responsables={responsablesConsultas}
              responsableId={responsableId}
              nombreResponsable={responsableId !== null ? (ficha.responsables.find((r) => r.id === responsableId)?.nombre ?? null) : null}
              siguienteAccion={recorridoAbierto?.stageDueAt ?? null}
              recorridoAbierto={recorridoAbierto !== null}
              puedeEditar={puedeEditar}
              veContactos={veContacto}
            />
          ) : null}

          {recorrido ? <Tareas key={recorrido.id} journeyId={recorrido.id} tareas={ficha.tareas} abierto={recorrido.abierto} /> : null}
          {recorrido && ficha.proyeccion ? <Proyeccion proyeccion={ficha.proyeccion} /> : null}

          {/* Lo demás, plegado: se abre al tocarlo. */}
          <div className="space-y-3">
            {presupuestos || pedidos || proyectos || citas ? (
              <Desplegable titulo="Cotizaciones, pedidos, proyectos y citas" detalle={relacionados > 0 ? String(relacionados) : "Ninguno"}>
                <div className="grid gap-4 md:grid-cols-2">
                  {presupuestos ? (
                    <TarjetaPresupuestos
                      presupuestos={presupuestos}
                      hrefNuevo={`/presupuestos/nuevo?consulta=${encodeURIComponent(id)}`}
                      puedeCrear={puede(acceso, "operar", QUOTES_MODULE_KEY) && datosConsulta !== null}
                      vacio="Esta consulta todavía no tiene cotizaciones."
                    />
                  ) : null}
                  {pedidos ? <TarjetaPedidos pedidos={pedidos} vacio="Esta consulta todavía no tiene pedidos." /> : null}
                  {proyectos ? <TarjetaProyectos proyectos={proyectos} vacio="Esta consulta todavía no tiene proyectos." /> : null}
                  {citas ? <TarjetaCitas citas={citas} nueva={`consulta=${encodeURIComponent(id)}`} vacio="Esta consulta todavía no tiene citas." /> : null}
                </div>
              </Desplegable>
            ) : null}
            {datosConsulta && opciones ? (
              <Desplegable titulo="Participantes" detalle={String(datosConsulta.participantes.length)}>
                <Participantes
                  leadId={id}
                  participantes={datosConsulta.participantes}
                  roles={opciones.roles}
                  puedeEditar={puedeEditar && veContacto}
                />
              </Desplegable>
            ) : null}
            <Desplegable titulo={datosConsulta ? "Datos del formulario y mensajes" : "Datos de la consulta"}>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {datos.map((d) => (
                  <div key={d.termino}>
                    <dt className="text-xs text-[var(--fo-muted)]">{d.termino}</dt>
                    <dd className="break-words text-[var(--fo-text)]">{d.valor || "—"}</dd>
                  </div>
                ))}
              </dl>
              <Mensaje entityType="CONSULTA" entityId={id} />
            </Desplegable>
            <Desplegable titulo="Más datos">
              <MasDatos entityType="CONSULTA" entityId={id} />
            </Desplegable>
            {recorrido || cambios.length > 0 || mensajes.length > 0 || eventosPresupuestos.length > 0 ? (
              <Desplegable titulo="Historial">
                <Historial pasos={recorrido ? ficha.historial : []} cambios={cambios} mensajes={mensajes} presupuestos={eventosPresupuestos} />
              </Desplegable>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
