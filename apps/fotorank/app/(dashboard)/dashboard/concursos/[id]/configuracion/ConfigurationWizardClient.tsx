"use client";

import { useMemo, useState, useTransition } from "react";
import type { ContestRulesConfiguration, ValidationResult } from "../../../../../lib/fotorank/rules-config/types";
import { validateContestRulesConfiguration } from "../../../../../lib/fotorank/rules-config/validate";
import {
  applyConfigurationTechnicalAction,
  compareBasesTextAction,
  getChatGptPromptAction,
  importBasesTextAction,
  loadSantaFePresetAction,
  publishConfigurationAction,
  saveConfigurationDraftAction,
} from "./actions";

const STEPS = [
  "Identidad",
  "Participación",
  "Fechas",
  "Categorías",
  "Archivo y metadatos",
  "Edición e IA",
  "Derechos",
  "Jurado y premios",
  "Descalificaciones",
  "Revisión",
] as const;

type Props = {
  contestId: string;
  contestTitle: string;
  initialConfig: ContestRulesConfiguration | null;
  initialVersionId: string | null;
  initialVersionNumber: number | null;
  initialStatus: string | null;
};

export function ConfigurationWizardClient(props: Props) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ContestRulesConfiguration | null>(props.initialConfig);
  const [versionId, setVersionId] = useState<string | null>(props.initialVersionId);
  const [message, setMessage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [basesText, setBasesText] = useState("");
  const [compareJson, setCompareJson] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const validation: ValidationResult | null = useMemo(
    () => (config ? validateContestRulesConfiguration(config) : null),
    [config],
  );

  const isFree = config?.participation.pricingMode === "FREE";
  const gpsRequired = config?.metadata.gps.level === "REQUIRED";
  const minors = config?.participation.minorsAllowed === true;
  const aiProhibited = config?.ai.fullyGeneratedImage === "PROHIBITED";
  const commercialLicense = config?.rights.allowCommercial === true;

  function run(action: () => Promise<void>) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="space-y-10" data-testid="rules-config-wizard">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${
              i === step ? "border-gold bg-gold/10 text-gold" : "border-fr-border text-fr-muted"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="fr-recuadro space-y-6">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="fr-btn fr-btn-secondary min-h-11"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await loadSantaFePresetAction(props.contestId);
                if (!r.ok) {
                  setMessage(r.error);
                  return;
                }
                setConfig(r.config);
                setVersionId(r.id);
                setMessage(`Preset Santa Fe cargado (v${r.versionNumber}). Validación: ${r.validation.status}`);
              })
            }
          >
            Cargar Santa Fe en Foco 2026
          </button>
          <button
            type="button"
            className="fr-btn fr-btn-secondary min-h-11"
            disabled={pending || !config}
            onClick={() =>
              run(async () => {
                if (!config) return;
                const r = await saveConfigurationDraftAction(props.contestId, config);
                if (!r.ok) {
                  setMessage(r.error);
                  return;
                }
                setVersionId(r.id);
                setMessage(`Borrador guardado (v${r.versionNumber}) · ${r.validation.status}`);
              })
            }
          >
            Guardar borrador
          </button>
          <a
            href={`/dashboard/concursos/${props.contestId}/bases`}
            className="fr-btn fr-btn-secondary min-h-11 inline-flex items-center"
          >
            Generar borrador de Bases →
          </a>
        </div>

        {!config ? (
          <p className="fr-body text-fr-muted">
            No hay configuración todavía. Cargá el preset de Santa Fe en Foco o construí desde el Wizard.
          </p>
        ) : (
          <>
            {step === 0 && (
              <Section title="Identidad">
                <Field label="Nombre oficial" value={config.identity.officialName} />
                <Field label="Timezone" value={config.identity.timezone} />
                <Field
                  label="Organizadores"
                  value={config.identity.organizers.map((o) => o.name).join(" · ")}
                />
                <Field label="Territorio" value={config.identity.territoryScope ?? "—"} />
                <Help>La identidad institucional alimenta las bases y la landing.</Help>
              </Section>
            )}
            {step === 1 && (
              <Section title="Participación">
                <Field label="Modalidad" value={config.participation.pricingMode} />
                {isFree ? (
                  <p className="text-sm text-fr-muted">FREE: se ocultan precio, devolución y checkout.</p>
                ) : (
                  <Field label="Precio (minor)" value={String(config.participation.priceAmountMinor)} />
                )}
                <Field label="Edad mínima" value={String(config.participation.minAge ?? "—")} />
                <Field label="Obras / inscripción" value={String(config.participation.maxEntriesPerRegistration)} />
                <Field label="Categorías / inscripción" value={String(config.participation.maxCategoriesPerRegistration)} />
                {minors ? (
                  <Help>
                    Menores: la autorización de adulto está pendiente de confirmación humana y bloquea
                    publicación formal.
                  </Help>
                ) : null}
              </Section>
            )}
            {step === 2 && (
              <Section title="Fechas (límite exclusivo)">
                <Field label="Apertura inscripción" value={config.schedule.registrationOpensAt} />
                <Field label="Cierre inscripción (exclusivo)" value={config.schedule.registrationClosesAtExclusive} />
                <Field label="Apertura carga" value={config.schedule.submissionOpensAt} />
                <Field label="Cierre carga (exclusivo)" value={config.schedule.submissionClosesAtExclusive} />
                <Help>{config.schedule.publicScheduleNote}</Help>
              </Section>
            )}
            {step === 3 && (
              <Section title="Categorías">
                <ul className="list-disc space-y-2 pl-6 text-sm text-fr-primary">
                  {config.categories.map((c) => (
                    <li key={c.slug}>
                      <strong>{c.name}</strong> ({c.deviceType})
                      {c.membershipRestriction ? ` — ${c.membershipRestriction}` : ""}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {step === 4 && (
              <Section title="Archivo y metadatos">
                <Field label="Formatos pipeline" value={config.file.supportedMimeTypes.join(", ")} />
                <Field label="Límite reglamentario de peso" value={config.file.maxFileSizeBytes == null ? "No definido" : String(config.file.maxFileSizeBytes)} />
                <Field label="EXIF" value={`${config.metadata.exifGeneral.level} / ${config.metadata.exifGeneral.missingAction}`} />
                <Field label="GPS" value={`${config.metadata.gps.level} / ${config.metadata.gps.missingAction}`} />
                <Help>
                  EXIF: metadatos de la cámara. GPS recomendado ayuda a verificar territorio; no rechaza
                  automáticamente si falta.
                </Help>
                {!gpsRequired ? <p className="text-sm text-fr-muted">GPS no obligatorio: no se piden sanciones por ausencia.</p> : null}
              </Section>
            )}
            {step === 5 && (
              <Section title="Edición e IA">
                <Field label="Revelado básico" value={config.editing.exposure} />
                <Field label="Máscaras de revelado" value={config.editing.subjectMasks} />
                <Field label="Fotomontaje" value={config.editing.photomontage} />
                <Field label="IA generativa" value={config.ai.fullyGeneratedImage} />
                <Field label="Ruido con IA" value={config.ai.aiNoiseReduction} />
                {aiProhibited ? (
                  <Help>
                    IA generativa prohibida: relleno/eliminación/expansión/agregado/reemplazo generativos
                    también prohibidos. Herramientas asistidas de flujo de trabajo permitidas.
                  </Help>
                ) : null}
                <Help>Fotomontaje = combinar escenas o inventar elementos; distinto del revelado.</Help>
              </Section>
            )}
            {step === 6 && (
              <Section title="Derechos">
                <Field label="Autor conserva titularidad" value={String(config.rights.authorRetainsOwnership)} />
                <Field label="Licencia todas las obras" value={String(config.rights.licenseAppliesToAllWorks)} />
                <Field label="Exclusiva" value={String(config.rights.exclusive)} />
                <Field label="Duración (meses)" value={String(config.rights.durationMonths)} />
                {commercialLicense ? (
                  <Help>
                    Licencia comercial: revisar duración, exclusividad, productos, territorio y atribución.
                    Hay flags de revisión jurídica en la configuración.
                  </Help>
                ) : null}
              </Section>
            )}
            {step === 7 && (
              <Section title="Jurado y premios">
                <Field label="Anonimización" value={String(config.jury.anonymizedEvaluation)} />
                <Field label="Conflicto de interés" value={String(config.jury.conflictOfInterestEnabled)} />
                <Field label="Máx. jurados" value={String(config.jury.maxJudges ?? "pendiente")} />
                <Field
                  label="Premios (1.er lugar)"
                  value="ARS 500.000 por categoría (2.° 400.000 · 3.° 300.000)"
                />
              </Section>
            )}
            {step === 8 && (
              <Section title="Descalificaciones">
                <ul className="list-disc space-y-2 pl-6 text-sm">
                  {config.disqualifications
                    .filter((d) => d.enabled)
                    .map((d) => (
                      <li key={d.code}>
                        {d.label} — {d.severity}
                      </li>
                    ))}
                </ul>
              </Section>
            )}
            {step === 9 && (
              <Section title="Revisión">
                <Field label="Versión" value={versionId ? `${versionId.slice(0, 8)}…` : "—"} />
                <Field label="Estado validación" value={validation?.status ?? "—"} />
                <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-fr-muted">
                  {validation?.findings.map((f) => (
                    <li key={`${f.code}-${f.message}`}>
                      [{f.severity}] {f.message}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="fr-btn fr-btn-primary min-h-11"
                    disabled={pending || !versionId}
                    onClick={() =>
                      run(async () => {
                        if (!versionId) return;
                        const r = await publishConfigurationAction(props.contestId, versionId);
                        setMessage(r.ok ? `Publicada. Hash ${r.hash.slice(0, 12)}…` : r.error);
                      })
                    }
                  >
                    Publicar configuración (formal)
                  </button>
                  <button
                    type="button"
                    className="fr-btn fr-btn-secondary min-h-11"
                    disabled={pending || !versionId}
                    onClick={() =>
                      run(async () => {
                        if (!versionId) return;
                        const r = await applyConfigurationTechnicalAction(props.contestId, versionId);
                        setMessage(
                          r.ok
                            ? `Aplicación técnica OK (permite pendientes humanos). Hash ${r.hash.slice(0, 12)}…`
                            : r.error,
                        );
                      })
                    }
                  >
                    Aplicar políticas (técnico / staging)
                  </button>
                </div>
              </Section>
            )}
          </>
        )}
      </div>

      {config ? (
        <div className="fr-recuadro space-y-6">
          <h2 className="text-xl font-semibold text-fr-primary">Bases: prompt e importación</h2>
          <button
            type="button"
            className="fr-btn fr-btn-secondary min-h-11"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await getChatGptPromptAction(props.contestId, config);
                setPrompt(r.prompt);
                setMessage(`Prompt generado · validación ${r.validation.status}`);
              })
            }
          >
            Generar prompt para ChatGPT
          </button>
          {prompt ? (
            <div className="space-y-4">
              <textarea
                className="min-h-48 w-full rounded-xl border border-fr-border bg-fr-bg p-4 text-sm text-fr-primary"
                readOnly
                value={prompt}
              />
              <button
                type="button"
                className="fr-btn fr-btn-primary min-h-11"
                onClick={() => navigator.clipboard.writeText(prompt)}
              >
                Copiar prompt
              </button>
            </div>
          ) : null}

          <label className="block space-y-3">
            <span className="text-sm font-semibold text-fr-primary">Importar texto de Bases (borrador)</span>
            <textarea
              className="min-h-40 w-full rounded-xl border border-fr-border bg-fr-bg p-4 text-sm"
              value={basesText}
              onChange={(e) => setBasesText(e.target.value)}
              placeholder="Pegá el texto de bases aquí…"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11"
              disabled={pending || !versionId || !basesText.trim()}
              onClick={() =>
                run(async () => {
                  if (!versionId) return;
                  const r = await importBasesTextAction(
                    props.contestId,
                    versionId,
                    `Bases borrador — ${props.contestTitle}`,
                    basesText,
                  );
                  setMessage(r.ok ? `Bases borrador ${r.rulesVersionId}` : r.error);
                })
              }
            >
              Guardar borrador de bases
            </button>
            <button
              type="button"
              className="fr-btn fr-btn-secondary min-h-11"
              disabled={pending || !basesText.trim()}
              onClick={() =>
                run(async () => {
                  const r = await compareBasesTextAction(props.contestId, config, basesText);
                  setCompareJson(JSON.stringify(r.items, null, 2));
                })
              }
            >
              Comparar texto ↔ configuración
            </button>
          </div>
          {compareJson ? (
            <pre className="overflow-x-auto rounded-xl border border-fr-border bg-fr-bg p-4 text-xs text-fr-muted">
              {compareJson}
            </pre>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-fr-border bg-fr-card px-4 py-3 text-sm text-fr-primary" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-fr-primary">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-fr-primary">{label}</div>
      <div className="rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-muted">{value}</div>
    </div>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-fr-muted">{children}</p>;
}
