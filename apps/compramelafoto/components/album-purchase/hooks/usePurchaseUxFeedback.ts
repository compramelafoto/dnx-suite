"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PurchaseToastState, PurchaseToastTone } from "@/components/album-purchase/PurchaseToast";

type PackSelectionMode = {
  packName: string;
  requiredCount: number;
  photoIds: Set<string>;
};

type PackDraftSummary = {
  draftId: string;
  packName: string;
  selectedCount: number;
  preparedPackCount?: number;
};

export type UsePurchaseUxFeedbackParams = {
  enabled: boolean;
  packsSectionRef: React.RefObject<HTMLElement | null>;
  packDraftPreparedSummary: PackDraftSummary | null;
  packSelectionMode: PackSelectionMode | null;
  searchResultsCount: number;
  searchLoading: boolean;
  pendingAllPhotosPack: { packId: string } | null;
  lastFaceSearchCountRef?: React.MutableRefObject<number>;
};

export function usePurchaseUxFeedback({
  enabled,
  packsSectionRef,
  packDraftPreparedSummary,
  packSelectionMode,
  searchResultsCount,
  searchLoading,
  pendingAllPhotosPack,
}: UsePurchaseUxFeedbackParams) {
  const [toast, setToast] = useState<PurchaseToastState>(null);
  const prevPreparedPackCountRef = useRef(0);
  const prevPackCompleteRef = useRef(false);
  const prevSearchCountRef = useRef(0);

  const showToast = useCallback((message: string, tone: PurchaseToastTone = "success") => {
    setToast({ message, tone });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const scrollToPacks = useCallback(() => {
    packsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [packsSectionRef]);

  useEffect(() => {
    if (!enabled) return;
    const preparedPackCount = packDraftPreparedSummary?.preparedPackCount ?? 0;
    if (preparedPackCount <= 0) {
      prevPreparedPackCountRef.current = 0;
      return;
    }
    if (preparedPackCount <= prevPreparedPackCountRef.current) {
      prevPreparedPackCountRef.current = preparedPackCount;
      return;
    }
    prevPreparedPackCountRef.current = preparedPackCount;
    scrollToPacks();
    const selectedCount = packDraftPreparedSummary?.selectedCount ?? 0;
    showToast(
      preparedPackCount > 1
        ? `Pack agregado. Tenés ${preparedPackCount} packs listos para pagar.`
        : `Pack listo: ${selectedCount} foto${selectedCount === 1 ? "" : "s"}. Revisá el botón de abajo para pagar.`,
      "success"
    );
  }, [enabled, packDraftPreparedSummary, scrollToPacks, showToast]);

  useEffect(() => {
    if (!enabled || !packSelectionMode) {
      prevPackCompleteRef.current = false;
      return;
    }
    const complete =
      packSelectionMode.photoIds.size === packSelectionMode.requiredCount &&
      packSelectionMode.requiredCount > 0;
    if (complete && !prevPackCompleteRef.current) {
      showToast(
        `${packSelectionMode.requiredCount}/${packSelectionMode.requiredCount} fotos elegidas. Usá el botón de abajo para confirmar el pack.`,
        "info"
      );
    }
    prevPackCompleteRef.current = complete;
  }, [
    enabled,
    packSelectionMode?.packName,
    packSelectionMode?.requiredCount,
    packSelectionMode?.photoIds.size,
    packSelectionMode,
    showToast,
  ]);

  useEffect(() => {
    if (!enabled || searchLoading) return;
    if (pendingAllPhotosPack) return;
    if (searchResultsCount <= 0) return;
    if (searchResultsCount === prevSearchCountRef.current) return;
    prevSearchCountRef.current = searchResultsCount;
    showToast(
      `Encontramos ${searchResultsCount} foto${searchResultsCount === 1 ? "" : "s"} con tu búsqueda.`,
      "success"
    );
  }, [
    enabled,
    searchResultsCount,
    searchLoading,
    pendingAllPhotosPack,
    showToast,
  ]);

  return { toast, showToast, dismissToast, scrollToPacks };
}
