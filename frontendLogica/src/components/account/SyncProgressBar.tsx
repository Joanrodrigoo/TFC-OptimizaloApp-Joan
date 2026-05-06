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

  // CAMBIO: Información de SEMANAS (no días)
  totalWeeks: number;
  completedWeeks: number;
  startDate: string | null;
  endDate: string | null;

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
          `/api/sync-status/${customerId}`,
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
          setHasNotifiedCompletion(false);
        } else if (data.isCompleted && !hasNotifiedCompletion) {
          if (isFirstFetch) {
            setIsVisible(false);
            setHasNotifiedCompletion(true);
            if (onComplete) {
              onComplete();
            }
          } else {
            setSyncStatus(data);
            setIsVisible(true);
            setHasNotifiedCompletion(true);

            if (onComplete) {
              onComplete();
            }

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
        `/api/sync-queue/${customerId}/retry`,
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
      setHasNotifiedCompletion(false);
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
  totalWeeks = 0,      // CAMBIO: usar totalWeeks
  completedWeeks = 0,  // CAMBIO: usar completedWeeks
  startDate,
  endDate,
} = syncStatus;


  // Determinar estado
  const hasErrors = failed > 0;
  const isProcessing = processing > 0;

  // Determinar icono y color
const getStatusConfig = () => {
  if (isCompleted) {
    return {
      icon: <CheckCircle className="h-4 w-4 text-white" />,
      bgColor: "bg-green-500",
      progressColor: "[&>div]:bg-green-500",
      message: "✅ Sincronización completada",
    };
  }
  if (hasErrors) {
    return {
      icon: <XCircle className="h-4 w-4 text-white" />,
      bgColor: "bg-red-500",
      progressColor: "[&>div]:bg-red-500",
      message: "⚠️ Sincronización con errores",
    };
  }
  if (isProcessing) {
    return {
      icon: <Clock className="h-4 w-4 text-white animate-pulse" />,
      bgColor: "bg-teal-500",
      progressColor: "",
      message:
        totalWeeks > 0  // CAMBIO: usar totalWeeks
          ? `Importando datos: ${completedWeeks} de ${totalWeeks} semanas sincronizadas`  // CAMBIO: mensaje con "semanas"
          : "Sincronizando datos...",
    };
  }
  return {
    icon: <AlertCircle className="h-4 w-4 text-white" />,
    bgColor: "bg-blue-500",
    progressColor: "",
    message: "Preparando sincronización...",
  };
};


  const statusConfig = getStatusConfig();

  return (
    <div className="sticky top-0 left-0 md:left-64 right-0 z-30 bg-background border-b-2 rounded-b-lg shadow-lg animate-slide-in-down">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Status Icon */}
          <div className={`flex-shrink-0 p-2 ${statusConfig.bgColor} rounded-lg`}>
            {statusConfig.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">
                  {statusConfig.message}
                </span>
                {startDate && endDate && !isCompleted && (
                  <span className="text-xs text-muted-foreground ml-2">
                    · Desde {formatDate(startDate)} hasta {formatDate(endDate)}
                  </span>
                )}
              </div>

              {/* Retry Button */}
              {hasErrors && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  className="h-7 text-xs ml-2"
                >
                  Reintentar
                </Button>
              )}
            </div>

            {/* Progress Bar */}
            <Progress
              value={progressPercentage}
              className={`h-2 ${statusConfig.progressColor}`}
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
