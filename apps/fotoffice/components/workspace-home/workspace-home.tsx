import Link from "next/link";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import type { SubmoduleItem } from "@/lib/modules/submodules";
import { formatMinorArs } from "@/lib/membership/money";
import { fechaHora, raffleStatusLabel } from "@/lib/raffles/labels";
import type { HomeData } from "@/lib/workspace-home/load";
import { Barra, Indicador, ListaPendientes, Panel, type Pendiente } from "./tablero";

const ZONA = "America/Argentina/Buenos_Aires";

function fechaDeHoy(d: Date): string {
  const texto = d.toLocaleDateString("es-AR", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function nombreDelMes(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: ZONA, month: "long" });
}

function diaYHora(d: Date): string {
  return d.toLocaleString("es-AR", {
    timeZone: ZONA,
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Pesos sin centavos, para los números grandes del tablero: ahí los centavos sobran. */
function pesos(minor: number): string {
  return formatMinorArs(minor).replace(/,\d{2}$/, "");
}

const ESTADO_RESERVA: Record<string, string> = {
  CONFIRMED: "Confirmada",
  PENDING_APPROVAL: "A aprobar",
  HOLD: "Esperando pago",
};

/**
 * El inicio de la institución: cómo viene todo, de un vistazo.
 *
 * Arriba lo que espera una acción del equipo; después los cuatro números que dicen si la
 * institución está bien (socios, deuda, lo cobrado en el mes, la caja); después el detalle por
 * módulo. Al pie, todas las pantallas, para quien vino a buscar una en particular.
 *
 * Antes esta pantalla era una lista de módulos con sus pantallas: un índice, no un tablero.
 * Para saber cuánto se había cobrado había que entrar a Cuotas; para saber si había altas
 * esperando, a Solicitudes. Ahora se ve sin entrar a ningún lado.
 */
export type WorkspaceHomeProps = {
  now: Date;
  nombre: string;
  institucion: string;
  publicSlug: string | null;
  datos: HomeData;
  vocabulary: PersonVocabulary;
  puedeCrearSocio: boolean;
  /** Para "Completar los datos de la institución". Vacío si no falta nada o no es admin. */
  faltaConfigurar: string[];
  modulos: { key: string; label: string; route: string; pantallas: SubmoduleItem[] }[];
};

export function WorkspaceHome({
  now,
  nombre,
  institucion,
  publicSlug,
  datos,
  vocabulary,
  puedeCrearSocio,
  faltaConfigurar,
  modulos,
}: WorkspaceHomeProps) {
  // ── Lo que espera a alguien ──
  const pendientes: Pendiente[] = [];
  if (datos.altas?.pendientes) {
    pendientes.push({
      cantidad: datos.altas.pendientes,
      texto: `${datos.altas.pendientes === 1 ? "Solicitud de alta" : "Solicitudes de alta"} para revisar`,
      href: "/members/solicitudes",
      tono: "warning",
    });
  }
  if (datos.altas?.aprobadasSinPagar) {
    pendientes.push({
      cantidad: datos.altas.aprobadasSinPagar,
      texto: "Altas aprobadas que todavía no pagaron el ingreso",
      href: "/members/solicitudes",
    });
  }
  if (datos.reservas?.aAprobar) {
    pendientes.push({
      cantidad: datos.reservas.aAprobar,
      texto: `${datos.reservas.aAprobar === 1 ? "Reserva" : "Reservas"} para aprobar`,
      href: "/reservas",
      tono: "warning",
    });
  }
  if (datos.premiosPorEntregar) {
    pendientes.push({
      cantidad: datos.premiosPorEntregar,
      texto: `${datos.premiosPorEntregar === 1 ? "Premio" : "Premios"} de sorteo sin entregar`,
      href: "/sorteos/entregas",
    });
  }
  if (datos.coberturas?.urgentes) {
    pendientes.push({
      cantidad: datos.coberturas.urgentes,
      texto: "Coberturas para los próximos 7 días",
      href: "/coberturas",
      tono: "danger",
    });
  }
  if (datos.coberturas?.nuevas) {
    pendientes.push({
      cantidad: datos.coberturas.nuevas,
      texto: `${datos.coberturas.nuevas === 1 ? "Pedido de cobertura nuevo" : "Pedidos de cobertura nuevos"}`,
      href: "/coberturas",
    });
  }
  if (datos.pedidosNuevos) {
    pendientes.push({
      cantidad: datos.pedidosNuevos,
      texto: "Consultas nuevas sin responder",
      href: "/dashboard/service-leads",
    });
  }
  if (datos.comunicacion?.socioDeLaSemana) {
    pendientes.push({
      texto: `Ya está el Socio de la semana: ${datos.comunicacion.socioDeLaSemana}. Su placa está lista para publicar`,
      href: "/comunicacion/placas/socio-de-la-semana",
      tono: "warning",
    });
  }
  if (datos.comunicacion?.bienvenidasSinPublicar) {
    pendientes.push({
      cantidad: datos.comunicacion.bienvenidasSinPublicar,
      texto: `${datos.comunicacion.bienvenidasSinPublicar === 1 ? "Bienvenida" : "Bienvenidas"} a socios nuevos sin publicar`,
      href: "/comunicacion/placas",
    });
  }
  if (faltaConfigurar.length > 0) {
    pendientes.push({ texto: `Completar los datos de la institución: ${faltaConfigurar.join(", ")}`, href: "/workspace/configuracion" });
  }

  // ── Los números de arriba ──
  const s = datos.socios;
  const c = datos.cuotas;
  const pctAlDia = s && s.activos > 0 ? Math.round((s.alDia / s.activos) * 100) : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--fo-muted)]">{fechaDeHoy(now)}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)] md:text-3xl">
            Hola, {nombre}
          </h1>
          <p className="text-sm text-[var(--fo-muted)]">Así viene {institucion}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeCrearSocio ? (
            <Link href="/members/new" className="fo-btn fo-btn-secondary text-sm">
              Nuevo {vocabulary.singular}
            </Link>
          ) : null}
          {datos.caja ? (
            <Link href="/caja/movimientos" className="fo-btn fo-btn-secondary text-sm">
              Cargar en caja
            </Link>
          ) : null}
          {publicSlug ? (
            <a
              href={`/w/${publicSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="fo-btn fo-btn-secondary text-sm"
            >
              Ver el sitio ↗
            </a>
          ) : null}
        </div>
      </header>

      {/* Primero lo que espera a alguien: es lo único de esta pantalla que pide hacer algo. */}
      <Panel titulo="Para atender">
        <ListaPendientes items={pendientes} />
      </Panel>

      {s || c || datos.caja ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {s ? (
            <Indicador
              rotulo={`${vocabulary.Plural} activos`}
              valor={String(s.activos)}
              detalle={`${s.total} en el padrón${s.suspendidos ? ` · ${s.suspendidos} suspendidos` : ""}`}
              href="/members"
            />
          ) : null}
          {s ? (
            <Indicador
              rotulo="Al día"
              valor={pctAlDia === null ? "—" : `${pctAlDia}%`}
              tono={pctAlDia === null ? "neutral" : pctAlDia >= 70 ? "success" : pctAlDia >= 50 ? "warning" : "danger"}
              detalle={`${s.alDia} de ${s.activos} activos, sin cuotas vencidas`}
              href={c ? "/members/cuotas" : "/members"}
            />
          ) : null}
          {c ? (
            <Indicador
              rotulo={`Cobrado en ${nombreDelMes(now)}`}
              valor={pesos(c.cobradoMesMinor)}
              tono="success"
              detalle={`${c.pagosMes} ${c.pagosMes === 1 ? "pago acreditado" : "pagos acreditados"}`}
              href="/members/cuotas"
            />
          ) : null}
          {c ? (
            <Indicador
              rotulo="Deuda de cuotas"
              valor={pesos(c.deudaTotalMinor)}
              tono={c.sociosConVencidas > 0 ? "warning" : "neutral"}
              detalle={`${c.sociosConVencidas} ${c.sociosConVencidas === 1 ? vocabulary.singular : vocabulary.plural} con cuotas vencidas`}
              href="/members/cuotas"
            />
          ) : datos.caja ? (
            <Indicador rotulo="En caja" valor={pesos(datos.caja.totalMinor)} detalle="Suma de todas las cuentas" href="/caja" />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {c && s ? (
            <Panel titulo="Cuotas" accion={{ label: "Ver cuotas", href: "/members/cuotas" }}>
              <div className="space-y-1.5">
                <p className="text-sm text-[var(--fo-muted)]">
                  {vocabulary.Plural} activos al día
                </p>
                <Barra
                  valor={s.alDia}
                  total={s.activos}
                  tono={pctAlDia === null ? "neutral" : pctAlDia >= 70 ? "success" : pctAlDia >= 50 ? "warning" : "danger"}
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-[var(--fo-text)]">Últimos pagos</p>
                {c.ultimosPagos.length === 0 ? (
                  <p className="text-sm text-[var(--fo-muted)]">Todavía no hay pagos acreditados.</p>
                ) : (
                  <ul className="divide-y divide-[var(--fo-border)]">
                    {c.ultimosPagos.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="tabular-nums text-[var(--fo-muted)]">N° {p.numero}</span> {p.nombre}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="font-medium tabular-nums">{formatMinorArs(p.montoMinor)}</span>
                          <span className="block text-xs text-[var(--fo-muted)]">{diaYHora(p.fecha)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          ) : null}

          {datos.reservas ? (
            <Panel titulo="Próximas reservas" accion={{ label: "Ver agenda", href: "/reservas" }}>
              {datos.reservas.proximas.length === 0 ? (
                <p className="text-sm text-[var(--fo-muted)]">No hay reservas en los próximos 7 días.</p>
              ) : (
                <ul className="divide-y divide-[var(--fo-border)]">
                  {datos.reservas.proximas.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.espacio}</span>
                        <span className="block truncate text-xs text-[var(--fo-muted)]">{r.contacto}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block tabular-nums">{diaYHora(r.inicio)}</span>
                        <span
                          className={`text-xs ${r.estado === "CONFIRMED" ? "text-[var(--fo-success)]" : "text-[var(--fo-warning)]"}`}
                        >
                          {ESTADO_RESERVA[r.estado] ?? r.estado}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </div>

        <div className="space-y-6">
          {datos.sorteo ? (
            <Panel titulo="Sorteo" accion={{ label: "Abrir", href: `/sorteos/${datos.sorteo.id}` }}>
              <div className="space-y-1">
                <p className="font-medium">{datos.sorteo.titulo}</p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {raffleStatusLabel(datos.sorteo.estado)} · se sortea el {fechaHora(datos.sorteo.sorteaEl)}
                </p>
                {datos.sorteo.participantes !== null ? (
                  <p className="text-sm text-[var(--fo-muted)]">{datos.sorteo.participantes} participantes</p>
                ) : null}
              </div>
              {publicSlug && datos.sorteo.estado !== "BORRADOR" ? (
                <a
                  href={`/w/${publicSlug}/sorteos/${datos.sorteo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-sm font-medium text-[var(--fo-accent-hover)] hover:underline"
                >
                  Página pública (para proyectar) ↗
                </a>
              ) : null}
            </Panel>
          ) : null}

          {datos.caja ? (
            <Panel titulo="Caja" accion={{ label: "Panorama", href: "/caja" }}>
              <ul className="space-y-2">
                {datos.caja.cuentas.map((cuenta) => (
                  <li key={cuenta.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-[var(--fo-muted)]">{cuenta.nombre}</span>
                    <span
                      className={`font-medium tabular-nums ${cuenta.saldoMinor < 0 ? "text-[var(--fo-danger)]" : ""}`}
                    >
                      {formatMinorArs(cuenta.saldoMinor)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-[var(--fo-border)] pt-3 text-sm">
                <span className="font-medium">Total</span>
                <span className="font-semibold tabular-nums">{formatMinorArs(datos.caja.totalMinor)}</span>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* Todas las pantallas, para quien vino a buscar una en particular. */}
      {modulos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">Todas las secciones</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((m) => {
              const pantallas = m.pantallas;
              return (
                <div key={m.key} className="fo-card space-y-2 p-4">
                  <Link href={m.route} className="font-medium text-[var(--fo-text)] hover:text-[var(--fo-accent-hover)]">
                    {m.label}
                  </Link>
                  {pantallas.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {pantallas.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          title={sub.description}
                          className="rounded-full border border-[var(--fo-border)] px-2.5 py-1 text-xs text-[var(--fo-muted)] transition-colors hover:border-[var(--fo-accent)] hover:text-[var(--fo-text)]"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">
          Todavía no hay secciones habilitadas en esta institución. Pedile a un administrador de la
          plataforma que active alguna.
        </p>
      )}
    </div>
  );
}
