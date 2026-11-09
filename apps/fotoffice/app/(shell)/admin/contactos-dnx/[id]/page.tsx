import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { CAMPOS_DATO, esAutorUsuario } from "@/lib/agentes/buscador/contactos";
import { fichaContacto, type DnxContactoEvento } from "@/lib/agentes/buscador/consultas-panel";
import {
  ETIQUETA_AUTOR, etiquetaCampo, etiquetaEstado, etiquetaFuente, etiquetaNicho, etiquetaPlataforma, etiquetaRegion,
  etiquetaTipo, etiquetaVinculo,
} from "@/lib/agentes/buscador/etiquetas";
import { fechaHoraArgentina } from "@/lib/agentes/periodista/horario";
import { EditarDato, FusionarCon, NotaNueva, SelectorEstado } from "../acciones-contacto";

export const dynamic = "force-dynamic";

type Datos = Record<string, unknown>;

const texto = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

/** Una línea legible para cada evento de la línea de tiempo. */
function describir(e: DnxContactoEvento): string {
  const d = (e.datos && typeof e.datos === "object" ? e.datos : {}) as Datos;
  switch (e.tipo) {
    case "CREADO":
      return "Entró a la base.";
    case "DATO_NUEVO": {
      const campo = etiquetaCampo(texto(d.campo));
      if (d.fuente === "MANUAL") return d.valor ? `Corrigió ${campo}: ${texto(d.valor)}.` : `Borró ${campo} de la ficha.`;
      return `Dato nuevo, ${campo}: ${texto(d.valor)}${d.fuente ? ` (${etiquetaFuente(texto(d.fuente))})` : ""}.`;
    }
    case "ESTADO":
      return `Estado: ${etiquetaEstado(texto(d.de))} → ${etiquetaEstado(texto(d.a))}${d.forzado ? " (forzado: había pedido no ser contactado)" : ""}${d.porFusionCon ? " (por una fusión)" : ""}.`;
    case "NOTA":
      return `Nota: ${texto(d.texto)}`;
    case "FUSIONADO":
      return d.en ? "Se fusionó en otro contacto." : "Se le sumó otro contacto (fusión).";
    case "VINCULADO":
      return `Vinculado: ${etiquetaVinculo(texto(d.vinculo))}${d.por === "email" ? " (por el correo)" : d.por === "telefono" ? " (por el teléfono)" : ""}.`;
    default:
      return e.tipo;
  }
}

/** Ficha de un contacto de Contactos DNX. El acceso lo controla el layout de /admin (sólo SUPER_ADMIN). */
export default async function FichaContactoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ficha = await fichaContacto(id);
  if (!ficha) notFound();
  const { contacto: c, datos, eventos } = ficha;

  // Las personas firman con su userId: se muestran con su nombre.
  const ids = [...new Set(eventos.map((e) => e.autor).filter(esAutorUsuario).map(Number))];
  const usuarios = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const autor = (a: string) => {
    if (esAutorUsuario(a)) {
      const u = usuarios.find((x) => x.id === Number(a));
      return u?.name ?? u?.email ?? `usuario ${a}`;
    }
    return ETIQUETA_AUTOR[a] ?? a;
  };

  const lugar = [c.ciudad, c.provincia].filter(Boolean).join(", ");
  const resumen = [etiquetaTipo(c.tipo), lugar, etiquetaRegion(c.region)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8">
      <p className="text-sm">
        <Link href="/admin/contactos-dnx" className="text-[var(--fo-accent)] underline">
          ← Volver a Contactos DNX
        </Link>
      </p>
      <PageHeader title={c.nombre} description={resumen} />

      {c.fusionadoEnId ? (
        <div className="fo-alert-warning" role="status">
          Este contacto se fusionó en otro y ya no aparece en la lista.{" "}
          <Link href={`/admin/contactos-dnx/${c.fusionadoEnId}`} className="underline">
            Ir al que quedó
          </Link>
        </div>
      ) : null}

      <section className="fo-card space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Resumen</h2>
        <ul className="text-sm text-[var(--fo-muted)] leading-relaxed space-y-1">
          <li>
            Estado: <span className="text-[var(--fo-text)] font-medium">{etiquetaEstado(c.estado)}</span>
          </li>
          <li>
            Nichos: <span className="text-[var(--fo-text)]">{c.nichos.map(etiquetaNicho).join(", ") || "—"}</span>
          </li>
          <li>
            Le sirve: <span className="text-[var(--fo-text)]">{c.plataformas.map(etiquetaPlataforma).join(", ") || "—"}</span>
          </li>
          <li>
            Vínculo: <span className="text-[var(--fo-text)]">{etiquetaVinculo(c.vinculo)}</span>
          </li>
          {c.compradorClf ? (
            <li>
              <span className="text-[var(--fo-text)] font-medium">Compró en CLF</span>
            </li>
          ) : null}
          <li>Alta: {fechaHoraArgentina(c.creadoEn)} ({ETIQUETA_AUTOR[c.creadoPor] ?? c.creadoPor})</li>
        </ul>
        {!c.fusionadoEnId ? <SelectorEstado key={c.estado} id={c.id} estado={c.estado} /> : null}
      </section>

      <section className="fo-card space-y-5">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Datos</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Cada dato muestra de dónde salió. Si corregís uno, queda como «cargado a mano»; si lo dejás vacío, se borra de la ficha
          pero el historial queda.
        </p>
        {CAMPOS_DATO.map((campo) => {
          const vistos = datos.filter((d) => d.campo === campo);
          return (
            <div key={campo} className="space-y-2">
              <p className="fo-label">{etiquetaCampo(campo)}</p>
              {c.fusionadoEnId ? (
                <p className="text-sm text-[var(--fo-text)]">{c[campo] ?? "—"}</p>
              ) : (
                <EditarDato key={c[campo] ?? ""} id={c.id} campo={campo} valor={c[campo]} />
              )}
              {vistos.length > 0 ? (
                <ul className="text-xs text-[var(--fo-muted)] space-y-0.5 pl-1">
                  {vistos.map((d) => (
                    <li key={d.id}>
                      {d.valor} · {etiquetaFuente(d.fuente)} · visto el {fechaHoraArgentina(d.vistoEn)}
                      {d.fuenteUrl ? (
                        <>
                          {" · "}
                          <a href={d.fuenteUrl} target="_blank" rel="noreferrer" className="text-[var(--fo-accent)] underline">
                            ver fuente
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </section>

      {!c.fusionadoEnId ? (
        <>
          <section className="fo-card space-y-3">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">Nota nueva</h2>
            <NotaNueva id={c.id} />
          </section>

          <section className="fo-card space-y-3">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">Fusionar con…</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Si este contacto está repetido, buscá el otro y fusionalo acá: sus datos, notas e historia pasan a esta ficha y el otro
              deja de aparecer en la lista. Si alguno había pedido no ser contactado, el resultado queda «No contactar».
            </p>
            <FusionarCon id={c.id} />
          </section>
        </>
      ) : null}

      <section className="fo-card space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Línea de tiempo</h2>
        {eventos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Sin movimientos.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {eventos.map((e) => (
              <li key={e.id} className="py-2 text-sm space-y-0.5">
                <p className="text-[var(--fo-text)] whitespace-pre-line">{describir(e)}</p>
                <p className="text-xs text-[var(--fo-muted)]">
                  {fechaHoraArgentina(e.creadoEn)} · {autor(e.autor)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
