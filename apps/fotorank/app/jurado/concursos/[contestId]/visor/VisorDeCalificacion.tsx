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
import { IconoDeComentario, IconoDeFiltro, MenuFlotante } from "./MenuFlotante";
import {
  enviarCalificacionesAction,
  guardarNotaAction,
  latidoDelVisorAction,
  renovarFotosAction,
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
  aplicarPendientes,
  claveDeLaCola,
  confirmar,
  cuantasEsperan,
  encolar,
  estaPendiente,
  fallo,
  leerCola,
  siguiente,
  type Pendiente,
} from "../../../../lib/fotorank/jury/colaDePendientes";
import {
  esGestoHorizontal,
  haciaDondePasar,
} from "../../../../lib/fotorank/jury/gestoLateral";
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

/**
 * Un teléfono acostado: ancho de sobra y alto escaso.
 *
 * No alcanza con mirar la orientación: una tablet o un portátil también están
 * "apaisados" y ahí manda el diseño de escritorio. Lo que define este modo es
 * que el alto sea chico, que es cuando una barra de más se nota.
 */
const TELEFONO_ACOSTADO = "(orientation: landscape) and (max-height: 520px)";

/**
 * Quién ve la tarjeta de criterios en vez de la grilla de escritorio.
 *
 * No alcanza con el ancho. Un iPhone acostado mide 844 píxeles, y el corte de
 * "escritorio" está en 768: con `md:hidden` a secas, rotar el teléfono traía
 * la grilla de cuatro columnas y dejaba la fotografía del tamaño de una
 * estampilla. Justo lo contrario de para qué se rota.
 *
 * Así que son dos condiciones: pantalla angosta **o** pantalla baja.
 */
const USA_LA_TARJETA = `(max-width: 767px), ${TELEFONO_ACOSTADO}`;

/**
 * Cuánto se lleva la franja de criterios con el teléfono acostado.
 *
 * Angosta a propósito. Con el teléfono acostado una obra apaisada está
 * limitada por el **alto**, así que sacarle 72 de ancho no le quita ni un
 * píxel: 562 x 375 con la franja y 562 x 375 sin ella. Sólo una panorámica
 * muy extrema lo nota, y por eso son 72 y no 200.
 *
 * Flotando encima tapaba la obra, que es justo lo que se quería evitar.
 */
const ANCHO_DE_LA_FRANJA = 72;

/**
 * Cuánto se queda la nota a la vista antes de pasar al criterio siguiente.
 *
 * En pantalla completa el criterio se ve de a uno: si al apretar el número la
 * tarjeta cambiara en el acto, nunca se vería qué se puso y habría que confiar.
 * Cuatro décimas alcanzan para leer el número y no llegan a aburrir.
 */
const DEMORA_PARA_VER_LA_NOTA = 400;

/**
 * Cuántas obras se van bajando por delante y por detrás de la que se mira.
 *
 * Pasar de foto tardaba casi un segundo porque recién ahí empezaba a bajarse.
 * Con estas ya en el navegador, el cambio es instantáneo. Adelante más que
 * atrás porque se avanza mucho más de lo que se vuelve, y una ventana chica
 * porque bajar las 170 de una sería varios cientos de megas.
 */
const PRECARGA_ADELANTE = 6;
const PRECARGA_ATRAS = 2;

/**
 * Cada cuánto se vuelven a firmar los enlaces de las fotografías.
 *
 * Vencen a los quince minutos y se firmaban una sola vez, al abrir. Calificar
 * 170 obras lleva horas: pasado ese rato no cargaba ninguna. Se renuevan a los
 * diez, con margen de sobra.
 */
const RENOVAR_FOTOS_CADA = 10 * 60 * 1000;

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
  /*
   * Lo calificado que todavía no llegó a la base.
   *
   * Antes una calificación existía sólo en la memoria del navegador hasta que
   * el servidor la confirmaba: si el envío fallaba aparecía un aviso y nada
   * más, y cerrar la pestaña la perdía. Ahora se escribe primero en el
   * aparato, después se manda, y recién al confirmarse se saca de acá.
   */
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const mandando = useRef(false);
  /*
   * La cola, leída en el momento.
   *
   * `encolar` necesita la cola de ahora mismo, y el estado de React puede ser
   * el de hace un instante: calificar rápido dos criterios seguidos dejaría el
   * segundo pisando al primero con una cola vieja.
   */
  const pendientesRef = useRef<Pendiente[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ritmo, setRitmo] = useState<{
    segundosActivos: number;
    calificadas: number;
  } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const huboInteraccion = useRef(false);
  /* El arrastre en curso sobre la fotografía, para pasar de obra con el dedo. */
  const gestoEnLaFoto = useRef<{
    x: number;
    y: number;
    t: number;
    suyo: boolean;
  } | null>(null);
  /*
   * Cuánto alto se lleva la tarjeta de criterios en el teléfono.
   *
   * La tarjeta flota sobre la obra, así que si el hueco de la foto llegara
   * hasta abajo la obra quedaría escondida detrás. Se mide la tarjeta y ese
   * alto se le descuenta al hueco: la fotografía entra entera **arriba** de la
   * tarjeta. Se mide en vez de escribir un número porque el alto depende de la
   * cantidad de criterios y del nombre de cada uno.
   */
  const [altoDeLaTarjeta, setAltoDeLaTarjeta] = useState(0);
  const tarjetaDeCriterios = useRef<HTMLDivElement | null>(null);
  /*
   * Con el teléfono acostado, la obra se queda con toda la pantalla.
   *
   * La primera versión puso los criterios en una columna al costado. Medido,
   * no alcanzaba: sacándole 200 de ancho a la obra el límite pasa a ser otra
   * vez el alto, y una foto 3:2 queda en 477 x 318 --lo mismo que dejando la
   * barra--. Sin nada alrededor entra en 562 x 375, un 39% más de área.
   *
   * Así que acostado funciona como la pantalla completa de la computadora: la
   * obra sola, y los criterios en una tarjeta que flota sobre ella.
   */
  const [acostado, setAcostado] = useState(false);
  /* Acostado los controles se esconden; un toque sobre la obra los trae. */
  const [controlesALaVista, setControlesALaVista] = useState(false);
  /** Pantalla angosta o baja: los criterios van en tarjeta, no en grilla. */
  const [enTarjeta, setEnTarjeta] = useState(false);
  /* La nota que se acaba de poner, mientras se la muestra antes de pasar. */
  const [notaReciennPuesta, setNotaReciennPuesta] = useState<{
    indice: number;
    valor: number;
  } | null>(null);
  const esperaParaPasar = useRef<number | undefined>(undefined);
  /*
   * Pasar de foto, alcanzable desde arriba.
   *
   * `moverFoto` se define más abajo porque necesita la lista ya armada, y
   * `ponerNota` lo precisa para saltar de obra cuando termina el último
   * criterio. La referencia evita tener que reordenar medio componente.
   */
  const moverFotoRef = useRef<(paso: 1 | -1) => void>(() => {});
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

  function elegirConsigna(numero: number) {
    setConsigna(numero);
    const lista = rearmarLista(numero, filtro);
    if (lista[0]) setEntryIdActual(lista[0].entryId);
    setCriterioActivo(0);
  }

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

  /* ---------- la cola de pendientes ---------- */

  const clave = claveDeLaCola(contestId);

  /** Guarda la cola en el aparato. Sin almacenamiento el visor sigue andando. */
  const guardarCola = useCallback(
    (cola: Pendiente[]) => {
      pendientesRef.current = cola;
      setPendientes(cola);
      try {
        if (cola.length === 0) window.localStorage.removeItem(clave);
        else window.localStorage.setItem(clave, JSON.stringify(cola));
      } catch {
        /* Sin lugar para guardar, el envío en el momento sigue funcionando. */
      }
    },
    [clave],
  );

  /*
   * Al entrar, lo que quedó sin mandar vuelve a la pantalla y a la cola.
   *
   * El servidor manda lo último que le llegó, que es justamente lo viejo: lo
   * que quedó en el aparato es más nuevo. Si no se pisara, el jurado vería
   * desaparecer su último trabajo sin explicación.
   */
  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = window.localStorage.getItem(clave);
    } catch {
      return;
    }
    const cola = leerCola(guardado);
    if (cola.length === 0) return;
    pendientesRef.current = cola;
    setPendientes(cola);
    setObras((previas) => aplicarPendientes(previas, cola));
    setAviso(
      `Recuperamos ${cola.length} ${cola.length === 1 ? "obra" : "obras"} que habían quedado sin guardar.`,
    );
  }, [clave]);

  /*
   * El reintento: de a una, sin pisarse, mientras quede algo.
   *
   * Se dispara al volver la conexión, cada tanto, y después de cada envío que
   * sale bien: así una racha de pendientes se vacía sola sin esperar el reloj.
   */
  const mandarLoQueFalta = useCallback(() => {
    if (mandando.current) return;
    setPendientes((cola) => {
      const p = siguiente(cola);
      if (!p) return cola;
      mandando.current = true;
      void guardarNotaAction({
        contestId,
        snapshotId: p.snapshotId,
        notas: Object.entries(p.notas).map(([key, score]) => ({ key, score })),
        comentario: p.comentario,
      })
        .then((r) => {
          setPendientes((actual) => {
            const proxima = r.ok
              ? confirmar(actual, p.snapshotId)
              : fallo(actual, p.snapshotId);
            pendientesRef.current = proxima;
            try {
              if (proxima.length === 0) window.localStorage.removeItem(clave);
              else window.localStorage.setItem(clave, JSON.stringify(proxima));
            } catch {
              /* Ver arriba. */
            }
            return proxima;
          });
          if (r.ok) setAviso(null);
        })
        .catch(() => {
          setPendientes((actual) => {
            const proxima = fallo(actual, p.snapshotId);
            pendientesRef.current = proxima;
            return proxima;
          });
        })
        .finally(() => {
          mandando.current = false;
        });
      return cola;
    });
  }, [contestId, clave]);

  useEffect(() => {
    if (pendientes.length === 0) return;
    // Un reintento enseguida --para encadenar la cola-- y otro cada 15
    // segundos, que es lo que tarda una conexión mala en volver.
    const pronto = window.setTimeout(mandarLoQueFalta, 400);
    const reloj = window.setInterval(mandarLoQueFalta, 15000);
    window.addEventListener("online", mandarLoQueFalta);
    return () => {
      window.clearTimeout(pronto);
      window.clearInterval(reloj);
      window.removeEventListener("online", mandarLoQueFalta);
    };
  }, [pendientes.length, mandarLoQueFalta]);

  /* ---------- acostado o parado ---------- */

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const bajo = window.matchMedia(TELEFONO_ACOSTADO);
    const tarjeta = window.matchMedia(USA_LA_TARJETA);
    const mirar = () => {
      setAcostado(bajo.matches);
      setEnTarjeta(tarjeta.matches);
      // Al enderezar el teléfono la barra vuelve sola: parado siempre está.
      if (!bajo.matches) setControlesALaVista(false);
    };
    mirar();
    bajo.addEventListener("change", mirar);
    tarjeta.addEventListener("change", mirar);
    return () => {
      bajo.removeEventListener("change", mirar);
      tarjeta.removeEventListener("change", mirar);
    };
  }, []);

  /* ---------- cuánto ocupa la tarjeta de criterios ---------- */

  useEffect(() => {
    const caja = tarjetaDeCriterios.current;
    if (!caja) {
      setAltoDeLaTarjeta(0);
      return;
    }
    const medir = () => {
      // En la computadora la tarjeta está oculta y no ocupa nada: ahí el hueco
      // de la foto es toda la franja y no hay que descontarle nada.
      // Al costado no le saca alto a nada: lo que descuenta es ancho, y eso se
      // resuelve en el propio acomodo de la pantalla.
      const noOcupa = caja.offsetParent === null || acostado;
      setAltoDeLaTarjeta(noOcupa ? 0 : caja.offsetHeight);
    };
    medir();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [inmersivo, criterios.length, actual?.enviada, acostado]);

  /* ---------- que la foto ya esté cuando se la pide ---------- */

  /*
   * Las imágenes bajadas se guardan en un mapa.
   *
   * Sin conservar la referencia, el navegador puede soltar la imagen antes de
   * que se la pida y la precarga no habría servido de nada.
   */
  const bajadas = useRef(new Map<string, HTMLImageElement>());

  useEffect(() => {
    if (!actual) return;
    const pos = visibles.findIndex((o) => o.entryId === actual.entryId);
    if (pos === -1) return;

    const desde = Math.max(0, pos - PRECARGA_ATRAS);
    const hasta = Math.min(visibles.length, pos + PRECARGA_ADELANTE + 1);
    const cerca = visibles.slice(desde, hasta);
    const quedan = new Set<string>();

    for (const o of cerca) {
      if (!o.previewUrl) continue;
      quedan.add(o.previewUrl);
      if (bajadas.current.has(o.previewUrl)) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = o.previewUrl;
      bajadas.current.set(o.previewUrl, img);
    }

    // Lo que quedó lejos se suelta: la ventana se mueve, la memoria no crece.
    for (const url of [...bajadas.current.keys()]) {
      if (!quedan.has(url)) bajadas.current.delete(url);
    }
  }, [actual, visibles]);

  const renovandoFotos = useRef(false);

  const renovarFotos = useCallback(() => {
    if (renovandoFotos.current) return;
    renovandoFotos.current = true;
    void renovarFotosAction({ contestId })
      .then((frescas) => {
        if (frescas.length === 0) return;
        const porId = new Map(frescas.map((f) => [f.entryId, f.previewUrl]));
        setObras((previas) =>
          previas.map((o) =>
            porId.has(o.entryId)
              ? { ...o, previewUrl: porId.get(o.entryId) ?? null }
              : o,
          ),
        );
        bajadas.current.clear();
      })
      .finally(() => {
        renovandoFotos.current = false;
      });
  }, [contestId]);

  useEffect(() => {
    const reloj = window.setInterval(renovarFotos, RENOVAR_FOTOS_CADA);
    return () => window.clearInterval(reloj);
  }, [renovarFotos]);

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
      /*
       * Primero al aparato, después a la base.
       *
       * Escribirlo acá antes de mandarlo es lo que hace que no se pierda: si
       * el envío falla, si se corta la señal o si se cierra la pestaña, la
       * calificación sigue estando y se manda sola cuando se puede.
       */
      guardarCola(
        encolar(pendientesRef.current, {
          snapshotId: obra.snapshotId,
          entryId: obra.entryId,
          notas: nuevas,
          comentario: obra.comentario || undefined,
          momento: Date.now(),
          intentos: 0,
        }),
      );
    },
    [guardarCola],
  );

  const sePuedeTocar = Boolean(
    actual && cola.sePuedeCalificar && !actual.enviada,
  );

  /**
   * Pone una nota en el criterio que se le indica.
   *
   * El índice llega desde afuera a propósito. Antes se leía `criterioActivo`
   * acá adentro, y al hacer clic en un número de otro criterio el `set` del
   * activo todavía no se había aplicado: la nota terminaba en el criterio
   * anterior. Tocar el 7 del primero cambiaba la nota del segundo.
   */
  const ponerNota = useCallback(
    (
      valor: number,
      indice: number,
      { avanzar = true, demorar = false } = {},
    ) => {
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
      if (!avanzar || seSaco) return;

      const proximo = indice + 1;
      const pasar = () => {
        if (proximo < criterios.length) setCriterioActivo(proximo);
        else moverFotoRef.current(1);
      };

      // En pantalla completa se espera un momento para que se vea el número
      // recién puesto. Si mientras tanto se aprieta otra tecla, ese paso se
      // cancela: manda lo último que hizo la persona, no el reloj.
      window.clearTimeout(esperaParaPasar.current);
      if (!demorar) {
        if (proximo < criterios.length) setCriterioActivo(proximo);
        return;
      }
      setNotaReciennPuesta({ indice, valor });
      esperaParaPasar.current = window.setTimeout(() => {
        setNotaReciennPuesta(null);
        pasar();
      }, DEMORA_PARA_VER_LA_NOTA);
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
      guardarCola(
        encolar(pendientesRef.current, {
          snapshotId: obra.snapshotId,
          entryId: obra.entryId,
          notas: obra.notas,
          comentario: texto,
          momento: Date.now(),
          intentos: 0,
        }),
      );
    },
    [guardarCola],
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

  useEffect(() => {
    moverFotoRef.current = moverFoto;
  }, [moverFoto]);

  useEffect(() => () => window.clearTimeout(esperaParaPasar.current), []);

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
        // En pantalla completa el criterio se ve de a uno, así que la nota se
        // muestra un momento antes de pasar al siguiente. Con la franja
        // abajo se ven los cuatro juntos y esa espera sólo demoraría.
        ponerNota(e.key === "0" ? 10 : Number(e.key), criterioActivo, {
          demorar: inmersivo,
        });
      }
    }

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [
    ayuda,
    inmersivo,
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
        `Quedan ${resumen.sinTerminar} obras con alguna calificación puesta y alguna faltando. ` +
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
      /*
       * Lo enviado sale de la cola.
       *
       * El envío manda las calificaciones completas y cierra la evaluación.
       * Si quedaran en la cola, el reintento las mandaría de nuevo y el
       * servidor las rechazaría por estar ya cerradas: se quedarían ahí para
       * siempre, y el cartel diría "sin confirmar" sobre trabajo ya entregado.
       */
      const yaEstan = new Set(terminadas.map((o) => o.snapshotId));
      guardarCola(
        pendientesRef.current.filter((x) => !yaEstan.has(x.snapshotId)),
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

  /** Se muestran los criterios del teléfono: hay qué calificar y hay lugar. */
  const muestraCriterios =
    !inmersivo && enTarjeta && criterios.length > 0 && !actual?.enviada;

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

  /*
   * La misma tarjeta se cuelga en dos lugares --abajo si el teléfono está
   * parado, al costado si está acostado-- y sólo una está montada por vez.
   */
  const tarjetaDeLosCriterios = (
    <CriteriosEnElTelefono
      criterios={criterios}
      indice={criterioActivo}
      notas={actual?.notas ?? {}}
      colores={colores}
      acostado={acostado}
      sePuedeTocar={sePuedeTocar}
      /*
       * En el teléfono el número no avanza de criterio.
       *
       * En la computadora avanzar solo es lo que hace que una foto sean cuatro
       * teclas. Con el dedo es al revés: el pulgar ya está sobre la fila de
       * números y que la tarjeta se corra sola mientras uno mira hace perder de
       * vista qué acaba de puntuar. Acá avanza el gesto, que es deliberado.
       */
      onElegirNota={(valor, i) => ponerNota(valor, i, { avanzar: false })}
      onMover={moverCriterio}
      onIrACriterio={setCriterioActivo}
    />
  );

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
      {/*
       * Consignas. Con el teléfono acostado esta fila se esconde --44 píxeles
       * pesan mucho cuando el alto total son 375-- y la consigna pasa a
       * elegirse desde un menú de la barra. Esconder una navegación sin
       * reemplazo sería peor que la foto más chica.
       */}
      <div
        className="flex gap-px overflow-x-auto"
        hidden={inmersivo || acostado}
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
                onClick={() => elegirConsigna(c.numero)}
                className="flex min-h-11 w-full items-center gap-1.5 whitespace-nowrap px-3.5 text-sm sm:min-h-8 sm:px-3 sm:text-xs"
                style={{
                  background: elegida ? colores.fondo : colores.panel,
                  color: elegida ? colores.tinta : colores.suave,
                  fontWeight: elegida ? 600 : 500,
                  boxShadow: elegida ? "inset 0 -2px 0 #e0a061" : undefined,
                }}
              >
                {c.numero} · {c.titulo}
                <span className="font-mono text-[11px] tabular-nums opacity-70 sm:text-[10px]">
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
        hidden={inmersivo || (acostado && !controlesALaVista)}
        style={{
          background: colores.panel,
          borderBottom: `1px solid ${colores.linea}`,
        }}
      >
        <p className="mr-auto hidden font-mono text-[11px] tabular-nums sm:block">
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

        {acostado && cola.consignas.length > 0 ? (
          <MenuFlotante
            titulo="Consigna"
            etiqueta={
              <span className="max-w-[9rem] truncate">
                {consigna !== null
                  ? `${consigna} · ${cola.consignas.find((c) => c.numero === consigna)?.titulo ?? ""}`
                  : "Consigna"}
              </span>
            }
            opciones={cola.consignas.map((c) => {
              const suyas = obras.filter((o) => o.consignaNumero === c.numero);
              const listas = suyas.filter(
                (o) => estadoDeLaObra(o, clavesDeCriterio) === "CALIFICADA",
              ).length;
              return {
                id: String(c.numero),
                nombre: `${c.numero} · ${c.titulo}`,
                detalle: `${listas} de ${suyas.length} calificadas`,
              };
            })}
            elegida={consigna !== null ? String(consigna) : ""}
            colores={colores}
            onElegir={(id) => elegirConsigna(Number(id))}
          />
        ) : null}

        <MenuFlotante
          titulo="Qué fotos mostrar"
          icono={<IconoDeFiltro />}
          etiqueta={
            <span className="hidden sm:inline">
              {FILTROS_DEL_VISOR.find((f) => f.id === filtro)?.nombre ??
                "Todas"}
            </span>
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
              className="h-4 w-4 sm:h-3.5 sm:w-3.5"
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
          className="flex min-h-11 items-center gap-1.5 px-3 text-sm font-medium disabled:opacity-40 sm:min-h-8 sm:px-2 sm:text-xs"
          style={{
            border: `1px solid ${actual?.comentario ? "#e0a061" : colores.linea}`,
            color: actual?.comentario ? "#e0a061" : colores.tinta,
          }}
          title="Dejar un comentario sobre esta obra (opcional)"
        >
          <IconoDeComentario />
          <span className="hidden sm:inline">
            Comentario{actual?.comentario ? " ·" : ""}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAyuda(true)}
          aria-label="Cómo se usa el visor"
          title="Cómo se usa (tecla H)"
          className="grid h-11 w-11 place-items-center text-base font-semibold sm:h-8 sm:w-8 sm:text-sm"
          style={{ border: `1px solid ${colores.linea}`, color: colores.suave }}
        >
          ?
        </button>

        <button
          type="button"
          onClick={() => void enviarTodo()}
          disabled={enviando || !cola.sePuedeCalificar}
          className="min-h-11 px-3.5 text-sm font-semibold disabled:opacity-50 sm:min-h-8 sm:px-3 sm:text-xs"
          style={{ background: "#e0a061", color: "#1b1917" }}
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>

        <a
          href="/jurado/panel"
          className="grid min-h-11 place-items-center px-2.5 text-sm sm:min-h-8 sm:px-2 sm:text-xs"
          style={{ color: colores.suave }}
        >
          Salir
        </a>
      </div>

      {/*
       * La fotografía, y al lado la columna de criterios cuando corresponde.
       *
       * La columna es hermana y no hija: adentro quedaba recortada por el
       * `overflow-hidden` que evita que la obra se desborde.
       */}
      <div className="flex min-h-0 flex-1">
        <div
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
          style={{ touchAction: "pan-y" }}
          /*
           * Deslizar sobre la obra pasa de obra.
           *
           * Sobre los criterios el mismo gesto pasa de criterio, y esa tarjeta
           * no deja subir el toque. Así el dedo hace lo que uno mira: sobre la
           * foto, fotos; sobre los criterios, criterios.
           */
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (!t) return;
            gestoEnLaFoto.current = {
              x: t.clientX,
              y: t.clientY,
              t: Date.now(),
              suyo: false,
            };
          }}
          onTouchMove={(e) => {
            const g = gestoEnLaFoto.current;
            const t = e.touches[0];
            if (!g || !t || g.suyo) return;
            const horizontal = esGestoHorizontal(
              t.clientX - g.x,
              t.clientY - g.y,
            );
            if (horizontal === null) return;
            if (!horizontal) {
              gestoEnLaFoto.current = null;
              return;
            }
            g.suyo = true;
          }}
          onTouchEnd={(e) => {
            const g = gestoEnLaFoto.current;
            gestoEnLaFoto.current = null;
            const t = e.changedTouches[0];
            if (!g?.suyo || !t) return;
            const paso = haciaDondePasar({
              dx: t.clientX - g.x,
              milisegundos: Date.now() - g.t,
            });
            if (paso) moverFoto(paso);
          }}
          onTouchCancel={() => {
            gestoEnLaFoto.current = null;
          }}
        >
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
              className="absolute inset-x-0 top-0 w-full object-contain"
              /*
               * Si una foto no carga, casi siempre es que su enlace venció. En
               * vez de dejar el ícono de imagen rota, se vuelven a firmar todos
               * en el momento.
               */
              onError={renovarFotos}
              /*
               * El alto va explícito, nunca `auto` ni por `bottom`.
               *
               * Una imagen es un elemento reemplazado: con `top` y `bottom`
               * puestos pero el alto en `auto` no se estira, toma su tamaño
               * propio y se sale de la caja. Es el recorte que ya apareció una
               * vez. Con una medida concreta, `object-contain` la acomoda entera.
               */
              style={{ height: `calc(100% - ${altoDeLaTarjeta}px)` }}
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
              {actual?.codigo} · F para volver
            </p>
          ) : null}

          {/*
           * En pantalla completa, el criterio de a uno en la esquina.
           *
           * Antes el modo inmersivo servía sólo para mirar: escondía los
           * criterios y había que salir para puntuar. Así se califica sin
           * perder de vista la obra, que es de lo que se trata.
           */}
          {inmersivo && criterios.length > 0 && !actual?.enviada ? (
            <div
              className="absolute bottom-4 right-4 w-[19rem] max-w-[calc(100%-2rem)] p-3"
              style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#f5f3f0",
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-mono opacity-60">
                  {criterioActivo + 1} de {criterios.length}
                </span>
                <span
                  className="font-mono text-2xl font-semibold tabular-nums transition-all duration-200"
                  style={{
                    color: "#e0a061",
                    // Al poner la nota, el número da un saltito: es lo que
                    // avisa que quedó tomada antes de que la tarjeta cambie.
                    transform:
                      notaReciennPuesta?.indice === criterioActivo
                        ? "scale(1.25)"
                        : "scale(1)",
                  }}
                >
                  {typeof actual?.notas[
                    criterios[criterioActivo]?.key ?? ""
                  ] === "number"
                    ? actual?.notas[criterios[criterioActivo]?.key ?? ""]
                    : "–"}
                </span>
              </div>

              <p className="mt-0.5 text-sm font-semibold leading-tight">
                {criterios[criterioActivo]?.nombre}
              </p>

              <div className="mt-2 flex gap-1">
                {Array.from(
                  {
                    length:
                      (criterios[criterioActivo]?.max ?? 10) -
                      (criterios[criterioActivo]?.min ?? 1) +
                      1,
                  },
                  (_, k) => (criterios[criterioActivo]?.min ?? 1) + k,
                ).map((valor) => {
                  const puesta =
                    actual?.notas[criterios[criterioActivo]?.key ?? ""] ===
                    valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      aria-label={`${valor} en ${criterios[criterioActivo]?.nombre}`}
                      onClick={() =>
                        ponerNota(valor, criterioActivo, { demorar: true })
                      }
                      className="h-8 min-w-0 flex-1 font-mono text-[11px] font-medium transition-colors"
                      style={
                        puesta
                          ? {
                              background: "#e0a061",
                              color: "#1b1917",
                              border: "1px solid #e0a061",
                            }
                          : {
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.14)",
                              color: "#f5f3f0",
                            }
                      }
                    >
                      {valor}
                    </button>
                  );
                })}
              </div>

              {/* Cuántos criterios lleva puestos esta obra. */}
              <div className="mt-2 flex gap-1" aria-hidden="true">
                {criterios.map((c, i) => (
                  <span
                    key={c.key}
                    className="h-0.5 flex-1 transition-all duration-300"
                    style={{
                      background:
                        typeof actual?.notas[c.key] === "number"
                          ? "#e0a061"
                          : i === criterioActivo
                            ? "rgba(255,255,255,0.75)"
                            : "rgba(255,255,255,0.2)",
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* En el teléfono el código de la obra se lee sobre la propia obra. */}
          {!inmersivo && actual ? (
            <p
              className="pointer-events-none absolute left-3 top-2 font-mono text-[11px] tabular-nums sm:hidden"
              style={{
                color: colores.tinta,
                opacity: 0.75,
                mixBlendMode: "difference",
              }}
            >
              {visibles.indexOf(actual) + 1}/{visibles.length} · {actual.codigo}
              {estaPendiente(pendientes, actual.entryId) ? " ·" : ""}
            </p>
          ) : null}

          {muestraCriterios && !acostado ? (
            <div
              ref={tarjetaDeCriterios}
              className="absolute inset-x-0 bottom-0"
            >
              {tarjetaDeLosCriterios}
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
                Comentario sobre {actual.codigo}
              </label>
              <p
                className="mt-1 text-[10.5px]"
                style={{ color: colores.suave }}
              >
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

          {/*
           * Lo que falta confirmar, dicho sin alarmar.
           *
           * No es un error: la calificación está guardada en el teléfono y se
           * manda sola. Lo que no puede pasar es que el jurado se vaya creyendo
           * que llegó todo cuando todavía falta.
           */}
          {cuantasEsperan(pendientes) > 0 ? (
            <p
              className="absolute bottom-3 left-3 px-2.5 py-1 text-[11px]"
              style={{ background: colores.chip, color: colores.tinta }}
              role="status"
            >
              {cuantasEsperan(pendientes) === 1
                ? "1 obra sin confirmar"
                : `${cuantasEsperan(pendientes)} obras sin confirmar`}
              <span style={{ color: colores.suave }}> · se manda sola</span>
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

        {muestraCriterios && acostado ? (
          <div className="shrink-0" style={{ width: ANCHO_DE_LA_FRANJA }}>
            {tarjetaDeLosCriterios}
          </div>
        ) : null}
      </div>

      {/* Criterios, en la computadora */}
      <div
        hidden={inmersivo || enTarjeta}
        className=""
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
          <span>
            {criterios[0] ? `${criterios[0].min} … ${criterios[0].max}` : ""}
          </span>
          <span>F pantalla completa</span>
          <span>Esc borra la calificación</span>
          <span>Supr borra las {criterios.length} calificaciones</span>
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
