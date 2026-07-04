"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

type School = {
  id: number;
  name: string;
  slug: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  coursesCount: number;
  albumsCount: number;
};

export default function FotografoEscuelasPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [photographer, setPhotographer] = useState<any>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setPhotographer(data))
        .catch(() => {});
      try {
        const res = await fetch("/api/fotografo/schools", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (active) setSchools(Array.isArray(data) ? data : []);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading && schools.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando escuelas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <div className="container-custom py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Escuelas
              </h1>
              <p className="text-gray-600">
                Gestioná escuelas, cursos y álbumes escolares para fotografía escolar
              </p>
            </div>
            <Link href="/fotografo/escuelas/nueva">
              <Button variant="primary">Nueva escuela</Button>
            </Link>
          </div>

          {schools.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600 mb-4">
                Aún no tenés escuelas cargadas. Creá una para empezar con fotografía escolar.
              </p>
              <Link href="/fotografo/escuelas/nueva">
                <Button variant="primary">Crear primera escuela</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid gap-4">
              {schools.map((s) => (
                <Card key={s.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-gray-900">{s.name}</h2>
                      {(s.contactEmail || s.contactPhone) && (
                        <p className="text-sm text-gray-600 mt-1">
                          {[s.contactEmail, s.contactPhone].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {s.coursesCount} curso{s.coursesCount !== 1 ? "s" : ""} · {s.albumsCount} álbum{s.albumsCount !== 1 ? "es" : ""} vinculado{s.albumsCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/fotografo/escuelas/${s.id}`}>
                        <Button variant="secondary">Ver / Editar</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
