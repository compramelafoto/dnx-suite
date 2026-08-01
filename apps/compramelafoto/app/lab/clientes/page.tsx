"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClientsTable from "@/components/clients/ClientsTable";
import { ensureLabSession } from "@/lib/lab-session-client";

export default function LabClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [labId, setLabId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensureLabSession();
      if (!active) return;
      if (!session) {
        router.push("/lab/login");
        return;
      }
      setLabId(session.labId);
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (labId) {
      loadClients();
    }
  }, [search, labId]);

  async function loadClients() {
    if (!labId) return;
    setLoading(true);
    try {
      const url = `/api/lab/clientes?labId=${labId}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando clientes:", err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        <p style={{ color: "#444" }}>Cargando clientes...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Laboratorio — Clientes Históricos</h1>
      <p style={{ marginTop: 0, marginBottom: 16, color: "#444" }}>
        Buscá y exportá la información de todos los clientes históricos.
      </p>

      <ClientsTable
        clients={clients}
        onSearch={setSearch}
        searchValue={search}
        onClientUpdated={loadClients}
        labId={labId || undefined}
      />

      <div style={{ marginTop: 18 }}>
        <Link href="/lab/pedidos">← Volver a Pedidos</Link>
      </div>
    </main>
  );
}
