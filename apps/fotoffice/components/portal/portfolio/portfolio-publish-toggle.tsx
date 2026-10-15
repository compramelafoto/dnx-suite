"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setPortfolioPublishedAction } from "@/app/actions/portfolio";

/**
 * Prender y apagar la publicación.
 *
 * Si falta el consentimiento, la acción devuelve el error y acá se ofrece el enlace al perfil, que
 * es donde se da. Fallar sin decir adónde ir sería dejar a la persona trabada en una pantalla.
 */
export function PortfolioPublishToggle({
  published,
  canPublish,
}: {
  published: boolean;
  /** Si hoy hay algo que publicar. Con cero fotos, prender el interruptor no haría nada. */
  canPublish: boolean;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function cambiar(nuevo: boolean) {
    setGuardando(true);
    setError(null);
    const r = await setPortfolioPublishedAction({ published: nuevo });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "No pudimos guardar el cambio.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="fo-card space-y-3">
      <h2 className="font-medium">Publicación</h2>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={published}
          disabled={guardando || (!published && !canPublish)}
          onChange={(e) => void cambiar(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Mostrar mi portfolio en el sitio de la institución.
          <span className="block text-[var(--fo-muted)]">
            Lo podés apagar cuando quieras. Tus fotos quedan guardadas igual.
          </span>
        </span>
      </label>

      {!published && !canPublish ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Subí al menos una foto para poder publicarlo.
        </p>
      ) : null}

      {error ? (
        <div className="fo-alert-error space-y-2 text-sm">
          <p>{error}</p>
          {/* El único error que tiene una salida concreta es el del consentimiento. */}
          {error.includes("Mi perfil") ? (
            <p>
              <Link href="/portal/perfil" className="fo-btn fo-btn-secondary text-sm">
                Ir a mi perfil
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
