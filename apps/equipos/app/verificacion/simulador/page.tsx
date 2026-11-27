import { notFound, redirect } from "next/navigation";
import { POST as webhook } from "@/app/api/identidad/webhook/route";
import { signBody, simuladorPermitido } from "@/lib/identidad/proveedor-simulado";

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
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1>Simulador de verificación (sólo desarrollo)</h1>
      <form action={enviarResultado}>
        <input type="hidden" name="ref" value={ref} />
        <input type="hidden" name="returnUrl" value={returnUrl} />
        <p>
          <label>
            Resultado{" "}
            <select name="outcome" defaultValue="approved">
              <option value="approved">Aprobado</option>
              <option value="rejected">Rechazado</option>
              <option value="review">En revisión</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            DNI <input name="documentNumber" placeholder="12345678" />
          </label>
        </p>
        <p>
          <label>
            Nombre legal <input name="legalName" placeholder="Ana Pérez" />
          </label>
        </p>
        <p>
          <label>
            Motivo (si se rechaza) <input name="reason" />
          </label>
        </p>
        <button type="submit">Enviar resultado</button>
      </form>
    </main>
  );
}
