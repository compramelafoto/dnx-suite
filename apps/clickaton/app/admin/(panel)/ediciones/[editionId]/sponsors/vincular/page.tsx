import { notFound } from "next/navigation";
import {
  CLICKATON_PARTICIPATION_ROLE_OPTIONS,
  DNX_PARTNER_PARTICIPATION_STATUSES,
} from "@repo/partners";
import { RequiresPaymentFields } from "@/components/admin/partners/RequiresPaymentFields";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import {
  createEditionParticipationFormAction,
  createPartnerForEditionFormAction,
} from "@/lib/admin/edition-partners/mutations";
import { getEditionById } from "@/lib/admin/editions/queries";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{
    error?: string;
    ok?: string;
    partnerId?: string;
    q?: string;
  }>;
};

export default async function VincularEditionPartnerPage({ params, searchParams }: Props) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const { editionId } = await params;
  const sp = await searchParams;

  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok || !editionResult.data) notFound();
  const edition = editionResult.data;

  const partnersResult = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    return svc.listPartners(actor, { search: sp.q?.trim() || undefined });
  });

  if (!partnersResult.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Vincular partner" />
        <AdminMigrationNotice message={partnersResult.message} />
      </div>
    );
  }

  const partners = partnersResult.data;
  const preselected = sp.partnerId ?? partners[0]?.id ?? "";
  const base = `${adminRoutes.editions}/${editionId}/sponsors`;

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title="Vincular partner a la edición"
        description="Reutiliza la ficha canónica DnxPartner. No se duplican datos comerciales en la edición."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Sponsors y beneficios", href: base },
          { label: "Vincular" },
        ]}
      />

      {sp.error ? (
        <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
          {sp.error}
        </Card>
      ) : null}
      {sp.ok === "partner_created" ? (
        <Card variant="outlined" className="border-emerald-500/30 p-4 text-sm text-ck-text-secondary">
          Partner creado. Completá la participación abajo.
        </Card>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">1. Buscar partner existente</h2>
        <Card variant="outlined" className="space-y-6 p-6">
          <form method="get" className="flex flex-wrap items-end gap-4">
            <Field id="q" label="Buscar">
              <Input name="q" defaultValue={sp.q ?? ""} placeholder="Nombre o slug" />
            </Field>
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">2. Crear participación</h2>
        <Card variant="outlined" className="space-y-6 p-6">
          <form action={createEditionParticipationFormAction} className="space-y-6">
            <input type="hidden" name="editionId" value={editionId} />
            <Field id="partnerId" label="Partner" required>
              <Select name="partnerId" defaultValue={preselected} required>
                {partners.length === 0 ? (
                  <option value="">No hay partners — creá uno abajo</option>
                ) : (
                  partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))
                )}
              </Select>
            </Field>
            <Field id="role" label="Tipo de participación" required>
              <Select name="role" defaultValue="SPONSOR">
                {CLICKATON_PARTICIPATION_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="title" label="Título">
              <Input name="title" placeholder="Ej. Sponsor principal · Kit impresión" />
            </Field>
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={3} />
            </Field>
            <Field id="status" label="Estado">
              <Select name="status" defaultValue="DRAFT">
                {DNX_PARTNER_PARTICIPATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="startsAt" label="Inicio">
                <Input name="startsAt" type="datetime-local" />
              </Field>
              <Field id="endsAt" label="Fin">
                <Input name="endsAt" type="datetime-local" />
              </Field>
            </div>
            <Field id="categoryId" label="ID categoría (solo sponsor de categoría)">
              <Input name="categoryId" placeholder="Opcional" />
            </Field>
            <Field id="venueId" label="ID sede (solo sponsor de sede)">
              <Input name="venueId" placeholder="Opcional" />
            </Field>
            <Field id="estimatedValueMinor" label="Valor estimado (centavos, opcional)">
              <Input name="estimatedValueMinor" type="number" min={0} />
            </Field>
            <Field id="notes" label="Notas">
              <Textarea name="notes" rows={2} />
            </Field>
            <RequiresPaymentFields />
            <Field id="allowDuplicateActive" label="Confirmar si ya existe participación similar">
              <Select name="allowDuplicateActive" defaultValue="false">
                <option value="false">No — bloquear duplicado activo</option>
                <option value="true">Sí — permitir duplicado</option>
              </Select>
            </Field>
            <Button type="submit" variant="primary" disabled={partners.length === 0}>
              Crear participación
            </Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">3. Crear partner nuevo (canónico)</h2>
        <Card variant="outlined" className="space-y-6 p-6">
          <p className="text-sm text-ck-text-secondary">
            Usa el mismo flujo de `DnxPartner`. Luego se preselecciona para vincular a la edición.
          </p>
          <form action={createPartnerForEditionFormAction} className="space-y-6">
            <input type="hidden" name="editionId" value={editionId} />
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="name" label="Nombre" required>
                <Input name="name" required />
              </Field>
              <Field id="slug" label="Slug">
                <Input name="slug" placeholder="auto desde nombre" />
              </Field>
              <Field id="legalName" label="Razón social">
                <Input name="legalName" />
              </Field>
              <Field id="email" label="Email">
                <Input name="email" type="email" />
              </Field>
              <Field id="websiteUrl" label="Web">
                <Input name="websiteUrl" />
              </Field>
              <Field id="logoUrl" label="Logo URL (temporal)">
                <Input name="logoUrl" placeholder="https://…" />
              </Field>
            </div>
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={3} />
            </Field>
            <Button type="submit" variant="secondary">
              Crear partner y continuar
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
