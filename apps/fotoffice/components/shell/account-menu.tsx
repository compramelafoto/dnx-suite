"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Building2, Camera, Check, LogOut, Plus } from "lucide-react";
import { fotofficeLogoutAction } from "@/app/actions/auth";
import { chooseInstitutionAction, createOwnBusinessAction } from "@/app/actions/profile-choice";
import { switchToAdminAction, switchToPortalAction } from "@/app/actions/profile-choice";
import type { AccountMenu as AccountMenuData, RoleSelector as RoleSelectorData } from "@/lib/portal/profiles";

/**
 * El menú de la cuenta, colgado de la foto de perfil. El mismo en el panel y en el portal.
 *
 * Reemplaza tres controles que estaban repartidos y hacían cosas parecidas: los botones
 * "Ir a …" sueltos bajo el nombre de la institución, el botón redondo "Cambiar de perfil" que
 * mandaba de vuelta al selector de entrada, y el "Salir". Que vivan juntos importa: cambiar de
 * empresa y cambiar de rol son las dos preguntas que uno se hace mirando su propia foto, y
 * antes una estaba a la izquierda, la otra al costado, y en el portal no estaba ninguna.
 *
 * Son dos preguntas distintas y van separadas a propósito: *¿en qué empresa estoy?* arriba,
 * *¿con qué sombrero?* abajo. Mezcladas en una sola lista plana, nadie entiende qué elige.
 */
export function AccountMenu({
  userName,
  userEmail,
  userAvatarUrl,
  menu,
  roleSelector,
}: {
  userName: string | null;
  userEmail: string;
  userAvatarUrl: string | null;
  menu: AccountMenuData;
  /** El rol dentro de la institución activa, cuando la persona tiene los dos perfiles. */
  roleSelector: RoleSelectorData | null;
}) {
  const [open, setOpen] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const nombre = userName || userEmail;
  const iniciales = nombre
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  // Cerrar al apretar Escape o al tocar fuera. Sin esto, en el teléfono el menú tapa el
  // contenido y la única salida es recargar.
  useEffect(() => {
    if (!open) return;
    const alTocarFuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setOpen(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", alTocarFuera);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alTocarFuera);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [open]);

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        aria-label="Tu cuenta y tus espacios"
        className="flex items-center gap-2 rounded-full border border-transparent p-0.5 transition-colors hover:border-[var(--fo-border)]"
      >
        {userAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- la foto vive en R2
          <img
            src={userAvatarUrl}
            alt=""
            className="size-10 shrink-0 rounded-full border border-[var(--fo-border)] object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--fo-accent-soft)] text-sm font-semibold text-[var(--fo-accent-hover)]"
          >
            {iniciales || "·"}
          </span>
        )}
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] shadow-lg"
        >
          <div className="border-b border-[var(--fo-border)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[var(--fo-text)]">{nombre}</p>
            <p className="truncate text-xs text-[var(--fo-muted)]">{userEmail}</p>
          </div>

          {menu.places.length > 0 ? (
            <div className="border-b border-[var(--fo-border)] py-2">
              <p className="px-4 pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fo-muted-soft)]">
                Tus espacios
              </p>
              {menu.places.map((place) => (
                <form key={place.workspaceId} action={chooseInstitutionAction}>
                  <input type="hidden" name="workspaceId" value={place.workspaceId} />
                  <button
                    type="submit"
                    role="menuitem"
                    aria-current={place.active ? "true" : undefined}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[var(--fo-surface-hover)]"
                  >
                    {place.ownBusiness ? (
                      <Camera className="size-4 shrink-0 text-[var(--fo-muted)]" aria-hidden />
                    ) : (
                      <Building2 className="size-4 shrink-0 text-[var(--fo-muted)]" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--fo-text)]">
                        {place.name}
                      </span>
                      <span className="block truncate text-xs text-[var(--fo-muted)]">
                        {detalle(place)}
                      </span>
                    </span>
                    {place.active ? (
                      <Check className="size-4 shrink-0 text-[var(--fo-accent)]" aria-hidden />
                    ) : null}
                  </button>
                </form>
              ))}
            </div>
          ) : null}

          {roleSelector ? (
            <div className="border-b border-[var(--fo-border)] px-4 py-3">
              <p className="pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fo-muted-soft)]">
                Tu rol acá
              </p>
              <div className="flex gap-1 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg)] p-1">
                {roleSelector.options.map((option) => {
                  const base =
                    "flex min-h-9 w-full min-w-0 items-center justify-center rounded-[var(--fo-radius-sm)] px-2 py-1 text-center text-xs font-semibold leading-tight break-words transition-colors";
                  if (option.active) {
                    return (
                      <span
                        key={option.kind}
                        aria-current="page"
                        className={`${base} flex-1 bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]`}
                      >
                        {option.label}
                      </span>
                    );
                  }
                  return (
                    <form
                      key={option.kind}
                      action={option.kind === "TEAM" ? switchToAdminAction : switchToPortalAction}
                      className="flex min-w-0 flex-1"
                    >
                      <input type="hidden" name="workspaceId" value={roleSelector.workspaceId} />
                      <button
                        type="submit"
                        role="menuitem"
                        className={`${base} text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]`}
                      >
                        {option.label}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          ) : null}

          {menu.canCreateBusiness ? (
            <form action={createOwnBusinessAction} className="border-b border-[var(--fo-border)]">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--fo-surface-hover)]"
              >
                <Plus className="size-4 shrink-0 text-[var(--fo-muted)]" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--fo-text)]">
                    Crear mi negocio
                  </span>
                  <span className="block text-xs text-[var(--fo-muted)]">
                    Administrá tu estudio con FotoOffice.
                  </span>
                </span>
              </button>
            </form>
          ) : null}

          <form action={fotofficeLogoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--fo-muted)] transition-colors hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-danger)]"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/**
 * La línea chica de cada espacio.
 *
 * Muestra el número de socio sin la palabra ("N° 556" y no "Socio N° 556") a propósito: la
 * palabra la define el vocabulario de CADA institución, y cargar todos los vocabularios para
 * dibujar un desplegable costaría una consulta por institución sin agregar claridad — el
 * número al lado del nombre de la sociedad ya se entiende.
 */
function detalle(place: {
  ownBusiness: boolean;
  memberNumber: string | null;
  isTeam: boolean;
}): string {
  if (place.ownBusiness) return "Tu negocio";
  if (place.memberNumber) return `N° ${place.memberNumber}`;
  if (place.isTeam) return "Comisión Directiva";
  return "Institución";
}
