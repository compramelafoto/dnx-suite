import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, type RaffleStatus } from "@/lib/raffles/constants";
import { formatArgentina } from "@/lib/raffles/fechas";

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
      select: { id: true, title: true, status: true, drawsAt: true, entrantsCount: true },
    })
    .catch(() => []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Sorteos para fotógrafos</h1>
      <p className="mt-2 text-gray-600">
        Todos los meses sorteamos regalos entre los fotógrafos que venden sus fotos en CompraMeLaFoto. No hace falta
        anotarse: si vendiste en el período del sorteo, ya participás. Cada resultado se puede comprobar.
      </p>
      <div className="mt-8 space-y-3">
        {sorteos.length === 0 && <p className="text-gray-500">Todavía no hay sorteos publicados.</p>}
        {sorteos.map((s) => (
          <Link
            key={s.id}
            href={`/sorteos/${s.id}`}
            className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300"
          >
            <p className="font-semibold text-gray-900">{s.title}</p>
            <p className="text-sm text-gray-600">
              {STATUS_LABELS[s.status as RaffleStatus] ?? s.status} · sorteo el {formatArgentina(s.drawsAt)}
              {s.entrantsCount ? ` · ${s.entrantsCount} participantes` : ""}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
