import Card from "@/components/ui/Card";
import { TERMS_TEXT as PHOTOGRAPHER_TERMS_TEXT } from "@/lib/terms/photographerTerms";
import { LAB_TERMS_TEXT } from "@/lib/terms/labTerms";

const CUSTOMER_TERMS_TEXT =
  "TÉRMINOS Y CONDICIONES – CLIENTES FINALES\n\n" +
  "1. ACEPTACIÓN\n" +
  "Al usar ComprameLaFoto y realizar una compra, aceptás estos términos y condiciones.\n\n" +
  "2. CUENTA Y DATOS\n" +
  "- Podés comprar como invitado o crear una cuenta para ver el historial de pedidos.\n" +
  "- Sos responsable de mantener tus datos de contacto actualizados.\n\n" +
  "3. COMPRAS Y PAGOS\n" +
  "- Los precios se informan antes de confirmar el pago.\n" +
  "- Los pagos se procesan a través de Mercado Pago.\n" +
  "- Una compra se considera confirmada cuando el pago está aprobado.\n\n" +
  "4. FOTOS DIGITALES\n" +
  "- Las fotos digitales compradas son para uso personal.\n" +
  "- No está permitido revender, distribuir públicamente o usar con fines comerciales sin autorización del fotógrafo.\n\n" +
  "5. IMPRESIONES\n" +
  "- Las impresiones se producen según el laboratorio seleccionado por la plataforma.\n" +
  "- Los tiempos de producción y entrega pueden variar según el laboratorio y la demanda.\n\n" +
  "6. ENTREGAS Y RETIROS\n" +
  "- En pedidos con retiro, la entrega se realiza en el laboratorio indicado.\n" +
  "- En pedidos con envío, los costos y tiempos pueden variar según la ubicación.\n\n" +
  "7. RECLAMOS Y SOPORTE\n" +
  "- Podés generar una incidencia desde el panel de soporte.\n" +
  "- Nuestro equipo revisará el caso y responderá por el mismo canal.\n\n" +
  "8. DISPONIBILIDAD DE ÁLBUMES\n" +
  "- Los álbumes pueden expirar y ser retirados luego de un período determinado.\n" +
  "- Recomendamos descargar las fotos dentro del plazo informado.\n\n" +
  "9. PROPIEDAD INTELECTUAL\n" +
  "- Las fotos son propiedad del fotógrafo.\n" +
  "- ComprameLaFoto actúa como intermediario tecnológico.\n\n" +
  "10. MODIFICACIONES\n" +
  "ComprameLaFoto puede actualizar estos términos. Los cambios se informarán en esta sección.";

export default function TermsPage() {
  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">Términos y Condiciones</h1>
            <p className="text-[#6b7280]">
              Accedé a los términos vigentes para fotógrafos, laboratorios y clientes finales.
            </p>
          </div>

          <Card className="p-6 space-y-4" id="fotografo">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Fotógrafo</h2>
            <pre className="whitespace-pre-wrap text-sm text-[#1a1a1a]">{PHOTOGRAPHER_TERMS_TEXT}</pre>
          </Card>

          <Card className="p-6 space-y-4" id="laboratorio">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Laboratorio</h2>
            <pre className="whitespace-pre-wrap text-sm text-[#1a1a1a]">{LAB_TERMS_TEXT}</pre>
          </Card>

          <Card className="p-6 space-y-4" id="cliente">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Cliente final</h2>
            <pre className="whitespace-pre-wrap text-sm text-[#1a1a1a]">{CUSTOMER_TERMS_TEXT}</pre>
          </Card>
        </div>
      </div>
    </section>
  );
}
