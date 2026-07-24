import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma, Role } from "@/lib/prisma";
import { markDeliveryRead } from "@/lib/notifications/tracking";

export const dynamic = "force-dynamic";

export default async function PhotographerNotificationsPage() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) redirect("/login?next=/fotografo/notificaciones");

  const items = await prisma.dashboardNotification.findMany({
    where: {
      userId: user.id,
      type: { in: ["DNX_NEARBY_PHOTOGRAPHER_CALL", "EVENT_INVITATION"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  async function markReadAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (!Number.isFinite(id)) return;
    const { user: u } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (!u) return;
    await prisma.dashboardNotification.updateMany({
      where: { id, userId: u.id, readAt: null },
      data: { readAt: new Date() },
    });
    await markDeliveryRead({ dashboardNotificationId: id, userId: u.id });
    redirect("/fotografo/notificaciones");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notificaciones</h1>
          <p className="mt-2 text-sm text-[#5a5a5a]">
            Convocatorias y avisos del panel.{" "}
            <Link
              href="/fotografo/configuracion/notificaciones"
              className="font-semibold text-[#c27b3d] hover:underline"
            >
              Preferencias
            </Link>
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#ddd] px-6 py-10 text-center text-sm text-[#8a8a8a]">
          No hay notificaciones todavía.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border px-5 py-4 ${
                n.readAt ? "border-[#eee] bg-[#fafafa]" : "border-[#e8e4df] bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-[#8a8a8a]">{n.type}</p>
                  <h2 className="mt-1 font-semibold text-[#1a1a1a]">{n.title}</h2>
                  {n.body ? (
                    <p className="mt-2 text-sm leading-relaxed text-[#5a5a5a]">{n.body}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-[#8a8a8a]">
                    {n.createdAt.toLocaleString("es-AR")}
                    {n.readAt ? " · Leída" : " · Sin leer"}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {n.link ? (
                    <a
                      href={n.link}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#c27b3d] px-3 text-sm font-semibold text-white"
                    >
                      Abrir
                    </a>
                  ) : null}
                  {!n.readAt ? (
                    <form action={markReadAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#ddd] px-3 text-sm font-medium"
                      >
                        Marcar leída
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
