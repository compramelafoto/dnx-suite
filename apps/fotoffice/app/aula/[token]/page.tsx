import type { Metadata } from "next";
import Link from "next/link";
import { buscarAccesoPorToken } from "@/lib/course-classroom/lookup";
import { estadoDelAcceso, fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";
import { armarAula, duracionLegible } from "@/lib/course-classroom/aula";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi aula",
  // El enlace es una credencial: no se indexa, y a otros sitios sólo viaja el origen, nunca la
  // dirección con el token.
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="fo-card space-y-3 p-6 text-center">
        <p className="text-base font-semibold">{titulo}</p>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{texto}</p>
        <Link href="/aula/recuperar" className="text-sm text-[var(--fo-accent)] underline">
          Pedir un enlace nuevo
        </Link>
      </div>
    </main>
  );
}

export default async function AulaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const acceso = await buscarAccesoPorToken(token);

  // El mismo mensaje para un enlace inventado y para uno reemplazado: distinguirlos le diría a
  // quien prueba al azar cuándo acertó.
  if (!acceso) {
    return <Aviso titulo="Este enlace no funciona" texto="Puede que hayas pedido uno nuevo, o que esté incompleto." />;
  }
  const estado = estadoDelAcceso(acceso, new Date());
  if (estado === "VENCIDO") {
    return (
      <Aviso
        titulo="Tu acceso venció"
        texto={`Tu acceso a ${acceso.course.title} terminó el ${fechaLegibleArgentina(acceso.expiresAt)}.`}
      />
    );
  }
  if (estado === "REVOCADO") {
    return <Aviso titulo="Este enlace no funciona" texto="Puede que hayas pedido uno nuevo, o que esté incompleto." />;
  }

  const { clases, porcentaje } = armarAula(acceso.course.lessons, acceso.progress);
  const siguiente = clases.find((c) => !c.completada) ?? clases[0];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 md:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">Mi aula</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{acceso.course.title}</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Hola {acceso.enrollment.name}. Tenés acceso hasta el {fechaLegibleArgentina(acceso.expiresAt)}.
        </p>
      </header>

      <section className="fo-card space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="font-medium">Tu avance</p>
          <p className="text-sm text-[var(--fo-muted)]">{porcentaje}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--fo-border)]" aria-hidden>
          <div className="h-full bg-[var(--fo-accent)]" style={{ width: `${porcentaje}%` }} />
        </div>
        {siguiente ? (
          <Link href={`/aula/${token}/clase/${siguiente.id}`} className="fo-btn fo-btn-primary mt-2 inline-flex text-sm">
            {porcentaje === 0 ? "Empezar" : "Seguir mirando"}
          </Link>
        ) : null}
      </section>

      <section className="fo-card space-y-3">
        <h2 className="text-lg font-semibold">Clases</h2>
        {clases.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay clases listas para ver.</p>
        ) : (
          <ol className="space-y-2">
            {clases.map((clase, i) => (
              <li key={clase.id}>
                <Link
                  href={`/aula/${token}/clase/${clase.id}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 hover:border-[var(--fo-accent)]"
                >
                  <span className="min-w-0">
                    <span aria-label={clase.completada ? "Vista" : "Sin ver"}>{clase.completada ? "✓ " : ""}</span>
                    {i + 1}. {clase.title}
                  </span>
                  <span className="shrink-0 text-sm text-[var(--fo-muted)]">{duracionLegible(clase.durationSeconds)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
