"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveAction,
  compareAction,
  generatePromptAction,
  importDocumentAction,
  importStructuredAction,
  markLegalAction,
  publishApprovedAction,
  requestChangesAction,
  seedSantaFeDraftAction,
  submitReviewAction,
} from "./actions";

type Version = {
  id: string;
  versionNumber: number;
  title: string;
  status: string;
  contentHash: string;
  publishedAt: Date | string | null;
  acceptanceCount: number;
  placeholderWarning: string | null;
  draftContent: string | null;
  configurationVersionId: string | null;
  configurationHashSnapshot: string | null;
  legalReviewStatus: string;
  reviewNotes: string | null;
  legalReviewNotes: string | null;
  compareSnapshotJson: unknown;
  sectionsChecklistJson: unknown;
};

type Props = {
  contestId: string;
  initialVersions: Version[];
  publishedConfigSummary: string | null;
};

export function RulesAdminClient({ contestId, initialVersions, publishedConfigSummary }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("Bases");
  const [content, setContent] = useState("");
  const [structuredJson, setStructuredJson] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialVersions[0]?.id ?? null);
  const [notes, setNotes] = useState("");

  const selected = initialVersions.find((v) => v.id === selectedId) ?? null;

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="space-y-10" data-testid="rules-admin-p009b">
      <section className="fr-recuadro border border-amber-500/30 bg-amber-500/5 space-y-4">
        <h2 className="text-lg font-semibold text-amber-100">Revisión jurídica de licencia</h2>
        <p className="text-sm text-fr-muted leading-relaxed">
          La configuración establece una licencia exclusiva, gratuita y comercial durante 12 meses para
          todas las obras, además de un uso patrimonial permanente para obras seleccionadas. Se recomienda
          revisión jurídica antes de publicar. La publicación productiva queda bloqueada mientras el estado
          legal sea PENDING.
        </p>
      </section>

      <section className="fr-recuadro border border-fr-border bg-fr-card space-y-6">
        <h2 className="text-lg font-semibold">Generación e importación</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="fr-btn fr-btn-secondary min-h-11"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await generatePromptAction(contestId);
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                if (r.mode === "manual_prompt") {
                  setPrompt(r.prompt);
                  setInfo("Prompt generado (sin API). Copialo a ChatGPT e importá la respuesta JSON.");
                } else {
                  setInfo("Respuesta OpenAI recibida (no publicada).");
                }
              })
            }
          >
            Generar borrador de Bases / Copiar prompt
          </button>
          <button
            type="button"
            className="fr-btn fr-btn-secondary min-h-11"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await seedSantaFeDraftAction(contestId);
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                setSelectedId(r.rulesVersionId);
                setInfo(`Borrador Santa Fe creado (v${r.versionNumber}). Legal: ${r.legalReviewStatus}`);
              })
            }
          >
            Crear borrador Santa Fe en Foco
          </button>
        </div>
        {prompt ? (
          <div className="space-y-3">
            <textarea className="fr-filter-input min-h-40 w-full font-mono text-xs" readOnly value={prompt} />
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11"
              onClick={() => void navigator.clipboard.writeText(prompt)}
            >
              Copiar prompt al portapapeles
            </button>
          </div>
        ) : null}
        <label className="block space-y-3">
          <span className="text-sm font-semibold">Importar documento (Markdown/texto)</span>
          <input
            className="fr-filter-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
          />
          <textarea
            className="fr-filter-input min-h-40 w-full font-mono text-sm"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            type="button"
            className="fr-btn fr-btn-secondary min-h-11"
            disabled={pending || !content.trim()}
            onClick={() =>
              run(async () => {
                const r = await importDocumentAction(contestId, title, content);
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                setSelectedId(r.rulesVersionId);
                setInfo("Documento importado como GENERATED (no publicado).");
              })
            }
          >
            Importar documento
          </button>
        </label>
        <label className="block space-y-3">
          <span className="text-sm font-semibold">Importar respuesta estructurada (JSON)</span>
          <textarea
            className="fr-filter-input min-h-32 w-full font-mono text-xs"
            value={structuredJson}
            onChange={(e) => setStructuredJson(e.target.value)}
            placeholder='{"documentTitle":"...","rulesDocument":"...","declaredConfigurationHash":"..."}'
          />
          <button
            type="button"
            className="fr-btn fr-btn-secondary min-h-11"
            disabled={pending || !structuredJson.trim()}
            onClick={() =>
              run(async () => {
                const r = await importStructuredAction(contestId, structuredJson);
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                setSelectedId(r.rulesVersionId);
                setInfo(
                  r.hashDeclaredMatches
                    ? "JSON importado. Hash declarado OK."
                    : "JSON importado con advertencia de hash.",
                );
              })
            }
          >
            Importar JSON
          </button>
        </label>
      </section>

      <section className="grid gap-8 lg:grid-cols-3">
        <div className="fr-recuadro border border-fr-border bg-fr-card space-y-4 lg:col-span-1">
          <h2 className="text-lg font-semibold">Configuración</h2>
          <pre className="whitespace-pre-wrap text-xs text-fr-muted">
            {publishedConfigSummary ?? "Sin configuración publicada."}
          </pre>
        </div>
        <div className="fr-recuadro border border-fr-border bg-fr-card space-y-4 lg:col-span-1">
          <h2 className="text-lg font-semibold">Documento</h2>
          {selected ? (
            <>
              <p className="text-sm text-fr-muted">
                v{selected.versionNumber} · {selected.status} · legal {selected.legalReviewStatus}
              </p>
              <p className="font-mono text-xs text-fr-muted">
                hash {selected.contentHash.slice(0, 16)}… · config{" "}
                {(selected.configurationHashSnapshot ?? "—").slice(0, 16)}…
              </p>
              <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-fr-primary">
                {selected.draftContent ?? "(versión inmutable — contenido no editable aquí)"}
              </div>
            </>
          ) : (
            <p className="text-sm text-fr-muted">Seleccioná una versión.</p>
          )}
        </div>
        <div className="fr-recuadro border border-fr-border bg-fr-card space-y-4 lg:col-span-1">
          <h2 className="text-lg font-semibold">Validación</h2>
          {selected ? (
            <>
              <pre className="max-h-48 overflow-auto text-xs text-fr-muted">
                {JSON.stringify(selected.compareSnapshotJson ?? [], null, 2)}
              </pre>
              <pre className="max-h-32 overflow-auto text-xs text-fr-muted">
                {JSON.stringify(selected.sectionsChecklistJson ?? [], null, 2)}
              </pre>
              {selected.legalReviewNotes ? (
                <p className="text-sm text-amber-100">{selected.legalReviewNotes}</p>
              ) : null}
              {selected.reviewNotes ? <p className="text-sm text-fr-muted">{selected.reviewNotes}</p> : null}
            </>
          ) : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Notas de revisión</span>
            <textarea
              className="fr-filter-input min-h-20 w-full text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11 text-sm"
              disabled={pending || !selected}
              onClick={() =>
                run(async () => {
                  if (!selected) return;
                  const r = await compareAction(contestId, selected.id);
                  if (!r.ok) setError(r.error);
                  else setInfo("Comparación actualizada.");
                })
              }
            >
              Comparar
            </button>
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11 text-sm"
              disabled={pending || !selected}
              onClick={() =>
                run(async () => {
                  if (!selected) return;
                  const r = await submitReviewAction(contestId, selected.id, notes);
                  if (!r.ok) setError(r.error);
                  else setInfo("Enviado a revisión.");
                })
              }
            >
              Enviar a revisión
            </button>
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11 text-sm"
              disabled={pending || !selected}
              onClick={() =>
                run(async () => {
                  if (!selected) return;
                  const r = await requestChangesAction(contestId, selected.id, notes || "Cambios solicitados");
                  if (!r.ok) setError(r.error);
                  else setInfo("Cambios solicitados.");
                })
              }
            >
              Solicitar cambios
            </button>
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11 text-sm"
              disabled={pending || !selected}
              onClick={() =>
                run(async () => {
                  if (!selected) return;
                  const r = await approveAction(contestId, selected.id, notes);
                  if (!r.ok) setError(r.error);
                  else setInfo("Aprobado (humano).");
                })
              }
            >
              Aprobar
            </button>
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11 text-sm"
              disabled={pending || !selected}
              onClick={() =>
                run(async () => {
                  if (!selected) return;
                  const r = await markLegalAction(contestId, selected.id, "REVIEWED", notes);
                  if (!r.ok) setError(r.error);
                  else setInfo("Revisión jurídica marcada REVIEWED.");
                })
              }
            >
              Marcar revisión jurídica
            </button>
            <button
              type="button"
              className="fr-btn fr-btn-primary min-h-11 text-sm"
              disabled={pending || !selected || selected.status !== "APPROVED"}
              data-testid="rules-publish-approved"
              onClick={() =>
                run(async () => {
                  if (!selected) return;
                  if (!confirm("Publicar bases aprobadas? No abre el concurso automáticamente.")) return;
                  const r = await publishApprovedAction(contestId, selected.id);
                  if (!r.ok) setError(r.error);
                  else setInfo(`Publicada v${r.versionNumber}.`);
                })
              }
            >
              Publicar (aprobada)
            </button>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {info ? <p className="text-sm text-amber-100">{info}</p> : null}

      <section className="fr-recuadro border border-fr-border bg-fr-card overflow-x-auto">
        <h2 className="mb-6 text-lg font-semibold">Historial de versiones</h2>
        <table className="min-w-full text-left text-sm" data-testid="rules-versions-table">
          <thead className="border-b border-fr-border text-fr-muted">
            <tr>
              <th className="px-3 py-3">v</th>
              <th className="px-3 py-3">Título</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Legal</th>
              <th className="px-3 py-3">Config</th>
              <th className="px-3 py-3">Hash</th>
              <th className="px-3 py-3">Acept.</th>
              <th className="px-3 py-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {initialVersions.map((v) => (
              <tr key={v.id} className="border-b border-fr-border/50">
                <td className="px-3 py-3 text-gold">{v.versionNumber}</td>
                <td className="px-3 py-3">{v.title}</td>
                <td className="px-3 py-3">{v.status}</td>
                <td className="px-3 py-3">{v.legalReviewStatus}</td>
                <td className="px-3 py-3 font-mono text-xs">
                  {(v.configurationHashSnapshot ?? "—").slice(0, 8)}
                </td>
                <td className="px-3 py-3 font-mono text-xs">{v.contentHash.slice(0, 12)}…</td>
                <td className="px-3 py-3">{v.acceptanceCount}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    className="text-gold hover:text-gold-hover"
                    onClick={() => setSelectedId(v.id)}
                  >
                    Revisar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
