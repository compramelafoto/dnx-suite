import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { qrDelEvento } from "@/lib/qr";
import { urlDelCodigo } from "@/lib/url-invitado";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3012"
  );
}

export default async function QrDelEvento({ params }: Props) {
  const { id } = await params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}/qr`)}`);

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id, sellerProfile: { userId: usuario.id } },
    select: { name: true, code: true },
  });
  if (!evento) notFound();

  const url = urlDelCodigo(baseUrl(), evento.code);
  const svg = await qrDelEvento(url);

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-extrabold leading-tight">Código QR</h1>
      <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
        {evento.name}
      </p>

      <div
        className="mt-10 flex flex-col items-center rounded-2xl border p-8"
        style={{ borderColor: "var(--slf-borde)", background: "white" }}
      >
        {/* El SVG viene de nuestro propio generador, no de datos de nadie. */}
        <div className="w-[min(18rem,70vw)]" dangerouslySetInnerHTML={{ __html: svg }} />

        <p className="mt-6 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Si la cámara no lo toma, entrá a
        </p>
        <p className="mt-1 font-extrabold">{url.replace(/^https?:\/\//, "")}</p>
      </div>

      <div
        className="mt-8 rounded-xl px-5 py-4 text-sm"
        style={{ background: "var(--slf-purpura)", color: "var(--slf-lila)" }}
      >
        Debajo del QR va siempre el código escrito. Alguien va a tener el teléfono sin
        cámara, sin batería o sin paciencia, y tiene que poder entrar igual.
      </div>

      <p className="mt-8 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
        Los centros de mesa y los carteles para imprimir, con tu logo, se generan en el
        próximo paso.
      </p>
    </main>
  );
}
