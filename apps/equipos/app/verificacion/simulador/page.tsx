import { notFound, redirect } from "next/navigation";
import { POST as webhook } from "@/app/api/identidad/webhook/route";
import { signBody, simuladorPermitido } from "@/lib/identidad/proveedor-simulado";
import { Boton, Campo, Pagina } from "@/app/_ui";

export const dynamic = "force-dynamic";

function habilitado(): boolean {
  return simuladorPermitido();
}

async function enviarResultado(formData: FormData) {
  "use server";
  if (!habilitado()) notFound();
  const secret = process.env.IDENTITY_WEBHOOK_SECRET;
  if (!secret) throw new Error("Falta IDENTITY_WEBHOOK_SECRET");

  const body = JSON.stringify({
    providerRef: String(formData.get("ref") ?? ""),
    outcome: String(formData.get("outcome") ?? "review"),
    documentNumber: String(formData.get("documentNumber") ?? "") || undefined,
    legalName: String(formData.get("legalName") ?? "") || undefined,
    reason: String(formData.get("reason") ?? "") || undefined,
  });
  // Pasa por el mismo webhook que usaría un proveedor real (firma incluida).
  await webhook(
    new Request("http://localhost/api/identidad/webhook", {
      method: "POST",
      body,
      headers: { "x-signature": signBody(body, secret) },
    }),
  );
  redirect(String(formData.get("returnUrl") || "/verificacion"));
}

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; returnUrl?: string }>;
}) {
  if (!habilitado()) notFound();
  const { ref = "", returnUrl = "/verificacion" } = await searchParams;

  return (
    <Pagina
      titulo="Simulador de verificación"
      bajada="Sólo en desarrollo: reemplaza al proveedor externo y manda el resultado al mismo webhook."
    >
      <form action={enviarResultado} className="superficie formulario">
        <input type="hidden" name="ref" value={ref} />
        <input type="hidden" name="returnUrl" value={returnUrl} />
        <Campo etiqueta="Resultado">
          <select className="control" name="outcome" defaultValue="approved">
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
            <option value="review">En revisión</option>
          </select>
        </Campo>
        <Campo etiqueta="DNI">
          <input className="control" name="documentNumber" placeholder="12345678" inputMode="numeric" />
        </Campo>
        <Campo etiqueta="Nombre legal">
          <input className="control" name="legalName" placeholder="Ana Pérez" />
        </Campo>
        <Campo etiqueta="Motivo" ayuda="Sólo si el resultado es «Rechazado».">
          <input className="control" name="reason" />
        </Campo>
        <div className="acciones">
          <Boton>Enviar resultado</Boton>
        </div>
      </form>
    </Pagina>
  );
}
