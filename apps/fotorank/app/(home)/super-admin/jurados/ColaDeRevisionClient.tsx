"use client";

import { useState, useTransition } from "react";

import {
  aprobarJuradoAction,
  rechazarJuradoAction,
  suspenderCuentaDeJuradoAction,
} from "../../../actions/judgeDirectoryReview";

export type FichaPendiente = {
  judgeProfileId: string;
  judgeAccountId: string;
  nombre: string;
  email: string;
  titular: string | null;
  bio: string | null;
  especialidades: string[];
  aniosDeExperiencia: number | null;
  lugar: string;
  avatarSrc: string | null;
  website: string | null;
  instagram: string | null;
  portfolioUrl: string | null;
  quiereEstarEnElDirectorio: boolean;
  origen: string;
  sePostuloEl: string;
};

export function ColaDeRevisionClient({ fichas }: { fichas: FichaPendiente[] }) {
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const correr = (accion: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    empezar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error ?? "No pudimos completar la acción.");
      else {
        setRechazando(null);
        setMotivo("");
      }
    });
  };

  if (fichas.length === 0) {
    return (
      <div className="fr-recuadro border border-fr-border bg-fr-card">
        <p className="text-sm text-fr-muted">No hay fichas esperando revisión.</p>
        <p className="mt-2 text-xs text-fr-muted">
          Acá aparecen los fotógrafos que se postularon por su cuenta y ya confirmaron su correo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {fichas.map((f) => (
        <article key={f.judgeProfileId} className="fr-recuadro border border-fr-border bg-fr-card">
          <div className="flex flex-col gap-4 sm:flex-row">
            {f.avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.avatarSrc}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full border border-fr-border object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-fr-border text-sm text-fr-muted">
                sin foto
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <h2 className="text-lg font-semibold text-fr-primary">{f.nombre}</h2>
                {f.titular ? <p className="text-sm text-fr-muted">{f.titular}</p> : null}
                <p className="text-xs text-fr-muted">{f.email}</p>
              </div>

              {f.bio ? <p className="text-sm text-fr-muted">{f.bio}</p> : null}

              <dl className="grid gap-x-6 gap-y-1 text-xs text-fr-muted sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium">Dónde: </dt>
                  <dd className="inline">{f.lugar || "sin indicar"}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Experiencia: </dt>
                  <dd className="inline">
                    {f.aniosDeExperiencia === null ? "sin indicar" : `${f.aniosDeExperiencia} años`}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline font-medium">Especialidades: </dt>
                  <dd className="inline">
                    {f.especialidades.length ? f.especialidades.join(", ") : "sin indicar"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline font-medium">Se postuló: </dt>
                  <dd className="inline">{f.sePostuloEl}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline font-medium">Pidió estar en el directorio: </dt>
                  <dd className="inline">{f.quiereEstarEnElDirectorio ? "sí" : "no"}</dd>
                </div>
              </dl>

              {f.website || f.instagram || f.portfolioUrl ? (
                <p className="flex flex-wrap gap-3 text-xs">
                  {f.website ? (
                    <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2">
                      sitio web
                    </a>
                  ) : null}
                  {f.instagram ? (
                    <a href={`https://instagram.com/${f.instagram}`} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2">
                      @{f.instagram}
                    </a>
                  ) : null}
                  {f.portfolioUrl ? (
                    <a href={f.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2">
                      portfolio
                    </a>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          {rechazando === f.judgeProfileId ? (
            <div className="mt-4 space-y-2 border-t border-fr-border pt-4">
              <label htmlFor={`motivo-${f.judgeProfileId}`} className="block text-sm text-fr-muted">
                Por qué se rechaza. <span className="text-fr-muted">Esto lo va a leer {f.nombre}</span>, así
                que tiene que alcanzarle para corregir.
              </label>
              <textarea
                id={`motivo-${f.judgeProfileId}`}
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full rounded border border-fr-border bg-fr-bg px-3 py-2 text-sm text-fr-primary"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pendiente || !motivo.trim()}
                  onClick={() => correr(() => rechazarJuradoAction(f.judgeProfileId, motivo))}
                  className="fr-btn fr-btn-primary text-sm disabled:opacity-50"
                >
                  Confirmar el rechazo
                </button>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => {
                    setRechazando(null);
                    setMotivo("");
                  }}
                  className="fr-btn fr-btn-secondary text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-fr-border pt-4">
              <button
                type="button"
                disabled={pendiente}
                onClick={() => correr(() => aprobarJuradoAction(f.judgeProfileId))}
                className="fr-btn fr-btn-primary text-sm"
              >
                Aprobar
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => setRechazando(f.judgeProfileId)}
                className="fr-btn fr-btn-secondary text-sm"
              >
                Rechazar
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => correr(() => suspenderCuentaDeJuradoAction(f.judgeAccountId))}
                className="text-sm text-red-300 underline underline-offset-2"
              >
                Suspender la cuenta
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
