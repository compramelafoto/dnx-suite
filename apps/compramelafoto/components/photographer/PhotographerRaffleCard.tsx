"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Gift, Trophy } from "lucide-react";
import { formatArgentina } from "@/lib/raffles/fechas";

type Sorteo = {
  id: string;
  title: string;
  status: string;
  salesTo: string;
  drawsAt: string;
  minSales: number;
  entrantsCount: number | null;
  coverImageUrl: string | null;
  logos: { logoUrl: string; name: string | null }[];
  prizes: { title: string; sponsorName: string | null; imageUrl: string | null }[];
  misVentas: number | null;
  participa: boolean | null;
  gane: string[];
};

/**
 * La tarjeta del sorteo en el inicio del panel: qué se sortea (con fotos), si ya participa o
 * cuántas ventas le faltan y, si ya se sorteó, si ganó. Sin sorteos no muestra nada.
 */
export default function PhotographerRaffleCard() {
  const [sorteos, setSorteos] = useState<Sorteo[]>([]);

  useEffect(() => {
    let activo = true;
    fetch("/api/fotografo/sorteos")
      .then((r) => (r.ok ? r.json() : { raffles: [] }))
      .then((d) => {
        if (activo) setSorteos(Array.isArray(d.raffles) ? d.raffles : []);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  if (sorteos.length === 0) return null;

  return (
    <div className="mb-6 space-y-4">
      {sorteos.map((s) => {
        const abierto = s.status === "ANUNCIADO";
        const sorteado = s.status === "SORTEADO" || s.status === "CERRADO";
        const faltan = abierto && s.misVentas !== null ? Math.max(0, s.minSales - s.misVentas) : 0;
        const gano = s.gane.length > 0;

        let titular: string;
        let detalle: string | null = null;
        if (gano) {
          titular = `¡Ganaste ${s.gane.join(" y ")}!`;
          detalle = "Te escribimos por correo para coordinar la entrega.";
        } else if (sorteado) {
          titular = s.participa ? "Esta vez no saliste" : "Ya se sorteó";
          detalle = s.participa ? "¡Seguí vendiendo: el próximo puede ser tuyo!" : null;
        } else if (s.participa) {
          titular = "Ya estás participando";
          detalle = s.misVentas ? `Con ${s.misVentas} ${s.misVentas === 1 ? "venta" : "ventas"} en el período. ¡Suerte!` : "¡Suerte!";
        } else if (abierto && faltan === 0) {
          titular = "Tu cuenta no participa de este sorteo";
        } else if (abierto) {
          titular =
            faltan === 1 && s.minSales === 1 ? "Vendé una foto y entrás al sorteo" : `Te ${faltan === 1 ? "falta 1 venta" : `faltan ${faltan} ventas`} para entrar`;
          detalle = `Cuentan las ventas hasta el ${formatArgentina(new Date(new Date(s.salesTo).getTime() - 1), false)}.`;
        } else {
          titular = "Esta vez no entraste";
          detalle = "No hubo ventas en el período.";
        }

        const fotos = s.prizes.filter((p) => p.imageUrl).slice(0, 3);

        return (
          <Link
            key={s.id}
            href={`/sorteos/${s.id}`}
            className={`group relative block overflow-hidden rounded-3xl text-white shadow-sm transition hover:shadow-lg ${
              gano ? "bg-gradient-to-br from-[#065f46] via-[#047857] to-[#c27b3d]" : "bg-gradient-to-br from-[#1c130b] via-[#3d2614] to-[#8a5528]"
            }`}
          >
            {s.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- portada subida a R2
              <img src={s.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            )}
            <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200/90">🎁 {s.title}</p>
                <p className="mt-2 flex items-center gap-2 text-xl font-bold sm:text-2xl">
                  {gano ? <Trophy className="h-6 w-6 text-amber-300" /> : s.participa ? <CheckCircle2 className="h-6 w-6 text-emerald-300" /> : null}
                  {titular}
                </p>
                {detalle && <p className="mt-1 text-sm text-white/80">{detalle}</p>}

                {abierto && s.minSales > 1 && s.misVentas !== null && (
                  <div className="mt-3 max-w-xs">
                    <div className="h-2 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, (s.misVentas / s.minSales) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-white/60">
                      {s.misVentas} de {s.minSales} ventas
                    </p>
                  </div>
                )}

                <p className="mt-3 text-xs text-white/60">
                  {sorteado
                    ? `Sorteado el ${formatArgentina(new Date(s.drawsAt), false)}${s.entrantsCount ? ` entre ${s.entrantsCount} fotógrafos` : ""}.`
                    : `Sorteo: ${formatArgentina(new Date(s.drawsAt))}${s.entrantsCount ? ` · ${s.entrantsCount} participantes` : ""}`}
                </p>
                {s.logos.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {s.logos.slice(0, 5).map((l) => (
                      // eslint-disable-next-line @next/next/no-img-element -- logos subidos a R2
                      <img key={l.logoUrl} src={l.logoUrl} alt={l.name ?? ""} className="h-6 w-auto max-w-[5rem] rounded bg-white/90 object-contain px-1.5 py-0.5" />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {fotos.length > 0 ? (
                  <div className="flex -space-x-4">
                    {fotos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element -- fotos subidas a R2
                      <img
                        key={i}
                        src={p.imageUrl!}
                        alt={p.title}
                        title={p.title}
                        className="h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/80 sm:h-20 sm:w-20"
                        style={{ transform: `rotate(${(i - 1) * 4}deg)` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="hidden min-w-0 max-w-[14rem] text-right text-sm text-white/85 sm:block">
                    <Gift className="mb-1 ml-auto h-6 w-6 text-amber-200" />
                    {s.prizes.map((p) => p.title).join(" · ")}
                  </div>
                )}
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition group-hover:bg-white/25">
                  <ChevronRight className="h-5 w-5" />
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
