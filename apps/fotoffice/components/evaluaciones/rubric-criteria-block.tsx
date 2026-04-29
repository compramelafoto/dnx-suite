import type { MockRubricCriteria } from "./types";
import { RubricLevelButton } from "./rubric-level-button";

type RubricCriteriaBlockProps = {
  criteria: MockRubricCriteria;
  selectedLevelId: string | null;
  isActive: boolean;
  criteriaPosition: number;
  onSelectLevel: (criteriaId: string, levelId: string) => void;
};

export function RubricCriteriaBlock({
  criteria,
  selectedLevelId,
  isActive,
  criteriaPosition,
  onSelectLevel,
}: RubricCriteriaBlockProps) {
  return (
    <article
      className={[
        "fo-card space-y-4 p-4 md:p-5 transition-colors",
        isActive ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]/45" : "",
      ].join(" ")}
    >
      <header className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Criterio {criteriaPosition}
        </p>
        <h3 className="text-sm font-semibold text-[var(--fo-text)]">{criteria.title}</h3>
        <p className="text-xs text-[var(--fo-muted)]">Seleccioná un nivel para este criterio.</p>
      </header>
      <div className="grid gap-2">
        {criteria.levels.map((level, index) => (
          <RubricLevelButton
            key={level.id}
            label={level.label}
            score={level.score}
            selected={selectedLevelId === level.id}
            shortcut={isActive ? index + 1 : undefined}
            onClick={() => onSelectLevel(criteria.id, level.id)}
          />
        ))}
      </div>
    </article>
  );
}
