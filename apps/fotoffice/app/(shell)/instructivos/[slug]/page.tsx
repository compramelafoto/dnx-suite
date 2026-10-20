import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevels } from "@/lib/permissions/module-access";
import { isFullAccessRole } from "@/lib/permissions/levels";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { INSTRUCTIVOS, buscarInstructivo } from "@/lib/instructivos/catalogo";
import { instructivosVisibles } from "@/lib/instructivos/visibles";
import { BotonImprimir } from "./imprimir";

export const dynamic = "force-dynamic";

export default async function InstructivoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user, workspace } = await requireActiveWorkspace();
  const { slug } = await params;
  const guia = buscarInstructivo(slug);
  if (!guia) notFound();

  // Anterior y siguiente dentro del mismo tema, entre las guías que esta persona ve en el índice.
  const [levels, rol] = workspace
    ? await Promise.all([
        getModuleLevels(user.id, workspace.id),
        resolveWorkspaceRole(user.id, workspace.id),
      ])
    : [{}, null];
  const delTema = instructivosVisibles(INSTRUCTIVOS, levels, isFullAccessRole(rol)).filter(
    (g) => g.seccion === guia.seccion,
  );
  const posicion = delTema.findIndex((g) => g.slug === guia.slug);
  const anterior = posicion > 0 ? delTema[posicion - 1] : null;
  const siguiente = posicion >= 0 ? (delTema[posicion + 1] ?? null) : null;

  return (
    <article className="instructivo mx-auto max-w-3xl space-y-8">
      <Link href="/instructivos" className="text-xs text-[var(--fo-muted)] hover:underline print:hidden">
        ← Todos los instructivos
      </Link>

      <PageHeader
        title={guia.titulo}
        description={`${guia.resumen} · ${guia.pasos.length} pasos, unos ${guia.minutos} minutos.`}
        actions={<BotonImprimir />}
      />

      <nav aria-label="En esta guía" className="fo-card space-y-2 p-4 print:hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
          {guia.seccion} · En esta guía
        </p>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {guia.pasos.map((paso, i) => (
            <li key={i}>
              <a href={`#paso-${i + 1}`} className="text-[var(--fo-text)] hover:underline">
                {i + 1}. {paso.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <ol className="space-y-8">
        {guia.pasos.map((paso, i) => (
          <li key={i} id={`paso-${i + 1}`} className="fo-card scroll-mt-6 space-y-3 p-5 break-inside-avoid">
            <h2 className="flex items-baseline gap-3 text-base font-semibold text-[var(--fo-text)]">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent)] text-sm text-[var(--fo-on-accent,#fff)]">
                {i + 1}
              </span>
              {paso.titulo}
            </h2>
            {paso.texto.map((t, j) => (
              <p key={j} className="text-sm leading-relaxed text-[var(--fo-text)]">
                {t}
              </p>
            ))}
            {paso.imagen ? (
              // Capturas estáticas de /public: no hace falta el optimizador de imágenes.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={paso.imagen}
                alt={paso.imagenAlt ?? ""}
                loading="lazy"
                className="w-full rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)]"
              />
            ) : null}
            {paso.sistema?.length ? (
              <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2">
                <p className="text-xs font-semibold text-[var(--fo-text)]">Qué hace el sistema solo</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--fo-muted)]">
                  {paso.sistema.map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {paso.nota ? (
              <p className="rounded-[var(--fo-radius-sm)] border-l-4 border-[var(--fo-accent)] bg-[var(--fo-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--fo-muted)]">
                {paso.nota}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {anterior || siguiente ? (
        <nav aria-label="Otras guías del tema" className="flex flex-wrap justify-between gap-3 print:hidden">
          {anterior ? (
            <Link href={`/instructivos/${anterior.slug}`} className="fo-btn fo-btn-secondary">
              ← {anterior.titulo}
            </Link>
          ) : (
            <span />
          )}
          {siguiente ? (
            <Link href={`/instructivos/${siguiente.slug}`} className="fo-btn fo-btn-secondary">
              {siguiente.titulo} →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </article>
  );
}
