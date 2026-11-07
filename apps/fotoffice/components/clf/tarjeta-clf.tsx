"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { quitarVinculoClfAction, vincularAlbumClfAction } from "@/app/actions/clf-vinculo";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

export type VinculoClfDeTarjeta = {
  titulo: string;
  enlace: string;
  /** Ya armada en el servidor (hora de Buenos Aires): «Preventa: cierra el …», «Preventa cerrada» o null. */
  estadoPreventa: string | null;
  heredadoDelPedido: boolean;
  albumId?: number;
};

/**
 * Tarjeta «CompraMeLaFoto» de las fichas de pedido y proyecto (conexión FOTOFFICE ↔ CLF, etapa 1): el álbum
 * de CLF vinculado, con su enlace para abrir o copiar. Con «Gestionar», pegar el enlace para vincular o quitarlo.
 * Un proyecto con pedido muestra el álbum del pedido sin poder cambiarlo.
 */
export function TarjetaClf({
  destino,
  vinculo,
  puedeEditar,
  sujeto,
  ventas = null,
}: {
  destino: { pedidoId: string } | { proyectoId: string };
  vinculo: VinculoClfDeTarjeta | null;
  puedeEditar: boolean;
  /** «Este pedido» / «Este proyecto», para el texto vacío. */
  sujeto: string;
  /** Lo vendido por este álbum en Ventas CLF (sólo para quien puede ver ese dinero). */
  ventas?: { cantidad: number; acreditado: number; albumId: number } | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const editable = puedeEditar && !vinculo?.heredadoDelPedido;

  function vincular(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setError(null);
    iniciar(async () => {
      const r = await vincularAlbumClfAction(destino, texto).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) {
        setTexto("");
        router.refresh();
      } else setError(r.error);
    });
  }

  function quitar() {
    if (!window.confirm("¿Quitar el vínculo con este álbum de CompraMeLaFoto? El álbum en CLF no cambia.")) return;
    setError(null);
    iniciar(async () => {
      const r = await quitarVinculoClfAction(destino).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function copiar(enlace: string) {
    void navigator.clipboard
      ?.writeText(enlace)
      .then(() => {
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => setError("No se pudo copiar. Copialo desde «Abrir en CLF»."));
  }

  return (
    <section id="compramelafoto" aria-labelledby="clf-titulo" className="fo-card space-y-3">
      <h2 id="clf-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        CompraMeLaFoto
      </h2>

      {vinculo ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-[var(--fo-text)]">{vinculo.titulo}</p>
          {vinculo.estadoPreventa ? <p className="text-[var(--fo-muted)]">{vinculo.estadoPreventa}</p> : null}
          {vinculo.heredadoDelPedido ? <p className="text-xs text-[var(--fo-muted)]">Tomado del pedido.</p> : null}
          <p className="break-all text-xs text-[var(--fo-muted)]">{vinculo.enlace}</p>
          {ventas ? (
            <p>
              Vendido por este álbum: {ventas.cantidad} {ventas.cantidad === 1 ? "venta" : "ventas"} ·{" "}
              {ventas.acreditado.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })} acreditado.{" "}
              <a className="underline" href={`/ventas-clf?album=${ventas.albumId}`}>
                Ver ventas
              </a>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <a className="fo-btn fo-btn-secondary text-sm" href={vinculo.enlace} target="_blank" rel="noopener noreferrer">
              Abrir en CLF
            </a>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => copiar(vinculo.enlace)}>
              {copiado ? "¡Copiado!" : "Copiar enlace"}
            </button>
            {editable ? (
              <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={pendiente} onClick={quitar}>
                {pendiente ? "Quitando…" : "Quitar vínculo"}
              </button>
            ) : null}
          </div>
        </div>
      ) : editable ? (
        <form className="space-y-2" onSubmit={vincular}>
          <label className="block space-y-1 text-sm">
            <span className="block text-xs text-[var(--fo-muted)]">Enlace del álbum o de la preventa</span>
            <input
              className="fo-input w-full"
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder="https://www.compramelafoto.com/album/…"
              value={texto}
              maxLength={2000}
              disabled={pendiente}
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || !texto.trim()}>
            {pendiente ? "Vinculando…" : "Vincular"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">{sujeto} no está vinculado con un álbum de CompraMeLaFoto.</p>
      )}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
