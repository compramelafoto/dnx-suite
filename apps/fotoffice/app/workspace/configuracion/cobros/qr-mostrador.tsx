"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, MapPin, QrCode, Search } from "lucide-react";
import type { Lugar } from "@/lib/geocode/lugar";
import { activarQrMostradorAction } from "./qr-actions";

const MapaDelLugar = dynamic(() => import("@/components/coberturas/mapa-del-lugar"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)]" />,
});

/** "San José 1672" → calle y número. */
function separarDireccion(address: string | null): { calle: string; numero: string } {
  const t = (address ?? "").trim();
  const m = /^(.*\D)\s+(\d+[A-Za-z]?)$/.exec(t);
  return m ? { calle: m[1]!.trim(), numero: m[2]! } : { calle: t, numero: "" };
}

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

  return <FormularioActivar inicial={inicial} onListo={() => router.refresh()} />;
}

/**
 * La dirección del local se busca (OpenStreetMap, por el mismo buscador de Coberturas) y el pin
 * del mapa se puede mover: las coordenadas salen de ahí, nadie tiene que tipearlas.
 */
function FormularioActivar({ inicial, onListo }: { inicial: { nombre: string; ciudad: string }; onListo: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, start] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState<Lugar[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [campos, setCampos] = useState({ calle: "", numero: "", ciudad: inicial.ciudad, provincia: "" });
  const [referencia, setReferencia] = useState("");
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buscar(q: string) {
    setBusqueda(q);
    if (espera.current) clearTimeout(espera.current);
    if (q.trim().length < 3) {
      setSugerencias([]);
      return;
    }
    espera.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
        const datos = res.ok ? ((await res.json()) as Lugar[]) : [];
        setSugerencias(Array.isArray(datos) ? datos : []);
      } catch {
        setSugerencias([]);
      } finally {
        setBuscando(false);
      }
    }, 500);
  }

  function elegir(l: Lugar) {
    const { calle, numero } = separarDireccion(l.address);
    setCampos({ calle: calle || l.locationName || "", numero, ciudad: l.city ?? "", provincia: l.province ?? "" });
    if (l.locationName && l.locationName !== calle) setReferencia(l.locationName);
    setPunto({ lat: l.latitude, lng: l.longitude });
    setSugerencias([]);
    setBusqueda(l.displayName);
  }

  const campo = (k: keyof typeof campos) => ({
    name: k,
    required: true,
    value: campos[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, [k]: e.target.value })),
    className: "fo-input",
  });

  return (
    <form
      className="space-y-3"
      action={(fd) => {
        setError(null);
        if (!punto) {
          setError("Buscá la dirección del local y elegila de la lista (o tocá el mapa donde está).");
          return;
        }
        start(async () => {
          const r = await activarQrMostradorAction(fd);
          if (r.ok) onListo();
          else setError(r.error);
        });
      }}
    >
      <div className="relative space-y-1">
        <label className="text-sm text-[var(--fo-muted)]" htmlFor="buscar-local">
          Buscá la dirección del local
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fo-muted)]" aria-hidden />
          <input
            id="buscar-local"
            value={busqueda}
            onChange={(e) => buscar(e.target.value)}
            placeholder="San José 1672, Funes"
            autoComplete="off"
            className="fo-input !pl-9"
          />
        </div>
        {buscando ? <p className="text-xs text-[var(--fo-muted)]">Buscando…</p> : null}
        {sugerencias.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] shadow-[var(--fo-shadow-sm)]">
            {sugerencias.map((l, i) => (
              <li key={`${l.placeId ?? i}`}>
                <button
                  type="button"
                  onClick={() => elegir(l)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--fo-surface-muted)]"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--fo-muted)]" aria-hidden />
                  <span className="line-clamp-2">{l.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {punto ? (
        <div className="space-y-1">
          <MapaDelLugar latitude={punto.lat} longitude={punto.lng} editable onMover={(lat, lng) => setPunto({ lat, lng })} />
          <p className="inline-flex items-center gap-1 text-xs text-[var(--fo-success)]">
            <CheckCircle2 className="size-3.5" aria-hidden /> Ubicación marcada. Si el pin no cae justo en el local, arrastralo.
          </p>
        </div>
      ) : null}
      <input type="hidden" name="latitud" value={punto ? String(punto.lat) : ""} />
      <input type="hidden" name="longitud" value={punto ? String(punto.lng) : ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Nombre del local</span>
          <input name="nombre" required defaultValue={inicial.nombre} className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Referencia (opcional)</span>
          <input name="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Paseo Victoria" className="fo-input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Calle</span>
          <input {...campo("calle")} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Número</span>
          <input {...campo("numero")} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Ciudad</span>
          <input {...campo("ciudad")} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[var(--fo-muted)]">Provincia</span>
          <input {...campo("provincia")} />
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
