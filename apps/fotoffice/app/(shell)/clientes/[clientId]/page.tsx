import Link from "next/link";
import { notFound } from "next/navigation";
import { Ficha } from "@/components/ficha/ficha";
import { DatosFicha } from "@/components/ficha/datos-ficha";
import { MasDatos } from "@/components/campos/mas-datos";
import { Mensaje } from "@/components/mensajes/mensaje";
import type { InsigniaFicha } from "@/components/ficha/encabezado-ficha";
import { requireClientsViewer } from "@/lib/clients/access";
import {
  getClient,
  listMembersAvailableToLink,
} from "@/lib/clients/repository";
import { clientDisplayName } from "@/lib/clients/display";
import { resolverPersonaPorCliente } from "@/lib/ficha/persona";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { listMovements } from "@/lib/cash/repository";
import { MovementsTable } from "@/app/(shell)/caja/movements-table";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { perfilDe } from "@/lib/contactos/perfil";
import { consultasDelContacto } from "@/lib/contactos/consultas-del-contacto";
import { ETIQUETA_CATEGORIA_CONTACTO } from "@/lib/consultas/constantes";
import { PerfilContactoTarjeta } from "@/components/contactos/perfil-contacto";
import { ConsultasDelContacto } from "@/components/contactos/consultas-del-contacto";
import { aTarjeta, TarjetaPresupuestos } from "@/components/presupuestos/tarjeta-presupuestos";
import { aTarjetaPedido, TarjetaPedidos } from "@/components/pedidos/tarjeta-pedidos";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { listarPedidos } from "@/lib/pedidos/pedidos";
import { TarjetaContratos } from "@/components/contratos/tarjeta-contratos";
import { contratosParaTarjeta } from "@/lib/contratos/tarjetas";
import { TarjetaProyectos } from "@/components/proyectos/tarjeta-proyectos";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { proyectosEncendidos } from "@/lib/proyectos/crear";
import { proyectosParaTarjeta } from "@/lib/proyectos/tarjetas";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { listarPresupuestos } from "@/lib/presupuestos/presupuestos";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { ResumenDesplegable } from "@/components/entidades/resumen-desplegable";
import { cuadrosDelResumen } from "@/lib/clients/resumen";
import { pesosPedido } from "@/lib/pedidos/pantalla";
import { destinoWhatsappDeCliente } from "@/lib/bandeja/destino-whatsapp-servidor";
import { DetalleIncrustado } from "@/components/ficha/detalle-incrustado";
import { Desplegable } from "@/components/ficha/desplegable";
import { hrefFichaCliente } from "@/components/entidades/enlace-cliente";
import { leerDetallePedido, PANEL_DE_DETALLE, VISTA_FICHA, type DetallePedido } from "@/lib/ficha/detalle-en-ficha";
import FichaConsultaPage from "../../consultas/[id]/page";
import PresupuestoPage from "../../presupuestos/[id]/page";
import PedidoPage from "../../pedidos/[id]/page";
import FichaContratoPage from "../../contratos/[id]/page";
import FichaProyectoPage from "../../proyectos/[id]/page";
import { datosDeCuestionariosDelCliente } from "@/lib/cuestionarios/cuestionarios-servidor";
import { EnviarCuestionario } from "@/components/cuestionarios/enviar-cuestionario";
import { InformacionAdicional } from "@/components/cuestionarios/informacion-adicional";
import { ClientForm } from "../client-form";
import { linkClientToMemberAction } from "../actions";

/** Cuántos movimientos recientes se muestran en la ficha: es un resumen, no el libro completo. */
const MOVIMIENTOS_RECIENTES = 20;

export const dynamic = "force-dynamic";

const TIPO: Record<string, string> = { PERSONA: "Persona", EMPRESA: "Empresa" };

/** "SG" para Sabrina Gugliota; la primera letra de la razón social para una empresa. */
function inicialesDe(c: { kind: string; firstName: string | null; lastName: string | null; businessName: string | null }): string | undefined {
  const partes = c.kind === "EMPRESA" ? [c.businessName] : [c.firstName, c.lastName];
  const letras = partes
    .map((p) => p?.trim().charAt(0) ?? "")
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return letras || undefined;
}

/**
 * Ficha del cliente sobre la ficha estándar: encabezado con contacto (íconos) y el lápiz que abre
 * todos los datos para editar; los cuadros del resumen; el elemento abierto (`?ver=consulta:<id>`)
 * debajo, sin salir de la ficha; y la historia con sus accesos directos (Notas, Archivos, Plata…).
 * Las categorías de notas las asegura `<Ficha>` después de su propio control de acceso.
 */
export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ error?: string; ok?: string; ver?: string | string[] }>;
}) {
  const { user, workspace, canEdit } = await requireClientsViewer();
  const { clientId } = await params;
  const query = await searchParams;
  // El elemento abierto adentro de la ficha (consulta, cotización…), si lo hay.
  const detalle = leerDetallePedido(query.ver);

  const persona = await resolverPersonaPorCliente(workspace.id, clientId);
  if (!persona) notFound();
  const cliente = await getClient(workspace.id, clientId);
  if (!cliente) notFound();

  const socios = canEdit
    ? await listMembersAvailableToLink(workspace.id, cliente.member?.id ?? null)
    : [];

  // Acceso resuelto una vez: historia (Gestionar en Clientes) y la tarjeta de Consultas (Ver
  // en Consultas; el nivel ya incluye que el módulo esté encendido). Crear una consulta para
  // este contacto pide Gestionar en Consultas.
  const acceso = await resolverAcceso(user.id, workspace.id);
  // Cuestionarios (XV, bodas…): enviar uno y ver lo que respondió, en «Información adicional».
  const cuestionarios = await datosDeCuestionariosDelCliente(workspace.id, cliente.id);
  const whatsapp = await destinoWhatsappDeCliente({ workspaceId: workspace.id, acceso, clientId: cliente.id, telefono: cliente.phone });
  const veConsultas = puede(acceso, "ver", SERVICE_LEADS_MODULE_KEY);
  const creaConsultas = puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY);
  const [perfiles, delContacto] = await Promise.all([
    perfilDe(workspace.id, [cliente.id]),
    veConsultas ? consultasDelContacto(workspace.id, cliente.id) : Promise.resolve(null),
  ]);
  // Tarjeta "Presupuestos" del contacto: con "Ver" en Presupuestos; nunca lleva costos.
  const vePresupuestos = puede(acceso, "ver", QUOTES_MODULE_KEY);
  const presupuestos = vePresupuestos
    ? (
        await listarPresupuestos(
          { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
          { clientId: cliente.id },
        )
      ).map(aTarjeta)
    : null;
  // Tarjeta "Pedidos" del contacto: con "Ver" en Pedidos; "Nuevo pedido" con "Gestionar". Nunca
  // lleva costos (`aTarjetaPedido`).
  const vePedidos = puede(acceso, "ver", ORDERS_MODULE_KEY);
  const pedidos = vePedidos
    ? (
        await listarPedidos(
          { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
          { clientId: cliente.id },
        )
      ).map(aTarjetaPedido)
    : null;
  // Tarjeta "Proyectos" del contacto: con el módulo encendido y "Ver" en Proyectos.
  const proyectos =
    puede(acceso, "ver", PROJECTS_MODULE_KEY) && (await proyectosEncendidos(workspace.id))
      ? await proyectosParaTarjeta(
          { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
          { clientId: cliente.id },
        )
      : null;
  // Tarjeta "Contratos" del contacto: con el módulo encendido y "Ver" en Contratos (si no, null y no se lee nada).
  const contratos = await contratosParaTarjeta(
    { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
    { clientId: cliente.id },
  );
  const perfil = perfiles.get(cliente.id);
  if (!perfil) notFound();

  const insignias: InsigniaFicha[] = [
    { texto: ETIQUETA_CATEGORIA_CONTACTO[perfil.category] },
    ...(cliente.member
      ? [
          {
            texto: `También es socio N° ${cliente.member.memberNumber}`,
            href: `/members/${cliente.member.id}`,
          },
        ]
      : []),
  ];

  // El módulo de Caja es de otro workspace-feature: si está apagado acá, no hay libro que
  // mostrar. Con roles, además, ver Clientes no da derecho a ver la plata: el consumo sale del
  // libro de Caja, así que pide al menos VIEW en Caja (el nivel ya incluye que el módulo esté
  // encendido).
  // Con "Gestionar" en Clientes la ficha tiene línea de tiempo, y ahí ya están estos movimientos
  // (filtro Plata, con la misma regla de VIEW en Caja). Sólo sin historia (nivel "Ver") se
  // muestra la lista de Consumo de main, para que nadie pierda lo que hoy ve.
  const veHistoria = puede(acceso, "operar", CLIENTS_MODULE_KEY);
  const cajaHabilitada =
    !veHistoria &&
    hasLevel(await getModuleLevel(user.id, workspace.id, CASH_MODULE_KEY), "VIEW");
  const movimientos = cajaHabilitada
    ? await listMovements(workspace.id, {
        clientId: cliente.id,
        take: MOVIMIENTOS_RECIENTES,
      })
    : [];

  // Los cuadros de colores: uno por elemento que la persona puede ver.
  const cuadros = cuadrosDelResumen(
    {
      consultas: delContacto ? { cantidad: delContacto.consultas.length, hayMas: delContacto.hayMas } : null,
      cotizaciones: presupuestos,
      pedidos,
      contratos,
      proyectos,
    },
    pesosPedido,
  );

  return (
    <div className="space-y-4">
      <Link
        href="/clientes"
        className="text-sm text-[var(--fo-muted)] hover:underline"
      >
        ← Volver a clientes
      </Link>

      {query.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
          Listo, se guardó.
        </p>
      ) : null}
      {/* Arriba de todo (y no dentro del formulario, que ahora está en la columna lateral):
          acá llegan los errores del formulario y los del enlace con el socio. */}
      {query.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {query.error}
        </p>
      ) : null}

      <Ficha
        persona={{ tipo: "CLIENTE", id: cliente.id }}
        encabezado={{
          titulo: clientDisplayName(cliente),
          iniciales: inicialesDe(cliente),
          subtitulo: `Cliente N° ${cliente.clientNumber} · ${TIPO[cliente.kind] ?? cliente.kind}`,
          insignias,
          telefono: cliente.phone,
          correo: cliente.email,
          whatsapp,
          // Correo desde FOTOFFICE, WhatsApp con plantilla y pedir testimonio, como íconos. Sin
          // «Gestionar» no se dibujan y queda el correo común (`mailto:`).
          herramientas: (
            <>
              <Mensaje entityType="CLIENTE" entityId={cliente.id} compacto correoAlternativo={cliente.email} />
              {canEdit && cuestionarios.disponible && cuestionarios.cuestionarios.length > 0 ? (
                <EnviarCuestionario
                  clientId={cliente.id}
                  telefono={cuestionarios.cliente.telefono}
                  correo={cuestionarios.cliente.correo}
                  nombre={cuestionarios.cliente.nombre}
                  cuestionarios={cuestionarios.cuestionarios}
                />
              ) : null}
            </>
          ),
          correoEnHerramientas: true,
        }}
        edicionAbierta={Boolean(query.error)}
        accesos={[
          {
            clave: "informacion-adicional",
            texto: "Información adicional",
            contenido: <InformacionAdicional clientId={cliente.id} datos={cuestionarios} puedeEnviar={canEdit} />,
          },
        ]}
        detalle={
          detalle ? (
            <DetalleIncrustado tipo={detalle.tipo} id={detalle.id} hrefCerrar={hrefFichaCliente(cliente.id)}>
              {pantallaDelDetalle(detalle)}
            </DetalleIncrustado>
          ) : null
        }
        resumen={
          cuadros.length > 0 ? (
            <ResumenDesplegable
              cuadros={cuadros}
              inicial={detalle ? PANEL_DE_DETALLE[detalle.tipo] : undefined}
              paneles={{
                consultas: delContacto ? (
                  <ConsultasDelContacto clientId={cliente.id} consultas={delContacto.consultas} hayMas={delContacto.hayMas} puedeCrear={creaConsultas} enFicha />
                ) : null,
                cotizaciones: presupuestos ? (
                  <TarjetaPresupuestos
                    presupuestos={presupuestos}
                    hrefNuevo={`/presupuestos/nuevo?contacto=${encodeURIComponent(cliente.id)}`}
                    puedeCrear={puede(acceso, "operar", QUOTES_MODULE_KEY)}
                    vacio="Todavía no tiene cotizaciones."
                    enFicha={cliente.id}
                  />
                ) : null,
                pedidos: pedidos ? (
                  <TarjetaPedidos
                    pedidos={pedidos}
                    hrefNuevo={puede(acceso, "operar", ORDERS_MODULE_KEY) ? `/pedidos/nuevo?contacto=${encodeURIComponent(cliente.id)}` : null}
                    vacio="Todavía no tiene pedidos."
                    enFicha={cliente.id}
                  />
                ) : null,
                proyectos: proyectos ? <TarjetaProyectos proyectos={proyectos} vacio="Todavía no tiene proyectos." enFicha={cliente.id} /> : null,
                contratos: contratos ? <TarjetaContratos contratos={contratos} vacio="Todavía no tiene contratos." enFicha={cliente.id} /> : null,
              }}
            />
          ) : null
        }
        datos={
          <>
            <DatosFicha titulo="Datos">
              {/* Sin MANAGE se ve igual, pero deshabilitado: `fieldset disabled` apaga cada campo y el
                  botón de guardar. La acción igual rebota del lado del servidor. */}
              <fieldset disabled={!canEdit} className="contents">
                <ClientForm client={cliente} enColumna />
              </fieldset>
            </DatosFicha>
            <PerfilContactoTarjeta clientId={cliente.id} perfil={perfil} puedeEditar={canEdit} />
            <MasDatos entityType="CLIENTE" entityId={cliente.id} />
          </>
        }
        lateral={
          <>
            <DatosFicha titulo="¿Es socio?">
              <p className="text-sm text-[var(--fo-muted)]">
                {cliente.member ? (
                  <>
                    Esta ficha está enlazada con el{" "}
                    <Link
                      href={`/members/${cliente.member.id}`}
                      className="hover:underline"
                    >
                      socio N° {cliente.member.memberNumber}
                    </Link>
                    .
                  </>
                ) : canEdit ? (
                  "Si esta persona también es socio de la institución, elegilo acá para enlazar las dos fichas."
                ) : (
                  "Esta ficha no está enlazada con ningún socio."
                )}
              </p>
              {canEdit ? (
                <form action={linkClientToMemberAction} className="space-y-3">
                  <input type="hidden" name="clientId" value={cliente.id} />
                  <div className="fo-field-stack">
                    <label className="fo-label" htmlFor="memberId">
                      Socio
                    </label>
                    <select
                      id="memberId"
                      name="memberId"
                      className="fo-input"
                      defaultValue={cliente.member?.id ?? ""}
                    >
                      <option value="">No es socio</option>
                      {socios.map((s) => (
                        <option key={s.id} value={s.id}>
                          N° {s.memberNumber} — {s.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="fo-btn fo-btn-secondary text-sm"
                  >
                    Guardar enlace
                  </button>
                </form>
              ) : null}
            </DatosFicha>
          </>
        }
        principal={
          cajaHabilitada ? (
            <Desplegable titulo="Consumo" detalle={movimientos.length > 0 ? `${movimientos.length} movimientos` : "Sin movimientos"}>
              <MovementsTable movements={movimientos} showAccount />
            </Desplegable>
          ) : undefined
        }
      />
    </div>
  );
}

/**
 * La pantalla de un elemento, dibujada adentro de la ficha. Es la misma página de siempre (con sus
 * guardas y sus permisos) en modo `vista=ficha`: todo lo que se puede hacer ahí se hace acá.
 */
function pantallaDelDetalle(d: DetallePedido) {
  const params = Promise.resolve({ id: d.id });
  const searchParams = Promise.resolve({ vista: VISTA_FICHA });
  switch (d.tipo) {
    case "consulta":
      return <FichaConsultaPage params={params} searchParams={searchParams} />;
    case "cotizacion":
      return <PresupuestoPage params={params} searchParams={searchParams} />;
    case "pedido":
      return <PedidoPage params={params} searchParams={searchParams} />;
    case "contrato":
      return <FichaContratoPage params={params} searchParams={searchParams} />;
    case "proyecto":
      return <FichaProyectoPage params={params} searchParams={searchParams} />;
  }
}
