import type { Metadata } from "next";
import QRCode from "qrcode";
import { prisma } from "@repo/db";
import { voteTotals } from "@/lib/live-raffles/rules";
import { appOrigin, loadLiveRaffleByCode, publicPath } from "@/lib/live-raffles/server";
import { sponsorLogos } from "../logos-banner";
import { Pantalla } from "./pantalla";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pantalla del sorteo",
  // Un enlace secreto no se indexa: es una credencial, no una página.
  robots: { index: false, follow: false },
};

/** La pantalla del sorteador. El token del enlace es la credencial: sin él no hay nada. */
export default async function PantallaSorteoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { code } = await params;
  const { k } = await searchParams;
  const sorteo = await loadLiveRaffleByCode(code);

  if (!sorteo || !k || sorteo.screenToken !== k) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-center text-white">
        <div className="space-y-2">
          <p className="text-xl font-semibold">Este enlace no es válido</p>
          <p className="text-sm text-white/60">Copiá de nuevo el enlace de la pantalla desde el panel de FOTOFFICE.</p>
        </div>
      </main>
    );
  }

  const entrants = await prisma.liveRaffleEntrant.findMany({
    where: { liveRaffleId: sorteo.id },
    select: { id: true, firstName: true, lastName: true },
  });
  const qr = await QRCode.toDataURL(`${appOrigin()}${publicPath(sorteo.publicCode)}`, { margin: 1, width: 480 });

  return (
    <Pantalla
      code={sorteo.publicCode}
      token={k}
      title={sorteo.title}
      logoUrl={sorteo.logoUrl}
      qr={qr}
      registrationOpen={sorteo.registrationOpen}
      entrants={entrants.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
      prizes={sorteo.prizes.map((p) => ({
        id: p.id,
        title: p.title,
        sponsorName: p.sponsorName,
        sponsorLogoUrl: p.sponsorLogoUrl,
        winnerEntrantId: p.winnerEntrantId,
      }))}
      polls={sorteo.polls.map((p) => ({
        id: p.id,
        question: p.question,
        options: p.options,
        totals: voteTotals(p.options.length, p.votes),
        isOpen: p.isOpen,
      }))}
      logos={sponsorLogos(sorteo.prizes)}
    />
  );
}
