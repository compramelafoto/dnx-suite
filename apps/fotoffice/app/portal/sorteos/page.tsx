import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { loadPortalRaffles, type PortalRaffleView } from "@/lib/raffles/portal";
import { fechaCorta, fechaHora } from "@/lib/raffles/labels";

export const dynamic = "force-dynamic";

export default async function PortalSorteosPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, RAFFLES_MODULE_KEY))) {
    redirect("/portal");
  }

  const { current, past } = await loadPortalRaffles({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
  });

  // Lo que gané y todavía no retiré va arriba de todo: es lo único que exige que haga algo.
  const premiosMios = past.flatMap((s) =>
    s.myAwards
      .filter((a) => a.status === "GANADO" || a.status === "NOTIFICADO")
      .map((a) => ({ sorteo: s.title, ...a })),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Sorteos</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Participan los socios al día. El resultado sale de un número que no lo elige nadie, y
          cualquiera puede comprobarlo.
        </p>
      </header>

      {premiosMios.length > 0 ? (
        <section className="fo-card space-y-4 border-2 border-[var(--fo-success-border)] p-6">
          <h2 className="text-lg font-semibold">Ganaste</h2>
          {premiosMios.map((p, i) => (
            <div key={i} className="space-y-1">
              <p className="font-medium">{p.prizeTitle}</p>
              <p className="text-sm text-[var(--fo-muted)]">{p.sorteo}</p>
              {p.conditions ? <p className="text-sm">{p.conditions}</p> : null}
              {p.pickupInstructions ? <p className="text-sm">{p.pickupInstructions}</p> : null}
              {p.pickupDeadline ? (
                <p className="text-sm">
                  Podés retirarlo hasta el <strong>{fechaCorta(p.pickupDeadline)}</strong>.
                </p>
              ) : null}
            </div>
          ))}
          <p className="text-sm">
            Llevá tu <Link href="/portal/carnet" className="underline">carnet</Link>: te lo van a
            pedir al retirarlo.
          </p>
        </section>
      ) : null}

      {current ? <SorteoActual sorteo={current} /> : null}

      {!current && premiosMios.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          Por ahora no hay ningún sorteo abierto. Cuando se anuncie el próximo lo vas a ver acá.
        </p>
      ) : null}

      {past.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Sorteos anteriores</h2>
          <ul className="space-y-3">
            {past.map((s) => (
              <li key={s.id} className="fo-card space-y-2 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-[var(--fo-muted)]">{fechaHora(s.drawsAt)}</p>
                </div>
                <p className="text-sm text-[var(--fo-muted)]">
                  {s.entrantsCount} participantes · {s.prizes.length}{" "}
                  {s.prizes.length === 1 ? "premio" : "premios"}
                </p>
                <p className="flex flex-wrap gap-4 text-sm">
                  <Link href={`/portal/sorteos/${s.id}`} className="underline">
                    Ver el resultado
                  </Link>
                  <Link href={`/portal/sorteos/${s.id}/verificacion`} className="underline">
                    ¿Cómo sé que no está arreglado?
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SorteoActual({ sorteo }: { sorteo: PortalRaffleView }) {
  const { myStatus } = sorteo;

  return (
    <section className="space-y-6">
      {/* Mi situación, primero y en una sola frase. */}
      <div
        className={`fo-card p-6 ${
          myStatus.participating
            ? "border-2 border-[var(--fo-success-border)]"
            : "border-2 border-[var(--fo-warning-border)]"
        }`}
      >
        {myStatus.participating ? (
          <p className="font-medium">Estás participando de este sorteo.</p>
        ) : (
          <>
            <p className="font-medium">No estás participando.</p>
            <p className="mt-1 text-sm">{myStatus.reason}</p>
            {!myStatus.frozen ? (
              <p className="mt-2 text-sm">
                Si te ponés al día antes del {fechaHora(sorteo.entriesCloseAt)}, entrás.{" "}
                <Link href="/portal/cuotas" className="underline">
                  Ver mis cuotas
                </Link>
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="fo-card space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">{sorteo.title}</h2>
          {sorteo.description ? (
            <p className="mt-1 text-sm text-[var(--fo-muted)]">{sorteo.description}</p>
          ) : null}
        </div>

        <p className="text-sm">
          Para participar tenés que estar al día antes del{" "}
          <strong>{fechaHora(sorteo.entriesCloseAt)}</strong>. El sorteo es el{" "}
          <strong>{fechaHora(sorteo.drawsAt)}</strong>.
        </p>

        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--fo-muted)]">
            {sorteo.prizes.length === 1 ? "El premio" : "Los premios"}
          </h3>
          <ul className="space-y-3">
            {sorteo.prizes.map((p) => (
              <li key={p.id} className="flex items-start gap-3 text-sm">
                {p.partnerLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.partnerLogoUrl}
                    alt={p.partnerName ?? ""}
                    className="size-12 shrink-0 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-white object-contain p-1"
                  />
                ) : null}
                <div>
                  <span className="font-medium">{p.title}</span>
                  {p.partnerName ? (
                    <span className="text-[var(--fo-muted)]"> — lo dona {p.partnerName}</span>
                  ) : null}
                  {p.description ? (
                    <p className="text-[var(--fo-muted)]">{p.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {sorteo.status === "PADRON_SELLADO" ? (
          <p className="text-sm text-[var(--fo-muted)]">
            El padrón ya se cerró con {sorteo.entrantsCount} participantes y su huella quedó
            publicada.{" "}
            <Link href={`/portal/sorteos/${sorteo.id}/verificacion`} className="underline">
              Verla
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
