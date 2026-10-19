"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, QrCode } from "lucide-react";
import { activarQrMostradorAction } from "./qr-actions";

/**
 * El QR fijo del mostrador: se activa una vez (crea la sucursal y la caja en Mercado Pago) y
 * después se descarga para imprimir. Cada cobro del Mostrador le carga el monto.
 */
export function QrMostrador({
  activo,
  qrImage,
  qrPdf,
  puedeActivar,
  conectado,
  inicial,
}: {
  activo: boolean;
  qrImage: string | null;
  qrPdf: string | null;
  puedeActivar: boolean;
  conectado: boolean;
  inicial: { nombre: string; ciudad: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, start] = useTransition();

  if (activo) {
    return (
      <div className="flex flex-wrap items-start gap-4">
        {qrImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen del QR servida por Mercado Pago
          <img src={qrImage} alt="QR del mostrador" className="size-40 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-white p-2" />
        ) : null}
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-[var(--fo-success)]">El QR del mostrador está activo.</p>
          <p className="text-[var(--fo-muted)]">
            Imprimilo y dejalo en el mostrador. Al cobrar con Mercado Pago, el Mostrador le carga el monto y la venta se registra sola cuando el cliente paga.
          </p>
          {qrPdf || qrImage ? (
            <a href={qrPdf ?? qrImage ?? "#"} target="_blank" rel="noreferrer" className="fo-btn fo-btn-secondary inline-flex items-center gap-1.5 text-sm">
              <Download className="size-4" aria-hidden /> Descargar para imprimir
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (!conectado) return <p className="text-sm text-[var(--fo-muted)]">Primero conectá tu cuenta de Mercado Pago (arriba).</p>;
  if (!puedeActivar) return <p className="text-sm text-[var(--fo-muted)]">Solo el dueño o un administrador puede activarlo.</p>;

  return (
    <form
      className="space-y-3"
      action={(fd) => {
        setError(null);
        start(async () => {
          const r = await activarQrMostradorAction(fd);
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      <p className="text-sm text-[var(--fo-muted)]">
        Mercado Pago pide la dirección del local y sus coordenadas (las sacás de Google Maps: clic derecho sobre el local → los dos números del
        principio).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Nombre del local</span>
          <input name="nombre" required defaultValue={inicial.nombre} className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Referencia (opcional)</span>
          <input name="referencia" placeholder="Paseo Victoria" className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Calle</span>
          <input name="calle" required className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Número</span>
          <input name="numero" required className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Ciudad</span>
          <input name="ciudad" required defaultValue={inicial.ciudad} className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Provincia</span>
          <input name="provincia" required className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Latitud</span>
          <input name="latitud" required inputMode="decimal" placeholder="-32.9201" className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Longitud</span>
          <input name="longitud" required inputMode="decimal" placeholder="-60.8116" className="fo-input" />
        </label>
      </div>
      {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary inline-flex items-center gap-1.5 text-sm">
        <QrCode className="size-4" aria-hidden />
        {enviando ? "Creando la caja en Mercado Pago…" : "Activar QR del mostrador"}
      </button>
    </form>
  );
}
