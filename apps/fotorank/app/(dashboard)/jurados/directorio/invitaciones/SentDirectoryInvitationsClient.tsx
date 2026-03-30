"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { directoryCancelInvitationAction } from "../../../../actions/judgeProfessionalDirectory";

type Row = { id: string; status: string; createdAt: string; contestTitle: string; judgeLabel: string };

export function SentDirectoryInvitationsClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cancel = (id: string) => {
    setErr(null);
    start(async () => {
      const r = await directoryCancelInvitationAction(id);
      if (!r.ok) setErr(r.error);
      else router.refresh();
    });
  };

  if (initial.length === 0) {
    return (
      <div className="fr-recuadro rounded-xl border border-fr-border bg-fr-card text-sm text-fr-muted">
        Todavía no enviaste invitaciones desde el directorio.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {err ? <p className="text-sm text-red-200">{err}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-fr-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-fr-border bg-[#0a0a0a] text-fr-muted">
              <th className="fr-recuadro py-3 font-semibold">Jurado</th>
              <th className="fr-recuadro py-3 font-semibold">Concurso</th>
              <th className="fr-recuadro py-3 font-semibold">Estado</th>
              <th className="fr-recuadro py-3 font-semibold">Fecha</th>
              <th className="fr-recuadro py-3 font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((r) => (
              <tr key={r.id} className="border-b border-fr-border/80">
                <td className="fr-recuadro py-3 text-fr-primary">{r.judgeLabel}</td>
                <td className="fr-recuadro py-3 text-fr-muted">{r.contestTitle}</td>
                <td className="fr-recuadro py-3 text-fr-muted">{r.status}</td>
                <td className="fr-recuadro py-3 text-fr-muted">{new Date(r.createdAt).toLocaleString("es-AR")}</td>
                <td className="fr-recuadro py-3">
                  {r.status === "PENDING" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-sm text-amber-200 underline"
                      onClick={() => cancel(r.id)}
                    >
                      Cancelar
                    </button>
                  ) : (
                    <span className="text-fr-muted-soft">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
