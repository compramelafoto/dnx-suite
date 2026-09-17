import type { AlbumInstructivoProfile } from "@/lib/instructivos/album-instructivo-profile";
import type { InstructivoStep } from "@/lib/instructivos/album-instructivo-steps";

export type InstructivoViewProps = {
  profile: AlbumInstructivoProfile;
  steps: InstructivoStep[];
  qrDataUrl: string;
  pdfHref: string;
};

/**
 * Presentación del instructivo. Sin estado y sin acceso a datos: la usa tanto la página
 * pública como la vista previa del panel del fotógrafo.
 */
export default function InstructivoView({
  profile,
  steps,
  qrDataUrl,
  pdfHref,
}: InstructivoViewProps) {
  const color = profile.fotografo.color || "#c27b3d";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {profile.fotografo.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.fotografo.logoUrl}
              alt={profile.fotografo.nombre}
              className="mb-3 h-12 w-auto object-contain"
            />
          ) : null}
          <p className="m-0 text-sm text-[#6b7280]">{profile.fotografo.nombre}</p>
          <h1 className="m-0 text-2xl font-semibold" style={{ color }}>
            {profile.album.titulo}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">Cómo encontrar y comprar tus fotos</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="Código QR de la galería"
          className="h-24 w-24 shrink-0 sm:h-28 sm:w-28"
        />
      </header>

      <ol className="m-0 list-none space-y-6 p-0">
        {steps.map((step, i) => (
          <li key={`${i}-${step.titulo}`} className="flex gap-4">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-base font-semibold text-[#1a1a1a]">{step.titulo}</h2>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#374151]">
                {step.detalle.map((linea, j) => (
                  <li key={j}>{linea}</li>
                ))}
              </ul>
              {step.nota ? (
                <p className="mt-2 rounded-lg bg-[#fdf8f3] px-3 py-2 text-sm text-[#7c4a1e]">
                  {step.nota}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <a
          href={profile.album.url}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          Entrar a la galería
        </a>
        <a
          href={pdfHref}
          className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-medium text-[#374151]"
        >
          Descargar en PDF
        </a>
      </div>
    </main>
  );
}
