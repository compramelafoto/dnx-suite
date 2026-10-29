"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CalendarClock, Check, Image as ImageIcon } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PreventaPackHubJourney from "@/components/preventa/PreventaPackHubJourney";
import PreventaSelfieStep from "@/components/preventa/PreventaSelfieStep";
import { buildPreventaPackJourneySteps } from "@/lib/preventa-canjeable/preventa-pack-journey";
import { buildPreventaRedeemGalleryUrl } from "@/lib/preventa-canjeable/preventa-redeem-url";
import {
  shouldEmbedPreventaSelfieStep,
  type PreventaSelfieUxPhase,
} from "@/lib/preventa-canjeable/preventa-selfie-state";
import { labelPreventaOrderStatus } from "@/lib/preventa-canjeable/preventa-status-labels";
import {
  formatPackCompositionDetailLines,
  summarizePackCompositionFromBenefits,
} from "@/lib/preventa-canjeable/pack-composition-summary";
import { isPreventaUxV2EnabledClient } from "@/lib/preventa-canjeable/preventa-ux-v2-feature-flag";

type OrderResponse = {
  ok: true;
  order: {
    id: number;
    status: string;
    origin: string;
    buyerEmail: string | null;
    buyerUserId: number | null;
    redemptionOrderId: number | null;
    preventaPackSnapshotJson: {
      packDefinitionId?: number | null;
      packName?: string | null;
      packDescription?: string | null;
      priceClientArs?: number | null;
      currency?: string | null;
      redemptionDeadlineAt?: string | null;
      benefits?: Array<{
        stableKey: string;
        name: string;
        kindLabel: string;
        summary: string;
        kind?: "DIGITAL" | "PHYSICAL";
        includedQuantity?: number;
        selectionMode?: "SINGLE_PHOTO" | "MULTI_PHOTO_FIXED" | "ALBUM_CHOICE";
        requiredPhotoCount?: number;
        templatePolicy?: string;
        photographerProductId?: number | null;
      }>;
    } | null;
    album: {
      id: number;
      publicSlug: string;
      title: string;
    } | null;
  };
  journey?: {
    hasPhotos: boolean;
    preCompraOrderId: number | null;
    isSchoolAlbum: boolean;
  };
  extrasHint?: {
    digitalExtraFromArs: number | null;
    printExtraFromArs: number | null;
  };
  upsellPacks?: Array<{
    id: number;
    name: string;
    basePriceArs: number;
    marketplaceFeePercent: number;
    marketplaceFeeArs: number;
    clientPriceArs: number;
    /** @deprecated Usar clientPriceArs */
    priceArs: number;
  }>;
};

/**
 * Qué tiene que hacer la familia con cada beneficio. El `summary` guardado en el pedido es el
 * texto del panel del fotógrafo ("…y no cargaste un monto acá…") y quedó congelado en cada
 * preventa vendida, así que se arma acá en vez de mostrarlo.
 */
function benefitClientLine(b: {
  summary: string;
  kind?: "DIGITAL" | "PHYSICAL";
  includedQuantity?: number;
  selectionMode?: "SINGLE_PHOTO" | "MULTI_PHOTO_FIXED" | "ALBUM_CHOICE";
  requiredPhotoCount?: number;
}): string {
  const iq = b.includedQuantity ?? 1;
  const rpc = b.requiredPhotoCount ?? 1;
  const destino = b.kind === "DIGITAL" ? "para descargar" : "para imprimir";
  if (b.selectionMode === "MULTI_PHOTO_FIXED" && rpc > 1) {
    return iq === 1
      ? `Cuando estén las fotos, elegís ${rpc} fotos distintas ${destino}.`
      : `Cuando estén las fotos, elegís ${rpc} fotos distintas para cada una de las ${iq}.`;
  }
  return `Cuando estén las fotos, elegís ${iq} ${iq === 1 ? "foto" : "fotos"} ${destino}.`;
}

/** Precio en pesos con separador de miles: «$ 38.000». */
function pesos(monto: number | null | undefined): string {
  return `$ ${Math.round(Number(monto ?? 0)).toLocaleString("es-AR")}`;
}

export default function ClientePackPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const rawId = String(orderId || "").trim();
  const isNumericId = /^\d+$/.test(rawId);
  const searchParams = useSearchParams();
  const justRedeemed = searchParams.get("redeemed") === "true";
  const uxV2 = isPreventaUxV2EnabledClient();

  const [data, setData] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selfiePhase, setSelfiePhase] = useState<PreventaSelfieUxPhase | null>(null);

  const handleSelfiePhaseChange = useCallback((phase: PreventaSelfieUxPhase) => {
    setSelfiePhase(phase);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = isNumericId
          ? `/api/orders/${rawId}`
          : `/api/public/pack/${encodeURIComponent(rawId)}`;
        const res = await fetch(apiUrl, {
          credentials: isNumericId ? "include" : "omit",
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json?.error === "token_invalid"
              ? "El link ya no es válido o expiró."
              : json?.error === "pack_not_paid"
                ? "Este pack todavía no tiene el pago confirmado."
                : json?.error === "unauthorized"
                  ? "Iniciá sesión como cliente para ver este pack."
                  : json?.error || "No se pudo cargar el pedido";
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error inesperado");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [orderId, isNumericId, rawId]);

  const redeemEntryHref = useMemo(() => {
    if (!data?.order.album) return null;
    // Con el link del correo (token) se canjea en el recorrido guiado por pasos. Quien entra
    // logueado por número de pedido sigue con la galería en modo canje.
    if (!isNumericId) return `/canje/preventa/${encodeURIComponent(rawId)}`;
    return buildPreventaRedeemGalleryUrl({
      albumId: data.order.album.id,
      preventaPackOrderId: isNumericId ? data.order.id : undefined,
      preventaPackToken: isNumericId ? undefined : rawId,
    });
  }, [data, isNumericId, rawId]);

  // Los extras se compran como cualquier foto de la galería, sin el token: con el token la
  // compra entraba en modo canje y no cobraba nada.
  const upsellHref = useMemo(() => {
    if (!data?.order.album) return null;
    return `/a/${data.order.album.id}`;
  }, [data]);

  const journeySteps = useMemo(() => {
    if (!uxV2 || !data?.order) return [];
    const j = data.journey;
    const preCompraOrderId = j?.preCompraOrderId ?? null;
    const selfieHref =
      preCompraOrderId != null ? `/order/${preCompraOrderId}/selfies` : null;
    const isPaid = data.order.status === "PAID";
    const alreadyRedeemed = data.order.redemptionOrderId != null;
    const embedSelfie = shouldEmbedPreventaSelfieStep({
      uxV2,
      isSchoolAlbum: j?.isSchoolAlbum ?? false,
      preCompraOrderId,
      isPaid,
      alreadyRedeemed,
      phase: selfiePhase,
    });
    return buildPreventaPackJourneySteps({
      orderStatus: data.order.status,
      origin: data.order.origin,
      redemptionOrderId: data.order.redemptionOrderId,
      hasPhotos: j?.hasPhotos ?? false,
      isSchoolAlbum: j?.isSchoolAlbum ?? false,
      preCompraOrderId,
      redeemHref: redeemEntryHref,
      selfieHref,
      selfieEmbedded: embedSelfie,
      selfiePhase,
    });
  }, [uxV2, data, redeemEntryHref, selfiePhase]);

  const packCompositionLines = useMemo(() => {
    const benefits = data?.order?.preventaPackSnapshotJson?.benefits ?? [];
    if (benefits.length === 0) return [];
    const summary = summarizePackCompositionFromBenefits(
      benefits.map((b) => ({
        kind: (b.kind ?? "DIGITAL") as "DIGITAL" | "PHYSICAL",
        includedQuantity: b.includedQuantity ?? 1,
        selectionMode: (b.selectionMode ?? "SINGLE_PHOTO") as
          | "SINGLE_PHOTO"
          | "MULTI_PHOTO_FIXED"
          | "ALBUM_CHOICE",
        requiredPhotoCount: b.requiredPhotoCount ?? 1,
        templatePolicy: (b.templatePolicy ?? "NONE") as "NONE" | "REQUIRED" | "OPTIONAL",
        photographerProductId: b.photographerProductId ?? null,
      }))
    );
    return formatPackCompositionDetailLines(summary, {
      isSchoolAlbum: data?.journey?.isSchoolAlbum ?? false,
    });
  }, [data?.order?.preventaPackSnapshotJson?.benefits, data?.journey?.isSchoolAlbum]);

  const isPreventaPack = data?.order.origin === "PREVENTA_PACK";
  const isPaid = data?.order.status === "PAID";
  const alreadyRedeemed = data?.order.redemptionOrderId != null;
  const showEmbeddedSelfie =
    data != null &&
    shouldEmbedPreventaSelfieStep({
      uxV2,
      isSchoolAlbum: data.journey?.isSchoolAlbum ?? false,
      preCompraOrderId: data.journey?.preCompraOrderId ?? null,
      isPaid,
      alreadyRedeemed,
      phase: selfiePhase,
    });

  if (loading) {
    return <div className="p-6">Cargando tu preventa…</div>;
  }

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-red-600">Error: {error}</p>
        <Link href="/cliente/recuperar-pack" className="text-[#c27b3d] font-semibold underline">
          Recuperar acceso al pack
        </Link>
      </div>
    );
  }

  if (!data?.order) {
    return <div className="p-6">No se encontró el pedido.</div>;
  }

  const order = data.order;
  const snapshot = order.preventaPackSnapshotJson;
  const canStartRedeem =
    isPreventaPack && isPaid && !alreadyRedeemed && order.album != null;
  const upsellExtras = data.extrasHint ?? {
    digitalExtraFromArs: null,
    printExtraFromArs: null,
  };
  const upsellPacks = Array.isArray(data.upsellPacks)
    ? data.upsellPacks.filter(
        (p) => snapshot?.packDefinitionId == null || p.id !== snapshot.packDefinitionId
      )
    : [];
  const hasUpsells =
    (upsellExtras.digitalExtraFromArs != null && upsellExtras.digitalExtraFromArs > 0) ||
    (upsellExtras.printExtraFromArs != null && upsellExtras.printExtraFromArs > 0) ||
    upsellPacks.length > 0;

  const statusLabel = uxV2 ? labelPreventaOrderStatus(order.status) : order.status;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {justRedeemed ? (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          <strong className="font-semibold">Canje registrado.</strong> Tu pack ya fue usado; el fotógrafo verá el
          pedido de canje asociado.
        </div>
      ) : null}

      {uxV2 && journeySteps.length > 0 ? (
        <PreventaPackHubJourney steps={journeySteps} />
      ) : null}

      {showEmbeddedSelfie && data.journey?.preCompraOrderId != null ? (
        <PreventaSelfieStep
          preCompraOrderId={data.journey.preCompraOrderId}
          variant="embedded"
          hasPhotos={data.journey.hasPhotos ?? false}
          redeemHref={redeemEntryHref}
          legacySelfieHref={`/order/${data.journey.preCompraOrderId}/selfies`}
          onPhaseChange={handleSelfiePhaseChange}
        />
      ) : null}

      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a2018] via-[#3a2a1d] to-[#c27b3d] px-6 py-8 text-white shadow-lg sm:px-10 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          {uxV2 ? "Tu preventa" : "Tu pack de preventa"}
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{snapshot?.packName || "Pack"}</h1>
        {order.album ? <p className="mt-2 text-base text-white/85">{order.album.title}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1 font-medium">
            {uxV2 ? statusLabel : `Estado: ${order.status}`}
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1">Pedido #{order.id}</span>
          {snapshot?.priceClientArs != null ? (
            <span className="rounded-full bg-white/15 px-3 py-1">{pesos(snapshot.priceClientArs)}</span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Qué incluye tu pack</h2>
            {snapshot?.packDescription ? (
              <p className="mt-2 text-base leading-relaxed text-gray-600">{snapshot.packDescription}</p>
            ) : null}
          </div>

          {snapshot?.benefits?.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {snapshot.benefits.map((b) => (
                <div key={b.stableKey} className="rounded-2xl bg-[#fbf6f1] p-5 ring-1 ring-[#c27b3d]/15">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#c27b3d] text-white">
                    {b.kind === "PHYSICAL" ? <BookOpen className="h-5 w-5" aria-hidden /> : <ImageIcon className="h-5 w-5" aria-hidden />}
                  </span>
                  <p className="mt-4 text-lg font-semibold leading-snug text-gray-900">{b.name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#a0652d]">{b.kindLabel}</p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-700">{benefitClientLine(b)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Este pack todavía no tiene beneficios visibles.</p>
          )}

          {packCompositionLines.length > 0 ? (
            <ul className="m-0 grid list-none gap-2.5 border-t border-gray-100 p-0 pt-5 sm:grid-cols-2">
              {packCompositionLines.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm leading-snug text-gray-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <aside className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-gray-900">Usar tu pack</h2>

          {!isPreventaPack ? (
            <p className="text-sm text-gray-600">Este pedido no es una preventa canjeable desde acá.</p>
          ) : alreadyRedeemed ? (
            <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              Este pack ya fue usado. Pedido de canje: #{order.redemptionOrderId}
            </p>
          ) : !isPaid ? (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              Cuando el pago se confirme vas a poder elegir las fotos y completar el canje. Si ya pagaste y sigue
              pendiente, esperá unos minutos o revisá el estado en Mercado Pago.
            </p>
          ) : !order.album ? (
            <p className="text-sm text-gray-600">No hay álbum asociado a este pedido.</p>
          ) : redeemEntryHref ? (
            <>
              <p className="text-sm leading-relaxed text-gray-600">
                Entrá al álbum para elegir las fotos según lo que incluye tu pack.
              </p>
              <Link
                href={redeemEntryHref}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c27b3d] px-5 py-3.5 text-base font-semibold text-white shadow-md shadow-[#c27b3d]/25 hover:bg-[#a0652d]"
              >
                Elegir las fotos de mi pack
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          ) : null}

          {snapshot?.redemptionDeadlineAt ? (
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              Podés usarlo hasta el{" "}
              {new Date(snapshot.redemptionDeadlineAt).toLocaleDateString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
              })}
            </p>
          ) : null}

          {canStartRedeem ? (
            <p className="break-all text-xs text-gray-400">
              Guardá este link para volver:{" "}
              {isNumericId ? `/cliente/pack/${order.id}` : `/cliente/pack/${rawId}`}
            </p>
          ) : null}

          {uxV2 &&
          !showEmbeddedSelfie &&
          data.journey?.preCompraOrderId != null &&
          isPaid &&
          !alreadyRedeemed ? (
            <p className="border-t border-gray-100 pt-4 text-xs text-gray-500">
              ¿Te pidieron una selfie?{" "}
              <Link
                href={`/order/${data.journey.preCompraOrderId}/selfies`}
                className="font-semibold text-[#c27b3d] hover:underline"
              >
                Subir selfie (paso escolar)
              </Link>
            </p>
          ) : null}
        </aside>
      </div>

      {hasUpsells ? (
        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Sumá más fotos a tu pedido</h2>
            <p className="mt-1 text-sm text-gray-600">Lo que ya incluye tu pack no cambia. Esto es adicional.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upsellExtras.digitalExtraFromArs != null && upsellExtras.digitalExtraFromArs > 0 ? (
              <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Extra</p>
                <p className="mt-1 text-base font-semibold text-emerald-950">Foto digital extra</p>
                <p className="mt-2 text-lg font-bold text-emerald-900">{pesos(upsellExtras.digitalExtraFromArs)}</p>
              </div>
            ) : null}
            {upsellExtras.printExtraFromArs != null && upsellExtras.printExtraFromArs > 0 ? (
              <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Extra</p>
                <p className="mt-1 text-base font-semibold text-emerald-950">Impresión extra</p>
                <p className="mt-2 text-lg font-bold text-emerald-900">{pesos(upsellExtras.printExtraFromArs)}</p>
              </div>
            ) : null}
            {upsellPacks.map((p) => (
              <div key={p.id} className="rounded-2xl bg-[#fbf6f1] p-5 ring-1 ring-[#c27b3d]/15">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#a0652d]">Pack adicional</p>
                <p className="mt-1 text-base font-semibold text-gray-900">{p.name}</p>
                <p className="mt-2 text-lg font-bold text-gray-900">{pesos(p.clientPriceArs)}</p>
              </div>
            ))}
          </div>
          {upsellHref ? (
            <Link
              href={upsellHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
            >
              Comprar extras
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
