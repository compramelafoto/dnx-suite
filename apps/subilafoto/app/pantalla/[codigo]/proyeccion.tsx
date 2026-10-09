"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { indiceDeFoto } from "@/lib/pantalla-reproduccion";
import { queMostrar } from "@/lib/pantalla-ritmo";
import { sacarSiYaSeVio } from "@/lib/pantalla-una-sola-vez";
import { totalesOrdenados } from "@/lib/reacciones";
import { idsAQuitar } from "@/lib/vivo";

/**
 * La proyección del salón.
 *
 * Está pensada para un televisor colgado a tres metros, que nadie va a tocar en
 * toda la noche. De eso salen casi todas las decisiones de acá:
 *
 * - **Precarga.** Cada foto se descarga entera antes de mostrarse. Una foto que
 *   aparece a medias en una pantalla grande se ve peor que una foto que tarda.
 * - **Sin scroll ni controles.** No hay nadie para operarla.
 * - **Se aguanta sola.** Si se corta la conexión, reconecta; si se cae del todo,
 *   sigue rotando lo que ya tiene en memoria.
 * - **El QR se intercala.** Cada diez fotos ocupa la pantalla entera. Chico en una
 *   esquina y encima de una foto no lo escanea nadie, y una sola vez al principio
 *   tampoco sirve: la gente llega durante toda la noche.
 */

/**
 * Lo que pasa por la pantalla: una foto o un mensaje.
 *
 * Son dos cosas distintas y no una foto con texto: el mensaje no tiene archivo, y
 * tratarlo como una foto sin `url` llevaría a un recuadro roto en la pared del salón.
 */
export type ItemEnVivo =
  | { tipo: "FOTO"; id: string; url: string; pie?: string | null; nombre?: string | null }
  | { tipo: "MENSAJE"; id: string; texto: string; nombre?: string | null };

/** Nombre viejo, conservado para no romper lo que todavía lo importe. */
export type FotoEnVivo = Extract<ItemEnVivo, { tipo: "FOTO" }>;

const CADA_FOTO_MS = 7_000;
/** El QR se deja más tiempo: hay que sacar el teléfono, abrir la cámara y apuntar. */
const EL_QR_MS = 12_000;
/** Las URL vienen firmadas por un rato: no se puede guardar una lista infinita. */
const MAXIMO_EN_MEMORIA = 40;
/** Cuánto dura un emoji subiendo por la pantalla. */
const VUELO_MS = 4_000;

type EmojiVolando = {
  clave: string;
  emoji: string;
  /** Dónde arranca, en porcentaje del ancho. */
  izquierda: number;
  demora: number;
  /** Cuánto se corre de costado mientras sube, en vw. Puede ser negativo. */
  deriva: number;
  /** Cuánto se inclina al final, en grados. */
  giro: number;
};

export function Proyeccion({
  codigo,
  iniciales,
  estilo,
  fondo,
  qrSvg,
  urlDelEvento,
  nombreDelEvento,
  anfitriones,
  acento,
}: {
  codigo: string;
  iniciales: ItemEnVivo[];
  /** El nombre de la fiesta. Preside el cartel del QR: es de quién es la noche. */
  nombreDelEvento: string;
  anfitriones: string | null;
  acento: string;
  /** El tema ya resuelto, con su textura. Ver `estiloDeTema`. */
  estilo: CSSProperties;
  /** El color de fondo solo, para tapar la foto cuando aparece el QR. */
  fondo: string;
  /** El código QR ya dibujado en el servidor: la pantalla no tiene que calcularlo. */
  qrSvg: string;
  urlDelEvento: string;
}) {
  const [fotos, setFotos] = useState<ItemEnVivo[]>(iniciales);
  // Crece sin tope y el resto se saca con módulo. Así el reloj no necesita
  // saber cuántas fotos hay, y no hay que rearmarlo cada vez que llega una.
  const [vuelta, setVuelta] = useState(0);
  const [volando, setVolando] = useState<EmojiVolando[]>([]);
  /*
    El mando del DJ. Vive sólo en esta pantalla y no se guarda: si el televisor se
    reinicia a mitad de la fiesta tiene que volver solo a reproducir, no quedarse en
    pausa porque alguien la tocó hace dos horas.
  */
  const [pausado, setPausado] = useState(false);
  const [aleatorio, setAleatorio] = useState(false);
  const [mandoVisible, setMandoVisible] = useState(false);
  /*
    El contador, por foto. `porFoto[mediaId][emoji]`, más un total del evento bajo la
    clave vacía para las reacciones que llegaron sin foto —con la pantalla apagada o
    mostrando el QR—.
  */
  const [porFoto, setPorFoto] = useState<Record<string, Record<string, number>>>({});

  // Escucha las fotos nuevas. EventSource reconecta solo y manda el
  // Last-Event-ID, así que no hay que escribir la reconexión a mano.
  useEffect(() => {
    const fuente = new EventSource(`/api/e/${codigo}/vivo`);

    fuente.addEventListener("foto", (e) => {
      const item = JSON.parse((e as MessageEvent).data) as ItemEnVivo;

      const agregar = () =>
        setFotos((previas) =>
          previas.some((f) => f.id === item.id)
            ? previas
            : [...previas, item].slice(-MAXIMO_EN_MEMORIA),
        );

      // Un mensaje no tiene nada que descargar: entra enseguida.
      if (item.tipo === "MENSAJE") {
        agregar();
        return;
      }

      // Una foto se precarga antes de entrar en la rotación: así nunca aparece a medias.
      const img = new Image();
      img.src = item.url;
      img.onload = agregar;
      // Si la precarga falla, se agrega igual: peor es que no aparezca nunca.
      img.onerror = agregar;
    });

    // El organizador ocultó una foto: sale de la pantalla enseguida.
    fuente.addEventListener("quitar", (e) => {
      const { id } = JSON.parse((e as MessageEvent).data) as { id: string };
      setFotos((previas) => previas.filter((f) => f.id !== id));
    });

    // Cada tanto llega la lista completa de lo vigente y se descarta el resto.
    // Corrige cualquier aviso de baja que se haya perdido en un corte.
    fuente.addEventListener("vigentes", (e) => {
      const { ids } = JSON.parse((e as MessageEvent).data) as { ids: string[] };
      setFotos((previas) => {
        const sobran = new Set(idsAQuitar(ids, previas.map((f) => f.id)));
        return sobran.size === 0 ? previas : previas.filter((f) => !sobran.has(f.id));
      });
    });

    /*
      Un emoji que alguien acaba de mandar: sube por la pantalla y se va.

      La posición y la demora se sortean acá y no en CSS para que dos que llegan juntos
      no suban pegados por la misma línea, que es lo que delata que es una animación y
      no gente reaccionando.
    */
    fuente.addEventListener("reaccion", (e) => {
      const { id, emoji } = JSON.parse((e as MessageEvent).data) as {
        id: string;
        emoji: string;
      };
      const nuevo: EmojiVolando = {
        clave: id,
        emoji,
        izquierda: 5 + Math.random() * 90,
        demora: Math.random() * 600,
        // Se sortean acá y no en CSS: con valores fijos, dos emojis que llegan juntos
        // harían el mismo recorrido y se vería la animación, no la reacción.
        deriva: (Math.random() - 0.5) * 24,
        giro: (Math.random() - 0.5) * 50,
      };
      setVolando((previos) => [...previos, nuevo]);
      // Se saca cuando termina de subir: si no, la lista crece toda la noche.
      setTimeout(
        () => setVolando((previos) => previos.filter((v) => v.clave !== nuevo.clave)),
        VUELO_MS + nuevo.demora + 500,
      );
    });

    // El contador de verdad, completo. Llega cada diez segundos.
    fuente.addEventListener("reacciones", (e) => {
      const datos = JSON.parse((e as MessageEvent).data) as {
        porFoto: Record<string, Record<string, number>>;
      };
      setPorFoto(datos.porFoto);
    });

    return () => fuente.close();
  }, [codigo]);

  /*
    La semilla del sorteo sale del código del evento: es estable toda la noche —así el
    orden no cambia en cada repintado— y distinta en cada fiesta.
  */
  const semilla = useMemo(
    () => [...codigo].reduce((suma, c) => (suma * 31 + c.charCodeAt(0)) >>> 0, 7),
    [codigo],
  );

  const paso = queMostrar({ vuelta, cantidadDeFotos: fotos.length });

  /*
    La rotación es independiente de la llegada de fotos: si deja de llegar gente nueva,
    la pantalla sigue mostrando lo que hay en lugar de congelarse.

    El reloj se rearma en cada paso porque el QR dura más que una foto: `vuelta` está en
    las dependencias a propósito, cada vuelta programa la siguiente.
  */
  /*
    `queMostrar` dice CUÁNTAS fotos pasaron —y cuándo toca el QR—; el modo de
    reproducción dice CUÁL de todas se ve. Separados porque son dos preguntas distintas:
    el ritmo no cambia cuando el DJ pone aleatorio.
  */
  const indiceVisible =
    paso.tipo === "FOTO"
      ? indiceDeFoto({
          fotosMostradas: paso.indice,
          cantidad: fotos.length,
          aleatorio,
          semilla,
        })
      : -1;
  const actual = indiceVisible >= 0 ? fotos[indiceVisible] : undefined;

  useEffect(() => {
    // En pausa el reloj no se programa: la foto que está se queda hasta que la suelten.
    if (pausado) return;
    const cuanto = paso.tipo === "QR" ? EL_QR_MS : CADA_FOTO_MS;
    const reloj = setTimeout(() => {
      /*
        Al pasar de turno, el mensaje que se mostró sale de la rotación: se ve una vez.
        Se saca acá y no al mostrarlo, porque sacarlo mientras está en pantalla correría
        los índices y haría saltar la foto que se está viendo.
      */
      setFotos((previas) => sacarSiYaSeVio(previas, actual));
      setVuelta((v) => v + 1);
    }, cuanto);
    return () => clearTimeout(reloj);
  }, [vuelta, paso.tipo, pausado, actual]);

  /*
    El mando se esconde solo a los cinco segundos. El DJ lo abre, toca y se va; dejarlo
    abierto sería una barra gris sobre la pantalla del salón toda la noche.
  */
  useEffect(() => {
    if (!mandoVisible) return;
    const reloj = setTimeout(() => setMandoVisible(false), 5_000);
    return () => clearTimeout(reloj);
  }, [mandoVisible, pausado, aleatorio]);

  /*
    Lo que se muestra es el contador DE LA FOTO QUE SE ESTÁ VIENDO. Un número del evento
    entero sube toda la noche y no dice nada de la foto que está en pantalla.
  */
  /*
    Avisarle al servidor qué se está proyectando. Es la única forma de que una reacción
    se pueda atribuir a una foto: la rotación la decide esta pantalla, no el servidor.

    Se manda `null` durante el QR y durante un mensaje: ahí no hay foto a la que
    reaccionar.
  */
  const idProyectado = actual?.tipo === "FOTO" ? actual.id : null;
  useEffect(() => {
    void fetch(`/api/e/${codigo}/proyectando`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaId: idProyectado }),
      // Si falla no pasa nada grave: la reacción se guarda sin foto.
    }).catch(() => {});
  }, [codigo, idProyectado]);

  const totales = totalesOrdenados(
    actual?.tipo === "FOTO" ? (porFoto[actual.id] ?? {}) : {},
  );

  return (
    <div className="relative h-[100svh] w-full overflow-hidden" style={estilo}>
      {/*
        Se pintan todas y se muestra una: cambiar el `src` de una sola etiqueta
        haría parpadear en blanco cada siete segundos en una pantalla grande.
      */}
      {fotos.map((item, i) =>
        item.tipo === "FOTO" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.url}
            alt=""
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-700"
            style={{ opacity: i === indiceVisible ? 1 : 0 }}
          />
        ) : (
          <GloboDeChat
            key={item.id}
            texto={item.texto}
            nombre={item.nombre}
            visible={i === indiceVisible}
          />
        ),
      )}

      {/* El turno del código: la pantalla entera, no una esquina. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-8 transition-opacity duration-700"
        style={{
          background: fondo,
          opacity: paso.tipo === "QR" ? 1 : 0,
          pointerEvents: paso.tipo === "QR" ? "auto" : "none",
        }}
      >
        {/*
          Arriba el nombre de la fiesta, abajo la instrucción.

          Antes presidía "Sacá fotos y subilas acá": el cartel más grande del salón
          hablaba de la aplicación en vez de hablar de la fiesta. Quien levanta la vista
          tiene que leer primero de quién es la noche; cómo sumarse viene después, que es
          además el orden en que uno mira un QR —primero qué es, después qué hacer—.
        */}
        <div className="px-10 text-center">
          <p className="text-balance text-[clamp(1.8rem,5.5vw,4.5rem)] font-extrabold leading-[1.05]">
            {nombreDelEvento}
          </p>
          {anfitriones ? (
            <p
              className="mt-3 text-[clamp(1rem,2.4vw,2rem)]"
              style={{ opacity: 0.8 }}
            >
              {anfitriones}
            </p>
          ) : null}
        </div>

        {/* El marco toma el acento de la plantilla: el QR tiene que ser blanco por
            contraste, pero el borde lo ata a la estética del evento. */}
        <div
          className="w-[min(24rem,42vh)] rounded-3xl bg-white p-6"
          style={{ boxShadow: `0 0 0 0.6rem ${acento}` }}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <div className="px-10 text-center">
          <p className="text-[clamp(1.1rem,2.6vw,2.1rem)] font-extrabold">
            {fotos.length === 0 ? "Sacá fotos y subilas acá" : "Sumá tus fotos"}
          </p>
          <p className="mt-2 text-[clamp(0.9rem,1.7vw,1.4rem)]" style={{ opacity: 0.7 }}>
            {urlDelEvento}
          </p>
        </div>
      </div>

      {actual?.tipo === "FOTO" && (actual.pie || actual.nombre) ? (
        <div
          className="absolute inset-x-0 bottom-0 px-12 py-10 text-center transition-opacity duration-700"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)",
            opacity: paso.tipo === "FOTO" ? 1 : 0,
          }}
        >
          <p className="text-[clamp(1rem,2.2vw,1.75rem)] font-extrabold text-white">
            {actual.pie}
            {actual.pie && actual.nombre ? " — " : ""}
            {actual.nombre}
          </p>
        </div>
      ) : null}

      {/* Los emojis que manda el salón, subiendo. Nunca tapan nada: pasan y se van. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {volando.map((v) => (
          <span
            key={v.clave}
            className="slf-emoji-vuela absolute bottom-0 text-[clamp(2.5rem,6vw,5rem)]"
            style={
              {
                left: `${v.izquierda}%`,
                animationDelay: `${v.demora}ms`,
                "--slf-deriva": `${v.deriva}vw`,
                "--slf-giro": `${v.giro}deg`,
              } as CSSProperties
            }
          >
            {v.emoji}
          </span>
        ))}
      </div>

      {/* El contador. Sólo los que alguien mandó: una fila de ceros no dice nada. */}
      {totales.length > 0 ? (
        <div className="absolute left-0 top-0 flex gap-3 p-6">
          {totales.map((t) => (
            <div
              key={t.emoji}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-[clamp(1rem,1.8vw,1.5rem)] font-extrabold"
              style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
            >
              <span>{t.emoji}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{t.total}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/*
        El mando del DJ.

        Visible pero discreto: una pestaña en el borde izquierdo con el texto "Controles".
        Antes era una franja invisible y nadie la encontraba —ni sabiéndolo—, que es lo
        mismo que no tener controles. Un botón tenue que se puede ignorar molesta menos a
        la proyección que uno que nadie usa.

        El panel se esconde solo a los cinco segundos de la última acción.
      */}
      <button
        type="button"
        onClick={() => setMandoVisible((v) => !v)}
        aria-expanded={mandoVisible}
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-xl px-2 py-6 text-xs font-extrabold tracking-widest text-white transition-opacity"
        style={{
          background: "rgba(0,0,0,0.45)",
          opacity: mandoVisible ? 0 : 0.5,
          pointerEvents: mandoVisible ? "none" : "auto",
          writingMode: "vertical-rl",
        }}
      >
        CONTROLES
      </button>

      <div
        className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col gap-3 rounded-r-3xl p-4 transition-transform duration-300"
        style={{
          background: "rgba(0,0,0,0.72)",
          transform: mandoVisible ? "translate(0, -50%)" : "translate(-110%, -50%)",
        }}
        aria-hidden={!mandoVisible}
      >
        <BotonDeMando
          activo={!pausado}
          onClick={() => setPausado((v) => !v)}
          etiqueta={pausado ? "Reanudar" : "Pausar"}
        >
          {pausado ? "\u25B6" : "\u2759\u2759"}
        </BotonDeMando>

        <BotonDeMando
          activo={aleatorio}
          onClick={() => setAleatorio((v) => !v)}
          etiqueta={aleatorio ? "Pasar en orden" : "Pasar al azar"}
        >
          {"\u2928"}
        </BotonDeMando>

        <BotonDeMando
          activo={false}
          onClick={() => setVuelta((v) => v + 1)}
          etiqueta="Pasar a la siguiente"
        >
          {"\u23ED"}
        </BotonDeMando>

        <button
          type="button"
          onClick={() => setMandoVisible(false)}
          className="mt-1 text-xs font-extrabold text-white underline underline-offset-4 opacity-70"
        >
          Ocultar
        </button>
      </div>

      <style>{`
        /*
          El recorrido. No es una línea recta: se corre de costado y se inclina mientras
          sube, cambiando de lado a mitad de camino. Un emoji que sube derecho se lee como
          una animación; uno que se bambolea se lee como alguien reaccionando.
        */
        @keyframes slf-sube {
          0%   { transform: translate(0, 0) scale(0.7) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          35%  { transform: translate(calc(var(--slf-deriva) * 0.45), -28vh) scale(1.05)
                   rotate(calc(var(--slf-giro) * 0.5)); }
          65%  { transform: translate(calc(var(--slf-deriva) * -0.25), -55vh) scale(1.1)
                   rotate(calc(var(--slf-giro) * -0.35)); }
          85%  { opacity: 1; }
          100% { transform: translate(var(--slf-deriva), -88vh) scale(1.2)
                   rotate(var(--slf-giro)); opacity: 0; }
        }
        .slf-emoji-vuela {
          animation: slf-sube ${VUELO_MS}ms ease-out forwards;
        }
        /* Si alguien configuró su equipo para no ver animaciones, se respeta. */
        @media (prefers-reduced-motion: reduce) {
          .slf-emoji-vuela { animation-duration: 1ms; }
        }
      `}</style>
    </div>
  );
}

/**
 * Un botón del mando.
 *
 * Grande y con el nombre escrito: lo toca alguien parado, de noche, con música fuerte y
 * sin haber visto nunca esta pantalla. Un ícono solo no alcanza.
 */
function BotonDeMando({
  activo,
  onClick,
  etiqueta,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="flex min-h-[64px] min-w-[150px] items-center gap-3 rounded-2xl px-4 text-left text-white"
      style={{ background: activo ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)" }}
    >
      <span className="text-2xl leading-none">{children}</span>
      <span className="text-sm font-extrabold">{etiqueta}</span>
    </button>
  );
}

/**
 * Un mensaje proyectado, como un globo de chat.
 *
 * El globo no es decoración: sin él, un texto solo sobre el fondo del evento se lee como
 * un cartel del sistema —un aviso, un error— y no como algo que escribió alguien del
 * salón. La forma es lo que dice "esto lo mandó una persona".
 *
 * La cola abajo a la izquierda y el nombre afuera del globo, como en cualquier chat: es
 * la convención que todo el mundo ya sabe leer.
 */
function GloboDeChat({
  texto,
  nombre,
  visible,
}: {
  texto: string;
  nombre?: string | null;
  visible: boolean;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-[8vw] transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      <div
        className="relative max-w-[min(50rem,80vw)] rounded-[2.5rem] px-12 py-10"
        style={{ background: "rgba(255,255,255,0.95)", color: "#1A1A1A" }}
      >
        <p className="text-balance text-center text-[clamp(1.6rem,4.5vw,3.4rem)] font-extrabold leading-[1.2]">
          {texto}
        </p>

        {/* La cola del globo, dibujada con un triángulo. */}
        <span
          className="absolute -bottom-5 left-16 h-0 w-0"
          style={{
            borderLeft: "1.5rem solid transparent",
            borderRight: "0.5rem solid transparent",
            borderTop: "1.5rem solid rgba(255,255,255,0.95)",
          }}
        />
      </div>

      {nombre ? (
        <p className="mt-10 text-[clamp(1rem,2vw,1.6rem)] font-extrabold" style={{ opacity: 0.85 }}>
          {nombre}
        </p>
      ) : null}
    </div>
  );
}
