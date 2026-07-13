"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commitEditorialAssistantAction } from "@/app/actions/editorial-assistant";
import { AssistantTimeline } from "@/components/redaccion/editorial-assistant/assistant-timeline";
import { StepIntent } from "@/components/redaccion/editorial-assistant/step-intent";
import { StepEvent } from "@/components/redaccion/editorial-assistant/step-event";
import { StepMaterial } from "@/components/redaccion/editorial-assistant/step-material";
import { StepPhotos } from "@/components/redaccion/editorial-assistant/step-photos";
import { StepDraft } from "@/components/redaccion/editorial-assistant/step-draft";
import { StepSummary } from "@/components/redaccion/editorial-assistant/step-summary";
import {
  clearAssistantState,
  createEmptyAssistantState,
  entryStepForIntent,
  hasPendingAssistantWork,
  loadAssistantState,
  materialSummary,
  mergeAssistantState,
  nextStep,
  prevStep,
  saveAssistantState,
  type AssistantBootstrap,
  type AssistantCoverageCard,
  type AssistantEventCard,
  type AssistantIntent,
  type EditorialAssistantState,
  type SelectedCoverage,
} from "@/lib/editorial-assistant";

type DeepLink = {
  intent?: AssistantIntent | null;
  eventId?: number | null;
  coverageIds?: string[];
  articleId?: string | null;
  mode?: "full" | "photos";
};

type Props = {
  bootstrap: AssistantBootstrap;
  deepLink?: DeepLink;
};

function coverageToSelected(c: AssistantCoverageCard): SelectedCoverage {
  return { ...c };
}

export function EditorialAssistant({ bootstrap, deepLink }: Props) {
  const router = useRouter();
  const [state, setState] = useState<EditorialAssistantState>(() =>
    createEmptyAssistantState({
      draft: {
        title: "",
        excerpt: "",
        authorByline: bootstrap.authorDefault,
        storyType: null,
      },
    }),
  );
  const [hydrated, setHydrated] = useState(false);
  const [showPendingPrompt, setShowPendingPrompt] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<EditorialAssistantState | null>(
    null,
  );
  const [commitError, setCommitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const persist = useCallback((next: EditorialAssistantState) => {
    setState(next);
    saveAssistantState(next);
  }, []);

  const patch = useCallback(
    (partial: Partial<EditorialAssistantState>) => {
      setState((prev) => {
        const next = mergeAssistantState(prev, partial);
        saveAssistantState(next);
        return next;
      });
    },
    [],
  );

  // Hydrate + deep links
  useEffect(() => {
    const saved = loadAssistantState();
    const hasPending = hasPendingAssistantWork(saved);

    if (deepLink?.mode === "photos" && deepLink.articleId) {
      const coverageCards = bootstrap.coverages.filter((c) =>
        deepLink.coverageIds?.length
          ? deepLink.coverageIds.includes(c.id)
          : true,
      );
      const seeded = createEmptyAssistantState({
        step: "photos",
        intent: "coverage",
        existingArticleId: deepLink.articleId,
        coverages: (deepLink.coverageIds?.length
          ? coverageCards
          : bootstrap.coverages.slice(0, 1)
        ).map(coverageToSelected),
        draft: {
          title: "Material adicional",
          excerpt: "",
          authorByline: bootstrap.authorDefault,
          storyType: "galeria",
        },
      });
      persist(seeded);
      setHydrated(true);
      return;
    }

    if (deepLink?.intent || deepLink?.eventId || deepLink?.coverageIds?.length) {
      const intent = deepLink.intent ?? (deepLink.coverageIds?.length ? "coverage" : "event");
      const eventCard =
        deepLink.eventId != null
          ? bootstrap.events.find((e) => e.id === deepLink.eventId) ?? null
          : null;
      const selectedCoverages = (
        deepLink.coverageIds?.length
          ? bootstrap.coverages.filter((c) => deepLink.coverageIds!.includes(c.id))
          : deepLink.eventId != null
            ? bootstrap.coverages.filter((c) => c.clfEventId === deepLink.eventId)
            : []
      ).map(coverageToSelected);

      let step = entryStepForIntent(intent === "pending" ? "event" : intent);
      if (selectedCoverages.length > 0 && intent !== "independent") {
        step = "material";
      }
      if (deepLink.coverageIds?.length && intent === "coverage") {
        step = "material";
      }

      persist(
        createEmptyAssistantState({
          step,
          intent: intent === "pending" ? "event" : intent,
          event: eventCard,
          coverages: selectedCoverages,
          draft: {
            title: eventCard?.title ? `${eventCard.title}` : "",
            excerpt: "",
            authorByline: bootstrap.authorDefault,
            storyType: intent === "gallery" ? "galeria" : intent === "coverage" ? "cobertura" : null,
          },
        }),
      );
      setHydrated(true);
      return;
    }

    if (hasPending && saved) {
      setPendingSnapshot(saved);
      setShowPendingPrompt(true);
    }
    setHydrated(true);
  }, [bootstrap, deepLink, persist]);

  // Autosave continuo
  useEffect(() => {
    if (!hydrated) return;
    saveAssistantState(state);
  }, [state, hydrated]);

  const goNext = () => {
    const n = nextStep(state.intent, state.step);
    if (n) patch({ step: n });
  };

  const goBack = () => {
    const p = prevStep(state.intent, state.step);
    if (p) patch({ step: p });
  };

  const selectIntent = (intent: Exclude<AssistantIntent, "pending">) => {
    patch({
      intent,
      step: entryStepForIntent(intent),
      event: intent === "independent" ? null : state.event,
      coverages: intent === "independent" ? [] : state.coverages,
      photos: intent === "independent" ? [] : state.photos,
      draft: {
        ...state.draft,
        storyType:
          intent === "gallery"
            ? "galeria"
            : intent === "coverage"
              ? "cobertura"
              : state.draft.storyType,
      },
    });
  };

  const toggleCoverage = (c: AssistantCoverageCard) => {
    const exists = state.coverages.some((x) => x.id === c.id);
    const coverages = exists
      ? state.coverages.filter((x) => x.id !== c.id)
      : [...state.coverages, coverageToSelected(c)];
    patch({ coverages, photos: state.photos.filter((p) => coverages.some((cov) => cov.id === p.coverageId || cov.clfAlbumId === p.albumId)) });
  };

  const autofill = useMemo(() => {
    const summary = materialSummary(
      state.coverages.map((c) => ({
        ...c,
        photographerNames: c.photographerNames,
      })),
    );
    return {
      eventTitle: state.event?.title ?? state.coverages[0]?.eventTitle ?? null,
      city: state.event?.city ?? state.coverages[0]?.city ?? null,
      photographers: summary.photographerNames,
      coverages: state.coverages.map((c) => c.title),
      materialSummary: `${summary.coverageCount} coberturas · ${summary.photoCount} fotografías`,
    };
  }, [state.coverages, state.event]);

  const commit = (openEditor: boolean) => {
    setCommitError(null);
    startTransition(async () => {
      const intent =
        state.intent === "pending" || !state.intent ? "independent" : state.intent;
      const result = await commitEditorialAssistantAction({
        intent,
        title: state.draft.title,
        excerpt: state.draft.excerpt,
        authorByline: state.draft.authorByline,
        storyType: state.draft.storyType,
        eventId: state.event?.id ?? null,
        coverageIds: state.coverages.map((c) => c.id),
        photos: state.photos.map((p) => ({
          clfPhotoId: p.clfPhotoId,
          albumId: p.albumId,
          coverageId: p.coverageId,
          role: p.role,
        })),
        existingArticleId: state.existingArticleId,
      });
      if (!result.ok) {
        setCommitError(result.error);
        return;
      }
      clearAssistantState();
      if (openEditor) {
        router.push(`/redaccion/noticias/${result.articleId}/editar?from=asistente`);
      } else {
        router.push(
          `/redaccion/bandeja?vista=borradores&ok=${encodeURIComponent("Trabajo guardado. Podés continuar cuando quieras.")}`,
        );
      }
    });
  };

  if (!hydrated) {
    return (
      <div className="animate-pulse space-y-4 py-12" aria-busy="true">
        <div className="h-8 w-64 rounded bg-[var(--is-bg-muted)]" />
        <div className="h-40 rounded bg-[var(--is-bg-muted)]" />
      </div>
    );
  }

  return (
    <div className="relative">
      {showPendingPrompt && pendingSnapshot ? (
        <div
          className="mb-8 rounded-[var(--is-radius-md)] border border-[var(--is-accent)] bg-[var(--is-accent)]/5 p-5"
          role="region"
          aria-label="Trabajo pendiente"
        >
          <p className="font-[family-name:var(--font-source-serif)] text-lg font-semibold">
            Tenés un trabajo pendiente.
          </p>
          <p className="mt-2 text-sm text-[var(--is-muted)]">
            Guardamos evento, material y fotografías. ¿Continuamos?
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="min-h-11 rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
              onClick={() => {
                persist(pendingSnapshot);
                setShowPendingPrompt(false);
              }}
            >
              Continuar
            </button>
            <button
              type="button"
              className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
              onClick={() => {
                clearAssistantState();
                setPendingSnapshot(null);
                setShowPendingPrompt(false);
                persist(
                  createEmptyAssistantState({
                    draft: {
                      title: "",
                      excerpt: "",
                      authorByline: bootstrap.authorDefault,
                      storyType: null,
                    },
                  }),
                );
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-muted)]">
            Asistente
          </p>
          <AssistantTimeline
            intent={state.intent}
            current={state.step}
            onJump={(step) => patch({ step })}
          />
        </aside>

        <div className="min-w-0">
          {state.step === "intent" ? (
            <StepIntent onSelect={selectIntent} />
          ) : null}

          {state.step === "event" ? (
            <StepEvent
              events={bootstrap.events}
              selectedId={state.event?.id ?? null}
              onSelect={(event: AssistantEventCard) => {
                const related = bootstrap.coverages
                  .filter((c) => c.clfEventId === event.id)
                  .map(coverageToSelected);
                patch({
                  event,
                  coverages: related.length ? related : state.coverages,
                  draft: {
                    ...state.draft,
                    title: state.draft.title || event.title,
                  },
                });
              }}
              onBack={goBack}
              onContinue={goNext}
            />
          ) : null}

          {state.step === "material" ? (
            <StepMaterial
              coverages={bootstrap.coverages}
              selectedIds={state.coverages.map((c) => c.id)}
              eventId={state.event?.id ?? null}
              onToggle={toggleCoverage}
              onBack={goBack}
              onContinue={goNext}
              allowSkip={state.intent === "independent" || state.intent === "event"}
              onSkip={() => patch({ step: "draft", coverages: [], photos: [] })}
            />
          ) : null}

          {state.step === "photos" ? (
            <StepPhotos
              coverages={state.coverages}
              selected={state.photos}
              onChange={(photos) => patch({ photos })}
              onBack={goBack}
              onContinue={() => {
                if (state.existingArticleId) {
                  commit(true);
                  return;
                }
                goNext();
              }}
              continueLabel={
                state.existingArticleId ? "Volver al editor" : "Preparar borrador"
              }
            />
          ) : null}

          {state.step === "draft" ? (
            <StepDraft
              draft={state.draft}
              autofill={autofill}
              onChange={(draftPatch) =>
                patch({ draft: { ...state.draft, ...draftPatch } })
              }
              onBack={goBack}
              onContinue={goNext}
            />
          ) : null}

          {state.step === "summary" ? (
            <StepSummary
              state={state}
              pending={pending}
              error={commitError}
              onBack={goBack}
              onOpenEditor={() => commit(true)}
              onSaveForLater={() => commit(false)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
