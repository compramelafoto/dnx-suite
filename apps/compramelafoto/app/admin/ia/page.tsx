"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface AnalysisStats {
  totalPhotos: number;
  pendingJobs: number;
  processingJobs: number;
  doneJobs: number;
  errorJobs: number;
  photosWithoutJob: number;
  photosWithOcrTokens: number;
  photosWithFaces: number;
  excludedPhotos: number;
  totalFaceMatches: number;
  progressPercent: number;
}

interface ErrorGroup {
  error: string;
  errorType: string;
  count: number;
  examples: Array<{
    jobId: number;
    photoId: number;
    photo: {
      id: number;
      albumId: number;
      originalKey: string | null;
      previewUrl: string | null;
      analysisStatus: string;
      analysisError: string | null;
    };
    attempts: number | null;
    updatedAt: Date;
    lastError: string | null;
  }>;
}

interface ErrorDiagnostics {
  errorGroups: ErrorGroup[];
  photosWithoutKey: number;
  config: {
    hasGoogleVision: boolean;
    hasAwsRekognition: boolean;
    googleVisionConfigured: boolean;
    awsRekognitionConfigured: boolean;
  };
  totalErrors: number;
  errorTypesSummary?: {
    AUTH_ERROR: number;
    RATE_LIMIT: number;
    IMAGE_CORRUPT: number;
    NETWORK_ERROR: number;
    MISSING_KEY: number;
    GOOGLE_VISION_ERROR: number;
    AWS_REKOGNITION_ERROR: number;
    UNKNOWN: number;
  };
}

export default function AdminIAPage() {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [reprocessResult, setReprocessResult] = useState<any>(null);
  const [errorDiagnostics, setErrorDiagnostics] = useState<ErrorDiagnostics | null>(null);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [testingConnections, setTestingConnections] = useState(false);
  const [connectionTest, setConnectionTest] = useState<any>(null);

  useEffect(() => {
    loadStatus();
    loadErrorDiagnostics();
    // Actualizar estado cada 5 segundos cuando está procesando
    const interval = setInterval(() => {
      if (processing) {
        loadStatus();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [processing]);

  async function loadStatus() {
    try {
      const res = await fetch("/api/admin/ai/status", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error cargando estado:", err);
    }
  }

  async function loadErrorDiagnostics() {
    setLoadingErrors(true);
    try {
      const res = await fetch("/api/admin/ai/errors?limit=50", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setErrorDiagnostics(data);
      }
    } catch (err) {
      console.error("Error cargando diagnóstico de errores:", err);
    } finally {
      setLoadingErrors(false);
    }
  }

  async function testConnections() {
    setTestingConnections(true);
    setMessage(null);
    setConnectionTest(null);

    try {
      const res = await fetch("/api/admin/ai/test-connections", { credentials: "include" });
      const data = await res.json();

      if (res.ok) {
        setConnectionTest(data);
        if (data.summary.bothWorking) {
          setMessage({ type: "success", text: "✅ Ambas conexiones funcionan correctamente" });
        } else if (data.summary.googleVision || data.summary.awsRekognition) {
          setMessage({ type: "info", text: "⚠️ Algunas conexiones tienen problemas. Revisá los detalles abajo." });
        } else {
          setMessage({ type: "error", text: "❌ Ninguna conexión funciona. Revisá la configuración." });
        }
      } else {
        setMessage({ type: "error", text: data.error || "Error al probar conexiones" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
    } finally {
      setTestingConnections(false);
    }
  }

  async function handleReprocessAll() {
    if (!confirm("¿Estás seguro de que querés reprocesar TODAS las fotos?\n\nEsto eliminará los análisis anteriores (OCR y reconocimiento facial) y creará nuevos jobs para todas las fotos.")) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setReprocessResult(null);

    try {
      const res = await fetch("/api/admin/ai/reprocess-all?limit=500", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Fotos preparadas para reprocesamiento" });
        setReprocessResult(data);
        await loadStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Error al preparar fotos" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessBatch() {
    setProcessing(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ai/process", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        const processed = data.processed || 0;
        const backfilled = data.backfilled || 0;
        const errors = data.errors || [];

        // Actualizar estado siempre
        await loadStatus();

        if (processed > 0 || backfilled > 0) {
          setMessage({
            type: "success",
            text: `Procesadas ${processed} fotos. ${backfilled > 0 ? `${backfilled} jobs creados.` : ""} ${errors.length > 0 ? `${errors.length} errores.` : ""}`,
          });
          
          // Continuar procesando si hay más trabajo (verificar después de actualizar estado)
          setTimeout(async () => {
            const statusRes = await fetch("/api/admin/ai/status", { credentials: "include" });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              const currentPending = statusData.stats?.pendingJobs || 0;
              if (currentPending > 0) {
                handleProcessBatch();
              } else {
                setMessage({ type: "info", text: "Procesamiento completado. No hay más fotos pendientes." });
                setProcessing(false);
              }
            } else {
              handleProcessBatch(); // Reintentar si falla la verificación
            }
          }, 2000);
        } else {
          // Verificar si realmente no hay más trabajo o si hubo un problema
          setTimeout(async () => {
            const statusRes = await fetch("/api/admin/ai/status", { credentials: "include" });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              const currentPending = statusData.stats?.pendingJobs || 0;
              if (currentPending > 0) {
                // Hay fotos pendientes pero no se procesaron, puede ser un problema temporal
                setMessage({ 
                  type: "info", 
                  text: `No se procesaron fotos en este lote. Hay ${currentPending} fotos pendientes. Reintentando...` 
                });
                handleProcessBatch();
              } else {
                setMessage({ type: "info", text: "No hay más fotos para procesar" });
                setProcessing(false);
              }
            } else {
              setMessage({ type: "info", text: "No hay más fotos para procesar" });
              setProcessing(false);
            }
          }, 1000);
        }
      } else {
        setMessage({ type: "error", text: data.error || "Error al procesar" });
        setProcessing(false);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
      setProcessing(false);
    }
  }

  async function handleStartFullReprocess() {
    if (!confirm("¿Iniciar reprocesamiento completo?\n\nEsto ejecutará:\n1. Preparación de todas las fotos\n2. Procesamiento automático en lotes\n\nEl proceso puede tardar varios minutos.")) {
      return;
    }

    // Paso 1: Preparar todas las fotos
    setLoading(true);
    setMessage({ type: "info", text: "Preparando fotos para reprocesamiento..." });

    try {
      const prepRes = await fetch("/api/admin/ai/reprocess-all?limit=500", {
        method: "POST",
        credentials: "include",
      });

      const prepData = await prepRes.json();

      if (!prepRes.ok) {
        setMessage({ type: "error", text: prepData.error || "Error al preparar fotos" });
        setLoading(false);
        return;
      }

      setReprocessResult(prepData);
      setMessage({ type: "success", text: `Preparadas ${prepData.reprocessed} fotos. Iniciando procesamiento...` });
      await loadStatus();
      setLoading(false);

      // Paso 2: Iniciar procesamiento automático
      setProcessing(true);
      handleProcessBatch();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
      setLoading(false);
    }
  }

  async function handleResetDecoderErrors() {
    if (!confirm("¿Resetear errores de decodificación?\n\nEsto reseteará específicamente las fotos con errores de decodificación (imágenes corruptas) para que se vuelvan a procesar con el nuevo código que normaliza imágenes.\n\nLas fotos se marcarán como PENDING y podrás procesarlas nuevamente.")) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ai/reset-decoder-errors", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          type: "success", 
          text: data.message || `Se resetearon ${data.reset || 0} jobs con errores de decodificación` 
        });
        await loadStatus();
        await loadErrorDiagnostics();
      } else {
        setMessage({ type: "error", text: data.error || "Error al resetear errores de decodificación" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlockStuck() {
    if (!confirm("¿Desbloquear jobs trabados?\n\nEsto reseteará los jobs que están en PROCESSING por más de 15 minutos (probablemente quedaron trabados por timeout o error).\n\nEstos jobs se marcarán como PENDING para que se vuelvan a procesar.")) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ai/unlock-stuck?minutes=15", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          type: "success", 
          text: data.message || `Se desbloquearon ${data.unlocked || 0} jobs trabados` 
        });
        await loadStatus();
        await loadErrorDiagnostics();
      } else {
        setMessage({ type: "error", text: data.error || "Error al desbloquear jobs trabados" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipCorrupt() {
    if (!confirm("¿Marcar fotos corruptas como excluidas?\n\nEsto marcará las fotos corruptas como excluidas del procesamiento automático.\n\nEstas fotos no se procesarán automáticamente en el futuro, pero las nuevas fotos que subas se procesarán normalmente.")) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ai/skip-corrupt", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          type: "success", 
          text: data.message || `Se marcaron ${data.skipped || 0} fotos corruptas como excluidas` 
        });
        await loadStatus();
        await loadErrorDiagnostics();
      } else {
        setMessage({ type: "error", text: data.error || "Error al marcar fotos corruptas" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipAllErrors() {
    if (!confirm(`¿Marcar TODAS las fotos con errores como excluidas?\n\nEsto marcará TODAS las fotos con errores (${stats?.errorJobs || 0} fotos) como excluidas del procesamiento automático.\n\nEstas fotos no se procesarán automáticamente en el futuro, pero las nuevas fotos que subas se procesarán normalmente.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ai/skip-all-errors", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          type: "success", 
          text: data.message || `Se marcaron ${data.skipped || 0} fotos con errores como excluidas` 
        });
        await loadStatus();
        await loadErrorDiagnostics();
      } else {
        setMessage({ type: "error", text: data.error || "Error al marcar fotos con errores" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

      async function handleSkipPending() {
    if (!confirm(`¿Marcar TODAS las fotos pendientes como excluidas?\n\nEsto marcará TODAS las fotos pendientes (${stats?.pendingJobs || 0} fotos) como excluidas del procesamiento automático.\n\nEstas fotos no se procesarán automáticamente en el futuro, pero las nuevas fotos que subas se procesarán normalmente.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ai/skip-pending", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          type: "success", 
          text: data.message || `Se marcaron ${data.skipped || 0} fotos pendientes como excluidas` 
        });
        await loadStatus();
        await loadErrorDiagnostics();
      } else {
        setMessage({ type: "error", text: data.error || "Error al marcar fotos pendientes" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inteligencia Artificial</h1>
        <p className="text-gray-600 mt-1">Reconocimiento facial y OCR de imágenes</p>
      </div>

      {/* Mensajes */}
      {message && (
        <Card className={`p-4 border-l-4 ${
          message.type === "success" ? "border-green-500 bg-green-50" :
          message.type === "error" ? "border-red-500 bg-red-50" :
          "border-blue-500 bg-blue-50"
        }`}>
          <p className={`text-sm ${
            message.type === "success" ? "text-green-800" :
            message.type === "error" ? "text-red-800" :
            "text-blue-800"
          }`}>
            {message.text}
          </p>
        </Card>
      )}

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600">Total de Fotos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalPhotos}</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Progreso</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.progressPercent}%</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pendingJobs}</p>
              </div>
              {stats.pendingJobs > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSkipPending}
                  disabled={loading || processing}
                  className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300 text-xs px-2 py-1"
                  title="Excluir todas las fotos pendientes del procesamiento"
                >
                  ⏭️ Excluir
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Procesando</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.processingJobs}</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Completadas</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.doneJobs}</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Con Errores</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.errorJobs}</p>
          </Card>

          {stats.excludedPhotos > 0 && (
            <Card className="p-6">
              <p className="text-sm text-gray-600">Excluidas</p>
              <p className="text-2xl font-bold text-gray-500 mt-1">{stats.excludedPhotos}</p>
            </Card>
          )}

          <Card className="p-6">
            <p className="text-sm text-gray-600">Con OCR</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.photosWithOcrTokens}</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Con Rostros</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.photosWithFaces}</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600">Matches de Reconocimiento Facial</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalFaceMatches || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total de caras indexadas</p>
          </Card>
        </div>
      )}

      {/* Resultado del reprocesamiento */}
      {reprocessResult && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Último Reprocesamiento</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Fotos preparadas:</strong> {reprocessResult.reprocessed}</p>
            <p><strong>Jobs eliminados:</strong> {reprocessResult.deletedJobs}</p>
            <p><strong>Tokens OCR eliminados:</strong> {reprocessResult.deletedOcrTokens}</p>
            <p><strong>Detecciones faciales eliminadas:</strong> {reprocessResult.deletedFaces}</p>
            <p><strong>Total de fotos:</strong> {reprocessResult.totalPhotos}</p>
            <p><strong>Jobs pendientes:</strong> {reprocessResult.pendingJobs}</p>
          </div>
        </Card>
      )}

      {/* Acciones */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-2">
              Reprocesamiento Completo
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Prepara todas las fotos para reprocesamiento y ejecuta el análisis automáticamente.
              Esto eliminará los análisis anteriores (OCR y reconocimiento facial) y creará nuevos jobs.
            </p>
            <Button
              variant="primary"
              onClick={handleStartFullReprocess}
              disabled={loading || processing}
              className="w-full md:w-auto"
            >
              {loading ? "Preparando..." : processing ? "Procesando..." : "🚀 Reprocesar Todas las Fotos"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-md font-medium text-gray-900 mb-2">
              Solo Preparar (sin procesar)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Solo prepara las fotos para reprocesamiento sin ejecutar el análisis.
              Luego podés ejecutar el procesamiento manualmente.
            </p>
            <Button
              variant="secondary"
              onClick={handleReprocessAll}
              disabled={loading || processing}
              className="w-full md:w-auto"
            >
              {loading ? "Preparando..." : "Preparar Fotos para Reprocesamiento"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-md font-medium text-gray-900 mb-2">
              Procesar Lote Actual
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Procesa un lote de 10 fotos pendientes. Útil para procesar manualmente.
            </p>
            <Button
              variant="secondary"
              onClick={handleProcessBatch}
              disabled={loading || processing}
              className="w-full md:w-auto"
            >
              {processing ? "Procesando..." : "Procesar Lote"}
            </Button>
          </div>

          {stats && stats.processingJobs > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-md font-medium text-gray-900 mb-2">
                🔓 Desbloquear Jobs Trabados
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Desbloquea jobs que están en PROCESSING por más de 15 minutos (probablemente quedaron trabados por timeout o error).
                Estos jobs se resetearán a PENDING para que se vuelvan a procesar.
              </p>
              <Button
                variant="secondary"
                onClick={handleUnlockStuck}
                disabled={loading || processing}
                className="w-full md:w-auto bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
              >
                {loading ? "Desbloqueando..." : "🔓 Desbloquear Jobs Trabados"}
              </Button>
            </div>
          )}

          {stats && stats.pendingJobs > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-md font-medium text-gray-900 mb-2">
                ⏭️ Excluir Todas las Fotos Pendientes
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Marca TODAS las fotos pendientes como excluidas del procesamiento automático.
                Estas fotos no se procesarán automáticamente en el futuro, pero las nuevas fotos que subas se procesarán normalmente.
                Útil si querés dejar de lado todas las fotos pendientes y solo procesar las nuevas.
              </p>
              <Button
                variant="secondary"
                onClick={handleSkipPending}
                disabled={loading || processing}
                className="w-full md:w-auto bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300"
              >
                {loading ? "Marcando..." : "⏭️ Excluir Todas las Fotos Pendientes"}
              </Button>
            </div>
          )}

          {stats && stats.errorJobs > 0 && (
            <>
              <div className="border-t pt-4">
                <h3 className="text-md font-medium text-gray-900 mb-2">
                  ⏭️ Excluir Todas las Fotos con Errores
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Marca TODAS las fotos con errores como excluidas del procesamiento automático.
                  Estas fotos no se procesarán automáticamente en el futuro, pero las nuevas fotos que subas se procesarán normalmente.
                  Útil si querés dejar de lado todas las fotos con errores y solo procesar las nuevas.
                </p>
                <Button
                  variant="secondary"
                  onClick={handleSkipAllErrors}
                  disabled={loading || processing}
                  className="w-full md:w-auto bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                >
                  {loading ? "Marcando..." : "⏭️ Excluir Todas las Fotos con Errores"}
                </Button>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-md font-medium text-gray-900 mb-2">
                  ⏭️ Excluir Solo Fotos Corruptas del Procesamiento
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Marca solo las fotos corruptas (imágenes corruptas o formatos no soportados) como excluidas del procesamiento automático.
                  Estas fotos no se procesarán automáticamente en el futuro, pero las nuevas fotos que subas se procesarán normalmente.
                  Útil si querés dejar de lado solo las fotos corruptas y seguir intentando procesar otras fotos con errores diferentes.
                </p>
                <Button
                  variant="secondary"
                  onClick={handleSkipCorrupt}
                  disabled={loading || processing}
                  className="w-full md:w-auto bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-300"
                >
                  {loading ? "Marcando..." : "⏭️ Excluir Solo Fotos Corruptas"}
                </Button>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-md font-medium text-gray-900 mb-2">
                  🔧 Resetear Errores de Decodificación
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Resetea específicamente las fotos con errores de decodificación (imágenes corruptas).
                  Estas fotos se marcarán como PENDING para que se vuelvan a procesar con el nuevo código
                  que normaliza imágenes a JPEG antes del análisis.
                </p>
                <Button
                  variant="secondary"
                  onClick={handleResetDecoderErrors}
                  disabled={loading || processing}
                  className="w-full md:w-auto bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-300"
                >
                  {loading ? "Reseteando..." : "🔄 Resetear Errores de Decodificación"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Prueba de Conexiones */}
      <Card className="p-6 border-l-4 border-blue-400 bg-blue-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-blue-900">
            🔌 Prueba de Conexiones
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={testConnections}
            disabled={testingConnections}
          >
            {testingConnections ? "Probando..." : "🔍 Probar Conexiones"}
          </Button>
        </div>

        {connectionTest && (
          <div className="space-y-4 mt-4">
            <div className="bg-white p-4 rounded-md">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Resultados</h3>
              
              <div className="space-y-3">
                <div className="border-b pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Google Vision API (OCR)</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      connectionTest.results.googleVision.working 
                        ? "bg-green-100 text-green-800" 
                        : connectionTest.results.googleVision.configured
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {connectionTest.results.googleVision.working 
                        ? "✅ Funcionando" 
                        : connectionTest.results.googleVision.configured
                        ? "❌ Error"
                        : "⚠️ No configurado"}
                    </span>
                  </div>
                  {connectionTest.results.googleVision.configured && (
                    <div className="text-sm text-gray-600">
                      {connectionTest.results.googleVision.working ? (
                        <span className="text-green-700">
                          ✅ Conexión exitosa. La API respondió correctamente.
                          {connectionTest.results.googleVision.details && (
                            <span className="block mt-1 text-xs">
                              Text annotations encontrados: {connectionTest.results.googleVision.details.textAnnotations || 0}
                            </span>
                          )}
                        </span>
                      ) : (
                        <div>
                          <span className="text-red-700 font-medium">Error: </span>
                          <span className="text-red-600">{connectionTest.results.googleVision.error}</span>
                          {connectionTest.results.googleVision.details?.isAuthError && (
                            <span className="block mt-1 text-xs text-red-600">
                              ⚠️ Problema de autenticación. Verificá las credenciales.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">AWS Rekognition (Reconocimiento Facial)</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      connectionTest.results.awsRekognition.working 
                        ? "bg-green-100 text-green-800" 
                        : connectionTest.results.awsRekognition.configured
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {connectionTest.results.awsRekognition.working 
                        ? "✅ Funcionando" 
                        : connectionTest.results.awsRekognition.configured
                        ? "❌ Error"
                        : "⚠️ No configurado"}
                    </span>
                  </div>
                  {connectionTest.results.awsRekognition.configured && (
                    <div className="text-sm text-gray-600">
                      {connectionTest.results.awsRekognition.working ? (
                        <span className="text-green-700">
                          ✅ Conexión exitosa. La API respondió correctamente.
                          {connectionTest.results.awsRekognition.details && (
                            <span className="block mt-1 text-xs">
                              Caras detectadas: {connectionTest.results.awsRekognition.details.faceCount || 0}
                            </span>
                          )}
                        </span>
                      ) : (
                        <div>
                          <span className="text-red-700 font-medium">Error: </span>
                          <span className="text-red-600">{connectionTest.results.awsRekognition.error}</span>
                          {connectionTest.results.awsRekognition.details?.isAuthError && (
                            <span className="block mt-1 text-xs text-red-600">
                              ⚠️ Problema de autenticación. Verificá las credenciales.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Diagnóstico de Errores */}
      {((stats && stats.errorJobs > 0) || errorDiagnostics) && (
        <Card className="p-6 border-l-4 border-red-400 bg-red-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-red-900">
              🔍 Diagnóstico de Errores ({stats?.errorJobs || 0} fotos con errores)
            </h2>
            <div className="flex gap-2 flex-wrap">
              {stats && stats.errorJobs > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSkipAllErrors}
                  disabled={loading || loadingErrors}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                >
                  {loading ? "Marcando..." : "⏭️ Excluir Todas"}
                </Button>
              )}
              {(errorDiagnostics?.errorTypesSummary?.IMAGE_CORRUPT || 0) > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSkipCorrupt}
                  disabled={loading || loadingErrors}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-300"
                >
                  {loading ? "Marcando..." : "⏭️ Excluir Corruptas"}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={loadErrorDiagnostics}
                disabled={loadingErrors}
              >
                {loadingErrors ? "Cargando..." : "Actualizar Diagnóstico"}
              </Button>
            </div>
          </div>

          {errorDiagnostics && (
            <div className="space-y-4">
              {/* Resumen de tipos de error */}
              {errorDiagnostics.errorTypesSummary && (
                <div className="bg-white p-4 rounded-md border-2 border-red-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">📊 Resumen de Tipos de Error</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {errorDiagnostics.errorTypesSummary.AUTH_ERROR > 0 && (
                      <div className="bg-red-50 p-2 rounded border border-red-200">
                        <p className="font-semibold text-red-800">🔐 Autenticación</p>
                        <p className="text-red-600">{errorDiagnostics.errorTypesSummary.AUTH_ERROR} fotos</p>
                      </div>
                    )}
                    {errorDiagnostics.errorTypesSummary.RATE_LIMIT > 0 && (
                      <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                        <p className="font-semibold text-yellow-800">⏱️ Rate Limit</p>
                        <p className="text-yellow-600">{errorDiagnostics.errorTypesSummary.RATE_LIMIT} fotos</p>
                      </div>
                    )}
                    {errorDiagnostics.errorTypesSummary.IMAGE_CORRUPT > 0 && (
                      <div className="bg-orange-50 p-2 rounded border border-orange-200">
                        <p className="font-semibold text-orange-800">🖼️ Imagen Corrupta</p>
                        <p className="text-orange-600">{errorDiagnostics.errorTypesSummary.IMAGE_CORRUPT} fotos</p>
                      </div>
                    )}
                    {errorDiagnostics.errorTypesSummary.NETWORK_ERROR > 0 && (
                      <div className="bg-blue-50 p-2 rounded border border-blue-200">
                        <p className="font-semibold text-blue-800">🌐 Red/Timeout</p>
                        <p className="text-blue-600">{errorDiagnostics.errorTypesSummary.NETWORK_ERROR} fotos</p>
                      </div>
                    )}
                    {errorDiagnostics.errorTypesSummary.MISSING_KEY > 0 && (
                      <div className="bg-gray-50 p-2 rounded border border-gray-200">
                        <p className="font-semibold text-gray-800">🔑 Sin originalKey</p>
                        <p className="text-gray-600">{errorDiagnostics.errorTypesSummary.MISSING_KEY} fotos</p>
                      </div>
                    )}
                    {errorDiagnostics.errorTypesSummary.GOOGLE_VISION_ERROR > 0 && (
                      <div className="bg-purple-50 p-2 rounded border border-purple-200">
                        <p className="font-semibold text-purple-800">👁️ Google Vision</p>
                        <p className="text-purple-600">{errorDiagnostics.errorTypesSummary.GOOGLE_VISION_ERROR} fotos</p>
                      </div>
                    )}
                    {errorDiagnostics.errorTypesSummary.AWS_REKOGNITION_ERROR > 0 && (
                      <div className="bg-indigo-50 p-2 rounded border border-indigo-200">
                        <p className="font-semibold text-indigo-800">🤖 AWS Rekognition</p>
                        <p className="text-indigo-600">{errorDiagnostics.errorTypesSummary.AWS_REKOGNITION_ERROR} fotos</p>
                      </div>
                    )}
                    {errorDiagnostics.errorTypesSummary.UNKNOWN > 0 && (
                      <div className="bg-gray-50 p-2 rounded border border-gray-200">
                        <p className="font-semibold text-gray-800">❓ Desconocido</p>
                        <p className="text-gray-600">{errorDiagnostics.errorTypesSummary.UNKNOWN} fotos</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Configuración de servicios */}
              <div className="bg-white p-4 rounded-md">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Configuración de Servicios</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={errorDiagnostics.config.googleVisionConfigured ? "text-green-600" : "text-red-600"}>
                      {errorDiagnostics.config.googleVisionConfigured ? "✅" : "❌"}
                    </span>
                    <span>Google Vision API (OCR): {errorDiagnostics.config.googleVisionConfigured ? "Configurado" : "NO configurado"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={errorDiagnostics.config.awsRekognitionConfigured ? "text-green-600" : "text-red-600"}>
                      {errorDiagnostics.config.awsRekognitionConfigured ? "✅" : "❌"}
                    </span>
                    <span>AWS Rekognition (Reconocimiento Facial): {errorDiagnostics.config.awsRekognitionConfigured ? "Configurado" : "NO configurado"}</span>
                  </div>
                  {errorDiagnostics.photosWithoutKey > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <span>⚠️</span>
                      <span>{errorDiagnostics.photosWithoutKey} fotos sin originalKey (no se pueden procesar)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Errores agrupados */}
              {errorDiagnostics.errorGroups.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Errores más comunes:</h3>
                  {errorDiagnostics.errorGroups.slice(0, 10).map((group, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-md border border-red-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                              {group.errorType}
                            </span>
                            <span className="text-sm font-bold text-red-600">
                              {group.count} {group.count === 1 ? "foto" : "fotos"}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-red-900">
                            {group.error}
                          </p>
                        </div>
                      </div>
                      {group.examples.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                            Ver ejemplos ({group.examples.length})
                          </summary>
                          <div className="mt-2 space-y-2 pl-4">
                            {group.examples.map((example, exIdx) => (
                              <div key={exIdx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                <p className="font-medium">• Foto ID: {example.photoId} | Job ID: {example.jobId}</p>
                                {example.photo.originalKey ? (
                                  <p className="pl-2 mt-1">originalKey: {example.photo.originalKey.substring(0, 60)}...</p>
                                ) : (
                                  <p className="pl-2 mt-1 text-red-600">⚠️ Sin originalKey</p>
                                )}
                                {example.attempts && example.attempts > 0 && (
                                  <p className="pl-2 mt-1">Intentos: {example.attempts}</p>
                                )}
                                {example.lastError && (
                                  <p className="pl-2 mt-1 text-red-600 font-mono text-xs break-all">
                                    Error: {example.lastError.substring(0, 200)}{example.lastError.length > 200 ? "..." : ""}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Recomendaciones */}
              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                <h3 className="text-sm font-semibold text-yellow-900 mb-2">💡 Recomendaciones</h3>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  {!errorDiagnostics.config.googleVisionConfigured && (
                    <li>Configurá GOOGLE_APPLICATION_CREDENTIALS_JSON en las variables de entorno para habilitar OCR.</li>
                  )}
                  {!errorDiagnostics.config.awsRekognitionConfigured && (
                    <li>Configurá AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION y REKOGNITION_COLLECTION_ID para habilitar reconocimiento facial.</li>
                  )}
                  {errorDiagnostics.photosWithoutKey > 0 && (
                    <li>Hay {errorDiagnostics.photosWithoutKey} fotos sin originalKey. Estas fotos no se pueden procesar hasta que se corrija el problema.</li>
                  )}
                  {errorDiagnostics.errorGroups.some(g => 
                    g.error.toLowerCase().includes('decoder') || 
                    g.error.toLowerCase().includes('unsupported') ||
                    g.error.includes('1E08010C') ||
                    g.error.toLowerCase().includes('corrupta')
                  ) && (
                    <li>
                      <strong>Errores de decodificación detectados:</strong> Hay fotos con errores de imágenes corruptas o formatos no soportados. 
                      Usá el botón "🔄 Resetear Errores de Decodificación" para resetearlas y reprocesarlas con el código mejorado que normaliza imágenes.
                    </li>
                  )}
                  {stats && stats.pendingJobs > 0 && stats.processingJobs === 0 && (
                    <li>Hay {stats.pendingJobs} fotos pendientes pero ninguna se está procesando. Ejecutá "Procesar Lote" para iniciar el procesamiento.</li>
                  )}
                  {stats && stats.errorJobs > 0 && (
                    <li>Hay {stats.errorJobs} fotos con errores. Revisá los errores arriba y corregí los problemas antes de reprocesar.</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Información */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="text-md font-semibold text-blue-900 mb-2">ℹ️ Información</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>El reprocesamiento completo puede tardar varios minutos dependiendo de la cantidad de fotos.</li>
          <li>Se procesan 10 fotos por lote para evitar sobrecarga del servidor.</li>
          <li>El proceso se ejecuta automáticamente y se actualiza cada 5 segundos.</li>
          <li>Los análisis anteriores (OCR y reconocimiento facial) se eliminan antes de crear nuevos.</li>
        </ul>
      </Card>
    </div>
  );
}
