"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeBlogBannerAction, saveBlogBannerAction } from "@/app/actions/blog-banner";
import { BLOG_BANNER_DURATIONS, BLOG_BANNER_MAX_POSITION } from "@/lib/website/blog-banner";
import type { BlogBannerPanelData } from "@/lib/blog/banner-slot";

/**
 * "Banner principal": destacar este artículo como una placa del banner de la portada del sitio,
 * en el número de placa que se elija y por un tiempo. El sitio lo muestra en vivo, sin
 * republicar, y al vencer el plazo deja de mostrarlo solo.
 */
export function BlogBannerPanel({ postId, published, data }: { postId: number; published: boolean; data: BlogBannerPanelData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(!data.slot?.active);
  const [position, setPosition] = useState(data.slot?.position ?? 1);
  const [duration, setDuration] = useState<number>(data.slot?.durationDays ?? 15);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const slot = data.slot;

  return (
    <section className="fo-card space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Banner principal del sitio</h2>
        <p className="fo-helper">Mostrá este artículo como una placa del banner de la portada, con su imagen de portada, el título y la bajada.</p>
      </div>

      {slot?.active && !editing ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--fo-text)]">
            Se muestra en la <strong>placa {slot.position}</strong> hasta el <strong>{slot.endsLabel}</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setEditing(true)} disabled={pending}>
              Cambiar placa o duración
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-secondary text-[var(--fo-danger)]"
              onClick={() => run(() => removeBlogBannerAction(postId))}
              disabled={pending}
            >
              Quitar del banner
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {slot && !slot.active ? <p className="fo-helper">Estuvo en el banner hasta el {slot.endsLabel}.</p> : null}
          {!published ? <p className="fo-helper">Primero publicá el artículo: un borrador no se puede mostrar en el sitio.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="fo-label">En qué placa</span>
              <select className="fo-input" value={position} onChange={(e) => setPosition(Number(e.target.value))} disabled={!published}>
                {Array.from({ length: BLOG_BANNER_MAX_POSITION }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Placa {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="fo-label">Durante</span>
              <select className="fo-input" value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={!published}>
                {BLOG_BANNER_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="fo-helper">
            {data.ownSlideCount === null
              ? "Tu sitio todavía no tiene un banner publicado: el artículo va a aparecer cuando lo tenga."
              : `Tu banner tiene ${data.ownSlideCount} ${data.ownSlideCount === 1 ? "placa propia" : "placas propias"}. Si elegís un número mayor, el artículo va al final.`}{" "}
            Los días se cuentan desde que guardás.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="fo-btn fo-btn-primary"
              onClick={() => run(() => saveBlogBannerAction(postId, position, duration))}
              disabled={pending || !published}
            >
              {pending ? "Guardando…" : slot?.active ? "Guardar cambios" : "Mostrar en el banner"}
            </button>
            {slot?.active ? (
              <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setEditing(false)} disabled={pending}>
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}

      {data.others.length > 0 ? (
        <div className="border-t border-[var(--fo-border)] pt-3">
          <p className="fo-label mb-1">Otros artículos en el banner</p>
          <ul className="space-y-1 text-sm text-[var(--fo-muted)]">
            {data.others.map((o) => (
              <li key={`${o.position}-${o.title}`}>
                Placa {o.position}: {o.title} <span className="text-xs">(hasta el {o.endsLabel})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
