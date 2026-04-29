"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mockCriteria, mockStudents } from "./mock-data";
import { StudentList, type StudentQuickFilter } from "./student-list";
import { RubricCriteriaBlock } from "./rubric-criteria-block";
import { EvaluationSummary } from "./evaluation-summary";
import type { StudentProgressStatus } from "./types";

type MassGradingScreenProps = {
  contextId: string;
  activityId: string;
};

type StudentSelections = Record<string, Record<string, string>>;
type ReviewedByStudent = Record<string, boolean>;

function getCriteriaMap() {
  return new Map(mockCriteria.map((criteria) => [criteria.id, criteria]));
}

function getLevelMap() {
  const levels = mockCriteria.flatMap((criteria) =>
    criteria.levels.map((level) => ({ ...level, criteriaId: criteria.id })),
  );
  return new Map(levels.map((level) => [level.id, level]));
}

export function MassGradingScreen({ contextId, activityId }: MassGradingScreenProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(mockStudents[0]?.id ?? "");
  const [selectionsByStudent, setSelectionsByStudent] = useState<StudentSelections>({});
  const [reviewedByStudent, setReviewedByStudent] = useState<ReviewedByStudent>({});
  const [activeCriteriaIndex, setActiveCriteriaIndex] = useState(0);
  const [feedbackActionStatus, setFeedbackActionStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<StudentQuickFilter>("all");
  const criteriaItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const criteriaMap = useMemo(() => getCriteriaMap(), []);
  const levelMap = useMemo(() => getLevelMap(), []);
  const totalCriteria = mockCriteria.length;

  const progressByStudent = useMemo(() => {
    const out: Record<string, { done: number; status: StudentProgressStatus; reviewed: boolean }> = {};
    for (const student of mockStudents) {
      const done = Object.keys(selectionsByStudent[student.id] ?? {}).length;
      const status: StudentProgressStatus = done === 0 ? "empty" : done === totalCriteria ? "complete" : "partial";
      out[student.id] = {
        done,
        status,
        reviewed: reviewedByStudent[student.id] === true,
      };
    }
    return out;
  }, [reviewedByStudent, selectionsByStudent, totalCriteria]);

  const completedStudents = useMemo(() => {
    return Object.values(progressByStudent).filter((item) => item.status === "complete").length;
  }, [progressByStudent]);
  const completionPercent = Math.round((completedStudents / Math.max(mockStudents.length, 1)) * 100);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return mockStudents.filter((student) => {
      const progress = progressByStudent[student.id];
      if (!progress) return false;
      if (normalizedQuery && !student.fullName.toLowerCase().includes(normalizedQuery)) return false;
      if (quickFilter === "pending") return progress.status !== "complete";
      if (quickFilter === "partial") return progress.status === "partial";
      if (quickFilter === "complete") return progress.status === "complete";
      if (quickFilter === "reviewed") return progress.reviewed;
      return true;
    });
  }, [progressByStudent, quickFilter, searchQuery]);

  const selectedStudent = filteredStudents.find((student) => student.id === selectedStudentId)
    ?? mockStudents.find((student) => student.id === selectedStudentId)
    ?? null;
  const selectedStudentSelections = selectionsByStudent[selectedStudentId] ?? {};
  const selectedStudentIndex = filteredStudents.findIndex((student) => student.id === selectedStudentId);
  const activeCriteria = mockCriteria[activeCriteriaIndex] ?? null;

  const findFirstIncompleteCriteriaIndex = useCallback(
    (studentId: string) => {
      const selections = selectionsByStudent[studentId] ?? {};
      const incompleteIndex = mockCriteria.findIndex((criteria) => !selections[criteria.id]);
      return incompleteIndex === -1 ? 0 : incompleteIndex;
    },
    [selectionsByStudent],
  );

  const selectStudentByIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= filteredStudents.length) return;
      const student = filteredStudents[nextIndex];
      if (!student) return;
      setSelectedStudentId(student.id);
      setActiveCriteriaIndex(findFirstIncompleteCriteriaIndex(student.id));
    },
    [filteredStudents, findFirstIncompleteCriteriaIndex],
  );

  useEffect(() => {
    if (filteredStudents.length === 0) return;
    const isSelectedVisible = filteredStudents.some((student) => student.id === selectedStudentId);
    if (isSelectedVisible) return;
    const fallback = filteredStudents[0];
    if (!fallback) return;
    setSelectedStudentId(fallback.id);
    setActiveCriteriaIndex(findFirstIncompleteCriteriaIndex(fallback.id));
  }, [filteredStudents, findFirstIncompleteCriteriaIndex, selectedStudentId]);
  const selectedProgress = progressByStudent[selectedStudentId];
  const selectedDone = selectedProgress?.done ?? 0;
  const selectedComplete = selectedDone === totalCriteria;
  const selectedReviewed = selectedProgress?.reviewed === true;
  const selectedStudentGlobalIndex = mockStudents.findIndex((student) => student.id === selectedStudentId);
  const remainingCriteria = Math.max(totalCriteria - selectedDone, 0);

  const currentScore = useMemo(() => {
    return Object.values(selectedStudentSelections).reduce((acc, levelId) => {
      const level = levelMap.get(levelId);
      return acc + (level?.score ?? 0);
    }, 0);
  }, [selectedStudentSelections, levelMap]);

  const maxScore = useMemo(() => {
    return mockCriteria.reduce((acc, criteria) => {
      const maxForCriteria = Math.max(...criteria.levels.map((level) => level.score));
      return acc + maxForCriteria;
    }, 0);
  }, []);

  const generatedFeedback = useMemo(() => {
    const lines: string[] = [];
    for (const criteriaId of Object.keys(selectedStudentSelections)) {
      const selectedLevel = levelMap.get(selectedStudentSelections[criteriaId] ?? "");
      const criteria = criteriaMap.get(criteriaId);
      if (!selectedLevel || !criteria) continue;
      lines.push(`${criteria.title}: ${selectedLevel.feedbackText}`);
    }
    return lines.join("\n");
  }, [selectedStudentSelections, criteriaMap, levelMap]);

  const moveToNextCriteria = useCallback(() => {
    setActiveCriteriaIndex((prev) => Math.min(prev + 1, totalCriteria - 1));
  }, [totalCriteria]);

  const moveToPrevCriteria = useCallback(() => {
    setActiveCriteriaIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSelectLevel = useCallback((criteriaId: string, levelId: string) => {
    if (!selectedStudentId) return;
    setSelectionsByStudent((prev) => ({
      ...prev,
      [selectedStudentId]: {
        ...(prev[selectedStudentId] ?? {}),
        [criteriaId]: levelId,
      },
    }));
    setReviewedByStudent((prev) => ({ ...prev, [selectedStudentId]: false }));
    setFeedbackActionStatus(null);
    setTimeout(() => {
      setActiveCriteriaIndex((prev) => Math.min(prev + 1, totalCriteria - 1));
    }, 0);
  }, [selectedStudentId, totalCriteria]);

  const goToPreviousStudent = useCallback(() => {
    if (selectedStudentIndex <= 0) return;
    selectStudentByIndex(selectedStudentIndex - 1);
  }, [selectStudentByIndex, selectedStudentIndex]);

  const goToNextStudent = useCallback(() => {
    if (selectedStudentIndex < 0 || selectedStudentIndex >= filteredStudents.length - 1) return;
    selectStudentByIndex(selectedStudentIndex + 1);
  }, [filteredStudents.length, selectStudentByIndex, selectedStudentIndex]);

  const handleCopyFeedback = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedFeedback || "");
      setFeedbackActionStatus("Devolución copiada al portapapeles.");
    } catch {
      setFeedbackActionStatus("No se pudo copiar la devolución.");
    }
  }, [generatedFeedback]);

  const handleMarkReviewed = useCallback(() => {
    if (!selectedStudentId || !selectedComplete) return;
    setReviewedByStudent((prev) => ({ ...prev, [selectedStudentId]: true }));
    setFeedbackActionStatus("Alumno marcado como revisado.");
    if (selectedStudentIndex >= 0 && selectedStudentIndex < filteredStudents.length - 1) {
      selectStudentByIndex(selectedStudentIndex + 1);
    }
  }, [filteredStudents.length, selectedComplete, selectedStudentId, selectedStudentIndex, selectStudentByIndex]);

  const handleClearStudentCorrection = useCallback(() => {
    if (!selectedStudentId) return;
    const confirmed = window.confirm("¿Limpiar toda la corrección de este alumno?");
    if (!confirmed) return;
    setSelectionsByStudent((prev) => ({
      ...prev,
      [selectedStudentId]: {},
    }));
    setReviewedByStudent((prev) => ({ ...prev, [selectedStudentId]: false }));
    setActiveCriteriaIndex(0);
    setFeedbackActionStatus("Corrección del alumno limpiada.");
  }, [selectedStudentId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        goToPreviousStudent();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        goToNextStudent();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        if (event.shiftKey) {
          moveToPrevCriteria();
        } else {
          moveToNextCriteria();
        }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        moveToNextCriteria();
        return;
      }

      const parsedNumber = Number(event.key);
      if (!Number.isInteger(parsedNumber) || parsedNumber < 1 || parsedNumber > 4) return;
      if (!activeCriteria) return;
      const level = activeCriteria.levels[parsedNumber - 1];
      if (!level) return;
      event.preventDefault();
      handleSelectLevel(activeCriteria.id, level.id);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeCriteria,
    goToNextStudent,
    goToPreviousStudent,
    handleSelectLevel,
    moveToNextCriteria,
    moveToPrevCriteria,
  ]);

  useEffect(() => {
    if (!activeCriteria) return;
    const node = criteriaItemRefs.current[activeCriteria.id];
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeCriteria]);

  return (
    <div className="space-y-6">
      <div className="fo-card space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Contexto</p>
            <p className="text-sm font-semibold text-[var(--fo-text)]">{contextId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Actividad</p>
            <p className="text-sm font-semibold text-[var(--fo-text)]">{activityId}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">Progreso general</p>
            <p className="text-xs text-[var(--fo-muted)]">
              {completedStudents}/{mockStudents.length} completos ({completionPercent}%)
            </p>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--fo-surface-muted)]">
            <div
              className="h-2 rounded-full bg-[var(--fo-accent)] transition-all"
              style={{ width: `${completionPercent}%` }}
              aria-hidden
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <StudentList
          students={filteredStudents}
          selectedStudentId={selectedStudentId}
          progressByStudent={progressByStudent}
          totalCriteria={totalCriteria}
          searchQuery={searchQuery}
          quickFilter={quickFilter}
          onSearchQueryChange={(value) => {
            setSearchQuery(value);
            setFeedbackActionStatus(null);
          }}
          onQuickFilterChange={(value) => {
            setQuickFilter(value);
            setFeedbackActionStatus(null);
          }}
          onSelectStudent={(studentId) => {
            setSelectedStudentId(studentId);
            setActiveCriteriaIndex(findFirstIncompleteCriteriaIndex(studentId));
            setFeedbackActionStatus(null);
          }}
        />

        <section className="fo-card space-y-5 p-4 md:p-5">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">Alumno actual</p>
            <h2 className="text-xl font-semibold text-[var(--fo-text)]">
              {selectedStudent?.fullName ?? "Seleccioná un alumno"}
            </h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Corrección rápida por rúbrica: elegí niveles y avanzá al siguiente alumno.
            </p>
            <p className="text-xs font-medium text-[var(--fo-text-secondary)]">
              Alumno {selectedStudentGlobalIndex >= 0 ? selectedStudentGlobalIndex + 1 : 0} de {mockStudents.length}
            </p>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="fo-btn fo-btn-secondary text-sm min-h-9"
              onClick={goToPreviousStudent}
              disabled={selectedStudentIndex <= 0}
            >
              Alumno anterior
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-primary text-sm min-h-9"
              onClick={goToNextStudent}
              disabled={!selectedComplete || selectedStudentIndex >= filteredStudents.length - 1}
            >
              Siguiente alumno
            </button>
            <span className="text-xs text-[var(--fo-muted)]">
              {selectedComplete ? "Listo para revisar" : `Faltan ${remainingCriteria} criterios`}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {mockCriteria.map((criteria) => {
              const levelId = selectedStudentSelections[criteria.id] ?? null;
              const level = levelId ? levelMap.get(levelId) : null;
              const isActive = activeCriteria?.id === criteria.id;
              return (
                <div
                  key={criteria.id}
                  className={[
                    "rounded-[var(--fo-radius-sm)] border bg-[var(--fo-bg-elevated)] p-3",
                    isActive ? "border-[var(--fo-accent)]" : "border-[var(--fo-border)]",
                  ].join(" ")}
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">{criteria.title}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--fo-text)]">
                    {level ? `${level.label} (${level.score})` : "Pendiente"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
            {mockCriteria.map((criteria) => (
              <div
                key={criteria.id}
                ref={(node) => {
                  criteriaItemRefs.current[criteria.id] = node;
                }}
              >
                <RubricCriteriaBlock
                  criteria={criteria}
                  selectedLevelId={selectedStudentSelections[criteria.id] ?? null}
                  isActive={activeCriteria?.id === criteria.id}
                  criteriaPosition={mockCriteria.findIndex((item) => item.id === criteria.id) + 1}
                  onSelectLevel={handleSelectLevel}
                />
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4 xl:self-start">
          <EvaluationSummary
            student={selectedStudent}
            score={currentScore}
            maxScore={maxScore}
            feedback={generatedFeedback}
            progressLabel={`Alumno ${selectedStudentGlobalIndex >= 0 ? selectedStudentGlobalIndex + 1 : 0} de ${mockStudents.length}`}
            remainingCriteria={remainingCriteria}
            readyToReview={selectedComplete}
            canMarkReviewed={selectedComplete}
            reviewed={selectedReviewed}
            onCopyFeedback={handleCopyFeedback}
            onMarkReviewed={handleMarkReviewed}
            onClearStudentCorrection={handleClearStudentCorrection}
          />
          <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] px-3 py-2 text-xs text-[var(--fo-muted)]">
            Atajos: ↑/↓ cambia alumno, 1-4 selecciona nivel, Enter/Tab siguiente criterio, Shift+Tab criterio anterior.
          </div>
          {feedbackActionStatus ? (
            <p className="text-xs font-medium text-[var(--fo-text-secondary)]">{feedbackActionStatus}</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
