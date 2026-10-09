/**
 * El banner del fotógrafo, al pie de la pantalla del invitado.
 *
 * Va **abajo de todo** y no entre los botones: el invitado vino a subir una foto, y una
 * publicidad en el medio del camino le estorba. Abajo la ve igual —llega al final de la
 * pantalla— sin trabarle lo que vino a hacer.
 *
 * Si no tiene enlace es sólo una imagen, sin nada que tocar: un recuadro que parece un
 * botón y no lleva a ningún lado es peor que ninguno.
 */
// eslint-disable-next-line @next/next/no-img-element
export function BannerDelFotografo({
  url,
  enlace,
  nombre,
}: {
  url: string | null;
  enlace: string | null;
  nombre: string | null;
}) {
  if (!url) return null;

  const alt = nombre ? `Publicidad de ${nombre}` : "Publicidad del fotógrafo";
  /* eslint-disable-next-line @next/next/no-img-element */
  const imagen = <img src={url} alt={alt} className="w-full rounded-2xl" />;

  return (
    <div className="mt-14 w-full max-w-sm">
      {enlace ? (
        // `noopener` siempre que se abre en otra pestaña: sin eso, la página de destino
        // puede manipular la nuestra desde `window.opener`.
        <a href={enlace} target="_blank" rel="noopener noreferrer" className="block">
          {imagen}
        </a>
      ) : (
        imagen
      )}
    </div>
  );
}
