"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export type PerfilQrCardProps = {
  /** Dirección pública ya guardada en la base (`/<handler>`), no la que se está escribiendo. */
  handler: string;
  /** Si la página pública está encendida en la base. */
  isPublicPageEnabled: boolean;
  /** Si el formulario tiene la dirección o el encendido cambiados y todavía sin guardar. */
  hayCambiosSinGuardar?: boolean;
};

/**
 * QR de la página del fotógrafo, la que lista todos sus álbumes.
 *
 * Trabaja con lo guardado porque el QR lo genera el servidor a partir de la base: con lo
 * que todavía está en el formulario mostraba una imagen rota. Cuando falta el handler o la
 * página está apagada, muestra qué falta en vez de un QR que llevaría a una página que el
 * cliente no puede ver.
 */
export default function PerfilQrCard({
  handler,
  isPublicPageEnabled,
  hayCambiosSinGuardar = false,
}: PerfilQrCardProps) {
  const listo = Boolean(handler?.trim()) && isPublicPageEnabled;

  if (!listo) {
    return (
      <Card className="w-full min-w-0 border border-[#e5e7eb] p-4 sm:p-5">
        <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">El QR de tu página</h3>
        <p className="mt-2 m-0 text-sm text-[#6b7280]">
          {hayCambiosSinGuardar
            ? "Guardá los cambios de tu página pública para obtener tu QR."
            : !handler?.trim()
              ? "Para tener tu QR, primero elegí tu dirección pública acá arriba y guardá."
              : "Tu página pública está apagada. Encendela acá arriba y guardá para poder descargar tu QR."}
        </p>
      </Card>
    );
  }

  const url = `/${handler}`;
  // El handler en la dirección de la imagen hace que el navegador pida el QR nuevo
  // apenas se guarda otra dirección, en vez de seguir mostrando el anterior.
  const qrSrc = `/api/fotografo/perfil/qr?d=${encodeURIComponent(handler)}`;

  return (
    <Card className="w-full min-w-0 border border-[#e5e7eb] p-4 sm:p-5">
      <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">El QR de tu página</h3>
      <p className="mt-1 m-0 text-sm text-[#6b7280]">
        Lleva a <span className="font-medium text-[#1a1a1a]">compramelafoto.com{url}</span>, donde
        están todas tus galerías. Sirve para tu tarjeta, tu vidriera o tus redes.
      </p>
      {hayCambiosSinGuardar && (
        <p className="mt-2 m-0 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Tenés cambios sin guardar en tu página pública. Este QR sigue llevando a
          compramelafoto.com{url} hasta que guardes.
        </p>
      )}

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt="Código QR de tu página pública"
          className="h-32 w-32 shrink-0 rounded-lg border border-[#e5e7eb] bg-white p-2"
        />
        <div className="flex flex-wrap gap-2">
          <a href={qrSrc} download={`qr-${handler}.png`}>
            <Button type="button" variant="secondary" size="md">
              Descargar QR (PNG)
            </Button>
          </a>
          <a href="/api/fotografo/perfil/qr?formato=cartel" target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="secondary" size="md">
              Cartel A4
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
}
