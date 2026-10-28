"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCircle, Check } from "lucide-react";
import {
  CC_WIZARD_STEPS,
  getCuantoCobroMissingFields,
  INITIAL_CUANTO_COBRO_QUOTE,
  isSeparateLocalActive,
  isStudioModeActive,
  type CuantoCobroProfileInput,
  type CuantoCobroStudioStepId,
} from "@repo/cuanto-cobro-core";
import type { CuantoCobroStepId } from "@repo/cuanto-cobro-core/types";
import { CC_DATA_SECURITY_NOTICE } from "@repo/cuanto-cobro-core/types";
import { validarPerfil } from "@/lib/precios/perfil-datos";
import { resumirPerfil } from "@/lib/precios/resumen";
import { useFormatearPesos } from "@/components/campos/formato-pesos";
import { guardarPerfilPreciosAction, type ResultadoPerfilPrecios } from "./actions";
import { OfertaArmarConversando } from "@/components/dnx-bot/oferta-perfil";
import {
  Aviso,
  SeccionAhorro,
  SeccionColaboradores,
  SeccionEquipo,
  SeccionFondoEmergencia,
  SeccionGastosPersonales,
  SeccionIngresos,
  SeccionNegocio,
  SeccionPosicionamiento,
  SeccionTiempo,

} from "./secciones";
import { SeccionCobros } from "./secciones-cobros";
import { encenderMiEstudio } from "@/lib/precios/estudio";
import type { DatosDeMiEstudio } from "@/lib/precios/estudio-servidor";
import {
  SeccionEquipoEstudio,
  SeccionEquipoYCamaras,
  SeccionGastosFijos,
  SeccionOtrasLineas,
  SeccionResumenEstudio,
  SeccionVosEnElEstudio,
  type PropsSeccionEstudio,
} from "./secciones-estudio";
import { SeccionLocalYCoberturas } from "./secciones-local";

/** Los pasos del perfil del ¿Cuánto Cobro? original (la moneda no: FOTOFFICE cotiza en pesos). */
const CONTENIDO: Partial<Record<string, (p: PropsSeccionEstudio) => React.ReactNode>> = {
  employment: SeccionIngresos,
  personal: SeccionGastosPersonales,
  business: SeccionNegocio,
  team: SeccionColaboradores,
  availability: SeccionTiempo,
  investment: SeccionEquipo,
  "emergency-fund": SeccionFondoEmergencia,
  "savings-goals": SeccionAhorro,
  "commercial-positioning": SeccionPosicionamiento,
  "pricing-extras": SeccionCobros,
};

/** Mi estudio: los pasos que cambian (los demás son los de siempre). */
const CONTENIDO_ESTUDIO: Partial<Record<string, (p: PropsSeccionEstudio) => React.ReactNode>> = {
  ...CONTENIDO,
  "studio-costs": SeccionGastosFijos,
  "studio-team": SeccionEquipoEstudio,
  "studio-owner": SeccionVosEnElEstudio,
  "studio-local": SeccionLocalYCoberturas,
  investment: SeccionEquipoYCamaras,
  "studio-lines": SeccionOtrasLineas,
  "studio-summary": SeccionResumenEstudio,
};

type Paso = { id: string; title: string; description: string; motor: boolean };

/**
 * Un paso que agrega quien usa el formulario, después de los del perfil. Lo usa el portal del socio
 * para cerrar con el valor de la hora y el presupuesto de un trabajo: no son parte del perfil, pero
 * se calculan con el perfil que se está editando, sin guardar.
 */
export type PasoAgregado = { id: string; title: string; description: string; Contenido: (p: PropsSeccionEstudio) => React.ReactNode };

/** Otro título o explicación para un paso del perfil, en la lengua de quien lo mira. */
export type TextoDePaso = { title?: string; description?: string };

/**
 * Paso propio de FOTOFFICE (no está en el asistente de CLF): impuestos, cobros y recargos. Es
 * opcional: nunca bloquea el «Siguiente» ni el guardado.
 */
const PASO_COBROS: Paso = {
  id: "pricing-extras",
  title: "Impuestos, cobros y recargos",
  description: "Monotributo o IVA, Ingresos Brutos, comisión de Mercado Pago, seña, recargos, viáticos, retoque, inflación, precio mínimo y política de cancelación. Todo opcional.",
  motor: false,
};

const PASOS_SOLO: Paso[] = [
  ...CC_WIZARD_STEPS.filter((p) => p.block === "profile" && CONTENIDO[p.id]).map((p) => ({ id: p.id, title: p.title, description: p.description, motor: true })),
  PASO_COBROS,
];

const pasoDelMotor = (id: CuantoCobroStepId): Paso => {
  const p = CC_WIZARD_STEPS.find((x) => x.id === id)!;
  return { id: p.id, title: p.title, description: p.description, motor: true };
};

/** Mi estudio (spec 2026-10-15, §4): gastos fijos, equipo, vos, equipamiento, emergencia, otras líneas, posicionamiento, impuestos y resumen. */
const PASOS_ESTUDIO: Paso[] = [
  { id: "studio-costs", title: "Gastos fijos del estudio", description: "Lo que pagás todos los meses haya trabajo o no: local, servicios, software, publicidad, contador…", motor: true },
  { id: "studio-team", title: "Equipo", description: "Cada persona con su contratación, su sueldo y su jornada (días por semana × horas por día).", motor: true },
  { id: "studio-owner", title: "Vos en el estudio", description: "Tu retiro por mes y tu jornada.", motor: true },
  {
    id: "studio-local",
    title: "Local y coberturas",
    description: "Tus gastos personales, lo que te paga el local, qué gasto y qué persona es de cada parte, y lo que deja el local.",
    motor: true,
  },
  { ...pasoDelMotor("investment"), description: "La inversión mensual en equipo, tu cámara principal y las otras cámaras del estudio." },
  { ...pasoDelMotor("emergency-fund"), description: "Reserva mensual del estudio para imprevistos." },
  { id: "studio-lines", title: "Otras líneas y ganancia", description: "Lo que dejan los productos o los cursos y la ganancia del estudio para reinvertir.", motor: false },
  pasoDelMotor("commercial-positioning"),
  PASO_COBROS,
  { id: "studio-summary", title: "Resumen del estudio", description: "Lo que cuesta el estudio por mes, las horas que puede cobrar y cuánto vale la hora de cada uno.", motor: false },
];

/** Con el local separado: «Local y coberturas» después de «Vos en el estudio» y sin el retiro (no se usa). */
const PASOS_ESTUDIO_SEPARADO: Paso[] = PASOS_ESTUDIO.map((p) =>
  p.id === "studio-owner" ? { ...p, description: "Tu jornada y la parte de tu tiempo que se puede cobrar." } : p,
);
const PASOS_ESTUDIO_JUNTO: Paso[] = PASOS_ESTUDIO.filter((p) => p.id !== "studio-local");

const SIN_TEXTOS: Partial<Record<string, TextoDePaso>> = {};
const SIN_PASOS: PasoAgregado[] = [];

/**
 * Formulario del perfil de precios, con la forma del asistente de ¿Cuánto Cobro?: un paso por vez,
 * los pasos a la izquierda con su estado y el resumen en vivo (el mismo cálculo de los presupuestos).
 */
export function PerfilForm({
  inicial,
  version,
  bot = null,
  estudio = null,
  accion = guardarPerfilPreciosAction,
  textos = SIN_TEXTOS,
  pasosAgregados = SIN_PASOS,
}: {
  inicial: CuantoCobroProfileInput;
  version: string | null;
  /** DNX Bot encendido para este workspace: se ofrece armarlo conversando sólo si la persona parece trabada. */
  bot?: { workspaceId: string } | null;
  /**
   * Mi estudio: si se ofrece (workspace de tipo estudio), los miembros para vincular a cada persona y,
   * para «Local y coberturas», las categorías de ingreso de Caja y lo que vendió el local.
   */
  estudio?: (Pick<DatosDeMiEstudio, "ofrece" | "miembros"> & Partial<Pick<DatosDeMiEstudio, "categoriasIngreso" | "ventasLocal">>) | null;
  /** Dónde se guarda. Por omisión, el perfil del workspace (Configuración → Precios). */
  accion?: (perfil: unknown, versionCargada?: string | null) => Promise<ResultadoPerfilPrecios>;
  /** Títulos y explicaciones propios para algunos pasos, por id. */
  textos?: Partial<Record<string, TextoDePaso>>;
  /** Pasos que van al final, después de los del perfil. */
  pasosAgregados?: PasoAgregado[];
}) {
  const pesos = useFormatearPesos();
  const [perfil, setPerfil] = useState(inicial);
  const modoEstudio = isStudioModeActive(perfil);
  const separado = isSeparateLocalActive(perfil);
  const PASOS = useMemo(
    () => [
      ...(modoEstudio ? (separado ? PASOS_ESTUDIO_SEPARADO : PASOS_ESTUDIO_JUNTO) : PASOS_SOLO).map((p) => ({ ...p, ...textos[p.id] })),
      ...pasosAgregados.map((p) => ({ id: p.id, title: p.title, description: p.description, motor: false })),
    ],
    [modoEstudio, separado, textos, pasosAgregados],
  );
  const contenidos = useMemo(
    () => ({ ...(modoEstudio ? CONTENIDO_ESTUDIO : CONTENIDO), ...Object.fromEntries(pasosAgregados.map((p) => [p.id, p.Contenido])) }),
    [modoEstudio, pasosAgregados],
  );
  /** Cuándo se guardó el perfil que se está editando (null: no había): para no pisar un cambio de otro (o de DNX Bot). */
  const [versionCargada, setVersionCargada] = useState(version);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();
  const [indice, setIndice] = useState(0);
  const [mostrarFaltan, setMostrarFaltan] = useState(false);
  const resumen = useMemo(() => resumirPerfil(perfil), [perfil]);
  /** Intentó guardar y no pudo, o lo que guardó sigue incompleto: una señal de que está trabada (oferta del bot). */
  const [guardadoTrabado, setGuardadoTrabado] = useState(false);
  const faltanPorPaso = useMemo(
    () => PASOS.map((p) => (p.motor ? getCuantoCobroMissingFields(p.id as CuantoCobroStepId | CuantoCobroStudioStepId, perfil, INITIAL_CUANTO_COBRO_QUOTE) : [])),
    [perfil, PASOS],
  );

  const paso = PASOS[Math.min(indice, PASOS.length - 1)];
  const faltan = faltanPorPaso[indice];
  const progreso = ((indice + 1) / PASOS.length) * 100;
  const ultimo = indice === PASOS.length - 1;
  const Contenido = contenidos[paso.id]!;

  const cambiar = (parcial: Partial<CuantoCobroProfileInput>) => {
    setPerfil((p) => ({ ...p, ...parcial }));
    setOk(null);
    setError(null);
    setMostrarFaltan(false);
  };

  /** Encender o apagar Mi estudio. Apagar no borra nada: el bloque queda guardado con `enabled: false`. */
  function cambiarModo(encender: boolean) {
    const actual = perfil.studioStructure;
    cambiar({ studioStructure: encender ? encenderMiEstudio(perfil) : actual ? { ...actual, enabled: false } : undefined });
    setIndice(0);
  }

  function irA(i: number) {
    setMostrarFaltan(false);
    setIndice(Math.max(0, Math.min(i, PASOS.length - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function siguiente() {
    if (faltan.length > 0) {
      setMostrarFaltan(true);
      return;
    }
    irA(indice + 1);
  }

  function guardar() {
    setError(null);
    setOk(null);
    const v = validarPerfil(perfil);
    if (!v.ok) {
      setError(v.error);
      setGuardadoTrabado(true);
      return;
    }
    empezar(async () => {
      const r = await accion(perfil, versionCargada);
      if (r.ok) {
        setVersionCargada(r.actualizado);
        setOk("Perfil guardado.");
        if (!resumirPerfil(perfil).completo) setGuardadoTrabado(true);
      } else {
        setError(r.error);
        setGuardadoTrabado(true);
      }
    });
  }

  const barra = (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full border border-[var(--fo-border)] bg-[var(--fo-surface-muted)]"
      role="progressbar"
      aria-valuenow={Math.round(progreso)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--fo-accent),color-mix(in_srgb,var(--fo-accent)_80%,#22c55e))] transition-[width] duration-300"
        style={{ width: `${progreso}%` }}
      />
    </div>
  );

  const indicador = (i: number, actual: boolean) => {
    const completo = faltanPorPaso[i].length === 0;
    return (
      <span
        aria-label={completo ? "Completo" : "Incompleto"}
        className={
          "inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full " +
          (actual
            ? "bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)] shadow-[0_0_0_3px_var(--fo-accent-muted)]"
            : completo
              ? "bg-[color-mix(in_srgb,var(--fo-success)_14%,transparent)] text-[var(--fo-success)]"
              : "bg-[color-mix(in_srgb,var(--fo-warning,#d97706)_14%,transparent)] text-[var(--fo-warning,#d97706)]")
        }
      >
        {completo ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {bot ? <OfertaArmarConversando workspaceId={bot.workspaceId} perfilCompleto={resumen.completo} guardadoTrabado={guardadoTrabado} /> : null}
      {estudio?.ofrece || modoEstudio ? (
        <div className="fo-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          {modoEstudio ? (
            <p className="text-sm">
              <strong>Mi estudio está encendido.</strong> Los gastos del local, tu retiro y los sueldos van separados, y cada hora se puede cobrar según quién la hace.
              {estudio?.ofrece ? null : " Tu organización ya no es de tipo estudio: podés apagarlo."}
            </p>
          ) : (
            <p className="text-sm">
              <strong>¿Trabajás con equipo?</strong> Encendé «Mi estudio» para separar los gastos del local, tu retiro y los sueldos, y para que cada hora se cobre
              según quién la hace. Si lo apagás, vuelve todo como estaba.
            </p>
          )}
          <button type="button" className={modoEstudio ? "fo-btn fo-btn-secondary shrink-0" : "fo-btn fo-btn-primary shrink-0"} onClick={() => cambiarModo(!modoEstudio)}>
            {modoEstudio ? "Apagar Mi estudio" : "Encender Mi estudio"}
          </button>
        </div>
      ) : null}
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] shadow-[var(--fo-shadow-xs)] lg:grid lg:grid-cols-[16rem_1fr]">
      <aside
        className="hidden flex-col border-r border-[var(--fo-border)] bg-[color-mix(in_srgb,var(--fo-surface-muted)_55%,var(--fo-bg-elevated))] lg:flex"
        aria-label="Pasos del perfil"
      >
        <div className="border-b border-[var(--fo-border)] px-4 pb-3.5 pt-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--fo-muted)]">Progreso general</span>
            <span className="whitespace-nowrap text-xs font-semibold">
              Paso {indice + 1} de {PASOS.length}
            </span>
          </div>
          {barra}
        </div>
        <nav className="flex-1 px-2.5 py-3">
          <p className="px-2 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--fo-muted)]">{modoEstudio ? "Mi estudio" : "Perfil del fotógrafo"}</p>
          <ul className="space-y-0.5">
            {PASOS.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => irA(i)}
                  aria-current={i === indice ? "step" : undefined}
                  className={
                    "flex w-full items-center gap-2.5 rounded-[0.625rem] border px-2.5 py-2 text-left text-sm transition-colors " +
                    (i === indice
                      ? "border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] font-semibold shadow-[var(--fo-shadow-xs)]"
                      : "border-transparent text-[var(--fo-muted)] hover:bg-[var(--fo-accent-muted)] hover:text-[var(--fo-text)]")
                  }
                >
                  {indicador(i, i === indice)}
                  <span className="min-w-0 leading-snug">{p.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-2 border-t border-[var(--fo-border)] px-4 py-4 text-[0.8125rem]" aria-label="Resumen en vivo">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--fo-muted)]">Tu resumen</p>
          <dl className="space-y-1.5">
            {[
              ["Necesidad mensual", pesos(resumen.necesidadMensual)],
              ["Horas que se cobran por mes", String(Math.round(resumen.horasFacturablesMes * 10) / 10)],
              ...(modoEstudio ? [] : [["Costo de tu hora", resumen.costoHora === null ? "—" : pesos(resumen.costoHora)]]),
            ].map(([t, v]) => (
              <div key={t} className="flex justify-between gap-2">
                <dt className="text-[var(--fo-muted)]">{t}</dt>
                <dd className="font-medium tabular-nums">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 pt-1">
              <dt className="font-semibold">{modoEstudio ? "Valor hora del estudio" : "Valor de tu hora"}</dt>
              <dd className="font-bold tabular-nums text-[var(--fo-accent)]">{resumen.valorHora === null ? "—" : pesos(resumen.valorHora)}</dd>
            </div>
          </dl>
        </div>
        <p className="border-t border-[var(--fo-border)] px-4 py-3 text-xs leading-snug text-[var(--fo-muted)]">{CC_DATA_SECURITY_NOTICE}</p>
      </aside>

      <form
        className="min-w-0"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        {/* En el celular: el paso actual, la barra y los pasos como fichas. */}
        <div className="space-y-3 border-b border-[var(--fo-border)] p-4 lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fo-muted)]">
            Paso {indice + 1} de {PASOS.length} · {modoEstudio ? "Mi estudio" : "Perfil del fotógrafo"}
          </p>
          {barra}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Elegir paso">
            {PASOS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === indice}
                onClick={() => irA(i)}
                className={
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs " +
                  (i === indice ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] font-semibold" : "border-[var(--fo-border)]")
                }
              >
                {faltanPorPaso[i].length === 0 ? (
                  <Check className="h-3 w-3 text-[var(--fo-success)]" strokeWidth={2.5} aria-hidden />
                ) : (
                  <AlertCircle className="h-3 w-3 text-[var(--fo-warning,#d97706)]" strokeWidth={2.5} aria-hidden />
                )}
                {p.title}
              </button>
            ))}
          </div>
          <p className="text-sm">
            {modoEstudio ? "Valor hora del estudio" : "Valor de tu hora"}:{" "}
            <strong className="text-[var(--fo-accent)]">{resumen.valorHora === null ? "—" : pesos(resumen.valorHora)}</strong>
          </p>
        </div>

        <article>
          <header className="border-b border-[var(--fo-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fo-surface-muted)_70%,var(--fo-bg-elevated))_0%,var(--fo-bg-elevated)_100%)] px-5 pb-4 pt-5 sm:px-6 sm:pb-[1.125rem] sm:pt-6">
            <span className="inline-flex items-center rounded-full border border-[var(--fo-border-strong)] bg-[var(--fo-accent-muted)] px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide">
              Perfil
            </span>
            <h2 className="mt-3 text-[clamp(1.25rem,2.5vw,1.5rem)] font-bold leading-tight tracking-tight">{paso.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fo-muted)]">{paso.description}</p>
          </header>

          <div className="space-y-5 p-5 sm:p-6">
            <Contenido
              perfil={perfil}
              cambiar={cambiar}
              miembros={estudio?.miembros ?? []}
              categoriasIngreso={estudio?.categoriasIngreso ?? []}
              ventasLocal={estudio?.ventasLocal ?? null}
            />
            {mostrarFaltan && faltan.length > 0 ? (
              <div role="alert">
                <Aviso tono="alerta">
                  <p className="font-medium">Completá lo siguiente para continuar:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {faltan.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </Aviso>
              </div>
            ) : null}
          </div>

          {ok || error ? (
            <div className="px-5 pb-3 sm:px-6">
              {ok ? (
                <p role="status" className="text-sm text-[var(--fo-success)]">
                  {ok}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-[var(--fo-danger)]">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
          <footer className="flex items-center justify-between gap-2 border-t border-[var(--fo-border)] px-5 py-4 sm:px-6">
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => irA(indice - 1)} disabled={indice === 0}>
              Anterior
            </button>
            <div className="flex items-center gap-2">
              <button type="submit" className={ultimo ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              {ultimo ? null : (
                <button type="button" className="fo-btn fo-btn-primary" onClick={siguiente}>
                  Siguiente
                </button>
              )}
            </div>
          </footer>
        </article>
      </form>
    </div>
    </div>
  );
}
