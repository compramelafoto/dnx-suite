import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";

import { FotorankDialogShell } from "../../components/ui/FotorankDialogShell";
import { getAuthUser } from "../../lib/auth";
import { getJudgeAuthUser } from "../../lib/judge-auth";
import { puedeEntrarConLaSesionDelSitio } from "../../lib/fotorank/judges/puenteDeSesion";
import { ConfirmarCorreoParaEntrar } from "./ConfirmarCorreoParaEntrar";
import { JudgeLoginForm } from "./JudgeLoginForm";

export const dynamic = "force-dynamic";

/**
 * Tres situaciones distintas terminan en esta pantalla.
 *
 * 1. Ya puede entrar (por sesión de jurado o por la del sitio) → va al panel.
 *    Mostrarle un formulario a quien ya está adentro no tiene sentido.
 * 2. Entró al sitio y es jurado, pero le falta confirmar su correo → se le
 *    ofrece el enlace, que es lo único que lo separa de no tener dos claves.
 * 3. El resto → el acceso de siempre.
 */
export default async function JudgeLoginPage() {
  const yaEsJurado = await getJudgeAuthUser();
  if (yaEsJurado) redirect("/jurado/panel");

  const sesionDelSitio = await getAuthUser();
  let faltaConfirmar = false;

  if (sesionDelSitio?.email) {
    const [usuario, cuenta] = await Promise.all([
      prisma.user.findUnique({
        where: { id: sesionDelSitio.id },
        select: { email: true, emailVerifiedAt: true },
      }),
      prisma.fotorankJudgeAccount.findUnique({
        where: { email: sesionDelSitio.email.trim().toLowerCase() },
        select: { accountStatus: true, emailVerifiedAt: true },
      }),
    ]);

    const permiso = puedeEntrarConLaSesionDelSitio({
      usuario: usuario ? { email: usuario.email, emailVerifiedAt: usuario.emailVerifiedAt } : null,
      cuentaDeJurado: cuenta,
    });
    faltaConfirmar =
      !permiso.ok && permiso.razon === "FALTA_CONFIRMAR_EL_CORREO_DEL_SITIO";
  }

  return (
    <FotorankDialogShell
      title={faltaConfirmar ? "Un paso y entrás" : "Acceso jurado"}
      subtitle={
        faltaConfirmar
          ? "Ya estás dentro de FotoRank. Falta confirmar tu correo para usar la misma contraseña acá."
          : "Ingresá con el email y la contraseña de tu cuenta de jurado."
      }
      footerLinks={
        <>
          <Link href="/" className="transition-colors hover:text-gold">
            Volver al inicio
          </Link>
          <span className="hidden text-fr-border sm:inline" aria-hidden>
            ·
          </span>
          <Link href="/jurado/recuperar" className="transition-colors hover:text-gold">
            Olvidé mi contraseña
          </Link>
          <span className="hidden text-fr-border sm:inline" aria-hidden>
            ·
          </span>
          <Link href="/login" className="transition-colors hover:text-gold">
            Soy organizador
          </Link>
        </>
      }
    >
      {faltaConfirmar && sesionDelSitio ? (
        <ConfirmarCorreoParaEntrar email={sesionDelSitio.email} />
      ) : (
        <JudgeLoginForm />
      )}
    </FotorankDialogShell>
  );
}
