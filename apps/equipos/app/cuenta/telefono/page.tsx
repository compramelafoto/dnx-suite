import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { getCurrentUser } from "@repo/auth-guards";
import { buildWhatsappLink } from "@/lib/telefono/codigo";
import { startPhoneVerification } from "@/lib/telefono/registrar";

export const dynamic = "force-dynamic";

async function guardarTelefono(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerifiedAt: true },
  });
  if (!dbUser?.emailVerifiedAt) redirect("/cuenta/telefono");

  const r = await startPhoneVerification(user.id, String(formData.get("phone") ?? ""), new Date());
  redirect(r.ok ? "/cuenta/telefono" : `/cuenta/telefono?error=${encodeURIComponent(r.error)}`);
}

async function recargar() {
  "use server";
  redirect("/cuenta/telefono");
}

export default async function TelefonoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;

  const [dbUser, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } }),
    prisma.phoneVerification.findUnique({ where: { userId: user.id } }),
  ]);

  if (!dbUser?.emailVerifiedAt) {
    return (
      <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
        <h1>Verificá tu teléfono</h1>
        <p>Primero tenés que verificar tu correo electrónico. Después volvé a esta página.</p>
      </main>
    );
  }

  const number = process.env.WHATSAPP_VERIFY_NUMBER?.trim();
  const vigente = pending && !pending.verifiedAt && pending.codeExpiresAt.getTime() > Date.now();

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1>Verificá tu teléfono</h1>
      {error ? <p role="alert">{error}</p> : null}

      {pending?.verifiedAt ? (
        <p>Tu teléfono está verificado ({pending.phone}). Si lo cambiás, vas a tener que verificarlo de nuevo.</p>
      ) : null}

      {vigente && number ? (
        <section>
          <p>
            Para confirmar que el número {pending.phone} es tuyo, mandá desde ese teléfono un mensaje de
            WhatsApp con el código. El código vence en 15 minutos.
          </p>
          <p>
            <a href={buildWhatsappLink(number, pending.code)} target="_blank" rel="noreferrer">
              Enviar el código por WhatsApp
            </a>
          </p>
          <form action={recargar}>
            <button type="submit">Ya lo envié</button>
          </form>
        </section>
      ) : null}

      {pending && !pending.verifiedAt && !vigente ? (
        <p>El código venció. Ingresá tu número para recibir uno nuevo.</p>
      ) : null}
      {vigente && !number ? <p>La verificación por WhatsApp no está disponible por ahora.</p> : null}

      <form action={guardarTelefono}>
        <label>
          Tu teléfono (con código de área){" "}
          <input name="phone" type="tel" required placeholder="341 555-1234" defaultValue="" />
        </label>
        <p>
          <button type="submit">{pending ? "Cambiar teléfono / nuevo código" : "Continuar"}</button>
        </p>
      </form>
    </main>
  );
}
