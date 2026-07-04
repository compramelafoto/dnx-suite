"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Organizer = {
  organizerId: number;
  name?: string | null;
  email?: string | null;
};

export default function OrganizerHeader({ organizer }: { organizer: Organizer | null }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    sessionStorage.removeItem("organizer");
    sessionStorage.removeItem("organizerId");
    router.push("/");
    window.location.href = "/";
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/organizador/dashboard" className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700">
          <span className="flex-shrink-0" title="Ir al panel">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </span>
          Panel Organizador
        </Link>
        <div className="flex items-center gap-4">
          {organizer?.name && (
            <span className="text-sm text-gray-600 hidden sm:inline">{organizer.name}</span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
