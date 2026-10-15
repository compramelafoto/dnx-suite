"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CANJE_QUERY_PARAM,
  clearCanjeToken,
  readCanjeToken,
  saveCanjeToken,
} from "@/lib/canje-externo/canje-token-storage";

type Estado =
  | { kind: "none" }
  | {
      kind: "ok";
      token: string;
      printUnits: number;
      size: string;
      includesDigital: boolean;
      studentName: string | null;
    }
  | { kind: "redeemed" }
  | { kind: "error"; message: string };

/**
 * Cartel de la galería para la familia que llega con su link de canje: le dice que su
 * combo ya está pago y cómo elegir las fotos para que salgan sin costo.
 */
export default function CanjeComboBanner({ albumId }: { albumId: number }) {
  const searchParams = useSearchParams();
  const [estado, setEstado] = useState<Estado>({ kind: "none" });

  useEffect(() => {
    const fromUrl = searchParams.get(CANJE_QUERY_PARAM)?.trim();
    if (fromUrl) saveCanjeToken(albumId, fromUrl);
    const token = fromUrl || readCanjeToken(albumId);
    if (!token) return;

    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/a/${albumId}/canje/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (!res.ok || !data.ok) {
          // Un token guardado que ya no sirve no tiene que seguir mostrando errores.
          if (!fromUrl) {
            clearCanjeToken(albumId);
            return;
          }
          setEstado({ kind: "error", message: data.error || "Este link de canje no es válido." });
          return;
        }
        if (data.redeemed) {
          setEstado({ kind: "redeemed" });
          return;
        }
        setEstado({
          kind: "ok",
          token,
          printUnits: Number(data.printUnits) || 0,
          size: String(data.size || ""),
          includesDigital: data.includesDigital === true,
          studentName: typeof data.studentName === "string" ? data.studentName : null,
        });
      } catch {
        /* sin cartel: el descuento igual se aplica en el resumen */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [albumId, searchParams]);

  if (estado.kind === "none") return null;

  if (estado.kind === "error") {
    return (
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <p className="m-0 font-medium">{estado.message}</p>
      </div>
    );
  }

  if (estado.kind === "redeemed") {
    return (
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
        <p className="m-0 font-medium">Tu combo ya fue canjeado.</p>
        <p className="m-0 mt-1">Si querés más fotos, podés comprarlas en esta misma galería.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="m-0 font-semibold">
          {estado.studentName ? `El combo de ${estado.studentName} ya está pago` : "Tu combo ya está pago"}
        </p>
        <p className="m-0 mt-0.5">Te guiamos para elegir las fotos del combo y, si querés, sumar más.</p>
      </div>
      <a
        href={`/canje/${encodeURIComponent(estado.token)}`}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[#2f7d5b] px-4 font-semibold text-white"
      >
        Elegir las fotos de mi combo
      </a>
    </div>
  );
}
