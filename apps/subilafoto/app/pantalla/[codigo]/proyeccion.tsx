"use client";

import { useEffect, useState } from "react";
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
 */

export type FotoEnVivo = {
  id: string;
  url: string;
  pie?: string | null;
  nombre?: string | null;
};

const CADA_FOTO_MS = 7_000;
/** Las URL vienen firmadas por un minuto: no se puede guardar una lista infinita. */
const MAXIMO_EN_MEMORIA = 40;

export function Proyeccion({
  codigo,
  iniciales,
  fondo,
  texto,
}: {
  codigo: string;
  iniciales: FotoEnVivo[];
  fondo: string;
  texto: string;
}) {
  const [fotos, setFotos] = useState<FotoEnVivo[]>(iniciales);
  // Crece sin tope y el resto se saca con módulo. Así el reloj no necesita
  // saber cuántas fotos hay, y no hay que rearmarlo cada vez que llega una.
  const [vuelta, setVuelta] = useState(0);

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

    return () => fuente.close();
  }, [codigo]);

  // La rotación es independiente de la llegada de fotos: si deja de llegar
  // gente nueva, la pantalla sigue mostrando lo que hay en lugar de congelarse.
  useEffect(() => {
    const reloj = setInterval(() => setVuelta((v) => v + 1), CADA_FOTO_MS);
    return () => clearInterval(reloj);
  }, []);

  const indice = fotos.length > 0 ? vuelta % fotos.length : 0;
  const actual = fotos[indice];

  if (!actual) {
    return (
      <div
        className="flex h-[100svh] w-full flex-col items-center justify-center px-12 text-center"
        style={{ background: fondo, color: texto }}
      >
        <p className="text-[clamp(1.5rem,4vw,3rem)] font-extrabold">
          Escaneá el código y subí tus fotos
        </p>
        <p className="mt-6 text-[clamp(1rem,2vw,1.5rem)]" style={{ opacity: 0.7 }}>
          Van a aparecer acá
        </p>
      </div>
    );
  }

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
          style={{ opacity: i === indice ? 1 : 0 }}
        />
      ))}

      {actual.pie || actual.nombre ? (
        <div
          className="absolute inset-x-0 bottom-0 px-12 py-10 text-center"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }}
        >
          <p className="text-[clamp(1rem,2.2vw,1.75rem)] font-extrabold text-white">
            {actual.pie}
            {actual.pie && actual.nombre ? " — " : ""}
            {actual.nombre}
          </p>
        </div>
      ) : null}
    </div>
  );
}
