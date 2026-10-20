"use client";

import { useEffect, useState } from "react";
import { CADA_BANNER_MS, cualBannerToca } from "@/lib/banners-rotativos";

export type BannerParaMostrar = { url: string; enlace: string | null; nombre: string | null };

/**
 * El pie del teléfono del invitado: el banner del fotógrafo y los de los proveedores.
 *
 * Va **abajo de todo** y no entre los botones: el invitado vino a subir una foto, y una
 * publicidad en el medio del camino le estorba. Abajo la ve igual —llega al final de la
 * pantalla— sin trabarle lo que vino a hacer.
 *
 * Los proveedores están ahí porque el fotógrafo los invitó a completar la ficha, y esto
 * es lo que reciben a cambio. Hasta ahora era un renglón al pie del álbum, que casi
 * nadie abre.
 *
 * **El fotógrafo no se diluye**: toma uno de cada dos turnos. Ver `lib/banners-rotativos.ts`.
 */
export function PieRotativo({
  fotografo,
  proveedores,
}: {
  fotografo: BannerParaMostrar | null;
  proveedores: BannerParaMostrar[];
}) {
  const [vuelta, setVuelta] = useState(0);

  // Sin proveedores no hay nada que rotar: un reloj que no cambia nada es gasto.
  const rota = Boolean(fotografo) && proveedores.length > 0;

  useEffect(() => {
    if (!rota) return;
    const reloj = setInterval(() => setVuelta((v) => v + 1), CADA_BANNER_MS);
    return () => clearInterval(reloj);
  }, [rota]);

  if (!fotografo && proveedores.length === 0) return null;

  const turno = cualBannerToca({ vuelta, cuantosProveedores: proveedores.length });
  const actual =
    turno.tipo === "FOTOGRAFO"
      ? (fotografo ?? proveedores[0]!)
      : (proveedores[turno.indice] ?? fotografo);

  if (!actual) return null;

  const alt = actual.nombre ? `Publicidad de ${actual.nombre}` : "Publicidad";
  /* eslint-disable-next-line @next/next/no-img-element */
  const imagen = <img src={actual.url} alt={alt} className="w-full rounded-2xl" />;

  return (
    <div className="mt-14 w-full max-w-sm">
      {actual.enlace ? (
        // `noopener` siempre que se abre en otra pestaña: sin eso, la página de destino
        // puede manipular la nuestra desde `window.opener`.
        <a href={actual.enlace} target="_blank" rel="noopener noreferrer" className="block">
          {imagen}
        </a>
      ) : (
        imagen
      )}

      {/* Quién es, cuando rota. Un banner suelto sin contexto parece un anuncio ajeno. */}
      {rota && actual.nombre ? (
        <p className="mt-2 text-center text-xs opacity-60">{actual.nombre}</p>
      ) : null}
    </div>
  );
}
