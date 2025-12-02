import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2, 
  PlayCircle, 
  StopCircle,
  RefreshCw
} from "lucide-react";

interface AccountSync {
  customerId: string;
  totalTasks: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  progressPercentage: number;
  isCompleted: boolean;
  isProcessing: boolean;
  startedAt: string | null;
  lastCompletedAt: string | null;
}

interface QueueStatus {
  isRunning: boolean;
  processingCount: number;
  maxConcurrent: number;
  processingAccounts: string[];
}

interface SyncSummary {
  accounts: AccountSync[];
  queueStatus: QueueStatus;
}

interface SyncSummaryDashboardProps {
  onAccountClick?: (customerId: string) => void;
}

const SyncSummaryDashboard: React.FC<SyncSummaryDashboardProps> = ({ 
  onAccountClick 
}) => {
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const apiUrl = "https://optimizalo.app";

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/sync-summary`, {
        credentials: "include",
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSummary(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sync summary:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();

    // Polling cada 10 segundos
    const interval = setInterval(fetchSummary, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleStartSync = async () => {
    setActionLoading('start');
    try {
      const response = await fetch(`${apiUrl}/api/start-sync`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchSummary();
      }
    } catch (error) {
      console.error("Error starting sync:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopSync = async () => {
    setActionLoading('stop');
    try {
      const response = await fetch(`${apiUrl}/api/stop-sync`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchSummary();
      }
    } catch (error) {
      console.error("Error stopping sync:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryFailed = async (customerId: string) => {
    setActionLoading(customerId);
    try {
      const response = await fetch(`${apiUrl}/api/sync-queue/${customerId}/retry`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchSummary();
      }
    } catch (error) {
      console.error("Error retrying failed tasks:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (account: AccountSync) => {
    if (account.failed > 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          {account.failed} Fallidas
        </Badge>
      );
    }
    if (account.isCompleted) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <CheckCircle2 className="h-3 w-3" />
          Completada
        </Badge>
      );
    }
    if (account.isProcessing) {
      return (
        <Badge variant="secondary" className="gap-1 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          Procesando
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        En Cola
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Cargando estado de sincronización...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay sincronizaciones activas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { accounts, queueStatus } = summary;
  const totalAccounts = accounts.length;
  const completedAccounts = accounts.filter(a => a.isCompleted).length;
  const processingAccounts = accounts.filter(a => a.isProcessing).length;
  const failedAccounts = accounts.filter(a => a.failed > 0).length;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado de Sincronización</CardTitle>
              <CardDescription>
                {totalAccounts} cuenta{totalAccounts !== 1 ? 's' : ''} en sincronización
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSummary}
                disabled={actionLoading !== null}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${actionLoading === 'refresh' ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              {queueStatus.isRunning ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopSync}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'stop' ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-1" />
                  )}
                  Detener
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartSync}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'start' ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-1" />
                  )}
                  Iniciar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Queue Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Estado de Cola</p>
              <p className="text-lg font-semibold flex items-center gap-2">
                {queueStatus.isRunning ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Activa
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
                    </span>
                    Detenida
                  </>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Procesando</p>
              <p className="text-lg font-semibold">
                {processingAccounts} / {queueStatus.maxConcurrent}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Completadas</p>
              <p className="text-lg font-semibold text-green-600">
                {completedAccounts}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Con Errores</p>
              <p className="text-lg font-semibold text-red-600">
                {failedAccounts}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      <div className="grid gap-4">
        {accounts.map((account) => (
          <Card 
            key={account.customerId}
            className={`transition-all ${account.isProcessing ? 'ring-2 ring-teal-500' : ''}`}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">
                        Cuenta {account.customerId}
                      </h3>
                      {getStatusBadge(account)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {account.completed} de {account.totalTasks} semanas completadas
                    </p>
                  </div>
                  {account.failed > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetryFailed(account.customerId)}
                      disabled={actionLoading === account.customerId}
                    >
                      {actionLoading === account.customerId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Reintentar
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progreso</span>
                    <span className="font-medium">
                      {Math.round(account.progressPercentage)}%
                    </span>
                  </div>
                  <Progress 
                    value={account.progressPercentage}
                    className={`h-2 ${
                      account.failed > 0 
                        ? '[&>div]:bg-red-500' 
                        : account.isCompleted 
                        ? '[&>div]:bg-green-500' 
                        : ''
                    }`}
                  />
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Completadas</p>
                    <p className="font-medium">{account.completed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Procesando</p>
                    <p className="font-medium">{account.processing}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pendientes</p>
                    <p className="font-medium">{account.pending}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fallidas</p>
                    <p className="font-medium text-red-600">{account.failed}</p>
                  </div>
                </div>

                {/* Timestamps */}
                {(account.startedAt || account.lastCompletedAt) && (
                  <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                    {account.startedAt && (
                      <div className="flex justify-between">
                        <span>Iniciada:</span>
                        <span>{formatDate(account.startedAt)}</span>
                      </div>
                    )}
                    {account.lastCompletedAt && (
                      <div className="flex justify-between">
                        <span>Última actualización:</span>
                        <span>{formatDate(account.lastCompletedAt)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Button */}
                {onAccountClick && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => onAccountClick(account.customerId)}
                  >
                    Ver Detalles
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SyncSummaryDashboard;