"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { PublicStudentIdentificationPlan } from "@/lib/preventa-canjeable/preventa-mode";

type PublicRosterRow = {
  id: number;
  studentId: number;
  albumRosterEntryId: number;
  firstName: string;
  lastName: string;
  level: string | null;
  shift: string | null;
  course: string | null;
  division: string;
};

type SelectedStudentSnapshot = {
  studentId: number;
  albumRosterEntryId: number;
  firstName: string;
  lastName: string;
  level: string;
  shift: string;
  course: string;
  division: string;
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type Props = {
  slug: string;
  plan: PublicStudentIdentificationPlan;
  selectedRosterEntryId: number | null;
  onSelectRosterEntry: (id: number | null) => void;
};

export default function PreventaSchoolStudentSection({
  slug,
  plan,
  selectedRosterEntryId,
  onSelectRosterEntry,
}: Props) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);

  const [entries, setEntries] = useState<PublicRosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SelectedStudentSnapshot | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    firstName: "",
    lastName: "",
    level: "",
    shift: "",
    courseName: "",
    division: "",
    externalStudentId: "",
    dni: "",
  });
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (plan.manualOnly) setManualOpen(true);
  }, [plan.manualOnly]);

  const normalizedQuery = useMemo(
    () => debouncedQ.trim().replace(/\s+/g, " "),
    [debouncedQ]
  );
  const canSearchByQuery = plan.showRosterSearch && normalizedQuery.length >= 3;

  const loadRoster = useCallback(async () => {
    if (!plan.showRosterSearch || !canSearchByQuery) {
      setEntries([]);
      setLoading(false);
      setListError(null);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const url = `/api/public/album/${encodeURIComponent(slug)}/student-roster/search?q=${encodeURIComponent(normalizedQuery)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo cargar el listado de alumnos"
        );
      }
      const list = Array.isArray(data) ? data : [];
      setEntries(list as PublicRosterRow[]);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Error al cargar");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [plan.showRosterSearch, slug, canSearchByQuery, normalizedQuery]);

  useEffect(() => {
    if (plan.showRosterSearch && canSearchByQuery) {
      void loadRoster();
      return;
    }
    if (plan.showRosterSearch) {
      setEntries([]);
      setListError(null);
      setLoading(false);
    }
  }, [plan.showRosterSearch, canSearchByQuery, loadRoster]);

  useEffect(() => {
    if (selectedRosterEntryId == null) {
      setSelectedSnapshot(null);
      return;
    }
    const row = entries.find((entry) => entry.albumRosterEntryId === selectedRosterEntryId);
    if (!row) return;
    setSelectedSnapshot({
      studentId: row.studentId,
      albumRosterEntryId: row.albumRosterEntryId,
      firstName: row.firstName,
      lastName: row.lastName,
      level: row.level || "",
      shift: row.shift || "",
      course: row.course || "",
      division: row.division || "",
    });
  }, [selectedRosterEntryId, entries]);

  async function submitManual(e: FormEvent) {
    e.preventDefault();
    setManualLoading(true);
    setManualError(null);
    try {
      const res = await fetch(`/api/public/album/${encodeURIComponent(slug)}/student-roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: manual.firstName.trim(),
          lastName: manual.lastName.trim(),
          level: manual.level.trim(),
          shift: manual.shift.trim(),
          courseName: manual.courseName.trim(),
          division: manual.division.trim(),
          externalStudentId: manual.externalStudentId.trim() || undefined,
          dni: manual.dni.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      }
      const id = data?.rosterEntry?.id;
      if (typeof id !== "number") throw new Error("Respuesta inválida del servidor");
      setSelectedSnapshot({
        studentId:
          typeof data?.rosterEntry?.studentId === "number"
            ? data.rosterEntry.studentId
            : -1,
        albumRosterEntryId: id,
        firstName:
          typeof data?.rosterEntry?.snapshotFirstName === "string"
            ? data.rosterEntry.snapshotFirstName
            : manual.firstName.trim(),
        lastName:
          typeof data?.rosterEntry?.snapshotLastName === "string"
            ? data.rosterEntry.snapshotLastName
            : manual.lastName.trim(),
        level:
          typeof data?.rosterEntry?.level === "string"
            ? data.rosterEntry.level
            : manual.level.trim(),
        shift:
          typeof data?.rosterEntry?.shift === "string"
            ? data.rosterEntry.shift
            : manual.shift.trim(),
        course:
          typeof data?.rosterEntry?.courseName === "string"
            ? data.rosterEntry.courseName
            : manual.courseName.trim(),
        division:
          typeof data?.rosterEntry?.division === "string"
            ? data.rosterEntry.division
            : manual.division.trim(),
      });
      onSelectRosterEntry(id);
      setManualOpen(false);
      if (plan.showRosterSearch && canSearchByQuery) await loadRoster();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Error");
    } finally {
      setManualLoading(false);
    }
  }

  const canUseManualOption = plan.manualOnly || plan.allowManualStudentFallback;
  const showManualBlock = plan.manualOnly || (canUseManualOption && manualOpen);

  return (
    <Card className="w-full min-w-0 max-w-6xl mx-auto border-[#e5e7eb] rounded-2xl p-6 sm:p-8 lg:p-9 shadow-md space-y-6 sm:space-y-7">
      <div className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a] leading-tight">Datos del alumno</h2>
        <p className="w-full max-w-none text-sm sm:text-[15px] text-[#4b5563] leading-relaxed">
          Asociamos tu compra al alumno correcto para cuando estén las fotos. Si el colegio cargó un listado, buscalo
          acá; si no aparece, podés cargar los datos a mano cuando el colegio lo permita.
        </p>
      </div>

      {plan.showRosterSearch && (
        <>
          <div className="rounded-2xl bg-[#fafafa] border border-[#e5e7eb] px-5 py-4 sm:px-6 sm:py-5">
            <h3 className="text-base font-semibold text-[#1a1a1a]">Selección desde listado de alumnos</h3>
            <p className="w-full max-w-none text-sm text-[#6b7280] mt-2 leading-relaxed">
              Escribí nombre o apellido para encontrar al alumno correcto.
            </p>
          </div>
          <div className="space-y-3">
            <label className="flex flex-col gap-2 w-full">
              <span className="text-sm font-medium text-[#374151]">Búsqueda</span>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscá por nombre o apellido del alumno"
                className="w-full min-h-[2.75rem] text-base"
                autoComplete="off"
              />
            </label>
            <p className="text-xs text-[#6b7280]">La búsqueda se activa a partir de 3 letras.</p>
          </div>

          {listError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 leading-relaxed">
              {listError}
            </p>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium text-[#374151]">Resultados</p>
            <div className="flex flex-col items-stretch gap-3 sm:gap-4">
              {normalizedQuery.length < 3 && (
                <div className="w-full rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fafafa] px-5 py-10 sm:py-12 text-center">
                  <p className="block w-full max-w-none whitespace-normal break-words text-[#6b7280] text-base leading-relaxed">
                    Escribí al menos 3 letras para buscar en el listado de alumnos.
                  </p>
                </div>
              )}
              {normalizedQuery.length >= 3 && loading && (
                <div className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-5 py-12 text-center text-[#6b7280] text-base">
                  Buscando…
                </div>
              )}
              {normalizedQuery.length >= 3 && !loading && entries.length === 0 && (
                <div className="w-full rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fafafa] px-5 py-10 sm:py-12 text-center">
                  <p className="block w-full max-w-none whitespace-normal break-words text-[#6b7280] text-base leading-relaxed">
                    No encontramos alumnos con ese nombre.
                  </p>
                </div>
              )}
              {entries.map((row) => {
                const selected = row.albumRosterEntryId === selectedRosterEntryId;
                const name = `${row.firstName} ${row.lastName}`.trim();
                const courseLine = [row.course, row.division].filter(Boolean).join(" ");
                const details = [courseLine || null, row.shift ? `Turno ${row.shift}` : null].filter(
                  Boolean
                );
                return (
                  <button
                    key={row.albumRosterEntryId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedSnapshot({
                        studentId: row.studentId,
                        albumRosterEntryId: row.albumRosterEntryId,
                        firstName: row.firstName,
                        lastName: row.lastName,
                        level: row.level || "",
                        shift: row.shift || "",
                        course: row.course || "",
                        division: row.division || "",
                      });
                      onSelectRosterEntry(row.albumRosterEntryId);
                    }}
                    className={cn(
                      "w-full text-left rounded-2xl border-2 p-4 sm:p-5 transition-all outline-none",
                      "focus-visible:ring-2 focus-visible:ring-[#c27b3d] focus-visible:ring-offset-2",
                      selected
                        ? "border-[#c27b3d] bg-[#fffbf7] shadow-md ring-2 ring-[#c27b3d]/20"
                        : "border-[#e5e7eb] bg-white hover:border-[#c27b3d]/45 hover:bg-[#fafafa] active:scale-[0.998]"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg sm:text-xl font-bold text-[#1a1a1a] leading-snug break-words">
                          {name}
                        </p>
                        <p className="mt-1 text-sm text-[#4b5563] break-words">
                          {details.length > 0 ? details.join(" - ") : "Sin datos escolares"}
                        </p>
                      </div>
                      <div className="shrink-0 flex sm:flex-col sm:items-end justify-end">
                        {selected ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#c27b3d] text-white text-sm font-semibold px-4 py-2 shadow-sm">
                            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Elegido para la compra
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border-2 border-[#c27b3d]/40 bg-white text-[#c27b3d] text-sm font-semibold px-4 py-2">
                            Tocá para elegir
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {canUseManualOption && !plan.manualOnly && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="text-base font-semibold text-[#c27b3d] hover:text-[#a6692f] hover:underline py-2 min-h-[44px] text-left"
                onClick={() => {
                  setManualOpen((v) => !v);
                  if (!manualOpen) setManualError(null);
                }}
              >
                {manualOpen ? "Cerrar carga manual del alumno" : "El alumno no está en el listado"}
              </button>
              <p className="w-full text-sm text-[#6b7280]">
                Usá esta opción solo si no encontrás al alumno en el listado.
              </p>
            </div>
          )}
        </>
      )}

      {showManualBlock && (
        <form
          onSubmit={submitManual}
          className="space-y-5 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-5 sm:p-7"
        >
          <p className="text-base font-semibold text-[#1a1a1a] leading-snug">
            {plan.manualOnly
              ? "Completá los datos del alumno"
              : "Carga manual — revisá con el colegio que curso y división sean correctos"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#374151]">Nombre</span>
              <Input
                required
                value={manual.firstName}
                onChange={(e) => setManual((m) => ({ ...m, firstName: e.target.value }))}
                disabled={manualLoading}
                className="min-h-[2.75rem]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#374151]">Apellido</span>
              <Input
                required
                value={manual.lastName}
                onChange={(e) => setManual((m) => ({ ...m, lastName: e.target.value }))}
                disabled={manualLoading}
                className="min-h-[2.75rem]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#374151]">Nivel</span>
              <Input
                required
                value={manual.level}
                onChange={(e) => setManual((m) => ({ ...m, level: e.target.value }))}
                disabled={manualLoading}
                className="min-h-[2.75rem]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#374151]">Turno</span>
              <Input
                required
                value={manual.shift}
                onChange={(e) => setManual((m) => ({ ...m, shift: e.target.value }))}
                disabled={manualLoading}
                className="min-h-[2.75rem]"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-[#374151]">Curso</span>
              <Input
                required
                value={manual.courseName}
                onChange={(e) => setManual((m) => ({ ...m, courseName: e.target.value }))}
                disabled={manualLoading}
                className="min-h-[2.75rem]"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-[#374151]">División</span>
              <Input
                required
                value={manual.division}
                onChange={(e) => setManual((m) => ({ ...m, division: e.target.value }))}
                disabled={manualLoading}
                className="min-h-[2.75rem]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#374151]">Legajo o ID del colegio (opcional)</span>
              <Input
                value={manual.externalStudentId}
                onChange={(e) => setManual((m) => ({ ...m, externalStudentId: e.target.value }))}
                disabled={manualLoading}
                className="min-h-[2.75rem]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#374151]">DNI (opcional)</span>
              <Input
                value={manual.dni}
                onChange={(e) => setManual((m) => ({ ...m, dni: e.target.value }))}
                disabled={manualLoading}
                className="min-h-[2.75rem]"
              />
            </label>
          </div>
          {manualError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 leading-relaxed">
              {manualError}
            </p>
          )}
          <Button
            type="submit"
            variant="secondary"
            disabled={manualLoading}
            className="w-full sm:w-auto sm:min-w-[16rem] min-h-[2.75rem] justify-center text-base font-semibold px-8"
          >
            {manualLoading ? "Guardando…" : "Confirmar datos del alumno"}
          </Button>
        </form>
      )}

      {selectedRosterEntryId != null && (
        <div className="rounded-2xl border-2 border-[#c27b3d] bg-[#fffbf7] p-5 sm:p-6 space-y-4 shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-base font-semibold text-[#1a1a1a]">Alumno confirmado para esta compra</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c27b3d] text-white text-xs font-bold uppercase tracking-wide px-3 py-1">
              OK
            </span>
          </div>
          {selectedSnapshot ? (
            <>
              <p className="text-xl sm:text-2xl font-bold text-[#1a1a1a] tracking-tight break-words">
                {selectedSnapshot.lastName}, {selectedSnapshot.firstName}
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/80 border border-[#c27b3d]/15 px-4 py-3">
                  <dt className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">Nivel</dt>
                  <dd className="mt-1 font-semibold text-[#374151]">{selectedSnapshot.level || "—"}</dd>
                </div>
                <div className="rounded-xl bg-white/80 border border-[#c27b3d]/15 px-4 py-3">
                  <dt className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">Turno</dt>
                  <dd className="mt-1 font-semibold text-[#374151]">{selectedSnapshot.shift || "—"}</dd>
                </div>
                <div className="rounded-xl bg-white/80 border border-[#c27b3d]/15 px-4 py-3 sm:col-span-2">
                  <dt className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">Curso</dt>
                  <dd className="mt-1 font-semibold text-[#374151]">{selectedSnapshot.course || "—"}</dd>
                </div>
                <div className="rounded-xl bg-white/80 border border-[#c27b3d]/15 px-4 py-3 sm:col-span-2">
                  <dt className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">División</dt>
                  <dd className="mt-1 font-semibold text-[#374151]">{selectedSnapshot.division || "—"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-base text-[#374151] leading-relaxed">
              Listo: guardamos los datos del alumno para este pedido. Más abajo completá los datos del adulto
              responsable.
            </p>
          )}
          <button
            type="button"
            className="text-base font-semibold text-[#c27b3d] hover:text-[#a6692f] underline-offset-2 hover:underline py-2 min-h-[44px]"
            onClick={() => onSelectRosterEntry(null)}
          >
            Cambiar alumno
          </button>
        </div>
      )}

      {plan.rosterEffectivelyRequired && selectedRosterEntryId == null && (
        <p className="text-base text-amber-950 bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4 leading-relaxed">
          Para continuar tenés que elegir un alumno del listado del colegio (tocá la tarjeta del alumno).
        </p>
      )}
    </Card>
  );
}
