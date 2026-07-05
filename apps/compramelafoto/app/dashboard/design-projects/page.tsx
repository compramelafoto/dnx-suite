"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { labelDesignProjectStatus } from "@/lib/preventa-canjeable/preventa-status-labels";
import { isPreventaUxV2EnabledClient } from "@/lib/preventa-canjeable/preventa-ux-v2-feature-flag";

type Row = {
  id: number;
  status: string;
  orderItemId: number;
  createdAt: string;
  updatedAt: string;
  albumId: number;
  albumTitle: string;
  albumSlug: string;
  schoolId: number | null;
  schoolName: string | null;
  schoolCourseId: number | null;
  schoolCourseName: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
};

function formatStudent(first: string | null, last: string | null): string {
  const f = first?.trim() || "";
  const l = last?.trim() || "";
  if (!f && !l) return "Sin alumno";
  return [f, l].filter(Boolean).join(" ");
}

function formatAlbum(row: Row): string {
  const t = row.albumTitle?.trim();
  if (t) return t;
  const s = row.albumSlug?.trim();
  if (s) return s;
  return `#${row.albumId}`;
}

export default function DesignProjectsListPage() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const uxV2 = isPreventaUxV2EnabledClient();

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/design-projects", { credentials: "include" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!active) return;
        if (!ok) {
          setError(data?.error || "Error al cargar");
          setProjects([]);
          return;
        }
        setProjects(Array.isArray(data?.projects) ? data.projects : []);
      })
      .catch(() => {
        if (active) setError("Error de red");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="p-6 text-sm text-gray-600">Cargando…</p>;
  }

  if (error) {
    return <p className="p-6 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/fotografo/escuelas" className="text-[#c27b3d] hover:underline text-sm">
          ← Volver a Escolar
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 mt-2 mb-1">Diseño escolar</h1>
        <p className="text-sm text-gray-600 m-0">Revisiones y aprobaciones de diseños para pedidos escolares.</p>
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-gray-600">
          {uxV2
            ? "Cuando haya pedidos de preventa escolar con diseño pendiente, aparecerán acá."
            : "No hay proyectos de diseño."}
        </p>
      ) : (
        <table className="min-w-full text-left text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 border-b">Proyecto</th>
              <th className="px-3 py-2 border-b">Estado</th>
              <th className="px-3 py-2 border-b">Alumno</th>
              <th className="px-3 py-2 border-b">Escuela</th>
              <th className="px-3 py-2 border-b">Curso</th>
              <th className="px-3 py-2 border-b">Álbum</th>
              <th className="px-3 py-2 border-b">Actualizado</th>
              <th className="px-3 py-2 border-b">Acción</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const escuela =
                p.schoolName != null && String(p.schoolName).trim() !== "" ? p.schoolName : "No escolar";
              const curso =
                p.schoolCourseName != null && String(p.schoolCourseName).trim() !== ""
                  ? p.schoolCourseName
                  : "-";
              return (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="px-3 py-2">{p.id}</td>
                  <td className="px-3 py-2 text-xs">
                    {uxV2 ? labelDesignProjectStatus(p.status) : (
                      <span className="font-mono">{p.status}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatStudent(p.studentFirstName, p.studentLastName)}</td>
                  <td className="px-3 py-2">{escuela}</td>
                  <td className="px-3 py-2">{curso}</td>
                  <td className="px-3 py-2">{formatAlbum(p)}</td>
                  <td className="px-3 py-2">{new Date(p.updatedAt).toLocaleString("es-AR")}</td>
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/design-projects/${p.id}`} className="text-[#c27b3d] hover:underline">
                      Abrir
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
