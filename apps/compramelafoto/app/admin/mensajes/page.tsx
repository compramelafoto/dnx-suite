"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface ContactMessage {
  id: number;
  createdAt: string;
  name: string;
  email: string;
  role: string | null;
  message: string;
  documentUrl: string | null;
  photographerId: number | null;
  isRead: boolean;
  readAt: string | null;
  photographer: {
    id: number;
    name: string | null;
    email: string;
  } | null;
}

export default function AdminMensajesPage() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();
  }, [filter]);

  async function loadMessages() {
    setLoading(true);
    try {
      const isReadParam = filter === "all" ? null : filter === "read" ? "true" : "false";
      const url = `/api/admin/contact-messages${isReadParam ? `?isRead=${isReadParam}` : ""}`;
      const res = await fetch(url, {
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error cargando mensajes:", res.status, errorData);
        
        // Si es un error 500, puede ser que la tabla no existe
        if (res.status === 500) {
          const errorMsg = errorData.detail || errorData.error || "Error del servidor";
          if (errorMsg.includes("does not exist") || errorMsg.includes("Unknown table") || errorMsg.includes("ContactMessage")) {
            console.error("La tabla ContactMessage no existe. Ejecutá: npx prisma db push");
          }
        }
        return;
      }
      
      const data = await res.json();
      console.log("Mensajes cargados:", data); // Debug
      
      if (data.warning) {
        setWarning(data.warning);
        setError(null);
      } else {
        setWarning(null);
        setError(null);
      }
      
      setMessages(data.messages || []);
      setUnreadCount(data.unread || 0);
    } catch (err: any) {
      console.error("Error cargando mensajes:", err);
      setError("Error de conexión al cargar mensajes: " + (err?.message || "Error desconocido"));
      setWarning(null);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(messageId: number) {
    try {
      const res = await fetch("/api/admin/contact-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: messageId, isRead: true }),
      });
      if (res.ok) {
        loadMessages();
        if (selectedMessage?.id === messageId) {
          setSelectedMessage({ ...selectedMessage, isRead: true, readAt: new Date().toISOString() });
        }
      }
    } catch (err) {
      console.error("Error marcando como leído:", err);
    }
  }

  async function deleteMessage(messageId: number) {
    if (!confirm("¿Estás seguro de que querés eliminar este mensaje? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/contact-messages?id=${messageId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (res.ok) {
        // Si el mensaje eliminado era el seleccionado, limpiar la selección
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(null);
        }
        // Recargar la lista de mensajes
        loadMessages();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Error al eliminar el mensaje: " + (errorData.error || "Error desconocido"));
      }
    } catch (err: any) {
      console.error("Error eliminando mensaje:", err);
      alert("Error al eliminar el mensaje: " + (err?.message || "Error desconocido"));
    }
  }

  function getRoleLabel(role: string | null): string {
    const labels: Record<string, string> = {
      fotografo: "Fotógrafo",
      laboratorio: "Laboratorio",
      otro: "Otro",
    };
    return role ? labels[role] || role : "No especificado";
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando mensajes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mensajes de Contacto</h1>
          <p className="text-gray-600 mt-1">
            {unreadCount > 0 && (
              <span className="text-blue-600 font-semibold">{unreadCount} sin leer</span>
            )}
            {unreadCount === 0 && filter === "all" && "Todos los mensajes leídos"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "primary" : "secondary"}
            onClick={() => setFilter("all")}
            size="sm"
          >
            Todos
          </Button>
          <Button
            variant={filter === "unread" ? "primary" : "secondary"}
            onClick={() => setFilter("unread")}
            size="sm"
          >
            Sin leer ({unreadCount})
          </Button>
          <Button
            variant={filter === "read" ? "primary" : "secondary"}
            onClick={() => setFilter("read")}
            size="sm"
          >
            Leídos
          </Button>
        </div>
      </div>

      {(error || warning) && (
        <Card className={`p-4 border-l-4 ${error ? "border-red-400 bg-red-50" : "border-yellow-400 bg-yellow-50"}`}>
          <p className={`text-sm ${error ? "text-red-700" : "text-yellow-700"}`}>
            {error || warning}
          </p>
        </Card>
      )}

      {messages.length === 0 && !loading ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">
            {warning 
              ? warning 
              : `No hay mensajes ${filter === "unread" ? "sin leer" : filter === "read" ? "leídos" : ""}`
            }
          </p>
          {warning && (
            <p className="text-sm text-gray-500 mt-2">
              Ejecutá en tu terminal: <code className="bg-gray-100 px-2 py-1 rounded">npx prisma db push</code>
            </p>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de mensajes */}
          <div className="lg:col-span-1 space-y-3">
            {messages.map((msg) => (
              <Card
                key={msg.id}
                className={`p-4 transition-all ${
                  selectedMessage?.id === msg.id
                    ? "border-blue-500 border-2"
                    : msg.isRead
                    ? "border-gray-200"
                    : "border-blue-300 border-2 bg-blue-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (!msg.isRead) {
                        markAsRead(msg.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">{msg.name}</p>
                      {!msg.isRead && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{msg.email}</p>
                    {msg.role && (
                      <p className="text-xs text-gray-500 mt-1">{getRoleLabel(msg.role)}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(msg.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMessage(msg.id);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                    title="Eliminar mensaje"
                  >
                    🗑️
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Detalle del mensaje */}
          <div className="lg:col-span-2">
            {selectedMessage ? (
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedMessage.name}</h2>
                      <p className="text-gray-600">{selectedMessage.email}</p>
                    </div>
                    <div className="flex gap-2">
                      {!selectedMessage.isRead && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => markAsRead(selectedMessage.id)}
                        >
                          Marcar como leído
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => deleteMessage(selectedMessage.id)}
                        className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Rol</p>
                      <p className="text-gray-900">{getRoleLabel(selectedMessage.role)}</p>
                    </div>

                    {selectedMessage.photographer && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">Fotógrafo relacionado</p>
                        <p className="text-gray-900">
                          {selectedMessage.photographer.name || selectedMessage.photographer.email} (ID: {selectedMessage.photographer.id})
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-gray-500">Fecha</p>
                      <p className="text-gray-900">{formatDate(selectedMessage.createdAt)}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Mensaje</p>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                      </div>
                    </div>

                    {selectedMessage.documentUrl && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Documento adjunto</p>
                        <a
                          href={selectedMessage.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 underline"
                        >
                          📎 Ver documento
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-600">Seleccioná un mensaje para ver los detalles</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
