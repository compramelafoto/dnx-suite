import CarnetEditor from "@/components/carnet/CarnetEditor";
import Card from "@/components/ui/Card";

export default function CarnetTestPage() {
  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom">
        <div className="max-w-5xl mx-auto space-y-6">
          <Card className="p-4 text-sm border-amber-200 bg-amber-50 text-amber-800">
            Modo interno: descarga habilitada (sin Mercado Pago).
          </Card>
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a]">
              Editor de Foto Carnet (test)
            </h1>
            <p className="text-sm text-[#6b7280]">
              Página aislada para testear recorte, ajustes y exportación en 10x15.
            </p>
          </div>
          <CarnetEditor mode="test" />
        </div>
      </div>
    </section>
  );
}
