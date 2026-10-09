import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MasDatos } from "@/components/campos/mas-datos";
import { Mensaje } from "@/components/mensajes/mensaje";
import { Historial } from "@/components/circuitos/historial";
import { Proyeccion } from "@/components/circuitos/proyeccion";
import { Recorrido } from "@/components/circuitos/recorrido";
import { Tareas } from "@/components/circuitos/tareas";
import { AvisosConsulta } from "@/components/consultas/avisos-consulta";
import { ContactoDeConsulta } from "@/components/consultas/contacto-de-consulta";
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
import { claveDeRecorrido } from "@/lib/circuitos/ficha-vista";
import { fechaDeEvento, fechaHoraBA } from "@/lib/ficha/formato";
import { numeroDe } from "@/lib/numeracion/asignar";
import { mensajesDeConsulta } from "@/lib/plantillas/registro";
import { TIPO_CONSULTA, tituloDeConsulta } from "@/lib/service-leads/numero";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { listarPresupuestos } from "@/lib/presupuestos/presupuestos";
import { eventosDePresupuestos } from "@/lib/presupuestos/historial";

export const dynamic = "force-dynamic";

/** Los ids que llegan de la dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Ficha de una consulta (módulo Consultas). Primero la guarda (módulo encendido y rol que opera),
 * después la lectura acotada al workspace de la sesión: una consulta de otro workspace o
 * inexistente cae en `notFound()`.
 */
export default async function FichaConsultaPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();

  const [ficha, role] = await Promise.all([cargarFicha(workspace.id, id, new Date()), resolveWorkspaceRole(user.id, workspace.id)]);
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
    { termino: "Alta", valor: fechaHoraBA(consulta.alta) },
  ].filter((d) => !yaEnConsulta.has(d.termino));

  return (
    <div className="space-y-6">
      <PageHeader
        title={tituloDeConsulta(consulta.nombre, numeros.get(id))}
        description={datosConsulta ? datosConsulta.categoria.nombre : evento}
        actions={
          <Link href="/consultas" className="fo-btn fo-btn-secondary text-sm">
            Volver a Consultas
          </Link>
        }
      />

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4 self-start">
          {datosConsulta && opciones ? (
            <>
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
              <Participantes
                leadId={id}
                participantes={datosConsulta.participantes}
                roles={opciones.roles}
                puedeEditar={puedeEditar && veContacto}
              />
            </>
          ) : null}
          {presupuestos ? (
            <TarjetaPresupuestos
              presupuestos={presupuestos}
              hrefNuevo={`/presupuestos/nuevo?consulta=${encodeURIComponent(id)}`}
              puedeCrear={puede(acceso, "operar", QUOTES_MODULE_KEY) && datosConsulta !== null}
              vacio="Esta consulta todavía no tiene presupuestos."
            />
          ) : null}
          {pedidos ? <TarjetaPedidos pedidos={pedidos} vacio="Esta consulta todavía no tiene pedidos." /> : null}
          {proyectos ? <TarjetaProyectos proyectos={proyectos} vacio="Esta consulta todavía no tiene proyectos." /> : null}
          {citas ? <TarjetaCitas citas={citas} nueva={`consulta=${encodeURIComponent(id)}`} vacio="Esta consulta todavía no tiene citas." /> : null}
          <section aria-labelledby="datos-titulo" className="fo-card space-y-3">
            <h2 id="datos-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              {datosConsulta ? "Contacto y mensaje" : "Datos de la consulta"}
            </h2>
            <dl className="space-y-2 text-sm">
              {datos.map((d) => (
                <div key={d.termino}>
                  <dt className="text-xs text-[var(--fo-muted)]">{d.termino}</dt>
                  <dd className="break-words text-[var(--fo-text)]">{d.valor || "—"}</dd>
                </div>
              ))}
            </dl>
            {consulta.mensaje ? (
              <div className="space-y-1 border-t border-[var(--fo-border)] pt-3">
                <p className="text-xs text-[var(--fo-muted)]">Mensaje</p>
                <p className="whitespace-pre-line break-words text-sm text-[var(--fo-text)]">{consulta.mensaje}</p>
              </div>
            ) : null}
          </section>
          {datosConsulta && resumenContacto ? <ContactoDeConsulta clientId={datosConsulta.contacto.id} resumen={resumenContacto} /> : null}
          <Mensaje entityType="CONSULTA" entityId={id} />
          <MasDatos entityType="CONSULTA" entityId={id} />
        </div>

        <div className="space-y-6">
          {recorrido ? (
            <>
              <Recorrido
                key={claveDeRecorrido(recorrido)}
                recorrido={recorrido}
                titulo={consulta.nombre}
                motivos={ficha.motivos}
                responsables={ficha.responsables}
                puedePasarIgual={puede(role, "configurar")}
              />
              <Tareas key={recorrido.id} journeyId={recorrido.id} tareas={ficha.tareas} abierto={recorrido.abierto} />
              {ficha.proyeccion ? <Proyeccion proyeccion={ficha.proyeccion} /> : null}
              <Historial pasos={ficha.historial} cambios={cambios} mensajes={mensajes} presupuestos={eventosPresupuestos} />
            </>
          ) : (
            <>
              <p className="fo-card text-sm text-[var(--fo-muted)]">
                Esta consulta todavía no está en ningún circuito. Se ordena sola al abrir el tablero de Consultas.
              </p>
              {cambios.length > 0 || mensajes.length > 0 || eventosPresupuestos.length > 0 ? (
                <Historial pasos={[]} cambios={cambios} mensajes={mensajes} presupuestos={eventosPresupuestos} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
