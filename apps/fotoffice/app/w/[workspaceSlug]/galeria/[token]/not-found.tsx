/**
 * Enlace de galería desconocido, de otra organización, anulado o de una galería que ya no está publicada:
 * siempre el mismo mensaje, sin decir cuál de esos casos es.
 */
export default function GaleriaNoDisponible() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
      <h1 className="text-xl font-semibold">Este enlace ya no es válido</h1>
      <p className="mt-3 opacity-80">Si tenías que elegir fotos, pedile a quien te lo envió que te mande el enlace de nuevo.</p>
    </main>
  );
}
