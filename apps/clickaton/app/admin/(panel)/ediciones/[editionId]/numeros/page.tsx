import { notFound } from "next/navigation";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Money, StatTile, formatPesos } from "@/components/admin/edition-result/Money";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getEditionById } from "@/lib/admin/editions/queries";
import {
  deleteExpenseAction,
  deleteLeftoverAction,
  saveExpenseAction,
  saveFeeSettingsAction,
  saveLeftoverAction,
} from "@/lib/edition-result/application/actions";
import { getEditionResultPageData } from "@/lib/edition-result/application/queries";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  formatBpsAsPercent,
  minorToPesosInput,
} from "@/lib/edition-result/domain/result";

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

type Expense = Awaited<ReturnType<typeof getEditionResultPageData>>["expenses"][number];
type Leftover = Awaited<ReturnType<typeof getEditionResultPageData>>["leftovers"][number];

function dateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function dateLabel(value: Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(value);
}

function ExpenseFields({ expense, idPrefix }: { expense?: Expense; idPrefix: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {expense ? <input type="hidden" name="expenseId" value={expense.id} /> : null}
      <Field id={`${idPrefix}-concept`} label="Concepto" required>
        <Input name="concept" defaultValue={expense?.concept ?? ""} placeholder="Publicidad en Instagram" />
      </Field>
      <Field id={`${idPrefix}-amount`} label="Importe en pesos" required hint="Ej.: 230.000">
        <Input
          name="amount"
          inputMode="decimal"
          defaultValue={minorToPesosInput(expense?.amountMinor ?? null)}
          placeholder="230.000"
        />
      </Field>
      <Field id={`${idPrefix}-category`} label="Tipo de gasto">
        <Select name="category" defaultValue={expense?.category ?? "OTRO"}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${idPrefix}-paidBy`} label="Quién lo pagó" hint="Tammy, Dani, Rodri, la caja…">
        <Input name="paidBy" defaultValue={expense?.paidBy ?? ""} list="ck-payers" />
      </Field>
      <Field id={`${idPrefix}-spentAt`} label="Fecha">
        <Input type="date" name="spentAt" defaultValue={dateInput(expense?.spentAt ?? null)} />
      </Field>
      <label className="flex items-center gap-3 self-end pb-3 text-sm text-ck-text">
        <input type="checkbox" name="isEstimate" defaultChecked={expense?.isEstimate ?? false} className="h-5 w-5" />
        Es aproximado, después lo ajusto
      </label>
      <Field id={`${idPrefix}-description`} label="Descripción" className="sm:col-span-2">
        <Textarea
          name="description"
          defaultValue={expense?.description ?? ""}
          placeholder="Qué se compró, a quién, para qué, qué falta confirmar…"
        />
      </Field>
    </div>
  );
}

function LeftoverFields({
  item,
  idPrefix,
  otherEditions,
}: {
  item?: Leftover;
  idPrefix: string;
  otherEditions: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <Field id={`${idPrefix}-itemName`} label="Qué sobró" required>
        <Input name="itemName" defaultValue={item?.itemName ?? ""} placeholder="Remera Clickatón" />
      </Field>
      <Field id={`${idPrefix}-detail`} label="Detalle" hint="Talle, color…">
        <Input name="detail" defaultValue={item?.detail ?? ""} placeholder="Talle M" />
      </Field>
      <Field id={`${idPrefix}-quantity`} label="Cantidad contada" required>
        <Input name="quantity" inputMode="numeric" defaultValue={item ? String(item.quantity) : ""} />
      </Field>
      <Field id={`${idPrefix}-unitCost`} label="Costo por unidad en pesos" hint="Lo que costó cada una">
        <Input
          name="unitCost"
          inputMode="decimal"
          defaultValue={minorToPesosInput(item?.unitCostMinor ?? null)}
        />
      </Field>
      <Field id={`${idPrefix}-countedAt`} label="Fecha del conteo">
        <Input type="date" name="countedAt" defaultValue={dateInput(item?.countedAt ?? null)} />
      </Field>
      <Field
        id={`${idPrefix}-carried`}
        label="Pasa a la edición"
        hint="Si se va a usar en otra edición, allá cuenta como mercadería recibida."
      >
        <Select name="carriedToEditionId" defaultValue={item?.carriedToEditionId ?? ""}>
          <option value="">Queda guardado, sin asignar</option>
          {otherEditions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${idPrefix}-notes`} label="Notas" className="sm:col-span-2">
        <Textarea name="notes" defaultValue={item?.notes ?? ""} className="min-h-20" />
      </Field>
    </div>
  );
}

export default async function EditionNumbersPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const flash = await searchParams;
  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok || !editionResult.data) notFound();
  const edition = editionResult.data;

  const data = await getEditionResultPageData(editionId);
  const { result, settings, expenses, leftovers, received, otherEditions, income } = data;

  const saveExpense = saveExpenseAction.bind(null, editionId);
  const saveLeftover = saveLeftoverAction.bind(null, editionId);
  const saveFees = saveFeeSettingsAction.bind(null, editionId);

  const verdict =
    result.cashResultMinor >= 0
      ? { label: "Ganamos plata", variant: "success" as const }
      : { label: "Salimos para atrás", variant: "danger" as const };
  const payers = Array.from(
    new Set(["Tammy", "Dani", "Rodri", "Caja", ...expenses.map((e) => e.paidBy).filter(Boolean)]),
  ) as string[];

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title="Números reales de la edición"
        description="Lo que entró, lo que cobró Mercado Pago, lo que se gastó y lo que sobró. Así se ve edición por edición si salimos para atrás o no."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Números reales" },
        ]}
        actions={
          <Button href={adminRoutes.editionResults} variant="outline">
            Comparar ediciones
          </Button>
        }
      />

      {flash.ok ? <AdminFlashMessage flash="changes_saved" message={flash.ok} /> : null}
      {flash.error ? <AdminFlashMessage flash="error" message={flash.error} /> : null}

      <datalist id="ck-payers">
        {payers.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* Resumen */}
      <section className="space-y-4" aria-labelledby="resumen">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="resumen" className="ck-heading-sm text-ck-text">
            Resumen
          </h2>
          <Badge variant={verdict.variant}>{verdict.label}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Entró"
            minor={result.netCollectedMinor}
            hint={`${result.paidRegistrations} inscripciones pagas${
              result.refundedMinor > 0 ? ` · ya descontados ${formatPesos(result.refundedMinor)} devueltos` : ""
            }`}
          />
          <StatTile
            label="Mercado Pago se quedó"
            minor={-result.mpFeesTotalMinor}
            hint={
              result.mpFeesSource === "actual"
                ? "Monto real cargado"
                : result.mpFeesSource === "percent"
                  ? "Calculado con los porcentajes"
                  : "Sin cargar todavía"
            }
          />
          <StatTile
            label="Gastos"
            minor={-result.expensesTotalMinor}
            hint={`${expenses.length} gastos cargados`}
          />
          <StatTile
            label="Resultado en plata"
            minor={result.cashResultMinor}
            signed
            strong
            hint="Entró − Mercado Pago − gastos"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Sobrante que queda"
            minor={result.leftoverValueMinor}
            hint={`${result.leftoverUnits} unidades contadas`}
          />
          {result.receivedStockValueMinor > 0 ? (
            <StatTile
              label="Mercadería recibida"
              minor={-result.receivedStockValueMinor}
              hint="Sobrante de otra edición usado acá"
            />
          ) : null}
          <StatTile
            label="Resultado contando el sobrante"
            minor={result.economicResultMinor}
            signed
            strong
            hint="Lo que sobró no se perdió: se usa en la próxima"
          />
        </div>
        {result.warnings.length > 0 ? (
          <Card variant="outlined" className="space-y-2 border-[var(--ck-warning)]/50 p-4">
            <p className="text-sm font-semibold text-ck-text">Para que el número sea real, falta:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ck-text-secondary">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Card>
        ) : null}
      </section>

      {/* Ingresos */}
      <section className="space-y-4" aria-labelledby="ingresos">
        <h2 id="ingresos" className="ck-heading-sm text-ck-text">
          Lo que entró
        </h2>
        <Card variant="outlined" className="p-5">
          <p className="mb-4 text-sm text-ck-text-secondary">
            Sale solo de las inscripciones pagas (y regalos) que registró el sistema. No se carga a mano:
            se actualiza con cada venta.
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-ck-border pb-2">
              <dt className="text-ck-text-secondary">Cobrado en total</dt>
              <dd><Money minor={income.grossCollectedMinor} /></dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ck-border pb-2">
              <dt className="text-ck-text-secondary">Devuelto (reembolsos)</dt>
              <dd><Money minor={-income.refundedMinor} /></dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ck-border pb-2">
              <dt className="text-ck-text-secondary">Inscripciones pagas</dt>
              <dd className="tabular-nums">{income.paidRegistrations}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ck-border pb-2">
              <dt className="text-ck-text-secondary">Inscripciones gratis</dt>
              <dd className="tabular-nums">{income.freeRegistrations}</dd>
            </div>
          </dl>
        </Card>
      </section>

      {/* Comisiones MP */}
      <section className="space-y-4" aria-labelledby="comisiones">
        <h2 id="comisiones" className="ck-heading-sm text-ck-text">
          Lo que cobra Mercado Pago
        </h2>
        <Card variant="outlined" className="space-y-4 p-5">
          <p className="text-sm text-ck-text-secondary">
            Son dos cargos: la comisión por usar Mercado Pago y el porcentaje por retiro inmediato (que se
            calcula sobre lo que queda después de la comisión). Si mirás el resumen de Mercado Pago y tenés
            el total exacto que descontó, cargalo abajo: manda sobre los porcentajes.
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ck-text-muted">Comisión por uso</dt>
              <dd><Money minor={-result.mpProcessingFeeMinor} /></dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Retiro inmediato</dt>
              <dd><Money minor={-result.mpWithdrawalFeeMinor} /></dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Total que se quedó MP</dt>
              <dd className="font-semibold"><Money minor={-result.mpFeesTotalMinor} /></dd>
            </div>
          </dl>
          <form action={saveFees} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="fee-processing" label="% comisión por uso" hint="Ej.: 7,61">
                <Input
                  name="processingPercent"
                  inputMode="decimal"
                  defaultValue={formatBpsAsPercent(settings?.mpProcessingFeeBps ?? null)}
                />
              </Field>
              <Field id="fee-withdrawal" label="% retiro inmediato">
                <Input
                  name="withdrawalPercent"
                  inputMode="decimal"
                  defaultValue={formatBpsAsPercent(settings?.mpWithdrawalFeeBps ?? null)}
                />
              </Field>
              <Field id="fee-actual" label="Total real descontado (opcional)" hint="En pesos, según MP">
                <Input
                  name="actualFees"
                  inputMode="decimal"
                  defaultValue={minorToPesosInput(settings?.mpFeesActualMinor ?? null)}
                />
              </Field>
            </div>
            <Field id="fee-notes" label="Notas">
              <Textarea name="notes" defaultValue={settings?.notes ?? ""} className="min-h-20" />
            </Field>
            <Button type="submit">Guardar comisiones</Button>
          </form>
        </Card>
      </section>

      {/* Gastos */}
      <section className="space-y-4" aria-labelledby="gastos">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="gastos" className="ck-heading-sm text-ck-text">
            Gastos
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Total <Money minor={result.expensesTotalMinor} className="font-semibold text-ck-text" />
          </p>
        </div>

        {expenses.length === 0 ? (
          <Card variant="outlined" className="p-5 text-sm text-ck-text-secondary">
            Todavía no hay gastos cargados.
          </Card>
        ) : (
          <ul className="space-y-3">
            {expenses.map((e) => (
              <li key={e.id}>
                <Card variant="outlined" className="p-4">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-ck-text">
                          {e.concept}{" "}
                          {e.isEstimate ? <Badge variant="warning">Aproximado</Badge> : null}
                        </p>
                        <p className="text-xs text-ck-text-muted">
                          {expenseCategoryLabel(e.category)}
                          {e.paidBy ? ` · pagó ${e.paidBy}` : ""}
                          {e.spentAt ? ` · ${dateLabel(e.spentAt)}` : ""}
                        </p>
                        {e.description ? (
                          <p className="whitespace-pre-line text-sm text-ck-text-secondary">{e.description}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-ck-text">
                          <Money minor={e.amountMinor} />
                        </p>
                        <p className="text-xs text-ck-yellow">Editar</p>
                      </div>
                    </summary>
                    <div className="mt-4 space-y-4 border-t border-ck-border pt-4">
                      <form action={saveExpense} className="space-y-4">
                        <ExpenseFields expense={e} idPrefix={`exp-${e.id}`} />
                        <Button type="submit">Guardar cambios</Button>
                      </form>
                      <form action={deleteExpenseAction.bind(null, editionId, e.id)}>
                        <ConfirmSubmitButton
                          variant="outline"
                          size="sm"
                          confirmMessage={`¿Borrar el gasto "${e.concept}"?`}
                        >
                          Borrar gasto
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {result.expensesByPayer.length > 0 ? (
          <Card variant="outlined" className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-ck-text">Quién puso la plata</h3>
            <p className="text-xs text-ck-text-muted">
              Sirve para saber cuánto hay que reintegrarle a cada uno de su bolsillo.
            </p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {result.expensesByPayer.map((p) => (
                <div key={p.paidBy} className="flex justify-between gap-4 border-b border-ck-border pb-2">
                  <dt className="text-ck-text-secondary">{p.paidBy}</dt>
                  <dd><Money minor={p.totalMinor} /></dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}

        <Card variant="outlined" className="p-5">
          <details>
            <summary className="cursor-pointer font-semibold text-ck-yellow">+ Agregar un gasto</summary>
            <form action={saveExpense} className="mt-4 space-y-4">
              <ExpenseFields idPrefix="exp-new" />
              <Button type="submit">Agregar gasto</Button>
            </form>
          </details>
        </Card>
      </section>

      {/* Sobrante */}
      <section className="space-y-4" aria-labelledby="sobrante">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="sobrante" className="ck-heading-sm text-ck-text">
            Lo que sobró (stock contado)
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Vale <Money minor={result.leftoverValueMinor} className="font-semibold text-ck-text" />
          </p>
        </div>
        <p className="text-sm text-ck-text-secondary">
          Contalo a mano al terminar la edición. No cambia el stock de venta del catálogo: es el inventario
          físico que quedó guardado.
        </p>

        {leftovers.length === 0 ? (
          <Card variant="outlined" className="p-5 text-sm text-ck-text-secondary">
            Todavía no se cargó el conteo.
          </Card>
        ) : (
          <ul className="space-y-3">
            {leftovers.map((item) => (
              <li key={item.id}>
                <Card variant="outlined" className="p-4">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-ck-text">
                          {item.quantity} × {item.itemName}
                          {item.detail ? ` · ${item.detail}` : ""}
                        </p>
                        <p className="text-xs text-ck-text-muted">
                          {item.unitCostMinor != null
                            ? `${formatPesos(item.unitCostMinor)} c/u`
                            : "Sin costo por unidad"}
                          {item.carriedToEdition ? ` · pasa a ${item.carriedToEdition.name}` : ""}
                          {item.countedAt ? ` · contado el ${dateLabel(item.countedAt)}` : ""}
                        </p>
                        {item.notes ? (
                          <p className="whitespace-pre-line text-sm text-ck-text-secondary">{item.notes}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-ck-text">
                          {item.unitCostMinor != null ? (
                            <Money minor={item.unitCostMinor * item.quantity} />
                          ) : (
                            "—"
                          )}
                        </p>
                        <p className="text-xs text-ck-yellow">Editar</p>
                      </div>
                    </summary>
                    <div className="mt-4 space-y-4 border-t border-ck-border pt-4">
                      <form action={saveLeftover} className="space-y-4">
                        <LeftoverFields item={item} idPrefix={`lo-${item.id}`} otherEditions={otherEditions} />
                        <Button type="submit">Guardar cambios</Button>
                      </form>
                      <form action={deleteLeftoverAction.bind(null, editionId, item.id)}>
                        <ConfirmSubmitButton
                          variant="outline"
                          size="sm"
                          confirmMessage={`¿Borrar "${item.itemName}" del conteo?`}
                        >
                          Borrar del conteo
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <Card variant="outlined" className="p-5">
          <details>
            <summary className="cursor-pointer font-semibold text-ck-yellow">+ Agregar lo que sobró</summary>
            <form action={saveLeftover} className="mt-4 space-y-4">
              <LeftoverFields idPrefix="lo-new" otherEditions={otherEditions} />
              <Button type="submit">Agregar al conteo</Button>
            </form>
          </details>
        </Card>
      </section>

      {received.length > 0 ? (
        <section className="space-y-4" aria-labelledby="recibido">
          <h2 id="recibido" className="ck-heading-sm text-ck-text">
            Mercadería que viene de otra edición
          </h2>
          <Card variant="outlined" className="p-5">
            <p className="mb-3 text-sm text-ck-text-secondary">
              Sobró en una edición anterior y se usa en esta: acá cuenta como costo. Se edita desde la
              edición de origen.
            </p>
            <ul className="space-y-2 text-sm">
              {received.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 border-b border-ck-border pb-2">
                  <span className="text-ck-text-secondary">
                    {item.quantity} × {item.itemName}
                    {item.detail ? ` · ${item.detail}` : ""} — de {item.edition.name}
                  </span>
                  <span>
                    {item.unitCostMinor != null ? <Money minor={item.unitCostMinor * item.quantity} /> : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
