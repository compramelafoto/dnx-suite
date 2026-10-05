// app/portal/cursos/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { cargarMisCursos } from "@/lib/course-classroom/mis-cursos";
import { otorgarAccesosPendientes } from "@/lib/course-classroom/alumno";
import { fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";
import { cursosGratisParaSocio } from "@/lib/course-classroom/beneficio";
import { loadPortalContext } from "@/lib/portal/access";
import { anotarmeGratisAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis cursos",
  robots: { index: false, follow: false },
};

/**
 * Los cursos de la persona. La guarda del portal (layout) ya decidió que es socio o alumno.
 * Nunca redirige a `/portal`: `/portal` manda al alumno acá y se armaría un bucle.
 *
 * Antes de listar, repara: si después de un pago aprobado algo falló y el acceso no se creó,
 * se crea acá. Es idempotente.
 */
export default async function MisCursosPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  const user = await requireAuth();
  await otorgarAccesosPendientes(user.id);
  const grupos = await cargarMisCursos(user.id);
  const socio = await loadPortalContext(user.id);
  const gratis = socio ? await cursosGratisParaSocio(socio.workspace.id, user.id) : [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mis cursos</h1>
      </header>

      {aviso ? <p className="fo-card text-sm">{aviso}</p> : null}

      {grupos.length === 0 ? (
        <section className="fo-card text-sm text-[var(--fo-muted)]">Todavía no tenés cursos.</section>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.workspace.id} className="space-y-3">
            {grupos.length > 1 ? <h2 className="text-lg font-semibold">{grupo.workspace.name}</h2> : null}
            <ul className="grid gap-3 md:grid-cols-2">
              {grupo.cursos.map((curso) => (
                <li key={curso.accessId} className="fo-card space-y-3">
                  <div className="space-y-1">
                    <p className="font-medium">{curso.title}</p>
                    <p className="text-xs text-[var(--fo-muted)]">
                      {curso.origin === "MEMBER_BENEFIT"
                        ? "Gratis por ser socio"
                        : curso.expiresAt
                          ? `Acceso hasta el ${fechaLegibleArgentina(curso.expiresAt)}`
                          : ""}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--fo-border)]" aria-hidden>
                    <div className="h-full bg-[var(--fo-accent)]" style={{ width: `${curso.porcentaje}%` }} />
                  </div>
                  <p className="text-xs text-[var(--fo-muted)]">{curso.porcentaje}% visto</p>
                  {curso.siguienteClaseId ? (
                    <Link
                      href={`/portal/cursos/${curso.courseId}/clase/${curso.siguienteClaseId}`}
                      className="fo-btn fo-btn-primary inline-flex text-sm"
                    >
                      {curso.porcentaje === 0 ? "Empezar" : curso.porcentaje === 100 ? "Volver a ver" : "Seguir mirando"}
                    </Link>
                  ) : (
                    <p className="text-sm text-[var(--fo-muted)]">Las clases todavía se están preparando.</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {gratis.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Gratis para vos</h2>
          <p className="text-sm text-[var(--fo-muted)]">Por ser socio, estos cursos no te cuestan nada.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {gratis.map((curso) => (
              <li key={curso.id} className="fo-card space-y-2">
                <p className="font-medium">{curso.title}</p>
                {curso.shortDescription ? (
                  <p className="text-sm text-[var(--fo-muted)] line-clamp-2">{curso.shortDescription}</p>
                ) : null}
                <form action={anotarmeGratisAction.bind(null, curso.id)}>
                  <button type="submit" className="fo-btn fo-btn-primary text-sm">
                    Anotarme
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
