import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MasDatos } from "@/components/campos/mas-datos";
import { Historial } from "@/components/circuitos/historial";
import { Proyeccion } from "@/components/circuitos/proyeccion";
import { Recorrido } from "@/components/circuitos/recorrido";
import { Tareas } from "@/components/circuitos/tareas";
import { AdjuntosProyecto } from "@/components/proyectos/adjuntos-proyecto";
import { DatosProyecto } from "@/components/proyectos/datos-proyecto";
import { NotasProyecto } from "@/components/proyectos/notas-proyecto";
import { ParticipantesProyecto } from "@/components/proyectos/participantes-proyecto";
import { PlanProyecto } from "@/components/proyectos/plan-proyecto";
import { ProveedorProyecto } from "@/components/proyectos/proveedor-proyecto";
import { CarpetaProyecto } from "@/components/proyectos/carpeta-proyecto";
import { PedidoDelTrabajo } from "@/components/impresiones/pedido-del-trabajo";
import { pedidoDelTrabajo } from "@/lib/impresiones/trabajo-servidor";
import { fotolibroDelTrabajo } from "@/lib/fotolibro/venta-servidor";
import { listarArchivos } from "@/lib/carpetas/carpeta";
import { leerProveedorDelTrabajo } from "@/lib/proyectos/proveedor";
import { ReasignarTareas } from "@/components/proyectos/reasignar-tareas";
import { TarjetaCitas } from "@/components/agenda/tarjeta-citas";
import { TarjetaGaleriasProyecto } from "@/components/galerias/tarjeta-galerias-proyecto";
import { puede, puedeEnContexto } from "@/lib/access/policy";
import { citasDeOrigen } from "@/lib/agenda/de-origen";
import { claveDeRecorrido } from "@/lib/circuitos/ficha-vista";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { puedeGestionarGalerias } from "@/lib/galerias/acceso";
import { galeriasEncendidas } from "@/lib/galerias/contexto";
import { galeriasDeProyecto } from "@/lib/galerias/galerias";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { cargarFichaProyecto } from "@/lib/proyectos/ficha";
import { leerCandadoDeLaFicha } from "@/lib/proyectos/candado-ficha";
import { prepararProyectos, requireProyectos } from "@/lib/proyectos/pagina";
import { resolveWorkspaceRole } from "@/lib/workspace-role";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Ficha de un proyecto. Primero la guarda (módulo encendido y "Ver"), después la lectura acotada
 * al workspace de la sesión: un proyecto de otro workspace o inexistente cae en `notFound()`. Con
 * "Gestionar" se edita, se mueve, se suspende y se arma el equipo; el servidor lo vuelve a decidir
 * en cada acción.
 */
export default async function FichaProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, workspace, ctx } = await requireProyectos("ver");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();
  await prepararProyectos(workspace.id);

  const [ficha, role, proveedor, pedidoImpresion, fotolibro] = await Promise.all([
    cargarFichaProyecto(ctx, id, new Date()),
    resolveWorkspaceRole(user.id, workspace.id),
    leerProveedorDelTrabajo(ctx, id),
    // Sólo si el trabajo nació de un pedido de copias impresas (acotado al workspace de la sesión).
    pedidoDelTrabajo(workspace.id, id),
    // El fotolibro vendido en el Cobrador (ver `lib/fotolibro/venta-servidor.ts`).
    fotolibroDelTrabajo(workspace.id, id),
  ]);
  const archivos = adjuntosR2Configurado() ? await listarArchivos(ctx, id) : null;
  if (!ficha) notFound();
  // Tarjeta "Citas": sólo con el módulo Agenda encendido y "Ver" en Agenda (si no, null y no se lee nada).
  const citas = await citasDeOrigen(ctx, { proyectoId: ficha.id });

  // Tarjeta "Galerías": sólo con el módulo Galería encendido y "Ver" en Galería (si no, null y no se lee nada).
  const galerias = (await galeriasEncendidas(workspace.id)) ? await galeriasDeProyecto(ctx, ficha.id) : null;

  const puedeEditar = puedeEnContexto(ctx, "operar", PROJECTS_MODULE_KEY);
  const configura = puedeEnContexto(ctx, "configurar");
  const veContactos = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
  const vePedido = puedeEnContexto(ctx, "ver", ORDERS_MODULE_KEY);
  const { recorrido } = ficha;
  const abierto = recorrido?.recorrido.abierto === true;
  // Candado del saldo: si el pedido debe plata, la ficha lo dice y no ofrece entregar (el motor
  // lo rechazaría igual, con el mismo mensaje).
  const candado =
    abierto && recorrido && ficha.pedido
      ? await leerCandadoDeLaFicha(workspace.id, { pedidoId: ficha.pedido.id, circuitId: recorrido.recorrido.circuito.id, etapaActualId: recorrido.recorrido.etapaActualId })
      : null;

  // Nombre de cada persona del equipo del workspace (responsable, delegado, dueños de tareas).
  const nombres: Record<string, string> = {};
  for (const m of ficha.miembros) nombres[String(m.id)] = m.nombre;

  return (
    <div className="space-y-6">
      <PageHeader
        title={ficha.nombre}
        description={`N° ${ficha.numero} · ${ficha.contacto.nombre}`}
        actions={
          <Link href="/proyectos" className="fo-btn fo-btn-secondary text-sm">
            Volver a Proyectos
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4 self-start">
          <DatosProyecto
            veContactos={veContactos}
            key={`${ficha.id}:${ficha.estado}:${ficha.finalDueDate ?? ""}:${ficha.responsable?.id ?? ""}:${ficha.delegado?.id ?? ""}:${ficha.nombre}`}
            datos={{
              id: ficha.id,
              numero: ficha.numero,
              nombre: ficha.nombre,
              descripcion: ficha.descripcion,
              contacto: ficha.contacto,
              pedido: vePedido && ficha.pedido ? { id: ficha.pedido.id, numero: ficha.pedido.numero } : null,
              producto: ficha.producto,
              flujo: ficha.circuito.nombre,
              eventDate: ficha.eventDate,
              baseDate: ficha.baseDate,
              finalDueDate: ficha.finalDueDate,
              responsableId: ficha.responsable?.id ?? null,
              delegadoId: ficha.delegado?.id ?? null,
              suspension: ficha.suspension,
              estado: ficha.estado,
              atraso: ficha.atraso,
              etapaActual: ficha.etapaActual,
            }}
            equipo={ficha.equipo}
            nombres={nombres}
            puedeEditar={puedeEditar}
          />
          {vePedido && ficha.pedido ? (
            <section aria-labelledby="pedido-vinculado-titulo" className="fo-card space-y-2 p-4">
              <h2 id="pedido-vinculado-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Pedido vinculado
              </h2>
              <Link href={`/pedidos/${encodeURIComponent(ficha.pedido.id)}`} className="block rounded-[var(--fo-radius-sm)] text-sm hover:bg-[var(--fo-surface-hover)]">
                <span className="font-medium text-[var(--fo-text)]">Pedido N° {ficha.pedido.numero}</span>
                <span className="ml-2 text-xs text-[var(--fo-muted)]">{ficha.pedido.estado}</span>
              </Link>
            </section>
          ) : null}
          {fotolibro ? (
            <section aria-labelledby="fotolibro-titulo" className="fo-card space-y-2 p-4">
              <h2 id="fotolibro-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Fotolibro
              </h2>
              <p className="text-sm font-medium text-[var(--fo-text)]">{fotolibro.nombre}</p>
              <Link href={fotolibro.url} target="_blank" className="fo-btn fo-btn-primary text-sm">
                Abrir el fotolibro
              </Link>
            </section>
          ) : null}
          {pedidoImpresion ? <PedidoDelTrabajo pedido={pedidoImpresion} puedeEditar={puedeEditar} /> : null}
          {proveedor ? (
            <ProveedorProyecto
              key={`${proveedor.proveedorId ?? ""}:${proveedor.enviadoAt?.toISOString() ?? ""}`}
              proyectoId={ficha.id}
              inicial={proveedor}
              proveedores={proveedor.proveedores}
              enviadoAt={proveedor.enviadoAt ? proveedor.enviadoAt.toISOString() : null}
              puedeEditar={puedeEditar}
            />
          ) : null}
          {archivos ? (
            <CarpetaProyecto proyectoId={ficha.id} archivos={archivos} vence={proveedor?.carpetaVence ?? null} puedeEditar={puedeEditar} />
          ) : null}
          {galerias ? <TarjetaGaleriasProyecto proyectoId={ficha.id} galerias={galerias} puedeCrear={puedeGestionarGalerias(ctx)} /> : null}
          <ParticipantesProyecto
            proyectoId={ficha.id}
            participantes={ficha.participantes}
            roles={ficha.roles}
            equipo={ficha.equipo}
            puedeEditar={puedeEditar}
            puedeElegirContactos={veContactos}
            puedeCrearRoles={configura}
          />
          {citas ? <TarjetaCitas citas={citas} nueva={`proyecto=${encodeURIComponent(ficha.id)}`} vacio="Este proyecto todavía no tiene citas." /> : null}
          <MasDatos entityType="PROYECTO" entityId={ficha.id} />
        </div>

        <div className="min-w-0 space-y-6">
          {recorrido ? (
            <>
              <Recorrido
                key={claveDeRecorrido(recorrido.recorrido)}
                tipo="PROYECTO"
                recorrido={recorrido.recorrido}
                titulo={ficha.nombre}
                motivos={ficha.motivos}
                responsables={ficha.equipo}
                puedePasarIgual={puede(role, "configurar")}
                candado={candado}
              />
              <PlanProyecto plan={ficha.plan} atraso={ficha.atraso} />
              <Tareas key={recorrido.recorrido.id} journeyId={recorrido.recorrido.id} tareas={recorrido.tareas} abierto={abierto} responsables={ficha.miembros} />
              {puedeEditar && abierto ? (
                <ReasignarTareas proyectoId={ficha.id} equipo={ficha.equipo} hayPendientes={recorrido.tareas.some((t) => !t.hecha)} />
              ) : null}
              {recorrido.proyeccion ? <Proyeccion proyeccion={recorrido.proyeccion} /> : null}
              <Historial pasos={recorrido.historial} />
            </>
          ) : (
            <p className="fo-card text-sm text-[var(--fo-muted)]">Este proyecto todavía no está en ningún flujo.</p>
          )}
          <NotasProyecto proyectoId={ficha.id} notas={ficha.notas} puedeAgregar={puedeEditar} />
          <AdjuntosProyecto
            proyectoId={ficha.id}
            adjuntos={ficha.adjuntos}
            habilitados={adjuntosR2Configurado()}
            puedeEditar={puedeEditar}
            esConfigurador={configura}
          />
        </div>
      </div>
    </div>
  );
}
