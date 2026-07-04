import PolaroidEditor from "@/components/polaroid/PolaroidEditor";

export default function PolaroidEditorPage() {
  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a]">
              Editor de Polaroids (prueba)
            </h1>
            <p className="text-sm text-[#6b7280]">
              Página aislada para probar recorte, texturas, texto y exportación en ZIP.
            </p>
          </div>
          <PolaroidEditor />
        </div>
      </div>
    </section>
  );
}
