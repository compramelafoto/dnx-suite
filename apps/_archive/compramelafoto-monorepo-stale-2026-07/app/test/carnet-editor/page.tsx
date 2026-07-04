import CarnetEditor from "@/components/carnet/CarnetEditor";

export default function CarnetEditorPage() {
  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a]">
              Editor de Foto Carnet (prueba)
            </h1>
            <p className="text-sm text-[#6b7280]">
              Página aislada para testear el recorte, los ajustes y la exportación en 10x15.
            </p>
          </div>
          <CarnetEditor />
        </div>
      </div>
    </section>
  );
}
