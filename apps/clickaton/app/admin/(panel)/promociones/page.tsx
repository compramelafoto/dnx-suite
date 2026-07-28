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
import { formatAdminDateTime } from "@/lib/admin/datetime-input";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import {
  createPromotionFormAction,
  setPromotionActiveAction,
} from "@/lib/admin/promotions/mutations";
import { displayRegistrationAmount } from "@/lib/admin-registration/ui/status-labels";
import {
  countPromotionRedemptions,
  listClickatonPromotions,
} from "@/lib/promotions/prisma-promotions-adapter";
import { withClickatonDb } from "@/lib/admin/db";

export default async function AdminPromotionsPage() {
  await requireClickatonAdmin();

  const listResult = await withClickatonDb(async () => listClickatonPromotions());
  if (!listResult.ok) {
    return (
      <div className="space-y-6">
        <AdminMigrationNotice message={listResult.message} />
      </div>
    );
  }

  const editions = await listEditionOptions();
  const editionOptions = editions.ok ? editions.data : [];

  const rows = await Promise.all(
    listResult.data.map(async (p) => ({
      promo: p,
      usage: await countPromotionRedemptions(p.id),
    })),
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Promociones"
        description="Códigos reutilizables DNX (@repo/promotions). Cálculo solo en backend. No se crean códigos de producción automáticamente."
        breadcrumbs={[{ label: "Promociones" }]}
      />

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="text-lg font-semibold text-ck-text">Códigos existentes</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Todavía no hay promociones.</p>
        ) : (
          <ul className="space-y-4">
            {rows.map(({ promo, usage }) => (
              <li
                key={promo.id}
                className="flex flex-col gap-3 border-b border-ck-border pb-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium text-ck-text">
                    {promo.code}{" "}
                    <span className="text-sm text-ck-text-muted">
                      ({promo.isActive ? "activa" : "inactiva"})
                    </span>
                  </p>
                  <p className="text-sm text-ck-text">{promo.name}</p>
                  <p className="text-sm text-ck-text">
                    {promo.discountType === "PERCENTAGE"
                      ? `${promo.discountValue}% OFF`
                      : displayRegistrationAmount(promo.discountValue, "ARS")}
                  </p>
                  <p className="text-xs text-ck-text-muted">
                    {formatAdminDateTime(promo.startsAt)} → {formatAdminDateTime(promo.endsAt)} ·
                    usos activos {usage.active}/{promo.totalUsageLimit ?? "∞"} · total{" "}
                    {usage.total}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await setPromotionActiveAction(promo.id, !promo.isActive);
                  }}
                >
                  <Button type="submit" variant="secondary">
                    {promo.isActive ? "Desactivar" : "Activar"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card variant="outlined" className="p-5">
        <h2 className="mb-6 text-lg font-semibold text-ck-text">Crear código</h2>
        <form action={createPromotionFormAction} className="grid gap-6 md:grid-cols-2">
          <Field id="code" label="Código" required hint="Se normaliza a mayúsculas">
            <Input name="code" placeholder="CLICKATON50" autoComplete="off" />
          </Field>
          <Field id="name" label="Nombre" required>
            <Input name="name" placeholder="50% Clickatón" />
          </Field>
          <Field id="discountType" label="Tipo">
            <Select name="discountType" defaultValue="PERCENTAGE">
              <option value="PERCENTAGE">Porcentaje</option>
              <option value="FIXED_AMOUNT">Monto fijo (pesos)</option>
            </Select>
          </Field>
          <Field
            id="discountValue"
            label="Valor"
            required
            hint="Porcentaje 1–100, o pesos enteros si es monto fijo"
          >
            <Input name="discountValue" inputMode="numeric" placeholder="50" />
          </Field>
          <Field id="startsAt" label="Vigencia desde" required>
            <Input type="datetime-local" name="startsAt" />
          </Field>
          <Field id="endsAt" label="Vigencia hasta" required>
            <Input type="datetime-local" name="endsAt" />
          </Field>
          <Field id="minimumPurchaseAmountPesos" label="Compra mínima (pesos)">
            <Input name="minimumPurchaseAmountPesos" inputMode="numeric" />
          </Field>
          <Field id="maxDiscountAmountPesos" label="Tope de descuento (pesos)">
            <Input name="maxDiscountAmountPesos" inputMode="numeric" />
          </Field>
          <Field id="totalUsageLimit" label="Límite total de usos">
            <Input name="totalUsageLimit" inputMode="numeric" />
          </Field>
          <Field id="perUserUsageLimit" label="Límite por usuario" hint="Default 1">
            <Input name="perUserUsageLimit" inputMode="numeric" defaultValue="1" />
          </Field>
          <Field id="editionId" label="Edición (opcional)">
            <Select name="editionId" defaultValue="">
              <option value="">Todas las ediciones Clickatón</option>
              {editionOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-ck-text md:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="size-4 rounded border-ck-border"
            />
            Activa
          </label>
          <div className="md:col-span-2">
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={2} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="primary">
              Crear promoción
            </Button>
            <p className="mt-3 text-xs text-ck-text-muted">
              Fixtures de prueba sugeridos (crear solo en TEST): CLICKATON50 (50%), BIENVENIDA5000
              ($5.000). Nunca seed automático en producción. Ver{" "}
              <a className="underline" href={adminRoutes.integrations}>
                Integraciones
              </a>
              .
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
