// app/portal/cursos/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { cargarMisCursos } from "@/lib/course-classroom/mis-cursos";
import { otorgarAccesosPendientes } from "@/lib/course-classroom/alumno";
import { fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";
import { cursosGratisParaSocio, mensajeDeBeneficio } from "@/lib/course-classroom/beneficio";
import { cursosGratisDeLaInstitucion, rutaAsociarse } from "@/lib/course-classroom/asociarse";
import { loadPortalContext } from "@/lib/portal/access";
import { cursosRevendidosParaSocios } from "@/lib/course-marketplace/vitrina";
import { formatMoney } from "@/lib/format";
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
  const textoDelAviso = mensajeDeBeneficio(aviso);
  const user = await requireAuth();
  await otorgarAccesosPendientes(user.id);
  const grupos = await cargarMisCursos(user.id);
  const socio = await loadPortalContext(user.id);
  const gratis = socio ? await cursosGratisParaSocio(socio.workspace.id, user.id) : [];
  const yaTiene = new Set(grupos.flatMap((g) => g.cursos.map((c) => c.courseId)));
  const revendidos = socio ? (await cursosRevendidosParaSocios(socio.workspace.id)).filter((c) => !yaTiene.has(c.courseId)) : [];
  // Quien todavía no es socia recibe, por institución, la invitación a asociarse (si el
  // formulario está abierto) con los cursos que le saldrían gratis. Paralelo a `grupos`.
  const invitaciones = await Promise.all(
    grupos.map(async (grupo) => {
      if (socio) return null;
      const ruta = await rutaAsociarse(grupo.workspace.id, user.id);
      if (!ruta) return null;
      return { ruta, gratisDeLaInstitucion: await cursosGratisDeLaInstitucion(grupo.workspace.id) };
    }),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mis cursos</h1>
      </header>

      {textoDelAviso ? <p className="fo-card text-sm">{textoDelAviso}</p> : null}

      {grupos.length === 0 ? (
        <section className="fo-card text-sm text-[var(--fo-muted)]">Todavía no tenés cursos.</section>
      ) : (
        grupos.map((grupo, i) => {
          const invitacion = invitaciones[i];
          return (
          <section key={grupo.workspace.id} className="space-y-3">
            {grupos.length > 1 ? <h2 className="text-lg font-semibold">{grupo.workspace.name}</h2> : null}
            {invitacion ? (
              <aside className="fo-card space-y-2 border-[var(--fo-accent)]/40">
                <p className="font-semibold">Hacete socio de {grupo.workspace.name}</p>
                {invitacion.gratisDeLaInstitucion.length > 0 ? (
                  <>
                    <p className="text-sm text-[var(--fo-muted)]">Y estos cursos te salen gratis:</p>
                    <ul className="list-disc pl-5 text-sm">
                      {invitacion.gratisDeLaInstitucion.map((c) => (
                        <li key={c.id}>{c.title}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-[var(--fo-muted)]">Sumate a la institución y accedé a sus beneficios.</p>
                )}
                <a href={invitacion.ruta} className="fo-btn fo-btn-primary inline-flex text-sm">
                  Quiero ser socio
                </a>
              </aside>
            ) : null}
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
          );
        })
      )}

      {revendidos.length > 0 && socio ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Más cursos de {socio.workspace.name}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {revendidos.map((c) => (
              <li key={c.courseId} className="fo-card space-y-2">
                <p className="font-medium">{c.titulo}</p>
                {c.descripcion ? <p className="text-sm text-[var(--fo-muted)] line-clamp-2">{c.descripcion}</p> : null}
                {c.precioSocioArs ? (
                  <p className="text-sm">
                    Para vos: <strong>{formatMoney(Number(c.precioSocioArs), "ARS")}</strong>
                    {c.precioPublicoArs ? <span className="text-[var(--fo-muted)]"> (público {formatMoney(Number(c.precioPublicoArs), "ARS")})</span> : null}
                  </p>
                ) : c.precioPublicoArs ? (
                  <p className="text-sm">{formatMoney(Number(c.precioPublicoArs), "ARS")}</p>
                ) : null}
                {c.aLaVenta && c.href ? (
                  <Link href={c.href} className="fo-btn fo-btn-primary inline-flex text-sm">
                    Comprar
                  </Link>
                ) : (
                  <p className="text-sm font-medium">Disponible próximamente</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
