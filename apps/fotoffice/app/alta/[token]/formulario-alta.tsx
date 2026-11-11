"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { InputMoneda } from "@/components/campos/input-moneda";
import {
  avance,
  seMuestra,
  type CampoDeLista,
  type Cuestionario,
  type Pregunta,
  type Respuestas,
  type Valor,
} from "@/lib/alta-cliente/tipos";
import { enviarAlta, guardarAlta } from "./actions";

const CAMPO = "fo-input text-base";
const ESPERA_GUARDADO_MS = 1200;

type EstadoGuardado = "listo" | "pendiente" | "guardando" | "error";

export function FormularioAlta({
  token,
  cuestionario,
  inicial,
  enviadoAntes,
}: {
  token: string;
  cuestionario: Cuestionario;
  inicial: Respuestas;
  enviadoAntes: boolean;
}) {
  const [respuestas, setRespuestas] = useState<Respuestas>(inicial);
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState<EstadoGuardado>("listo");
  const [enviado, setEnviado] = useState(enviadoAntes);
  const [faltan, setFaltan] = useState<string[]>([]);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, startEnvio] = useTransition();
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimas = useRef(respuestas);
  const arriba = useRef<HTMLDivElement>(null);

  const secciones = useMemo(
    () => cuestionario.secciones.filter((s) => seMuestra(s, respuestas)),
    [cuestionario, respuestas],
  );
  const seccion = secciones[Math.min(paso, secciones.length - 1)];
  const esUltima = paso >= secciones.length - 1;
  const { visibles, respondidas } = avance(cuestionario, respuestas);
  const porcentaje = visibles === 0 ? 0 : Math.round((respondidas * 100) / visibles);

  const guardarAhora = useCallback(async () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setGuardado("guardando");
    const r = await guardarAlta(token, ultimas.current);
    setGuardado(r.ok ? "listo" : "error");
    return r.ok;
  }, [token]);

  const cambiar = useCallback(
    (id: string, valor: Valor) => {
      setRespuestas((prev) => {
        const nuevas = { ...prev, [id]: valor };
        ultimas.current = nuevas;
        return nuevas;
      });
      setGuardado("pendiente");
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => void guardarAhora(), ESPERA_GUARDADO_MS);
    },
    [guardarAhora],
  );

  // Reintento si quedó con error, y aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (guardado !== "error") return;
    const t = setTimeout(() => void guardarAhora(), 5000);
    return () => clearTimeout(t);
  }, [guardado, guardarAhora]);
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (guardado === "pendiente" || guardado === "guardando") e.preventDefault();
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [guardado]);

  function irA(n: number) {
    void guardarAhora();
    setPaso(Math.max(0, Math.min(n, secciones.length - 1)));
    arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function enviar() {
    setErrorEnvio(null);
    setFaltan([]);
    startEnvio(async () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      const r = await enviarAlta(token, ultimas.current);
      if (r.ok) {
        setGuardado("listo");
        setEnviado(true);
        arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        setErrorEnvio(r.error);
        setFaltan(r.faltan ?? []);
      }
    });
  }

  if (!seccion) return null;

  return (
    <div ref={arriba} className="space-y-5 scroll-mt-4">
      {enviado ? (
        <div role="status" className="fo-alert-success rounded-xl p-4 text-sm leading-relaxed">
          <p className="font-semibold">¡Recibimos tus respuestas, gracias!</p>
          <p>Con esto armamos tu espacio y te avisamos. Si te acordás de algo más, podés seguir completando: se guarda solo.</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--fo-muted)]">
          <span>
            Paso {paso + 1} de {secciones.length} · {porcentaje}% respondido
          </span>
          <span aria-live="polite">
            {guardado === "guardando" || guardado === "pendiente"
              ? "Guardando…"
              : guardado === "error"
                ? "Sin conexión, reintentando…"
                : "Guardado"}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--fo-border)]">
          <div className="h-full rounded-full bg-[var(--fo-accent)] transition-all" style={{ width: `${porcentaje}%` }} />
        </div>
        <nav aria-label="Secciones" className="flex flex-wrap gap-1.5 pt-1">
          {secciones.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => irA(i)}
              aria-current={i === paso ? "step" : undefined}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                i === paso
                  ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
                  : "border-[var(--fo-border)] text-[var(--fo-muted)]"
              }`}
            >
              {s.titulo}
            </button>
          ))}
        </nav>
      </div>

      <section className="fo-card space-y-5 p-5">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{seccion.titulo}</h2>
          {seccion.intro ? <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{seccion.intro}</p> : null}
        </header>
        {seccion.preguntas
          .filter((p) => seMuestra(p, respuestas))
          .map((p) => (
            <CampoDePregunta key={p.id} pregunta={p} respuestas={respuestas} cambiar={cambiar} />
          ))}
      </section>

      {errorEnvio ? (
        <div role="alert" className="fo-alert-error rounded-xl p-4 text-sm">
          <p className="font-semibold">{errorEnvio}</p>
          {faltan.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {paso > 0 ? (
          <button type="button" className="fo-btn fo-btn-secondary" onClick={() => irA(paso - 1)}>
            ← Anterior
          </button>
        ) : (
          <span />
        )}
        {esUltima ? (
          <button type="button" className="fo-btn fo-btn-primary" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando…" : enviado ? "Enviar de nuevo" : "Enviar respuestas"}
          </button>
        ) : (
          <button type="button" className="fo-btn fo-btn-primary" onClick={() => irA(paso + 1)}>
            Siguiente →
          </button>
        )}
      </div>
    </div>
  );
}

function Encabezado({ p, htmlFor }: { p: Pregunta; htmlFor?: string }) {
  return (
    <>
      <label htmlFor={htmlFor} className="fo-label">
        {p.titulo}
        {p.obligatoria ? <span className="text-[var(--fo-accent)]"> *</span> : null}
      </label>
      {p.ayuda ? <span className="fo-helper">{p.ayuda}</span> : null}
    </>
  );
}

function CampoDePregunta({
  pregunta: p,
  respuestas,
  cambiar,
}: {
  pregunta: Pregunta;
  respuestas: Respuestas;
  cambiar: (id: string, v: Valor) => void;
}) {
  const v = respuestas[p.id];
  const id = `p-${p.id}`;
  const otro = typeof respuestas[`${p.id}__otro`] === "string" ? (respuestas[`${p.id}__otro`] as string) : "";

  switch (p.tipo) {
    case "parrafo":
      return (
        <div className="fo-field-stack">
          <Encabezado p={p} htmlFor={id} />
          <textarea
            id={id}
            rows={4}
            className={CAMPO}
            placeholder={p.placeholder}
            value={typeof v === "string" ? v : ""}
            onChange={(e) => cambiar(p.id, e.target.value)}
          />
        </div>
      );
    case "texto":
    case "email":
    case "telefono":
    case "enlace":
    case "fecha":
    case "numero": {
      const tipo = { texto: "text", email: "email", telefono: "tel", enlace: "url", fecha: "date", numero: "number" }[p.tipo];
      return (
        <div className="fo-field-stack">
          <Encabezado p={p} htmlFor={id} />
          <input
            id={id}
            type={tipo}
            inputMode={p.tipo === "numero" ? "numeric" : undefined}
            className={CAMPO}
            placeholder={p.placeholder}
            value={typeof v === "string" ? v : ""}
            onChange={(e) => cambiar(p.id, e.target.value)}
          />
        </div>
      );
    }
    case "dinero":
      return (
        <div className="fo-field-stack">
          <Encabezado p={p} htmlFor={id} />
          <InputMoneda
            id={id}
            className={CAMPO}
            decimales={false}
            placeholder={p.placeholder}
            value={typeof v === "string" ? v : ""}
            onChange={(x) => cambiar(p.id, x)}
          />
        </div>
      );
    case "si_no":
      return (
        <fieldset className="fo-field-stack">
          <legend className="fo-label">
            {p.titulo}
            {p.obligatoria ? <span className="text-[var(--fo-accent)]"> *</span> : null}
          </legend>
          {p.ayuda ? <span className="fo-helper">{p.ayuda}</span> : null}
          <div className="flex gap-2">
            {[
              { valor: true, etiqueta: "Sí" },
              { valor: false, etiqueta: "No" },
            ].map((o) => (
              <button
                key={o.etiqueta}
                type="button"
                aria-pressed={v === o.valor}
                onClick={() => cambiar(p.id, o.valor)}
                className={`fo-btn ${v === o.valor ? "fo-btn-primary" : "fo-btn-secondary"}`}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>
        </fieldset>
      );
    case "opcion":
    case "opciones": {
      const varias = p.tipo === "opciones";
      const elegidas = varias ? ((Array.isArray(v) ? v : []) as string[]) : [];
      return (
        <fieldset className="fo-field-stack">
          <legend className="fo-label">
            {p.titulo}
            {p.obligatoria ? <span className="text-[var(--fo-accent)]"> *</span> : null}
          </legend>
          {p.ayuda ? <span className="fo-helper">{p.ayuda}</span> : null}
          <div className="space-y-1.5">
            {p.opciones.map((o) => {
              const marcada = varias ? elegidas.includes(o.valor) : v === o.valor;
              return (
                <label key={o.valor} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--fo-border)] p-2.5 text-sm">
                  <input
                    type={varias ? "checkbox" : "radio"}
                    name={id}
                    className="mt-0.5"
                    checked={marcada}
                    onChange={() => {
                      if (!varias) return cambiar(p.id, o.valor);
                      cambiar(p.id, marcada ? elegidas.filter((x) => x !== o.valor) : [...elegidas, o.valor]);
                    }}
                  />
                  <span>
                    {o.etiqueta}
                    {o.ayuda ? <span className="block text-xs text-[var(--fo-muted)]">{o.ayuda}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
          {p.conOtro ? (
            <input
              aria-label={`${p.titulo}: otro`}
              className={CAMPO}
              placeholder="Otro (escribilo acá)"
              value={otro}
              onChange={(e) => cambiar(`${p.id}__otro`, e.target.value)}
            />
          ) : null}
        </fieldset>
      );
    }
    case "lista":
      return <CampoLista p={p} v={v} cambiar={cambiar} />;
  }
}

function CampoLista({
  p,
  v,
  cambiar,
}: {
  p: Extract<Pregunta, { tipo: "lista" }>;
  v: Valor | undefined;
  cambiar: (id: string, v: Valor) => void;
}) {
  const filas: Record<string, string>[] =
    Array.isArray(v) && (v.length === 0 || typeof v[0] === "object")
      ? (v as Record<string, string>[])
      : p.filasIniciales ?? [{}];
  const poner = (i: number, campo: string, valor: string) =>
    cambiar(
      p.id,
      filas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)),
    );

  return (
    <fieldset className="fo-field-stack">
      <legend className="fo-label">
        {p.titulo}
        {p.obligatoria ? <span className="text-[var(--fo-accent)]"> *</span> : null}
      </legend>
      {p.ayuda ? <span className="fo-helper">{p.ayuda}</span> : null}
      <div className="space-y-3">
        {filas.map((fila, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-[var(--fo-border)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--fo-muted)]">#{i + 1}</span>
              {filas.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-[var(--fo-muted)] underline"
                  onClick={() => cambiar(p.id, filas.filter((_, j) => j !== i))}
                >
                  Quitar
                </button>
              ) : null}
            </div>
            {p.campos.map((c) => (
              <CampoDeFila key={c.id} campo={c} valor={fila[c.id] ?? ""} poner={(x) => poner(i, c.id, x)} />
            ))}
          </div>
        ))}
      </div>
      <button type="button" className="fo-btn fo-btn-secondary self-start text-sm" onClick={() => cambiar(p.id, [...filas, {}])}>
        + {p.textoAgregar}
      </button>
    </fieldset>
  );
}

function CampoDeFila({ campo, valor, poner }: { campo: CampoDeLista; valor: string; poner: (v: string) => void }) {
  return (
    <label className="fo-field-stack">
      <span className="text-xs font-medium">{campo.titulo}</span>
      {campo.tipo === "parrafo" ? (
        <textarea rows={2} className={CAMPO} value={valor} onChange={(e) => poner(e.target.value)} />
      ) : campo.tipo === "dinero" ? (
        <InputMoneda className={CAMPO} decimales={false} value={valor} onChange={poner} />
      ) : campo.tipo === "opcion" ? (
        <select className={CAMPO} value={valor} onChange={(e) => poner(e.target.value)}>
          <option value="">Elegí…</option>
          {campo.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={campo.tipo === "numero" ? "number" : campo.tipo === "enlace" ? "url" : "text"}
          className={CAMPO}
          value={valor}
          onChange={(e) => poner(e.target.value)}
        />
      )}
    </label>
  );
}
