import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { textoUsd } from "@/lib/agentes/periodista/costo";
import { fechaHoraArgentina } from "@/lib/agentes/periodista/horario";
import { estadoVendedor } from "@/lib/agentes/vendedor/estado";
import { pesos, type InformeMes } from "@/lib/agentes/vendedor/informe";
import { ROTULO_GRUPO, type Grupo } from "@/lib/agentes/vendedor/tipos";
import { BotonPedirModelo, ControlesVendedor, FormAjustesVendedor, FormContactoPrueba } from "./acciones-vendedor";

export const dynamic = "force-dynamic";
/** «Pedir modelo nuevo» espera a que Claude redacte; «Correr ahora» sigue en segundo plano (`after`) dentro de estos 5 minutos. */
export const maxDuration = 300;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10" → "octubre de 2026". */
function mesEnPalabras(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1] ?? m} de ${a}`;
}

/** "2026-11-09" → "9/11/2026". */
function diaCorto(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${Number(d)}/${Number(m)}/${a}`;
}

const rotulo = (g: string) => ROTULO_GRUPO[g as Grupo] ?? g;

function motivoPausa(pausadoPor: "MANUAL" | "SALUD" | null, saludDesde: string | null, arrancoEn: string | null): string {
  if (pausadoPor === "SALUD") {
    return `Se frenó solo: hubo rebotes o una queja en los últimos envíos${saludDesde ? ` (mirando desde el ${fechaHoraArgentina(new Date(saludDesde))})` : ""}. Revisá antes de reanudar.`;
  }
  if (pausadoPor === "MANUAL") return "Lo pausaste vos.";
  return arrancoEn ? "En pausa." : "Todavía no arrancó: el Vendedor empieza en pausa hasta que lo reanudes por primera vez.";
}

function TablaInforme({ informe }: { informe: InformeMes }) {
  const filas = [...informe.porGrupo.map((g) => ({ clave: g.grupo, nombre: rotulo(g.grupo), f: g })), { clave: "total", nombre: "Total", f: informe.total }];
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--fo-text)] first-letter:uppercase">{mesEnPalabras(informe.mes)}</h3>
      {informe.porGrupo.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">No hubo actividad ese mes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--fo-muted)] border-b border-[var(--fo-border)]">
                <th className="py-2 pr-3 font-medium">Grupo</th>
                <th className="py-2 pr-3 font-medium">Enviados</th>
                <th className="py-2 pr-3 font-medium">Respondieron</th>
                <th className="py-2 pr-3 font-medium">Se registraron</th>
                <th className="py-2 pr-3 font-medium">Vendieron</th>
                <th className="py-2 pr-3 font-medium">Ventas</th>
                <th className="py-2 font-medium">Total vendido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)]">
              {filas.map(({ clave, nombre, f }) => (
                <tr key={clave} className={clave === "total" ? "font-medium text-[var(--fo-text)]" : "text-[var(--fo-text)]"}>
                  <td className="py-2 pr-3">{nombre}</td>
                  <td className="py-2 pr-3">{f.enviados}</td>
                  <td className="py-2 pr-3">{f.respondieron}</td>
                  <td className="py-2 pr-3">{f.registros}</td>
                  <td className="py-2 pr-3">{informe.ventasDisponibles ? f.vendieron : "—"}</td>
                  <td className="py-2 pr-3">{informe.ventasDisponibles ? f.ventas : "—"}</td>
                  <td className="py-2">{informe.ventasDisponibles ? pesos(f.totalPesos) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-[var(--fo-muted)]">
        Gasto de Claude en el mes: {textoUsd(informe.gastoUsd)}. Registros y ventas son un mínimo comprobado.
        {!informe.ventasDisponibles ? " No se pudieron traer las ventas de CompraMeLaFoto." : ""}
      </p>
    </div>
  );
}

/**
 * Panel del agente Vendedor: los correos a los contactos de Contactos DNX. El acceso lo controla el
 * layout de /admin (sólo SUPER_ADMIN) y cada acción lo vuelve a chequear.
 */
export default async function VendedorPage() {
  const ahora = new Date();
  const e = await estadoVendedor(ahora);
  const a = e.ajustes;

  return (
    <div className="space-y-8">
      <p className="text-sm">
        <Link href="/admin/contactos-dnx" className="text-[var(--fo-accent)] underline">
          ← Volver a Contactos DNX
        </Link>
      </p>
      <PageHeader
        title="Agente Vendedor"
        description="Les escribe a los contactos de Contactos DNX desde daniel@compramelafoto.com, en días hábiles de 9 a 18 (hora argentina), con el modelo que aprobaste para cada grupo. Las respuestas delicadas te las pasa a vos."
      />

      <section className="fo-card space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">
              Estado: <span className={a.pausado ? "text-[var(--fo-muted)]" : "text-[var(--fo-accent)]"}>{a.pausado ? "En pausa" : "En marcha"}</span>
            </h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              {a.pausado ? motivoPausa(a.pausadoPor, a.saludDesde, a.arrancoEn) : "Manda correos en la próxima corrida (cada 15 minutos, en horario)."}
              {a.arrancoEn ? ` Arrancó el ${diaCorto(a.arrancoEn)}.` : ""}
            </p>
          </div>
          <ControlesVendedor pausado={a.pausado} />
        </div>

        {a.soloContactoPrueba ? (
          <div className="fo-alert-warning" role="status">
            Modo prueba: sólo le escribe al{" "}
            <Link href={`/admin/contactos-dnx/${a.soloContactoPrueba}`} className="underline">
              contacto de prueba
            </Link>
            .
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-[var(--fo-muted)]">
            Gasto de Claude este mes: <span className="text-[var(--fo-text)] font-medium">{textoUsd(e.gastoMesUsd)}</span> de {textoUsd(a.topeClaudeUsd)}
          </p>
          <p className="text-sm text-[var(--fo-muted)]">
            Cupo de hoy:{" "}
            <span className="text-[var(--fo-text)] font-medium">
              {e.enviadosHoy}/{e.cupoHoy}
            </span>{" "}
            correos enviados{e.cupoHoy === 0 && !a.arrancoEn ? " (el cupo empieza a contar desde el primer «Reanudar»)" : ""}
          </p>
          <p className="text-sm text-[var(--fo-muted)]">
            Enviados este mes: <span className="text-[var(--fo-text)] font-medium">{e.enviadosMes}</span> (primeros correos y recordatorios)
          </p>
          <p className="text-sm text-[var(--fo-muted)]">
            Conocimiento de CompraMeLaFoto:{" "}
            <span className="text-[var(--fo-text)] font-medium">{e.conocimientoVersion ? `cargado (versión ${e.conocimientoVersion})` : "sin cargar"}</span>
          </p>
          <p className="text-sm text-[var(--fo-muted)]">
            Página de clubes en CompraMeLaFoto:{" "}
            <span className="text-[var(--fo-text)] font-medium">{a.paginaClubesPublicada ? "publicada" : "sin publicar (clubes y organizadores de eventos esperan)"}</span>
          </p>
        </div>

        <FormAjustesVendedor topeClaudeUsd={a.topeClaudeUsd} correosPorDia={a.correosPorDia} correosPrimeraSemana={a.correosPrimeraSemana} />
        <div className="space-y-1">
          <p className="text-sm text-[var(--fo-muted)]">
            Para probar el circuito con un correo propio, poné el id de un contacto (está en la dirección de su ficha): el Vendedor sólo le va a escribir a ése.
          </p>
          <FormContactoPrueba actual={a.soloContactoPrueba} />
        </div>
      </section>

      <section className="fo-card space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Modelos por grupo</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Cada grupo sale con el modelo que aprobaste en Telegram. Si pedís uno nuevo, el vigente sigue hasta que apruebes el nuevo.
        </p>
        <ul className="divide-y divide-[var(--fo-border)] text-sm">
          {e.modelos.map((m) => (
            <li key={m.grupo} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-2">
              <span className="min-w-52 font-medium text-[var(--fo-text)]">{m.rotulo}</span>
              <span className="flex-1 space-y-0.5 text-[var(--fo-muted)]">
                <span className="block">
                  {m.vigente ? (
                    <>
                      Vigente: <span className="text-[var(--fo-text)]">«{m.vigente.asunto}»</span>
                      {m.vigente.aprobadoEn ? `, aprobado el ${fechaHoraArgentina(m.vigente.aprobadoEn)}` : ""}
                    </>
                  ) : (
                    "Sin modelo aprobado: no se le escribe a nadie de este grupo."
                  )}
                </span>
                {m.propuesto ? (
                  <span className="block">
                    Propuesto, esperando tu respuesta en Telegram: <span className="text-[var(--fo-text)]">«{m.propuesto.asunto}»</span> ({fechaHoraArgentina(m.propuesto.creadoEn)})
                  </span>
                ) : null}
              </span>
              {!m.propuesto ? <BotonPedirModelo grupo={m.grupo} /> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="fo-card space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Cola de hoy</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Vista previa de a quién le escribiría con lo que queda del cupo de hoy. Antes de cada envío vuelve a revisar que siga apto.
        </p>
        {e.cola.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            {e.cupoHoy === 0 ? "Hoy no tiene cupo." : e.enviadosHoy >= e.cupoHoy ? "Ya usó todo el cupo de hoy." : "No hay contactos aptos con modelo aprobado."}
          </p>
        ) : (
          <ol className="list-decimal pl-5 text-sm space-y-1">
            {e.cola.map((c) => (
              <li key={c.contactoId}>
                <Link href={`/admin/contactos-dnx/${c.contactoId}`} className="text-[var(--fo-accent)] underline">
                  {c.nombre}
                </Link>{" "}
                <span className="text-[var(--fo-muted)]">· {rotulo(c.grupo)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="fo-card space-y-5">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Informes mensuales</h2>
        {e.informes.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay informes: el primero sale el día 1 del mes que viene.</p>
        ) : (
          e.informes.map((i) => <TablaInforme key={i.mes} informe={i} />)
        )}
      </section>
    </div>
  );
}
