/**
 * Capacidad social post-jurado (10F.0 / AI).
 * NO publica si DNX_SOCIAL_PUBLISHER_LIVE ≠ true.
 */

export type CarouselPublishPlan = {
  editionId: string;
  promptId: string;
  finalistEntryIds: string[];
  visibleNumbers: string[];
  votingHours: number;
};

export function planFinalistCarousel(input: CarouselPublishPlan): {
  canExecuteLive: boolean;
  reason: string;
  votingClosesAtIso: string | null;
  payload: CarouselPublishPlan & { kind: "CLICKATON_FINALIST_CAROUSEL" };
} {
  const live =
    (process.env.DNX_SOCIAL_PUBLISHER_LIVE ?? "").trim().toLowerCase() === "true";
  return {
    canExecuteLive: live,
    reason: live
      ? "LIVE_ENABLED"
      : "DNX_SOCIAL_PUBLISHER_LIVE_OFF — capacidad preparada, sin publicación real",
    votingClosesAtIso: null,
    payload: { ...input, kind: "CLICKATON_FINALIST_CAROUSEL" },
  };
}
