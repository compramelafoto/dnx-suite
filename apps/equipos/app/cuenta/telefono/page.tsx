import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { AVISOS_ERROR, avisoDeCodigo, codigoDeMensaje } from "@/lib/avisos";
import { requireLevel } from "@/lib/guards";
import { buildWhatsappLink } from "@/lib/telefono/codigo";
import { startPhoneVerification } from "@/lib/telefono/registrar";
import { Aviso, Boton, BotonEnlace, Campo, Pagina } from "@/app/_ui";

export const dynamic = "force-dynamic";

async function guardarTelefono(formData: FormData) {
  "use server";
  const user = await requireLevel("registrado", "/cuenta/telefono");

  const r = await startPhoneVerification(user.id, String(formData.get("phone") ?? ""), new Date());
  // Por la URL viaja sólo el código; la página lo traduce con el mapa fijo.
  redirect(r.ok ? "/cuenta/telefono" : `/cuenta/telefono?error=${codigoDeMensaje(r.error) ?? "ERROR"}`);
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
  const user = await requireLevel("registrado", "/cuenta/telefono");
  const error = avisoDeCodigo(AVISOS_ERROR, (await searchParams).error);

  const pending = await prisma.phoneVerification.findUnique({ where: { userId: user.id } });

  const number = process.env.WHATSAPP_VERIFY_NUMBER?.trim();
  const vigente = pending && !pending.verifiedAt && pending.codeExpiresAt.getTime() > Date.now();

  return (
    <Pagina
      titulo="Verificá tu teléfono"
      bajada="Paso 2 de 3. Confirmamos que el número de WhatsApp es tuyo con un código."
      volver={{ href: "/cuenta/verificacion", texto: "Mi verificación" }}
    >
      <div className="pila">
        {error ? <Aviso tipo="error">{error}</Aviso> : null}

        {pending?.verifiedAt ? (
          <Aviso tipo="exito">
            Tu teléfono está verificado ({pending.phone}). Si lo cambiás, vas a tener que verificarlo de
            nuevo
            {user.identity?.status === "APPROVED"
              ? " y también vas a tener que volver a verificar tu identidad (DNI y selfie)."
              : "."}
          </Aviso>
        ) : null}

        {vigente && number ? (
          <section className="superficie pila" aria-label="Enviar el código">
            <p>
              Para confirmar que el número {pending.phone} es tuyo, mandá desde ese teléfono un mensaje de
              WhatsApp con el código. El código vence en 15 minutos.
            </p>
            <div className="acciones">
              <BotonEnlace href={buildWhatsappLink(number, pending.code)} target="_blank" rel="noreferrer">
                Enviar el código por WhatsApp
              </BotonEnlace>
              <form action={recargar}>
                <Boton variante="secundario">Ya lo envié</Boton>
              </form>
            </div>
          </section>
        ) : null}

        {pending && !pending.verifiedAt && !vigente ? (
          <Aviso tipo="revision">El código venció. Ingresá tu número para recibir uno nuevo.</Aviso>
        ) : null}
        {vigente && !number ? (
          <Aviso tipo="revision">La verificación por WhatsApp no está disponible por ahora.</Aviso>
        ) : null}

        <form action={guardarTelefono} className="formulario superficie">
          <Campo etiqueta="Tu teléfono" ayuda="Tu celular con el código de área. Da igual si ponés el 0 o el 15.">
            <input
              className="control"
              name="phone"
              type="tel"
              autoComplete="tel-national"
              required
              placeholder="341 555-1234"
              defaultValue=""
            />
          </Campo>
          <div className="acciones">
            <Boton variante={vigente ? "secundario" : "principal"}>
              {pending ? "Cambiar el teléfono y pedir otro código" : "Pedir el código"}
            </Boton>
          </div>
        </form>
      </div>
    </Pagina>
  );
}
