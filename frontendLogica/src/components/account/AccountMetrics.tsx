import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency  } from "@/lib/utils";
import { fetchAccountMetrics } from "@/services/api";

interface AccountMetricsProps {
  accountId: string;
  dateRange: { from: Date; to: Date };
}

interface AccountMetricsResponse {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  costPerConversion: number;
  changes: {
    spend: string;
    impressions: string;
    clicks: string;
    conversions: string;
    ctr: string;
    cpc: string;
    conversionRate: string;
    costPerConversion: string;
  };
  debug?: {
    currentPeriod: { from: string; to: string };
    previousPeriod: { from: string; to: string };
    periodDurationDays: number;
    hasCurrentData: boolean;
    hasPreviousData: boolean;
  };
}

interface MetricsData {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  costPerConversion: number;
}

const metricsCache = new Map<string, { data: MetricsData; timestamp: number; changes: AccountMetricsResponse['changes'] }>();
const CACHE_DURATION = 5 * 60 * 1000;

const MetricSkeleton = React.memo(() => (
  <Card className="animate-pulse">
    <CardHeader className="pb-2">
      <div className="h-4 bg-muted rounded w-3/4"></div>
    </CardHeader>
    <CardContent>
      <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-muted rounded w-1/4"></div>
    </CardContent>
  </Card>
));

const MetricCard = React.memo(({ 
  title, 
  value, 
  change, 
  isLoading 
}: { 
  title: string; 
  value: string; 
  change: string; 
  isLoading?: boolean;
}) => {
  const changeColor = useMemo(() => {
    if (change.startsWith('+') && change !== '+0%' && change !== '+0.0%') return 'text-green-600';
    if (change.startsWith('-') && change !== '-0%' && change !== '-0.0%') return 'text-red-600';
    return 'text-muted-foreground';
  }, [change]);

  const ChangeIcon = useMemo(() => {
    if (change.startsWith('+') && change !== '+0%' && change !== '+0.0%') return TrendingUp;
    if (change.startsWith('-') && change !== '-0%' && change !== '-0.0%') return TrendingDown;
    return Minus;
  }, [change]);

  if (isLoading) return <MetricSkeleton />;

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <div className={`flex items-center gap-1 text-xs ${changeColor}`}>
          <ChangeIcon className="h-3 w-3" />
          <span>{change}</span>
        </div>
      </CardContent>
    </Card>
  );
});

MetricCard.displayName = 'MetricCard';

const AccountMetrics = ({ accountId, dateRange }: AccountMetricsProps) => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [changes, setChanges] = useState<AccountMetricsResponse['changes'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const cacheKey = useMemo(() => 
    `${accountId}-${dateRange.from.getTime()}-${dateRange.to.getTime()}`,
    [accountId, dateRange]
  );

  const cleanExpiredCache = useCallback(() => {
    const now = Date.now();
    for (const [key, value] of metricsCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        metricsCache.delete(key);
      }
    }
  }, []);

  // Función simplificada: usar directamente los datos de la API sin transformaciones innecesarias
  const mapApiDataToMetrics = useCallback((apiData: AccountMetricsResponse): MetricsData => {
    const toSafeNumber = (value: any, defaultValue: number = 0): number => {
      if (value === null || value === undefined || value === '' || value === 'null') return defaultValue;
      const num = Number(value);
      return isNaN(num) || !isFinite(num) ? defaultValue : num;
    };

    return {
      spend: toSafeNumber(apiData.spend),
      impressions: toSafeNumber(apiData.impressions),
      clicks: toSafeNumber(apiData.clicks),
      conversions: toSafeNumber(apiData.conversions),
      ctr: toSafeNumber(apiData.ctr),
      cpc: toSafeNumber(apiData.cpc), // Ya viene convertido de la API
      conversionRate: toSafeNumber(apiData.conversionRate),
      costPerConversion: toSafeNumber(apiData.costPerConversion) // Ya viene convertido de la API
    };
  }, []);

  const loadAccountMetrics = useCallback(async (forceRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    cleanExpiredCache();

    if (!forceRefresh) {
      const cached = metricsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setMetrics(cached.data);
        setChanges(cached.changes);
        setLoading(false);
        setError(null);
        return;
      }
    }

    setLoading(!forceRefresh);
    setIsRefreshing(forceRefresh);
    setError(null);

    abortControllerRef.current = new AbortController();
    
    try {
      const response: AccountMetricsResponse = await fetchAccountMetrics(accountId, dateRange);
      if (abortControllerRef.current?.signal.aborted) return;

      if (response) {
        const metricsData = mapApiDataToMetrics(response);
        setMetrics(metricsData);
        setChanges(response.changes || null);

        // Guardar en cache con los changes incluidos
        metricsCache.set(cacheKey, {
          data: metricsData,
          changes: response.changes || {},
          timestamp: Date.now()
        });

        setError(null);
      } else {
        throw new Error("No se recibieron datos de la API");
      }
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) return;
      console.error("Error fetching account metrics:", err);

      let errorMessage = "Error desconocido";
      if (err instanceof Error) {
        if (err.message.includes('401')) {
          errorMessage = "No autorizado. Por favor, inicia sesión nuevamente.";
        } else if (err.message.includes('400')) {
          errorMessage = "Parámetros inválidos en la solicitud.";
        } else if (err.message.includes('500')) {
          errorMessage = "Error interno del servidor.";
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = "Error de conexión. Verifica tu conexión a internet.";
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);

      const cached = metricsCache.get(cacheKey);
      if (cached) {
        setMetrics(cached.data);
        setChanges(cached.changes);
        setError(`${errorMessage} (Mostrando datos en cache)`);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [accountId, dateRange, cacheKey, cleanExpiredCache, mapApiDataToMetrics]);

  useEffect(() => {
    if (accountId) {
      loadAccountMetrics();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [accountId, dateRange, loadAccountMetrics]);

  const handleRefresh = useCallback(() => {
    loadAccountMetrics(true);
  }, [loadAccountMetrics]);

  const getChangeValue = useCallback(
    (metric: keyof AccountMetricsResponse['changes']) => {
      if (!changes) return "0%";
      return changes[metric] ?? "0%";
    },
    [changes]
  );

  const metricCards = useMemo(() => {
    if (!metrics) return [];

    const safeFormat = (value: number, decimals: number = 2): string => {
      const num = Number(value);
      return isNaN(num) ? '0.00' : num.toFixed(decimals);
    };
    
    return [
      { title: "Gasto", value: formatCurrency(metrics.spend || 0), change: getChangeValue('spend'), key: 'spend' },
      { title: "Impresiones", value: (metrics.impressions || 0).toLocaleString(), change: getChangeValue('impressions'), key: 'impressions' },
      { title: "Clics", value: (metrics.clicks || 0).toLocaleString(), change: getChangeValue('clicks'), key: 'clicks' },
      { title: "Conversiones", value: (metrics.conversions || 0).toString(), change: getChangeValue('conversions'), key: 'conversions' },
      { title: "CTR", value: `${safeFormat(metrics.ctr)}%`, change: getChangeValue('ctr'), key: 'ctr' },
      { title: "CPC", value: formatCurrency(metrics.cpc || 0), change: getChangeValue('cpc'), key: 'cpc' },
      { title: "Tasa Conv.", value: `${safeFormat(metrics.conversionRate)}%`, change: getChangeValue('conversionRate'), key: 'conversionRate' },
      { title: "Coste/Conv.", value: formatCurrency(metrics.costPerConversion || 0), change: getChangeValue('costPerConversion'), key: 'costPerConversion' }
    ];
  }, [metrics, getChangeValue]);

  if (loading && !metrics) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Métricas de la Cuenta</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Métricas de la Cuenta</h3>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p className="mb-4">Error al cargar las métricas: {error}</p>
              <Button onClick={handleRefresh} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Métricas de la Cuenta</h3>
      </div>
      
      {error && (
        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric) => (
          <MetricCard
            key={metric.key}
            title={metric.title}
            value={metric.value}
            change={metric.change}
            isLoading={loading}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(AccountMetrics);