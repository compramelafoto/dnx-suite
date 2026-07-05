"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type SchoolOrganizer = {
  userId: number;
  name?: string | null;
  email?: string | null;
} | null;

export default function SchoolOrganizerHeader({ organizer }: { organizer: SchoolOrganizer }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // noop
    }
    sessionStorage.removeItem("schoolOrganizer");
    sessionStorage.removeItem("schoolOrganizerId");
    router.push("/login");
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/escuela" className="min-w-0 shrink text-lg font-semibold leading-snug break-words text-gray-900 hover:text-gray-700">
          Panel Escuela
        </Link>
        <div className="flex items-center gap-3">
          {organizer?.name ? (
            <span className="hidden max-w-[min(18rem,45vw)] text-right text-sm leading-snug break-words text-gray-600 sm:inline">{organizer.name}</span>
          ) : null}
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
