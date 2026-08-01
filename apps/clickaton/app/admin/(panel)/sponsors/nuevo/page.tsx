import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { createPartnerFormAction } from "@/lib/admin/partners/mutations";
import { DNX_PARTNER_STATUSES, DNX_PARTNER_TYPES } from "@repo/partners";

export default async function AdminNewPartnerPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireClickatonAdmin();
  const sp = (await searchParams) ?? {};

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Nuevo partner"
        description="Ficha canónica DNX. Los datos fiscales y de contacto son opcionales."
        breadcrumbs={[
          { label: "Sponsors y beneficios", href: adminRoutes.sponsors },
          { label: "Nuevo" },
        ]}
        actions={<Button href={adminRoutes.sponsors} variant="secondary">Volver</Button>}
      />

      {sp.error ? (
        <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
          {sp.error}
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-6 p-6">
        <form action={createPartnerFormAction} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Field id="name" label="Nombre" required>
              <Input name="name" placeholder="Tecnoflash" />
            </Field>
            <Field id="slug" label="Slug (opcional)">
              <Input name="slug" placeholder="tecnoflash" />
            </Field>
            <Field id="legalName" label="Razón social">
              <Input name="legalName" />
            </Field>
            <Field id="type" label="Tipo">
              <Select name="type" defaultValue="COMPANY">
                {DNX_PARTNER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="status" label="Estado">
              <Select name="status" defaultValue="PROSPECT">
                {DNX_PARTNER_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="websiteUrl" label="Sitio web">
              <Input name="websiteUrl" type="url" />
            </Field>
            <Field id="instagram" label="Instagram">
              <Input name="instagram" />
            </Field>
            <Field id="email" label="Email">
              <Input name="email" type="email" />
            </Field>
            <Field id="phone" label="Teléfono">
              <Input name="phone" />
            </Field>
            <Field id="taxId" label="CUIT / tax id (opcional)">
              <Input name="taxId" />
            </Field>
            <Field id="logoUrl" label="Logo URL">
              <Input name="logoUrl" />
            </Field>
          </div>
          <Field id="description" label="Descripción">
            <Textarea name="description" rows={3} />
          </Field>
          <Field id="notes" label="Notas internas">
            <Textarea name="notes" rows={3} />
          </Field>
          <div className="flex gap-3 border-t border-ck-border pt-6">
            <Button type="submit">Crear partner</Button>
            <Button href={adminRoutes.sponsors} variant="secondary">
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
