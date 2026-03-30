"use client";

import { useState, useTransition } from "react";
import { directorySendInvitationAction } from "../../../../actions/judgeProfessionalDirectory";
import { INVITE_MODAL_FOOTNOTE } from "../../../../lib/fotorank/judges/legalCopy";

type Contest = {
  id: string;
  title: string;
  categories: { id: string; name: string }[];
};

export function OrganizerJudgeDetailInvite({
  judgeAccountId,
  contests,
}: {
  judgeAccountId: string;
  contests: Contest[];
}) {
  const [open, setOpen] = useState(false);
  const [contestId, setContestId] = useState(contests[0]?.id ?? "");
  const [catIds, setCatIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [comp, setComp] = useState("");
  const [disclaimer, setDisclaimer] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selectedContest = contests.find((c) => c.id === contestId);

  const toggleCat = (id: string) => {
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const send = () => {
    setErr(null);
    setOk(null);
    start(async () => {
      const r = await directorySendInvitationAction({
        judgeAccountId,
        contestId,
        categoryIds: catIds,
        message,
        proposedRoleLabel: role || undefined,
        compensationOfferedText: comp || undefined,
        organizerAcceptedExternalPaymentDisclaimer: disclaimer,
        methodType: "SCORE_1_5",
        methodConfigJson: {},
        assignmentType: "PRIMARY",
      });
      if (!r.ok) setErr(r.error);
      else {
        setOk("Invitación enviada.");
        setOpen(false);
      }
    });
  };

  return (
    <div className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
      <h2 className="font-sans text-lg font-semibold text-fr-primary">Invitar a jurar</h2>
      <p className="mt-2 text-sm text-fr-muted">
        Se crearán asignaciones en las categorías elegidas cuando el jurado acepte. Método por defecto: puntuación 1–5.
      </p>
      {contests.length === 0 ? (
        <p className="mt-6 text-sm text-amber-200">No hay concursos abiertos en tu organización para invitar.</p>
      ) : (
        <button type="button" className="fr-btn fr-btn-primary mt-6" onClick={() => setOpen(true)}>
          Abrir invitación
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-fr-border bg-fr-card p-8 shadow-xl">
            <h3 className="font-sans text-lg font-semibold text-fr-primary">Nueva invitación</h3>
            <p className="mt-3 text-xs leading-relaxed text-fr-muted">{INVITE_MODAL_FOOTNOTE}</p>

            <div className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-fr-primary">Concurso</label>
                <select
                  className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                  value={contestId}
                  onChange={(e) => {
                    setContestId(e.target.value);
                    setCatIds([]);
                  }}
                >
                  {contests.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedContest && selectedContest.categories.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-fr-primary">Categorías</label>
                  <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-fr-border bg-fr-bg p-3">
                    {selectedContest.categories.map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-fr-primary">
                          <input
                            type="checkbox"
                            checked={catIds.includes(c.id)}
                            onChange={() => toggleCat(c.id)}
                            className="accent-gold"
                          />
                          {c.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-amber-200">El concurso no tiene categorías activas.</p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-fr-primary">Mensaje</label>
                <textarea
                  className="min-h-[100px] w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Contexto del concurso y expectativas."
                />
              </div>
              <input
                className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                placeholder="Rol propuesto (opcional)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
              <textarea
                className="min-h-[72px] w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                placeholder="Honorarios u oferta (opcional, texto libre)"
                value={comp}
                onChange={(e) => setComp(e.target.value)}
              />
              <label className="flex items-start gap-3 text-sm text-fr-muted">
                <input
                  type="checkbox"
                  className="mt-1 accent-gold"
                  checked={disclaimer}
                  onChange={(e) => setDisclaimer(e.target.checked)}
                />
                <span>Confirmo que los pagos se acuerdan fuera de Fotorank y que leí la aclaración anterior.</span>
              </label>
            </div>

            {err ? <p className="mt-4 text-sm text-red-200">{err}</p> : null}
            {ok ? <p className="mt-4 text-sm text-emerald-200">{ok}</p> : null}

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <button type="button" className="fr-btn fr-btn-secondary" onClick={() => setOpen(false)}>
                Cerrar
              </button>
              <button type="button" disabled={pending} className="fr-btn fr-btn-primary" onClick={send}>
                Enviar invitación
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
