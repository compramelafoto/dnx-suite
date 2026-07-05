"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PreventaPackHubJourney from "@/components/preventa/PreventaPackHubJourney";
import PreventaSelfieStep from "@/components/preventa/PreventaSelfieStep";
import { buildPreventaPackJourneySteps } from "@/lib/preventa-canjeable/preventa-pack-journey";
import { buildPreventaRedeemComprarUrl } from "@/lib/preventa-canjeable/preventa-redeem-url";
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

export default function ClientePackPage({
  params,
}: {
  params: { orderId: string };
}) {
  const rawId = String(params.orderId || "").trim();
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
  }, [params.orderId, isNumericId, rawId]);

  const redeemEntryHref = useMemo(() => {
    if (!data?.order.album) return null;
    return buildPreventaRedeemComprarUrl({
      albumId: data.order.album.id,
      preventaPackOrderId: isNumericId ? data.order.id : undefined,
      preventaPackToken: isNumericId ? undefined : rawId,
    });
  }, [data, isNumericId, rawId]);

  const upsellHref = useMemo(() => {
    if (!data?.order.album) return null;
    return buildPreventaRedeemComprarUrl({
      albumId: data.order.album.id,
      preventaPackOrderId: isNumericId ? data.order.id : undefined,
      preventaPackToken: isNumericId ? undefined : rawId,
      source: "pack-upsell",
    });
  }, [data, isNumericId, rawId]);

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

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {uxV2 ? "Tu preventa" : "Tu pack de preventa"}
        </h1>
        <p className="text-sm text-gray-600">
          Pedido #{order.id} · {uxV2 ? statusLabel : `Estado: ${order.status}`}
        </p>
        {order.album ? (
          <p className="text-sm text-gray-600">Campaña: {order.album.title}</p>
        ) : null}
      </header>

      <section className="border rounded-xl p-5 sm:p-6 space-y-3 bg-white">
        <h2 className="text-lg font-medium">{snapshot?.packName || "Pack"}</h2>

        {snapshot?.packDescription ? (
          <p className="text-sm text-gray-700">{snapshot.packDescription}</p>
        ) : null}

        <p className="text-sm text-gray-700">
          Precio: ${snapshot?.priceClientArs ?? 0}
        </p>

        {snapshot?.redemptionDeadlineAt ? (
          <p className="text-sm text-gray-700">
            Disponible para usar hasta:{" "}
            {new Date(snapshot.redemptionDeadlineAt).toLocaleString("es-AR")}
          </p>
        ) : null}
      </section>

      <section className="border rounded-xl p-5 sm:p-6 space-y-4 bg-white">
        <h2 className="text-lg font-medium">Qué incluye tu pack</h2>

        {packCompositionLines.length > 0 ? (
          <ul className="text-sm text-gray-700 space-y-1 m-0 pl-4 list-disc">
            {packCompositionLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {snapshot?.benefits?.length ? (
          <div className="space-y-3">
            {snapshot.benefits.map((b) => (
              <div key={b.stableKey} className="border rounded-lg p-3">
                <p className="font-medium">{b.name}</p>
                <p className="text-sm text-gray-600">{b.kindLabel}</p>
                <p className="text-sm text-gray-700 mt-1">{b.summary}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Este pack todavía no tiene beneficios visibles.
          </p>
        )}
      </section>

      {hasUpsells ? (
        <section className="border rounded-xl p-5 sm:p-6 space-y-4 bg-white">
          <div>
            <h2 className="text-lg font-medium">Sumá más fotos a tu pedido</h2>
            <p className="text-sm text-gray-600">
              Lo que ya incluye tu pack no cambia. Esto es adicional.
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-700">
            <p className="font-medium text-gray-800">Incluido en tu pack</p>
            <p className="mt-1 text-gray-600">
              {snapshot?.packName ? `${snapshot.packName}` : "Pack de preventa"}
              {snapshot?.priceClientArs != null ? ` · $${snapshot.priceClientArs}` : ""}
            </p>
          </div>
          <div className="space-y-3">
            {upsellExtras.digitalExtraFromArs != null &&
            upsellExtras.digitalExtraFromArs > 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Extra</p>
                  <p className="text-sm text-emerald-800">Foto digital extra</p>
                </div>
                <div className="text-sm font-semibold text-emerald-900">
                  ${upsellExtras.digitalExtraFromArs}
                </div>
              </div>
            ) : null}
            {upsellExtras.printExtraFromArs != null && upsellExtras.printExtraFromArs > 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Extra</p>
                  <p className="text-sm text-emerald-800">Impresión extra</p>
                </div>
                <div className="text-sm font-semibold text-emerald-900">
                  ${upsellExtras.printExtraFromArs}
                </div>
              </div>
            ) : null}
            {upsellPacks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Packs adicionales</p>
                {upsellPacks.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Extra</p>
                      <p className="text-sm text-amber-800">{p.name}</p>
                    </div>
                    <div className="text-sm font-semibold text-amber-900">${p.clientPriceArs}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {upsellHref ? (
            <Link
              href={upsellHref}
              className="inline-flex items-center justify-center rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b26f36]"
            >
              Comprar extras
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="border rounded-xl p-5 sm:p-6 bg-white space-y-3">
        <h2 className="text-lg font-medium">Usar tu pack</h2>

        {!isPreventaPack ? (
          <p className="text-sm text-gray-600">
            Este pedido no es una preventa canjeable desde acá.
          </p>
        ) : alreadyRedeemed ? (
          <p className="text-green-700 font-medium">
            Este pack ya fue usado. Pedido de canje: #{order.redemptionOrderId}
          </p>
        ) : !isPaid ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Cuando el pago se confirme vas a poder elegir las fotos y completar el canje. Si ya pagaste y sigue
            pendiente, esperá unos minutos o revisá el estado en Mercado Pago.
          </p>
        ) : !order.album ? (
          <p className="text-sm text-gray-600">No hay álbum asociado a este pedido.</p>
        ) : redeemEntryHref ? (
          <>
            <p className="text-sm text-gray-700">
              Entrá al álbum para elegir las fotos según lo que incluye tu pack.
            </p>
            <Link
              href={redeemEntryHref}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-900"
            >
              Elegir fotos en el álbum
            </Link>
          </>
        ) : null}

        {canStartRedeem ? (
          <p className="text-xs text-gray-500">
            Guardá este link para volver:{" "}
            {isNumericId ? `/cliente/pack/${order.id}` : `/cliente/pack/${rawId}`}
          </p>
        ) : null}

        {uxV2 &&
        !showEmbeddedSelfie &&
        data.journey?.preCompraOrderId != null &&
        isPaid &&
        !alreadyRedeemed ? (
          <p className="text-xs text-gray-500 border-t border-gray-100 pt-3 mt-3">
            ¿Te pidieron una selfie?{" "}
            <Link
              href={`/order/${data.journey.preCompraOrderId}/selfies`}
              className="text-[#c27b3d] font-semibold hover:underline"
            >
              Subir selfie (paso escolar)
            </Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
