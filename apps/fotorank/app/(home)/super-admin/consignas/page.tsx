import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listItems,
  listThemes,
  getKpis,
  type PhotoPromptDifficulty,
  type PhotoPromptStatus,
} from "@repo/photo-prompt-library";
import { PromptLibraryCard } from "../../../components/super-admin/prompt-library/PromptLibraryCard";
import { PromptLibraryFilters } from "../../../components/super-admin/prompt-library/PromptLibraryFilters";
import { PromptLibraryKpis } from "../../../components/super-admin/prompt-library/PromptLibraryKpis";
import { requireAuth } from "../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../lib/fotorank/access/super-admin";
import { routes } from "../../../lib/routes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function SuperAdminConsignasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }

  const sp = await searchParams;
  const q = one(sp.q)?.trim() || undefined;
  const themeId = one(sp.themeId)?.trim() || undefined;
  const status = one(sp.status)?.trim() as PhotoPromptStatus | undefined;
  const difficulty = one(sp.difficulty)?.trim() as PhotoPromptDifficulty | undefined;
  const universalRaw = one(sp.universal);
  const inspirationRaw = one(sp.inspiration);
  const imported = one(sp.imported);

  const universal =
    universalRaw === "1" ? true : universalRaw === "0" ? false : undefined;

  const [kpis, themes, items] = await Promise.all([
    getKpis(),
    listThemes(),
    listItems({
      text: q,
      themeId,
      status,
      difficulty,
      universal,
      take: 200,
    }),
  ]);

  const filtered =
    inspirationRaw === "1"
      ? items.filter((i) => Boolean(i.inspirationType || i.inspirationLabel))
      : inspirationRaw === "0"
        ? items.filter((i) => !i.inspirationType && !i.inspirationLabel)
        : items;

  return (
    <div className="space-y-10" data-testid="super-admin-consignas">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <p className="fr-eyebrow text-gold">Super Administración</p>
          <h1 className="font-sans text-3xl font-semibold tracking-tight md:text-4xl">
            Biblioteca de Consignas
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-fr-muted">
            Catálogo editorial global. Aprobada no implica publicada al participante: la
            revelación ocurre en cada edición.
          </p>
          <Link
            href={routes.superAdmin.index()}
            className="text-sm text-gold hover:underline"
          >
            ← Volver al panel
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`${routes.superAdmin.consignas()}/nuevo`}
            className="fr-btn fr-btn-primary px-5 py-3 text-sm"
          >
            Crear
          </Link>
          <Link
            href={routes.superAdmin.import()}
            className="fr-btn fr-btn-secondary px-5 py-3 text-sm"
          >
            Importar
          </Link>
        </div>
      </header>

      {imported ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Se importaron {imported} consignas como borrador.
        </p>
      ) : null}

      <PromptLibraryKpis kpis={kpis} />

      <PromptLibraryFilters
        themes={themes.map((t) => ({ id: t.id, name: t.name }))}
        values={{
          q,
          themeId,
          status,
          difficulty,
          universal: universalRaw,
          inspiration: inspirationRaw,
        }}
      />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Consignas ({filtered.length})
        </h2>
        {filtered.length === 0 ? (
          <div className="fr-recuadro border border-fr-border bg-fr-card text-sm text-fr-muted">
            No hay consignas con estos filtros. Creá una o importá un JSON.
          </div>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {filtered.map((item) => (
              <li key={item.id}>
                <PromptLibraryCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
