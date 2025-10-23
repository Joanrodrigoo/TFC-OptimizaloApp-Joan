// SyncProgressBar.tsx
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface SyncStatus {
  customerId: string;
  totalTasks: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  progressPercentage: number;
  isCompleted: boolean;

  // Información de días
  totalDays: number;
  completedDays: number;
  startDate: string | null;
  endDate: string | null;

  dailyTasks: {
    total: number;
    completed: number;
    pending: number;
  };
  weeklyTasks: {
    total: number;
    completed: number;
    pending: number;
  };
}

interface SyncProgressBarProps {
  customerId: string;
  onComplete?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
  onSyncStatusChange?: (syncing: boolean) => void;
}

const SyncProgressBar = ({
  customerId,
  onComplete,
  onVisibilityChange,
  onSyncStatusChange,
}: SyncProgressBarProps) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNotifiedCompletion, setHasNotifiedCompletion] = useState(false);

  // Notificar cambios de visibilidad
  useEffect(() => {
    if (onVisibilityChange) {
      onVisibilityChange(isVisible);
    }
  }, [isVisible, onVisibilityChange]);

  // Polling cada 3 segundos
  useEffect(() => {
    if (!customerId) return;

    let isFirstFetch = true;

    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `https://pwi.es/api/sync-status/${customerId}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            setIsVisible(false);
            return;
          }
          throw new Error("Error al obtener estado de sincronización");
        }

        const data: SyncStatus = await response.json();

        // Solo mostrar si hay tareas pendientes o en proceso
        if (data.pending > 0 || data.processing > 0) {
          setSyncStatus(data);
          setIsVisible(true);
          setHasNotifiedCompletion(false); // Reset si vuelve a procesar
        } else if (data.isCompleted && !hasNotifiedCompletion) {
          // Si es el primer fetch y ya está completado, no mostrar el banner
          if (isFirstFetch) {
            setIsVisible(false);
            setHasNotifiedCompletion(true);
            if (onComplete) {
              onComplete();
            }
          } else {
            // Si estaba visible y ahora se completó, mostrarlo 5 segundos
            setSyncStatus(data);
            setIsVisible(true);
            setHasNotifiedCompletion(true);

            // Notificar completado una sola vez
            if (onComplete) {
              onComplete();
            }

            // Ocultar después de 5 segundos
            setTimeout(() => {
              setIsVisible(false);
            }, 5000);
          }
        } else {
          setIsVisible(false);
        }
        if (onSyncStatusChange) {
          const isSyncing = data.pending > 0 || data.processing > 0;
          onSyncStatusChange(isSyncing);
        }
        isFirstFetch = false;
      } catch (err) {
        console.error("Error fetching sync status:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);

    return () => clearInterval(interval);
  }, [customerId, onComplete, hasNotifiedCompletion, onSyncStatusChange]);

  // Retry failed tasks
  const handleRetry = async () => {
    try {
      const response = await fetch(
        `https://pwi.es/api/sync-queue/${customerId}/retry`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Error al reintentar tareas fallidas");
      }

      const data = await response.json();
      console.log(`✅ ${data.retried} tareas reiniciadas`);
      setHasNotifiedCompletion(false); // Reset para permitir nueva notificación
    } catch (err) {
      console.error("Error retrying tasks:", err);
      setError(err instanceof Error ? err.message : "Error al reintentar");
    }
  };

  // Función para formatear fechas
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (!isVisible || !syncStatus) return null;

  const {
    progressPercentage,
    isCompleted,
    failed,
    processing,
    totalDays = 0,
    completedDays = 0,
    startDate,
    endDate,
  } = syncStatus;

  // Determinar estado
  const hasErrors = failed > 0;
  const isProcessing = processing > 0;

  return (
    <div className="fixed top-16 left-0 md:top-0 md:left-64 right-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm animate-slide-in-down">
      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Status Icon */}
          <div
            className={`flex-shrink-0 p-2 rounded-lg ${
              isCompleted
                ? "bg-green-500"
                : hasErrors
                ? "bg-red-500"
                : isProcessing
                ? "bg-teal-500"
                : "bg-blue-500"
            }`}
          >
            {isCompleted ? (
              <CheckCircle className="h-4 w-4 text-white" />
            ) : hasErrors ? (
              <XCircle className="h-4 w-4 text-white" />
            ) : isProcessing ? (
              <Clock className="h-4 w-4 text-white animate-pulse" />
            ) : (
              <AlertCircle className="h-4 w-4 text-white" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0 leading-tight">
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <span className="text-sm font-medium">
                    {isCompleted
                      ? "✅ Sincronización completada"
                      : hasErrors
                      ? `⚠️ Sincronización con errores`
                      : isProcessing
                      ? totalDays > 0
                        ? `Importando datos: ${completedDays} de ${totalDays} días importados`
                        : `Sincronizando datos...`
                      : `Preparando sincronización...`}
                  </span>

                  {startDate && endDate && !isCompleted && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Desde {formatDate(startDate)} hasta {formatDate(endDate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasErrors && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    className="h-7 text-xs"
                  >
                    Reintentar
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <Progress
              value={progressPercentage}
              className={`h-2 ${
                isCompleted
                  ? "[&>div]:bg-green-500"
                  : hasErrors
                  ? "[&>div]:bg-red-500"
                  : ""
              }`}
            />

            {/* Error message */}
            {error && (
              <div className="mt-2 text-xs text-red-500">Error: {error}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncProgressBar;
