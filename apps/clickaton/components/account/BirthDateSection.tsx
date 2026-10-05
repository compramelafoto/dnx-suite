import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { guardarFechaNacimientoAction } from "@/lib/registration/account-birth-date-action";

/**
 * Mi cuenta: la fecha de nacimiento.
 *
 * Si falta, la sección va arriba de todo y se nota: es lo único que se le pide a quien se
 * inscribió antes de que fuera obligatoria. Si ya está, queda chica y editable.
 */
export function BirthDateSection({
  fecha,
  ok,
  error,
}: {
  /** "YYYY-MM-DD" o null si nunca la cargó. */
  fecha: string | null;
  ok?: boolean;
  error?: string;
}) {
  const falta = !fecha;
  return (
    <Card
      id="nacimiento"
      variant={falta ? "yellow" : "default"}
      className={falta ? "space-y-4 border-2 border-ck-yellow" : "space-y-3"}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
        {falta ? "🎂 Falta un dato" : "Tu fecha de nacimiento"}
      </p>
      {falta ? (
        <>
          <h2 className="text-xl font-semibold text-ck-text">Contanos cuándo es tu cumpleaños</h2>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Desde ahora la fecha de nacimiento es obligatoria para participar. Cargala una vez y
            queda en todas tus inscripciones. Así la comunidad de Clickatón te puede saludar en tu
            día.
          </p>
        </>
      ) : (
        <p className="text-sm text-ck-text-secondary">
          Si la cargaste mal, podés corregirla acá.
        </p>
      )}
      {ok ? <p className="text-sm font-medium text-ck-yellow">¡Listo! Guardamos tu fecha de nacimiento.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--ck-danger)]">
          {error}
        </p>
      ) : null}
      <form action={guardarFechaNacimientoAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1.5 text-sm text-ck-text-secondary" htmlFor="birthDate">
          <span>Fecha de nacimiento</span>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            defaultValue={fecha ?? ""}
            invalid={Boolean(error)}
          />
        </label>
        <Button type="submit" variant={falta ? "primary" : "secondary"} className="min-h-11 w-full sm:w-auto">
          Guardar
        </Button>
      </form>
    </Card>
  );
}
