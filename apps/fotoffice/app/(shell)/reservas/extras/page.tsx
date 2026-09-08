import { PageHeader } from "@/components/page-header";
import { formatMinorArs } from "@/lib/membership/money";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { listExtras, listResources, listSpaces } from "@/lib/bookings/repository";
import {
  deleteResourceAction,
  saveExtraAction,
  saveResourceAction,
  toggleExtraActiveAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ExtrasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; editar?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const params = await searchParams;

  const [recursos, extras, espacios] = await Promise.all([
    listResources(workspace.id),
    listExtras(workspace.id),
    listSpaces(workspace.id, { includeInactive: true }),
  ]);
  const nombrePorEspacio = new Map(espacios.map((e) => [e.id, e.name]));
  const enEdicion = params.editar ? (extras.find((e) => e.id === params.editar) ?? null) : null;
  const pesos = (minor: number) =>
    minor === 0 ? "" : formatMinorArs(minor).replace("$", "").trim();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Extras"
        description="Lo que se alquila junto con un espacio. Primero cargá el inventario; después, lo que se vende."
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Inventario</h2>
        <p className="fo-helper">
          Lo que hay que contar, y cuántos hay. Un extra sin recurso se puede pedir siempre —el
          fondo de papel, del que hay de sobra—. Con recurso, el sistema no promete más de lo
          que existe: el flash suelto y el pack de dos salen del mismo par.
        </p>

        {recursos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">Todavía no hay recursos cargados.</p>
        ) : (
          <ul className="space-y-2">
            {recursos.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fo-border)] pb-2 last:border-0"
              >
                <span className="text-sm">
                  {r.name} — {r.quantity} {r.quantity === 1 ? "unidad" : "unidades"}
                </span>
                <form action={deleteResourceAction}>
                  <input type="hidden" name="resourceId" value={r.id} />
                  <button
                    type="submit"
                    className="text-xs text-[var(--fo-danger)] underline underline-offset-4"
                    title="Los extras que lo usaban dejan de controlar cantidad."
                  >
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={saveResourceAction} className="grid gap-4 sm:grid-cols-3">
          <div className="fo-field-stack sm:col-span-2">
            <label className="fo-label" htmlFor="recurso-nombre">
              Nombre del recurso
            </label>
            <input id="recurso-nombre" name="name" className="fo-input" placeholder="Flash" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="recurso-cantidad">
              Cuántos hay
            </label>
            <input
              id="recurso-cantidad"
              name="quantity"
              type="number"
              min={0}
              className="fo-input"
              defaultValue={1}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Agregar recurso
            </button>
          </div>
        </form>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Extras</h2>
        {extras.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">Todavía no hay extras cargados.</p>
        ) : (
          <ul className="space-y-3">
            {extras.map((extra) => (
              <li
                key={extra.id}
                className={`flex flex-wrap items-start justify-between gap-3 border-b border-[var(--fo-border)] pb-3 last:border-0 ${extra.active ? "" : "opacity-50"}`}
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    {extra.name}
                    {extra.requiresConfirmation ? (
                      <span className="ml-2 text-xs font-normal text-[var(--fo-muted)]">
                        a confirmar
                      </span>
                    ) : null}
                    {extra.active ? null : (
                      <span className="ml-2 text-xs font-normal text-[var(--fo-muted-soft)]">
                        desactivado
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    Socios {formatMinorArs(extra.memberPriceMinor)} · No socios{" "}
                    {formatMinorArs(extra.nonMemberPriceMinor)} ·{" "}
                    {extra.priceMode === "PER_HOUR" ? "por hora" : "una vez por reserva"}
                  </p>
                  <p className="text-xs text-[var(--fo-muted-soft)]">
                    {extra.resourceId
                      ? `Consume ${extra.unitsConsumed} × ${extra.resourceName ?? "recurso"}`
                      : "Sin control de cantidad"}
                    {" · Se ofrece en: "}
                    {extra.spaceIds.map((id) => nombrePorEspacio.get(id) ?? "?").join(", ") ||
                      "ningún espacio"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <a
                    href={`/reservas/extras?editar=${extra.id}`}
                    className="fo-btn fo-btn-secondary text-xs"
                  >
                    Editar
                  </a>
                  <form action={toggleExtraActiveAction}>
                    <input type="hidden" name="extraId" value={extra.id} />
                    <input type="hidden" name="active" value={extra.active ? "off" : "on"} />
                    <button
                      type="submit"
                      className="text-xs text-[var(--fo-muted)] underline underline-offset-4"
                    >
                      {extra.active ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={saveExtraAction} className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">
          {enEdicion ? `Editar: ${enEdicion.name}` : "Nuevo extra"}
        </h2>
        {enEdicion ? <input type="hidden" name="extraId" value={enEdicion.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="extra-name">
              Nombre
            </label>
            <input
              id="extra-name"
              name="name"
              className="fo-input"
              defaultValue={enEdicion?.name ?? ""}
              placeholder="Pack de 2 flashes"
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="extra-description">
              Descripción
            </label>
            <input
              id="extra-description"
              name="description"
              className="fo-input"
              defaultValue={enEdicion?.description ?? ""}
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="extra-member">
              Precio para socios
            </label>
            <input
              id="extra-member"
              name="memberPriceArs"
              className="fo-input"
              defaultValue={enEdicion ? pesos(enEdicion.memberPriceMinor) : ""}
              placeholder="1.600"
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="extra-nonmember">
              Precio para no socios
            </label>
            <input
              id="extra-nonmember"
              name="nonMemberPriceArs"
              className="fo-input"
              defaultValue={enEdicion ? pesos(enEdicion.nonMemberPriceMinor) : ""}
              placeholder="2.500"
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="extra-mode">
              Cómo se cobra
            </label>
            <select
              id="extra-mode"
              name="priceMode"
              className="fo-input"
              defaultValue={enEdicion?.priceMode ?? "PER_BOOKING"}
            >
              <option value="PER_BOOKING">Una vez por reserva</option>
              <option value="PER_HOUR">Por cada hora</option>
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="extra-resource">
              Qué consume
            </label>
            <select
              id="extra-resource"
              name="resourceId"
              className="fo-input"
              defaultValue={enEdicion?.resourceId ?? ""}
            >
              <option value="">Sin control de cantidad</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.quantity})
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="extra-units">
              Unidades que consume
            </label>
            <input
              id="extra-units"
              name="unitsConsumed"
              type="number"
              min={1}
              className="fo-input"
              defaultValue={enEdicion?.unitsConsumed ?? 1}
            />
            <p className="fo-helper">El pack de dos flashes consume 2; el suelto, 1.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requiresConfirmation"
            defaultChecked={enEdicion?.requiresConfirmation ?? false}
          />
          Requiere confirmación de la institución
        </label>
        <p className="fo-helper">
          La reserva queda a aprobar y <strong>no se cobra</strong> hasta que la institución
          confirme o quite el extra. Para lo que hay que coordinar con una persona.
        </p>

        <div className="fo-field-stack">
          <span className="fo-label">En qué espacios se ofrece</span>
          {espacios.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Cargá un espacio antes de poder ofrecer extras.
            </p>
          ) : (
            <div className="space-y-2">
              {espacios.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="spaceIds"
                    value={e.id}
                    defaultChecked={enEdicion?.spaceIds.includes(e.id) ?? false}
                  />
                  {e.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="fo-form-actions">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            {enEdicion ? "Guardar cambios" : "Crear extra"}
          </button>
          {enEdicion ? (
            <a href="/reservas/extras" className="fo-btn fo-btn-secondary text-sm">
              Cancelar
            </a>
          ) : null}
        </div>
      </form>
    </div>
  );
}
