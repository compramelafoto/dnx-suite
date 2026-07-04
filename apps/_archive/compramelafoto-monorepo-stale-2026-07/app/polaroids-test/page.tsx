import PolaroidEditor from "@/components/polaroid/PolaroidEditor";
import Card from "@/components/ui/Card";

export default function PolaroidsTestPage() {
  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card className="p-4 text-sm border-amber-200 bg-amber-50 text-amber-800">
            Modo interno: descarga habilitada (sin Mercado Pago).
          </Card>
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a]">
              Editor de Polaroids (test)
            </h1>
            <p className="text-sm text-[#6b7280]">
              Página aislada para testear recorte, texturas, texto y exportación en ZIP.
            </p>
          </div>
          <PolaroidEditor />
        </div>
      </div>
    </section>
  );
}
