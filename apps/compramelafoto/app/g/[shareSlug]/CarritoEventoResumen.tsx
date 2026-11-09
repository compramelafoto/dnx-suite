"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import CheckoutTermsAcceptance from "@/components/checkout/CheckoutTermsAcceptance";

type PorFotografo = { albumId: number; fotografo: string; fotos: number; totalPesos: number };
type PorAlbum = { albumId: number; fotografo: string; fotos: number; url: string };

type Respuesta =
  | { modo: "grupo"; totalPesos: number; porFotografo: PorFotografo[] }
  | { modo: "por_album"; albumes: PorAlbum[] }
  | { modo: "pagar"; url: string }
  | { error: string };

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

async function pedir(shareSlug: string, body: Record<string, unknown>): Promise<Respuesta> {
  try {
    const res = await fetch(`/api/public/events/${encodeURIComponent(shareSlug)}/carrito`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Respuesta;
    if (!res.ok) return { error: "error" in data && data.error ? data.error : "No pudimos armar tu compra." };
    return data;
  } catch {
    return { error: "Error de conexión. Probá de nuevo." };
  }
}

/**
 * Carrito de evento (Split 1:N): las fotos elegidas de varios fotógrafos, el total y los datos
 * del comprador una sola vez. Si se puede, lleva a un único pago; si no, ofrece pagar cada
 * álbum por separado como siempre. Sólo se muestra con el carrito encendido para el evento.
 */
export default function CarritoEventoResumen(props: { shareSlug: string; photoIds: number[] }) {
  const [cotizacion, setCotizacion] = useState<Respuesta | null>(null);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [terminos, setTerminos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const clave = props.photoIds.join(",");

  useEffect(() => {
    let activo = true;
    setCotizacion(null);
    pedir(props.shareSlug, { accion: "cotizar", fotos: props.photoIds }).then((r) => {
      if (activo) setCotizacion(r);
    });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.shareSlug, clave]);

  async function comprar() {
    if (!terminos) {
      setError("Para continuar necesitás aceptar los términos.");
      return;
    }
    setEnviando(true);
    setError(null);
    const r = await pedir(props.shareSlug, {
      accion: "comprar",
      fotos: props.photoIds,
      buyerEmail: email,
      buyerName: nombre,
      buyerPhone: telefono,
      termsAccepted: true,
    });
    if ("error" in r) {
      setError(r.error);
      setEnviando(false);
      return;
    }
    if (r.modo === "pagar") {
      window.location.href = r.url;
      return;
    }
    setCotizacion(r);
    setEnviando(false);
  }

  if (cotizacion == null) return <p className="text-sm text-[#6b7280]">Calculando el total…</p>;
  if ("error" in cotizacion) return <p className="text-sm text-red-700">{cotizacion.error}</p>;

  if (cotizacion.modo === "por_album") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#374151]">
          Estas fotos no se pueden pagar juntas. Podés comprarlas álbum por álbum:
        </p>
        <ul className="space-y-2">
          {cotizacion.albumes.map((a) => (
            <li key={a.albumId} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2">
              <span className="text-sm">
                {a.fotografo} · {fotos(a.fotos)}
              </span>
              <a href={a.url} className="text-sm font-medium text-[#c27b3d] underline">
                Comprar en el álbum
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (cotizacion.modo !== "grupo") return null;

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-xl border">
        {cotizacion.porFotografo.map((f) => (
          <li key={f.albumId} className="flex justify-between px-4 py-2 text-sm">
            <span>
              {f.fotografo} · {fotos(f.fotos)}
            </span>
            <span>{pesos.format(f.totalPesos)}</span>
          </li>
        ))}
        <li className="flex justify-between px-4 py-2 font-semibold">
          <span>Total, en un solo pago</span>
          <span>{pesos.format(cotizacion.totalPesos)}</span>
        </li>
      </ul>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="email"
          placeholder="Tu correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm"
          autoComplete="email"
        />
        <input
          type="text"
          placeholder="Tu nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm"
          autoComplete="name"
        />
        <input
          type="tel"
          placeholder="WhatsApp"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm"
          autoComplete="tel"
        />
      </div>
      <CheckoutTermsAcceptance
        checked={terminos}
        onChange={(next) => {
          setTerminos(next);
          if (next) setError(null);
        }}
        disabled={enviando}
      />
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="primary" onClick={comprar} disabled={enviando} className="px-5 py-2.5">
        {enviando ? "Preparando el pago…" : "Pagar con tarjeta"}
      </Button>
    </div>
  );
}
