"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Accion = "preparar" | "reiniciar" | "analizar" | "entrar";

const ACCIONES: Array<{ id: Accion; etiqueta: string; ayuda: string; variant: "primary" | "outline" }> = [
  {
    id: "preparar",
    etiqueta: "Preparar",
    ayuda: "Crea lo que falte: fotógrafo, colegio, cursos, alumnos, álbum, packs, plantilla y fotos. Si quedan fotos por subir, tocalo otra vez.",
    variant: "outline",
  },
  {
    id: "analizar",
    etiqueta: "Analizar fotos ahora",
    ayuda: "Corre el reconocimiento facial del álbum demo sin esperar al proceso automático (cada 2 minutos).",
    variant: "outline",
  },
  {
    id: "reiniciar",
    etiqueta: "Reiniciar",
    ayuda: "Borra pedidos, pagos simulados, canjes, diseños, comisiones y consultas de la demo. Conserva plantillas, fotos, colegio y alumnos.",
    variant: "outline",
  },
  {
    id: "entrar",
    etiqueta: "Entrar a la demo",
    ayuda: "Entrás como el fotógrafo demo, con el cuadro guía abajo a la izquierda. Para volver, «Salir de la demo» en el cuadro.",
    variant: "primary",
  },
];

export default function DemosClient({ preparada, albumSlug }: { preparada: boolean; albumSlug: string | null }) {
  const [enCurso, setEnCurso] = useState<Accion | null>(null);
  const [lista, setLista] = useState(preparada);
  const [slug, setSlug] = useState(albumSlug);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(accion: Accion) {
    if (accion === "reiniciar" && !window.confirm("¿Reiniciar la demo escolar? Se borran los pedidos y canjes de prueba.")) {
      return;
    }
    setEnCurso(accion);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch(`/api/admin/demos/escolar/${accion}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo completar.");
      if (accion === "entrar") {
        try {
          window.sessionStorage.clear();
        } catch {}
        window.location.href = data.destino || "/fotografo/escuelas";
        return;
      }
      if (accion === "preparar" && data.resumen?.albumSlug) {
        setLista(true);
        setSlug(data.resumen.albumSlug);
      }
      setResultado(JSON.stringify(data.resumen ?? data.resultado ?? data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setEnCurso(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Demos para charlas</h1>
        <p className="mt-1 text-gray-600">
          Demos con datos falsos, dentro de la plataforma real. Nada de lo que hagas acá cobra, manda correos ni
          aparece en estadísticas.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Venta escolar de punta a punta</h2>
          <p className="text-sm text-gray-600">
            Escuela Demo Los Aromos · {lista ? `preparada (álbum ${slug})` : "todavía sin preparar"}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {ACCIONES.map((a) => (
            <div key={a.id} className="rounded-lg border border-gray-200 p-4">
              <Button
                variant={a.variant}
                onClick={() => ejecutar(a.id)}
                disabled={enCurso !== null || (!lista && a.id !== "preparar")}
              >
                {enCurso === a.id ? "Trabajando…" : a.etiqueta}
              </Button>
              <p className="mt-2 text-sm text-gray-600">{a.ayuda}</p>
            </div>
          ))}
        </div>
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {resultado && (
          <pre className="max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-800">{resultado}</pre>
        )}
      </Card>
    </div>
  );
}
