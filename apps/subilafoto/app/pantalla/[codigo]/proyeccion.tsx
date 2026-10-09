"use client";

import { useEffect, useState } from "react";
import { queMostrar } from "@/lib/pantalla-ritmo";
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

export type FotoEnVivo = {
  id: string;
  url: string;
  pie?: string | null;
  nombre?: string | null;
};

const CADA_FOTO_MS = 7_000;
/** El QR se deja más tiempo: hay que sacar el teléfono, abrir la cámara y apuntar. */
const EL_QR_MS = 12_000;
/** Las URL vienen firmadas por un rato: no se puede guardar una lista infinita. */
const MAXIMO_EN_MEMORIA = 40;
/** Cuánto dura un emoji subiendo por la pantalla. */
const VUELO_MS = 4_000;

type EmojiVolando = { clave: string; emoji: string; izquierda: number; demora: number };

export function Proyeccion({
  codigo,
  iniciales,
  fondo,
  texto,
  qrSvg,
  urlDelEvento,
}: {
  codigo: string;
  iniciales: FotoEnVivo[];
  fondo: string;
  texto: string;
  /** El código QR ya dibujado en el servidor: la pantalla no tiene que calcularlo. */
  qrSvg: string;
  urlDelEvento: string;
}) {
  const [fotos, setFotos] = useState<FotoEnVivo[]>(iniciales);
  // Crece sin tope y el resto se saca con módulo. Así el reloj no necesita
  // saber cuántas fotos hay, y no hay que rearmarlo cada vez que llega una.
  const [vuelta, setVuelta] = useState(0);
  const [volando, setVolando] = useState<EmojiVolando[]>([]);
  const [conteo, setConteo] = useState<Record<string, number>>({});

  // Escucha las fotos nuevas. EventSource reconecta solo y manda el
  // Last-Event-ID, así que no hay que escribir la reconexión a mano.
  useEffect(() => {
    const fuente = new EventSource(`/api/e/${codigo}/vivo`);

    fuente.addEventListener("foto", (e) => {
      const foto = JSON.parse((e as MessageEvent).data) as FotoEnVivo;

      // Se precarga antes de meterla en la rotación: así nunca aparece a medias.
      const img = new Image();
      img.src = foto.url;
      const agregar = () =>
        setFotos((previas) =>
          previas.some((f) => f.id === foto.id)
            ? previas
            : [...previas, foto].slice(-MAXIMO_EN_MEMORIA),
        );
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
        conteo: Record<string, number>;
      };
      setConteo(datos.conteo);
    });

    return () => fuente.close();
  }, [codigo]);

  const paso = queMostrar({ vuelta, cantidadDeFotos: fotos.length });

  /*
    La rotación es independiente de la llegada de fotos: si deja de llegar gente nueva,
    la pantalla sigue mostrando lo que hay en lugar de congelarse.

    El reloj se rearma en cada paso porque el QR dura más que una foto: `vuelta` está en
    las dependencias a propósito, cada vuelta programa la siguiente.
  */
  useEffect(() => {
    const cuanto = paso.tipo === "QR" ? EL_QR_MS : CADA_FOTO_MS;
    const reloj = setTimeout(() => setVuelta((v) => v + 1), cuanto);
    return () => clearTimeout(reloj);
  }, [vuelta, paso.tipo]);

  const totales = totalesOrdenados(conteo);
  const indiceVisible = paso.tipo === "FOTO" ? paso.indice : -1;
  const actual = paso.tipo === "FOTO" ? fotos[paso.indice] : undefined;

  return (
    <div
      className="relative h-[100svh] w-full overflow-hidden"
      style={{ background: fondo, color: texto }}
    >
      {/*
        Se pintan todas y se muestra una: cambiar el `src` de una sola etiqueta
        haría parpadear en blanco cada siete segundos en una pantalla grande.
      */}
      {fotos.map((foto, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={foto.id}
          src={foto.url}
          alt=""
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-700"
          style={{ opacity: i === indiceVisible ? 1 : 0 }}
        />
      ))}

      {/* El turno del código: la pantalla entera, no una esquina. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-8 transition-opacity duration-700"
        style={{
          background: fondo,
          opacity: paso.tipo === "QR" ? 1 : 0,
          pointerEvents: paso.tipo === "QR" ? "auto" : "none",
        }}
      >
        <p className="text-balance px-12 text-center text-[clamp(1.5rem,4vw,3.5rem)] font-extrabold">
          {fotos.length === 0 ? "Sacá fotos y subilas acá" : "Sumá tus fotos"}
        </p>
        <div
          className="w-[min(26rem,45vh)] rounded-3xl bg-white p-6"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-[clamp(1rem,2vw,1.6rem)]" style={{ opacity: 0.75 }}>
          {urlDelEvento}
        </p>
      </div>

      {actual?.pie || actual?.nombre ? (
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
            style={{ left: `${v.izquierda}%`, animationDelay: `${v.demora}ms` }}
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

      <style>{`
        @keyframes slf-sube {
          0%   { transform: translateY(0) scale(0.7); opacity: 0; }
          15%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(-85vh) scale(1.15); opacity: 0; }
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
