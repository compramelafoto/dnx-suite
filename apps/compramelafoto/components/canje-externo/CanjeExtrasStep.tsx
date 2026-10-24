"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CheckoutTermsAcceptance from "@/components/checkout/CheckoutTermsAcceptance";
import CheckoutMpPreparingOverlay from "@/components/checkout/CheckoutMpPreparingOverlay";
import { albumPhotoFileKey } from "@/lib/album-photo-ref";
import { savePendingOrderSession } from "@/lib/checkout/pending-order-session";
import { redirectToMercadoPago } from "@/lib/checkout/mp-redirect";
import { orientacionDeLaFoto, TEXTO_DIGITAL, textoFormatoCopia } from "@/lib/canje-externo/formato-de-la-foto";
import { useMedidasDeFotos } from "./useMedidasDeFotos";

/** Un producto que se puede sumar como extra: la foto impresa del álbum o el librito. */
export type CanjeExtraProduct = { productId: number; name: string; size: string; finish: string | null };

export type CanjeExtrasConfig = {
  /** Se venden fotos digitales sueltas. */
  digital: boolean;
  /** Producto con el que se piden las fotos impresas sueltas. */
  impresa: CanjeExtraProduct | null;
  /** El librito del pack, para pedir otro igual (para un abuelo, por ejemplo). */
  librito: CanjeExtraProduct | null;
  includeDigitalWithPrint: boolean;
};

type Formato = "impresa" | "digital";

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const pesos = (n: number) => ARS.format(n);

/**
 * "¿Sumás más fotos?": aparece sola después de confirmar el canje. La familia ya eligió las
 * fotos de su pack y tiene a la vista todas las de su hijo: es el momento en que más ganas
 * tiene de llevarse otras, y antes sólo había un link chico a la galería, donde tenía que
 * empezar de cero.
 *
 * El canje ya quedó confirmado antes de esta pantalla: si la familia no compra nada, o se va
 * en el pago, su pack igual está pedido. Los extras son un pedido aparte, que se paga con
 * Mercado Pago a los precios de extra del álbum.
 */
export default function CanjeExtrasStep({
  albumId,
  photos,
  usadasEnPack,
  libritoPhotoId,
  config,
  comprador,
  alumnoCorto,
  modoPrueba,
  thumbUrl,
  onTerminar,
}: {
  albumId: number;
  photos: Array<{ id: number; sellPrint: boolean; sellDigital: boolean }>;
  usadasEnPack: number[];
  /** Una foto del librito del pack: el librito extra se pide sobre ella. */
  libritoPhotoId: number | null;
  config: CanjeExtrasConfig;
  comprador: { nombre: string; email: string; telefono: string };
  alumnoCorto: string | null;
  modoPrueba: boolean;
  thumbUrl: (id: number) => string;
  onTerminar: () => void;
}) {
  const usadas = useMemo(() => new Set(usadasEnPack), [usadasEnPack]);
  // Primero las que no entraron en el pack: son las que la familia todavía no tiene.
  const ofrecidas = useMemo(
    () => [...photos.filter((p) => !usadas.has(p.id)), ...photos.filter((p) => usadas.has(p.id))],
    [photos, usadas]
  );
  const [eleccion, setEleccion] = useState<Map<number, Formato>>(new Map());
  const [libritos, setLibritos] = useState(0);
  const [precios, setPrecios] = useState<{ impresa: number | null; digital: number | null; librito: number | null }>({
    impresa: null,
    digital: null,
    librito: null,
  });
  const [total, setTotal] = useState<number | null>(null);
  const [terminos, setTerminos] = useState(false);
  const [errorTerminos, setErrorTerminos] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mpPreparando, setMpPreparando] = useState(false);
  const [avisoPrueba, setAvisoPrueba] = useState(false);
  const idempotencyRef = useRef<string | null>(null);
  const { medidas, registrar } = useMedidasDeFotos();

  const formatoPorDefecto: Formato = config.impresa ? "impresa" : "digital";
  const puedeLibrito = Boolean(config.librito && libritoPhotoId != null);

  const items = useMemo(() => {
    const out: Array<Record<string, unknown>> = [];
    for (const [photoId, formato] of eleccion) {
      const fileKey = albumPhotoFileKey(photoId);
      if (formato === "digital" || !config.impresa) {
        out.push({ fileKey, tipo: "digital", size: "DIGITAL", quantity: 1 });
        continue;
      }
      if (config.includeDigitalWithPrint) {
        out.push({ fileKey, tipo: "digital", size: "DIGITAL", quantity: 1, includedWithPrint: true });
      }
      const finish = (config.impresa.finish ?? "BRILLO").toUpperCase();
      out.push({
        fileKey,
        tipo: "impresa",
        size: config.impresa.size,
        acabado: finish,
        finish,
        quantity: 1,
        productId: config.impresa.productId,
        productName: config.impresa.name,
      });
    }
    if (libritos > 0 && config.librito && libritoPhotoId != null) {
      out.push({
        fileKey: albumPhotoFileKey(libritoPhotoId),
        tipo: "impresa",
        size: config.librito.size,
        quantity: libritos,
        productId: config.librito.productId,
        productName: config.librito.name,
      });
    }
    return out;
  }, [eleccion, libritos, config, libritoPhotoId]);

  const cotizar = async (lista: unknown[]): Promise<number | null> => {
    const res = await fetch(`/api/a/${albumId}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: lista }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? Number(data?.totals?.displayTotalCents ?? 0) || null : null;
  };

  // Precio unitario de cada cosa, con el mismo motor que cobra.
  useEffect(() => {
    const muestra = photos[0];
    if (!muestra) return;
    let cancelado = false;
    const key = albumPhotoFileKey(muestra.id);
    (async () => {
      const [impresa, digital, librito] = await Promise.all([
        config.impresa
          ? cotizar([
              {
                fileKey: key,
                tipo: "impresa",
                size: config.impresa.size,
                quantity: 1,
                productId: config.impresa.productId,
                productName: config.impresa.name,
              },
            ]).catch(() => null)
          : null,
        config.digital ? cotizar([{ fileKey: key, tipo: "digital", size: "DIGITAL", quantity: 1 }]).catch(() => null) : null,
        config.librito && libritoPhotoId != null
          ? cotizar([
              {
                fileKey: albumPhotoFileKey(libritoPhotoId),
                tipo: "impresa",
                size: config.librito.size,
                quantity: 1,
                productId: config.librito.productId,
                productName: config.librito.name,
              },
            ]).catch(() => null)
          : null,
      ]);
      if (!cancelado) setPrecios({ impresa, digital, librito });
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId, photos, config, libritoPhotoId]);

  // Total real del pedido (el servidor aplica recargos y redondeos).
  useEffect(() => {
    if (items.length === 0) {
      setTotal(null);
      return;
    }
    let cancelado = false;
    const t = setTimeout(() => {
      cotizar(items)
        .then((v) => {
          if (!cancelado) setTotal(v);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function alternar(id: number) {
    setEleccion((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, formatoPorDefecto);
      return next;
    });
  }

  function cambiarFormato(id: number, formato: Formato) {
    setEleccion((prev) => new Map(prev).set(id, formato));
  }

  async function pagar() {
    if (enviando || items.length === 0) return;
    setError(null);
    if (!terminos) {
      setErrorTerminos("Para pagar necesitás aceptar los términos.");
      return;
    }
    setErrorTerminos(null);
    if (modoPrueba) {
      setAvisoPrueba(true);
      return;
    }
    if (!comprador.email.trim()) {
      setError("No tenemos tu email para el comprobante. Escribile al fotógrafo.");
      return;
    }
    setEnviando(true);
    if (!idempotencyRef.current) {
      idempotencyRef.current = `canje-extras:${albumId}:${crypto.randomUUID?.() ?? Date.now()}`;
    }
    const startedAt = Date.now();
    try {
      const res = await fetch(`/api/a/${albumId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": idempotencyRef.current },
        body: JSON.stringify({
          buyerName: comprador.nombre.trim(),
          buyerEmail: comprador.email.trim(),
          buyerPhone: comprador.telefono.trim() || undefined,
          items,
          termsAccepted: true,
          idempotencyKey: idempotencyRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos armar el pedido de las fotos extra.");
      if (data?.initPoint) {
        if (typeof data?.id === "number") {
          savePendingOrderSession(String(albumId), { orderId: data.id, buyerEmail: comprador.email.trim() });
        }
        setMpPreparando(true);
        await redirectToMercadoPago(data.initPoint, { startedAt });
        return;
      }
      throw new Error(data?.error || "No se generó el link de pago.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos armar el pedido de las fotos extra.");
      setEnviando(false);
    }
  }

  const cantidadFotos = eleccion.size;
  const resumen = [
    cantidadFotos > 0 ? `${cantidadFotos} ${cantidadFotos === 1 ? "foto" : "fotos"}` : null,
    libritos > 0 ? `${libritos} ${libritos === 1 ? "librito" : "libritos"}` : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <section className="pb-40">
      <CheckoutMpPreparingOverlay open={mpPreparando} step={2} />
      <h1 className="m-0 mt-6 text-2xl font-semibold text-[#1f2328]">
        {alumnoCorto ? `¿Sumás más fotos de ${alumnoCorto}?` : "¿Sumás más fotos?"}
      </h1>
      <p className="m-0 mt-2 text-[15px] text-[#4b4f56]">
        Tu pack ya quedó pedido. Si querés, tocá las fotos que te quieras llevar además.
      </p>
      <p className="m-0 mt-1 text-sm text-[#6b7078]">
        {[
          config.digital && precios.digital != null ? `Digital ${pesos(precios.digital)}` : null,
          config.impresa && precios.impresa != null ? `Impresa ${config.impresa.size} ${pesos(precios.impresa)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {puedeLibrito ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#e7e1da] bg-white p-4">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-medium text-[#1f2328]">Otro librito igual</p>
            <p className="m-0 text-sm text-[#6b7078]">
              Con las mismas fotos que elegiste{precios.librito != null ? ` · ${pesos(precios.librito)} c/u` : ""}. Ideal
              para regalar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Uno menos"
              onClick={() => setLibritos((n) => Math.max(0, n - 1))}
              className="h-9 w-9 rounded-full border border-[#d6cfc6] text-lg text-[#1f2328] disabled:opacity-40"
              disabled={libritos === 0}
            >
              −
            </button>
            <span className="w-6 text-center font-semibold tabular-nums">{libritos}</span>
            <button
              type="button"
              aria-label="Uno más"
              onClick={() => setLibritos((n) => Math.min(10, n + 1))}
              className="h-9 w-9 rounded-full border border-[#d6cfc6] text-lg text-[#1f2328]"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {ofrecidas.map((p) => {
          const formato = eleccion.get(p.id);
          const enPack = usadas.has(p.id);
          return (
            <div key={p.id} className="relative">
              <button
                type="button"
                onClick={() => alternar(p.id)}
                aria-pressed={formato != null}
                className={`relative block aspect-square w-full overflow-hidden rounded-[8px] bg-[#efe9e2] ${
                  formato ? "ring-[3px] ring-inset ring-[#2f7d5b]" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrl(p.id)}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                  ref={(el) => registrar(p.id, el)}
                  onLoad={(e) => registrar(p.id, e.currentTarget)}
                />
                {enPack ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#4b4f56]">
                    En tu pack
                  </span>
                ) : null}
                {formato ? (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#2f7d5b] text-sm text-white">
                    ✓
                  </span>
                ) : null}
              </button>
              {formato && config.digital && config.impresa ? (
                <div className="mt-1 flex overflow-hidden rounded-full border border-[#d6cfc6] text-[12px]">
                  {(["impresa", "digital"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => cambiarFormato(p.id, f)}
                      className={`flex-1 py-1 ${formato === f ? "bg-[#1f2328] text-white" : "bg-white text-[#4b4f56]"}`}
                    >
                      {f === "impresa" ? "Impresa" : "Digital"}
                    </button>
                  ))}
                </div>
              ) : null}
              {formato ? (
                <p className="m-0 mt-1 text-center text-[10px] font-medium leading-tight text-[#2f7d5b]">
                  {formato === "digital" || !config.impresa
                    ? TEXTO_DIGITAL
                    : textoFormatoCopia(
                        config.impresa.size,
                        orientacionDeLaFoto(medidas.get(p.id)?.ancho, medidas.get(p.id)?.alto)
                      ) + (config.includeDigitalWithPrint ? " + su digital" : "")}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7e1da] bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          {items.length > 0 ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#4b4f56]">{resumen}</span>
                <span className="text-lg font-semibold text-[#1f2328]">{total != null ? pesos(total) : "…"}</span>
              </div>
              <div className="mt-2">
                <CheckoutTermsAcceptance
                  checked={terminos}
                  onChange={(next) => {
                    setTerminos(next);
                    if (next) setErrorTerminos(null);
                  }}
                  disabled={enviando}
                  error={errorTerminos}
                />
              </div>
            </>
          ) : null}
          {error ? <p className="m-0 mt-2 text-sm text-red-700">{error}</p> : null}
          {avisoPrueba ? (
            <p data-demo-ocultar="" className="m-0 mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
              Modo prueba: acá la familia pasa a Mercado Pago y paga {total != null ? pesos(total) : "el total"}. En la
              prueba no se cobra nada.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onTerminar}
              className="flex-1 rounded-xl border border-[#d6cfc6] bg-white px-4 py-3 font-medium text-[#1f2328]"
            >
              {items.length > 0 ? "Terminar sin extras" : "No, gracias, terminar"}
            </button>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={() => void pagar()}
                disabled={enviando}
                className="flex-1 rounded-xl bg-[#a8652e] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {enviando ? "Preparando el pago…" : "Pagar extras"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
