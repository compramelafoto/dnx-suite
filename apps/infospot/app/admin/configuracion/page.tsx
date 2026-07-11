import type { Metadata } from "next";
import Link from "next/link";
import { updateInfoSpotSettingsAction } from "@/app/actions/settings";
import { PageShell } from "@/components/page-shell";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import {
  canManageInfoSpotSettings,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";
import { prisma } from "@repo/db";
import {
  getInfoSpotSettings,
  getLaunchInstitutionalBlockers,
} from "@/lib/settings";

export const metadata: Metadata = {
  title: "Configuración del medio",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";

export default async function AdminConfiguracionPage({ searchParams }: Props) {
  const access = await requireInfoSpotAdminAccess();
  if (!canManageInfoSpotSettings(access.subject)) {
    return (
      <PageShell title="Configuración" description="Solo el Director puede editar la configuración del medio.">
        <p className="text-sm text-[var(--is-muted)]">Sin permiso.</p>
      </PageShell>
    );
  }

  const params = await searchParams;
  const [s, rawSettings] = await Promise.all([
    getInfoSpotSettings(),
    prisma.infoSpotSettings.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);
  const blockers = getLaunchInstitutionalBlockers(s, rawSettings);
  const hardBlocks = blockers.filter((b) => b.severity === "block");
  const warns = blockers.filter((b) => b.severity === "warn");

  return (
    <PageShell
      title="Configuración del medio"
      description="Datos institucionales, contacto y SEO. Los campos vacíos no se inventan en el sitio público."
    >
      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        <Link href="/admin" className="text-[var(--is-accent)] hover:underline">
          ← Admin
        </Link>
        <Link href="/admin/lanzamiento" className="text-[var(--is-accent)] hover:underline">
          Panel de lanzamiento
        </Link>
      </div>

      <FlashBanner
        ok={params.ok === "saved" ? "Configuración guardada." : null}
        error={params.error}
      />

      {hardBlocks.length > 0 || warns.length > 0 ? (
        <div className="mb-8 space-y-4">
          <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] px-5 py-4 text-sm">
            <p className="font-semibold">Valores que debés completar manualmente</p>
            <p className="mt-2 text-[var(--is-text-secondary)]">
              No inventamos emails, redes ni domicilio. Las redes vacías no se muestran en el
              sitio y <strong>no bloquean</strong> el trabajo editorial.
            </p>
          </div>
          {hardBlocks.length > 0 ? (
            <div className="rounded-[var(--is-radius)] border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-950">
              <p className="font-semibold">Bloqueos de lanzamiento ({hardBlocks.length})</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {hardBlocks.map((b) => (
                  <li key={b.id}>{b.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {warns.length > 0 ? (
            <div className="rounded-[var(--is-radius)] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
              <p className="font-semibold">Avisos (no bloquean redacción)</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {warns.map((b) => (
                  <li key={b.id}>{b.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mb-8 rounded-[var(--is-radius)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
          Datos institucionales mínimos completos para go-live.
        </p>
      )}

      <form action={updateInfoSpotSettingsAction} className="mt-6 space-y-10">
        <fieldset className="space-y-4">
          <legend className="is-eyebrow">Identidad</legend>
          <label className="block text-sm font-medium">
            Nombre del medio
            <input name="siteName" required defaultValue={s.siteName} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            Slogan
            <input name="slogan" required defaultValue={s.slogan} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            URL pública
            <input
              name="publicUrl"
              type="url"
              placeholder="https://infospot.ar"
              defaultValue={s.publicUrl ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Logo URL
            <input
              name="logoUrl"
              placeholder="/brand/infospot-logo-horizontal.png"
              defaultValue={s.logoUrl ?? ""}
              className={fieldClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Ciudad base
              <input name="baseCity" defaultValue={s.baseCity ?? ""} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium">
              País
              <input name="country" defaultValue={s.country ?? "Argentina"} className={fieldClass} />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="is-eyebrow">Contacto</legend>
          <label className="block text-sm font-medium">
            Email editorial
            <input
              name="contactEmail"
              type="email"
              defaultValue={s.contactEmail ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Email de prensa
            <input
              name="pressEmail"
              type="email"
              defaultValue={s.pressEmail ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            WhatsApp (URL wa.me)
            <input
              name="whatsappUrl"
              type="url"
              placeholder="https://wa.me/54..."
              defaultValue={s.whatsappUrl ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Instagram
            <input
              name="instagramUrl"
              type="url"
              defaultValue={s.instagramUrl ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Facebook
            <input
              name="facebookUrl"
              type="url"
              defaultValue={s.facebookUrl ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            X
            <input name="xUrl" type="url" defaultValue={s.xUrl ?? ""} className={fieldClass} />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="is-eyebrow">SEO y textos</legend>
          <label className="block text-sm font-medium">
            SEO title
            <input name="seoTitle" defaultValue={s.seoTitle ?? ""} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            SEO description
            <textarea
              name="seoDescription"
              rows={3}
              defaultValue={s.seoDescription ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Imagen OG default (URL)
            <input
              name="defaultShareImageUrl"
              placeholder="/brand/og-default.png"
              defaultValue={s.defaultShareImageUrl ?? "/brand/og-default.png"}
              className={fieldClass}
            />
          </label>
          <p className="text-xs text-[var(--is-muted)]">
            Dejá vacías las redes que no existan. El footer no muestra enlaces vacíos.
          </p>
          <label className="block text-sm font-medium">
            Texto institucional
            <textarea
              name="institutionalText"
              rows={8}
              defaultValue={s.institutionalText ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Texto del footer
            <textarea
              name="footerText"
              rows={3}
              defaultValue={s.footerText ?? ""}
              className={fieldClass}
            />
          </label>
        </fieldset>

        <button type="submit" className="is-btn is-btn-solid">
          Guardar configuración
        </button>
      </form>
    </PageShell>
  );
}
