import Link from "next/link";
import Button from "@/components/ui/Button";

type MercadoPagoIntegrationProps = {
  ownerType: "USER" | "LAB";
  mpAccessToken?: string | null;
  mpUserId?: string | null;
  mpConnectedAt?: string | null;
  showWarning?: boolean;
  securityUrl: string;
  onReload: () => void | Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export default function MercadoPagoIntegration({
  ownerType,
  mpAccessToken,
  mpUserId,
  mpConnectedAt,
  showWarning = false,
  securityUrl,
  onReload,
  onError,
  onSuccess,
}: MercadoPagoIntegrationProps) {
  const isConnected = Boolean(mpAccessToken);

  async function handleDisconnect() {
    if (!confirm("¿Desconectar tu cuenta de Mercado Pago?")) return;
    try {
      const res = await fetch(`/api/mercadopago/disconnect?ownerType=${ownerType}`, {
        method: "POST",
      });
      if (res.ok) {
        onSuccess("Cuenta de Mercado Pago desconectada");
        await onReload();
      } else {
        onError("Error desconectando cuenta");
      }
    } catch (err) {
      onError("Error desconectando cuenta");
    }
  }

  return (
    <div className="pt-6 border-t border-[#e5e7eb]">
      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
        Integración con Mercado Pago
      </label>

      {!isConnected && showWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <p className="text-sm text-amber-800 font-medium">
            ⚠️ Este paso es obligatorio. Si no vinculás tu cuenta de Mercado Pago no podrás subir fotos ni vender impresiones.
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Seguí los pasos para poder recibir los cobros.
          </p>
          <Link
            href={securityUrl}
            className="inline-flex items-center text-xs text-amber-800 hover:underline mt-2"
          >
            Ver detalles de seguridad
          </Link>
        </div>
      )}

      {isConnected ? (
        <div className="p-4 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#10b981] font-medium mb-1">
                ✅ Conectado con Mercado Pago
              </p>
              {mpUserId && (
                <p className="text-xs text-[#6b7280]">
                  ID de usuario: {mpUserId}
                </p>
              )}
              {mpConnectedAt && (
                <p className="text-xs text-[#6b7280]">
                  Conectado el: {new Date(mpConnectedAt).toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
            <Button variant="secondary" onClick={handleDisconnect} className="text-sm">
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-[#f8f9fa] border border-[#e5e7eb] rounded-lg">
          <p className="text-sm text-[#6b7280] mb-3">
            Conectá tu cuenta de Mercado Pago para recibir pagos directamente en tu cuenta.
          </p>
          <p className="text-xs text-[#6b7280] mb-3">
            Recomendación: revisá tus plazos de acreditación. En general, cuanto más rápido se acredita el pago,
            mayor puede ser la comisión.
          </p>
          <a
            href="https://www.mercadopago.com.ar/ayuda/16981"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-xs text-[#009EE3] hover:underline mb-4"
          >
            Ver y configurar plazos de acreditación
          </a>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <button
              onClick={() => {
                window.location.href = `/api/mercadopago/oauth/start?ownerType=${ownerType}`;
              }}
              className="flex items-center justify-center gap-3 px-6 py-3 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02] text-sm"
              style={{ backgroundColor: "#009EE3" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#0088cc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#009EE3";
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="white" opacity="0.3"/>
                <rect x="7" y="9" width="10" height="6" rx="1" fill="white"/>
                <path d="M9 11h6M9 13h4" stroke="#009EE3" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>Conectar con Mercado Pago</span>
            </button>
            <Link
              href={securityUrl}
              className="text-sm text-[#6b7280] hover:text-[#1a1a1a] hover:underline"
            >
              ¿Por qué es seguro conectarse?
            </Link>
          </div>
          <p className="text-xs text-[#6b7280] mt-3">
            La autorización se hace en Mercado Pago. No compartís tu contraseña con ComprameLaFoto.
          </p>
        </div>
      )}
    </div>
  );
}
