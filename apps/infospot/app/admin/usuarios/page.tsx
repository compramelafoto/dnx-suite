import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@repo/db";
import { PageShell } from "@/components/page-shell";
import {
  canManageInfoSpotUsers,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";
import { formatDateTimeEs } from "@/lib/dates";
import { splitDisplayName } from "@/lib/display-name";
import { redirect } from "next/navigation";
import { AddMemberPanel } from "./add-member-panel";
import { MemberCard, type MemberCardData } from "./member-card";

export const metadata: Metadata = {
  title: "Equipo editorial",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type FilterKey =
  | "todos"
  | "directores"
  | "redactores"
  | "activos"
  | "desactivados"
  | "publicar"
  | "revision";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "directores", label: "Directores" },
  { key: "redactores", label: "Redactores" },
  { key: "activos", label: "Activos" },
  { key: "desactivados", label: "Desactivados" },
  { key: "publicar", label: "Publicación directa" },
  { key: "revision", label: "Requiere aprobación" },
];

type SearchParams = Promise<{ filtro?: string; q?: string }>;

function parseFilter(raw: string | undefined): FilterKey {
  const allowed = new Set(FILTERS.map((f) => f.key));
  if (raw && allowed.has(raw as FilterKey)) return raw as FilterKey;
  return "todos";
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const access = await requireInfoSpotAdminAccess();
  if (!canManageInfoSpotUsers(access.subject)) {
    redirect("/ingresar?forbidden=infospot-admin");
  }

  const params = await searchParams;
  const filtro = parseFilter(params.filtro);
  const q = (params.q ?? "").trim().toLowerCase();

  const members = await prisma.infoSpotUserRole.findMany({
    orderBy: [{ status: "asc" }, { role: "asc" }, { updatedAt: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          logoUrl: true,
          isBlocked: true,
          lastLoginAt: true,
        },
      },
    },
  });

  const changerIds = [
    ...new Set(
      members
        .flatMap((m) => [m.assignedByUserId, m.lastChangedByUserId])
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  const changers = changerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: changerIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const changerLabel = new Map(
    changers.map((u) => [u.id, u.name?.trim() || u.email]),
  );

  const cards: MemberCardData[] = members.map((m) => {
    const synced = {
      canPublish: m.canPublish,
      publicationPolicy: (m.publicationPolicy ??
        (m.canPublish ? "DIRECT_PUBLISH" : "REQUIRES_APPROVAL")) as
        | "DIRECT_PUBLISH"
        | "REQUIRES_APPROVAL",
    };
    const needsReview =
      m.role === "INFOSPOT_REDACTOR" &&
      m.status === "ACTIVE" &&
      synced.publicationPolicy === "REQUIRES_APPROVAL";
    const { firstName, lastName } = splitDisplayName(m.user.name);
    return {
      userId: m.userId,
      name: m.user.name?.trim() || m.user.email,
      firstName,
      lastName,
      email: m.user.email,
      avatarUrl: m.user.logoUrl?.trim() || null,
      role: m.role,
      status: m.status,
      canPublish: synced.canPublish,
      publicationPolicy: synced.publicationPolicy,
      canProvisionClfPhotographerCall:
        m.role === "INFOSPOT_DIRECTOR" || Boolean(m.canProvisionClfPhotographerCall),
      canNotifyClfPhotographerCall:
        m.role === "INFOSPOT_DIRECTOR" || Boolean(m.canNotifyClfPhotographerCall),
      isSelf: m.userId === access.user.id,
      isBlockedSuite: m.user.isBlocked,
      assignedAtLabel: formatDateTimeEs(m.createdAt),
      updatedAtLabel: formatDateTimeEs(m.updatedAt),
      assignedByLabel: m.assignedByUserId
        ? changerLabel.get(m.assignedByUserId) ?? `#${m.assignedByUserId}`
        : "No disponible",
      lastChangedByLabel: m.lastChangedByUserId
        ? changerLabel.get(m.lastChangedByUserId) ?? `#${m.lastChangedByUserId}`
        : "No disponible",
      lastAccessLabel: m.user.lastLoginAt
        ? formatDateTimeEs(m.user.lastLoginAt)
        : "No disponible",
      needsReview,
    };
  });

  const filtered = cards.filter((m) => {
    if (q) {
      const hay = `${m.name} ${m.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    switch (filtro) {
      case "directores":
        return m.role === "INFOSPOT_DIRECTOR";
      case "redactores":
        return m.role === "INFOSPOT_REDACTOR";
      case "activos":
        return m.status === "ACTIVE";
      case "desactivados":
        return m.status === "DISABLED";
      case "publicar":
        return (
          m.status === "ACTIVE" &&
          (m.publicationPolicy === "DIRECT_PUBLISH" || m.role === "INFOSPOT_DIRECTOR")
        );
      case "revision":
        return m.needsReview;
      default:
        return true;
    }
  });

  const stats = {
    total: cards.length,
    activos: cards.filter((m) => m.status === "ACTIVE").length,
    redactores: cards.filter((m) => m.role === "INFOSPOT_REDACTOR").length,
    revision: cards.filter((m) => m.needsReview).length,
  };

  return (
    <PageShell
      title="Equipo editorial"
      description="Administrá quién puede redactar, publicar y gestionar contenido en Info Spot."
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--is-accent)] underline-offset-2 hover:underline"
        >
          ← Admin
        </Link>
        <p className="text-sm text-[var(--is-muted)]">
          {stats.activos} activos · {stats.redactores} redactores
          {stats.revision > 0 ? ` · ${stats.revision} en revisión` : ""}
        </p>
      </div>

      <div className="mb-10">
        <AddMemberPanel />
      </div>

      <form
        method="get"
        className="mb-8 flex flex-col gap-4 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4 sm:flex-row sm:items-end sm:p-6"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="q" className="block text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Nombre o email"
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
          />
        </div>
        <input type="hidden" name="filtro" value={filtro} />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-5 text-sm font-semibold"
        >
          Buscar
        </button>
      </form>

      <div className="mb-8 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const href =
            f.key === "todos" && !q
              ? "/admin/usuarios"
              : `/admin/usuarios?filtro=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          const active = filtro === f.key;
          return (
            <Link
              key={f.key}
              href={href}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium ${
                active
                  ? "bg-[var(--is-accent)] text-[var(--is-bg)]"
                  : "border border-[var(--is-border)] text-[var(--is-text-secondary)] hover:bg-[var(--is-surface)]"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border)] bg-[var(--is-surface)] px-8 py-16 text-center">
          <p className="text-lg font-semibold tracking-tight text-[var(--is-text)]">
            {cards.length === 0 ? "Todavía no hay equipo" : "Sin resultados"}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--is-muted)]">
            {cards.length === 0
              ? "Agregá la primera redactora buscando su email DNX. Podrá entrar por /ingresar y trabajar en Redacción."
              : "Probá otro filtro o limpiá la búsqueda."}
          </p>
        </div>
      ) : (
        <ul className="space-y-8">
          {filtered.map((m) => (
            <li key={m.userId}>
              <MemberCard member={m} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
