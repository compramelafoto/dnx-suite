"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { setPortfolioVideosAction } from "@/app/actions/portfolio";
import {
  ETIQUETA_PLATAFORMA,
  MAX_PORTFOLIO_VIDEOS,
  parsePortfolioVideoUrl,
} from "@/lib/portfolio/videos";

/**
 * Los videos del portfolio: se pegan direcciones, una por renglón.
 *
 * Debajo del cuadro se muestra **qué reconoció de cada una** mientras escribe. Sin eso, el socio
 * pega seis direcciones, guarda, y recién en la ficha pública descubre que una quedó como simple
 * enlace en vez de reproductor.
 */
export function PortfolioVideosForm({ urls }: { urls: string[] }) {
  const [texto, setTexto] = useState(urls.join("\n"));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const router = useRouter();

  const reconocidos = useMemo(
    () =>
      texto
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((linea) => ({ linea, video: parsePortfolioVideoUrl(linea) })),
    [texto],
  );

  async function guardar() {
    setGuardando(true);
    setError(null);
    setListo(false);

    const r = await setPortfolioVideosAction({ urls: texto.split("\n") });

    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setListo(true);
    router.refresh();
  }

  return (
    <section className="fo-card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clapperboard size={18} aria-hidden className="text-[var(--fo-muted)]" />
          <h2 className="font-medium">Tus videos</h2>
        </div>
        <p className="text-sm tabular-nums text-[var(--fo-muted)]">
          {reconocidos.length} de {MAX_PORTFOLIO_VIDEOS}
        </p>
      </div>

      <label className="block text-sm">
        <span>Direcciones de tus videos, una por renglón</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={"https://www.youtube.com/watch?v=…\nhttps://vimeo.com/…\nhttps://www.instagram.com/reel/…"}
          className="mt-1 w-full rounded border border-[var(--fo-border)] bg-transparent px-3 py-2 font-mono text-xs"
        />
      </label>

      <p className="text-xs text-[var(--fo-muted)]">
        <strong>YouTube</strong> y <strong>Vimeo</strong> se ven con el reproductor adentro de tu
        página. <strong>Instagram</strong> y <strong>TikTok</strong>, con el formato de cada red.
        Cualquier otra dirección queda como un enlace que abre aparte.
      </p>

      {reconocidos.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {reconocidos.map(({ linea, video }, i) => (
            <li
              key={`${linea}-${i}`}
              className="flex items-start justify-between gap-3 rounded border border-[var(--fo-border-muted)] px-3 py-2"
            >
              <span className="min-w-0 truncate font-mono text-xs">{linea}</span>
              <span className="shrink-0 text-xs">
                {video ? (
                  <span
                    className={
                      video.platform === "OTRO"
                        ? "text-[var(--fo-muted)]"
                        : "text-[var(--fo-accent)]"
                    }
                  >
                    {ETIQUETA_PLATAFORMA[video.platform]}
                    {video.platform === "OTRO" ? " (sin reproductor)" : ""}
                  </span>
                ) : (
                  <span className="text-[var(--fo-danger)]">No la entiendo</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="fo-alert-error text-sm">{error}</p> : null}
      {listo && !error ? <p className="fo-alert-success text-sm">Guardado.</p> : null}

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={guardando}
        className="fo-btn fo-btn-primary text-sm"
      >
        {guardando ? "Guardando…" : "Guardar videos"}
      </button>
    </section>
  );
}
