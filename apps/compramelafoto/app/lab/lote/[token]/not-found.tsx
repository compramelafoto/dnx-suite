import { ENLACE_INVALIDO } from "@/lib/print-batches/puerta-del-lab";

export default function LoteNoEncontrado() {
  return (
    <main className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">{ENLACE_INVALIDO}</h1>
        <p className="mt-2 text-sm text-gray-600">Pedile al fotógrafo que te mande el enlace de nuevo.</p>
      </div>
    </main>
  );
}
