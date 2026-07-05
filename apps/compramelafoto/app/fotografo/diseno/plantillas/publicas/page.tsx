"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type PublicTemplate = {
  id: string;
  name: string;
  description: string | null;
  author: { id: number; name: string | null; email: string } | null;
  publication: { reviewStatus: string; visibility: string; publishedAt: string | null } | null;
  thumbnailUrl: string | null;
};

export default function PlantillasPublicasV2Page() {
  const router = useRouter();
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/template-v2/public", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error"))))
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-[#1a1a1a] mb-1">Plantillas públicas</h1>
      <p className="text-sm text-[#6b7280] mb-6">
        Plantillas aprobadas por admin. Podés clonarlas a tu cuenta para editarlas como propias.
      </p>

      {message ? (
        <Card className="p-3 mb-4">
          <p className="text-sm text-[#374151]">{message}</p>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando…</p>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[#6b7280]">No hay plantillas públicas disponibles.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id}>
              <Card className="p-4">
                <p className="font-medium text-[#1a1a1a]">{t.name}</p>
                {t.description ? <p className="text-sm text-[#6b7280] mt-1">{t.description}</p> : null}
                <p className="text-xs text-[#6b7280] mt-2">
                  Autor: {t.author?.name?.trim() || t.author?.email || "—"}
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={cloningId === t.id}
                    onClick={async () => {
                      setCloningId(t.id);
                      setMessage(null);
                      try {
                        const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(t.id)}/clone`, {
                          method: "POST",
                          credentials: "include",
                        });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.ok && data.templateId && data.versionId) {
                          router.push(
                            `/fotografo/diseno/plantillas/v2/${encodeURIComponent(data.templateId)}/${encodeURIComponent(data.versionId)}`
                          );
                          return;
                        }
                        setMessage(data?.error || "No se pudo clonar.");
                      } catch {
                        setMessage("Error de red al clonar.");
                      } finally {
                        setCloningId(null);
                      }
                    }}
                  >
                    {cloningId === t.id ? "Clonando..." : "Clonar"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
