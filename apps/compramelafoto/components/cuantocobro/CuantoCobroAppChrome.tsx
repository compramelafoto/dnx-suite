"use client";

import CuantoCobroLogo from "@/components/cuantocobro/CuantoCobroLogo";
import {
  BusinessProfileProvider,
  useCuantoCobroBusinessProfile,
} from "@/components/cuantocobro/BusinessProfileContext";
import {
  PhotographerVisualIdentityProvider,
} from "@/components/cuantocobro/PhotographerVisualIdentityContext";
import PhotographerWorkLocationPromptGate from "@/components/photographer/PhotographerWorkLocationPromptGate";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { CC_APP_PATH, CC_COTIZAR_PATH } from "@/lib/cuantocobro/constants";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionUser = {
  id: number;
  email: string;
  name: string | null;
};

function CuantoCobroAppNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  const links = [
    {
      href: CC_APP_PATH,
      label: "Inicio",
      match: (p: string) => p === CC_APP_PATH,
    },
    {
      href: CC_COTIZAR_PATH,
      label: "Cotizar",
      match: (p: string) => p === CC_COTIZAR_PATH || p.startsWith(`${CC_COTIZAR_PATH}/`),
    },
    {
      href: "/cuantocobro/app/consultas",
      label: "Consultas",
      match: (p: string) => p.startsWith("/cuantocobro/app/consultas"),
    },
    {
      href: "/cuantocobro/app/presupuestos",
      label: "Presupuestos",
      match: (p: string) => p.startsWith("/cuantocobro/app/presupuestos"),
    },
  ];

  return (
    <nav
      className={mobile ? "cc-app-nav cc-app-nav--mobile" : "cc-app-nav hidden lg:flex"}
      aria-label="Secciones de ¿Cuánto Cobro?"
    >
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "cc-app-nav__link cc-app-nav__link--active" : "cc-app-nav__link"}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function CuantoCobroAppHeader({ user }: { user: SessionUser | null }) {
  const router = useRouter();
  const { openBusinessProfileModal } = useCuantoCobroBusinessProfile();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/cuantocobro");
    router.refresh();
  }

  return (
    <header className="cc-app-header">
      <div className="container-custom cc-app-header__inner">
        <div className="cc-app-header__brand-row">
          <CuantoCobroLogo variant="header" href={CC_APP_PATH} />
          <CuantoCobroAppNav />
        </div>
        <div className="cc-app-header__actions">
          <CuantoCobroButton
            type="button"
            variant="outline"
            className="min-h-[44px] w-full sm:w-auto"
            onClick={() => openBusinessProfileModal()}
          >
            Configurar perfil
          </CuantoCobroButton>
          {user ? (
            <span className="cc-app-header__user hidden sm:inline" title={user.email}>
              {user.name || user.email}
            </span>
          ) : null}
          <Link href="/cuantocobro" className="cc-app-header__link">
            Inicio
          </Link>
          <CuantoCobroButton
            type="button"
            variant="secondary"
            className="min-h-[44px]"
            onClick={handleLogout}
          >
            Salir
          </CuantoCobroButton>
        </div>
      </div>
      <div className="cc-app-header__mobile-nav container-custom lg:hidden">
        <CuantoCobroAppNav mobile />
      </div>
    </header>
  );
}

function CuantoCobroAppShell({ children, user }: { children: React.ReactNode; user: SessionUser | null }) {
  const { openBusinessProfileModal } = useCuantoCobroBusinessProfile();

  return (
    <div className="cc-app-shell min-h-dvh flex flex-col">
      <CuantoCobroAppHeader user={user} />

      <main className="cc-app-main flex flex-1 flex-col min-h-0">{children}</main>

      <footer className="cc-public-footer cc-public-footer--app">
        <div className="container-custom cc-public-footer__inner">
          <p className="cc-public-footer__text m-0">
            ¿Cuánto Cobro? · Una herramienta de{" "}
            <Link href="/" className="cc-public-footer__link">
              ComprameLaFoto
            </Link>
          </p>
        </div>
      </footer>

      <PhotographerWorkLocationPromptGate
        variant="cuantocobro"
        onOpenBusinessProfile={() => openBusinessProfileModal({ highlightSection: "address" })}
      />
    </div>
  );
}

export default function CuantoCobroAppChrome({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.user) setUser(data.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PhotographerVisualIdentityProvider>
      <BusinessProfileProvider>
        <CuantoCobroAppShell user={user}>{children}</CuantoCobroAppShell>
      </BusinessProfileProvider>
    </PhotographerVisualIdentityProvider>
  );
}
