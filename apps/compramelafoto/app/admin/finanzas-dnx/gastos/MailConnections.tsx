"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Cuenta = {
  id: number;
  email: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  backfillDone: boolean;
  pendingReview: number;
};

const AVISOS: Record<string, string> = {
  conectada: "Cuenta conectada. Ya podés leer los mails.",
  cancelado: "Se canceló la conexión con Google.",
  vencido: "La conexión tardó demasiado. Probá de nuevo.",
};

function fechaAR(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function MailConnections({ onSynced }: { onSynced: () => void }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/admin/finance-dnx/mail/accounts", { cache: "no-store" });
    if (res.ok) setCuentas((await res.json()).accounts);
  }, []);

  useEffect(() => {
    void cargar();
    const sp = new URLSearchParams(window.location.search);
    const estado = sp.get("gmail");
    if (estado) {
      setMensaje(estado === "error" ? sp.get("detalle") ?? "No se pudo conectar la cuenta." : AVISOS[estado] ?? null);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [cargar]);

  async function leerAhora() {
    setLeyendo(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/finance-dnx/mail/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje(json.error ?? "No se pudieron leer los mails.");
      } else {
        const results = json.results as { saved: number; pending: boolean; error: string | null }[];
        const total = results.reduce((s, r) => s + r.saved, 0);
        const quedan = results.some((r) => r.pending && !r.error);
        const p = json.processed as { loaded: number; review: number; fixed: number } | null;
        const cargados = p ? ` Se cargaron o completaron ${p.loaded + p.fixed} gastos y ${p.review} mails quedaron para revisar.` : "";
        setMensaje(`Se leyeron ${total} mails nuevos.${cargados}${quedan ? ' Quedan más: volvé a tocar "Leer ahora".' : ""}`);
      }
    } finally {
      setLeyendo(false);
      await cargar();
      onSynced();
    }
  }

  async function desconectar(c: Cuenta) {
    if (!confirm(`¿Desconectar ${c.email}? Los gastos ya cargados se mantienen.`)) return;
    await fetch(`/api/admin/finance-dnx/mail/accounts/${c.id}`, { method: "DELETE" });
    await cargar();
    onSynced();
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Conexiones con Gmail</h2>
          <p className="text-sm text-gray-600">
            Sólo lectura. Se leen únicamente los mails de los proveedores conocidos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => (window.location.href = "/api/admin/finance-dnx/mail/connect")}>
            Conectar Gmail
          </Button>
          <Button onClick={leerAhora} disabled={leyendo || cuentas.length === 0}>
            {leyendo ? "Leyendo..." : "Leer ahora"}
          </Button>
        </div>
      </div>
      {mensaje && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-800 text-sm mb-4">{mensaje}</div>
      )}
      {cuentas.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay cuentas conectadas.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {cuentas.map((c) => (
            <li key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 break-all">{c.email}</p>
                <p className="text-xs text-gray-500">
                  Última lectura: {fechaAR(c.lastSyncAt)} · {c.backfillDone ? "historial completo" : "leyendo historial"} ·{" "}
                  {c.pendingReview} para revisar
                </p>
                {c.lastError && <p className="text-xs text-red-700 mt-1">{c.lastError}</p>}
              </div>
              <Button variant="secondary" onClick={() => desconectar(c)}>
                Desconectar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
