import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@repo/design-system";
import { listPublicJudgesForContestBySlug } from "../../../actions/judges";

type PublicJudgeCard = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  publicSlug: string;
  shortBio: string | null;
  categories: string[];
};

export default async function ContestPublicJudgesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await listPublicJudgesForContestBySlug(slug);
  if (!result.ok) return notFound();

  const judges = (result.data ?? []) as PublicJudgeCard[];

  return (
    <div className="min-h-screen bg-fr-bg p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-semibold text-fr-primary">Jurados del concurso</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {judges.map((j) => (
            <Card key={j.publicSlug}>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  {j.avatarUrl ? (
                    <img
                      src={j.avatarUrl}
                      alt={`${j.firstName} ${j.lastName}`}
                      className="h-16 w-16 shrink-0 rounded-full border border-zinc-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-600 text-xs text-fr-muted">
                      —
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-fr-primary">
                      {j.firstName} {j.lastName}
                    </h2>
                    {j.shortBio ? (
                      <p className="line-clamp-3 text-sm text-fr-muted">{j.shortBio}</p>
                    ) : (
                      <p className="text-sm text-fr-muted-soft">Sin resumen público.</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-fr-muted-soft">Categorías: {j.categories.join(", ")}</p>
                <Link
                  href={`/jurados/publico/${j.publicSlug}`}
                  className="inline-block text-sm font-medium text-fr-primary underline decoration-fr-primary/40 underline-offset-2 hover:decoration-fr-primary"
                >
                  Ver perfil público
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
