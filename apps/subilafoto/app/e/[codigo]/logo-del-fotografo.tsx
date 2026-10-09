/**
 * El logo del fotógrafo, arriba de todo en el teléfono del invitado.
 *
 * Es la marca blanca: el invitado entra por un QR que le dieron en la fiesta y lo
 * primero que ve tiene que ser quién hizo esto, no nuestra marca. Para el fotógrafo es
 * la publicidad que paga el servicio.
 *
 * Va sobre una pastilla clara y no suelto sobre el fondo del evento: los estilos oscuros
 * se tragan un logo oscuro, y el manual prohíbe apoyarlo donde no tiene contraste.
 */
// eslint-disable-next-line @next/next/no-img-element
export function LogoDelFotografo({
  url,
  nombre,
}: {
  url: string | null;
  nombre: string | null;
}) {
  if (!url) return null;

  return (
    <div className="mb-8 flex justify-center">
      <span className="inline-flex items-center rounded-2xl bg-white px-4 py-3">
        {/* Sin `next/image`: la dirección viene firmada y vence, así que no tiene
            sentido que el optimizador la cachee. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={nombre ? `Logo de ${nombre}` : "Logo del fotógrafo"}
          className="max-h-12 w-auto"
        />
      </span>
    </div>
  );
}
