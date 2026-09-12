import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "full",
  timeStyle: "short",
});

type Props = { params: Promise<{ id: string }> };

export default async function DetalleEvento({ params }: Props) {
  const { id } = await params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}`)}`);

  const evento = await prisma.subilafotoEvent.findFirst({
    // El filtro por dueño va en el where, no en un if después de leer: así un evento
    // ajeno directamente no se trae de la base.
    where: { id, sellerProfile: { userId: usuario.id } },
    select: {
      name: true,
      code: true,
      screenCode: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      timezone: true,
      venueName: true,
    },
  });

  if (!evento) notFound();

  const enZona = (fecha: Date | null) =>
    fecha
      ? new Intl.DateTimeFormat("es-AR", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: evento.timezone,
        }).format(fecha)
      : "sin definir";

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-extrabold" style={{ color: "var(--slf-violeta)" }}>
        En configuración
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight">{evento.name}</h1>
      {evento.venueName ? (
        <p className="mt-2" style={{ color: "var(--slf-tinta-suave)" }}>
          {evento.venueName}
        </p>
      ) : null}

      <dl className="mt-10 space-y-6">
        <div>
          <dt className="text-sm font-extrabold">Abre</dt>
          <dd style={{ color: "var(--slf-tinta-suave)" }}>{enZona(evento.activationAt)}</dd>
        </div>
        <div>
          <dt className="text-sm font-extrabold">Cierra</dt>
          <dd style={{ color: "var(--slf-tinta-suave)" }}>{enZona(evento.deactivationAt)}</dd>
        </div>
      </dl>

      <section
        className="mt-10 rounded-2xl p-7"
        style={{ background: "var(--slf-purpura)", color: "white" }}
      >
        <p className="text-sm" style={{ color: "var(--slf-lila)" }}>
          Código para los invitados
        </p>
        <p className="mt-1 font-extrabold tracking-[0.2em]" style={{ fontSize: "2.5rem" }}>
          {evento.code}
        </p>
        <p className="mt-6 text-sm" style={{ color: "var(--slf-lila)" }}>
          El QR y los materiales para imprimir se generan en el próximo paso.
        </p>
      </section>

      <p className="mt-8 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
        El código de la pantalla es distinto y no se comparte con los invitados.
      </p>
    </main>
  );
}
