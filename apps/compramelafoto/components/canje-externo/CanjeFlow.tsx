"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import CheckoutTermsAcceptance from "@/components/checkout/CheckoutTermsAcceptance";
import CheckoutMpPreparingOverlay from "@/components/checkout/CheckoutMpPreparingOverlay";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";
import { savePendingOrderSession } from "@/lib/checkout/pending-order-session";
import { redirectToMercadoPago } from "@/lib/checkout/mp-redirect";
import {
  buildCanjeOrderItems,
  type CanjeExtraFormat,
} from "@/lib/canje-externo/build-canje-order-items";
import type { ComboPrintProduct } from "@/lib/canje-externo/combo-print-product";
import ComboFrames from "./ComboFrames";
import CanjeSteps, { type CanjeStepKey } from "./CanjeSteps";
import PhotoPickGrid from "./PhotoPickGrid";

type Paso = "intro" | "combo" | "pregunta" | "extras" | "datos";

type Props = {
  token: string;
  album: {
    id: number;
    title: string;
    slug: string | null;
    photographerName: string | null;
    includeDigitalWithPrint: boolean;
    sellsDigital: boolean;
    scanProtection: boolean;
    selfieSearch: boolean;
  };
  combo: {
    printUnits: number;
    size: string;
    includesDigital: boolean;
    parentName: string | null;
    studentName: string | null;
  };
  product: ComboPrintProduct;
  photos: Array<{ id: number; sellPrint: boolean; sellDigital: boolean }>;
};

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const pesos = (n: number) => ARS.format(n);

function contar(n: number, uno: string, varios: string): string | null {
  return n === 0 ? null : `${n} ${n === 1 ? uno : varios}`;
}

function primerNombre(nombre: string | null): string | null {
  return nombre ? nombre.trim().split(/\s+/)[0] : null;
}

/**
 * Canje de un combo pagado por fuera, en pasos: primero las fotos del combo (sin pagar),
 * después la pregunta de si quiere sumar más, y recién ahí la compra de extras. Separar
 * los dos momentos es el punto: la familia nunca tiene que adivinar qué se paga.
 */
export default function CanjeFlow({ token, album, combo, product, photos }: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("intro");
  const [comboIds, setComboIds] = useState<number[]>([]);
  const [extras, setExtras] = useState<Array<{ photoId: number; format: CanjeExtraFormat }>>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [zoomId, setZoomId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<number[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [precios, setPrecios] = useState<{ impresa: number | null; digital: number | null }>({
    impresa: null,
    digital: null,
  });
  const [total, setTotal] = useState<number | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [terminos, setTerminos] = useState(false);
  const [errorTerminos, setErrorTerminos] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mpPreparando, setMpPreparando] = useState(false);
  const idempotencyRef = useRef<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const alumno = combo.studentName;
  const alumnoCorto = primerNombre(alumno);
  const tamano = combo.size.replace(/\s*cm$/i, "");
  const n = combo.printUnits;
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const thumbUrl = useCallback(
    (id: number) => `/api/photos/${id}/view?albumId=${album.id}&mode=thumb`,
    [album.id]
  );
  const visibles = useMemo(
    () => (filtro ? photos.filter((p) => filtro.includes(p.id)) : photos).map((p) => p.id),
    [photos, filtro]
  );
  const comboCompleto = comboIds.length >= n;
  const stepKey: CanjeStepKey =
    paso === "intro" || paso === "combo" ? "combo" : paso === "datos" ? "confirmar" : "extras";

  const irA = (p: Paso) => {
    setAviso(null);
    setError(null);
    setPaso(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Precio de una foto extra, calculado por el servidor con el mismo motor que cobra.
  useEffect(() => {
    const muestra = photos.find((p) => p.sellPrint) ?? photos[0];
    if (!muestra) return;
    let cancelado = false;
    const cotizar = async (items: unknown[]) => {
      const res = await fetch(`/api/a/${album.id}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? Number(data?.totals?.displayTotalCents ?? 0) || null : null;
    };
    (async () => {
      const impresa = await cotizar(
        buildCanjeOrderItems(
          { comboPhotoIds: [], extras: [{ photoId: muestra.id, format: "impresa" }] },
          product,
          album.includeDigitalWithPrint
        )
      ).catch(() => null);
      const digital = album.sellsDigital
        ? await cotizar(
            buildCanjeOrderItems(
              { comboPhotoIds: [], extras: [{ photoId: muestra.id, format: "digital" }] },
              product,
              album.includeDigitalWithPrint
            )
          ).catch(() => null)
        : null;
      if (!cancelado) setPrecios({ impresa, digital });
    })();
    return () => {
      cancelado = true;
    };
  }, [album.id, album.includeDigitalWithPrint, album.sellsDigital, photos, product]);

  const items = useMemo(
    () => buildCanjeOrderItems({ comboPhotoIds: comboIds, extras }, product, album.includeDigitalWithPrint),
    [comboIds, extras, product, album.includeDigitalWithPrint]
  );

  // Total final con el combo aplicado, del servidor.
  useEffect(() => {
    if (paso !== "datos") return;
    let cancelado = false;
    setCotizando(true);
    setTotal(null);
    (async () => {
      try {
        const res = await fetch(`/api/a/${album.id}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, canjeToken: token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (!res.ok) throw new Error(data?.error || "No pudimos calcular el total.");
        if (data?.canje && data.canje.ok === false) throw new Error(data.canje.error);
        setTotal(Number(data?.totals?.displayTotalCents ?? 0));
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : "No pudimos calcular el total.");
      } finally {
        if (!cancelado) setCotizando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [paso, items, album.id, token]);

  // Actualizaciones funcionales: dos toques seguidos no pueden pisarse entre sí.
  function toggleCombo(id: number) {
    setAviso(null);
    if (!comboIds.includes(id) && !byId.get(id)?.sellPrint) {
      setAviso("Esta foto no se vende impresa, así que no puede ir en el combo. Elegí otra.");
      return;
    }
    setComboIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= n) {
        setAviso(`Ya elegiste las ${n} fotos del combo. Para cambiar una, sacala tocándola.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function toggleExtra(id: number) {
    setAviso(null);
    const p = byId.get(id);
    const format: CanjeExtraFormat = p?.sellPrint ? "impresa" : "digital";
    const vendible = format === "impresa" || (album.sellsDigital && Boolean(p?.sellDigital));
    setExtras((prev) => {
      if (prev.some((e) => e.photoId === id)) return prev.filter((e) => e.photoId !== id);
      if (!vendible) {
        setAviso("Esta foto no está a la venta.");
        return prev;
      }
      return [...prev, { photoId: id, format }];
    });
  }

  async function buscarConSelfie(file: File) {
    setBuscando(true);
    setAviso(null);
    try {
      try {
        sessionStorage.setItem("faceConsentSession", "1");
      } catch {
        /* sin almacenamiento, la búsqueda sigue */
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/albums/${album.id}/search/face`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos buscar con esa foto.");
      const ids: number[] = (Array.isArray(data?.items) ? data.items : [])
        .map((it: { id: unknown }) => Number(it.id))
        .filter((id: number) => byId.has(id));
      if (ids.length === 0) {
        setAviso("No encontramos fotos con esa cara. Probá con otra foto con buena luz, o mirá la galería completa.");
        setFiltro(null);
      } else {
        setFiltro(ids);
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No pudimos buscar con esa foto.");
    } finally {
      setBuscando(false);
      if (selfieInputRef.current) selfieInputRef.current.value = "";
    }
  }

  async function confirmar() {
    if (enviando) return;
    setError(null);
    if (!nombre.trim()) return setError("Escribí tu nombre.");
    const errEmail = getCheckoutEmailValidationError(email);
    if (errEmail) return setError(errEmail);
    const { isValidPhoneForPurchase } = await import("@/lib/phone-validation");
    if (!telefono.trim() || !isValidPhoneForPurchase(telefono)) {
      return setError("Escribí tu WhatsApp con código de área (por ejemplo 341 555-1234).");
    }
    if (!terminos) {
      setErrorTerminos("Para confirmar necesitás aceptar los términos.");
      return;
    }
    setErrorTerminos(null);
    setEnviando(true);
    if (!idempotencyRef.current) {
      idempotencyRef.current = `canje:${album.id}:${crypto.randomUUID?.() ?? Date.now()}`;
    }
    const startedAt = Date.now();
    try {
      const res = await fetch(`/api/a/${album.id}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": idempotencyRef.current },
        body: JSON.stringify({
          buyerName: nombre.trim(),
          buyerEmail: email.trim(),
          buyerPhone: telefono.trim(),
          items,
          termsAccepted: true,
          canjeToken: token,
          idempotencyKey: idempotencyRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos confirmar el pedido.");
      if (data?.paid === true && typeof data?.id === "number") {
        router.push(`/a/${album.id}/canje/listo?pedido=${data.id}`);
        return;
      }
      if (data?.initPoint) {
        if (typeof data?.id === "number") {
          savePendingOrderSession(String(album.id), { orderId: data.id, buyerEmail: email.trim() });
        }
        setMpPreparando(true);
        await redirectToMercadoPago(data.initPoint, { startedAt });
        return;
      }
      throw new Error(data?.error || "No se generó el link de pago.");
    } catch (e) {
      idempotencyRef.current = null;
      setMpPreparando(false);
      setError(e instanceof Error ? e.message : "No pudimos confirmar el pedido.");
      setEnviando(false);
    }
  }

  const viewerPhotos = useMemo(
    () =>
      visibles.map((id) => ({
        id: String(id),
        src: `/api/photos/${id}/view?mode=preview&albumId=${album.id}`,
        alt: "Foto del álbum",
        selected: paso === "extras" ? extras.some((e) => e.photoId === id) : comboIds.includes(id),
      })),
    [visibles, album.id, paso, extras, comboIds]
  );

  const totalExtrasEstimado = extras.reduce((acc, e) => {
    const unit = e.format === "impresa" ? precios.impresa : precios.digital;
    return acc + (unit ?? 0);
  }, 0);

  const selfieBox =
    album.selfieSearch && (paso === "combo" || paso === "extras") ? (
      <div className="mb-4 rounded-xl border border-[#e7e1da] bg-white p-4">
        {filtro ? (
          <p className="m-0 text-sm text-[#1f2328]">
            Mostrando {filtro.length} {filtro.length === 1 ? "foto" : "fotos"}
            {alumnoCorto ? ` donde aparece ${alumnoCorto}` : " de la búsqueda"}.{" "}
            <button type="button" className="font-medium text-[#a8652e] underline" onClick={() => setFiltro(null)}>
              Ver todas las fotos
            </button>
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm text-[#4b4f56]">
              ¿Son muchas fotos? Cargá una foto de la cara de {alumnoCorto ?? "tu hija o hijo"} y te mostramos sólo
              las suyas. La usamos sólo para buscar.
            </p>
            <button
              type="button"
              disabled={buscando}
              onClick={() => selfieInputRef.current?.click()}
              className="min-h-11 shrink-0 rounded-lg border border-[#c27b3d] px-4 text-sm font-semibold text-[#a8652e] disabled:opacity-60"
            >
              {buscando ? "Buscando…" : "Buscar con una foto"}
            </button>
          </div>
        )}
        <input
          ref={selfieInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void buscarConSelfie(f);
          }}
        />
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-[#f7f5f2] pb-36">
      <header className="border-b border-[#e7e1da] bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4">
          <p className="m-0 text-sm text-[#6b6f76]">
            {album.title}
            {album.photographerName ? ` — ${album.photographerName}` : ""}
          </p>
          <CanjeSteps current={stepKey} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {paso === "intro" ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            <h1 className="m-0 text-2xl font-semibold text-[#1f2328] sm:text-3xl">
              {combo.parentName ? `Hola, ${primerNombre(combo.parentName)}` : "Hola"}
            </h1>
            <p className="m-0 mt-2 text-lg text-[#2f7d5b]">
              {alumno ? `El combo de ${alumno} ya está pago` : "Tu combo ya está pago"}
            </p>
            <div className="my-7">
              <ComboFrames slots={n} photoIds={[]} thumbUrl={thumbUrl} size="lg" />
              <p className="m-0 mt-3 text-sm text-[#6b6f76]">
                {n} fotos impresas {tamano}
                {combo.includesDigital ? " con su versión digital" : ""}
              </p>
            </div>
            <ol className="m-0 space-y-3 p-0 text-left text-[15px] leading-relaxed text-[#3d4148]">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2f7d5b] text-xs font-semibold text-white">
                  1
                </span>
                <span>
                  <strong>Ahora elegí las {n} fotos de tu combo.</strong> Ya están pagas: no vas a pagar nada por
                  ellas.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ece7e1] text-xs font-semibold text-[#6b6f76]">
                  2
                </span>
                <span>
                  Después te vamos a preguntar si querés sumar más fotos. Es opcional, y esas se pagan aparte.
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => irA("combo")}
              className="mt-8 min-h-12 w-full rounded-xl bg-[#c27b3d] px-6 text-base font-semibold text-white hover:bg-[#a8652e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d] sm:w-auto"
            >
              Elegir mis {n} fotos
            </button>
          </section>
        ) : null}

        {paso === "combo" ? (
          <section>
            <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-[#e7e1da] bg-[#f7f5f2]/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="m-0 text-lg font-semibold text-[#1f2328]">Elegí las {n} fotos de tu combo</h1>
                  <p className="m-0 text-sm text-[#2f7d5b]">
                    {comboCompleto
                      ? "¡Listo! Ya están las " + n
                      : `${comboIds.length} de ${n} elegidas · te ${n - comboIds.length === 1 ? "falta" : "faltan"} ${n - comboIds.length}`}
                  </p>
                </div>
                <ComboFrames slots={n} photoIds={comboIds} thumbUrl={thumbUrl} onRemove={toggleCombo} size="sm" />
              </div>
            </div>
            {selfieBox}
            <PhotoPickGrid
              photoIds={visibles}
              selected={comboIds}
              onToggle={toggleCombo}
              onZoom={setZoomId}
              thumbUrl={thumbUrl}
              full={comboCompleto}
              badge={(id) => (byId.get(id)?.sellPrint ? null : "Sólo digital")}
              accent="combo"
            />
          </section>
        ) : null}

        {paso === "pregunta" ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            <ComboFrames slots={n} photoIds={comboIds} thumbUrl={thumbUrl} size="lg" />
            <h1 className="m-0 mt-6 text-2xl font-semibold text-[#1f2328]">Las fotos de tu combo están elegidas</h1>
            <p className="m-0 mt-2 text-[#4b4f56]">¿Querés sumar más fotos? Las que sumes se pagan aparte.</p>
            {precios.impresa != null ? (
              <ul className="mx-auto mt-4 max-w-sm list-none space-y-1 p-0 text-sm text-[#4b4f56]">
                <li className="flex justify-between gap-4">
                  <span>Impresa {tamano}{album.includeDigitalWithPrint ? " con su digital" : ""}</span>
                  <span className="font-semibold text-[#1f2328]">{pesos(precios.impresa)} c/u</span>
                </li>
                {precios.digital != null ? (
                  <li className="flex justify-between gap-4">
                    <span>Sólo digital</span>
                    <span className="font-semibold text-[#1f2328]">{pesos(precios.digital)} c/u</span>
                  </li>
                ) : null}
              </ul>
            ) : null}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => irA("extras")}
                className="min-h-12 rounded-xl border-2 border-[#c27b3d] px-6 text-base font-semibold text-[#a8652e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]"
              >
                Sí, quiero sumar fotos
              </button>
              <button
                type="button"
                onClick={() => {
                  setExtras([]);
                  irA("datos");
                }}
                className="min-h-12 rounded-xl bg-[#c27b3d] px-6 text-base font-semibold text-white hover:bg-[#a8652e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]"
              >
                No, sólo mi combo
              </button>
            </div>
            <button
              type="button"
              onClick={() => irA("combo")}
              className="mt-5 text-sm font-medium text-[#6b6f76] underline"
            >
              Cambiar las fotos del combo
            </button>
          </section>
        ) : null}

        {paso === "extras" ? (
          <section>
            <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-[#e7e1da] bg-[#f7f5f2]/95 px-4 py-3 backdrop-blur">
              <h1 className="m-0 text-lg font-semibold text-[#1f2328]">Sumá las fotos extra que quieras</h1>
              <p className="m-0 text-sm text-[#4b4f56]">
                Las fotos de tu combo ya están reservadas. Lo que elijas acá se paga aparte.
              </p>
            </div>
            {selfieBox}
            <PhotoPickGrid
              photoIds={visibles}
              selected={extras.map((e) => e.photoId)}
              onToggle={toggleExtra}
              onZoom={setZoomId}
              thumbUrl={thumbUrl}
              badge={(id) => (comboIds.includes(id) ? "En tu combo" : null)}
              accent="extra"
            />
            {extras.length > 0 ? (
              <div className="mt-6 rounded-xl border border-[#e7e1da] bg-white p-4">
                <h2 className="m-0 text-base font-semibold text-[#1f2328]">Tus fotos extra</h2>
                <ul className="m-0 mt-3 list-none space-y-3 p-0">
                  {extras.map((e) => {
                    const p = byId.get(e.photoId);
                    const puedeImpresa = Boolean(p?.sellPrint);
                    const puedeDigital = album.sellsDigital && Boolean(p?.sellDigital);
                    return (
                      <li key={e.photoId} className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbUrl(e.photoId)} alt="" className="h-14 w-11 shrink-0 rounded object-cover" />
                        <div className="flex flex-1 flex-wrap gap-2" role="group" aria-label="Formato de la foto">
                          {(["impresa", "digital"] as const).map((f) => {
                            const habilitado = f === "impresa" ? puedeImpresa : puedeDigital;
                            if (!habilitado) return null;
                            const activo = e.format === f;
                            return (
                              <button
                                key={f}
                                type="button"
                                aria-pressed={activo}
                                onClick={() =>
                                  setExtras(extras.map((x) => (x.photoId === e.photoId ? { ...x, format: f } : x)))
                                }
                                className={`min-h-9 rounded-full px-3 text-sm ${
                                  activo
                                    ? "bg-[#1f2328] text-white"
                                    : "bg-[#f1ede8] text-[#3d4148] hover:bg-[#e7e1da]"
                                }`}
                              >
                                {f === "impresa"
                                  ? `Impresa${album.includeDigitalWithPrint ? " + digital" : ""}`
                                  : "Sólo digital"}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExtra(e.photoId)}
                          className="text-sm text-[#6b6f76] underline"
                        >
                          Sacar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {paso === "datos" ? (
          <section className="mx-auto max-w-xl space-y-5">
            <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(60,40,20,0.08)]">
              <h1 className="m-0 text-xl font-semibold text-[#1f2328]">Revisá tu pedido</h1>
              <div className="mt-4 flex items-center justify-between gap-4 border-b border-[#efeae4] pb-4">
                <div>
                  <p className="m-0 font-medium text-[#1f2328]">Tu combo ({n} impresas {tamano})</p>
                  <p className="m-0 text-sm text-[#2f7d5b]">Ya pagado</p>
                </div>
                <ComboFrames slots={n} photoIds={comboIds} thumbUrl={thumbUrl} size="sm" />
              </div>
              {extras.length > 0 ? (
                <div className="border-b border-[#efeae4] py-4">
                  <p className="m-0 font-medium text-[#1f2328]">
                    {extras.length} {extras.length === 1 ? "foto extra" : "fotos extra"}
                  </p>
                  <p className="m-0 text-sm text-[#6b6f76]">
                    {[
                      contar(extras.filter((e) => e.format === "impresa").length, "impresa", "impresas"),
                      contar(extras.filter((e) => e.format === "digital").length, "sólo digital", "sólo digitales"),
                    ]
                      .filter(Boolean)
                      .join(" y ")}
                  </p>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between pt-4">
                <span className="text-lg font-semibold text-[#1f2328]">Total a pagar</span>
                <span className="text-2xl font-semibold text-[#1f2328]">
                  {cotizando || total == null ? "…" : pesos(total)}
                </span>
              </div>
              {total === 0 ? (
                <p className="m-0 mt-2 text-sm text-[#2f7d5b]">Tu combo cubre todo: no tenés que pagar nada.</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <button type="button" className="font-medium text-[#a8652e] underline" onClick={() => irA("combo")}>
                  Cambiar fotos del combo
                </button>
                <button type="button" className="font-medium text-[#a8652e] underline" onClick={() => irA("extras")}>
                  {extras.length > 0 ? "Cambiar fotos extra" : "Sumar fotos extra"}
                </button>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(60,40,20,0.08)]">
              <h2 className="m-0 text-lg font-semibold text-[#1f2328]">Tus datos</h2>
              <p className="m-0 text-sm text-[#6b6f76]">
                Al email te mandamos los archivos digitales. El WhatsApp es para que el fotógrafo coordine con vos la entrega de las impresas.
              </p>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#1f2328]">Nombre y apellido</span>
                <input
                  className="min-h-11 w-full rounded-lg border border-[#d8d0c7] px-3 text-base focus:border-[#c27b3d] focus:outline-none"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#1f2328]">Email</span>
                <input
                  className="min-h-11 w-full rounded-lg border border-[#d8d0c7] px-3 text-base focus:border-[#c27b3d] focus:outline-none"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#1f2328]">WhatsApp</span>
                <input
                  className="min-h-11 w-full rounded-lg border border-[#d8d0c7] px-3 text-base focus:border-[#c27b3d] focus:outline-none"
                  type="tel"
                  autoComplete="tel"
                  placeholder="341 555-1234"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </label>
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
          </section>
        ) : null}

        {aviso ? (
          <p role="status" className="mx-auto mt-4 max-w-xl rounded-lg bg-[#fff4e5] px-4 py-3 text-sm text-[#7a4a12]">
            {aviso}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mx-auto mt-4 max-w-xl rounded-lg bg-[#fdecec] px-4 py-3 text-sm text-[#9b1c1c]">
            {error}
          </p>
        ) : null}
      </main>

      {paso === "combo" || paso === "extras" || paso === "datos" ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e1da] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => irA(paso === "combo" ? "intro" : paso === "extras" ? "pregunta" : extras.length ? "extras" : "pregunta")}
              className="min-h-12 px-2 text-sm font-medium text-[#6b6f76] underline"
            >
              Volver
            </button>
            {paso === "combo" ? (
              <button
                type="button"
                disabled={!comboCompleto}
                onClick={() => irA("pregunta")}
                className="min-h-12 flex-1 rounded-xl bg-[#2f7d5b] px-5 text-base font-semibold text-white disabled:bg-[#c9c3bc] sm:flex-none"
              >
                {comboCompleto ? `Listo, son mis ${n} fotos` : `Elegí ${n - comboIds.length} más`}
              </button>
            ) : null}
            {paso === "extras" ? (
              <button
                type="button"
                onClick={() => irA("datos")}
                className="min-h-12 flex-1 rounded-xl bg-[#c27b3d] px-5 text-base font-semibold text-white hover:bg-[#a8652e] sm:flex-none"
              >
                {extras.length === 0
                  ? "Seguir sin fotos extra"
                  : `Seguir · ${extras.length} extra${precios.impresa != null ? ` · ${pesos(totalExtrasEstimado)}` : ""}`}
              </button>
            ) : null}
            {paso === "datos" ? (
              <button
                type="button"
                disabled={enviando || cotizando || total == null}
                onClick={() => void confirmar()}
                className="min-h-12 flex-1 rounded-xl bg-[#c27b3d] px-5 text-base font-semibold text-white hover:bg-[#a8652e] disabled:bg-[#c9c3bc] sm:flex-none"
              >
                {enviando
                  ? "Confirmando…"
                  : total === 0
                    ? "Confirmar mi combo"
                    : total != null
                      ? `Confirmar y pagar ${pesos(total)}`
                      : "Calculando…"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {zoomId != null ? (
        <PhotoSlideViewer
          photos={viewerPhotos}
          initialIndex={Math.max(0, visibles.indexOf(zoomId))}
          onClose={() => setZoomId(null)}
          onPhotoSelect={(id) => (paso === "extras" ? toggleExtra(Number(id)) : toggleCombo(Number(id)))}
          protectUnpurchased={album.scanProtection}
        />
      ) : null}

      <CheckoutMpPreparingOverlay open={mpPreparando} step={2} />
    </div>
  );
}
