"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SchoolOrganizerHeader from "@/components/school-organizer/SchoolOrganizerHeader";
import { ensureSchoolOrganizerSession } from "@/lib/school-organizer-session-client";

type SchoolRow = {
  membershipId: string;
  id: number;
  name: string;
  city: string | null;
  province: string | null;
  logoUrl: string | null;
  albumsCount: number;
};

export default function EscuelaHomePage() {
  const router = useRouter();
  const [session, setSession] = useState<{
    userId: number;
    name?: string | null;
    email?: string | null;
  } | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      const s = await ensureSchoolOrganizerSession();
      if (!active) return;
      if (!s) {
        router.push("/login");
        return;
      }
      setSession(s);
      try {
        const res = await fetch("/api/school-organizer/schools", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar tus escuelas");
        }
        setSchools(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar tus escuelas");
      } finally {
        setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SchoolOrganizerHeader organizer={session} />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mis escuelas</h1>
          <p className="text-sm text-gray-600">Acceso operativo de solo lectura para escuelas asignadas.</p>
        </div>

        {error ? (
          <Card className="p-4">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        ) : null}

        {loading ? (
          <Card className="p-6">
            <p className="text-sm text-gray-600">Cargando escuelas...</p>
          </Card>
        ) : schools.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-gray-600">
              Todavía no tenés escuelas asignadas. Pedí a un administrador que te asigne acceso.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {schools.map((school) => (
              <Card key={school.membershipId} className="p-4">
                <div className="flex items-start gap-3">
                  {school.logoUrl ? (
                    <div className="h-14 w-14 overflow-hidden rounded-lg border border-gray-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={school.logoUrl} alt="" className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-14 w-14 rounded-lg border border-gray-200 bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-semibold leading-snug text-gray-900">{school.name}</h2>
                    <p className="text-sm text-gray-600">
                      {[school.city, school.province].filter(Boolean).join(", ") || "Sin localidad"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {school.albumsCount} álbum{school.albumsCount === 1 ? "" : "es"}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link href={`/escuela/${school.id}`}>
                    <Button variant="primary">
                      Ver escuela
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
