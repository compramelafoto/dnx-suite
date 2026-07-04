"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import ClientsTable from "@/components/clients/ClientsTable";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function FotografoClientesPage() {
  const router = useRouter();
  const [photographerId, setPhotographerId] = useState<number | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number>(0);
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
      setPhotographerId(session.photographerId);
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((photographerData) => {
          if (photographerData) {
            setPhotographer(photographerData);
          }
        })
        .catch(() => {});
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (photographerId) {
      loadClients(photographerId);
      loadPendingRemovalCount(photographerId);
    }
  }, [photographerId]);

  async function loadPendingRemovalCount(photographerId: number) {
    try {
      const params = new URLSearchParams({
        photographerId: photographerId.toString(),
        status: "PENDING",
      });
      const res = await fetch(`/api/dashboard/removal-requests?${params}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setPendingRemovalCount(data.length);
      }
    } catch (err) {
      // Silenciar errores
    }
  }

  useEffect(() => {
    // Escuchar eventos de actualización de solicitudes
    const handleUpdate = () => {
      if (photographerId) {
        loadPendingRemovalCount(photographerId);
      }
    };
    window.addEventListener('removalRequestUpdated', handleUpdate);
    return () => window.removeEventListener('removalRequestUpdated', handleUpdate);
  }, [photographerId]);

  async function loadClients(photographerId: number) {
    setClientsLoading(true);
    try {
      const res = await fetch(`/api/fotografo/clientes?photographerId=${photographerId}`);
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error cargando clientes:", err);
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }

  if (clientsLoading && clients.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <div className="container-custom py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
              Clientes Históricos
            </h1>
            <p className="text-gray-600">
              Gestioná tu lista de clientes y su historial de compras
            </p>
          </div>

          {/* Tabla de clientes */}
          <Card className="space-y-6">
            <ClientsTable
              clients={clients}
              searchValue={clientSearch}
              onClientUpdated={() => loadClients(photographerId || 0)}
              photographerId={photographerId || undefined}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
