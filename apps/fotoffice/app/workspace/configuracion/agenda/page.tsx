import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@repo/db";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { AGENDA_MODULE_KEY } from "@/lib/agenda/acceso";
import { nombreDelCalendario } from "@/lib/agenda/google/calendario";
import { estadoDeGoogleAgenda } from "@/lib/agenda/google/estado";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CrearCalendario } from "./crear-calendario";

export const dynamic = "force-dynamic";

const FORMATO = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

/**
 * Configuración → Agenda: la conexión con Google Calendar (estado, crear el calendario propio, última
 * sincronización) y los accesos a Tipos de cita e Integraciones. Permiso: `configurar` (dueño o administrador).
 */
export default async function ConfiguracionAgendaPage() {
  const { workspace, role } = await requireActiveWorkspaceRole();

  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Agenda" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar la Agenda.</p>
      </div>
    );
  }

  const encendido = await isModuleEnabledForWorkspace(workspace.id, AGENDA_MODULE_KEY);
  if (!encendido) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="Agenda" description="Citas del equipo, con las entregas, tareas y vencimientos del negocio." />
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El módulo Agenda todavía no está encendido. Para encenderlo, pedilo desde{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Módulos
          </Link>
          .
        </div>
      </div>
    );
  }

  const ajustes = await prisma.fotofficeAgendaAjustes.findUnique({ where: { workspaceId: workspace.id }, select: { googleCalendarId: true, googleLastSyncAt: true } });
  const g = await estadoDeGoogleAgenda(workspace.id, ajustes?.googleCalendarId ?? null, ajustes?.googleLastSyncAt ?? null, new Date());
  const nombre = nombreDelCalendario(workspace.name);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Agenda" description="Conexión con Google Calendar y tipos de cita." />

      <section className="fo-card space-y-4 p-5" aria-label="Google Calendar">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Google Calendar</h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Las citas y las entregas de proyectos se copian a un calendario propio de la Agenda en Google, y lo que se cambia ahí (citas nuevas,
            movidas o borradas) vuelve a la Agenda. Las entregas son sólo de ida: mover una en Google no cambia la fecha del proyecto. No se toca
            ningún calendario de Reservas.
          </p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="text-[var(--fo-muted)]">Cuenta de Google</dt>
          <dd>
            {g.cuenta === "CONECTADA" ? (
              <span>
                <span className="font-medium text-[var(--fo-success)]">Conectada</span>
                {g.email ? ` (${g.email})` : ""}
              </span>
            ) : g.cuenta === "REQUIERE_RECONEXION" ? (
              <span className="font-medium text-[var(--fo-danger)]">Necesita reconexión</span>
            ) : (
              <span className="text-[var(--fo-muted)]">No conectada</span>
            )}{" "}
            <Link href="/workspace/configuracion/integraciones" className="text-[var(--fo-accent)] hover:underline">
              Ir a Integraciones
            </Link>
          </dd>

          <dt className="text-[var(--fo-muted)]">Calendario</dt>
          <dd>{g.calendarioCreado ? <span>Creado: «{nombre}»</span> : <span className="text-[var(--fo-muted)]">Todavía no se creó</span>}</dd>

          <dt className="text-[var(--fo-muted)]">Última sincronización</dt>
          <dd>
            {ajustes?.googleLastSyncAt ? FORMATO.format(ajustes.googleLastSyncAt) : <span className="text-[var(--fo-muted)]">Todavía no se sincronizó</span>}
          </dd>
        </dl>

        {g.avisos.map((a) => (
          <p key={a} role="status" className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm text-[var(--fo-muted)]">
            {a}
          </p>
        ))}

        {!g.calendarioCreado && g.cuenta === "CONECTADA" ? <CrearCalendario nombre={nombre} /> : null}
      </section>

      {/* TAREA 5: acá va la sección «Recordatorio al cliente» (encendido y horas de anticipación). */}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/workspace/configuracion/agenda/tipos"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Tipos de cita</span>
            <span className="block text-xs text-[var(--fo-muted)]">Nombre, color y orden de los tipos (Reunión con cliente, Evento…).</span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
        <Link
          href="/workspace/configuracion/integraciones"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Integraciones</span>
            <span className="block text-xs text-[var(--fo-muted)]">Conectar o reconectar la cuenta de Google.</span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      </div>
    </div>
  );
}
