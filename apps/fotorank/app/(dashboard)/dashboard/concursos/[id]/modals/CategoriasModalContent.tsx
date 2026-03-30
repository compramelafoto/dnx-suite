"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  FormField,
  FormSection,
  IconButton,
  radius,
  spacing,
  Text,
  useResolvedTheme,
} from "@repo/design-system";
import {
  addContestCategoryCustomAction,
  addContestCategoryFromGlobalAction,
  archiveContestCategoryAction,
  listGlobalCategoriesCatalogAction,
  reorderContestCategoriesAction,
  searchGlobalCategoriesAction,
  suggestGlobalCategoryForSystemAction,
  suggestSimilarCategoriesAction,
  updateContestCategoryMappingsAction,
} from "../../../../../actions/contest-categories";
import { updateContestCategoriesFromModal } from "../../../../../actions/contests";
import { getCategoryManagementMode } from "../../../../../lib/fotorank/contestCategoryPolicy";
import { normalizeSlug } from "../../../../../lib/fotorank/slug";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

type ContestCategoryRow = Contest["categories"][number];

type EditableCategory = {
  name: string;
  slug: string;
  description: string;
  maxFiles: number;
};

interface CategoriasModalContentProps {
  contest: Contest;
  onSuccess: () => void;
  onCancel: () => void;
  readOnly?: boolean;
  restrictionMessage?: string | null;
}

function badgeStyle(theme: ReturnType<typeof useResolvedTheme>, tone: "gold" | "muted" | "warn" | "ok"): React.CSSProperties {
  const bg =
    tone === "gold"
      ? "rgba(212, 175, 55, 0.15)"
      : tone === "warn"
        ? "rgba(239, 68, 68, 0.12)"
        : tone === "ok"
          ? "rgba(34, 197, 94, 0.12)"
          : theme.surface.elevated;
  const border =
    tone === "gold"
      ? "rgba(212, 175, 55, 0.35)"
      : tone === "warn"
        ? "rgba(239, 68, 68, 0.35)"
        : tone === "ok"
          ? "rgba(34, 197, 94, 0.35)"
          : theme.border.subtle;
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: `${spacing[1]} ${spacing[3]}`,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
    background: bg,
    border: `1px solid ${border}`,
    color: theme.text.primary,
  };
}

type AddFlow = "idle" | "global" | "custom" | "suggest";

export function CategoriasModalContent({ contest, onSuccess, onCancel, readOnly, restrictionMessage }: CategoriasModalContentProps) {
  const theme = useResolvedTheme();
  const hasEntries = (contest._count?.entries ?? 0) > 0;
  const mode = getCategoryManagementMode(contest.status, hasEntries);
  const canBulkLegacy = mode === "full" && !hasEntries;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addFlow, setAddFlow] = useState<AddFlow>("idle");

  const [categories, setCategories] = useState<EditableCategory[]>(
    contest.categories.length > 0
      ? contest.categories.map((c) => ({
          name: c.name ?? "",
          slug: c.slug ?? "",
          description: c.description ?? "",
          maxFiles: Math.max(1, c.maxFiles ?? 1),
        }))
      : [{ name: "", slug: "", description: "", maxFiles: 1 }],
  );

  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  const [pickGlobalId, setPickGlobalId] = useState<string | null>(null);
  const [displayOverride, setDisplayOverride] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customMax, setCustomMax] = useState(1);
  const [customGlobals, setCustomGlobals] = useState<string[]>([]);
  const [customPrimary, setCustomPrimary] = useState<string | null>(null);
  const [similarHint, setSimilarHint] = useState<string | null>(null);

  const [suggestName, setSuggestName] = useState("");
  const [suggestReason, setSuggestReason] = useState("");
  const [suggestProv, setSuggestProv] = useState<string[]>([]);
  const [suggestPrimary, setSuggestPrimary] = useState<string | null>(null);

  const [mappingEditId, setMappingEditId] = useState<string | null>(null);
  const [mapSelected, setMapSelected] = useState<string[]>([]);
  const [mapPrimary, setMapPrimary] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    const r = await listGlobalCategoriesCatalogAction();
    if (r.ok) setCatalog(r.items);
  }, []);

  useEffect(() => {
    if (addFlow === "global" || addFlow === "custom" || addFlow === "suggest" || mappingEditId) {
      void loadCatalog();
    }
  }, [addFlow, mappingEditId, loadCatalog]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!searchQ.trim()) {
        setSearchHits(catalog.slice(0, 15));
        return;
      }
      void searchGlobalCategoriesAction(searchQ).then((r) => {
        if (r.ok) setSearchHits(r.items);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [searchQ, catalog]);

  const canEdit = !readOnly && mode !== "readonly";

  const controlStyle: React.CSSProperties = useMemo(
    () => ({
      width: "100%",
      boxSizing: "border-box",
      borderRadius: radius.button,
      border: `1px solid ${theme.border.subtle}`,
      background: theme.surface.base,
      color: theme.text.primary,
      padding: `${spacing[3]} ${spacing[4]}`,
      fontSize: "0.95rem",
      outline: "none",
    }),
    [theme, radius.button],
  );

  const activeRows = useMemo(
    () => contest.categories.filter((c) => c.status === "ACTIVE" || !c.status),
    [contest.categories],
  );

  const moveRow = async (categoryId: string, dir: -1 | 1) => {
    const all = [...contest.categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const i = all.findIndex((c) => c.id === categoryId);
    if (i < 0) return;
    let j = i + dir;
    while (j >= 0 && j < all.length && all[j]!.status === "ARCHIVED") {
      j += dir;
    }
    if (j < 0 || j >= all.length) return;
    if (all[j]!.status !== "ACTIVE") return;
    const next = [...all];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setSaving(true);
    setError(null);
    const r = await reorderContestCategoriesAction({
      contestId: contest.id,
      orderedCategoryIds: next.map((c) => c.id),
    });
    setSaving(false);
    if (r.ok) onSuccess();
    else setError(r.error);
  };

  const openMapping = (row: ContestCategoryRow) => {
    setMappingEditId(row.id);
    const ids = row.globalMappings.map((m) => m.globalCategoryId);
    setMapSelected(ids.length ? ids : []);
    const p = row.globalMappings.find((m) => m.isPrimary);
    setMapPrimary(p?.globalCategoryId ?? ids[0] ?? null);
  };

  const saveMapping = async () => {
    if (!mappingEditId || !mapPrimary || mapSelected.length === 0) {
      setError("Elegí al menos una categoría global y una principal.");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await updateContestCategoryMappingsAction({
      contestId: contest.id,
      categoryId: mappingEditId,
      globalCategoryIds: mapSelected,
      primaryGlobalCategoryId: mapPrimary,
    });
    setSaving(false);
    if (r.ok) {
      setMappingEditId(null);
      onSuccess();
    } else setError(r.error);
  };

  const submitAddFromGlobal = async () => {
    if (!pickGlobalId) {
      setError("Seleccioná una categoría del catálogo.");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await addContestCategoryFromGlobalAction({
      contestId: contest.id,
      globalCategoryId: pickGlobalId,
      displayName: displayOverride.trim() || undefined,
      maxFiles: customMax,
    });
    setSaving(false);
    if (r.ok) {
      setAddFlow("idle");
      setPickGlobalId(null);
      setDisplayOverride("");
      onSuccess();
    } else setError(r.error);
  };

  const submitCustom = async () => {
    if (!customPrimary || customGlobals.length === 0) {
      setError("Definí el mapeo global (una o más, con principal).");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await addContestCategoryCustomAction({
      contestId: contest.id,
      displayName: customName,
      description: customDesc,
      maxFiles: customMax,
      globalCategoryIds: customGlobals,
      primaryGlobalCategoryId: customPrimary,
    });
    setSaving(false);
    if (r.ok) {
      setAddFlow("idle");
      setCustomName("");
      setCustomDesc("");
      setCustomGlobals([]);
      setCustomPrimary(null);
      onSuccess();
    } else setError(r.error);
  };

  const submitSuggest = async () => {
    if (!suggestPrimary || suggestProv.length === 0) {
      setError("Mapeo provisional obligatorio mientras la sugerencia se revisa.");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await suggestGlobalCategoryForSystemAction({
      contestId: contest.id,
      suggestedName: suggestName,
      reason: suggestReason,
      provisionalGlobalCategoryIds: suggestProv,
      primaryProvisionalGlobalId: suggestPrimary,
      contestDisplayName: customName.trim() || suggestName,
      contestMaxFiles: customMax,
    });
    setSaving(false);
    if (r.ok) {
      setAddFlow("idle");
      setSuggestName("");
      setSuggestReason("");
      setSuggestProv([]);
      setSuggestPrimary(null);
      onSuccess();
    } else setError(r.error);
  };

  const checkSimilar = async (name: string) => {
    if (!name.trim()) {
      setSimilarHint(null);
      return;
    }
    const r = await suggestSimilarCategoriesAction(name);
    if (!r.ok) return;
    const top = r.suggestions[0];
    if (top && (top.reason === "exact_name" || top.score >= 0.92)) {
      setSimilarHint(`Ya existe algo muy parecido: «${top.name}». Considerá usar el catálogo en lugar de crear una variante.`);
    } else {
      setSimilarHint(null);
    }
  };

  const legacySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit || !canBulkLegacy) return;

    const normalized = categories.map((c) => ({
      ...c,
      name: c.name.trim(),
      slug: normalizeSlug(c.slug || c.name),
      description: c.description.trim(),
      maxFiles: Math.max(1, Math.floor(c.maxFiles || 1)),
    }));

    const nonEmpty = normalized.filter((c) => c.name !== "");
    if (nonEmpty.length === 0) {
      setError("Agregá al menos una categoría con nombre.");
      return;
    }

    const slugSet = new Set<string>();
    for (const c of nonEmpty) {
      if (!c.slug) {
        setError("Todas las categorías deben tener slug válido.");
        return;
      }
      if (slugSet.has(c.slug)) {
        setError("No puede haber categorías con el mismo slug.");
        return;
      }
      slugSet.add(c.slug);
    }

    setError(null);
    setSaving(true);

    const formData = new FormData();
    formData.set("contestId", contest.id);
    formData.set("categories", JSON.stringify(nonEmpty));

    const result = await updateContestCategoriesFromModal(formData);
    setSaving(false);

    if (result.ok) onSuccess();
    else setError(result.error ?? "No se pudieron guardar las categorías.");
  };

  if (!canEdit) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
        {restrictionMessage ? (
          <div
            style={{
              borderRadius: radius.button,
              border: `1px solid ${theme.border.default}`,
              background: theme.surface.elevated,
              color: theme.text.secondary,
              padding: spacing[4],
              fontSize: "0.875rem",
            }}
          >
            {restrictionMessage}
          </div>
        ) : null}

        {contest.categories.length === 0 ? (
          <p style={{ color: theme.text.secondary, fontSize: "0.9rem" }}>No hay categorías definidas.</p>
        ) : (
          <ul style={{ display: "grid", gap: spacing[3] }}>
            {contest.categories.map((cat) => (
              <li
                key={cat.id}
                style={{
                  border: `1px solid ${theme.border.subtle}`,
                  background: theme.surface.base,
                  borderRadius: radius.button,
                  padding: `${spacing[3]} ${spacing[4]}`,
                  color: theme.text.primary,
                  fontSize: "0.9rem",
                }}
              >
                {cat.name}
                {cat.maxFiles > 1 ? (
                  <span style={{ marginLeft: spacing[2], color: theme.text.secondary }}>· máx. {cat.maxFiles} archivos</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: spacing[3] }}>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {restrictionMessage ? (
        <div
          style={{
            borderRadius: radius.button,
            border: `1px solid ${theme.border.default}`,
            background: theme.surface.elevated,
            color: theme.text.secondary,
            padding: spacing[4],
            fontSize: "0.875rem",
          }}
        >
          {restrictionMessage}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            borderRadius: radius.button,
            border: "1px solid rgba(239, 68, 68, 0.35)",
            background: "rgba(239, 68, 68, 0.1)",
            color: "#fca5a5",
            padding: spacing[4],
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      ) : null}

      <FormSection title="Categorías del concurso" description="Catálogo global, mapeos y nombres visibles. Las obras quedan ligadas al concurso y, para ranking global, a categorías maestras aprobadas." style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[5] }}>
          {activeRows.length === 0 ? (
            <Text variant="muted">No hay categorías activas. Agregá al menos una.</Text>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: spacing[4] }}>
              {activeRows.map((row) => (
                <li
                  key={row.id}
                  style={{
                    border: `1px solid ${theme.border.subtle}`,
                    background: theme.surface.base,
                    borderRadius: radius.button,
                    padding: spacing[4],
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2], alignItems: "center", marginBottom: spacing[2] }}>
                    <strong style={{ color: theme.text.primary }}>{row.name}</strong>
                    {row.isCustom ? <span style={badgeStyle(theme, "gold")}>Personalizada</span> : null}
                    {row.linkedPendingGlobalCategory ? <span style={badgeStyle(theme, "warn")}>Global pendiente</span> : null}
                    {row.mappingIncomplete ? <span style={badgeStyle(theme, "warn")}>Mapeo incompleto</span> : <span style={badgeStyle(theme, "ok")}>Mapeo OK</span>}
                    <span style={{ ...badgeStyle(theme, "muted"), textTransform: "none" }}>
                      {row._count.entries} obra(s)
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: theme.text.secondary, marginBottom: spacing[3] }}>
                    Slug: <code>{row.slug}</code>
                    {row.globalMappings.length > 0
                      ? ` · Global: ${row.globalMappings.map((m) => `${m.globalCategory.name}${m.isPrimary ? " (principal)" : ""}`).join(", ")}`
                      : " · Sin vínculo global aún"}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => moveRow(row.id, -1)}>
                      Subir
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => moveRow(row.id, 1)}>
                      Bajar
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => openMapping(row)}>
                      Editar mapeo global
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || row._count.entries > 0 || row._count.judgeAssignments > 0}
                      onClick={async () => {
                        setSaving(true);
                        setError(null);
                        const r = await archiveContestCategoryAction({ contestId: contest.id, categoryId: row.id });
                        setSaving(false);
                        if (r.ok) onSuccess();
                        else setError(r.error);
                      }}
                    >
                      Archivar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {mappingEditId ? (
            <div
              style={{
                border: `1px solid ${theme.border.default}`,
                borderRadius: radius.button,
                padding: spacing[4],
                background: theme.surface.elevated,
              }}
            >
              <Text variant="h3" as="h4">
                Editar mapeo a categorías globales
              </Text>
              <p style={{ fontSize: "0.8rem", color: theme.text.secondary, marginTop: spacing[2], marginBottom: spacing[4] }}>
                Marcá una o más categorías maestras aprobadas y elegí cuál es la principal para esta categoría del concurso.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: spacing[2], maxHeight: "14rem", overflowY: "auto" }}>
                {catalog.map((g) => (
                  <label
                    key={g.id}
                    style={{ display: "flex", alignItems: "center", gap: spacing[2], fontSize: "0.875rem", color: theme.text.primary }}
                  >
                    <input
                      type="checkbox"
                      checked={mapSelected.includes(g.id)}
                      onChange={() => {
                        setMapSelected((prev) =>
                          prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id],
                        );
                      }}
                    />
                    <input
                      type="radio"
                      name="map-primary"
                      checked={mapPrimary === g.id}
                      onChange={() => setMapPrimary(g.id)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: spacing[2], marginTop: spacing[4] }}>
                <Button type="button" size="sm" disabled={saving} onClick={saveMapping}>
                  Guardar mapeo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setMappingEditId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
            <Button type="button" variant="outline" disabled={saving || addFlow !== "idle"} onClick={() => setAddFlow("global")}>
              Agregar desde catálogo global
            </Button>
            <Button type="button" variant="outline" disabled={saving || addFlow !== "idle"} onClick={() => setAddFlow("custom")}>
              Categoría personalizada
            </Button>
            <Button type="button" variant="outline" disabled={saving || addFlow !== "idle"} onClick={() => setAddFlow("suggest")}>
              Sugerir categoría global
            </Button>
          </div>

          {addFlow === "global" ? (
            <div style={{ border: `1px solid ${theme.border.subtle}`, borderRadius: radius.button, padding: spacing[4] }}>
              <FormField label="Buscar en catálogo" htmlFor="g-search">
                <input
                  id="g-search"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Nombre o slug…"
                  style={controlStyle}
                />
              </FormField>
              <div style={{ marginTop: spacing[3], maxHeight: "10rem", overflowY: "auto" }}>
                {(searchQ.trim() ? searchHits : catalog.slice(0, 20)).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setPickGlobalId(g.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: spacing[2],
                      marginBottom: spacing[1],
                      borderRadius: radius.button,
                      border:
                        pickGlobalId === g.id ? `1px solid ${theme.border.default}` : `1px solid transparent`,
                      background: pickGlobalId === g.id ? theme.surface.elevated : "transparent",
                      color: theme.text.primary,
                      cursor: "pointer",
                    }}
                  >
                    {g.name} <span style={{ color: theme.text.secondary }}>({g.slug})</span>
                  </button>
                ))}
              </div>
              <FormField label="Nombre visible (opcional)" htmlFor="g-display" helperText="Por defecto usa el nombre global.">
                <input id="g-display" value={displayOverride} onChange={(e) => setDisplayOverride(e.target.value)} style={controlStyle} />
              </FormField>
              <FormField label="Máx. archivos" htmlFor="g-max">
                <input
                  id="g-max"
                  type="number"
                  min={1}
                  value={customMax}
                  onChange={(e) => setCustomMax(Math.max(1, Number(e.target.value) || 1))}
                  style={controlStyle}
                />
              </FormField>
              <div style={{ display: "flex", gap: spacing[2], marginTop: spacing[3] }}>
                <Button type="button" disabled={saving} onClick={submitAddFromGlobal}>
                  Crear categoría del concurso
                </Button>
                <Button type="button" variant="outline" onClick={() => setAddFlow("idle")}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : null}

          {addFlow === "custom" ? (
            <div style={{ border: `1px solid ${theme.border.subtle}`, borderRadius: radius.button, padding: spacing[4] }}>
              <FormField label="Nombre visible" htmlFor="c-name" required>
                <input
                  id="c-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onBlur={() => checkSimilar(customName)}
                  style={controlStyle}
                />
              </FormField>
              {similarHint ? (
                <p style={{ fontSize: "0.8rem", color: "#fbbf24", marginTop: spacing[2] }}>{similarHint}</p>
              ) : null}
              <FormField label="Descripción (opcional)" htmlFor="c-desc">
                <textarea id="c-desc" rows={2} value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} style={controlStyle} />
              </FormField>
              <FormField label="Máx. archivos" htmlFor="c-max">
                <input
                  id="c-max"
                  type="number"
                  min={1}
                  value={customMax}
                  onChange={(e) => setCustomMax(Math.max(1, Number(e.target.value) || 1))}
                  style={controlStyle}
                />
              </FormField>
              <Text variant="muted" style={{ marginTop: spacing[3], display: "block" }}>
                Mapeo obligatorio a categorías globales aprobadas
              </Text>
              <div style={{ maxHeight: "12rem", overflowY: "auto", marginTop: spacing[2] }}>
                {catalog.map((g) => (
                  <label
                    key={g.id}
                    style={{ display: "flex", alignItems: "center", gap: spacing[2], fontSize: "0.875rem", color: theme.text.primary }}
                  >
                    <input
                      type="checkbox"
                      checked={customGlobals.includes(g.id)}
                      onChange={() =>
                        setCustomGlobals((prev) => (prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]))
                      }
                    />
                    <input
                      type="radio"
                      name="custom-primary"
                      checked={customPrimary === g.id}
                      onChange={() => setCustomPrimary(g.id)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: spacing[2], marginTop: spacing[3] }}>
                <Button type="button" disabled={saving} onClick={submitCustom}>
                  Guardar
                </Button>
                <Button type="button" variant="outline" onClick={() => setAddFlow("idle")}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : null}

          {addFlow === "suggest" ? (
            <div style={{ border: `1px solid ${theme.border.subtle}`, borderRadius: radius.button, padding: spacing[4] }}>
              <p style={{ fontSize: "0.85rem", color: theme.text.secondary, marginBottom: spacing[3] }}>
                La categoría global sugerida queda en revisión (PENDING). El concurso usa igual una categoría visible mapeada a globales
                existentes hasta que un administrador apruebe.
              </p>
              <FormField label="Nombre sugerido para el catálogo global" htmlFor="s-name" required>
                <input id="s-name" value={suggestName} onChange={(e) => setSuggestName(e.target.value)} style={controlStyle} />
              </FormField>
              <FormField label="Motivo / notas" htmlFor="s-reason">
                <textarea id="s-reason" rows={2} value={suggestReason} onChange={(e) => setSuggestReason(e.target.value)} style={controlStyle} />
              </FormField>
              <FormField label="Nombre visible en el concurso (opcional)" htmlFor="s-display">
                <input id="s-display" value={customName} onChange={(e) => setCustomName(e.target.value)} style={controlStyle} />
              </FormField>
              <FormField label="Máx. archivos" htmlFor="s-max">
                <input
                  id="s-max"
                  type="number"
                  min={1}
                  value={customMax}
                  onChange={(e) => setCustomMax(Math.max(1, Number(e.target.value) || 1))}
                  style={controlStyle}
                />
              </FormField>
              <Text variant="muted" style={{ marginTop: spacing[3], display: "block" }}>
                Mapeo provisional (globales aprobadas)
              </Text>
              <div style={{ maxHeight: "10rem", overflowY: "auto" }}>
                {catalog.map((g) => (
                  <label
                    key={g.id}
                    style={{ display: "flex", alignItems: "center", gap: spacing[2], fontSize: "0.875rem", color: theme.text.primary }}
                  >
                    <input
                      type="checkbox"
                      checked={suggestProv.includes(g.id)}
                      onChange={() =>
                        setSuggestProv((prev) => (prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]))
                      }
                    />
                    <input
                      type="radio"
                      name="suggest-primary"
                      checked={suggestPrimary === g.id}
                      onChange={() => setSuggestPrimary(g.id)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: spacing[2], marginTop: spacing[3] }}>
                <Button type="button" disabled={saving} onClick={submitSuggest}>
                  Enviar sugerencia y crear categoría
                </Button>
                <Button type="button" variant="outline" onClick={() => setAddFlow("idle")}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </FormSection>

      {canBulkLegacy ? (
        <form onSubmit={legacySubmit} style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
          <Text variant="muted">
            Reemplazo rápido (solo sin obras ni jurados asignados): sobrescribe todas las categorías y regenera mapeos automáticos por
            nombre.
          </Text>
          {categories.map((cat, index) => (
            <div
              key={index}
              style={{
                border: `1px solid ${theme.border.subtle}`,
                background: theme.surface.base,
                borderRadius: radius.button,
                padding: spacing[4],
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[3] }}>
                <strong style={{ color: theme.text.primary, fontSize: "0.9rem" }}>Categoría {index + 1}</strong>
                <IconButton
                  type="button"
                  icon="delete"
                  variant="destructive"
                  size="sm"
                  aria-label={`Eliminar categoría ${index + 1}`}
                  onClick={() => setCategories((prev) => prev.filter((_, i) => i !== index))}
                  disabled={categories.length <= 1}
                />
              </div>
              <div style={{ display: "grid", gap: spacing[4], gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <FormField label="Nombre" htmlFor={`l-name-${index}`} required>
                  <input
                    id={`l-name-${index}`}
                    type="text"
                    value={cat.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setCategories((prev) => {
                        const next = [...prev];
                        const cur = next[index];
                        if (!cur) return prev;
                        next[index] = { ...cur, name, slug: normalizeSlug(cur.slug || name) };
                        return next;
                      });
                    }}
                    style={controlStyle}
                  />
                </FormField>
                <FormField label="Slug" htmlFor={`l-slug-${index}`} required helperText="Se genera desde el nombre (editable).">
                  <input
                    id={`l-slug-${index}`}
                    type="text"
                    value={cat.slug}
                    onChange={(e) =>
                      setCategories((prev) => {
                        const next = [...prev];
                        const cur = next[index];
                        if (!cur) return prev;
                        next[index] = { ...cur, slug: normalizeSlug(e.target.value) };
                        return next;
                      })
                    }
                    style={controlStyle}
                  />
                </FormField>
                <div style={{ gridColumn: "1 / -1" }}>
                  <FormField label="Descripción (opcional)" htmlFor={`l-desc-${index}`}>
                    <textarea
                      id={`l-desc-${index}`}
                      rows={2}
                      value={cat.description}
                      onChange={(e) =>
                        setCategories((prev) => {
                          const next = [...prev];
                          const cur = next[index];
                          if (!cur) return prev;
                          next[index] = { ...cur, description: e.target.value };
                          return next;
                        })
                      }
                      style={controlStyle}
                    />
                  </FormField>
                </div>
                <FormField label="Máximo de archivos" htmlFor={`l-max-${index}`}>
                  <input
                    id={`l-max-${index}`}
                    type="number"
                    min={1}
                    value={cat.maxFiles}
                    onChange={(e) =>
                      setCategories((prev) => {
                        const next = [...prev];
                        const cur = next[index];
                        if (!cur) return prev;
                        next[index] = { ...cur, maxFiles: Math.max(1, Number(e.target.value) || 1) };
                        return next;
                      })
                    }
                    style={controlStyle}
                  />
                </FormField>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setCategories((prev) => [...prev, { name: "", slug: "", description: "", maxFiles: 1 }])}
          >
            Agregar fila (reemplazo masivo)
          </Button>
          <div style={{ display: "flex", gap: spacing[3] }}>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar reemplazo masivo"}
            </Button>
          </div>
        </form>
      ) : (
        <Text variant="muted">
          El reemplazo masivo de categorías no está disponible: hay obras o jurados asignados, o el concurso no está en borrador. Usá las
          acciones de arriba.
        </Text>
      )}

      <div style={{ display: "flex", gap: spacing[3] }}>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
