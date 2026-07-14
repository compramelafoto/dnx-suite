"use client";

import { setHomeExperienceModeAction } from "@/app/actions/home-experience";
import type { PublicProfileType } from "@/lib/dnx-user-profiles";

const LABELS: Record<PublicProfileType, string> = {
  CUSTOMER: "Descubrir",
  PHOTOGRAPHER: "Fotógrafo",
  ORGANIZER: "Organizador",
};

type Props = {
  availableModes: PublicProfileType[];
  activeMode: PublicProfileType;
};

/**
 * Cambia el modo visual de Home sin alterar DnxUserProfile.
 */
export function HomeExperienceSwitcher({ availableModes, activeMode }: Props) {
  if (availableModes.length < 2) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Modo de inicio"
    >
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--is-muted)]">
        Ver como
      </span>
      <div className="flex flex-wrap gap-2">
        {availableModes.map((mode) => {
          const selected = mode === activeMode;
          return (
            <form key={mode} action={setHomeExperienceModeAction}>
              <input type="hidden" name="mode" value={mode} />
              <button
                type="submit"
                aria-pressed={selected}
                className={
                  selected
                    ? "inline-flex min-h-9 items-center rounded-full bg-[var(--is-text)] px-3.5 text-xs font-semibold text-[var(--is-white-0)]"
                    : "inline-flex min-h-9 items-center rounded-full px-3.5 text-xs font-semibold text-[var(--is-text-secondary)] ring-1 ring-[var(--is-border)] transition-colors hover:text-[var(--is-text)] hover:ring-[var(--is-graphite-400)]"
                }
              >
                {LABELS[mode]}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
