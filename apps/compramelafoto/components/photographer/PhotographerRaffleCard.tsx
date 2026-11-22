"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatArgentina } from "@/lib/raffles/fechas";

type Sorteo = {
  id: string;
  title: string;
  status: string;
  salesTo: string;
  drawsAt: string;
  minSales: number;
  entrantsCount: number | null;
  prizes: { title: string; sponsorName: string | null }[];
  misVentas: number | null;
  participa: boolean | null;
  gane: string[];
};

/**
 * La tarjeta del sorteo en el inicio del panel: qué se sortea, si ya participa (o cuántas
 * ventas le faltan) y, si ya se sorteó, si ganó. Sin sorteos no muestra nada.
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
    <div className="mb-6 space-y-3">
      {sorteos.map((s) => {
        const abierto = s.status === "ANUNCIADO";
        const sorteado = s.status === "SORTEADO" || s.status === "CERRADO";
        const faltan = abierto && s.misVentas !== null ? Math.max(0, s.minSales - s.misVentas) : 0;
        const premios = s.prizes.map((p) => p.title).join(" · ");
        return (
          <div key={s.id} className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">🎁 {s.title}</p>
                {s.gane.length > 0 ? (
                  <p className="mt-1 text-lg font-bold text-gray-900">¡Ganaste {s.gane.join(" y ")}! Te escribimos por correo.</p>
                ) : sorteado ? (
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    Ya se sorteó{s.participa ? ": esta vez no saliste, ¡seguí vendiendo para el próximo!" : "."}
                  </p>
                ) : s.participa ? (
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    Ya participás{s.misVentas ? ` con ${s.misVentas} ${s.misVentas === 1 ? "venta" : "ventas"}` : ""}. ¡Suerte!
                  </p>
                ) : abierto && faltan === 0 ? (
                  <p className="mt-1 text-base font-semibold text-gray-900">Tu cuenta no participa de este sorteo.</p>
                ) : abierto ? (
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {faltan === 1 && s.minSales === 1
                      ? "Vendé al menos una foto antes de que termine el período y entrás al sorteo."
                      : `Te ${faltan === 1 ? "falta 1 venta" : `faltan ${faltan} ventas`} para entrar al sorteo.`}
                  </p>
                ) : (
                  <p className="mt-1 text-base font-semibold text-gray-900">Esta vez no entraste: no hubo ventas en el período.</p>
                )}
                {premios && <p className="mt-1 text-sm text-gray-700">Premios: {premios}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  {abierto
                    ? `Cuentan las ventas hasta el ${formatArgentina(new Date(new Date(s.salesTo).getTime() - 1), false)}. Sorteo: ${formatArgentina(new Date(s.drawsAt))}.`
                    : sorteado
                      ? `Sorteado el ${formatArgentina(new Date(s.drawsAt), false)}${s.entrantsCount ? ` entre ${s.entrantsCount} fotógrafos` : ""}.`
                      : `Sorteo: ${formatArgentina(new Date(s.drawsAt))}${s.entrantsCount ? ` · ${s.entrantsCount} participantes` : ""}.`}
                </p>
              </div>
              <Link
                href={`/sorteos/${s.id}`}
                className="shrink-0 rounded-full border border-amber-300 bg-white px-4 py-2 text-center text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                {sorteado ? "Ver resultado" : "Ver el sorteo"}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
