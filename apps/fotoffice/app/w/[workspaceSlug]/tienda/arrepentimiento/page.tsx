import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { loadStoreWorkspace } from "@/lib/store/repository";
import { StoreLegalFooter } from "@/components/store/store-legal-footer";
import { RegretForm } from "./regret-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await loadStoreWorkspace((await params).workspaceSlug);
  return store ? { title: `Botón de arrepentimiento — ${store.workspace.name}` } : {};
}

/**
 * El botón de arrepentimiento (Res. SCI 424/2020). FUERA del grupo `(abierta)`: quien compró
 * tiene que poder arrepentirse aunque la tienda se haya cerrado. Basta con que la institución
 * exista.
 */
export default async function RegretPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const store = await loadStoreWorkspace(workspaceSlug);
  if (!store) notFound();
  const base = `/w/${store.workspace.slug}/${STORE_PUBLIC_SEGMENT}`;

  return (
    <>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-8 md:py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Botón de arrepentimiento</h1>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Si compraste en la tienda online de {store.workspace.name}, podés arrepentirte de la compra dentro de los 10
            días corridos desde que retiraste el producto, sin dar explicaciones. Completá tu número de pedido y el email
            con el que compraste: te damos un código de trámite y la institución se comunica con vos para coordinar la
            devolución.
          </p>
          <p className="text-sm text-[var(--fo-muted)]">
            Las condiciones están en{" "}
            <Link href={`${base}/terminos`} className="underline underline-offset-4">
              Términos y devoluciones
            </Link>
            .
          </p>
        </div>
        <div className="fo-card p-5 md:p-6">
          <RegretForm workspaceSlug={store.workspace.slug} institution={store.workspace.name} />
        </div>
      </main>
      <StoreLegalFooter workspaceSlug={store.workspace.slug} />
    </>
  );
}
