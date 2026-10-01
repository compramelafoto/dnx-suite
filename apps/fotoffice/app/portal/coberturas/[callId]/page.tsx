import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LugarConfirmado } from "@/components/coberturas/lugar-confirmado";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { loadCallForPortal, loadCollaboratorProfile } from "@/lib/coverages/repository";
import { perfilHabilitado } from "@/lib/coverages/colaboradores";
import { lugaresLibres, type EstadoDeRol } from "@/lib/coverages/cupos";
import { puedePostularse, type CandidatoAConvocatoria } from "@/lib/coverages/elegibilidad";
import { ASSIGNMENT_LIVE_STATUSES } from "@/lib/coverages/states";
import { fechaHoraArgentina, horaArgentina } from "@/lib/coverages/format";
import { PostularseForm } from "./postularse-form";

export const dynamic = "force-dynamic";

/**
 * El detalle de una convocatoria: qué actividad es, cuándo, dónde y qué roles hacen falta.
 *
 * La dirección se muestra completa (§3.4 del diseño): quien la ve es un colaborador con sesión
 * iniciada, y sin la dirección no puede decidir si le queda cerca. Lo único que NO se muestra
 * es `privateBriefing` — eso es solo para quien ya está asignado, y `loadCallForPortal` ni
 * siquiera lo trae.
 *
 * Por rol se calcula `puedePostularse` con los datos de este instante: si no puede, se muestra
 * el motivo (uno de los mensajes amables de `elegibilidad.ts`) en vez del botón. Un rol
 * completo no bloquea — se ofrece anotarse como suplente — es la misma función la que ya
 * decide eso.
 */
export default async function PortalCoberturaDetallePage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, COVERAGES_MODULE_KEY))) {
    redirect("/portal");
  }

  const perfil = await loadCollaboratorProfile({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
  });
  if (!perfilHabilitado(perfil)) {
    return (
      <div className="space-y-6">
        <Volver />
        <section className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          Todavía no estás habilitado para anotarte a una cobertura. Hablá con la coordinación
          si querés sumarte como voluntario.
        </section>
      </div>
    );
  }

  const { callId } = await params;
  const call = await loadCallForPortal({ workspaceId: context.workspace.id, callId });
  if (!call) notFound();

  const ahora = new Date();
  const roles = call.coverage.roles.map((r) => {
    const estado: EstadoDeRol = {
      vacancies: r.vacancies,
      asignadasVivas: r.assignments.filter((a) =>
        (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(a.status),
      ).length,
      asignadasAceptadas: 0, // esta pantalla no lo necesita: no distingue invitado de confirmado
    };
    // Este rol es de una sola cobertura, pero "ya está asignado" es una regla de la COBERTURA
    // entera (ver `CoverageAssignment.@@unique([coverageId, memberId])`): si esta persona quedó
    // en otro rol de la misma cobertura, tampoco puede postularse a este.
    const yaEstaAsignado = call.coverage.roles.some((otro) =>
      otro.assignments.some(
        (a) =>
          a.memberId === context.member.id &&
          (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(a.status),
      ),
    );
    const yaSePostulo = r.applications.some((a) => a.memberId === context.member.id);

    const candidato: CandidatoAConvocatoria = {
      tienePerfilActivo: true, // ya se verificó arriba: sin esto, la pantalla ni siquiera llega acá
      yaSePostulo,
      yaEstaAsignado,
      convocatoriaStatus: call.status,
      cierreDePostulaciones: call.applicationsCloseAt,
    };

    return { ...r, estado, elegibilidad: puedePostularse(candidato, ahora) };
  });

  return (
    <div className="space-y-6">
      <Volver />

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{call.title}</h1>
        {call.publicSummary ? (
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{call.publicSummary}</p>
        ) : null}
      </header>

      <section className="fo-card space-y-3 p-5">
        <Dato
          label="Cuándo"
          valor={`${fechaHoraArgentina(call.coverage.startsAt)} a ${horaArgentina(call.coverage.endsAt)}`}
        />
        {/*
          Acá el punto no es un adorno: quien lee esta pantalla está decidiendo si se anota, y
          "Ricchieri 426" no dice lo mismo que abrir el mapa y ver que le queda a diez cuadras.
        */}
        <div className="text-sm">
          <span className="text-[var(--fo-muted)]">Dónde: </span>
          <LugarConfirmado
            direccion={
              [call.coverage.addressLine, call.coverage.city].filter(Boolean).join(", ") || "—"
            }
            latitude={call.coverage.latitude}
            longitude={call.coverage.longitude}
          />
        </div>
        {call.coverage.instructions ? (
          <Dato label="Instrucciones" valor={call.coverage.instructions} />
        ) : null}
        {call.applicationsCloseAt ? (
          <Dato label="Cierre de postulaciones" valor={fechaHoraArgentina(call.applicationsCloseAt)} />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Roles</h2>
        {roles.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
            Esta convocatoria todavía no tiene roles cargados.
          </p>
        ) : (
          <ul className="space-y-3">
            {roles.map((r) => (
              <li key={r.id} className="fo-card space-y-3 p-5">
                <div className="space-y-1">
                  <p className="font-medium">{r.name}</p>
                  {r.requirements ? (
                    <p className="text-sm text-[var(--fo-muted)]">{r.requirements}</p>
                  ) : null}
                  <p className="text-sm">
                    {lugaresLibres(r.estado) > 0
                      ? `${lugaresLibres(r.estado)} ${
                          lugaresLibres(r.estado) === 1 ? "lugar libre" : "lugares libres"
                        }`
                      : "El equipo ya está completo. Podés anotarte igual, como suplente."}
                  </p>
                </div>

                {r.elegibilidad.puede ? (
                  <PostularseForm callId={call.id} roleId={r.id} />
                ) : (
                  <p className="text-sm text-[var(--fo-muted)]">{r.elegibilidad.motivo}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Volver() {
  return (
    <Link
      href="/portal/coberturas"
      className="text-sm text-[var(--fo-muted)] underline underline-offset-4"
    >
      Volver a coberturas
    </Link>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="text-sm">
      <span className="text-[var(--fo-muted)]">{label}: </span>
      {valor}
    </p>
  );
}
