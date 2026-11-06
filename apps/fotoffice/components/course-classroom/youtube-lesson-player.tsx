/**
 * El video de una clase alojada en YouTube (sólo cursos gratuitos). Sin marca de agua ni
 * avance: no hay nada que proteger ni alumno que identificar.
 */
export function YoutubeLessonPlayer({ src, titulo }: { src: string; titulo: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--fo-radius)] bg-black">
      <iframe
        src={src}
        title={titulo}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
