/**
 * Enlace de firma desconocido, de otra organización, vencido, reemplazado por una versión corregida o de un
 * contrato anulado: siempre el mismo mensaje, sin decir cuál de esos casos es.
 */
export default function ContratoNoDisponible() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
      <h1 className="text-xl font-semibold">Este enlace ya no es válido</h1>
      <p className="mt-3 opacity-80">Si tenías que firmar un contrato, pedile a quien te lo envió que te mande el enlace de nuevo.</p>
    </main>
  );
}
