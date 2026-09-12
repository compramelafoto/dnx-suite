import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { rutaInternaSegura } from "@/lib/ruta-segura";

/** Ingreso del profesional. La misma cuenta que en el resto de DNX Suite. */

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function Login({ searchParams }: Props) {
  const { error, next } = await searchParams;

  // Quien ya tiene la sesión abierta no tiene nada que hacer acá. La portada
  // muestra «Ingresar» a todo el mundo para poder servirse estática, así que
  // este desvío es lo que hace que ese botón no sea un callejón sin salida.
  const token = (await cookies()).get(DNX_SESSION_COOKIE)?.value;
  if (token && (await getSessionUserByRawToken(token))) {
    redirect(rutaInternaSegura(next) ?? "/panel");
  }

  const destino = next
    ? `/api/auth/google?next=${encodeURIComponent(next)}`
    : "/api/auth/google";

  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-16"
      style={{ background: "var(--slf-purpura)" }}
    >
      <Image
        src="/brand/subilafoto-logo-vertical-negativo.png"
        alt="Subí la Foto"
        width={260}
        height={330}
        priority
        className="h-auto w-[min(13rem,55vw)]"
      />

      <h1 className="mt-12 text-center text-2xl font-extrabold text-white">
        Entrá a tu cuenta
      </h1>
      <p className="mt-3 max-w-[36ch] text-center" style={{ color: "var(--slf-lila)" }}>
        Es la misma cuenta que usás en las demás aplicaciones de DNX Suite.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-8 max-w-[42ch] rounded-xl px-5 py-4 text-center text-sm"
          style={{ background: "#ffffff14", color: "var(--slf-amarillo)" }}
        >
          {error}
        </p>
      ) : null}

      <a
        href={destino}
        className="mt-10 inline-flex items-center gap-3 rounded-xl bg-white px-7 py-4 font-extrabold"
        style={{ color: "var(--slf-purpura)" }}
      >
        Continuar con Google
      </a>
    </main>
  );
}
