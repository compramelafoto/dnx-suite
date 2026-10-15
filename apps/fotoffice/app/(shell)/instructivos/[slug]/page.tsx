import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { buscarInstructivo } from "@/lib/instructivos/catalogo";
import { BotonImprimir } from "./imprimir";

export const dynamic = "force-dynamic";

export default async function InstructivoPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireActiveWorkspace();
  const { slug } = await params;
  const guia = buscarInstructivo(slug);
  if (!guia) notFound();

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

      <ol className="space-y-8">
        {guia.pasos.map((paso, i) => (
          <li key={i} className="fo-card space-y-3 p-5 break-inside-avoid">
            <h2 className="flex items-baseline gap-3 text-base font-semibold text-[var(--fo-text)]">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent)] text-sm text-white">
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
            {paso.nota ? (
              <p className="rounded-[var(--fo-radius-sm)] border-l-4 border-[var(--fo-accent)] bg-[var(--fo-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--fo-muted)]">
                {paso.nota}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </article>
  );
}
