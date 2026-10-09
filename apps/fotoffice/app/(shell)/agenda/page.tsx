import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { AgendaCalendar } from "@/components/agenda/agenda-calendar";
import type { DatosDialogo } from "@/components/agenda/dialogo-cita";
import { puedeEnContexto } from "@/lib/access/policy";
import { puedeGestionarAgenda } from "@/lib/agenda/acceso";
import { diaArgentina, instanteArgentina, rangoDeVista } from "@/lib/agenda/fechas";
import { prepararAgenda, requireAgenda } from "@/lib/agenda/pagina";
import { listarTipos } from "@/lib/agenda/tipos";
import { capasIniciales, direccionAgenda, leerParametros, minutosDesdeInicioDelDia, type ParametrosAgenda } from "@/lib/agenda/vista-cliente";
import { cargarVistaAgenda, leerDetalleDeCita } from "@/lib/agenda/vista";
import { responsablesDe } from "@/lib/circuitos/tablero";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";

export const dynamic = "force-dynamic";

/**
 * Agenda del equipo: citas con las entregas, tareas, cuotas, consultas, cumpleaños y reservas como capas
 * encendibles, en vistas día, semana, mes y lista. Con "Ver" en Agenda se mira; con "Gestionar" se crean,
 * editan y arrastran las citas. Cada capa se lee sólo si su módulo está encendido y la persona tiene
 * "Ver" en él (`cargarVistaAgenda`).
 */
export default async function AgendaPage({ searchParams }: { searchParams: Promise<ParametrosAgenda> }) {
  const { user, workspace, ctx } = await requireAgenda("ver");
  const params = await searchParams;
  await prepararAgenda(workspace.id);

  const ahora = new Date();
  const hoy = diaArgentina(ahora);
  const leidos = leerParametros(params, ahora);
  const { ymd, vista, vistaCalendario, ownerUserId } = leidos;
  const rango = rangoDeVista(vistaCalendario, ymd);

  const [datos, tipos, equipo, roles, ajustes] = await Promise.all([
    cargarVistaAgenda(ctx, { rango, ownerUserId }),
    listarTipos(ctx, { conBajas: true }),
    responsablesDe(workspace.id),
    prisma.fotofficeProyectoRol.findMany({ where: { workspaceId: workspace.id, isActive: true }, select: { id: true, name: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    prisma.fotofficeAgendaAjustes.findUnique({ where: { workspaceId: workspace.id }, select: { defaultLayers: true } }),
  ]);

  const puedeGestionar = puedeGestionarAgenda(ctx);

  // El diálogo que abre la dirección: una cita (`?cita=`) o una cita nueva ligada a un registro (`?nueva=1&pedido=…`).
  let dialogoInicial: DatosDialogo | null = null;
  if (leidos.citaId) {
    const cita = datos.citas.find((c) => c.id === leidos.citaId) ?? (await leerDetalleDeCita(ctx, leidos.citaId));
    if (cita) dialogoInicial = { modo: "editar", cita };
  } else if (leidos.nueva.abrir && puedeGestionar) {
    const inicio = instanteArgentina(ymd === hoy || vista !== "dia" ? hoy : ymd, 9 * 60);
    dialogoInicial = {
      modo: "crear",
      inicio: inicio.toISOString(),
      fin: new Date(inicio.getTime() + 60 * 60_000).toISOString(),
      todoElDia: false,
      origen: { proyectoId: leidos.nueva.proyectoId, pedidoId: leidos.nueva.pedidoId, consultaLeadId: leidos.nueva.consultaLeadId },
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Las citas del equipo y, sobre el mismo calendario, las entregas, tareas, cuotas, consultas y cumpleaños. Tocá una cita para verla o editarla; arrastrala para moverla."
      />
      <AgendaCalendar
        key={`${leidos.citaId ?? ""}|${dialogoInicial?.modo ?? ""}|${leidos.nueva.pedidoId ?? ""}${leidos.nueva.proyectoId ?? ""}${leidos.nueva.consultaLeadId ?? ""}`}
        vista={vista}
        vistaCalendario={vistaCalendario}
        ymd={ymd}
        todayYmd={hoy}
        nowMinute={minutosDesdeInicioDelDia(ahora, hoy)}
        eventos={datos.eventos}
        capasDisponibles={datos.capas}
        capasIniciales={capasIniciales(datos.capas, ajustes?.defaultLayers)}
        truncadas={datos.truncadas}
        citas={datos.citas}
        tipos={tipos.map((t) => ({ id: t.id, name: t.name, color: t.color, isActive: t.isActive }))}
        equipo={equipo}
        roles={roles.map((r) => ({ id: r.id as string, nombre: r.name as string }))}
        puedeGestionar={puedeGestionar}
        puedeContactos={puedeGestionar && puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)}
        yoId={user.id}
        responsable={ownerUserId}
        direccionLimpia={direccionAgenda(vista, ymd, ownerUserId)}
        dialogoInicial={dialogoInicial}
      />
    </div>
  );
}
