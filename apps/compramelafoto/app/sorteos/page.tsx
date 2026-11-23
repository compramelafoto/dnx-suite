import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Gift, Sparkles, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { RaffleStatus } from "@/lib/raffles/constants";
import { formatArgentina } from "@/lib/raffles/fechas";
import StatusBadge from "@/components/raffles/StatusBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sorteos para fotógrafos | CompraMeLaFoto",
  description: "Regalos para los fotógrafos que venden en CompraMeLaFoto, con resultados verificables.",
};

export default async function SorteosPublicosPage() {
  const sorteos = await prisma.clfRaffle
    .findMany({
      where: { status: { in: ["ANUNCIADO", "PADRON_SELLADO", "SORTEADO", "CERRADO"] } },
      orderBy: { drawsAt: "desc" },
      take: 24,
      select: {
        id: true,
        title: true,
        status: true,
        drawsAt: true,
        entrantsCount: true,
        coverImageUrl: true,
        prizes: { orderBy: { order: "asc" }, select: { title: true, imageUrl: true } },
      },
    })
    .catch(() => []);

  return (
    <main className="bg-[#fafaf9]">
      <section className="bg-gradient-to-br from-[#1c130b] via-[#3d2614] to-[#8a5528] text-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Para fotógrafos de CompraMeLaFoto
          </span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Sorteos para fotógrafos</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Todos los meses sorteamos regalos entre los fotógrafos que venden sus fotos en CompraMeLaFoto. No hace falta
            anotarse: si vendiste en el período, ya participás. Y cada resultado se puede comprobar.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12">
        {sorteos.length === 0 ? (
          <div className="rounded-3xl border border-[#111827]/10 bg-white p-12 text-center">
            <Gift className="mx-auto h-10 w-10 text-[#c27b3d]" />
            <p className="mt-3 font-semibold text-[#111827]">Muy pronto, el primer sorteo</p>
            <p className="mt-1 text-sm text-[#6b7280]">Seguí vendiendo: cuando se anuncie, ya vas a estar adentro.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {sorteos.map((s) => {
              const imagen = s.coverImageUrl || s.prizes.find((p) => p.imageUrl)?.imageUrl;
              return (
                <Link
                  key={s.id}
                  href={`/sorteos/${s.id}`}
                  className="group overflow-hidden rounded-3xl border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-[2/1] bg-gradient-to-br from-[#3d2614] to-[#c27b3d]">
                    {imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element -- imágenes subidas a R2
                      <img src={imagen} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <Gift className="absolute inset-0 m-auto h-14 w-14 text-white/70" strokeWidth={1.5} />
                    )}
                    <StatusBadge status={s.status as RaffleStatus} className="absolute left-3 top-3" />
                  </div>
                  <div className="p-5">
                    <p className="text-lg font-bold text-[#111827]">{s.title}</p>
                    {s.prizes.length > 0 && (
                      <p className="mt-1 line-clamp-1 text-sm text-[#4b5563]">{s.prizes.map((p) => p.title).join(" · ")}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6b7280]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" /> {formatArgentina(s.drawsAt)}
                      </span>
                      {s.entrantsCount ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {s.entrantsCount} participantes
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
