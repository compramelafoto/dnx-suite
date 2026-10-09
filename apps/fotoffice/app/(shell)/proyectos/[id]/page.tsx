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
import { ReasignarTareas } from "@/components/proyectos/reasignar-tareas";
import { puede, puedeEnContexto } from "@/lib/access/policy";
import { claveDeRecorrido } from "@/lib/circuitos/ficha-vista";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { cargarFichaProyecto } from "@/lib/proyectos/ficha";
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

  const [ficha, role] = await Promise.all([cargarFichaProyecto(ctx, id, new Date()), resolveWorkspaceRole(user.id, workspace.id)]);
  if (!ficha) notFound();

  const puedeEditar = puedeEnContexto(ctx, "operar", PROJECTS_MODULE_KEY);
  const configura = puedeEnContexto(ctx, "configurar");
  const veContactos = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
  const vePedido = puedeEnContexto(ctx, "ver", ORDERS_MODULE_KEY);
  const { recorrido } = ficha;
  const abierto = recorrido?.recorrido.abierto === true;

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
          <ParticipantesProyecto
            proyectoId={ficha.id}
            participantes={ficha.participantes}
            roles={ficha.roles}
            equipo={ficha.equipo}
            puedeEditar={puedeEditar}
            puedeElegirContactos={veContactos}
            puedeCrearRoles={configura}
          />
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
