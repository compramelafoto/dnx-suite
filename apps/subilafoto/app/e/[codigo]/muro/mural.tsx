"use client";

import { useEffect, useState } from "react";
import type { ItemEnVivo } from "@/app/pantalla/[codigo]/proyeccion";
import { idsAQuitar } from "@/lib/vivo";

/** Lo reciente, no el álbum: doce alcanza para que se vea vivo sin volverse un catálogo. */
const CUANTAS = 12;

/**
 * El muro en vivo, en el teléfono del invitado.
 *
 * Es la pantalla del salón cuando no hay pantalla. Sin ella —y la fiesta del 10/10/2026
 * se perdió exactamente por eso— el invitado escanea, sube una foto y no recibe nada: la
 * manda a un pozo, y no tiene ningún motivo para subir una segunda.
 *
 * **No es el álbum.** Muestra lo último que llegó, en chico y sin forma de bajarlo. El
 * álbum es todo el evento, para siempre y con la foto entera, y sigue cerrado.
 *
 * Usa el mismo canal en vivo que la pantalla del salón: ya existe, ya reconecta solo y
 * ya manda la variante chica en vez del original.
 */
export function Mural({ codigo, iniciales }: { codigo: string; iniciales: ItemEnVivo[] }) {
  const [items, setItems] = useState<ItemEnVivo[]>(iniciales);

  useEffect(() => {
    const fuente = new EventSource(`/api/e/${codigo}/vivo`);

    fuente.addEventListener("foto", (e) => {
      const item = JSON.parse((e as MessageEvent).data) as ItemEnVivo;
      setItems((previos) =>
        previos.some((f) => f.id === item.id)
          ? previos
          : [item, ...previos].slice(0, CUANTAS),
      );
    });

    /*
      Cada tanto llega la lista completa de lo que sigue vigente. Lo que el fotógrafo
      sacó de la pantalla desaparece también de acá — si no, el muro seguiría mostrando
      justo lo que él decidió bajar.
    */
    fuente.addEventListener("vigentes", (e) => {
      const { ids } = JSON.parse((e as MessageEvent).data) as { ids: string[] };
      setItems((previos) => {
        const sobran = new Set(idsAQuitar(ids, previos.map((f) => f.id)));
        return sobran.size === 0 ? previos : previos.filter((f) => !sobran.has(f.id));
      });
    });

    return () => fuente.close();
  }, [codigo]);

  if (items.length === 0) {
    return (
      <p className="mt-8 text-center text-sm opacity-75">
        Todavía no subió nadie. Sé la primera persona.
      </p>
    );
  }

  return (
    <ul className="mt-6 grid grid-cols-2 gap-3">
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded-2xl">
          {item.tipo === "FOTO" ? (
            /*
              Sin `next/image`: la dirección viene firmada y vence. Y es la variante de
              pantalla, nunca el original — la misma regla que en la proyección.
            */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full min-h-[8rem] items-center justify-center p-4 text-center text-sm font-extrabold"
              style={{ background: "rgba(255,255,255,0.14)" }}
            >
              {item.texto}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
