"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Instagram } from "lucide-react";
import { setPortfolioInstagramAction } from "@/app/actions/portfolio";
import { MAX_INSTAGRAM_POSTS } from "@/lib/portfolio/instagram";

/**
 * Los posteos de Instagram que el socio quiere mostrar debajo de su obra.
 *
 * Se pegan uno por renglón porque es lo que la gente hace naturalmente al copiar varios enlaces, y
 * porque seis campos separados serían seis cosas que acomodar.
 *
 * El texto explica por qué hay que elegirlos a mano. Sin esa frase, "pegá tus posteos" se lee como
 * una limitación nuestra en vez de lo que es: Instagram cerró la puerta.
 */
export function PortfolioInstagramForm({
  enabled,
  postUrls,
}: {
  enabled: boolean;
  postUrls: string[];
}) {
  const [prendido, setPrendido] = useState(enabled);
  const [texto, setTexto] = useState(postUrls.join("\n"));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const router = useRouter();

  const cargados = texto.split("\n").filter((l) => l.trim()).length;

  async function guardar() {
    setGuardando(true);
    setError(null);
    setListo(false);

    const r = await setPortfolioInstagramAction({
      enabled: prendido,
      postUrls: texto.split("\n"),
    });

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
      <div className="flex items-center gap-2">
        <Instagram size={18} aria-hidden className="text-[var(--fo-muted)]" />
        <h2 className="font-medium">Tus posteos de Instagram</h2>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={prendido}
          onChange={(e) => setPrendido(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Mostrar una franja con mis posteos debajo de mi obra.
          <span className="block text-[var(--fo-muted)]">
            Si lo apagás, la franja desaparece del sitio pero tus enlaces quedan guardados.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <label className="block text-sm">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span>Enlaces de tus posteos, uno por renglón</span>
            <span className="text-xs tabular-nums text-[var(--fo-muted)]">
              {cargados} de {MAX_INSTAGRAM_POSTS}
            </span>
          </span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={"https://www.instagram.com/p/XXXXXXXXXXX/\nhttps://www.instagram.com/p/YYYYYYYYYYY/"}
            className="mt-1 w-full rounded border border-[var(--fo-border)] bg-transparent px-3 py-2 font-mono text-xs"
          />
        </label>

        <p className="text-xs text-[var(--fo-muted)]">
          En Instagram, abrí el posteo, tocá los tres puntos y elegí <strong>Copiar enlace</strong>.
          Hay que elegirlos a mano porque Instagram ya no permite que otros sitios lean tus últimas
          fotos solas.
        </p>
      </div>

      {error ? <p className="fo-alert-error text-sm">{error}</p> : null}
      {listo && !error ? <p className="fo-alert-success text-sm">Guardado.</p> : null}

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={guardando}
        className="fo-btn fo-btn-primary text-sm"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </section>
  );
}
