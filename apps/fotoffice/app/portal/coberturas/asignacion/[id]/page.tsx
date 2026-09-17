import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LugarConfirmado } from "@/components/coberturas/lugar-confirmado";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { loadMyAssignment } from "@/lib/coverages/repository";
import { ASSIGNMENT_LIVE_STATUSES, assignmentStatusLabel } from "@/lib/coverages/states";
import { fechaHoraArgentina, horaArgentina } from "@/lib/coverages/format";
import { ResponderForm } from "./responder-form";

export const dynamic = "force-dynamic";

/**
 * La invitación, para que la persona la conteste.
 *
 * Esta pantalla se abre desde el teléfono, con un enlace que llegó por WhatsApp: una columna,
 * los datos que hacen falta para decidir —qué actividad, cuándo, dónde, qué rol— y los dos
 * botones grandes abajo.
 *
 * **Acá y en ningún otro lado se muestra el `privateBriefing`**: el teléfono de emergencia y el
 * contacto del día. Es lo único que la convocatoria pública del portal no muestra (ver
 * `loadCallForPortal`, que a propósito ni lo trae), y se muestra acá porque quien está leyendo
 * esto ya es parte del equipo.
 *
 * `loadMyAssignment` filtra por `memberId` y por `workspaceId` en el mismo `where`: una
 * invitación que no es de esta persona no aparece, y cae en el mismo `notFound()` que un id que
 * no existe. Nadie responde la invitación de otro, y la pantalla tampoco revela que existe.
 */
export default async function PortalInvitacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, COVERAGES_MODULE_KEY))) {
    redirect("/portal");
  }

  const { id } = await params;
  const asignacion = await loadMyAssignment({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
    assignmentId: id,
  });
  if (!asignacion) notFound();

  const { coverage, role } = asignacion;
  const yaRespondio = asignacion.status !== "INVITADA";

  /**
   * Si esta persona sigue siendo parte del equipo.
   *
   * De esto depende el bloque reservado del día. Quien dijo «esta vez no puedo» —o a quien la
   * coordinación canceló o reemplazó— ya no está en el equipo, y el teléfono de emergencia y el
   * contacto del lugar son datos de terceros que el propio módulo define como "lo ve solamente
   * quien está en el equipo". El enlace le sigue llegando por WhatsApp y lo puede abrir dos
   * semanas después: la pantalla tiene que dejar de mostrárselos.
   */
  const sigueEnElEquipo = (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(
    asignacion.status,
  );

  return (
    <div className="space-y-6">
      <Volver />

      <header className="space-y-2">
        <p className="text-sm text-[var(--fo-muted)]">Te invitamos a participar</p>
        <h1 className="text-2xl font-semibold tracking-tight">{coverage.title}</h1>
        <p className="text-sm">
          Tu rol sería: <span className="font-medium">{role.name}</span>
        </p>
      </header>

      <section className="fo-card space-y-3 p-5">
        <Dato
          label="Cuándo"
          valor={`${fechaHoraArgentina(coverage.startsAt)} a ${horaArgentina(coverage.endsAt)}`}
        />
        {/*
          La pantalla de quien ya fue invitado: es la que abre el día del evento, camino al
          lugar. El "Cómo llegar" que trae `LugarConfirmado` es justamente eso.
        */}
        <div className="text-sm">
          <span className="text-[var(--fo-muted)]">Dónde: </span>
          <LugarConfirmado
            direccion={[coverage.addressLine, coverage.city].filter(Boolean).join(", ") || "—"}
            latitude={coverage.latitude}
            longitude={coverage.longitude}
          />
        </div>
        {role.requirements ? <Dato label="Qué hace falta" valor={role.requirements} /> : null}
        {coverage.instructions ? (
          <Dato label="Instrucciones" valor={coverage.instructions} />
        ) : null}
        {asignacion.respondBy ? (
          <Dato label="Avisanos antes de" valor={fechaHoraArgentina(asignacion.respondBy)} />
        ) : null}
      </section>

      {sigueEnElEquipo && coverage.call?.privateBriefing ? (
        <section className="fo-card space-y-2 p-5">
          <h2 className="text-base font-semibold">Para el día de la actividad</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {coverage.call.privateBriefing}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            Esto lo ve solamente quien está en el equipo.
          </p>
        </section>
      ) : null}

      <section className="fo-card space-y-3 p-5">
        {yaRespondio ? (
          // Volver a esta pantalla después de contestar —el enlace de WhatsApp abierto de nuevo
          // al día siguiente— no es un error: se lo dice con calma y con el estado que quedó.
          <>
            <p className="text-sm">Ya respondiste esta invitación.</p>
            <p className="text-sm text-[var(--fo-muted)]">
              Quedó como: {assignmentStatusLabel(asignacion.status)}. Si te cambió algo, hablá con
              la coordinación.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold">¿Podés venir?</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Si no podés, avisanos: dejamos el lugar libre para otra persona y no pasa nada.
            </p>
            <ResponderForm assignmentId={asignacion.id} />
          </>
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
