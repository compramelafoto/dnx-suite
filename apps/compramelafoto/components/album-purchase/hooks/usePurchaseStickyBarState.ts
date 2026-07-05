"use client";

import { useMemo } from "react";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { buildGallerySelectionEstimate } from "@/lib/gallery/format-gallery-selection-estimate";
import type { GalleryPricingSnapshot } from "@/lib/pricing/gallery-pricing-snapshot";
import type {
  PurchaseStickyBarPrimaryAction,
  PurchaseStickyBarProps,
  PurchaseStickyBarSecondaryAction,
} from "@/components/album-purchase/PurchaseStickyBar";
import {
  getPublicPackStickySelectionLabel,
  type PublicPack,
} from "@/lib/album-packs/public-pack";

type PackSelectionMode = {
  packId: string;
  packName: string;
  requiredCount: number;
  photoIds: Set<string>;
  compositionFulfillmentKind: PublicPack["compositionFulfillmentKind"];
};

type PackDraftSummary = {
  packName: string;
  selectedCount: number;
  totalCents: number;
  preparedPackCount?: number;
};

type PublicPackForSticky = Pick<PublicPack, "id" | "name" | "price"> & {
  clientPriceArs?: number;
};

type FaceBulkSavings = {
  savingsCents: number;
  packTotalClientCents: number;
};

export type UsePurchaseStickyBarStateParams = {
  packSelectionMode: PackSelectionMode | null;
  packDraftPreparedSummary: PackDraftSummary | null;
  selectedSinglesCount: number;
  packSelectionSaving: boolean;
  packPaymentSubmitting: boolean;
  checkoutSubmitting: boolean;
  searchLoading: boolean;
  pendingAllPhotosPack: { packId: string; packName: string } | null;
  packSelectionError: string | null;
  packPaymentError: string | null;
  searchError: string | null;
  checkoutSubmitError: string | null;
  albumPackPayButtonEnabled: boolean;
  publicVisiblePacks?: PublicPackForSticky[];
  digitalPhotoPriceCents?: number | null;
  faceBulkSavings?: FaceBulkSavings | null;
  faceBulkSelectedMatch: boolean;
  galleryPricing?: GalleryPricingSnapshot | null;
  onSavePackSelection: () => void;
  onPayPreparedPack: () => void;
  onComprarSingles: () => void;
  onClearSelection: () => void;
  onOpenFaceSearch: () => void;
};

export type UsePurchaseStickyBarStateResult = Pick<
  PurchaseStickyBarProps,
  | "visible"
  | "packName"
  | "selectedCount"
  | "requiredCount"
  | "selectedSummaryLabel"
  | "discountAppliedLabel"
  | "totalLabel"
  | "savingsLabel"
  | "errorMessage"
  | "statusLine"
  | "primaryAction"
  | "secondaryAction"
>;

function computePackSelectionSavings(
  pack: PublicPackForSticky | undefined,
  selectedCount: number,
  digitalPhotoPriceCents: number | null | undefined
): string | null {
  if (!pack || selectedCount <= 0) return null;
  const packClientPrice = pack.clientPriceArs ?? pack.price;
  if (packClientPrice <= 0) return null;
  const unit = digitalPhotoPriceCents ?? 0;
  if (unit <= 0) return null;
  const individualTotal = unit * selectedCount;
  const savings = individualTotal - packClientPrice;
  if (savings <= 0) return null;
  return `Ahorrás ${formatPurchaseArs(savings)} vs comprar sueltas`;
}

export function usePurchaseStickyBarState(
  params: UsePurchaseStickyBarStateParams
): UsePurchaseStickyBarStateResult {
  const {
    packSelectionMode,
    packDraftPreparedSummary,
    selectedSinglesCount,
    packSelectionSaving,
    packPaymentSubmitting,
    checkoutSubmitting,
    searchLoading,
    pendingAllPhotosPack,
    packSelectionError,
    packPaymentError,
    searchError,
    checkoutSubmitError,
    albumPackPayButtonEnabled,
    publicVisiblePacks,
    digitalPhotoPriceCents,
    faceBulkSavings,
    faceBulkSelectedMatch,
    galleryPricing,
    onSavePackSelection,
    onPayPreparedPack,
    onComprarSingles,
    onClearSelection,
    onOpenFaceSearch,
  } = params;

  return useMemo(() => {
    const loadingPackFlow =
      packSelectionSaving || (searchLoading && pendingAllPhotosPack != null);

    const mergedError =
      packSelectionError ||
      packPaymentError ||
      searchError ||
      checkoutSubmitError ||
      null;

    const contextualPackName =
      packSelectionMode?.packName ?? pendingAllPhotosPack?.packName ?? null;

    let visible = false;
    let packName: string | null = null;
    let selectedCount = 0;
    let requiredCount: number | null = null;
    let selectedSummaryLabel: string | null = null;
    let discountAppliedLabel: string | null = null;
    let totalLabel: string | null = null;
    let savingsLabel: string | null = null;
    let statusLine: string | null = null;
    let primaryAction: PurchaseStickyBarPrimaryAction = {
      label: "Continuar",
      disabled: true,
      loading: false,
      onClick: () => {},
    };
    let secondaryAction: PurchaseStickyBarSecondaryAction | undefined;

    const preparedTotalLabel = packDraftPreparedSummary
      ? `Total: ${formatPurchaseArs(packDraftPreparedSummary.totalCents)}`
      : null;

    if (loadingPackFlow) {
      visible = true;
      packName = pendingAllPhotosPack?.packName ?? packSelectionMode?.packName ?? null;
      statusLine = packSelectionSaving
        ? "Confirmando pack…"
        : searchLoading
          ? "Buscando con IA…"
          : "Preparando tu pack…";
      totalLabel = preparedTotalLabel;
      primaryAction = {
        label: statusLine,
        disabled: true,
        loading: true,
        onClick: () => {},
      };
    } else if (packSelectionMode) {
      visible = true;
      packName = packSelectionMode.packName;
      selectedCount = packSelectionMode.photoIds.size;
      requiredCount = packSelectionMode.requiredCount;
      totalLabel = preparedTotalLabel;
      const complete = selectedCount === packSelectionMode.requiredCount;
      const activePack = publicVisiblePacks?.find((p) => p.id === packSelectionMode.packId);
      if (selectedCount > 0) {
        selectedSummaryLabel = getPublicPackStickySelectionLabel(
          selectedCount,
          packSelectionMode.compositionFulfillmentKind
        );
      }
      if (complete) {
        savingsLabel = computePackSelectionSavings(
          activePack,
          selectedCount,
          digitalPhotoPriceCents
        );
        statusLine = preparedTotalLabel ? "Confirmá este pack para sumarlo al total" : "Selección completa";
      } else {
        statusLine = `Elegí ${packSelectionMode.requiredCount - selectedCount} foto${
          packSelectionMode.requiredCount - selectedCount === 1 ? "" : "s"
        } más`;
      }
      primaryAction = {
        label: packSelectionSaving
          ? "Confirmando pack…"
          : complete
            ? "Confirmar pack"
            : `Elegí ${packSelectionMode.requiredCount} fotos`,
        disabled: !complete || packSelectionSaving,
        loading: packSelectionSaving,
        onClick: onSavePackSelection,
      };
      if (selectedCount > 0) {
        secondaryAction = {
          label: "Deseleccionar todas",
          disabled: packSelectionSaving,
          onClick: onClearSelection,
        };
      }
    } else if (packDraftPreparedSummary) {
      visible = true;
      packName = packDraftPreparedSummary.packName;
      selectedCount = packDraftPreparedSummary.selectedCount;
      totalLabel = preparedTotalLabel;
      const preparedPackCount = packDraftPreparedSummary.preparedPackCount ?? 1;
      statusLine =
        preparedPackCount > 1
          ? `${preparedPackCount} packs listos para pagar`
          : "Pack listo para pagar";
      primaryAction = {
        label: albumPackPayButtonEnabled
          ? packPaymentSubmitting
            ? "Iniciando pago…"
            : preparedPackCount > 1
              ? "Pagar packs"
              : "Pagar pack"
          : "Pago próximamente disponible",
        disabled: !albumPackPayButtonEnabled || packPaymentSubmitting,
        loading: packPaymentSubmitting,
        onClick: onPayPreparedPack,
      };
    } else if (selectedSinglesCount > 0) {
      visible = true;
      selectedCount = selectedSinglesCount;
      if (faceBulkSelectedMatch && faceBulkSavings && faceBulkSavings.savingsCents > 0) {
        savingsLabel = `Ahorrás ${formatPurchaseArs(faceBulkSavings.savingsCents)} con el pack facial`;
        totalLabel = `Pack facial: ${formatPurchaseArs(faceBulkSavings.packTotalClientCents)}`;
      } else {
        const estimate = buildGallerySelectionEstimate(
          galleryPricing,
          selectedSinglesCount
        );
        if (estimate) {
          selectedSummaryLabel = estimate.selectedCountLabel;
          discountAppliedLabel = estimate.discountAppliedLabel;
          totalLabel = estimate.estimatedTotalLabel;
        }
      }
      primaryAction = {
        label: checkoutSubmitting
          ? "Procesando compra…"
          : `Comprar ${selectedSinglesCount} foto${selectedSinglesCount === 1 ? "" : "s"}`,
        disabled: checkoutSubmitting,
        loading: checkoutSubmitting,
        onClick: onComprarSingles,
      };
      secondaryAction = {
        label: "Deseleccionar todas",
        disabled: checkoutSubmitting,
        onClick: onClearSelection,
      };
    } else if (mergedError) {
      visible = true;
      packName = contextualPackName;
      statusLine = "Revisá el mensaje y probá de nuevo";
      primaryAction = {
        label: searchError || pendingAllPhotosPack ? "Buscar con IA de nuevo" : "Reintentar",
        disabled: searchLoading || packSelectionSaving,
        loading: searchLoading,
        onClick: searchError || pendingAllPhotosPack ? onOpenFaceSearch : onComprarSingles,
      };
    }

    return {
      visible,
      packName,
      selectedCount,
      requiredCount,
      selectedSummaryLabel,
      discountAppliedLabel,
      totalLabel,
      savingsLabel,
      errorMessage: mergedError,
      statusLine,
      primaryAction,
      secondaryAction,
    };
  }, [
    packSelectionMode,
    packDraftPreparedSummary,
    selectedSinglesCount,
    packSelectionSaving,
    packPaymentSubmitting,
    checkoutSubmitting,
    searchLoading,
    pendingAllPhotosPack,
    packSelectionError,
    packPaymentError,
    searchError,
    checkoutSubmitError,
    albumPackPayButtonEnabled,
    publicVisiblePacks,
    digitalPhotoPriceCents,
    faceBulkSavings,
    faceBulkSelectedMatch,
    galleryPricing,
    onSavePackSelection,
    onPayPreparedPack,
    onComprarSingles,
    onClearSelection,
    onOpenFaceSearch,
  ]);
}
