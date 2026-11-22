import { Cobros } from "@/components/ventas/cobros";
import { aviso, nota } from "@/components/ventas/estilos";
import { leerConfigDeVentas } from "@/lib/ventas/config";
import { cuentaDeCobro, estadoDeConsentimiento } from "@/lib/ventas/cuentas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cobros" };

/** Conectar Mercado Pago para recibir la parte de cada venta (etapa 8, spec D13). */
export default async function PaginaCobros() {
  const usuario = await requireUsuario("/panel/cobros");
  const config = leerConfigDeVentas();
  const c = await cuentaDeCobro(usuario.id, config.ambienteCuenta);
  return (
    <main className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Cobros</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Para recibir tu parte de cada venta directo en tu Mercado Pago. Sirve para todas tus muestras, como organización o como autor/a.
        </p>
      </header>
      {config.modo === "TEST" ? <p className={aviso}>Modo prueba: usá una cuenta de prueba de Mercado Pago.</p> : null}
      {config.modo === "OFF" ? <p className={aviso}>La venta todavía no está habilitada, pero podés dejar esto listo.</p> : null}
      <section className="border-t border-[var(--mf-line)] pt-6">
        <Cobros cuenta={{ email: c?.mpEmail ?? null, estado: c ? estadoDeConsentimiento(c.consentStatus) : "NONE", inviteUrl: c?.inviteUrl ?? null }} />
      </section>
      <p className={nota}>
        No guardamos ninguna clave de tu cuenta: Mercado Pago te pide que aceptes que la plataforma te transfiera tu parte en el momento de cada venta. Podés revocarlo cuando quieras desde Mercado Pago.
      </p>
    </main>
  );
}
