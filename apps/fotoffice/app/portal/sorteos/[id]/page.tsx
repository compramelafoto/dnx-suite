import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { resolveRaffle } from "@/lib/raffles/resolve";
import { fechaHora } from "@/lib/raffles/labels";
import { Bolillero, type BolilleroPremio } from "@/components/raffles/bolillero";

export const dynamic = "force-dynamic";

export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, RAFFLES_MODULE_KEY))) {
    redirect("/portal");
  }

  const { id } = await params;
  const ahora = new Date();

  // El segundo disparador, el perezoso: si el acto ya pasó y nadie resolvió —porque la tarea
  // programada no corrió—, la primera visita lo resuelve. Es idempotente: si ya está hecho,
  // devuelve lo mismo sin tocar nada.
  const pendiente = await prisma.raffle.findFirst({
    where: {
      id,
      workspaceId: context.workspace.id,
      status: "PADRON_SELLADO",
      drawsAt: { lte: ahora },
    },
    select: { id: true },
  });
  let esperando: string | null = null;
  if (pendiente) {
    const r = await resolveRaffle({ workspaceId: context.workspace.id, raffleId: id, now: ahora });
    if (!r.ok && r.waiting) esperando = r.error;
  }

  const sorteo = await prisma.raffle.findFirst({
    where: { id, workspaceId: context.workspace.id },
    select: {
      id: true,
      title: true,
      status: true,
      drawsAt: true,
      drandRound: true,
      entrantsCount: true,
      entries: {
        orderBy: { position: "asc" },
        select: { position: true, memberNumberSnapshot: true, fullNameSnapshot: true },
      },
      prizes: {
        orderBy: { order: "asc" },
        select: {
          title: true,
          partnerNameSnapshot: true,
          award: { select: { winnerPosition: true } },
        },
      },
    },
  });
  if (!sorteo) notFound();

  const porPosicion = new Map(sorteo.entries.map((e) => [e.position, e]));
  const premios: BolilleroPremio[] = sorteo.prizes
    .filter((p): p is typeof p & { award: { winnerPosition: number } } => p.award !== null)
    .map((p) => {
      const g = porPosicion.get(p.award.winnerPosition);
      return {
        prizeTitle: p.title,
        partnerName: p.partnerNameSnapshot,
        winnerPosition: p.award.winnerPosition,
        winnerLabel: g ? `${g.memberNumberSnapshot} · ${g.fullNameSnapshot}` : "—",
      };
    });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{sorteo.title}</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Sorteado el {fechaHora(sorteo.drawsAt)} entre {sorteo.entrantsCount} socios al día.
        </p>
      </header>

      {esperando ? (
        <p className="fo-alert-warning p-4 text-sm">{esperando}</p>
      ) : premios.length === 0 ? (
        <p className="fo-card p-6 text-sm">
          Este sorteo todavía no se resolvió. Volvé a entrar después del acto.
        </p>
      ) : (
        <Bolillero
          entrantLabels={sorteo.entries.map((e) => e.memberNumberSnapshot)}
          prizes={premios}
        />
      )}

      <p className="fo-card p-6 text-sm">
        <Link href={`/portal/sorteos/${sorteo.id}/verificacion`} className="underline">
          ¿Cómo sé que esto no está arreglado?
        </Link>{" "}
        <span className="text-[var(--fo-muted)]">
          La animación sólo cuenta el resultado: ya estaba decidido antes de que abrieras esta
          página, y ahí se explica cómo comprobarlo.
        </span>
      </p>

      <p className="text-sm">
        <Link href="/portal/sorteos" className="underline">
          Volver a sorteos
        </Link>
      </p>
    </div>
  );
}
