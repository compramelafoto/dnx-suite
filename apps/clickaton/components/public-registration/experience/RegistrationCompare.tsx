export function RegistrationCompare() {
  return (
    <section className="space-y-6" aria-labelledby="registration-compare-title">
      <h2 id="registration-compare-title" className="text-xl font-semibold tracking-tight md:text-2xl">
        Una vez o todo el año
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--ck-radius-card)] border border-ck-border p-6">
          <p className="ck-label text-ck-text-muted">Inscripción</p>
          <ul className="mt-4 space-y-2 text-sm text-ck-text">
            <li>✔ Participás en esta Clickatón</li>
          </ul>
        </div>
        <div className="rounded-[var(--ck-radius-card)] border border-ck-yellow/50 bg-ck-yellow/5 p-6">
          <p className="ck-label text-ck-yellow">Pack</p>
          <ul className="mt-4 space-y-2 text-sm text-ck-text">
            <li>✔ Participás hoy</li>
            <li>✔ 3 Clickatones más</li>
            <li>✔ Mejor precio</li>
            <li>✔ Válido por 2 años</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
