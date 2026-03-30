"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { DirectoryJudgeCardDto, DirectoryListFilters } from "../../../lib/fotorank/judges/professionalDirectory";
import {
  DashboardEmptyState,
  FilterField,
  FilterSidebarCard,
  TwoColumnToolLayout,
} from "../../../components/dashboard-patterns";

type Props = {
  initialItems: DirectoryJudgeCardDto[];
  totalApprox: number;
  initialFilters: DirectoryListFilters;
  initialPage: number;
};

export function DirectorioJuradosClient({ initialItems, totalApprox, initialFilters, initialPage }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    q: initialFilters.search ?? "",
    specialty: initialFilters.specialty ?? "",
    language: initialFilters.language ?? "",
    country: initialFilters.country ?? "",
    region: initialFilters.region ?? "",
    available: initialFilters.availableOnly ?? false,
    verified: initialFilters.verifiedOnly ?? false,
    minExp: initialFilters.minExperience != null ? String(initialFilters.minExperience) : "",
    pmin: initialFilters.priceMin != null ? String(initialFilters.priceMin) : "",
    pmax: initialFilters.priceMax != null ? String(initialFilters.priceMax) : "",
    compensation: initialFilters.compensation ?? "",
  });

  const apply = (page = 0) => {
    const p = new URLSearchParams();
    if (f.q.trim()) p.set("q", f.q.trim());
    if (f.specialty.trim()) p.set("specialty", f.specialty.trim());
    if (f.language.trim()) p.set("language", f.language.trim());
    if (f.country.trim()) p.set("country", f.country.trim());
    if (f.region.trim()) p.set("region", f.region.trim());
    if (f.available) p.set("available", "1");
    if (f.verified) p.set("verified", "1");
    if (f.minExp.trim()) p.set("minExp", f.minExp.trim());
    if (f.pmin.trim()) p.set("pmin", f.pmin.trim());
    if (f.pmax.trim()) p.set("pmax", f.pmax.trim());
    if (f.compensation) p.set("compensation", f.compensation);
    if (page > 0) p.set("page", String(page));
    start(() => router.push(`/jurados/directorio?${p.toString()}`));
  };

  const clear = () => {
    setF({
      q: "",
      specialty: "",
      language: "",
      country: "",
      region: "",
      available: false,
      verified: false,
      minExp: "",
      pmin: "",
      pmax: "",
      compensation: "",
    });
    start(() => router.push("/jurados/directorio"));
  };

  const pageSize = 24;
  const hasNext = (initialPage + 1) * pageSize < totalApprox;
  const hasPrev = initialPage > 0;

  const compLabel = useMemo(
    () =>
      ({
        VOLUNTEER: "Ad honorem",
        PAID: "Pago",
        BOTH: "Mixto",
      }) as Record<string, string>,
    []
  );

  const hasActiveFilters = useMemo(() => {
    return (
      f.q.trim() !== "" ||
      f.specialty.trim() !== "" ||
      f.language.trim() !== "" ||
      f.country.trim() !== "" ||
      f.region.trim() !== "" ||
      f.available ||
      f.verified ||
      f.minExp.trim() !== "" ||
      f.pmin.trim() !== "" ||
      f.pmax.trim() !== "" ||
      f.compensation !== ""
    );
  }, [f]);

  const filterSidebar = (
    <FilterSidebarCard
      title="Filtros"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={() => apply(0)}
            className="fr-btn fr-btn-primary min-h-11 flex-1 text-sm"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            disabled={pending || !hasActiveFilters}
            onClick={clear}
            className="fr-btn fr-btn-secondary min-h-11 flex-1 text-sm"
          >
            Limpiar todo
          </button>
        </div>
      }
    >
      <FilterField label="Búsqueda" id="dir-q">
        <input
          id="dir-q"
          className="fr-filter-input"
          placeholder="Nombre, headline…"
          value={f.q}
          onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))}
          autoComplete="off"
        />
      </FilterField>
      <FilterField label="Especialidad" id="dir-spec">
        <input
          id="dir-spec"
          className="fr-filter-input"
          placeholder="Ej. retrato, documental"
          value={f.specialty}
          onChange={(e) => setF((s) => ({ ...s, specialty: e.target.value }))}
          autoComplete="off"
        />
      </FilterField>
      <FilterField label="Idioma" id="dir-lang">
        <input
          id="dir-lang"
          className="fr-filter-input"
          placeholder="Ej. Español"
          value={f.language}
          onChange={(e) => setF((s) => ({ ...s, language: e.target.value }))}
          autoComplete="off"
        />
      </FilterField>
      <FilterField label="País" id="dir-country">
        <input
          id="dir-country"
          className="fr-filter-input"
          placeholder="Código o nombre"
          value={f.country}
          onChange={(e) => setF((s) => ({ ...s, country: e.target.value }))}
          autoComplete="off"
        />
      </FilterField>
      <FilterField label="Región" id="dir-region">
        <input
          id="dir-region"
          className="fr-filter-input"
          placeholder="Opcional"
          value={f.region}
          onChange={(e) => setF((s) => ({ ...s, region: e.target.value }))}
          autoComplete="off"
        />
      </FilterField>
      <FilterField label="Compensación" id="dir-comp">
        <select
          id="dir-comp"
          className="fr-filter-select w-full bg-fr-bg py-2 text-sm text-fr-primary"
          value={f.compensation}
          onChange={(e) => setF((s) => ({ ...s, compensation: e.target.value }))}
        >
          <option value="">Cualquiera</option>
          <option value="VOLUNTEER">Ad honorem</option>
          <option value="PAID">Pago</option>
          <option value="BOTH">Mixto</option>
        </select>
      </FilterField>
      <FilterField label="Experiencia mínima (años)" id="dir-exp">
        <input
          id="dir-exp"
          type="number"
          min={0}
          className="fr-filter-input"
          placeholder="0"
          value={f.minExp}
          onChange={(e) => setF((s) => ({ ...s, minExp: e.target.value }))}
        />
      </FilterField>
      <div className="grid grid-cols-2 gap-3">
        <FilterField label="Precio min" id="dir-pmin">
          <input
            id="dir-pmin"
            inputMode="decimal"
            className="fr-filter-input"
            placeholder="—"
            value={f.pmin}
            onChange={(e) => setF((s) => ({ ...s, pmin: e.target.value }))}
          />
        </FilterField>
        <FilterField label="Precio max" id="dir-pmax">
          <input
            id="dir-pmax"
            inputMode="decimal"
            className="fr-filter-input"
            placeholder="—"
            value={f.pmax}
            onChange={(e) => setF((s) => ({ ...s, pmax: e.target.value }))}
          />
        </FilterField>
      </div>
      <div className="flex flex-col gap-4 border-t border-fr-border/60 pt-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-fr-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-fr-border bg-fr-bg text-gold focus:ring-gold/30"
            checked={f.available}
            onChange={(e) => setF((s) => ({ ...s, available: e.target.checked }))}
          />
          Solo disponibles para jurar
        </label>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-fr-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-fr-border bg-fr-bg text-gold focus:ring-gold/30"
            checked={f.verified}
            onChange={(e) => setF((s) => ({ ...s, verified: e.target.checked }))}
          />
          Solo verificados por plataforma
        </label>
      </div>
    </FilterSidebarCard>
  );

  const resultsMain = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-fr-border/50 pb-4">
        <p className="text-sm text-fr-muted">
          {totalApprox === 0 ? (
            <span className="text-fr-muted-soft">Ningún resultado con los filtros actuales</span>
          ) : (
            <>
              <span className="font-medium text-fr-primary">~{totalApprox}</span>{" "}
              {totalApprox === 1 ? "perfil" : "perfiles"}
              {initialPage > 0 ? (
                <span className="text-fr-muted-soft"> · página {initialPage + 1}</span>
              ) : null}
            </>
          )}
        </p>
      </div>

      {initialItems.length === 0 ? (
        <DashboardEmptyState
          icon={SearchX}
          title="No hay coincidencias"
          description={
            hasActiveFilters
              ? "Probá ampliar la búsqueda, quitá filtros o cambiá el criterio de compensación. Los jurados solo aparecen si eligieron visibilidad en el directorio."
              : "Todavía no hay jurados listados en el directorio para esta organización. Cuando existan perfiles públicos, los verás aquí."
          }
          primaryAction={
            <button
              type="button"
              onClick={clear}
              disabled={pending || !hasActiveFilters}
              className="fr-btn fr-btn-primary min-h-11 flex-1 justify-center px-6 text-sm disabled:cursor-not-allowed disabled:opacity-55"
            >
              Limpiar filtros
            </button>
          }
          secondaryAction={
            <Link
              href="/jurados"
              className="fr-btn fr-btn-secondary min-h-11 flex-1 justify-center px-6 text-sm"
            >
              Volver a Jurados
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {initialItems.map((j) => (
            <li
              key={j.judgeAccountId}
              className="group flex flex-col rounded-xl border border-fr-border bg-fr-card p-6 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-fr-border-muted hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-fr-border bg-fr-bg">
                  {j.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={j.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-fr-muted">—</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-fr-primary">{j.displayName}</h3>
                  {j.headline ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fr-muted">{j.headline}</p>
                  ) : null}
                </div>
              </div>
              {j.specialties.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {j.specialties.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-fr-border/80 bg-fr-bg px-2.5 py-0.5 text-xs text-fr-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 space-y-1.5 border-t border-fr-border/50 pt-4 text-xs text-fr-muted">
                <p>
                  <span className="text-fr-primary">{compLabel[j.compensationMode] ?? j.compensationMode}</span>
                  {j.pricingSummary ? ` · ${j.pricingSummary}` : null}
                </p>
                <p>{j.isAvailableForJuryWork ? "Disponible" : "No disponible"}</p>
                {j.isVerifiedByPlatform ? <p className="text-gold">Verificado</p> : null}
                <p className="text-fr-muted-soft">Concursos completados: {j.completedAssignments}</p>
              </div>
              <Link
                href={`/jurados/directorio/${j.judgeAccountId}`}
                className="fr-btn fr-btn-primary mt-6 w-full justify-center text-sm"
              >
                Ver perfil
              </Link>
            </li>
          ))}
        </ul>
      )}

      {initialItems.length > 0 ? (
        <div className="flex flex-wrap gap-3 border-t border-fr-border/50 pt-6">
          {hasPrev ? (
            <button
              type="button"
              disabled={pending}
              className="fr-btn fr-btn-secondary min-h-11 text-sm"
              onClick={() => apply(initialPage - 1)}
            >
              Anterior
            </button>
          ) : null}
          {hasNext ? (
            <button
              type="button"
              disabled={pending}
              className="fr-btn fr-btn-secondary min-h-11 text-sm"
              onClick={() => apply(initialPage + 1)}
            >
              Siguiente
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="fr-dashboard-page-shell">
      <TwoColumnToolLayout sidebar={filterSidebar}>{resultsMain}</TwoColumnToolLayout>
    </div>
  );
}
