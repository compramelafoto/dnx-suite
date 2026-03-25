 "use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";

export default function MercadoPagoSeguridadPage() {
  const router = useRouter();
  return (
    <section className="py-12 md:py-16 bg-gray-50 min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-2">
            <p className="text-sm text-[#6b7280]">Ayuda · Mercado Pago</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#1a1a1a]">
              Seguridad y conexión con Mercado Pago
            </h1>
            <p className="text-sm text-[#6b7280]">
              La conexión se autoriza en Mercado Pago. ComprameLaFoto nunca ve tu clave.
            </p>
          </div>

          <Card className="space-y-3">
            <h2 className="text-lg font-medium text-[#1a1a1a]">Resumen rápido</h2>
            <p className="text-sm text-[#6b7280]">
              Conectar Mercado Pago permite que los cobros vayan a tu cuenta. No le das acceso total a tu billetera.
              Solo usamos el permiso para generar cobros de tus ventas dentro de la plataforma.
            </p>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-medium text-[#1a1a1a]">Qué autorizás realmente</h2>
            <ul className="text-sm text-[#6b7280] space-y-2 list-disc pl-5">
              <li>ComprameLaFoto obtiene un token para crear cobros y preferencias en tu nombre.</li>
              <li>Ese token se usa solo para ventas generadas dentro de ComprameLaFoto.</li>
              <li>No compartís tu contraseña ni tus datos de acceso a Mercado Pago.</li>
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-medium text-[#1a1a1a]">Qué NO puede hacer la plataforma</h2>
            <ul className="text-sm text-[#6b7280] space-y-2 list-disc pl-5">
              <li>No está diseñada para transferir tu saldo a otra cuenta “porque sí”.</li>
              <li>El permiso se limita a lo que Mercado Pago autoriza en OAuth.</li>
              <li>No puede operar con dinero que entra por fuera de ComprameLaFoto.</li>
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-medium text-[#1a1a1a]">Doble seguridad y control</h2>
            <ul className="text-sm text-[#6b7280] space-y-2 list-disc pl-5">
              <li>La autorización la hacés en la pantalla oficial de Mercado Pago.</li>
              <li>Podés revocar el acceso cuando quieras desde tu cuenta de Mercado Pago.</li>
              <li>Buscá la sección de seguridad o aplicaciones autorizadas dentro de tu cuenta.</li>
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-medium text-[#1a1a1a]">Qué pasa cuando conectás</h2>
            <ul className="text-sm text-[#6b7280] space-y-2 list-disc pl-5">
              <li>ComprameLaFoto puede generar links de pago para tus ventas.</li>
              <li>Mercado Pago acredita el dinero directamente en tu cuenta.</li>
              <li>La comisión de la plataforma se aplica solo a esas operaciones.</li>
            </ul>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-medium text-[#1a1a1a]">Cómo leer el bloque de configuración</h2>
            <div className="space-y-3 text-sm text-[#6b7280]">
              <div>
                <p className="font-medium text-[#1a1a1a]">Integración con Mercado Pago</p>
                <p>Es la conexión OAuth que habilita a ComprameLaFoto a generar cobros en tu cuenta.</p>
              </div>
              <div>
                <p className="font-medium text-[#1a1a1a]">Este paso es obligatorio</p>
                <p>Sin la conexión no podemos crear pagos a tu nombre, por eso se exige para vender.</p>
              </div>
              <div>
                <p className="font-medium text-[#1a1a1a]">Conectá tu cuenta para recibir pagos</p>
                <p>Los cobros de tus ventas se acreditan en tu propia cuenta de Mercado Pago.</p>
              </div>
              <div>
                <p className="font-medium text-[#1a1a1a]">Recomendación sobre plazos de acreditación</p>
                <p>Los plazos y medios de cobro impactan en comisiones y en cuándo tenés el dinero disponible.</p>
              </div>
              <div>
                <p className="font-medium text-[#1a1a1a]">Ver y configurar plazos de acreditación</p>
                <p>Te lleva a Mercado Pago para revisar opciones y condiciones de acreditación.</p>
              </div>
              <div>
                <p className="font-medium text-[#1a1a1a]">Conectar con Mercado Pago</p>
                <p>Inicia la autorización oficial de Mercado Pago (OAuth).</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-medium text-[#1a1a1a]">Buenas prácticas</h2>
            <ul className="text-sm text-[#6b7280] space-y-2 list-disc pl-5">
              <li>Activá la verificación en dos pasos (2FA) en Mercado Pago.</li>
              <li>No compartas códigos ni pantallas de autorización.</li>
              <li>Verificá que estés en el dominio oficial de Mercado Pago al autorizar.</li>
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-medium text-[#1a1a1a]">Preguntas frecuentes</h2>
            <div className="space-y-3 text-sm text-[#6b7280]">
              <div>
                <p className="font-medium text-[#1a1a1a]">¿Le estoy dando permisos para manejar mi cuenta libremente?</p>
                <p>No. El permiso está acotado a generar cobros de ventas creadas en ComprameLaFoto.</p>
              </div>
              <div>
                <p className="font-medium text-[#1a1a1a]">¿Me pueden vaciar la cuenta si hackean la plataforma?</p>
                <p>El token no está diseñado para mover tu saldo a otras cuentas. Aun así, aplicamos medidas de seguridad y podés revocar el permiso cuando quieras.</p>
              </div>
              <div>
                <p className="font-medium text-[#1a1a1a]">¿Puedo desconectar cuando quiera?</p>
                <p>Sí. Podés revocar el acceso desde tu cuenta de Mercado Pago y la conexión queda inactiva.</p>
              </div>
              <div>
                <p className="font-medium text-[#1a1a1a]">¿Qué datos guarda ComprameLaFoto?</p>
                <p>Guardamos el token de acceso y la identificación de tu usuario de Mercado Pago para operar los cobros.</p>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[#1a1a1a] font-medium">¿Querés volver a la configuración?</p>
              <p className="text-xs text-[#6b7280]">Volvé a la pantalla anterior para seguir configurando tu cuenta.</p>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-md bg-[#c27b3d] text-white text-sm text-center hover:bg-[#b06f36]"
            >
              Volver
            </button>
          </Card>
        </div>
      </div>
    </section>
  );
}
