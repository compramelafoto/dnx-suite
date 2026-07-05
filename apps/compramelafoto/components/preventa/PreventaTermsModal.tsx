"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import AppModal from "@/components/ui/AppModal";
import type {
  PreventaTermsSectionDoc,
  TermsContentBlock,
  TermsHighlightTone,
} from "@/lib/preventa-canjeable/preventa-terms-types";

function highlightToneClass(tone: TermsHighlightTone): string {
  switch (tone) {
    case "amber":
      return "border-amber-200/90 bg-amber-50/95";
    case "brand":
      return "border-[#c27b3d]/35 bg-[#fef7f3]";
    case "slate":
    default:
      return "border-slate-200 bg-slate-50/90";
  }
}

function BlockHighlight({
  tone,
  title,
  paragraphs,
}: {
  tone: TermsHighlightTone;
  title?: string;
  paragraphs: string[];
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 shadow-sm ${highlightToneClass(
        tone
      )}`}
    >
      {title ? (
        <p className="text-sm font-semibold text-[#111827] mb-2.5">{title}</p>
      ) : null}
      <div className="space-y-2.5 text-sm text-[#374151] leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

function BlockPackDetail(block: Extract<TermsContentBlock, { kind: "packBlock" }>) {
  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-gradient-to-b from-[#fafafa] to-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1 border-b border-[#e5e7eb]/80 pb-3">
        <h4 className="text-base font-semibold text-[#111827]">{block.packName}</h4>
        <span className="text-base font-semibold tabular-nums text-[#c27b3d]">{block.priceLabel}</span>
      </div>
      {block.intro ? (
        <p className="mt-3 text-sm leading-relaxed text-[#4b5563]">{block.intro}</p>
      ) : null}
      {block.validityLines && block.validityLines.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-[#6b7280]">
          {block.validityLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 space-y-3">
        {block.items.map((item, idx) => (
          <article
            key={idx}
            className="rounded-xl border border-white bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h5 className="text-sm font-semibold text-[#111827]">{item.title}</h5>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d]">
                {item.quantityLabel}
              </span>
            </div>
            <ul className="mt-2.5 list-none space-y-2 pl-0 text-sm leading-relaxed text-[#374151]">
              {item.lines.map((line, li) => (
                <li key={li} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#c27b3d]/70" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

function BlockLegacyProducts(
  block: Extract<TermsContentBlock, { kind: "legacyProducts" }>
) {
  return (
    <div className="space-y-3">
      {block.products.map((pr, i) => (
        <article
          key={i}
          className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h5 className="text-sm font-semibold text-[#111827]">{pr.name}</h5>
            <span className="text-sm font-semibold text-[#c27b3d]">{pr.priceLabel}</span>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-[#4b5563]">
            {pr.lines.map((line, j) => (
              <li key={j} className="flex gap-2">
                <span className="text-[#c27b3d]" aria-hidden>
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function BlockPriceList(block: Extract<TermsContentBlock, { kind: "priceList" }>) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-[#fafafa] border-b border-[#e5e7eb]">
        <p className="text-sm font-semibold text-[#111827]">{block.title}</p>
        {block.subtitle ? (
          <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">{block.subtitle}</p>
        ) : null}
      </div>
      <ul className="divide-y divide-[#f3f4f6]">
        {block.rows.map((row, i) => (
          <li key={i} className="px-4 py-3.5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
              <span className="text-sm font-medium text-[#374151] shrink-0 sm:max-w-[55%]">{row.label}</span>
              <span className="text-sm font-semibold tabular-nums text-[#c27b3d] sm:text-right">
                {row.value}
              </span>
            </div>
            {row.hint ? (
              <p className="mt-2 text-xs text-[#6b7280] leading-relaxed">{row.hint}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TermsBlockView({ block }: { block: TermsContentBlock }) {
  switch (block.kind) {
    case "paragraphs":
      return (
        <div className="space-y-3 text-sm leading-relaxed text-[#374151]">
          {block.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      );
    case "priceList":
      return <BlockPriceList {...block} />;
    case "bullets":
      return (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#374151] marker:text-[#c27b3d]">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "highlight":
      return (
        <BlockHighlight tone={block.tone} title={block.title} paragraphs={block.paragraphs} />
      );
    case "packBlock":
      return <BlockPackDetail {...block} />;
    case "legacyProducts":
      return <BlockLegacyProducts {...block} />;
    default:
      return null;
  }
}

export default function PreventaTermsModal({
  albumSlug,
  variant = "link",
}: {
  albumSlug: string;
  /** `button`: CTA visible para abrir condiciones completas. `link`: enlace de texto. */
  variant?: "link" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<PreventaTermsSectionDoc[] | null>(null);

  async function loadTerms() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/album/${encodeURIComponent(albumSlug)}/preventa-terms`,
        { cache: "no-store", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar las condiciones");
      }
      const raw = data?.sections;
      setSections(Array.isArray(raw) ? (raw as PreventaTermsSectionDoc[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSections(null);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    void loadTerms();
  }

  return (
    <>
      {variant === "button" ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto border-[#c27b3d]/40 text-[#9a5f2e] hover:bg-[#fef7f3]"
          onClick={handleOpen}
        >
          Ver condiciones completas
        </Button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="text-sm text-[#c27b3d] hover:underline font-medium"
        >
          Condiciones de esta preventa
        </button>
      )}

      {open && (
        <AppModal
          open={open}
          onClose={() => setOpen(false)}
          size="lg"
          zIndexClass="z-[70]"
          showCloseButton={false}
          ariaLabelledBy="preventa-terms-title"
          panelClassName="max-h-[92vh] overflow-visible rounded-2xl border-0 bg-transparent p-0 shadow-none"
        >
            <div className="flex max-h-[92vh] flex-col overflow-hidden border border-[#e5e7eb] rounded-2xl bg-white min-h-0">
              <header className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#e5e7eb] shrink-0 min-w-0 bg-gradient-to-b from-[#fafafa] to-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[#c27b3d] mb-1">
                      ComprameLaFoto
                    </p>
                    <h2
                      id="preventa-terms-title"
                      className="text-xl font-semibold text-[#111827] leading-snug pr-2"
                    >
                      Condiciones, fechas y precios
                    </h2>
                    <p id="preventa-terms-desc" className="mt-2 max-w-2xl text-base leading-relaxed text-gray-600">
                      Detalle según lo que ofrece esta preventa. Si tenés dudas, consultá directamente con quien hizo las
                      fotos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-[#6b7280] hover:text-[#111827] p-1 rounded-lg hover:bg-gray-100 shrink-0"
                    aria-label="Cerrar"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </header>

              <div className="min-w-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 sm:px-6 py-5">
                {loading && (
                  <p className="text-sm text-[#6b7280] py-8 text-center">Cargando condiciones…</p>
                )}
                {error && (
                  <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
                    {error}
                  </p>
                )}
                {!loading && !error && sections && (
                  <div className="space-y-10 w-full">
                    {sections.map((sec) => (
                      <section key={sec.id} className="scroll-mt-4">
                        <h3 className="text-base font-semibold text-[#111827] pb-2 mb-4 border-b border-gray-100">
                          {sec.title}
                        </h3>
                        <div className="space-y-5">
                          {sec.blocks.map((block, bi) => (
                            <TermsBlockView key={bi} block={block} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>

              <footer className="px-5 sm:px-6 py-4 border-t border-[#e5e7eb] shrink-0 bg-[#fafafa]/80">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full sm:w-auto min-w-[140px]"
                  onClick={() => setOpen(false)}
                >
                  Entendido, cerrar
                </Button>
                <p className="mt-3 max-w-2xl text-xs text-gray-600 leading-relaxed">
                  Podés volver a abrir este resumen cuando quieras desde el botón o el enlace en esta página.
                </p>
              </footer>
            </div>
        </AppModal>
      )}
    </>
  );
}
