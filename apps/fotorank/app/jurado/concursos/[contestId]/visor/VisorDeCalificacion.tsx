"use client";

/**
 * El visor donde el jurado califica.
 *
 * Una consigna por vez, la fotografía lo más grande posible y los criterios
 * abajo. Todo se maneja con el teclado: las flechas miran, el Tab califica.
 *
 * Cada nota se guarda apenas se pone. Si la persona cierra la pestaña, lo
 * cargado está; lo que falta es enviar, que es otra cosa y se avisa aparte.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AyudaDelVisor } from "./AyudaDelVisor";
import {
  enviarCalificacionesAction,
  guardarNotaAction,
  latidoDelVisorAction,
} from "../../../../actions/juryVisor";
import {
  FILTROS_DEL_VISOR,
  estadoDeLaObra,
  laSiguiente,
  obrasVisibles,
  resumenDeLaCola,
  type FiltroDelVisor,
  type ObraEnElVisor,
} from "../../../../lib/fotorank/jury/colaDelVisor";
import {
  FOTOS_MINIMAS_PARA_ESTIMAR,
  loQueFalta,
  ritmoDelJurado,
} from "../../../../lib/fotorank/jury/ritmoDelJurado";
import type { ColaDelVisor } from "../../../../lib/fotorank/jury/visor-service";

type Fondo = "gris" | "oscuro" | "claro";

const FONDOS: Array<{ id: Fondo; nombre: string; muestra: string }> = [
  { id: "oscuro", nombre: "Fondo oscuro", muestra: "#111111" },
  { id: "gris", nombre: "Fondo gris", muestra: "#767676" },
  { id: "claro", nombre: "Fondo claro", muestra: "#eceae6" },
];

/** Cada cuánto late, mientras haya pantalla a la vista y actividad. */
const LATIDO_SEGUNDOS = 30;

const CLAVE_DEL_FONDO = "fr-visor-fondo";

export function VisorDeCalificacion({
  contestId,
  cola,
}: {
  contestId: string;
  cola: ColaDelVisor;
}) {
  const criterios = useMemo(
    () => cola.rubrica?.criterios ?? [],
    [cola.rubrica],
  );
  const clavesDeCriterio = useMemo(
    () => criterios.map((c) => c.key),
    [criterios],
  );

  const [obras, setObras] = useState<ObraEnElVisor[]>(cola.obras);
  const [consigna, setConsigna] = useState<number | null>(
    cola.consignas[0]?.numero ?? null,
  );
  const [filtro, setFiltro] = useState<FiltroDelVisor>("TODAS");
  const [entryIdActual, setEntryIdActual] = useState<string | null>(
    cola.obras.find(
      (o) => o.consignaNumero === (cola.consignas[0]?.numero ?? null),
    )?.entryId ??
      cola.obras[0]?.entryId ??
      null,
  );
  const [criterioActivo, setCriterioActivo] = useState(0);
  const [fondo, setFondo] = useState<Fondo>("gris");
  const [inmersivo, setInmersivo] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ritmo, setRitmo] = useState<{
    segundosActivos: number;
    calificadas: number;
  } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const huboInteraccion = useRef(false);
  const contenedor = useRef<HTMLDivElement | null>(null);

  /*
   * La lista se congela mientras el jurado trabaja una consigna.
   *
   * Si se recalculara con cada nota, al completar la cuarta la foto saldría del
   * filtro y desaparecería de abajo de las manos, mandando el visor a otro
   * lado. Se rearma sólo al cambiar de consigna o de filtro, que es cuando el
   * jurado pidió otra cosa.
   */
  const [idsVisibles, setIdsVisibles] = useState<string[]>(() =>
    obrasVisibles(cola.obras, clavesDeCriterio, {
      consigna: cola.consignas[0]?.numero ?? null,
      filtro: "TODAS",
    }).map((o) => o.entryId),
  );

  const visibles = useMemo(() => {
    const porId = new Map(obras.map((o) => [o.entryId, o]));
    return idsVisibles.flatMap((id) => {
      const o = porId.get(id);
      return o ? [o] : [];
    });
  }, [obras, idsVisibles]);

  function rearmarLista(
    nuevaConsigna: number | null,
    nuevoFiltro: FiltroDelVisor,
  ) {
    const lista = obrasVisibles(obras, clavesDeCriterio, {
      consigna: nuevaConsigna,
      filtro: nuevoFiltro,
    });
    setIdsVisibles(lista.map((o) => o.entryId));
    return lista;
  }
  const actual = useMemo(
    () =>
      visibles.find((o) => o.entryId === entryIdActual) ?? visibles[0] ?? null,
    [visibles, entryIdActual],
  );
  const resumen = useMemo(
    () => resumenDeLaCola(obras, clavesDeCriterio),
    [obras, clavesDeCriterio],
  );

  /* ---------- el fondo se recuerda ---------- */

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_DEL_FONDO);
      if (
        guardado === "gris" ||
        guardado === "oscuro" ||
        guardado === "claro"
      ) {
        setFondo(guardado);
      }
    } catch {
      /* Sin almacenamiento el visor funciona igual; sólo no recuerda. */
    }
  }, []);

  function elegirFondo(nuevo: Fondo) {
    setFondo(nuevo);
    try {
      window.localStorage.setItem(CLAVE_DEL_FONDO, nuevo);
    } catch {
      /* Da igual: es una comodidad, no un dato. */
    }
  }

  /* ---------- el latido ---------- */

  useEffect(() => {
    const marcar = () => {
      huboInteraccion.current = true;
    };
    window.addEventListener("keydown", marcar);
    window.addEventListener("pointerdown", marcar);
    window.addEventListener("pointermove", marcar);

    const reloj = window.setInterval(() => {
      // Las dos condiciones: pantalla a la vista y alguien haciendo algo.
      if (document.hidden || !huboInteraccion.current) return;
      huboInteraccion.current = false;
      void latidoDelVisorAction({
        contestId,
        segundosDesdeElUltimo: LATIDO_SEGUNDOS,
      })
        .then(setRitmo)
        .catch(() => {
          /* Un latido perdido no interrumpe la calificación. */
        });
    }, LATIDO_SEGUNDOS * 1000);

    return () => {
      window.removeEventListener("keydown", marcar);
      window.removeEventListener("pointerdown", marcar);
      window.removeEventListener("pointermove", marcar);
      window.clearInterval(reloj);
    };
  }, [contestId]);

  /* ---------- calificar ---------- */

  const ponerNota = useCallback(
    (valor: number) => {
      if (!actual || !cola.sePuedeCalificar || actual.enviada) return;
      const criterio = criterios[criterioActivo];
      if (!criterio) return;
      if (valor < criterio.min || valor > criterio.max) return;

      const notas = { ...actual.notas, [criterio.key]: valor };
      setObras((previas) =>
        previas.map((o) =>
          o.entryId === actual.entryId ? { ...o, notas } : o,
        ),
      );

      if (actual.snapshotId) {
        void guardarNotaAction({
          contestId,
          snapshotId: actual.snapshotId,
          notas: Object.entries(notas).map(([key, score]) => ({ key, score })),
        }).then((r) => {
          if (!r.ok && r.mensaje) setAviso(r.mensaje);
        });
      }

      // Al poner la nota el foco avanza solo: una foto son cuatro teclas.
      if (criterioActivo < criterios.length - 1)
        setCriterioActivo(criterioActivo + 1);
    },
    [actual, criterios, criterioActivo, cola.sePuedeCalificar, contestId],
  );

  const moverFoto = useCallback(
    (paso: 1 | -1) => {
      if (!actual) return;
      const siguiente = laSiguiente(visibles, actual.entryId, paso);
      if (!siguiente) return;
      setEntryIdActual(siguiente.entryId);
      setCriterioActivo(paso > 0 ? 0 : Math.max(0, criterios.length - 1));
    },
    [actual, visibles, criterios.length],
  );

  const moverCriterio = useCallback(
    (paso: 1 | -1) => {
      const siguiente = criterioActivo + paso;
      if (siguiente < 0 || siguiente >= criterios.length) {
        moverFoto(paso);
        return;
      }
      setCriterioActivo(siguiente);
    },
    [criterioActivo, criterios.length, moverFoto],
  );

  /* ---------- el teclado ---------- */

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const destino = e.target as HTMLElement | null;
      if (
        destino &&
        (destino.tagName === "TEXTAREA" || destino.tagName === "INPUT")
      )
        return;

      if (e.key === "?" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        setAyuda((v) => !v);
        return;
      }
      // Con la ayuda abierta el teclado es de la ayuda: nadie califica sin ver la foto.
      if (ayuda) return;

      if (e.key === "Tab") {
        e.preventDefault();
        moverCriterio(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moverFoto(1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moverFoto(-1);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setInmersivo((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInmersivo(false);
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        ponerNota(e.key === "0" ? 10 : Number(e.key));
      }
    }

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [ayuda, moverCriterio, moverFoto, ponerNota]);

  /* ---------- enviar ---------- */

  async function enviarTodo() {
    const terminadas = obras.filter(
      (o) =>
        !o.enviada &&
        estadoDeLaObra(o, clavesDeCriterio) === "CALIFICADA" &&
        o.snapshotId,
    );
    if (terminadas.length === 0) {
      setAviso("Todavía no hay ninguna obra con los cuatro criterios puestos.");
      return;
    }
    if (
      resumen.sinTerminar > 0 &&
      !window.confirm(
        `Quedan ${resumen.sinTerminar} obras con alguna nota puesta y alguna faltando. ` +
          `Esas no se envían y no cuentan para el resultado. ¿Enviar las ${terminadas.length} terminadas igual?`,
      )
    ) {
      return;
    }

    setEnviando(true);
    const r = await enviarCalificacionesAction({
      contestId,
      obras: terminadas.map((o) => ({
        snapshotId: o.snapshotId!,
        notas: Object.entries(o.notas).map(([key, score]) => ({ key, score })),
      })),
    });
    setEnviando(false);
    setAviso(r.mensaje ?? null);
    if (r.ok) {
      const enviadas = new Set(terminadas.map((o) => o.entryId));
      setObras((previas) =>
        previas.map((o) =>
          enviadas.has(o.entryId) ? { ...o, enviada: true } : o,
        ),
      );
    }
  }

  /* ---------- lo que se ve ---------- */

  const estimacion = (() => {
    if (!ritmo) return null;
    const r = ritmoDelJurado({
      segundosActivos: ritmo.segundosActivos,
      fotosCalificadas: resumen.calificadas,
    });
    if (!r) return null;
    return loQueFalta({
      segundosPorFoto: r.segundosPorFoto,
      fotosQueFaltan: resumen.faltan,
    });
  })();

  const colores = {
    oscuro: {
      fondo: "#111111",
      panel: "#1c1c1c",
      linea: "#2e2e2e",
      tinta: "#ededea",
      suave: "#9a9894",
      chip: "#262626",
    },
    gris: {
      fondo: "#767676",
      panel: "#5c5c5c",
      linea: "#8a8a8a",
      tinta: "#f8f7f5",
      suave: "#d6d4d0",
      chip: "#4e4e4e",
    },
    claro: {
      fondo: "#eceae6",
      panel: "#dedbd5",
      linea: "#c7c3bb",
      tinta: "#1b1917",
      suave: "#5f594f",
      chip: "#cbc7bf",
    },
  }[fondo];

  if (cola.obras.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-fr-primary">
          No hay obras para calificar
        </h1>
        <p className="mt-4 text-sm text-fr-muted">
          Todavía no te tocó ninguna obra en este concurso. Si creés que es un
          error, escribile a la organización.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={contenedor}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: colores.fondo, color: colores.tinta }}
    >
      {/* Consignas */}
      <div
        className="flex gap-px overflow-x-auto"
        hidden={inmersivo}
        style={{
          background: colores.linea,
          borderBottom: `1px solid ${colores.linea}`,
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {cola.consignas.map((c) => {
          const suyas = obras.filter((o) => o.consignaNumero === c.numero);
          const listas = suyas.filter(
            (o) => estadoDeLaObra(o, clavesDeCriterio) === "CALIFICADA",
          ).length;
          const elegida = c.numero === consigna;
          return (
            <button
              key={c.numero}
              type="button"
              onClick={() => {
                setConsigna(c.numero);
                const lista = rearmarLista(c.numero, filtro);
                if (lista[0]) setEntryIdActual(lista[0].entryId);
                setCriterioActivo(0);
              }}
              className="flex min-h-10 items-center gap-2 whitespace-nowrap px-4 text-[13px]"
              style={{
                background: elegida ? colores.fondo : colores.panel,
                color: elegida ? colores.tinta : colores.suave,
                fontWeight: elegida ? 600 : 500,
                boxShadow: elegida ? "inset 0 -2px 0 #e0a061" : undefined,
              }}
            >
              Consigna {c.numero} · {c.titulo}
              <span className="font-mono text-[11px] tabular-nums opacity-75">
                {listas === suyas.length
                  ? `✓ ${suyas.length}`
                  : `${listas}/${suyas.length}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2"
        hidden={inmersivo}
        style={{
          background: colores.panel,
          borderBottom: `1px solid ${colores.linea}`,
        }}
      >
        <p className="mr-auto font-mono text-xs tabular-nums">
          {actual ? (
            <>
              foto {visibles.indexOf(actual) + 1} de {visibles.length}
              <span style={{ color: colores.suave }}> · </span>
              <b>{actual.codigo}</b>
            </>
          ) : (
            <span style={{ color: colores.suave }}>Sin fotos para mostrar</span>
          )}
        </p>

        <div
          className="flex gap-px"
          style={{
            background: colores.linea,
            border: `1px solid ${colores.linea}`,
          }}
          role="group"
          aria-label="Qué fotos mostrar"
        >
          {FILTROS_DEL_VISOR.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => {
                setFiltro(f.id);
                const lista = rearmarLista(consigna, f.id);
                if (
                  lista.length > 0 &&
                  !lista.some((o) => o.entryId === entryIdActual)
                ) {
                  setEntryIdActual(lista[0]!.entryId);
                  setCriterioActivo(0);
                }
              }}
              className="min-h-9 px-3 text-xs font-medium"
              style={{
                background: filtro === f.id ? colores.tinta : colores.panel,
                color: filtro === f.id ? colores.panel : colores.suave,
              }}
            >
              {f.nombre}
            </button>
          ))}
        </div>

        <div
          className="flex gap-px"
          style={{
            background: colores.linea,
            border: `1px solid ${colores.linea}`,
          }}
          role="group"
          aria-label="Fondo"
        >
          {FONDOS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={fondo === f.id}
              aria-label={f.nombre}
              title={f.nombre}
              onClick={() => elegirFondo(f.id)}
              className="relative h-9 w-9"
              style={{ background: f.muestra }}
            >
              {fondo === f.id ? (
                <span
                  className="absolute inset-[3px] border-2"
                  style={{ borderColor: "#e0a061" }}
                />
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void enviarTodo()}
          disabled={enviando || !cola.sePuedeCalificar}
          className="min-h-9 px-3 text-xs font-semibold disabled:opacity-50"
          style={{ background: "#e0a061", color: "#1b1917" }}
        >
          {enviando ? "Enviando…" : "Enviar calificaciones"}
        </button>

        <button
          type="button"
          onClick={() => setAyuda(true)}
          className="min-h-9 px-3 text-xs font-medium"
          style={{ border: `1px solid ${colores.linea}`, color: colores.suave }}
          title="Cómo se usa el visor (tecla H)"
        >
          Ayuda
        </button>

        <a
          href="/jurado/panel"
          className="min-h-9 px-3 text-xs"
          style={{ color: colores.suave }}
        >
          Salir
        </a>
      </div>

      {/* La fotografía */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {actual?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={actual.previewUrl}
            alt={`Obra ${actual.codigo}`}
            /*
             * La foto va absoluta y pegada a los cuatro bordes del hueco.
             *
             * Centrada y con `h-full` a secas no funcionaba: una imagen es un
             * elemento reemplazado, y un alto en porcentaje contra una caja sin
             * alto definido no resuelve. La foto terminaba dimensionada sólo por
             * el ancho --1424 x 949 en un hueco de 635-- y se veía recortada.
             *
             * Absoluta, el alto resuelve contra una caja que sí tiene medida, y
             * `object-contain` la agranda hasta que toca un borde y deja franjas
             * del color del fondo en el otro. Entera siempre, sin deformar.
             */
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <p className="grid h-full place-items-center px-4 text-center" style={{ color: colores.suave }}>
            {actual
              ? "No pudimos mostrar esta fotografía."
              : "No queda ninguna con este filtro."}
          </p>
        )}

        {inmersivo ? (
          <p
            className="pointer-events-none absolute bottom-3 left-4 font-mono text-[11px]"
            style={{ color: colores.tinta, opacity: 0.55, mixBlendMode: "difference" }}
          >
            {actual?.codigo} · F o Esc para volver
          </p>
        ) : null}

        {aviso ? (
          <p
            className="absolute right-4 top-3 px-3 py-1.5 text-xs"
            style={{ background: colores.chip, color: colores.tinta }}
            role="status"
          >
            {aviso}
          </p>
        ) : null}
      </div>

      {/* Criterios */}
      <div
        hidden={inmersivo}
        style={{
          background: colores.panel,
          borderTop: `1px solid ${colores.linea}`,
          padding: "10px 14px",
          paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {actual?.enviada ? (
          <p className="text-sm" style={{ color: colores.suave }}>
            Esta obra ya fue enviada y no se puede cambiar.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-4 md:gap-3">
            {criterios.map((c, i) => {
              const puesta = actual?.notas[c.key];
              const activo = i === criterioActivo;
              return (
                <div
                  key={c.key}
                  className="grid gap-1.5 p-2"
                  style={{
                    border: `1px solid ${activo ? "#e0a061" : "transparent"}`,
                    background: activo
                      ? "rgba(224,160,97,0.12)"
                      : "transparent",
                  }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold">{c.nombre}</span>
                    <span
                      className="min-w-[2ch] text-right font-mono text-[15px] font-semibold tabular-nums"
                      style={{
                        color:
                          typeof puesta === "number"
                            ? "#e0a061"
                            : colores.suave,
                      }}
                    >
                      {typeof puesta === "number" ? puesta : "–"}
                    </span>
                  </div>
                  <div
                    className="flex gap-0.5"
                    role="radiogroup"
                    aria-label={`${c.nombre}, del ${c.min} al ${c.max}`}
                  >
                    {Array.from(
                      { length: c.max - c.min + 1 },
                      (_, k) => c.min + k,
                    ).map((valor) => (
                      <button
                        key={valor}
                        type="button"
                        role="radio"
                        aria-checked={puesta === valor}
                        aria-label={`${valor} en ${c.nombre}`}
                        onClick={() => {
                          setCriterioActivo(i);
                          ponerNota(valor);
                        }}
                        className="h-8 min-w-0 flex-1 font-mono text-[11px] font-medium"
                        style={
                          puesta === valor
                            ? {
                                background: "#e0a061",
                                border: "1px solid #e0a061",
                                color: "#1b1917",
                                fontWeight: 600,
                              }
                            : {
                                background: colores.chip,
                                border: `1px solid ${colores.linea}`,
                                color: colores.suave,
                              }
                        }
                      >
                        {valor}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px]"
          style={{ color: colores.suave }}
        >
          <span>← → mirar</span>
          <span>Tab calificar</span>
          <span>{criterios[0] ? `${criterios[0].min}-9 · 0 = 10` : ""}</span>
          <span>F pantalla completa</span>
          <span>H ayuda</span>
          <span>
            {resumen.calificadas} de {resumen.total} listas
            {resumen.sinTerminar > 0
              ? ` · ${resumen.sinTerminar} sin terminar`
              : ""}
          </span>
          {estimacion ? <span>{estimacion}</span> : null}
          {!estimacion && resumen.calificadas < FOTOS_MINIMAS_PARA_ESTIMAR ? (
            <span>
              estimación de tiempo tras {FOTOS_MINIMAS_PARA_ESTIMAR} fotos
            </span>
          ) : null}
        </p>
      </div>

      {ayuda ? (
        <AyudaDelVisor
          colores={colores}
          cantidadDeCriterios={criterios.length}
          notaMaxima={criterios[0]?.max ?? 10}
          onCerrar={() => setAyuda(false)}
        />
      ) : null}
    </div>
  );
}
