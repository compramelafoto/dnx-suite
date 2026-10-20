"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { desvincularObra } from "@/lib/perfiles/acciones";

export type ObraVinculada = { id: string; title: string; imageUrl: string; muestra: string; muestraSlug: string; publicada: boolean };

export function ObrasVinculadas({ obras }: { obras: ObraVinculada[] }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  return (
    <section aria-labelledby="t-vinculadas" className="space-y-4">
      <h2 id="t-vinculadas" className="text-sm text-[var(--mf-muted)]">Obras vinculadas a tu perfil</h2>
      {obras.length === 0 ? (
        <p className="text-[15px] text-[var(--mf-muted)]">Todavía no hay obras vinculadas. Cuando cargues una muestra con obras tuyas, o un organizador te vincule, aparecen acá.</p>
      ) : (
        <ul className="divide-y divide-[var(--mf-line)] border-y border-[var(--mf-line)]">
          {obras.map((o) => (
            <li key={o.id} className="flex items-center gap-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imageUrl} alt="" className="size-16 bg-[var(--mf-surface)] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{o.title}</p>
                <p className="text-sm text-[var(--mf-muted)]">
                  {o.publicada ? <Link href={`/m/${o.muestraSlug}`} className="underline underline-offset-4">{o.muestra}</Link> : `${o.muestra} (todavía no publicada)`}
                </p>
              </div>
              <button
                type="button"
                disabled={pendiente}
                className="text-sm underline underline-offset-4 disabled:opacity-50"
                onClick={() => {
                  if (!window.confirm(`¿Quitar "${o.title}" de tu perfil?`)) return;
                  start(async () => { await desvincularObra(o.id); router.refresh(); });
                }}
              >
                No es mía
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
