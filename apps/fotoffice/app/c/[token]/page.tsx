import type { Metadata } from "next";
import { findCardByToken } from "@/lib/carnet/lookup";

export const dynamic = "force-dynamic";

/**
 * Verificación pública de un carnet.
 *
 * Responde **una sola pregunta**: ¿es socio y está habilitado? Nada de deuda, documento,
 * teléfono, domicilio ni correo. Por qué no está habilitado —deuda, suspensión, baja, carnet
 * vencido— tampoco: en los cuatro casos, quien está en la puerta de un evento necesita la
 * misma respuesta.
 */
export const metadata: Metadata = {
  title: "Verificación de carnet",
  // Un carnet no se indexa: es una credencial, no una página.
  robots: { index: false, follow: false },
};

function fechaLegible(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

export default async function VerificarCarnetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const carnet = await findCardByToken(token);

  if (!carnet.found) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-12">
        <div className="fo-card space-y-2 p-6 text-center">
          <p className="text-base font-semibold text-[var(--fo-danger)]">Carnet no encontrado</p>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            {/*
              El mismo mensaje para un token inventado y para uno revocado: distinguirlos le
              diría a quien prueba al azar cuándo acertó un carnet que existió.
            */}
            Este código no corresponde a ningún carnet vigente.
          </p>
        </div>
      </main>
    );
  }

  const habilitado = carnet.status.enabled;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-12">
      {/*
        El isotipo va acá arriba y no dentro de la franja de estado: la franja es verde o roja
        según el resultado, y un isotipo que cambia de fondo según si el socio debe o no queda
        a merced de cada logo. Sobre el fondo claro se ve siempre igual.

        Sin `alt`: el nombre de la institución ya se lee dos veces en esta pantalla, y un lector
        de pantalla que lo anuncie una tercera no agrega nada.
      */}
      {carnet.institutionLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- el logo es una URL de R2
        <img
          src={carnet.institutionLogoUrl}
          alt=""
          className="mx-auto mb-5 h-20 w-auto max-w-[11rem] object-contain"
        />
      ) : null}

      <div className="fo-card overflow-hidden p-0">
        <div
          className={`px-6 py-5 text-center ${
            habilitado ? "bg-[var(--fo-success)]" : "bg-[var(--fo-danger)]"
          }`}
        >
          <p className="text-lg font-semibold text-white">
            {habilitado ? "Socio habilitado" : "No habilitado"}
          </p>
          <p className="mt-0.5 text-xs text-white/85">{carnet.institutionName}</p>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            {carnet.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- la foto es una URL de R2
              <img
                src={carnet.photoUrl}
                alt=""
                className="size-20 rounded-lg object-cover"
              />
            ) : (
              <div className="size-20 rounded-lg bg-[var(--fo-border)]" aria-hidden />
            )}
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-base font-semibold">{carnet.fullName}</p>
              <p className="text-sm text-[var(--fo-muted)]">Socio N° {carnet.memberNumber}</p>
              {carnet.category ? (
                <p className="text-sm text-[var(--fo-muted)]">{carnet.category}</p>
              ) : null}
            </div>
          </div>

          <dl className="space-y-1.5 border-t border-[var(--fo-border)] pt-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--fo-muted-soft)]">Carnet</dt>
              <dd className="font-medium tabular-nums">{carnet.cardNumber}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--fo-muted-soft)]">Vigente hasta</dt>
              <dd
                className={`font-medium tabular-nums ${
                  carnet.status.expired ? "text-[var(--fo-danger)]" : ""
                }`}
              >
                {fechaLegible(carnet.validUntil)}
              </dd>
            </div>
          </dl>

          <p className="text-center text-[10px] leading-relaxed text-[var(--fo-muted-soft)]">
            Verificado por {carnet.institutionName} a través de FotoOffice.
          </p>
        </div>
      </div>
    </main>
  );
}
