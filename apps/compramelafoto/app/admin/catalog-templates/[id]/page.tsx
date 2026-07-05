"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AdminCatalogTemplateForm from "@/components/admin/catalog-templates/AdminCatalogTemplateForm";
import AdminCatalogTemplateShell from "@/components/admin/catalog-templates/AdminCatalogTemplateShell";
import { AdminCatalogTemplateGridSkeleton } from "@/components/admin/catalog-templates/AdminCatalogTemplateListCard";
import type { AdminCatalogTemplateDetail } from "@/lib/catalog-templates/admin-serialize";

type PageProps = { params: Promise<{ id: string }> };

export default function AdminCatalogTemplateEditPage({ params }: PageProps) {
  const [template, setTemplate] = useState<AdminCatalogTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/catalog-templates/${id}`, { credentials: "include" });
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setTemplate(data.template ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <AdminCatalogTemplateShell
        breadcrumbs={[{ label: "Templates del sistema", href: "/admin/catalog-templates" }]}
        title="Cargando…"
      >
        <AdminCatalogTemplateGridSkeleton count={1} />
      </AdminCatalogTemplateShell>
    );
  }

  if (notFound || !template) {
    return (
      <AdminCatalogTemplateShell
        breadcrumbs={[{ label: "Templates del sistema", href: "/admin/catalog-templates" }]}
        title="Template no encontrado"
        subtitle="El ID no existe o fue eliminado."
        actions={
          <Link href="/admin/catalog-templates">
            <Button variant="secondary">Volver al listado</Button>
          </Link>
        }
      >
        <span className="sr-only">No encontrado</span>
      </AdminCatalogTemplateShell>
    );
  }

  return (
    <AdminCatalogTemplateShell
      breadcrumbs={[
        { label: "Templates del sistema", href: "/admin/catalog-templates" },
        { label: template.name },
      ]}
      title={template.name}
      subtitle={
        <span className="font-mono text-xs text-[#9ca3af]">{template.slug}</span>
      }
    >
      <AdminCatalogTemplateForm mode="edit" initial={template} />
    </AdminCatalogTemplateShell>
  );
}
