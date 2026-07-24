import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma, Role } from "@/lib/prisma";
import { saveNotificationPreferencesAction } from "@/app/actions/notification-preferences";

export const dynamic = "force-dynamic";

export default async function NotificationPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) redirect("/login?next=/fotografo/configuracion/notificaciones");

  const q = await searchParams;
  const pref = await prisma.dnxNotificationPreference.findUnique({
    where: { userId: user.id },
  });
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { city: true, province: true, latitude: true, longitude: true },
  });

  const nearby = pref?.nearbyPhotographerCalls ?? true;
  const channelInApp = pref?.channelInApp ?? true;
  const channelEmail = pref?.channelEmail ?? false;
  const scopeMode = pref?.preferredScopeMode ?? "RADIUS_KM";
  const radiusKm = pref?.preferredRadiusKm ?? 50;
  const useProfile = pref?.useProfileLocation ?? true;
  const hasLocation =
    (profile?.city && profile.city.trim()) ||
    (profile?.latitude != null && profile?.longitude != null);

  async function saveAction(formData: FormData) {
    "use server";
    const result = await saveNotificationPreferencesAction(formData);
    if (!result.ok) {
      redirect(
        `/fotografo/configuracion/notificaciones?error=${encodeURIComponent(result.error)}`,
      );
    }
    redirect("/fotografo/configuracion/notificaciones?ok=1");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 md:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d]">
          Configuración
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1a1a1a]">
          Preferencias de notificaciones
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5a5a5a]">
          Tu ubicación exacta no se muestra a los organizadores. Se utiliza únicamente para
          decidir si una convocatoria se encuentra dentro de tu zona.
        </p>
      </div>

      {q.ok ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Preferencias guardadas.
        </p>
      ) : null}
      {q.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {q.error}
        </p>
      ) : null}

      <section className="rounded-xl border border-[#e8e4df] bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold">Estado de ubicación</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[#8a8a8a]">Ciudad</dt>
            <dd className="font-medium">{profile?.city || "Sin ciudad"}</dd>
          </div>
          <div>
            <dt className="text-[#8a8a8a]">Provincia</dt>
            <dd className="font-medium">{profile?.province || "Sin provincia"}</dd>
          </div>
          <div>
            <dt className="text-[#8a8a8a]">Origen</dt>
            <dd className="font-medium">Perfil de fotógrafo</dd>
          </div>
          <div>
            <dt className="text-[#8a8a8a]">Completitud</dt>
            <dd className="font-medium">
              {hasLocation ? "Ubicación disponible" : "Ubicación incompleta"}
            </dd>
          </div>
        </dl>
        <Link
          href="/fotografo/configuracion?tab=datos"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[#c27b3d] hover:underline"
        >
          Editar ubicación del perfil
        </Link>
      </section>

      <form action={saveAction} className="rounded-xl border border-[#e8e4df] bg-white p-6 space-y-6">
        <h2 className="text-base font-semibold">Convocatorias cercanas</h2>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="nearbyPhotographerCalls"
            defaultChecked={nearby}
            className="mt-1 size-4"
          />
          <span>
            <span className="font-semibold">Recibir convocatorias de fotógrafos cercanas</span>
            <span className="mt-1 block text-[#5a5a5a]">
              Avisos cuando un editor autorizado publica una convocatoria en tu zona.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="channelInApp"
            defaultChecked={channelInApp}
            className="mt-1 size-4"
          />
          <span>
            <span className="font-semibold">Notificación en el panel (IN_APP)</span>
            <span className="mt-1 block text-[#5a5a5a]">
              Aparece en tu bandeja de ComprameLaFoto.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="channelEmail"
            defaultChecked={channelEmail}
            className="mt-1 size-4"
          />
          <span>
            <span className="font-semibold">Email</span>
            <span className="mt-1 block text-[#5a5a5a]">
              Requiere activación explícita. No se habilita por defecto.
            </span>
          </span>
        </label>

        <label className="block text-sm">
          <span className="font-medium">Alcance preferido</span>
          <select
            name="preferredScopeMode"
            defaultValue={scopeMode}
            className="mt-2 min-h-11 w-full rounded-lg border border-[#ddd] px-3"
          >
            <option value="RADIUS_KM">Radio (km)</option>
            <option value="CITY">Toda la ciudad</option>
            <option value="PROVINCE">Toda la provincia</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium">Radio preferido</span>
          <select
            name="preferredRadiusKm"
            defaultValue={radiusKm}
            className="mt-2 min-h-11 w-full rounded-lg border border-[#ddd] px-3"
          >
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
          </select>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="useProfileLocation"
            value="on"
            defaultChecked={useProfile}
            className="mt-1 size-4"
          />
          <span>Usar ubicación del perfil</span>
        </label>

        <label className="block text-sm">
          <span className="font-medium">Ciudad manual (si no usás el perfil)</span>
          <input
            name="manualCity"
            defaultValue={pref?.manualCity ?? ""}
            className="mt-2 min-h-11 w-full rounded-lg border border-[#ddd] px-3"
            placeholder="Ej. Rosario"
          />
        </label>

        <p className="text-xs text-[#8a8a8a]">
          Frecuencia inmediata ahora; resumen (digest) queda preparado para una etapa futura.
        </p>

        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-lg bg-[#c27b3d] px-5 text-sm font-semibold text-white"
        >
          Guardar preferencias
        </button>
      </form>

      <p className="text-sm">
        <Link href="/fotografo/notificaciones" className="font-semibold text-[#c27b3d] hover:underline">
          Ver bandeja de notificaciones
        </Link>
      </p>
    </div>
  );
}
