import Link from "next/link";
import { Role } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DESIGN_STATUS_TONES, designStatusLabel } from "@/lib/design-v2/labels";
import { DESIGN_STATUSES_TO_REVIEW, listDesignProjectsForActor } from "@/lib/design-v2/list";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "revisar", label: "Para revisar" },
  { key: "cambios", label: "Cambios pedidos" },
  { key: "aprobados", label: "Aprobados" },
  { key: "todos", label: "Todos" },
] as const;

function matches(filter: string, status: string): boolean {
  if (filter === "revisar") return DESIGN_STATUSES_TO_REVIEW.includes(status);
  if (filter === "cambios") return status === "NEEDS_ADJUSTMENT";
  if (filter === "aprobados") return status === "EXPORTED";
  return true;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

export default async function DisenosPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const user = await getAuthUser();
  const allowed: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];
  if (!user || !allowed.includes(user.role)) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-5 py-8">
        <Card className="p-6">
          <p className="text-sm text-[#6b7280]">No tenés permisos para ver esta sección.</p>
        </Card>
      </div>
    );
  }

  const designs = await listDesignProjectsForActor(prisma, { id: user.id, role: String(user.role) });
  const requested = (await searchParams).ver;
  const filter = requested && FILTERS.some((f) => f.key === requested) ? requested : "revisar";
  const visible = designs.filter((d) => matches(filter, d.status));

  return (
    <div className="mx-auto w-full max-w-screen-xl px-5 py-8 sm:px-8 lg:px-12">
      <h1 className="text-2xl font-bold text-[#111827] sm:text-3xl">Diseños</h1>
      <p className="mt-2 max-w-3xl text-base text-[#6b7280]">
        Cuando un cliente elige sus fotos en un pack con diseño, el diseño se arma solo con tu plantilla. Revisalo,
        corregilo si hace falta y aprobalo: al aprobarlo le llega al cliente.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filtrar diseños">
        {FILTERS.map((f) => {
          const count = designs.filter((d) => matches(f.key, d.status)).length;
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={`/fotografo/disenos?ver=${f.key}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
                active ? "bg-[#111827] text-white ring-[#111827]" : "bg-white text-[#374151] ring-[#e5e7eb] hover:bg-[#f9fafb]"
              }`}
            >
              {f.label} <span className={active ? "text-white/70" : "text-[#9ca3af]"}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <Card className="mt-6 p-8">
          <p className="text-sm text-[#6b7280]">
            {filter === "revisar"
              ? "No tenés diseños para revisar. Aparecen acá cuando un cliente elige sus fotos en un pack con diseño."
              : "No hay diseños en esta lista."}
          </p>
          <p className="mt-3 text-sm text-[#6b7280]">
            ¿Querés ver cómo queda una plantilla con fotos?{" "}
            <Link href="/fotografo/diseno/plantillas/v2" className="font-medium text-[#c27b3d] underline">
              Probala desde Plantillas
            </Link>
            .
          </p>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-3">
          {visible.map((d) => (
            <li key={d.id}>
              <Link
                href={`/fotografo/disenos/${d.id}`}
                className="flex items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-3 transition hover:border-[#c27b3d]"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f3f4f6]">
                  {d.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#111827]">
                    {d.buyerLabel ?? "Cliente"} · {d.templateName ?? "Plantilla"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#6b7280]">
                    {d.albumTitle ?? "Álbum"} · {d.source === "PREVENTA" ? "Preventa" : "Pack"} · {formatDate(d.updatedAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                    DESIGN_STATUS_TONES[d.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"
                  }`}
                >
                  {designStatusLabel(d.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
