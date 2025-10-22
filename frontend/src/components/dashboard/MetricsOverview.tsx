
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Metric {
  label: string;
  value: string | number;
  prevValue: string | number;
  change: number;
  prefix?: string;
  increased?: boolean;
}

const MetricsOverview = () => {
  const metrics: Metric[] = [
    {
      label: "Total Impressions",
      value: "65.5K",
      prevValue: "48.2K",
      change: 35.9,
      increased: true
    },
    {
      label: "Total Clicks",
      value: "2,270",
      prevValue: "1,890",
      change: 20.1,
      increased: true
    },
    {
      label: "Total Cost",
      value: 4301.5,
      prevValue: 3850.75,
      change: 11.7,
      prefix: "$",
      increased: true
    },
    {
      label: "Avg. CPC",
      value: 1.89,
      prevValue: 2.03,
      change: 6.9,
      prefix: "$",
      increased: false
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {metric.label}
            </CardTitle>
            {metric.increased !== undefined && (
              <div className={`flex items-center space-x-1 ${metric.increased ? 'text-green-500' : 'text-red-500'}`}>
                {metric.increased ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="text-xs font-medium">{metric.change}%</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typeof metric.value === 'number' && metric.prefix 
                ? formatCurrency(metric.value)
                : metric.prefix ? `${metric.prefix}${metric.value}` : metric.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs. {typeof metric.prevValue === 'number' && metric.prefix
                ? formatCurrency(metric.prevValue)
                : metric.prefix ? `${metric.prefix}${metric.prevValue}` : metric.prevValue} last month
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MetricsOverview;
