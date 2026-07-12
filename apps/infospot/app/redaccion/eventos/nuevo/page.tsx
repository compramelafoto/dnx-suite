import type { Metadata } from "next";
import Link from "next/link";
import { createRedaccionEventAndRedirect } from "@/app/actions/events";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { prisma } from "@repo/db";
import { toDatetimeLocalValue } from "@/lib/dates";
import {
  canCreateInfoSpotEvent,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { redirect } from "next/navigation";
import { NewEventLocationFields } from "@/components/geolocation/new-event-location-fields";

export const metadata: Metadata = {
  title: "Nuevo evento — Redacción",
};

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NuevoEventoPage({ searchParams }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotEvent(access.subject)) {
    redirect("/redaccion/eventos?error=Sin%20permiso%20para%20crear%20eventos");
  }
  const params = await searchParams;
  const categories = await prisma.infoSpotCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const defaultStart = toDatetimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  return (
    <RedaccionShell
      header={
        <header className="rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-white px-5 py-8 sm:px-8">
          <Link href="/redaccion/eventos" className="text-sm text-[var(--is-accent)] hover:underline">
            ← Eventos
          </Link>
          <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-3xl font-semibold">
            Nuevo evento
          </h1>
          <p className="mt-2 text-sm text-[var(--is-muted)]">
            Se crea como borrador. Después podés enviarlo a revisión o publicarlo según tu rol.
          </p>
        </header>
      }
    >
      <FlashBanner error={params.error} />
      <form
        action={createRedaccionEventAndRedirect}
        encType="multipart/form-data"
        className="max-w-2xl space-y-6 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6"
      >
        <label className="block">
          <span className="text-sm font-medium">Título</span>
          <input name="title" required className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Slug</span>
          <input name="slug" required placeholder="mi-evento" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Descripción</span>
          <textarea name="description" required rows={6} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Categoría</span>
          <select name="categoryId" className={fieldClass}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Inicio</span>
          <input
            type="datetime-local"
            name="startAt"
            required
            defaultValue={defaultStart}
            className={fieldClass}
          />
        </label>
        <NewEventLocationFields />
        <label className="block">
          <span className="text-sm font-medium">Organizador</span>
          <input name="organizerName" required className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email del organizador</span>
          <input name="organizerEmail" type="email" required className={fieldClass} />
        </label>
        <input type="hidden" name="contentTag" value="NEEDS_REVIEW" />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white"
        >
          Crear borrador
        </button>
      </form>
    </RedaccionShell>
  );
}
