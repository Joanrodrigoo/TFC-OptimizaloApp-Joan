import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DashboardSummary {
  avgImpressions: number;
  avgClicks: number;
  avgCtr: number;
  avgCpc: number;
  avgCost: number;
  avgConversions: number;
  avgConversionRate: number;
  avgCostPerConversion: number;
  prevAvgImpressions: number;
  prevAvgClicks: number;
  prevAvgCtr: number;
  prevAvgCpc: number;
  prevAvgCost: number;
  prevAvgConversions: number;
  prevAvgConversionRate: number;
  prevAvgCostPerConversion: number;
  impressionsChange: number;
  clicksChange: number;
  ctrChange: number;
  cpcChange: number;
  costChange: number;
  conversionsChange: number;
  conversionRateChange: number;
  costPerConversionChange: number;
}

interface Metric {
  label: string;
  value: string | number;
  prevValue: string | number;
  change: number;
  prefix?: string;
  increased?: boolean;
}

const MetricsOverview = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard-summary")
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        console.log("Datos recibidos del backend:", data); // Debug
        
        // Mapear correctamente los datos del backend
        const mappedData: DashboardSummary = {
          avgImpressions: data.avgImpressions || 0,
          avgClicks: data.avgClicks || 0,
          avgCtr: data.avgCtr || 0,
          avgCpc: data.avgCpc || 0,
          avgCost: data.avgCost || 0,
          avgConversions: data.avgConversions || 0,
          avgConversionRate: data.avgConversionRate || 0,
          avgCostPerConversion: data.avgCostPerConversion || 0,
          prevAvgImpressions: data.prevAvgImpressions || 0,
          prevAvgClicks: data.prevAvgClicks || 0,
          prevAvgCtr: data.prevAvgCtr || 0,
          prevAvgCpc: data.prevAvgCpc || 0,
          prevAvgCost: data.prevAvgCost || 0,
          prevAvgConversions: data.prevAvgConversions || 0,
          prevAvgConversionRate: data.prevAvgConversionRate || 0,
          prevAvgCostPerConversion: data.prevAvgCostPerConversion || 0,
          impressionsChange: data.impressionsChange || 0,
          clicksChange: data.clicksChange || 0,
          ctrChange: data.ctrChange || 0,
          cpcChange: data.cpcChange || 0,
          costChange: data.costChange || 0,
          conversionsChange: data.conversionsChange || 0,
          conversionRateChange: data.conversionRateChange || 0,
          costPerConversionChange: data.costPerConversionChange || 0,
        };
        
        console.log("Datos mapeados:", mappedData); // Debug
        setSummary(mappedData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando métricas...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;
  if (!summary) return null;

  // Función helper para valores seguros
  const safeNumber = (value: number, defaultValue = 0) => {
    return Number.isFinite(value) && !isNaN(value) ? value : defaultValue;
  };

  const metrics: Metric[] = [
    {
      label: "Avg. Impressions",
      value: Math.round(safeNumber(summary.avgImpressions)).toLocaleString(),
      prevValue: Math.round(safeNumber(summary.prevAvgImpressions)).toLocaleString(),
      change: summary.impressionsChange,
      increased: summary.impressionsChange > 0,
    },
    {
      label: "Avg. Clicks",
      value: Math.round(safeNumber(summary.avgClicks)).toLocaleString(),
      prevValue: Math.round(safeNumber(summary.prevAvgClicks)).toLocaleString(),
      change: summary.clicksChange,
      increased: summary.clicksChange > 0,
    },
    {
      label: "Avg. CTR",
      value: `${(safeNumber(summary.avgCtr) * 100).toFixed(2)}%`,
      prevValue: `${(safeNumber(summary.prevAvgCtr) * 100).toFixed(2)}%`,
      change: summary.ctrChange,
      increased: summary.ctrChange > 0,
    },
    {
      label: "Avg. CPC",
      value: formatCurrency(safeNumber(summary.avgCpc)),
      prevValue: formatCurrency(safeNumber(summary.prevAvgCpc)),
      change: summary.cpcChange,
      prefix: "",
      increased: summary.cpcChange < 0, // Para CPC, menor es mejor
    },
    {
      label: "Avg. Cost",
      value: formatCurrency(safeNumber(summary.avgCost)),
      prevValue: formatCurrency(safeNumber(summary.prevAvgCost)),
      change: Math.abs(summary.costChange), // Mostrar valor absoluto
      prefix: "",
      increased: summary.costChange > 0,
    },
    {
      label: "Avg. Conversions",
      value: safeNumber(summary.avgConversions).toFixed(2),
      prevValue: safeNumber(summary.prevAvgConversions).toFixed(2),
      change: summary.conversionsChange,
      increased: summary.conversionsChange > 0,
    },
    {
      label: "Avg. Conversion Rate",
      value: `${(safeNumber(summary.avgConversionRate) * 100).toFixed(2)}%`,
      prevValue: `${(safeNumber(summary.prevAvgConversionRate) * 100).toFixed(2)}%`,
      change: summary.conversionRateChange,
      increased: summary.conversionRateChange > 0,
    },
    {
      label: "Cost per Conversion",
      value: formatCurrency(safeNumber(summary.avgCostPerConversion)),
      prevValue: formatCurrency(safeNumber(summary.prevAvgCostPerConversion)),
      change: Math.abs(summary.costPerConversionChange), // Mostrar valor absoluto
      prefix: "",
      increased: summary.costPerConversionChange < 0, // Para cost per conversion, menor es mejor
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {metric.label}
            </CardTitle>
            {metric.increased !== undefined && (
              <div
                className={`flex items-center space-x-1 ${
                  metric.increased ? "text-green-500" : "text-red-500"
                }`}
              >
                {metric.increased ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="text-xs font-medium">{metric.change}%</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typeof metric.value === "number" && metric.prefix
                ? formatCurrency(metric.value)
                : metric.prefix
                ? `${metric.prefix}${metric.value}`
                : metric.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs. {typeof metric.prevValue === "number" && metric.prefix
                ? formatCurrency(metric.prevValue)
                : metric.prefix && typeof metric.prevValue === "string" && !metric.prevValue.includes('$') && !metric.prevValue.includes('%')
                ? `${metric.prefix}${metric.prevValue}`
                : metric.prevValue}{" "}
              last month
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MetricsOverview;