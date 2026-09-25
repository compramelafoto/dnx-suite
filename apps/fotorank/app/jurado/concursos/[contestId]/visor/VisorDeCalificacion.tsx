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
import { CriteriosEnElTelefono } from "./CriteriosEnElTelefono";
import { IconoDeFiltro, MenuFlotante } from "./MenuFlotante";
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
  apilar,
  borrarTodo,
  desapilar,
  ponerNota as ponerNotaEn,
  sacarNota,
  sonIguales,
  type NotasDeLaObra,
  type PasoAtras,
} from "../../../../lib/fotorank/jury/notasDeLaObra";
import {
  FOTOS_MINIMAS_PARA_ESTIMAR,
  loQueFalta,
  ritmoDelJurado,
} from "../../../../lib/fotorank/jury/ritmoDelJurado";
import type { ColaDelVisor } from "../../../../lib/fotorank/jury/visor-service";

type Fondo = "gris" | "oscuro" | "claro";

const FONDOS: Array<{ id: Fondo; nombre: string; muestra: string }> = [
  { id: "oscuro", nombre: "Oscuro", muestra: "#111111" },
  { id: "gris", nombre: "Gris", muestra: "#767676" },
  { id: "claro", nombre: "Claro", muestra: "#eceae6" },
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
  const [comentando, setComentando] = useState(false);
  /* Cómo estaba cada obra antes de cada cambio, para poder volver con ⌘Z. */
  const [pasosAtras, setPasosAtras] = useState<PasoAtras[]>([]);
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

  /**
   * Todo cambio de notas pasa por acá: pantalla, guardado y paso atrás.
   *
   * Tener un solo camino es lo que hace que deshacer funcione para las cuatro
   * formas de calificar --la tecla, el clic, el borrado de una y el de las
   * cuatro-- sin repetir la misma cuenta en cuatro lugares.
   */
  const cambiarNotas = useCallback(
    (obra: ObraEnElVisor, nuevas: NotasDeLaObra, { apilable = true } = {}) => {
      if (sonIguales(obra.notas, nuevas)) return;
      if (apilable) {
        setPasosAtras((pila) =>
          apilar(pila, { entryId: obra.entryId, notas: obra.notas }),
        );
      }
      setObras((previas) =>
        previas.map((o) =>
          o.entryId === obra.entryId ? { ...o, notas: nuevas } : o,
        ),
      );
      if (!obra.snapshotId) return;
      void guardarNotaAction({
        contestId,
        snapshotId: obra.snapshotId,
        notas: Object.entries(nuevas).map(([key, score]) => ({ key, score })),
      }).then((r) => {
        // El aviso también se limpia al salir bien: antes el primer error se
        // quedaba pegado en pantalla el resto de la sesión.
        setAviso(
          r.ok ? null : (r.mensaje ?? "No pudimos guardar. Probá de nuevo."),
        );
      });
    },
    [contestId],
  );

  const sePuedeTocar = Boolean(
    actual && cola.sePuedeCalificar && !actual.enviada,
  );
  /** Hay criterios que mostrar y esta obra admite que se los toque. */
  const sePuedeCalificarEstaObra = criterios.length > 0 && !actual?.enviada;

  /**
   * Pone una nota en el criterio que se le indica.
   *
   * El índice llega desde afuera a propósito. Antes se leía `criterioActivo`
   * acá adentro, y al hacer clic en un número de otro criterio el `set` del
   * activo todavía no se había aplicado: la nota terminaba en el criterio
   * anterior. Tocar el 7 del primero cambiaba la nota del segundo.
   */
  const ponerNota = useCallback(
    (valor: number, indice: number) => {
      if (!actual || !sePuedeTocar) return;
      const criterio = criterios[indice];
      if (!criterio) return;
      if (valor < criterio.min || valor > criterio.max) return;

      setCriterioActivo(indice);
      const nuevas = ponerNotaEn(actual.notas, criterio.key, valor);
      cambiarNotas(actual, nuevas);

      // Al poner una nota el foco avanza solo: una foto son cuatro teclas.
      // Al sacarla no, porque quien la saca se quedó mirando ese criterio.
      const seSaco = !(criterio.key in nuevas);
      if (!seSaco && indice < criterios.length - 1)
        setCriterioActivo(indice + 1);
    },
    [actual, criterios, sePuedeTocar, cambiarNotas],
  );

  /**
   * Guarda la nota al margen de la obra.
   *
   * Va por el mismo camino que las notas --el motor recibe la tanda entera--
   * y no entra en la pila de deshacer: ⌘Z dentro del texto es el del
   * navegador, que es lo que espera cualquiera escribiendo.
   */
  const cambiarComentario = useCallback(
    (obra: ObraEnElVisor, texto: string) => {
      if (obra.comentario === texto) return;
      setObras((previas) =>
        previas.map((o) =>
          o.entryId === obra.entryId ? { ...o, comentario: texto } : o,
        ),
      );
      if (!obra.snapshotId) return;
      void guardarNotaAction({
        contestId,
        snapshotId: obra.snapshotId,
        notas: Object.entries(obra.notas).map(([key, score]) => ({
          key,
          score,
        })),
        comentario: texto,
      }).then((r) => {
        setAviso(
          r.ok ? null : (r.mensaje ?? "No pudimos guardar el comentario."),
        );
      });
    },
    [contestId],
  );

  /** Deja un criterio sin nota, sin mover el foco. */
  const borrarNota = useCallback(
    (indice: number) => {
      if (!actual || !sePuedeTocar) return;
      const criterio = criterios[indice];
      if (!criterio) return;
      cambiarNotas(actual, sacarNota(actual.notas, criterio.key));
    },
    [actual, criterios, sePuedeTocar, cambiarNotas],
  );

  /** Deja la obra entera en blanco: las cuatro notas de una. */
  const borrarLaObra = useCallback(() => {
    if (!actual || !sePuedeTocar) return;
    cambiarNotas(actual, borrarTodo());
    setCriterioActivo(0);
  }, [actual, sePuedeTocar, cambiarNotas]);

  /**
   * Vuelve atrás el último cambio, sea de la obra que sea.
   *
   * Si el paso era de otra obra, el visor salta a ella: deshacer algo que no
   * se ve sería peor que no deshacer.
   */
  const deshacer = useCallback(() => {
    const r = desapilar(pasosAtras);
    if (!r) {
      setAviso("No queda nada que deshacer.");
      return;
    }
    setPasosAtras(r.resto);
    const obra = obras.find((o) => o.entryId === r.paso.entryId);
    if (!obra || obra.enviada) return;
    if (obra.entryId !== actual?.entryId) setEntryIdActual(obra.entryId);
    cambiarNotas(obra, r.paso.notas, { apilable: false });
  }, [pasosAtras, obras, actual, cambiarNotas]);

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
      const destino = e.target as HTMLElement | null;
      const escribiendo =
        destino &&
        (destino.tagName === "TEXTAREA" ||
          destino.tagName === "INPUT" ||
          destino.isContentEditable);

      // ⌘Z / Ctrl+Z, lo único que se atiende con modificador. Dentro del
      // comentario no: ahí deshacer es el del texto, que hace el navegador.
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        if (escribiendo) return;
        e.preventDefault();
        deshacer();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (escribiendo) return;

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
      /*
       * Escape borra la nota del criterio donde está parado.
       *
       * Es lo que pidió quien califica: equivocarse de número pasa todo el
       * tiempo y hasta ahora no había forma de dejar un criterio en blanco.
       * Para salir de pantalla completa queda F, que es con lo que se entró.
       */
      if (e.key === "Escape") {
        e.preventDefault();
        borrarNota(criterioActivo);
        return;
      }
      // Suprimir vacía la obra entera: las cuatro notas de una.
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        borrarLaObra();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        ponerNota(e.key === "0" ? 10 : Number(e.key), criterioActivo);
      }
    }

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [
    ayuda,
    criterioActivo,
    borrarNota,
    borrarLaObra,
    deshacer,
    moverCriterio,
    moverFoto,
    ponerNota,
  ]);

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
            /*
             * Al pasar el mouse se abre la consigna entera, tal como la leyó
             * quien fotografió. Sin eso, calificar "adecuación a la consigna"
             * mirando sólo el título es adivinar: "Sombras" no dice que la
             * sombra tenga que ser la protagonista, que es lo que se pidió.
             */
            <div key={c.numero} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setConsigna(c.numero);
                  const lista = rearmarLista(c.numero, filtro);
                  if (lista[0]) setEntryIdActual(lista[0].entryId);
                  setCriterioActivo(0);
                }}
                className="flex min-h-8 w-full items-center gap-1.5 whitespace-nowrap px-3 text-xs"
                style={{
                  background: elegida ? colores.fondo : colores.panel,
                  color: elegida ? colores.tinta : colores.suave,
                  fontWeight: elegida ? 600 : 500,
                  boxShadow: elegida ? "inset 0 -2px 0 #e0a061" : undefined,
                }}
              >
                {c.numero} · {c.titulo}
                <span className="font-mono text-[10px] tabular-nums opacity-70">
                  {listas === suyas.length
                    ? `✓${suyas.length}`
                    : `${listas}/${suyas.length}`}
                </span>
              </button>

              {c.texto ? (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-30 hidden w-80 max-w-[85vw] p-3 group-hover:block"
                  style={{
                    background: colores.panel,
                    border: `1px solid ${colores.linea}`,
                    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
                  }}
                >
                  <p
                    className="text-xs font-semibold"
                    style={{ color: colores.tinta }}
                  >
                    Consigna {c.numero} · {c.titulo}
                  </p>
                  <p
                    className="mt-1.5 whitespace-pre-line text-xs leading-relaxed"
                    style={{ color: colores.suave }}
                  >
                    {c.texto}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Barra: una sola fila, todo del mismo alto y lo mínimo a la vista */}
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-1.5"
        hidden={inmersivo}
        style={{
          background: colores.panel,
          borderBottom: `1px solid ${colores.linea}`,
        }}
      >
        <p className="mr-auto font-mono text-[11px] tabular-nums">
          {actual ? (
            <>
              {visibles.indexOf(actual) + 1}/{visibles.length}
              <span style={{ color: colores.suave }}> · </span>
              <b>{actual.codigo}</b>
            </>
          ) : (
            <span style={{ color: colores.suave }}>Sin fotos para mostrar</span>
          )}
        </p>

        <MenuFlotante
          titulo="Qué fotos mostrar"
          icono={<IconoDeFiltro />}
          etiqueta={
            FILTROS_DEL_VISOR.find((f) => f.id === filtro)?.nombre ?? "Todas"
          }
          opciones={FILTROS_DEL_VISOR.map((f) => ({
            id: f.id,
            nombre: f.nombre,
            detalle: f.detalle,
          }))}
          elegida={filtro}
          colores={colores}
          onElegir={(id) => {
            const elegido = id as FiltroDelVisor;
            setFiltro(elegido);
            const lista = rearmarLista(consigna, elegido);
            if (
              lista.length > 0 &&
              !lista.some((o) => o.entryId === entryIdActual)
            ) {
              setEntryIdActual(lista[0]!.entryId);
              setCriterioActivo(0);
            }
          }}
        />

        <MenuFlotante
          titulo="Fondo de la pantalla"
          etiqueta={
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5"
              style={{
                background: FONDOS.find((f) => f.id === fondo)?.muestra,
                border: `1px solid ${colores.linea}`,
              }}
            />
          }
          opciones={FONDOS.map((f) => ({
            id: f.id,
            nombre: f.nombre,
            muestra: f.muestra,
          }))}
          elegida={fondo}
          colores={colores}
          onElegir={(id) => elegirFondo(id as Fondo)}
        />

        <button
          type="button"
          onClick={() => setComentando((v) => !v)}
          disabled={!sePuedeTocar}
          aria-pressed={comentando}
          className="min-h-8 px-2 text-xs font-medium disabled:opacity-40"
          style={{
            border: `1px solid ${actual?.comentario ? "#e0a061" : colores.linea}`,
            color: actual?.comentario ? "#e0a061" : colores.tinta,
          }}
          title="Dejar una nota sobre esta obra (opcional)"
        >
          Comentario{actual?.comentario ? " ·" : ""}
        </button>

        <button
          type="button"
          onClick={() => setAyuda(true)}
          aria-label="Cómo se usa el visor"
          title="Cómo se usa (tecla H)"
          className="grid h-8 w-8 place-items-center text-sm font-semibold"
          style={{ border: `1px solid ${colores.linea}`, color: colores.suave }}
        >
          ?
        </button>

        <button
          type="button"
          onClick={() => void enviarTodo()}
          disabled={enviando || !cola.sePuedeCalificar}
          className="min-h-8 px-3 text-xs font-semibold disabled:opacity-50"
          style={{ background: "#e0a061", color: "#1b1917" }}
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>

        <a
          href="/jurado/panel"
          className="grid min-h-8 place-items-center px-2 text-xs"
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
          <p
            className="grid h-full place-items-center px-4 text-center"
            style={{ color: colores.suave }}
          >
            {actual
              ? "No pudimos mostrar esta fotografía."
              : "No queda ninguna con este filtro."}
          </p>
        )}

        {inmersivo ? (
          <p
            className="pointer-events-none absolute bottom-3 left-4 font-mono text-[11px]"
            style={{
              color: colores.tinta,
              opacity: 0.55,
              mixBlendMode: "difference",
            }}
          >
            {actual?.codigo} · F o Esc para volver
          </p>
        ) : null}

        {!inmersivo && sePuedeCalificarEstaObra ? (
          <div className="absolute inset-x-0 bottom-0 md:hidden">
            <CriteriosEnElTelefono
              criterios={criterios}
              indice={criterioActivo}
              notas={actual?.notas ?? {}}
              colores={colores}
              sePuedeTocar={sePuedeTocar}
              onElegirNota={ponerNota}
              onMover={moverCriterio}
              onIrACriterio={setCriterioActivo}
            />
          </div>
        ) : null}

        {comentando && actual ? (
          <div
            className="absolute bottom-3 right-3 w-[min(22rem,calc(100%-1.5rem))] p-3"
            style={{
              background: colores.panel,
              border: `1px solid ${colores.linea}`,
            }}
          >
            <label
              className="block text-[11px] font-semibold"
              htmlFor="comentario-de-la-obra"
            >
              Nota sobre {actual.codigo}
            </label>
            <p className="mt-1 text-[10.5px]" style={{ color: colores.suave }}>
              Opcional y privada. La lee la organización, nunca quien la
              fotografió.
            </p>
            <textarea
              id="comentario-de-la-obra"
              defaultValue={actual.comentario}
              key={actual.entryId}
              rows={3}
              maxLength={2000}
              autoFocus
              placeholder="Lo que quieras dejar anotado…"
              onBlur={(e) => cambiarComentario(actual, e.target.value.trim())}
              className="mt-2 w-full resize-none p-2 text-xs"
              style={{
                background: colores.fondo,
                color: colores.tinta,
                border: `1px solid ${colores.linea}`,
              }}
            />
            <button
              type="button"
              onClick={() => setComentando(false)}
              className="mt-1 min-h-8 px-2 text-[11px]"
              style={{ color: colores.suave }}
            >
              Listo
            </button>
          </div>
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

      {/* Criterios, en la computadora */}
      <div
        hidden={inmersivo}
        className="hidden md:block"
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
          <div className="hidden gap-2 md:grid md:grid-cols-4 md:gap-3">
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
                        onClick={() => ponerNota(valor, i)}
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
          <span>Esc borra la nota</span>
          <span>Supr borra las {criterios.length}</span>
          <span>⌘Z deshace</span>
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
