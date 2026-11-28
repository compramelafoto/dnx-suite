"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import HiddenAlbumVerificationGate from "@/components/photo/HiddenAlbumVerificationGate";
import CheckoutTermsAcceptance from "@/components/checkout/CheckoutTermsAcceptance";
import CheckoutMpPreparingOverlay from "@/components/checkout/CheckoutMpPreparingOverlay";
import ComboFrames from "@/components/canje-externo/ComboFrames";
import MiniaturaDelLibrito from "@/components/canje-externo/MiniaturaDelLibrito";
import PhotoPickGrid from "@/components/canje-externo/PhotoPickGrid";
import CanjeSteps, { type CanjeStepKey } from "@/components/canje-externo/CanjeSteps";
import CanjeLibritoStep, { type CanjeCropEntry } from "@/components/canje-externo/CanjeLibritoStep";
import { useMedidasDeFotos } from "@/components/canje-externo/useMedidasDeFotos";
import { orientacionDeLaFoto, TEXTO_DIGITAL, textoFormatoCopia } from "@/lib/canje-externo/formato-de-la-foto";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";
import { savePendingOrderSession } from "@/lib/checkout/pending-order-session";
import { redirectToMercadoPago } from "@/lib/checkout/mp-redirect";
import type { DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import {
  buildCanjeSlotPlan,
  currentCanjeSlotIndex,
  emptyCanjeFill,
  isCanjeComplete,
  photosForCanjeRole,
  removeCanjePhotoFromBenefit,
  toggleCanjePhoto,
} from "@/lib/preventa-canjeable/preventa-canje-slots";
import {
  beneficiosDeLaCompra,
  cantidadValida,
  cantidadesAQuery,
  cantidadesDeQuery,
  hayAlgoElegido,
  MAX_UNIDADES,
  pedidoDeLaCompra,
  totalEstimado,
  type AlumnoDelLibrito,
  type Cantidades,
  type ProductoDeCompra,
} from "@/lib/compra-directa/compra-directa";

type Paso = "productos" | "selfie" | "elegir" | "librito" | "resumen";

type Props = {
  album: {
    id: number;
    title: string;
    photographerName: string | null;
    galeriaHref: string;
    hiddenPhotos: boolean;
  };
  productos: ProductoDeCompra[];
  /** Ya pasó la selfie (o el álbum no tiene fotos ocultas): puede elegir fotos. */
  conPermiso: boolean;
  /** La selfie no encontró a nadie: se vuelve a pedir, con el porqué. */
  selfieSinFotos: boolean;
  photos: Array<{ id: number; sellPrint: boolean; sellDigital: boolean }>;
  designs: Array<{ benefitKey: string; template: DesignTemplatePayload }>;
  cursos: string[];
  comprador: { nombre: string; email: string };
};

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const pesos = (n: number) => ARS.format(n);

const BOTON =
  "min-h-12 rounded-xl bg-[#c27b3d] px-6 text-base font-semibold text-white hover:bg-[#a8652e] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]";
const BOTON_SECUNDARIO =
  "min-h-12 rounded-xl border-2 border-[#c27b3d] px-6 text-base font-semibold text-[#a8652e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]";

function descripcion(p: ProductoDeCompra): string {
  if (p.kind === "DIGITAL") return "La foto en alta calidad, para descargar apenas pagás.";
  if (p.templateId) {
    const lugares = (p.photoInputs ?? []).map((i) => i.label.toLowerCase());
    return lugares.length
      ? `Diseño impreso con ${p.photosPerUnit} fotos: ${lugares.join(" y ")}. Ves cómo queda antes de pagar.`
      : `Diseño impreso con ${p.photosPerUnit} fotos. Ves cómo queda antes de pagar.`;
  }
  return [p.size ? `Copia ${p.size}` : "Copia impresa", p.finish?.toLowerCase()].filter(Boolean).join(" · ");
}

function unidades(p: ProductoDeCompra, n: number): string {
  if (p.kind === "DIGITAL") return n === 1 ? "1 foto digital" : `${n} fotos digitales`;
  if (p.templateId) return `${n} ${p.name.toLowerCase().includes("librito") ? (n === 1 ? "librito" : "libritos") : "×"}`;
  return n === 1 ? "1 copia" : `${n} copias`;
}

/**
 * Compra directa en un álbum con fotos ocultas: «¿Qué querés llevar?» → selfie → una foto por
 * casillero → vista del librito → resumen y pago. Reusa las piezas del canje del pack (casilleros,
 * grilla, vista del librito con encuadre) para que comprar y canjear se vean igual.
 *
 * La elección viaja en la URL (`?q=`): la selfie recarga la página al aprobarse y así la familia
 * sigue donde estaba, sin volver a elegir.
 */
export default function CompraDirectaFlow({
  album,
  productos,
  conPermiso,
  selfieSinFotos,
  photos,
  designs,
  cursos,
  comprador,
}: Props) {
  const [cantidades, setCantidades] = useState<Cantidades>({});
  const [paso, setPaso] = useState<Paso>("productos");
  const [filled, setFilled] = useState<Array<number | null>>([]);
  const [crops, setCrops] = useState<Record<number, CanjeCropEntry>>({});
  const [destino, setDestino] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomId, setZoomId] = useState<number | null>(null);
  const [alumno, setAlumno] = useState<AlumnoDelLibrito>({ nombre: "", apellido: "", curso: "" });
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nombre, setNombre] = useState(comprador.nombre);
  const [email, setEmail] = useState(comprador.email);
  const [telefono, setTelefono] = useState("");
  const [terminos, setTerminos] = useState(false);
  const [errorTerminos, setErrorTerminos] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mpPreparando, setMpPreparando] = useState(false);
  const idempotencyRef = useRef<string | null>(null);
  const { medidas, registrar } = useMedidasDeFotos();

  const beneficios = useMemo(() => beneficiosDeLaCompra(productos, cantidades), [productos, cantidades]);
  const plan = useMemo(() => buildCanjeSlotPlan(beneficios), [beneficios]);
  const porKey = useMemo(() => new Map(productos.map((p) => [p.key, p])), [productos]);
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const disenoPorKey = useMemo(() => new Map(designs.map((d) => [d.benefitKey, d.template])), [designs]);
  const designsElegidos = useMemo(
    () => designs.filter((d) => cantidadValida(cantidades[d.benefitKey]) > 0),
    [designs, cantidades]
  );
  const hayLibrito = designsElegidos.length > 0;
  const thumbUrl = useCallback((id: number) => `/api/photos/${id}/view?albumId=${album.id}&mode=thumb`, [album.id]);

  // Vuelve de la selfie: se retoma lo elegido.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    const c = cantidadesDeQuery(q, productos);
    if (!hayAlgoElegido(c)) return;
    setCantidades(c);
    setFilled(emptyCanjeFill(buildCanjeSlotPlan(beneficiosDeLaCompra(productos, c))));
    setPaso(conPermiso ? "elegir" : "selfie");
    // Sólo al cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const irA = (p: Paso) => {
    setAviso(null);
    setError(null);
    setPaso(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function cambiarCantidad(key: string, delta: number) {
    setCantidades((prev) => {
      const n = Math.max(0, Math.min(MAX_UNIDADES, cantidadValida(prev[key]) + delta));
      const next = { ...prev, [key]: n };
      if (n === 0) delete next[key];
      return next;
    });
  }

  function continuarDeProductos() {
    if (!hayAlgoElegido(cantidades)) return setError("Elegí al menos un producto.");
    const url = new URL(window.location.href);
    url.searchParams.set("q", cantidadesAQuery(cantidades));
    window.history.replaceState(null, "", url.toString());
    setFilled(emptyCanjeFill(plan));
    setCrops({});
    setDestino(null);
    irA(conPermiso ? "elegir" : "selfie");
  }

  const total_lugares = plan.slots.length;
  const elegidas = filled.filter((x) => x != null) as number[];
  const completo = filled.length === total_lugares && isCanjeComplete(filled);
  const actual = currentCanjeSlotIndex(filled, destino);
  const lugarActual = actual != null ? plan.slots[actual] : null;
  const visibles = useMemo(
    () => photosForCanjeRole(photos.map((p) => p.id), new Map(), lugarActual?.role).ids,
    [photos, lugarActual?.role]
  );

  function tocar(id: number) {
    setAviso(null);
    const r = toggleCanjePhoto(plan, filled, id, byId.get(id), destino);
    if (r.ok) {
      setFilled(r.filled);
      setDestino(null);
      if (r.repetida) setAviso("Sumaste esta foto también en otro producto. Para sacarla de un lugar, tocá la cruz.");
      return;
    }
    setAviso(
      r.reason === "lleno"
        ? `Ya elegiste las ${total_lugares} fotos. Para cambiar una, sacala tocándola.`
        : "Esta foto no se vende en el formato de los lugares que te quedan. Elegí otra."
    );
  }

  // Textos del librito (alumno, curso, listado del curso) para la vista previa.
  const alumnoCompleto = alumno.nombre.trim() !== "" && alumno.apellido.trim() !== "" && alumno.curso.trim() !== "";
  useEffect(() => {
    if (!hayLibrito || paso !== "librito" || !alumnoCompleto) return;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/a/${album.id}/llevar/valores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alumno, buyerName: nombre }),
        });
        const data = await res.json().catch(() => ({}));
        if (vivo && res.ok && data?.values) setValores(data.values);
      } catch {
        /* la vista previa sigue con los textos que ya tenía */
      }
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [album.id, alumno, alumnoCompleto, hayLibrito, nombre, paso]);

  const valoresDelLibrito = useMemo(() => {
    if (Object.keys(valores).length > 0) return valores;
    const nombreCompleto = [alumno.nombre, alumno.apellido].map((x) => x.trim()).filter(Boolean).join(" ");
    const v: Record<string, string> = {};
    if (nombreCompleto) v["student.fullName"] = nombreCompleto;
    if (alumno.nombre.trim()) v["student.firstName"] = alumno.nombre.trim();
    if (alumno.apellido.trim()) v["student.lastName"] = alumno.apellido.trim();
    if (alumno.curso.trim()) v["course.displayName"] = alumno.curso.trim();
    return v;
  }, [valores, alumno]);

  const encuadres = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(crops)
          .filter(([i, c]) => filled[Number(i)] === c.photoId)
          .map(([i, c]) => [Number(i), c.crop])
      ),
    [crops, filled]
  );
  const pedido = useMemo(
    () => pedidoDeLaCompra(productos, plan, filled, encuadres),
    [productos, plan, filled, encuadres]
  );

  // Total real del servidor, con la misma cuenta que el pedido (descuentos incluidos).
  useEffect(() => {
    if (paso !== "resumen" || pedido.items.length === 0) return;
    let vivo = true;
    setTotal(null);
    (async () => {
      try {
        const res = await fetch(`/api/a/${album.id}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: pedido.items }),
        });
        const data = await res.json().catch(() => ({}));
        const v = Number(data?.totals?.displayTotalCents);
        if (vivo && res.ok && Number.isFinite(v) && v > 0) setTotal(Math.round(v));
      } catch {
        /* se muestra el estimado */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [album.id, paso, pedido.items]);

  async function pagar() {
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
      setErrorTerminos("Para pagar tenés que aceptar los términos.");
      return;
    }
    setEnviando(true);
    if (!idempotencyRef.current) {
      idempotencyRef.current = `llevar:${album.id}:${crypto.randomUUID?.() ?? Date.now()}`;
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
          items: pedido.items,
          ...(pedido.productDesigns.length > 0 ? { productDesigns: pedido.productDesigns, alumno } : {}),
          termsAccepted: true,
          idempotencyKey: idempotencyRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos armar el pedido.");
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
      setError(e instanceof Error ? e.message : "No pudimos armar el pedido.");
      setEnviando(false);
    }
  }

  const formatoDe = (key: string, kind: string, photoId: number): string => {
    if (kind === "DIGITAL") return TEXTO_DIGITAL;
    const m = medidas.get(photoId);
    return textoFormatoCopia(porKey.get(key)?.size, orientacionDeLaFoto(m?.ancho, m?.alto));
  };

  const casilleros = (size: "lg" | "md" | "sm", editable: boolean) => (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-4">
      {plan.groups.map((g) => (
        <div key={g.benefitKey} className="text-center">
          {disenoPorKey.get(g.benefitKey) ? (
            <MiniaturaDelLibrito
              template={disenoPorKey.get(g.benefitKey)!}
              slotIndexes={g.slotIndexes}
              units={g.units}
              photosPerUnit={g.photosPerUnit}
              labels={plan.slots.map((s) => s.label ?? "Foto")}
              filled={filled}
              activePlace={editable ? actual : null}
              thumbUrl={thumbUrl}
              onPickEmpty={editable ? (place) => setDestino(place) : undefined}
              onRemove={editable ? (id) => setFilled(removeCanjePhotoFromBenefit(plan, filled, g.benefitKey, id)) : undefined}
              alto={size === "sm" ? 130 : size === "md" ? 200 : 260}
              values={valoresDelLibrito}
            />
          ) : (
            <ComboFrames
              slots={g.slotIndexes.length}
              photoIds={g.slotIndexes.map((i) => filled[i]) as number[]}
              labels={g.slotIndexes.map((i) => plan.slots[i].label)}
              activeIndex={editable && actual != null ? g.slotIndexes.indexOf(actual) : -1}
              onPickEmpty={editable ? (pos) => setDestino(g.slotIndexes[pos] ?? null) : undefined}
              thumbUrl={thumbUrl}
              onRemove={editable ? (id) => setFilled(removeCanjePhotoFromBenefit(plan, filled, g.benefitKey, id)) : undefined}
              size={size}
              onImgLoad={registrar}
              caption={size === "lg" ? (id) => formatoDe(g.benefitKey, g.kind, id) : undefined}
            />
          )}
          <p className="m-0 mt-2 text-sm font-medium text-[#1f2328]">{g.label}</p>
          <p className="m-0 text-xs text-[#6b6f76]">
            {porKey.get(g.benefitKey) ? unidades(porKey.get(g.benefitKey)!, g.units) : null}
          </p>
        </div>
      ))}
    </div>
  );

  const estimado = totalEstimado(productos, cantidades);
  const stepKey: CanjeStepKey = paso === "productos" || paso === "selfie" ? "combo" : paso === "resumen" ? "confirmar" : "extras";
  const viewerPhotos = useMemo(
    () =>
      visibles.map((id) => ({
        id: String(id),
        src: `/api/photos/${id}/view?mode=preview&albumId=${album.id}`,
        alt: "Foto del álbum",
        selected: filled.includes(id),
      })),
    [visibles, album.id, filled]
  );
  const verFotosHref = `${album.galeriaHref}${album.galeriaHref.includes("?") ? "&" : "?"}ver=fotos`;

  return (
    <div className="min-h-screen bg-[#f7f5f2] pb-36">
      <CheckoutMpPreparingOverlay open={mpPreparando} step={2} />
      <header className="border-b border-[#e7e1da] bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4">
          <p className="m-0 text-sm text-[#6b6f76]">
            {album.title}
            {album.photographerName ? ` — ${album.photographerName}` : ""}
          </p>
          <CanjeSteps current={stepKey} labels={{ combo: "Qué llevás", extras: "Tus fotos", confirmar: "Pagar" }} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {paso === "productos" ? (
          <section className="mx-auto max-w-xl">
            <h1 className="m-0 text-2xl font-semibold text-[#1f2328]">¿Qué querés llevar?</h1>
            <p className="m-0 mt-2 text-[#4b4f56]">
              Elegí los productos y cuántos. Después {album.hiddenPhotos ? "verificás con una selfie y " : ""}elegís
              una foto para cada uno.
            </p>
            <a
              href="/cliente/recuperar-pack"
              className="mt-5 flex min-h-12 items-center justify-between gap-3 rounded-xl border-2 border-[#2f7d5b] bg-[#eef6f1] px-4 py-3 text-[#1f5b3f] no-underline"
            >
              <span>
                <strong className="block text-base">Ya pagué mi pack, quiero canjear</strong>
                <span className="text-sm">Te mandamos de nuevo tu link personal para elegir las fotos del pack.</span>
              </span>
              <span aria-hidden className="text-xl">→</span>
            </a>
            <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
              {productos.map((p) => {
                const n = cantidadValida(cantidades[p.key]);
                return (
                  <li key={p.key} className={`rounded-2xl border bg-white p-4 ${n > 0 ? "border-[#c27b3d]" : "border-[#e7e1da]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-base font-semibold text-[#1f2328]">{p.name}</p>
                        <p className="m-0 mt-1 text-sm text-[#6b6f76]">{descripcion(p)}</p>
                        <p className="m-0 mt-2 text-lg font-semibold text-[#1f2328]">
                          {p.unitPriceArs != null ? pesos(p.unitPriceArs) : "Precio al elegir"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2" role="group" aria-label={`Cantidad de ${p.name}`}>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(p.key, -1)}
                          disabled={n === 0}
                          className="h-10 w-10 rounded-full border border-[#c27b3d] text-lg font-semibold text-[#a8652e] disabled:opacity-40"
                          aria-label={`Uno menos de ${p.name}`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-lg font-semibold tabular-nums">{n}</span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(p.key, 1)}
                          disabled={n >= MAX_UNIDADES}
                          className="h-10 w-10 rounded-full bg-[#c27b3d] text-lg font-semibold text-white disabled:opacity-40"
                          aria-label={`Uno más de ${p.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {error ? (
              <p role="alert" className="m-0 mt-4 text-sm text-[#b42318]">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-3">
              <button type="button" className={BOTON} onClick={continuarDeProductos} disabled={!hayAlgoElegido(cantidades)}>
                {hayAlgoElegido(cantidades) && estimado != null ? `Continuar · ${pesos(estimado)}` : "Continuar"}
              </button>
              <a href={verFotosHref} className="text-center text-sm font-medium text-[#6b6f76] underline">
                Primero quiero ver las fotos
              </a>
            </div>
          </section>
        ) : null}

        {paso === "selfie" ? (
          <section className="mx-auto max-w-lg">
            <div className="mb-4">{casilleros("md", false)}</div>
            <h1 className="m-0 text-xl font-semibold text-[#1f2328]">Ahora, la selfie</h1>
            {selfieSinFotos ? (
              <p role="alert" className="m-0 mt-3 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-[#7a4a12]">
                No encontramos fotos con esa cara. Probá de nuevo con la cara de tu hija o tu hijo: de frente, con buena
                luz y sin anteojos de sol.
              </p>
            ) : null}
            <p className="m-0 mt-3 rounded-lg bg-[#eef6f1] px-3 py-2 text-sm text-[#1f5b3f]">
              <strong>Importante:</strong> la selfie tiene que ser la cara de tu hija o tu hijo, no la tuya: las fotos son
              del colegio. Así te mostramos sólo sus fotos.
            </p>
            <HiddenAlbumVerificationGate albumId={album.id} albumTitle={album.title} />
            <button type="button" onClick={() => irA("productos")} className="mt-4 text-sm font-medium text-[#6b6f76] underline">
              Cambiar lo que elegí
            </button>
          </section>
        ) : null}

        {paso === "elegir" ? (
          <section>
            <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-[#e7e1da] bg-[#f7f5f2]/95 px-4 py-3 backdrop-blur">
              <h1 className="m-0 text-lg font-semibold text-[#1f2328]">
                Elegí {total_lugares === 1 ? "la foto" : `las ${total_lugares} fotos`}
              </h1>
              <p className="m-0 mb-3 text-sm text-[#2f7d5b]">
                {completo
                  ? "¡Listo! Ya están todas"
                  : `${elegidas.length} de ${total_lugares} elegidas · te ${total_lugares - elegidas.length === 1 ? "falta" : "faltan"} ${total_lugares - elegidas.length}`}
              </p>
              {casilleros("sm", true)}
              {lugarActual?.label && !completo ? (
                <p className="m-0 mt-3 text-center text-sm text-[#1f2328]">
                  Ahora elegí: <strong>{lugarActual.label}</strong>
                  <span className="block text-xs text-[#6b6f76]">Tocá otro lugar vacío para elegir esa foto primero.</span>
                </p>
              ) : null}
              {aviso ? <p className="m-0 mt-2 text-center text-sm text-[#7a4a12]">{aviso}</p> : null}
            </div>
            {photos.length === 0 ? (
              <p className="m-0 rounded-xl bg-white p-4 text-[#4b4f56]">
                Todavía no vemos fotos para vos. Volvé a verificar con la selfie.
              </p>
            ) : (
              <PhotoPickGrid
                photoIds={visibles}
                selected={elegidas}
                onToggle={tocar}
                onZoom={setZoomId}
                thumbUrl={thumbUrl}
                full={completo}
                accent="combo"
                onImgLoad={registrar}
              />
            )}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e1da] bg-white/95 px-4 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
                <button type="button" onClick={() => irA("productos")} className="text-sm font-medium text-[#6b6f76] underline">
                  Cambiar productos
                </button>
                <button type="button" className={BOTON} disabled={!completo} onClick={() => irA(hayLibrito ? "librito" : "resumen")}>
                  {hayLibrito ? "Ver cómo queda el librito" : "Ver el resumen"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {paso === "librito" ? (
          <section>
            <div className="mx-auto mb-6 max-w-xl rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(60,40,20,0.08)]">
              <h2 className="m-0 text-lg font-semibold text-[#1f2328]">¿De quién es el librito?</h2>
              <p className="m-0 mt-1 text-sm text-[#6b6f76]">
                El nombre y el curso van impresos. Con el curso, el librito lleva el listado de los compañeros.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-[#3d4148]">
                  Nombre del alumno
                  <input
                    className="mt-1 block min-h-11 w-full rounded-lg border border-[#d9d2ca] px-3"
                    value={alumno.nombre}
                    autoComplete="off"
                    onChange={(e) => setAlumno((a) => ({ ...a, nombre: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-[#3d4148]">
                  Apellido
                  <input
                    className="mt-1 block min-h-11 w-full rounded-lg border border-[#d9d2ca] px-3"
                    value={alumno.apellido}
                    autoComplete="off"
                    onChange={(e) => setAlumno((a) => ({ ...a, apellido: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-[#3d4148] sm:col-span-2">
                  Curso
                  {cursos.length > 0 ? (
                    <select
                      className="mt-1 block min-h-11 w-full rounded-lg border border-[#d9d2ca] bg-white px-3"
                      value={alumno.curso}
                      onChange={(e) => setAlumno((a) => ({ ...a, curso: e.target.value }))}
                    >
                      <option value="">Elegí el curso</option>
                      {cursos.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 block min-h-11 w-full rounded-lg border border-[#d9d2ca] px-3"
                      value={alumno.curso}
                      placeholder="Por ejemplo: 6° Grado A"
                      onChange={(e) => setAlumno((a) => ({ ...a, curso: e.target.value }))}
                    />
                  )}
                </label>
              </div>
            </div>
            <CanjeLibritoStep
              plan={plan}
              filled={filled}
              crops={crops}
              onChange={(f, c) => {
                setFilled(f);
                setCrops(c);
              }}
              designs={designsElegidos}
              values={valoresDelLibrito}
              photoUrl={(id) => `/api/photos/${id}/view?mode=preview&albumId=${album.id}`}
              photos={byId}
              studentName={alumno.nombre.trim() || null}
            />
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e1da] bg-white/95 px-4 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
                <button type="button" onClick={() => irA("elegir")} className="text-sm font-medium text-[#6b6f76] underline">
                  Cambiar fotos
                </button>
                <button type="button" className={BOTON} disabled={!alumnoCompleto} onClick={() => irA("resumen")}>
                  {alumnoCompleto ? "Continuar al pago" : "Completá nombre, apellido y curso"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {paso === "resumen" ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            <h1 className="m-0 text-center text-2xl font-semibold text-[#1f2328]">Revisá y pagá</h1>
            <div className="mt-6">{casilleros("lg", false)}</div>
            <ul className="m-0 mt-6 list-none border-t border-[#efeae4] p-0 pt-4 text-[15px]">
              {productos
                .filter((p) => cantidadValida(cantidades[p.key]) > 0)
                .map((p) => (
                  <li key={p.key} className="flex justify-between gap-3 py-1">
                    <span>
                      {cantidadValida(cantidades[p.key])} × {p.name}
                    </span>
                    <span className="tabular-nums">
                      {p.unitPriceArs != null ? pesos(p.unitPriceArs * cantidadValida(cantidades[p.key])) : "—"}
                    </span>
                  </li>
                ))}
              <li className="mt-2 flex justify-between gap-3 border-t border-[#efeae4] pt-3 text-lg font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {total != null ? pesos(total) : estimado != null ? pesos(estimado) : "Calculando…"}
                </span>
              </li>
            </ul>
            {hayLibrito ? (
              <p className="m-0 mt-3 text-sm text-[#4b4f56]">
                Librito de <strong>{[alumno.nombre, alumno.apellido].join(" ").trim()}</strong> · {alumno.curso}.{" "}
                {album.photographerName ?? "El fotógrafo"} lo revisa antes de imprimirlo.
              </p>
            ) : null}
            <div className="mt-6 grid gap-3">
              <label className="text-sm text-[#3d4148]">
                Tu nombre y apellido
                <input
                  className="mt-1 block min-h-11 w-full rounded-lg border border-[#d9d2ca] px-3"
                  value={nombre}
                  autoComplete="name"
                  onChange={(e) => setNombre(e.target.value)}
                />
              </label>
              <label className="text-sm text-[#3d4148]">
                Email (ahí te llegan las fotos y el comprobante)
                <input
                  type="email"
                  className="mt-1 block min-h-11 w-full rounded-lg border border-[#d9d2ca] px-3"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="text-sm text-[#3d4148]">
                WhatsApp
                <input
                  type="tel"
                  className="mt-1 block min-h-11 w-full rounded-lg border border-[#d9d2ca] px-3"
                  value={telefono}
                  autoComplete="tel"
                  placeholder="341 555-1234"
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </label>
              <CheckoutTermsAcceptance
                checked={terminos}
                onChange={(v) => {
                  setTerminos(v);
                  setErrorTerminos(null);
                }}
                error={errorTerminos}
              />
            </div>
            {error ? (
              <p role="alert" className="m-0 mt-4 text-sm text-[#b42318]">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-3">
              <button type="button" className={BOTON} onClick={pagar} disabled={enviando || pedido.items.length === 0}>
                {enviando ? "Preparando el pago…" : "Pagar con Mercado Pago"}
              </button>
              <button
                type="button"
                className={BOTON_SECUNDARIO}
                onClick={() => irA(hayLibrito ? "librito" : "elegir")}
                disabled={enviando}
              >
                Volver
              </button>
            </div>
          </section>
        ) : null}
      </main>

      {zoomId != null ? (
        <PhotoSlideViewer
          photos={viewerPhotos}
          initialIndex={Math.max(0, visibles.indexOf(zoomId))}
          onClose={() => setZoomId(null)}
          onPhotoSelect={(id) => tocar(Number(id))}
          protectUnpurchased
        />
      ) : null}
    </div>
  );
}
