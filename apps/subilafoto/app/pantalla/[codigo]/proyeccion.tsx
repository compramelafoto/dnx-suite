"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { indiceDeFoto } from "@/lib/pantalla-reproduccion";
import { CADA_FOTO_MS, queMostrar, ritmoDePantalla } from "@/lib/pantalla-ritmo";
import { AYUDA_DEL_MANDO, accionDeTecla, avisoDeAccion } from "@/lib/mando-teclado";
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
  ultimaFotoISO,
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
  /**
   * Cuándo llegó la foto más nueva, según el servidor. `null` si no hay ninguna.
   *
   * Sin esto, una pantalla que se abre a mitad de la noche creería que recién llegó algo
   * y usaría el ritmo equivocado.
   */
  ultimaFotoISO: string | null;
}) {
  const [fotos, setFotos] = useState<ItemEnVivo[]>(iniciales);
  // Crece sin tope y el resto se saca con módulo. Así el reloj no necesita
  // saber cuántas fotos hay, y no hay que rearmarlo cada vez que llega una.
  const [vuelta, setVuelta] = useState(0);
  /*
    Cuándo llegó la última foto. Es la señal de "el flujo se cortó": con muchas fotos
    pero nadie subiendo hace rato —se sentaron a comer, entró una tanda nueva— el QR
    tiene que volver a pelear aunque el número sea alto.

    Arranca con lo que diga el servidor sobre la más nueva que ya estaba, así una pantalla
    que se abre a mitad de la noche no cree que recién llegó algo.
  */
  /*
    `null` hasta que llegue la primera foto con la pantalla abierta. No se puede arrancar
    con `Date.now()`: el valor inicial de un `useRef` se calcula durante el dibujado, y
    ahí React exige que no se mire el reloj. Mientras sea `null` vale lo que dijo el
    servidor.
  */
  const ultimaLlegada = useRef<number | null>(null);

  /*
    El ritmo depende del momento de la fiesta, no es fijo: el QR es el protagonista
    mientras nadie subió nada y pasa a ser un recordatorio cuando las fotos ya llegan
    solas. Ver `lib/pantalla-ritmo.ts`.

    Va en estado y se recalcula **dentro del temporizador**, una vez por paso. Durante el
    dibujado no se puede mirar el reloj —React exige que sea puro— y hace cuánto llegó la
    última foto es justamente una pregunta sobre el reloj.
  */
  const [ritmo, setRitmo] = useState(() =>
    /*
      Al montar se decide sólo por la cantidad: averiguar hace cuánto llegó la última
      exige mirar el reloj, y acá todavía estamos dibujando. El primer paso corrige, y
      dura entre siete y veintidós segundos.
    */
    ritmoDePantalla({ cantidadDeFotos: iniciales.length, msDesdeLaUltimaFoto: 0 }),
  );
  const [volando, setVolando] = useState<EmojiVolando[]>([]);
  /*
    El mando del DJ. Vive sólo en esta pantalla y no se guarda: si el televisor se
    reinicia a mitad de la fiesta tiene que volver solo a reproducir, no quedarse en
    pausa porque alguien la tocó hace dos horas.
  */
  const [pausado, setPausado] = useState(false);
  const [aleatorio, setAleatorio] = useState(false);
  /*
    El cartelito que confirma la tecla. Se borra solo.

    Arranca con la ayuda: un mando invisible que nadie sabe que existe es un mando que no
    existe, y el DJ llega a la pantalla sin haber leído el instructivo del panel. Va como
    valor inicial y no en un efecto, que daría un render de más con el cartel vacío.
  */
  const [aviso, setAviso] = useState<string | null>(AYUDA_DEL_MANDO);
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
        setFotos((previas) => {
          if (previas.some((f) => f.id === item.id)) return previas;
          // Para el ritmo: una llegada nueva saca a la pantalla del modo "sequía".
          ultimaLlegada.current = Date.now();
          return [...previas, item].slice(-MAXIMO_EN_MEMORIA);
        });

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

  const paso = queMostrar({
    vuelta,
    cantidadDeFotos: fotos.length,
    cadaCuantasFotos: ritmo.cadaCuantasFotos,
  });

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
    const cuanto = paso.tipo === "QR" ? ritmo.msDelQr : CADA_FOTO_MS;
    const reloj = setTimeout(() => {
      /*
        Al pasar de turno, el mensaje que se mostró sale de la rotación: se ve una vez.
        Se saca acá y no al mostrarlo, porque sacarlo mientras está en pantalla correría
        los índices y haría saltar la foto que se está viendo.
      */
      setFotos((previas) => {
        const quedan = sacarSiYaSeVio(previas, actual);
        setRitmo(
          ritmoDePantalla({
            cantidadDeFotos: quedan.length,
            msDesdeLaUltimaFoto:
              Date.now() -
              (ultimaLlegada.current ??
                (ultimaFotoISO ? new Date(ultimaFotoISO).getTime() : 0)),
          }),
        );
        return quedan;
      });
      setVuelta((v) => v + 1);
    }, cuanto);
    return () => clearTimeout(reloj);
  }, [vuelta, paso.tipo, pausado, actual, ritmo.msDelQr, ultimaFotoISO]);

  /*
    El mando se esconde solo a los cinco segundos. El DJ lo abre, toca y se va; dejarlo
    abierto sería una barra gris sobre la pantalla del salón toda la noche.
  */
  useEffect(() => {
    if (!aviso) return;
    const reloj = setTimeout(() => setAviso(null), 4_000);
    return () => clearTimeout(reloj);
  }, [aviso]);

  /*
    Las teclas del mando.

    Va en `window` y no en un elemento con foco: el DJ no va a hacer clic en la pantalla
    antes de apretar la barra, y una pantalla de proyección no tiene a dónde poner el foco.

    `preventDefault` sólo para las teclas que son nuestras: la barra espaciadora, sin eso,
    hace bajar la página.
  */
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      const accion = accionDeTecla({
        tecla: e.key,
        conModificador: e.ctrlKey || e.metaKey || e.altKey,
        escribiendo:
          destino?.isContentEditable === true ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(destino?.tagName ?? ""),
      });

      if (e.key === "?" || e.key === "h" || e.key === "H") {
        setAviso(AYUDA_DEL_MANDO);
        return;
      }
      if (!accion) return;

      e.preventDefault();

      if (accion === "SIGUIENTE") {
        setVuelta((v) => v + 1);
        setAviso(avisoDeAccion("SIGUIENTE", { pausado, aleatorio }));
        return;
      }

      // El cartel dice dónde QUEDÓ, así que se calcula con el valor nuevo.
      if (accion === "PAUSA") {
        const ahora = !pausado;
        setPausado(ahora);
        setAviso(avisoDeAccion("PAUSA", { pausado: ahora, aleatorio }));
        return;
      }

      const ahora = !aleatorio;
      setAleatorio(ahora);
      setAviso(avisoDeAccion("AZAR", { pausado, aleatorio: ahora }));
    };

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [pausado, aleatorio]);


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
        El mando no se ve: son teclas.

        Antes era una pestaña en el borde izquierdo que decía "CONTROLES", y antes de eso
        una franja invisible que no encontraba nadie. Las dos compartían el problema de
        ser píxeles proyectados en la pared de una fiesta, al lado de las fotos.

        Lo único que queda en pantalla es este cartelito, y sólo por un rato: sin botonera
        no hay nada que confirme que la tecla llegó, y apretar la barra sin que pase nada
        visible es indistinguible de un televisor colgado.
      */}
      <div
        className="pointer-events-none absolute bottom-8 left-8 rounded-2xl px-5 py-3 text-base font-extrabold text-white transition-opacity duration-500"
        style={{
          background: "rgba(0,0,0,0.6)",
          opacity: aviso ? 1 : 0,
        }}
        aria-live="polite"
      >
        {aviso}
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

