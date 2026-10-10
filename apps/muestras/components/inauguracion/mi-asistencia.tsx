"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarMiAsistencia } from "@/lib/inauguracion/publicas";

export function MiAsistencia({ token }: { token: string }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pendiente}
        className="h-11 rounded-[2px] border border-[var(--mf-ink)] px-5 disabled:opacity-50"
        onClick={() => {
          if (!window.confirm("¿Seguro que no vas a poder ir? Tu lugar pasa a otra persona.")) return;
          start(async () => {
            const r = await cancelarMiAsistencia(token);
            if (r.ok) router.refresh();
            else setError(r.error);
          });
        }}
      >
        No voy a poder ir
      </button>
      {error ? <p role="alert" className="text-[var(--mf-alerta)]">{error}</p> : null}
    </div>
  );
}
